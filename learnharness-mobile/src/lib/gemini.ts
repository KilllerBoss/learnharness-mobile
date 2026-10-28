import { type Attachment, type Message, type ModelId } from './types';
import { findModel } from './models';
import { getApiBase } from './storage';
import { t } from './i18n';

// ─── Kontent-Aufbau ────────────────────────────────────────────────────────────

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  thought?: boolean;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface StreamCallbacks {
  onText?: (delta: string) => void;
  onThought?: (delta: string) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
  /** Live-Status für die UI ("Verbinde…", "Warte auf Antwort…", Retry etc.) */
  onStatus?: (status: StreamStatus) => void;
}

export type StreamStatus =
  | { phase: 'connecting' }
  | { phase: 'waiting'; since: number }
  | { phase: 'thinking' }
  | { phase: 'receiving' }
  | {
      phase: 'retrying';
      attempt: number;
      maxAttempts: number;
      delayMs: number;
      until: number;
      reason: string;
    };

function withRetryable(e: Error, retryable: boolean): Error {
  (e as Error & { retryable?: boolean }).retryable = retryable;
  return e;
}

function isRetryable(e: Error): boolean {
  return (e as Error & { retryable?: boolean }).retryable === true;
}

/** Abortierbares Warten — resolve(false) bei Abbruch. */
function sleepSignal(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve(false);
    };
    signal?.addEventListener('abort', onAbort);
  });
}

export function buildContents(history: Message[]): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const m of history) {
    const parts: GeminiPart[] = [];
    if (m.attachments?.length) {
      for (const a of m.attachments) {
        parts.push({ inlineData: { mimeType: a.mimeType, data: a.data } });
      }
    }
    if (m.text.trim()) parts.push({ text: m.text });
    if (parts.length === 0) continue;
    contents.push({ role: m.role === 'user' ? 'user' : 'model', parts });
  }
  return contents;
}

/**
 * Denk-Budget je Modellklasse — funktioniert für gebündelte UND live
 * geladene Modelle (unbekannte IDs werden klassifiziert oder als
 * 'dynamic' behandelt).
 */
export function thinkingBudget(model: ModelId, thinkingOn: boolean): number {
  const style = findModel(model)?.thinkingStyle ?? 'dynamic';
  if (style === 'alwaysOn') return thinkingOn ? -1 : 128; // kann Denken nicht abschalten
  if (style === 'toggleable') return thinkingOn ? 8192 : 0;
  return thinkingOn ? -1 : 0; // dynamic: dynamisch / aus
}

// ─── Streaming-Request ─────────────────────────────────────────────────────────

interface StreamOptions {
  apiKey: string;
  model: ModelId;
  systemInstruction: string;
  history: Message[];
  thinking: boolean;
  signal?: AbortSignal;
  maxOutputTokens?: number;
}

function friendlyError(status: number, body: string): Error {
  let msg = '';
  try {
    const j = JSON.parse(body);
    msg = j?.error?.message ?? '';
  } catch {
    msg = body.slice(0, 300);
  }
  if (status === 400 && /API key not valid/i.test(msg)) {
    return new Error(t('err.keyInvalid'));
  }
  if (status === 400 && /contents is not specified|contents must not be empty/i.test(msg)) {
    return new Error(t('err.emptyRequest'));
  }
  if (status === 403) {
    return new Error(t('err.forbidden'));
  }
  if (status === 429) {
    return withRetryable(new Error(t('err.rate')), true);
  }
  if (status >= 500) {
    return withRetryable(new Error(t('err.server', { code: status })), true);
  }
  return new Error(msg || `HTTP-Fehler ${status}`);
}

