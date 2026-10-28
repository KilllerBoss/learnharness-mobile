import type { GraphExtraction, KnowledgeGraph, Message } from './types';
import { splitProtocol } from './protocol';

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.3;
  return Math.min(1, Math.max(0, n));
}

/** Fügt Extraktionsergebnisse in den persistenten Wissensgraph ein. */
export function mergeExtraction(graph: KnowledgeGraph, ext: GraphExtraction, now: number): KnowledgeGraph {
  const next: KnowledgeGraph = {
    concepts: { ...graph.concepts },
    edges: [...graph.edges],
    updatedAt: now,
  };

  for (const c of ext.concepts ?? []) {
    if (!c?.name) continue;
    const id = normalizeName(c.name);
    if (!id) continue;
    const existing = next.concepts[id];
    if (existing) {
      // Beherrschung gleiten (EMA): Neues zählt 40 %
      existing.mastery = clamp01(existing.mastery * 0.6 + clamp01(c.mastery) * 0.4);
      existing.count += 1;
      existing.lastSeen = now;
    } else {
      next.concepts[id] = {
        id,
        name: c.name.trim().slice(0, 60),
        mastery: clamp01(c.mastery),
        count: 1,
        lastSeen: now,
        propositions: [],
      };
    }
  }

  for (const p of ext.propositions ?? []) {
    if (!p?.text || !p?.concept) continue;
    const id = normalizeName(p.concept);
    const concept = next.concepts[id];
    if (!concept) continue;
    const text = p.text.trim().slice(0, 300);
    if (!concept.propositions.includes(text) && concept.propositions.length < 40) {
      concept.propositions.push(text);
    }
  }

  for (const e of ext.edges ?? []) {
    if (!e?.from || !e?.to) continue;
    const from = normalizeName(e.from);
    const to = normalizeName(e.to);
    if (!from || !to || from === to) continue;
    if (!next.concepts[from] || !next.concepts[to]) continue;
    if (!next.edges.some((x) => x.from === from && x.to === to)) {
      next.edges.push({ from, to });
    }
  }

  // Max. 120 Konzepte behalten (LRU nach lastSeen)
  const all = Object.values(next.concepts);
  if (all.length > 120) {
    const keep = all.sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 120);
    const keepIds = new Set(keep.map((c) => c.id));
    next.concepts = Object.fromEntries(keep.map((c) => [c.id, c]));
    next.edges = next.edges.filter((e) => keepIds.has(e.from) && keepIds.has(e.to));
  }

  return next;
}

export function transcriptForExtraction(messages: Message[], maxChars = 6000): string {
  const recent = messages.filter((m) => !m.error).slice(-10);
  let out = '';
  for (const m of recent) {
    const role = m.role === 'user' ? 'LERNENDE' : 'TUTOR';
    // Protokollblöcke (lh-plan/lh-quiz) raus — der Quiz-Inhalt bleibt
    // als Frage im Text erhalten, nur das JSON-Gehäuse fliegt.
    const { clean } = splitProtocol(m.text);
    const text = (clean || m.text).slice(0, 1200);
    out += `${role}: ${text}\n\n`;
  }
  return out.slice(-maxChars);
}

/** Statistik für die Graph-Ansicht. */
export function graphStats(graph: KnowledgeGraph): { concepts: number; propositions: number; edges: number; avgMastery: number } {
  const list = Object.values(graph.concepts);
  const props = list.reduce((acc, c) => acc + c.propositions.length, 0);
  const avg = list.length ? list.reduce((a, c) => a + c.mastery, 0) / list.length : 0;
  return { concepts: list.length, propositions: props, edges: graph.edges.length, avgMastery: avg };
}
