import { getApiBase } from './storage';
import { MODELS, type GeminiModel, type ModelId } from './types';

// ─── Live-Modellkatalog ────────────────────────────────────────────────────────
// Fragt die verfügbaren Chat-Modelle live über ListModels ab (GET /v1beta/models)
// und cacht sie lokal. Damit zeigt die App immer die aktuelle Modell-Generation,
// ohne dass ein App-Update nötig ist.

const CACHE_KEY_PREFIX = 'lh.models.cache.v1';
const TTL_MS = 60 * 60 * 1000; // 1 Stunde
const MAX_MODELS = 14;

function cacheKey(provider = 'gemini'): string {
  return `${CACHE_KEY_PREFIX}.${provider}`;
}

/** Ladestatus des Live-Modellkatalogs */
export type ModelsStatus = 'idle' | 'loading' | 'ok' | 'error';

interface CacheShape {
  fetchedAt: number;
  models: GeminiModel[];
}

// Nicht-Chat- und Spezialmodelle herausfiltern
const EXCLUDE_RE =
  /embedding|tts|image|audio|live|veo|banana|robotics|lyria|transcribe|translate|cyber|omni|computer-use|mariner|aqa|grounding|search|learnlm|gemma/i;

interface RawModel {
  name: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

// ─── Cache ─────────────────────────────────────────────────────────────────────

export function loadCachedModels(provider = 'gemini'): GeminiModel[] {
  try {
    const raw = localStorage.getItem(cacheKey(provider));
    if (!raw) return [];
    const c = JSON.parse(raw) as CacheShape;
    if (!Array.isArray(c.models)) return [];
    return c.models.filter((m) => m && typeof m.id === 'string');
  } catch {
    return [];
  }
}

export function saveCachedModels(models: GeminiModel[], provider = 'gemini'): void {
  try {
    localStorage.setItem(
      cacheKey(provider),
      JSON.stringify({ fetchedAt: Date.now(), models } satisfies CacheShape),
    );
  } catch {
    /* Speicher voll — Cache ist optional */
  }
}

export function isCacheStale(provider = 'gemini'): boolean {
  try {
    const raw = localStorage.getItem(cacheKey(provider));
    if (!raw) return true;
    const c = JSON.parse(raw) as CacheShape;
    return !c.fetchedAt || Date.now() - c.fetchedAt > TTL_MS;
  } catch {
    return true;
  }
}

/** Bundled + Cache zusammenführen (Cache gewinnt bei gleichen IDs). */
export function allKnownModels(): GeminiModel[] {
  const cached = loadCachedModels();
  if (cached.length === 0) return MODELS;
  const byId = new Map<string, GeminiModel>();
  for (const m of MODELS) byId.set(m.id, m);
  for (const m of cached) byId.set(m.id, m);
  // Live-Modelle zuerst (Reihenfolge aus dem Cache = Sortierung), dann gebündelte Reste
  const rest = MODELS.filter((m) => !cached.some((c) => c.id === m.id));
  return [...cached, ...rest];
}

/** Sucht ein Modell in Cache + Bundled — synthetisiert bei Bedarf einen Eintrag. */
export function findModel(id: ModelId): GeminiModel | undefined {
  if (!id) return undefined;
  const known = allKnownModels().find((m) => m.id === id);
  if (known) return known;
  return synthesizeModel(id);
}

// ─── Ableitung von Label / Badge / Hint aus der Modell-ID ──────────────────────

function tierOf(id: string): 'argon' | 'ultra' | 'pro' | 'flash' | 'lite' | 'other' {
  if (/flash-lite/.test(id)) return 'lite';
  if (/flash/.test(id)) return 'flash';
  if (/argon/.test(id)) return 'argon';
  if (/ultra/.test(id)) return 'ultra';
  if (/pro/.test(id)) return 'pro';
  return 'other';
}

function badgeOf(id: string): string {
  const tier = tierOf(id);
  if (tier === 'argon') return 'Argon';
  if (tier === 'ultra') return 'Ultra';
  if (tier === 'pro') return 'Pro';
  if (tier === 'flash') return 'Flash';
  if (tier === 'lite') return 'Lite';
  return 'AI';
}

function versionLabel(id: string): string {
  const m = id.match(/^gemini-(\d+(?:[.-]\d+)?)/);
  return m ? `Gemini ${m[1].replace('-', '.')}` : 'Gemini';
}

function prettyFull(id: string): string {
  const parts: string[] = [];
  const tier = tierOf(id);
  const version = versionLabel(id);
  if (/argon/.test(id)) parts.push('Argon');
  else if (tier === 'ultra') parts.push('Ultra');
  else if (tier === 'pro') parts.push('Pro');
  else if (tier === 'lite') parts.push('Flash-Lite');
  else if (tier === 'flash') parts.push('Flash');
  const m = id.match(/-(\d{3})$/); // -001-Varianten
  if (m) parts.push(m[1]);
  if (/-preview/.test(id)) parts.push('Preview');
  else if (/-exp/.test(id)) parts.push('Exp');
  return `${version}${parts.length ? ' ' + parts.join(' ') : ''}`;
}

function hintOf(id: string): string {
  switch (tierOf(id)) {
    case 'argon':
      return 'Flaggschiff — maximale Denktiefe für schwere Probleme';
    case 'ultra':
    case 'pro':
      return 'Maximale Qualität — für komplexe Aufgaben';
    case 'flash':
      return 'Schnell & vielseitig — beste Allrounder-Wahl';
    case 'lite':
      return 'Äußerst günstig — für schnelle Fragen & Extraktion';
    default:
      return '';
  }
}

function synthesizeModel(id: string): GeminiModel {
  const tier = tierOf(id);
  return {
    id,
    label: versionLabel(id),
    badge: badgeOf(id),
    full: prettyFull(id),
    hint: hintOf(id),
    supportsThinkingDisable: tier !== 'argon' && tier !== 'pro' && tier !== 'ultra',
    thinkingStyle: tier === 'lite' ? 'toggleable' : tier === 'argon' || tier === 'pro' || tier === 'ultra' ? 'alwaysOn' : 'dynamic',
    source: 'live',
  };
}

// ─── Sortierung & Dedupe ───────────────────────────────────────────────────────

/** Reihenfolge-Priorität innerhalb einer Version: Argon > Pro > Flash > Lite */
function tierRank(id: string): number {
  const t = tierOf(id);
  return t === 'argon' ? 5 : t === 'ultra' ? 4 : t === 'pro' ? 4 : t === 'flash' ? 3 : t === 'lite' ? 2 : 1;
}

function versionRank(id: string): number {
  const m = id.match(/^gemini-(\d+)(?:[.-](\d+))?/);
  if (!m) return 0;
  return Number(m[1]) * 100 + Number(m[2] ?? 0);
}

/** Familien-Schlüssel: entfernt Suffixe wie -preview, -exp, -001, -latest, -stable */
function familyOf(id: string): string {
  return id
    .replace(/-(preview|exp)(-.*)?$/, '')
    .replace(/-\d{3}$/, '')
    .replace(/-(latest|stable|default)$/, '');
}

function sortModels(models: GeminiModel[]): GeminiModel[] {
  return [...models].sort((a, b) => {
    const v = versionRank(b.id) - versionRank(a.id);
    if (v !== 0) return v;
    const t = tierRank(b.id) - tierRank(a.id);
    if (t !== 0) return t;
    // stabile Varianten vor Preview
    const ap = /-preview|-exp/.test(a.id) ? 1 : 0;
    const bp = /-preview|-exp/.test(b.id) ? 1 : 0;
    if (ap !== bp) return ap - bp;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Baut die kuratierte Modell-Liste aus der ListModels-Antwort:
 * nur Chat-Modelle, Familien zusammengeführt (stabile Variante gewinnt),
 * neueste Generation zuerst, max. MAX_MODELS Einträge.
 */
function curate(raw: RawModel[]): GeminiModel[] {
  const chat = raw.filter(
    (m) =>
      (m.supportedGenerationMethods ?? []).includes('generateContent') &&
      /^models\/gemini/i.test(m.name) &&
      !EXCLUDE_RE.test(m.name) &&
      !EXCLUDE_RE.test(m.displayName ?? ''),
  );

  const families = new Map<string, RawModel & { id: string }>();
  for (const m of chat) {
    const id = m.name.replace(/^models\//, '');
    const fam = familyOf(id);
    const existing = families.get(fam);
    const isStable = !/-preview|-exp/.test(id);
    if (!existing) {
      families.set(fam, { ...m, id });
    } else {
      const existingStable = !/-preview|-exp/.test(existing.id);
      if (isStable && !existingStable) families.set(fam, { ...m, id });
    }
  }

  const models: GeminiModel[] = [];
  for (const { id, displayName } of families.values()) {
    const synth = synthesizeModel(id);
    if (displayName && displayName.trim()) {
      // API-Anzeigename übernehmen, aber überschaubar halten
      synth.full = displayName.trim();
    }
    models.push(synth);
  }

  return sortModels(models).slice(0, MAX_MODELS);
}

// ─── Live-Abruf ────────────────────────────────────────────────────────────────

export async function fetchAvailableModels(apiKey: string): Promise<GeminiModel[]> {
  const base = getApiBase().replace(/\/+$/, '');
  const res = await fetch(`${base}/v1beta/models?pageSize=200`, {
    headers: { 'x-goog-api-key': apiKey },
  });
  if (!res.ok) {
    throw new Error(
      res.status === 400 || res.status === 401
        ? 'Schlüssel ungültig — Modelle können nicht geladen werden'
        : `Modell-Abruf fehlgeschlagen (HTTP ${res.status})`,
    );
  }
  const j = (await res.json()) as { models?: RawModel[] };
  const models = curate(j.models ?? []);
  if (models.length === 0) throw new Error('Keine kompatiblen Chat-Modelle gefunden');
  saveCachedModels(models);
  return models;
}