export async function streamChat(opts: StreamOptions, cb: StreamCallbacks): Promise<void> {
  const base = getApiBase().replace(/\/+$/, '');
  const url = `${base}/v1beta/models/${opts.model}:streamGenerateContent?alt=sse`;

  const generationConfig: Record<string, unknown> = {
    temperature: 0.7,
    topP: 0.95,
  };
  if (opts.maxOutputTokens) generationConfig.maxOutputTokens = opts.maxOutputTokens;
  try {
    generationConfig.thinkingConfig = { thinkingBudget: thinkingBudget(opts.model, opts.thinking) };
  } catch {
    /* kein thinkingConfig falls nicht unterstützt */
  }

  // Guard: Ein leerer Verlauf würde sonst den kryptischen Google-Fehler
  // "GenerateContentRequest.contents: contents is not specified" auslösen.
  const contents = buildContents(opts.history);
  if (contents.length === 0) {
    throw new Error(t('err.emptyInput'));
  }

  const body = {
    contents,
    systemInstruction: { parts: [{ text: opts.systemInstruction }] },
    generationConfig,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  // ── Versuchs-Loop: Bei Google-Überlastung (5xx) / Rate-Limit (429) /
  //    Netzwerkfehler wird automatisch bis zu 2× erneut versucht. ──
  const MAX_ATTEMPTS = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      const delayMs = attempt === 2 ? 1500 : 3000;
      const reason = !lastError
        ? t('status.reasonNet')
        : lastError.message.includes('429')
          ? t('status.reasonRate')
          : /5\d\d|überlastet/.test(lastError.message)
            ? t('status.reasonServer')
            : t('status.reasonNet');
      cb.onStatus?.({
        phase: 'retrying',
        attempt: attempt - 1,
        maxAttempts: MAX_ATTEMPTS - 1,
        delayMs,
        until: Date.now() + delayMs,
        reason,
      });
      const ok = await sleepSignal(delayMs, opts.signal);
      if (!ok) return; // vom Nutzer abgebrochen
    }
    cb.onStatus?.({ phase: 'connecting' });
    try {
      await streamOnce(url, body, opts, cb);
      cb.onDone?.();
      return; // erfolgreich
    } catch (e) {
      const err = e as Error;
      if (err.name === 'AbortError') return;
      lastError = err;
      if (!isRetryable(err) || attempt >= MAX_ATTEMPTS) throw err;
    }
  }
}

async function streamOnce(
  url: string,
  body: Record<string, unknown>,
  opts: StreamOptions,
  cb: StreamCallbacks,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': opts.apiKey,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    throw withRetryable(new Error(t('err.net')), true);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw friendlyError(res.status, txt);
  }
  if (!res.body) {
    throw withRetryable(new Error('Leere Antwort vom Server.'), true);
  }

  cb.onStatus?.({ phase: 'waiting', since: Date.now() });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawAnything = false;

  const handleEvent = (payload: string) => {
    if (!payload || payload === '[DONE]') return;
    let obj: {
      candidates?: {
        content?: { parts?: GeminiPart[] };
        finishReason?: string;
      }[];
      promptFeedback?: { blockReason?: string };
    };
    try {
      obj = JSON.parse(payload);
    } catch {
      return;
    }
    if (obj.promptFeedback?.blockReason) {
      cb.onError?.(new Error(t('err.blocked', { reason: obj.promptFeedback.blockReason })));
      return;
    }
    const cand = obj.candidates?.[0];
    for (const part of cand?.content?.parts ?? []) {
      if (part.thought === true && typeof part.text === 'string') {
        sawAnything = true;
        cb.onStatus?.({ phase: 'thinking' });
        cb.onThought?.(part.text);
      } else if (typeof part.text === 'string') {
        sawAnything = true;
        cb.onStatus?.({ phase: 'receiving' });
        cb.onText?.(part.text);
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('data:')) handleEvent(t.slice(5).trim());
    }
  }
  if (buffer.trim().startsWith('data:')) handleEvent(buffer.trim().slice(5).trim());

  if (!sawAnything) {
    throw new Error(t('err.emptyResp'));
  }
}

// ─── Einmalige (nicht-streamende) JSON-Anfrage ─────────────────────────────────

export async function generateJson<T>(
  apiKey: string,
  model: ModelId,
  systemInstruction: string,
  userPrompt: string,
  schema: Record<string, unknown>,
): Promise<T | null> {
  const base = getApiBase().replace(/\/+$/, '');
  const url = `${base}/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: schema,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!res.ok) throw friendlyError(res.status, await res.text().catch(() => ''));
  const j = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function validateKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  const base = getApiBase().replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/v1beta/models?pageSize=1`, {
      headers: { 'x-goog-api-key': apiKey },
    });
    if (res.ok) return { ok: true, message: t('settings.keyOk') };
    if (res.status === 400 || res.status === 401) return { ok: false, message: t('settings.keyBad') };
    if (res.status === 403) return { ok: false, message: t('settings.keyForbidden') };
    return { ok: false, message: t('settings.keyHttp', { code: res.status }) };
  } catch {
    return { ok: false, message: t('settings.keyNoNet') };
  }
}

export { type Attachment };
