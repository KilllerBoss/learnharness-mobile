// ─── LearnHarness-Protokoll: sichtbarer Plan + Quiz-Karten ────────────────────
//
// Mobile Adaption der Desktop-Mechanik (amosblomqvist/learnharness):
// - Der Tutor gibt einen formalen Lernplan aus (lh-plan Block) — wie das
//   plan_init-Tool des Desktops (Abhängigkeitsbaum mit Knoten/Kanten).
// - Quiz-Fragen kommen als lh-quiz Block — wie das quiz-Tool; die App
//   gradet CLIENT-SEITIG und schickt das Ergebnis + Sicherheit (Slider)
//   als strukturierte Nachricht zurück (Desktop: addToolOutput).
// Blöcke sind JSON in Code-Fenzen: robust beim Streaming, kein
// Function-Calling nötig, persisted automatisch im Nachrichtentext.

import { t } from './i18n';

export interface PlanNode {
  id: string;
  title: string;
  summary?: string;
}

export interface PlanEdge {
  from: string;
  to: string;
}

/** Voller Plan-Zustand einer Session (persisted in Chat.plan). */
export interface PlanState {
  nodes: PlanNode[];
  edges: PlanEdge[];
  done: string[];
  current: string | null;
  version: number;
}

/** Inkrementeller Plan-Block des Tutors. */
export interface PlanPatch {
  nodes?: PlanNode[];
  edges?: PlanEdge[];
  done?: string[];
  current?: string | null;
}

export interface QuizOption {
  label: string;
}

export interface QuizInput {
  question: string;
  options: QuizOption[];
  /** 0-basierte Indizes der richtigen Option(en). */
  correct: number[];
  multiSelect?: boolean;
  explanation?: string;
  /** predict = vor dem Lehren (offen), check = danach (hinter Reveal). */
  type?: 'predict' | 'check';
  /** Plan-Knoten, um den es geht (Positions-Signal). */
  node?: string;
}

/** Antwort der Lernenden — persisted auf der Nachricht. */
export interface QuizAnswered {
  choice: string[];
  dontKnow: boolean;
  confidence: number; // 0-100, roher Sliderwert
  correct: boolean;
  thinking?: string;
}

// ─── Parsing ───────────────────────────────────────────────────────────────────

const BLOCK_RE = /```lh-(plan|quiz)\s*\n([\s\S]*?)```/g;
const OPEN_FENCE_RE = /```lh-(?:plan|quiz)\s*\n[\s\S]*$/;

/** Minimal-Reparatur für häufige Modell-Schnitzer (trailing commas). */
function lenientJsonParse(raw: string): unknown | undefined {
  const attempts = [raw, raw.replace(/,\s*([}\]])/g, '$1')];
  for (const a of attempts) {
    try {
      return JSON.parse(a);
    } catch {
      /* next */
    }
  }
  return undefined;
}

export interface SplitResult {
  /** Text ohne Protokollblöcke — das ist alles, was gerendert wird. */
  clean: string;
  plan?: PlanPatch;
  quiz?: QuizInput;
  /** Streaming: Block noch nicht geschlossen → verdeckt halten. */
  pendingBlock: boolean;
}

/**
 * Trennt Protokollblöcke vom sichtbaren Text. Robust fürs Streaming:
 * Ein noch offener lh-Block wird komplett verdeckt, bis er schließt.
 */
export function splitProtocol(text: string): SplitResult {
  const out: SplitResult = { clean: text, pendingBlock: false };
  if (!text.includes('```lh-')) {
    out.clean = text;
    return out;
  }

  let plan: PlanPatch | undefined;
  let quiz: QuizInput | undefined;
  let pending = false;

  const stripped = text.replace(BLOCK_RE, (_m, kind: string, body: string) => {
    const data = lenientJsonParse(body.trim());
    if (data && typeof data === 'object') {
      if (kind === 'plan') plan = data as PlanPatch;
      else quiz = data as QuizInput;
    }
    return '';
  });

  const open = stripped.match(OPEN_FENCE_RE);
  if (open) {
    pending = true;
    out.clean = stripped.slice(0, open.index ?? stripped.length);
  } else {
    out.clean = stripped;
  }

  out.clean = out.clean.replace(/\n{3,}/g, '\n\n').trim();
  out.pendingBlock = pending;
  if (plan) out.plan = plan;
  if (quiz) out.quiz = quiz;
  return out;
}

// ─── Plan-Merge ────────────────────────────────────────────────────────────────

export function emptyPlan(): PlanState {
  return { nodes: [], edges: [], done: [], current: null, version: 0 };
}

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids.map((s) => s.trim()).filter(Boolean))];
}

/**
 * Fügt einen Plan-Block in den Session-Plan ein. Erster Block mit
 * nodes = Autor (Plan erstellt/neu geschrieben), Updates ohne nodes
 * ändern nur Fortschritt (done/current).
 */
