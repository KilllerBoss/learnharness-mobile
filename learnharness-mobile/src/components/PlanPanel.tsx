import { useState } from 'react';
import type { PlanState } from '../lib/protocol';
import { planNodeStatus } from '../lib/protocol';
import { t } from '../lib/i18n';
import { ChevronDownIcon } from '../lib/icons';

/**
 * Sichtbarer Lernplan (wie das Plan-Panel im Desktop-LearnHarness):
 * Klebende Karte über dem Chat mit Fortschritts-Chips.
 * done = abgehakt, current = pulsierend, sonst offen.
 */
export function PlanPanel({ plan }: { plan: PlanState | null | undefined }) {
  const [open, setOpen] = useState(false);
  if (!plan || plan.nodes.length === 0) return null;

  const doneCount = plan.nodes.filter((n) => planNodeStatus(plan, n.id) === 'visited').length;
  const total = plan.nodes.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className={`plan-panel${open ? ' open' : ''}`}>
      <button className="plan-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="plan-label">
          {t('plan.label')}
          <span className="plan-count">
            {doneCount}/{total}
          </span>
        </span>
        <span className="plan-progress" aria-hidden="true">
          <span className="plan-progress-fill" style={{ width: `${pct}%` }} />
        </span>
        <ChevronDownIcon size={14} className={open ? 'rot' : ''} />
      </button>
      <div className="plan-chips">
        {plan.nodes.map((n) => {
          const st = planNodeStatus(plan, n.id);
          return (
            <span key={n.id} className={`plan-chip ${st}`} title={n.summary || n.title}>
              {st === 'visited' && <i className="pc-check">✓</i>}
              {st === 'current' && <i className="pc-dot" />}
              {st === 'upcoming' && <i className="pc-ring" />}
              {n.title}
            </span>
          );
        })}
      </div>
      {open && (
        <div className="plan-details">
          {plan.nodes.map((n) => {
            const st = planNodeStatus(plan, n.id);
            return (
              <div key={n.id} className={`plan-detail ${st}`}>
                <div className="pd-title">
                  <span className="pd-state">{st === 'visited' ? '✓' : st === 'current' ? '●' : '○'}</span>
                  {n.title}
                </div>
                {n.summary && <div className="pd-summary">{n.summary}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
