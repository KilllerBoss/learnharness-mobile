// ─── OpenAI-kompatibles Protokoll (Chat Completions + SSE) ────────────────────
// Für Inception (Mercury), Pollinations, VseGPT, DeepSeek, OpenRouter, Groq,
// Mistral, Hugging Face und beliebige benutzerdefinierte Endpoints.
// Gleiche Status-/Callback-UX wie
// die Gemini-Implementierung (onText/onThought/onDone/onError/onStatus).
import type { Message, ModelId } from './types';
import type { GeminiModel } from './types';
import { t } from './i18n';
import { providerBaseUrl, type ProviderPreset } from './providers';

export type { StreamStatus, StreamCallbacks } from './gemini';
import type { StreamCallbacks, StreamStatus } from './gemini';

type OpenAiPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface OpenAiMsg {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAiPart[];
}

function withRetryable(e: Error, retryable: boolean): Error {
  (e as Error & { retryable?: boolean }).retryable = retryable;
  return e;
}

function isRetryable(e: Error): boolean {
  return (e as Error & { retryable?: boolean }).retryable === true;
}

function sleepSignal(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    const to = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(to);
      resolve(false);
    };
    signal?.addEventListener('abort', onAbort);
  });
}

function buildMessages(systemInstruction: string, history: Message[]): OpenAiMsg[] {
  const msgs: OpenAiMsg[] = [{ role: 'system', content: systemInstruction }];
  for (const m of history) {
    if (!m.text.trim() && !m.attachments?.length) continue;
    const parts: OpenAiPart[] = [];
    if (m.attachments?.length) {
      for (const a of m.attachments) {
        if (a.mimeType.startsWith('image/') && a.data) {
          parts.push({ type: 'image_url', image_url: { url: `data:${a.mimeType};base64,${a.data}` } });
        }
      }
    }
    if (m.text.trim()) parts.push({ type: 'text', text: m.text });
    if (parts.length === 0) continue;
    msgs.push({ role: m.role === 'user' ? 'user' : 'assistant', content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts });
  }
  return msgs;
}

function friendlyOpenAiError(status: number, body: string): Error {
  let msg = '';
  try {
    const j = JSON.parse(body);
    msg = j?.error?.message ?? j?.message ?? '';
  } catch {
    msg = body.slice(0, 300);
  }
  if (/insufficient balance|billing|quota.*(exceed|billing)/i.test(msg)) {
    return new Error(t('err.noBalance'));
  }
  if (/region|geograph|country|not available in your/i.test(msg)) {
    return new Error(t('err.geo'));
  }
  if (status === 401 || status === 402) return new Error(t('err.keyInvalid'));
  if (status === 403) return new Error(t('err.forbidden'));
  if (status === 429) return withRetryable(new Error(t('err.rate')), true);
  if (status >= 500) return withRetryable(new Error(t('err.server', { code: status })), true);
  return new Error(msg || `HTTP ${status}`);
}

interface StreamOptions {
  baseUrl: string;
  chatPath: string;
  apiKey: string;
  model: ModelId;
  systemInstruction: string;
  history: Message[];
  signal?: AbortSignal;
}

export async function streamOpenAiChat(opts: StreamOptions, cb: StreamCallbacks): Promise<void> {
  const url = `${opts.baseUrl.replace(/\/+$/, '')}${opts.chatPath || '/chat/completions'}`;
  const messages = buildMessages(opts.systemInstruction, opts.history);
  if (messages.length < 2) {
    throw new Error(t('err.emptyInput'));
  }
  const body = {
    model: opts.model,
    messages,
    stream: true,
    temperature: 0.7,
  };

  const MAX_ATTEMPTS = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      const delayMs = attempt === 2 ? 1500 : 3000;
      const reason = lastError?.message.includes('429')
        ? t('status.reasonRate')
        : lastError?.message.match(/\(5\d\d\)/)
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
      if (!ok) return;
    }
    cb.onStatus?.({ phase: 'connecting' });
    try {
      await streamOnce(url, body, opts, cb);
      cb.onDone?.();
      return;
    } catch (e) {
      const err = e as Error;
      if (err.name === 'AbortError') return;
      lastError = err;
      if (!isRetryable(err) || attempt >= MAX_ATTEMPTS) throw err;
    }
  }
}

async function streamOnce(url: string, body: Record<string, unknown>, opts: StreamOptions, cb: StreamCallbacks): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    throw withRetryable(new Error(t('err.net')), true);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw friendlyOpenAiError(res.status, txt);
  }
  if (!res.body) throw withRetryable(new Error(t('err.emptyResp')), true);

  cb.onStatus?.({ phase: 'waiting', since: Date.now() });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawAnything = false;

  const handlePayload = (payload: string) => {
    if (!payload || payload === '[DONE]') return;
    let obj: {
      choices?: {
        delta?: {
          content?: string | null;
          reasoning?: string | null;
          reasoning_content?: string | null;
        };
        finish_reason?: string | null;
      }[];
      error?: { message?: string };
    };
    try {
      obj = JSON.parse(payload);
    } catch {
      return;
    }
    // Pollinations/Andere: HTTP 200 mit error-Body
    if (obj.error?.message) {
      cb.onError?.(new Error(obj.error.message));
      return;
    }
    const delta = obj.choices?.[0]?.delta;
    if (delta) {
      if (typeof delta.content === 'string' && delta.content.length > 0) {
        sawAnything = true;
        cb.onStatus?.({ phase: 'receiving' });
        cb.onText?.(delta.content);
      }
      const think = delta.reasoning ?? delta.reasoning_content;
      if (typeof think === 'string' && think.length > 0) {
        sawAnything = true;
        cb.onStatus?.({ phase: 'thinking' });
        cb.onThought?.(think);
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
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) handlePayload(trimmed.slice(5).trim());
    }
  }
  if (buffer.trim().startsWith('data:')) handlePayload(buffer.trim().slice(5).trim());

  if (!sawAnything) throw new Error(t('err.emptyResp'));
}