export function mergePlan(prev: PlanState | null, patch: PlanPatch): PlanState {
  const base: PlanState = prev
    ? { nodes: prev.nodes, edges: prev.edges, done: dedupeIds(prev.done), current: prev.current, version: prev.version }
    : emptyPlan();

  let changed = false;

  if (Array.isArray(patch.nodes) && patch.nodes.length > 0) {
    const nodes = patch.nodes
      .filter((n) => n && typeof n.id === 'string' && typeof n.title === 'string' && n.id.trim() && n.title.trim())
      .map((n) => ({
        id: n.id.trim(),
        title: n.title.trim().slice(0, 80),
        summary: typeof n.summary === 'string' ? n.summary.trim().slice(0, 300) : undefined,
      }));
    if (nodes.length > 0) {
      base.nodes = nodes.slice(0, 16);
      const nodeIds = new Set(base.nodes.map((n) => n.id));
      base.edges = (Array.isArray(patch.edges) ? patch.edges : [])
        .filter((e) => e && nodeIds.has(e.from?.trim()) && nodeIds.has(e.to?.trim()) && e.from.trim() !== e.to.trim())
        .map((e) => ({ from: e.from.trim(), to: e.to.trim() }))
        .slice(0, 40);
      // Neuer Plan → Fortschritt auf bekannte Knoten begrenzen
      base.done = dedupeIds(base.done).filter((d) => nodeIds.has(d));
      if (base.current && !nodeIds.has(base.current)) base.current = null;
      changed = true;
    }
  } else {
    if (Array.isArray(patch.edges)) {
      const nodeIds = new Set(base.nodes.map((n) => n.id));
      const edges = patch.edges
        .filter((e) => e && nodeIds.has(e.from?.trim()) && nodeIds.has(e.to?.trim()) && e.from.trim() !== e.to.trim())
        .map((e) => ({ from: e.from.trim(), to: e.to.trim() }))
        .slice(0, 40);
      if (JSON.stringify(edges) !== JSON.stringify(base.edges)) {
        base.edges = edges;
        changed = true;
      }
    }
  }

  if (Array.isArray(patch.done)) {
    const done = dedupeIds(patch.done);
    if (JSON.stringify(done) !== JSON.stringify(base.done)) {
      base.done = done;
      changed = true;
    }
  }
  if (patch.current !== undefined) {
    const cur = typeof patch.current === 'string' && patch.current.trim() ? patch.current.trim() : null;
    if (cur !== base.current) {
      base.current = cur;
      changed = true;
    }
  }

  if (changed) base.version += 1;
  return base;
}

/** Plan-Status eines Knotens für die UI (wie deriveNodeStatus im Desktop). */
export type PlanNodeStatus = 'current' | 'visited' | 'upcoming';

export function planNodeStatus(plan: PlanState, nodeId: string): PlanNodeStatus {
  if (plan.current === nodeId) return 'current';
  if (plan.done.includes(nodeId)) return 'visited';
  return 'upcoming';
}

// ─── Quiz-Auswertung ───────────────────────────────────────────────────────────

/** Client-seitiges Grading (wie question-core im Desktop). */
export function gradeQuiz(quiz: QuizInput, selected: number[], dontKnow: boolean): boolean {
  if (dontKnow) return false;
  const correct = [...new Set(quiz.correct ?? [])].sort();
  const sel = [...new Set(selected)].sort();
  if (correct.length === 0) return true; // autorisierte Frage ohne korrekte Angabe
  return correct.length === sel.length && correct.every((v, i) => v === sel[i]);
}

/**
 * Antwort serialisieren — geht als Nutzer-Nachricht an den Tutor
 * (Desktop-Äquivalent: addToolOutput mit dem Verdict).
 */
export function serializeQuizAnswer(
  question: string,
  answer: QuizAnswered,
  correctLabels: string[],
): string {
  const chosen = answer.dontKnow
    ? t('qa.dontKnow')
    : answer.choice.map((l) => `„${l}“`).join(', ') || '—';
  const correctPart = correctLabels.map((l) => `„${l}“`).join(', ');
  const parts = [
    `[${t('qa.answer')}] ${t('qa.question')}: ${question.slice(0, 200)}`,
    `${t('qa.chosen')}: ${chosen}`,
    answer.dontKnow
      ? `${t('qa.result')}: ${t('quiz.skipped')}`
      : `${t('qa.result')}: ${answer.correct ? t('qa.correct') : t('qa.wrong') + (correctPart ? ' ' + t('qa.correctWas', { labels: correctPart }) : '')}`,
    `${t('qa.confidence')}: ${answer.confidence} %`,
  ];
  if (answer.thinking) parts.push(`${t('qa.thought')}: ${answer.thinking.slice(0, 500)}`);
  return parts.join(' | ');
}

/** Confidence-Slider: Snap-Stops wie im Desktop (owner 2026-10-01). */
export const CONFIDENCE_STOPS: readonly number[] = [0, 30, 50, 70, 90, 100];
export const DEFAULT_CONFIDENCE_INDEX = 2; // 50 = echter Münzwurf

export function confidenceLabel(v: number): string {
  if (v <= 0) return t('conf.rate');
  if (v < 50) return t('conf.unsure');
  if (v === 50) return t('conf.coin');
  if (v < 90) return t('conf.quite');
  if (v < 100) return t('conf.very');
  return t('conf.full');
}
