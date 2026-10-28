import { registerPlugin } from '@capacitor/core';

/**
 * On-device Sprach-Bridge:
 * - Android: native Bridge zu android.speech.SpeechRecognizer (geräteseitig,
 *   auf One UI/Galaxy-Geräten lokal über die Sprach-Engine auf der NPU)
 *   und android.speech.tts.TextToSpeech (System-Engine, offline Voices).
 * - Web/Browser: Web Speech API Fallback.
 */

export interface SpeechPlugin {
  listen(options?: { lang?: string; partial?: boolean }): Promise<void>;
  stopListening(): Promise<void>;
  speak(options: { text: string; lang?: string; rate?: number; pitch?: number }): Promise<void>;
  stopSpeaking(): Promise<void>;
  isSpeaking(): Promise<{ speaking: boolean }>;
  addListener(eventName: 'partial', cb: (e: { text: string }) => void): Promise<void>;
  addListener(eventName: 'result', cb: (e: { text: string }) => void): Promise<void>;
  addListener(eventName: 'error', cb: (e: { message: string }) => void): Promise<void>;
  addListener(eventName: 'end', cb: () => void): Promise<void>;
}

const Native = registerPlugin<SpeechPlugin>('LearnSpeech');

/** UI-Sprache → BCP-47-Tag für Spracherkennung & Sprachausgabe. */
const BCP47: Record<string, string> = { de: 'de-DE', ru: 'ru-RU', en: 'en-US' };

type Listener = (text: string) => void;

class SpeechService {
  private listening = false;
  private speaking = false;
  private onPartial: Listener | null = null;
  private onResult: Listener | null = null;
  private onEnd: (() => void) | null = null;
  private registered = false;
  /** App-Sprache — steuert Diktat-Sprache & Standard-TTS-Stimme. */
  private uiLang: 'de' | 'ru' | 'en' = 'de';

  /** Von App.tsx bei Sprachwechsel aufgerufen. */
  setUiLang(l: 'de' | 'ru' | 'en'): void {
    this.uiLang = l;
  }

  private sttLang(): string {
    return BCP47[this.uiLang] ?? 'de-DE';
  }

  /** TTS-Sprache: kyrillischer Text → russische Stimme, sonst App-Sprache. */
  private ttsLang(text: string): string {
    if (/[а-яё]/i.test(text)) return 'ru-RU';
    return BCP47[this.uiLang] ?? 'de-DE';
  }

  private registerNativeListeners(): void {
    if (this.registered) return;
    this.registered = true;
    Native.addListener('partial', (e) => this.onPartial?.(e.text)).catch(() => undefined);
    Native.addListener('result', (e) => this.onResult?.(e.text)).catch(() => undefined);
    Native.addListener('error', (e) => {
      this.listening = false;
      this.onEnd?.();
    }).catch(() => undefined);
    Native.addListener('end', () => {
      this.listening = false;
      this.onEnd?.();
    }).catch(() => undefined);
  }

  get isNative(): boolean {
    return typeof (window as { Capacitor?: unknown }).Capacitor !== 'undefined' && !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  }

  isListening(): boolean {
    return this.listening;
  }

  async startDictation(handlers: { partial: Listener; result: Listener; end: () => void }): Promise<boolean> {
    if (this.listening) return true;
    this.onPartial = handlers.partial;
    this.onResult = handlers.result;
    this.onEnd = handlers.end;
    this.listening = true;

    if (this.isNative) {
      this.registerNativeListeners();
      try {
        await Native.listen({ lang: this.sttLang(), partial: true });
        return true;
      } catch (e) {
        this.listening = false;
        this.onEnd?.();
        throw e;
      }
    }

    // ── Web-Fallback ──
    const WSR = (
      window as unknown as {
        SpeechRecognition?: new () => webkitLike;
        webkitSpeechRecognition?: new () => webkitLike;
      }
    );
    const Ctor = WSR.SpeechRecognition ?? WSR.webkitSpeechRecognition;
    if (!Ctor) {
      this.listening = false;
      this.onEnd?.();
      return false;
    }
    const rec = new Ctor();
    rec.lang = this.sttLang();
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (ev: SpeechRecognitionEventLike) => {
      let interim = '';
      let final = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (final) this.onResult?.(final.trim());
      else if (interim) this.onPartial?.(interim.trim());
    };
    rec.onerror = () => {
      this.listening = false;
      this.onEnd?.();
    };
    rec.onend = () => {
      if (this.listening) {
        this.listening = false;
        this.onEnd?.();
      }
    };
    (this as { webRec?: unknown }).webRec = rec;
    try {
      rec.start();
      return true;
    } catch {
      this.listening = false;
      this.onEnd?.();
      return false;
    }
  }

  async stopDictation(): Promise<void> {
    if (!this.listening) return;
    this.listening = false;
    if (this.isNative) {
      await Native.stopListening().catch(() => undefined);
      this.onEnd?.();
      return;
    }
    const webRec = (this as { webRec?: { stop: () => void } }).webRec;
    webRec?.stop();
    this.onEnd?.();
  }

  // ── TTS ──
  async speak(text: string, opts: { rate?: number } = {}): Promise<void> {
    await this.stopSpeaking();
    // Auf Markdown-Artefakte und LaTeX-Quelltext kürzen
    const clean = text
      .replace(/```[\s\S]*?```/g, ' (Codeblock) ')
      .replace(/\$\$?[^$]+\$\$?/g, ' (Formel) ')
      .replace(/[*_#>`~\[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);
    if (!clean) return;
    this.speaking = true;
    if (this.isNative) {
      await Native.speak({ text: clean, lang: this.ttsLang(clean), rate: opts.rate ?? 1 });
    } else {
      const synth = window.speechSynthesis;
      if (!synth) {
        this.speaking = false;
        return;
      }
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = this.ttsLang(clean);
      u.rate = opts.rate ?? 1;
      u.onend = () => {
        this.speaking = false;
      };
      u.onerror = () => {
        this.speaking = false;
      };
      synth.speak(u);
    }
  }

  async stopSpeaking(): Promise<void> {
    if (this.isNative) {
      await Native.stopSpeaking().catch(() => undefined);
    } else {
      window.speechSynthesis?.cancel();
    }
    this.speaking = false;
  }

  isSpeakingNow(): boolean {
    return this.speaking;
  }
}

interface webkitLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } };
}

export const speech = new SpeechService();
