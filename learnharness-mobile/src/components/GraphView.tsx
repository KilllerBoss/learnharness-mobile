import { useEffect, useMemo, useRef, useState } from 'react';
import type { KnowledgeGraph } from '../lib/types';
import { graphStats } from '../lib/graph';
import { t } from '../lib/i18n';
import { XIcon } from '../lib/icons';

interface SimNode {
  id: string;
  name: string;
  mastery: number;
  count: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  props: string[];
  lastSeen: number;
}

/**
 * Canvas-Force-Graph der Konzepte:
 * - Radius = Anzahl Propositionen
 * - Füllung = Beherrschung (rot→gelb→grün skaliert auf Grautöne mit Akzent)
 */
export function GraphView({
  graph,
  onClose,
  onPractice,
}: {
  graph: KnowledgeGraph;
  onClose: () => void;
  onPractice: (concept: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const animRef = useRef(0);
  const selectedRef = useRef<string | null>(null);
  const viewRef = useRef({ ox: 0, oy: 0, scale: 1 });
  const dragRef = useRef<{ mode: 'pan' | 'node' | null; id?: string; sx: number; sy: number }>({
    mode: null,
    sx: 0,
    sy: 0,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const stats = useMemo(() => graphStats(graph), [graph]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Simulation aufsetzen
  useEffect(() => {
    const concepts = Object.values(graph.concepts).sort((a, b) => b.count - a.count);
    const n = concepts.length;
    nodesRef.current = concepts.map((c, i) => {
      const angle = (i / Math.max(1, n)) * Math.PI * 2;
      const r = 60 + 26 * Math.sqrt(n * 0.5);
      return {
        id: c.id,
        name: c.name,
        mastery: c.mastery,
        count: c.count,
        props: c.propositions,
        lastSeen: c.lastSeen,
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      };
    });
    viewRef.current = { ox: 0, oy: 0, scale: Math.min(1.6, Math.max(0.7, 420 / (100 + 40 * Math.sqrt(n)))) };
  }, [graph]);

  // Render-Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = wrap.clientWidth * dpr;
      canvas.height = wrap.clientHeight * dpr;
      canvas.style.width = wrap.clientWidth + 'px';
      canvas.style.height = wrap.clientHeight + 'px';
    };
    resize();
    window.addEventListener('resize', resize);

    const edges = graph.edges;
    const pos = new Map<string, SimNode>();
    const step = () => {
      const nodes = nodesRef.current;
      pos.clear();
      nodes.forEach((nd) => pos.set(nd.id, nd));

      // Kräfte
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        // Abstoßung
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            d2 = 1;
          }
          const d = Math.sqrt(d2);
          const f = (1400 + 40 * (a.count + b.count)) / d2;
          const fx = (dx / d) * f * 0.02;
          const fy = (dy / d) * f * 0.02;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
        // Zentrum
        a.vx -= a.x * 0.0015;
        a.vy -= a.y * 0.0015;
      }
      // Federn
      for (const e of edges) {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const rest = 110;
        const f = (d - rest) * 0.012;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
      // Integration
      for (const nd of nodes) {
        nd.vx *= 0.82;
        nd.vy *= 0.82;
        nd.x += Math.max(-4, Math.min(4, nd.vx));
        nd.y += Math.max(-4, Math.min(4, nd.vy));
      }

      draw(ctx, canvas, nodesRef.current, edges, viewRef.current, dpr, selectedRef.current);
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [graph]);

  const toWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { ox, oy, scale } = viewRef.current;
    return {
      x: (clientX - rect.left - rect.width / 2 - ox) / scale,
      y: (clientY - rect.top - rect.height / 2 - oy) / scale,
    };
  };

  const hitTest = (wx: number, wy: number): SimNode | null => {
    for (const nd of nodesRef.current) {
      const r = nodeRadius(nd.count);
      if ((nd.x - wx) ** 2 + (nd.y - wy) ** 2 < (r + 6) ** 2) return nd;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const w = toWorld(e.clientX, e.clientY);
    const hit = hitTest(w.x, w.y);
    dragRef.current = { mode: hit ? 'node' : 'pan', id: hit?.id, sx: e.clientX, sy: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.mode) return;
    if (d.mode === 'node' && d.id) {
      const w = toWorld(e.clientX, e.clientY);
      const nd = nodesRef.current.find((x) => x.id === d.id);
      if (nd) {
        nd.x = w.x;
        nd.y = w.y;
        nd.vx = 0;
        nd.vy = 0;
      }
    } else {
      const { ox, oy, scale } = viewRef.current;
      viewRef.current = { ox: ox + (e.clientX - d.sx), oy: oy + (e.clientY - d.sy), scale };
      dragRef.current = { ...d, sx: e.clientX, sy: e.clientY };
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
    if (d.mode === 'node' && d.id && moved < 6) {
      setSelected((s) => (s === d.id ? null : (d.id ?? null)));
    }
    if (d.mode === 'pan' && moved > 6 && selected) setSelected(null);
    dragRef.current = { mode: null, sx: 0, sy: 0 };
  };

  const onWheel = (e: React.WheelEvent) => {
    const { ox, oy, scale } = viewRef.current;
    const next = Math.min(3, Math.max(0.4, scale * (e.deltaY < 0 ? 1.08 : 0.93)));
    viewRef.current = { ox, oy, scale: next };
  };

  const selNode = selected ? nodesRef.current.find((n) => n.id === selected) : null;

  return (
    <div className="graph-view" role="dialog" aria-label={t('graph.dialogAria')}>
      <div className="graph-top">
        <div>
          <h2>{t('graph.title')}</h2>
          <p className="graph-sub">
            {t('graph.sub', { n: stats.concepts, m: stats.propositions, p: Math.round(stats.avgMastery * 100) })}
          </p>
        </div>
        <button className="graph-close" aria-label={t('close')} onClick={onClose}>
          <XIcon size={16} />
        </button>
      </div>

      {stats.concepts === 0 ? (
        <div className="graph-empty">
          <p>{t('graph.empty')}</p>
          <p className="graph-empty-hint">{t('graph.emptyHint')}</p>
        </div>
      ) : (
        <div className="graph-canvas-wrap" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          />
          <div className="graph-legend">
            <span>{t('graph.legendSize')}</span>
            <span>{t('graph.legendBright')}</span>
            <span>{t('graph.legendHint')}</span>
          </div>
        </div>
      )}

      {selNode && (
        <div className="node-sheet">
          <div className="node-sheet-head">
            <h3>{selNode.name}</h3>
            <span className="node-mastery">{Math.round(selNode.mastery * 100)} %</span>
          </div>
          <div className="mastery-bar">
            <div style={{ width: `${Math.round(selNode.mastery * 100)}%` }} />
          </div>
          <div className="node-props">
            {selNode.props.length === 0 && <p className="node-props-empty">{t('graph.noProps')}</p>}
            {selNode.props.slice(0, 8).map((p, i) => (
              <div key={i} className="node-prop">
                {p}
              </div>
            ))}
          </div>
          <button
            className="node-practice"
            onClick={() => {
              onPractice(selNode.name);
              onClose();
            }}
          >
            {t('graph.practice', { name: selNode.name })}
          </button>
        </div>
      )}
    </div>
  );
}

function nodeRadius(count: number): number {
  return Math.min(30, 10 + 4.5 * Math.sqrt(Math.max(1, count)));
}

function masteryColor(m: number): string {
  // Grauwert-Skala mit Akzent: niedrig dunkel, hoch fast weiß
  const light = 28 + m * 62; // 28%..90%
  return `hsl(0 0% ${light.toFixed(0)}%)`;
}

function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  nodes: SimNode[],
  edges: { from: string; to: string }[],
  view: { ox: number; oy: number; scale: number },
  dpr: number,
  selectedId: string | null,
) {
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, w, h);

  ctx.translate(w / 2 + view.ox, h / 2 + view.oy);
  ctx.scale(view.scale, view.scale);

  const pos = new Map(nodes.map((n) => [n.id, n]));

  // Kanten
  ctx.lineWidth = 1.1;
  for (const e of edges) {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Knoten
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const n of nodes) {
    const r = nodeRadius(n.count);
    const sel = selectedId === n.id;

    if (sel) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = masteryColor(n.mastery);
    ctx.fill();
    ctx.strokeStyle = 'rgba(13,13,13,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `${sel ? 600 : 400} 10.5px system-ui, -apple-system, Roboto, sans-serif`;
    const label = n.name.length > 22 ? n.name.slice(0, 21) + '…' : n.name;
    ctx.fillText(label, n.x, n.y + r + 11);
  }
  ctx.restore();
}
