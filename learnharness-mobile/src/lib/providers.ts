// ─── KI-Anbieter ──────────────────────────────────────────────────────────────
// Google Gemini (eigenes Protokoll) + OpenAI-kompatible Anbieter (Chat
// Completions + SSE). Alle Presets getestet am 2026-10-28:
// - text.pollinations.ai: Chat ohne API-Key (anonymous tier) ✓ Streaming ✓
// - openrouter.ai: öffentliche Modellliste ✓, aber API aus Russland blockiert
// - api.deepseek.com / api.mistral.ai / api.vsegpt.ru / router.huggingface.co ✓
// - api.inceptionlabs.ai: /models öffentlich ✓, Chat OpenAI-kompatibel (401
//   ohne Key) ✓ — Mercury 3 (Diffusion-LLM, 1M Kontext), 100 Mio. freie
//   Tokens zum Test; Aktionspreis 0,10/0,35 $ pro 1M Tokens
import type { TargetLang, UiLang } from './i18n';

export type ProviderKind = 'google' | 'openai';

export interface ProviderPreset {
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  /** Pfad zum Chat-Endpoint (Standard: /chat/completions) */
  chatPath: string;
  /** Pfad zur Modellliste (Standard: /models) */
  modelsPath: string;
  /** 'none' = ohne Key nutzbar, 'required' = Pflicht */
  keyMode: 'none' | 'required';
  keyUrl?: string;
  needsBaseUrl?: boolean;
  /** nur ':free'-Modelle anzeigen (OpenRouter) */
  filterFree?: boolean;
  /** Standardmodell bis die Live-Liste geladen ist */
  defaultModel: string;
  /** Statische Fallback-Liste, wenn /models nicht abrufbar ist (z. B. CORS) */
  fallbackModels?: string[];
  badges: ('free' | 'noKey' | 'ruOk' | 'ruBlocked' | 'ruTest' | 'paid')[];
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    kind: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com',
    chatPath: '',
    modelsPath: '',
    keyMode: 'required',
    keyUrl: 'https://aistudio.google.com/apikey',
    defaultModel: 'gemini-3.8-flash',
    badges: ['free'],
  },
  {
    // Inception Mercury 3 — Diffusion-LLM (dLLM), 1000+ Tok/s, 1M Kontext.
    // OpenAI-kompatibel (api.inceptionlabs.ai/v1, geprüft 2026-10-28):
    // /models öffentlich, Chat mit Bearer-Key. Startguthaben 100 Mio. Tokens;
    // danach Aktionspreis 0,10 $ in / 0,35 $ out pro 1M.
    id: 'inception',
    label: 'Mercury 3 (Inception)',
    kind: 'openai',
    baseUrl: 'https://api.inceptionlabs.ai/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    keyMode: 'required',
    keyUrl: 'https://platform.inceptionlabs.ai',
    defaultModel: 'mercury-3',
    // /models ist öffentlich, aber OHNE CORS-Header → Browser-Fetch scheitert.
    // Diese Liste erscheint dann im Modell-Picker (Chat selbst läuft via POST).
    fallbackModels: ['mercury-3', 'mercury-2.5', 'mercury-2', 'mercury-decide'],
    badges: ['free', 'ruTest'],
  },
  {
    id: 'pollinations',
    label: 'Pollinations',
    kind: 'openai',
    baseUrl: 'https://text.pollinations.ai',
    chatPath: '/openai',
    modelsPath: '/models',
    keyMode: 'none',
    defaultModel: 'openai-fast',
    badges: ['free', 'noKey', 'ruOk'],
  },
  {
    id: 'vsegpt',
    label: 'VseGPT',
    kind: 'openai',
    baseUrl: 'https://api.vsegpt.ru/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    keyMode: 'required',
    keyUrl: 'https://vsegpt.ru',
    defaultModel: 'openai/gpt-4o-mini',
    badges: ['paid', 'ruOk'],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    keyMode: 'required',
    keyUrl: 'https://platform.deepseek.com',
    defaultModel: 'deepseek-chat',
    badges: ['paid', 'ruOk'],
  },
  {
    // Xiaomi MiMo — offizielle OpenAI-kompatible API (V2.6-Serie;
    // V2.5 wurde am 21.10.2026 abgeschaltet). Endpunkt geprüft 2026-10-28:
    // /models antwortet sauber im OpenAI-Format (401 bei ungültigem Key).
    id: 'mimo',
    label: 'Xiaomi MiMo',
    kind: 'openai',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    keyMode: 'required',
    keyUrl: 'https://mimo.mi.com',
    defaultModel: 'mimo-v2.6-flash',
    badges: ['paid', 'ruTest'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    keyMode: 'required',
    keyUrl: 'https://openrouter.ai/keys',
    filterFree: true,
    defaultModel: 'deepseek/deepseek-chat-v3.1:free',
    badges: ['free', 'ruBlocked'],
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    keyMode: 'required',
    keyUrl: 'https://console.groq.com/keys',
    defaultModel: 'llama-3.3-70b-versatile',
    badges: ['free', 'ruTest'],
  },
  {
    id: 'mistral',
    label: 'Mistral',
    kind: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    keyMode: 'required',
    keyUrl: 'https://console.mistral.ai',
    defaultModel: 'mistral-small-latest',
    badges: ['free', 'ruTest'],
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    kind: 'openai',
    baseUrl: 'https://router.huggingface.co/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    keyMode: 'required',
    keyUrl: 'https://huggingface.co/settings/tokens',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
    badges: ['free', 'ruTest'],
  },
  {
    id: 'custom',
    label: 'Benutzerdefiniert',
    kind: 'openai',
    baseUrl: '',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    keyMode: 'required',
    needsBaseUrl: true,
    defaultModel: '',
    badges: [],
  },
];

export function getProvider(id: string): ProviderPreset {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

/** Wirksame Basis-URL (Custom erlaubt eigene Endpoints — auch für Tests). */
export function providerBaseUrl(p: ProviderPreset, customBase: string): string {
  if (p.needsBaseUrl) return customBase.trim().replace(/\/+$/, '');
  return p.baseUrl.replace(/\/+$/, '');
}

export type { TargetLang, UiLang };
