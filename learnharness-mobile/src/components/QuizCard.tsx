import { useMemo, useState } from 'react';
import type { QuizAnswered, QuizInput } from '../lib/protocol';
import {
  CONFIDENCE_STOPS,
  DEFAULT_CONFIDENCE_INDEX,
  confidenceLabel,
  gradeQuiz,
} from '../lib/protocol';
import { t } from '../lib/i18n';

/**
 * Interaktive Quiz-Karte — mobile Adaption der QuestionDock des
 * Desktop-LearnHarness: Optionen wählen, "Ich weiß nicht",
 * Laut-denken-Feld und der Confidence-Slider (Snap-Stops 0/30/50/70/90/100,
 * Standard 50 = echter Münzwurf).
 */
export function QuizCard({
  quiz,
  answered,
  streaming,
  onSubmit,
}: {
  quiz: QuizInput;
  answered?: QuizAnswered;
  streaming: boolean;
  onSubmit: (result: QuizAnswered) => void;
}) {
  // check-Fragen bleiben hinter dem Reveal, bis die Person antippt
  // (predict-Fragen kommen offen — sie gehen dem Unterricht voraus).
  const needsReveal = quiz.type !== 'predict' && !answered;
  const [revealed, setRevealed] = useState(!needsReveal);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dontKnow, setDontKnow] = useState(false);
  const [confIdx, setConfIdx] = useState(DEFAULT_CONFIDENCE_INDEX);
  const [thinking, setThinking] = useState('');
  const [showThinking, setShowThinking] = useState(false);

  const multi = quiz.multiSelect === true || (quiz.correct?.length ?? 0) > 1;
  const disabled = streaming || !!answered;
  const badge = quiz.type === 'predict' ? t('quiz.predict') : t('quiz.quiz');

  const submittedCorrect = useMemo(
    () => (answered && !answered.dontKnow ? answered.correct : answered?.dontKnow ? false : null),
    [answered],
  );

  const toggle = (i: number) => {
    if (disabled) return;
    setDontKnow(false);
    setSelected((s) => {
      const n = new Set(s);
      if (multi) {
        if (n.has(i)) n.delete(i);
        else n.add(i);
      } else {
        n.clear();
        n.add(i);
      }
      return n;
    });
  };

  const canSubmit = !disabled && (dontKnow || selected.size > 0);

  const submit = () => {
    if (!canSubmit) return;
    const sel = [...selected];
    const correct = gradeQuiz(quiz, sel, dontKnow);
    onSubmit({
      choice: dontKnow ? [] : sel.map((i) => quiz.options[i]?.label ?? `#${i}`),
      dontKnow,
      confidence: dontKnow ? 0 : CONFIDENCE_STOPS[confIdx],
      correct,
      thinking: thinking.trim() || undefined,
    });
  };

  // ── gelöste Darstellung ──
  if (answered) {
    return (
      <div className={`quiz-card answered${submittedCorrect ? ' right' : ' wrong'}`}>
        <div className="quiz-head">
          <span className="quiz-badge">{badge}</span>
          <span className={`quiz-verdict ${submittedCorrect ? 'right' : 'wrong'}`}>
            {answered.dontKnow ? t('quiz.skipped') : submittedCorrect ? t('quiz.right') : t('quiz.wrong')}
          </span>
        </div>
        <p className="quiz-question">{quiz.question}</p>
        <div className="quiz-options">
          {quiz.options.map((o, i) => {
            const isCorrect = (quiz.correct ?? []).includes(i);
            const wasChosen = answered.choice.includes(o.label);
            return (
              <div
                key={i}
                className={`quiz-option static${isCorrect ? ' correct' : ''}${wasChosen && !isCorrect ? ' wrong' : ''}`}
              >
                {o.label}
                {isCorrect && <span className="qo-flag">{t('quiz.correctFlag')}</span>}
                {wasChosen && !isCorrect && <span className="qo-flag neg">{t('quiz.yourChoice')}</span>}
              </div>
            );
          })}
        </div>
        {quiz.explanation && <div className="quiz-explain">{quiz.explanation}</div>}
        <div className="quiz-meta">
          <span>{t('conf.label', { v: answered.dontKnow ? '—' : `${answered.confidence} %` })}</span>
          {answered.thinking && <span className="quiz-think-chip">„{answered.thinking}“</span>}
        </div>
      </div>
    );
  }

  if (!revealed) {
    return (
      <div className="quiz-card collapsed">
        <div className="quiz-head">
          <span className="quiz-badge">{badge}</span>
        </div>
        <button className="quiz-reveal-btn" onClick={() => setRevealed(true)}>
          {t('quiz.reveal')}
        </button>
      </div>
    );
  }

  // ── offene Karte ──
  return (
    <div className="quiz-card">
      <div className="quiz-head">
        <span className="quiz-badge">{badge}</span>
        {multi && <span className="quiz-multi">{t('quiz.multi')}</span>}
      </div>
      <p className="quiz-question">{quiz.question}</p>
      <div className="quiz-options" role="listbox" aria-label={t('quiz.options')}>
        {quiz.options.map((o, i) => {
          const sel = selected.has(i);
          return (
            <button
              key={i}
              className={`quiz-option${sel ? ' selected' : ''}`}
              onClick={() => toggle(i)}
              disabled={disabled}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <button className={`quiz-dontknow${dontKnow ? ' active' : ''}`} onClick={() => {
        if (disabled) return;
        setDontKnow((d) => !d);
        setSelected(new Set());
      }}>
        {t('quiz.dontKnow')}
      </button>

      {!dontKnow && (
        <div className="conf-block">
          <div className="conf-head">
            <span>{t('quiz.confidence')}</span>
            <span className="conf-value">
              {t('conf.label', { v: `${CONFIDENCE_STOPS[confIdx]} %` })} · {confidenceLabel(CONFIDENCE_STOPS[confIdx])}
            </span>
          </div>
          <input
            className="conf-slider"
            type="range"
            min={0}
            max={CONFIDENCE_STOPS.length - 1}
            step={1}
            value={confIdx}
            disabled={disabled}
            aria-label={t('quiz.confidenceAria')}
            onChange={(e) => setConfIdx(Number(e.target.value))}
          />
          <div className="conf-stops" aria-hidden="true">
            {CONFIDENCE_STOPS.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>
      )}

      <div className="quiz-think">
        <button className="quiz-think-toggle" onClick={() => setShowThinking((s) => !s)}>
          {showThinking ? t('quiz.thinkHide') : t('quiz.thinkToggle')}
        </button>
        {showThinking && (
          <textarea
            className="quiz-think-input"
            placeholder={t('quiz.thinkPlaceholder')}
            value={thinking}
            rows={2}
            onChange={(e) => setThinking(e.target.value)}
          />
        )}
      </div>

      <button className="quiz-send" onClick={submit} disabled={!canSubmit}>
        {t('quiz.send')}
      </button>
    </div>
  );
}