// ─── Modell-Liste ──────────────────────────────────────────────────────────────

interface RawOpenAiModel {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  pricing?: { prompt?: string; completion?: string };
  paid_only?: boolean;
  tier?: string;
}

export function synthesizeOpenAiModel(id: string, preset: ProviderPreset, free: boolean, title?: string): GeminiModel {
  const short = (title && title.trim()) || id.split('/').pop() || id;
  const cleanShort = short.length > 34 ? short.slice(0, 33) + '…' : short;
  return {
    id,
    label: preset.label,
    badge: free ? 'Free' : 'AI',
    full: free ? `${cleanShort} · ${preset.label}` : `${cleanShort} · ${preset.label}`,
    hint: free ? 'Kostenlos' : '',
    supportsThinkingDisable: false,
    thinkingStyle: 'dynamic',
    source: 'live',
  };
}

export async function fetchOpenAiModels(preset: ProviderPreset, baseUrl: string, apiKey: string): Promise<GeminiModel[]> {
  if (preset.id === 'custom' && !baseUrl) throw new Error('Keine Basis-URL konfiguriert');
  const url = `${baseUrl.replace(/\/+$/, '')}${preset.modelsPath || '/models'}`;
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();
  const out: GeminiModel[] = [];

  if (Array.isArray(raw)) {
    // Pollinations-Legacy-Format: [{name, description, tier, ...}]
    for (const m of raw as RawOpenAiModel[]) {
      if (!m?.name || typeof m.name !== 'string') continue;
      if (/embed|whisper|tts|image|flux|video|audio/i.test(m.name)) continue;
      const free = m.tier === 'anonymous' || m.paid_only === false;
      if (preset.filterFree && !free) continue;
      out.push(synthesizeOpenAiModel(m.name, preset, free, m.description));
    }
  } else if (Array.isArray(raw?.data)) {
    for (const m of raw.data as RawOpenAiModel[]) {
      if (!m?.id || typeof m.id !== 'string') continue;
      if (/embed|whisper|tts|image|dall-e|moderation|guard|vl-|vision-only/i.test(m.id) && preset.id !== 'custom') continue;
      const price = m.pricing?.prompt;
      const free = price === '0' || price === '0.0' || price === '0.00' || /:free$/.test(m.id) || m.paid_only === false;
      if (preset.filterFree && !/:free$/.test(m.id)) continue;
      out.push(synthesizeOpenAiModel(m.id, preset, free, m.name ?? m.title));
    }
  }

  const unique = out.filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
  unique.sort((a, b) => {
    const fa = a.badge === 'Free' ? 0 : 1;
    const fb = b.badge === 'Free' ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return a.id.localeCompare(b.id);
  });
  const capped = unique.slice(0, 40);
  if (capped.length === 0) throw new Error('Keine Modelle gefunden');
  return capped;
}

// ─── Einmalige JSON-Anfrage (Wissensgraph-Extraktion) ─────────────────────────

export async function generateJsonOpenAi<T>(
  baseUrl: string,
  chatPath: string,
  apiKey: string,
  model: ModelId,
  systemInstruction: string,
  userPrompt: string,
): Promise<T | null> {
  const url = `${baseUrl.replace(/\/+$/, '')}${chatPath || '/chat/completions'}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw friendlyOpenAiError(res.status, await res.text().catch(() => ''));
  const j = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  let text = j.choices?.[0]?.message?.content ?? '';
  if (!text) return null;
  // JSON aus Code-Fensten/Prosa lösen
  text = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1) return null;
  const slice = text.slice(first, last + 1);
  try {
    return JSON.parse(slice) as T;
  } catch {
    try {
      return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1')) as T;
    } catch {
      return null;
    }
  }
}

// ─── Key-Test (Settings) ──────────────────────────────────────────────────────

export async function validateOpenAiKey(
  baseUrl: string,
  apiKey: string,
  chatPath?: string,
  model?: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (res.ok) return { ok: true, message: t('settings.keyOk') };
    if (res.status === 401 || res.status === 402) return { ok: false, message: t('settings.keyBad') };
    if (res.status === 403) return { ok: false, message: t('settings.keyForbidden') };
    return { ok: false, message: t('settings.keyHttp', { code: res.status }) };
  } catch {
    // /models nicht abrufbar (z. B. CORS-blockiert wie bei Inception):
    // Key über minimale Chat-Anfrage prüfen — 401/403 = Key-Problem,
    // alles andere (200/4xx-Parameterfehler) = Key akzeptiert.
    if (!chatPath || !model) return { ok: false, message: t('settings.keyNoNet') };
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}${chatPath || '/chat/completions'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 8,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      if (res.status === 401 || res.status === 402) return { ok: false, message: t('settings.keyBad') };
      if (res.status === 403) return { ok: false, message: t('settings.keyForbidden') };
      if (res.ok) return { ok: true, message: t('settings.keyOk') };
      return { ok: false, message: t('settings.keyHttp', { code: res.status }) };
    } catch {
      return { ok: false, message: t('settings.keyNoNet') };
    }
  }
}

export { providerBaseUrl };
