// ─── Zentrale Typen ────────────────────────────────────────────────────────────

import type { PlanState, QuizAnswered } from './protocol';

export type Role = 'user' | 'assistant';

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  /** Base64 (ohne data:-Präfix) */
  data: string;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  attachments?: Attachment[];
  /** Denkprozess des Modells (falls Thinking aktiv) */
  thinkingText?: string;
  thinkingUsed?: boolean;
  ts: number;
  error?: boolean;
  model?: string;
  /** Quiz-Antwort (persistiert, damit die Karte nach Neustart gelöst bleibt) */
  quizAnswered?: QuizAnswered;
  /** Kompakte Sonderdarstellung (z. B. strukturierte Quiz-Antwort) */
  meta?: 'quiz-answer';
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  /** Sichtbarer Lernplan der Session (aus lh-plan Blöcken) */
  plan?: PlanState;
}

/** Dynamisch — die Modell-Liste wird live von der Gemini API geladen. */
export type ModelId = string;

/** Wie sich der Denkmodus eines Modells steuern lässt. */
export type ThinkingStyle =
  | 'dynamic'    // an = dynamisch (-1), aus = 0
  | 'toggleable' // an = 8192, aus = 0 (Lite-Klasse)
  | 'alwaysOn';  // kann nicht aus — aus = Minimum 128 (Pro/Argon-Klasse)

export interface GeminiModel {
  id: ModelId;
  /** Label in der Model-Pill */
  label: string;
  /** Badge in der Model-Pill (entspricht "24B" im Design) */
  badge: string;
  /** Vollständiger Name im Dropdown */
  full: string;
  hint: string;
  supportsThinkingDisable: boolean;
  /** Steuert das thinkingBudget-Mapping (Standard: dynamic) */
  thinkingStyle?: ThinkingStyle;
  /** Herkunft: mitgeliefert oder live geladen */
  source?: 'bundled' | 'live';
}

/**
 * Fallback-Liste (Stand Okt 2026) — wird benutzt, solange kein API-Key
 * vorhanden ist oder der Live-Abruf fehlschlägt. Die App fragt die
 * tatsächlichen Modelle sonst live über ListModels ab und ist damit
 * nie wieder veraltet.
 */
export const MODELS: GeminiModel[] = [
  {
    id: 'gemini-4-argon',
    label: 'Gemini 4',
    badge: 'Argon',
    full: 'Gemini 4 Argon',
    hint: 'Flaggschiff — maximale Denktiefe für schwere Probleme',
    supportsThinkingDisable: false,
    thinkingStyle: 'alwaysOn',
    source: 'bundled',
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8',
    badge: 'Flash',
    full: 'Gemini 3.8 Flash',
    hint: 'Schnell & vielseitig — beste Allrounder-Wahl',
    supportsThinkingDisable: true,
    thinkingStyle: 'dynamic',
    source: 'bundled',
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5',
    badge: 'Lite',
    full: 'Gemini 3.5 Flash-Lite',
    hint: 'Äußerst günstig — für schnelle Fragen & Extraktion',
    supportsThinkingDisable: true,
    thinkingStyle: 'toggleable',
    source: 'bundled',
  },
];

/** Migration alter 2.5-Auswahlen auf die aktuelle Generation. */
export const MIGRATE_MODEL: Record<string, ModelId> = {
  'gemini-2.5-pro': 'gemini-4-argon',
  'gemini-2.5-flash': 'gemini-3.8-flash',
  'gemini-2.5-flash-lite': 'gemini-3.5-flash-lite',
};

export type UiLangSetting = 'de' | 'ru' | 'en';
/** Lernziel — Chinesisch (zh) in v1.5.0 auf Wunsch entfernt. */
export type TargetLangSetting = 'de' | 'en' | 'ru';

export interface Settings {
  apiKey: string;
  model: ModelId;
  thinkingDefault: boolean;
  ttsEnabled: boolean;
  ttsRate: number;
  graphExtraction: boolean;
  /** KI-Anbieter (Preset-ID aus providers.ts) */
  provider: string;
  /** API-Schlüssel für OpenAI-kompatible Anbieter */
  openaiKey: string;
  /** Eigene Basis-URL (nur Provider 'custom') */
  customBase: string;
  /** Oberflächensprache */
  uiLang: UiLangSetting;
  /** Muttersprache (Erklärungen/Übersetzungen) */
  nativeLang: UiLangSetting;
  /** Zielsprache (was gelernt wird) */
  targetLang: TargetLangSetting;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'gemini-3.8-flash',
  thinkingDefault: true,
  ttsEnabled: false,
  ttsRate: 1.0,
  graphExtraction: true,
  provider: 'gemini',
  openaiKey: '',
  customBase: '',
  /** Fallback, wenn keine Gerätesprache erkannt wird: Russisch (Anforderung 10/2026).
   *  Beim ersten Start überschreibt detectUiLang() diese Werte passend zum Gerät
   *  (ru-Gerät → ru, de-Gerät → de) — siehe storage.loadSettings(). */
  uiLang: 'ru',
  nativeLang: 'ru',
  /** Die Frau des Nutzers lernt Deutsch → Lernziel „Deutsch“ als Werkszustand. */
  targetLang: 'de',
};

// ─── Wissensgraph ──────────────────────────────────────────────────────────────

export interface Concept {
  id: string;
  name: string;
  mastery: number; // 0..1
  count: number;
  lastSeen: number;
  propositions: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface KnowledgeGraph {
  concepts: Record<string, Concept>;
  edges: GraphEdge[];
  updatedAt: number;
}

export const EMPTY_GRAPH: KnowledgeGraph = { concepts: {}, edges: [], updatedAt: 0 };

export interface GraphExtraction {
  concepts: { name: string; mastery: number }[];
  propositions: { concept: string; text: string }[];
  edges: { from: string; to: string }[];
}
