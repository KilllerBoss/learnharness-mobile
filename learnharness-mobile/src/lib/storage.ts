import {
  DEFAULT_SETTINGS,
  EMPTY_GRAPH,
  type Chat,
  type KnowledgeGraph,
  type Settings,
  type TargetLangSetting,
} from './types';
import { detectUiLang } from './i18n';

const KEYS = {
  settings: 'lh.settings.v1',
  chats: 'lh.chats.v1',
  graph: 'lh.graph.v1',
  activeChat: 'lh.activeChat.v1',
  /** Überschreibt die Gemini-Basis-URL — nur für Tests */
  apiBase: 'lh.apiBase.v1',
  /** true, sobald die Person eine Sprache bewusst in den Einstellungen gewählt hat */
  langTouched: 'lh.uiLangTouched.v1',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage write failed', e);
  }
}

// ─── Settings ──────────────────────────────────────────────────────────────────

const VALID_TARGET: TargetLangSetting[] = ['de', 'en', 'ru'];

/** Bewusste Sprachwahl merken — danach wird die Gerätesprache nie mehr überschrieben. */
export function markLangTouched(): void {
  try {
    localStorage.setItem(KEYS.langTouched, 'true');
  } catch {
    /* ignore */
  }
}

export function loadSettings(): Settings {
  const s = read<Partial<Settings>>(KEYS.settings, {});
  const base = { ...DEFAULT_SETTINGS, ...s };
  // Alte Installationen könnten noch 'zh' (Chinesisch, v1.4.0) gespeichert haben
  if (!VALID_TARGET.includes(base.targetLang)) base.targetLang = 'de';
  // Migration v1.5.0: Solange NIE bewusst eine Sprache gewählt wurde, gilt die
  // Gerätesprache (ru-Gerät → Russisch, de-Gerät → Deutsch, sonst Russisch).
  // Betrifft auch Bestandsinstallationen, die nur die alten Defaults gespeichert
  // haben — so bekommt die Nutzerin automatisch die russische Oberfläche.
  if (!read<boolean>(KEYS.langTouched, false)) {
    const det = detectUiLang();
    base.uiLang = det;
    base.nativeLang = det;
  }
  return base;
}

export function saveSettings(s: Settings): void {
  write(KEYS.settings, s);
}

// ─── Chats ─────────────────────────────────────────────────────────────────────

export function loadChats(): Chat[] {
  return read<Chat[]>(KEYS.chats, []);
}

export function saveChats(chats: Chat[]): void {
  write(KEYS.chats, chats.slice(0, 100));
}

export function loadActiveChatId(): string | null {
  return read<string | null>(KEYS.activeChat, null);
}

export function saveActiveChatId(id: string | null): void {
  write(KEYS.activeChat, id);
}

// ─── Wissensgraph ──────────────────────────────────────────────────────────────

export function loadGraph(): KnowledgeGraph {
  return { ...EMPTY_GRAPH, ...read<KnowledgeGraph>(KEYS.graph, EMPTY_GRAPH) };
}

export function saveGraph(g: KnowledgeGraph): void {
  write(KEYS.graph, g);
}

// ─── Sonstiges ─────────────────────────────────────────────────────────────────

export function getApiBase(): string {
  return read<string>(KEYS.apiBase, 'https://generativelanguage.googleapis.com');
}

export function setApiBaseOverride(url: string | null): void {
  if (url) write(KEYS.apiBase, url);
  else localStorage.removeItem(KEYS.apiBase);
}

export function clearAllData(): void {
  Object.values(KEYS).forEach((k) => {
    if (k !== KEYS.apiBase) localStorage.removeItem(k);
  });
}

export function exportAll(): string {
  return JSON.stringify(
    {
      app: 'LearnHarness Mobile',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { ...loadSettings(), apiKey: '' },
      chats: loadChats(),
      graph: loadGraph(),
    },
    null,
    2,
  );
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
