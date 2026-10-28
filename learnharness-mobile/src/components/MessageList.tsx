import { useEffect, useMemo, useRef, useState } from 'react';
import type { Message } from '../lib/types';
import type { StreamStatus } from '../lib/gemini';
import type { QuizAnswered } from '../lib/protocol';
import { splitProtocol } from '../lib/protocol';
import { t } from '../lib/i18n';
import { Markdown } from '../lib/markdown';
import { speech } from '../lib/speech';
import { SpeakerIcon, CopyIcon, CheckIcon, ChevronDownIcon } from '../lib/icons';
import { PlanPanel } from './PlanPanel';
import { QuizCard } from './QuizCard';

function UserMessage({ m }: { m: Message }) {
  // Strukturierte Quiz-Antworten als kompakter Chip statt voller Bubble
  if (m.meta === 'quiz-answer') {
    const qa = m.quizAnswered;
    return (
      <div className="msg-row user">
        <div className={`quiz-answer-chip${qa ? (qa.dontKnow ? ' skip' : qa.correct ? ' right' : ' wrong') : ''}`}>
          {qa
            ? qa.dontKnow
              ? t('chat.skipChip')
              : qa.correct
                ? t('chat.sentRight')
                : t('chat.sentWrong')
            : t('chat.sent')}
        </div>
      </div>
    );
  }
  return (
    <div className="msg-row user">
      <div className="bubble-user">
        {m.attachments && m.attachments.length > 0 && (
          <div className="att-strip">
            {m.attachments.map((a) =>
              a.mimeType.startsWith('image/') ? (
                <img key={a.id} src={`data:${a.mimeType};base64,${a.data}`} alt={a.name} />
              ) : (
                <span key={a.id} className="att-file-chip">
                  {a.name}
                </span>
              ),
            )}
          </div>
        )}
        {m.text && <p className="bubble-text">{m.text}</p>}
      </div>
    </div>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="thinking-block">
      <button className="thinking-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="thinking-label">{t('thinking.label')}</span>
        <ChevronDownIcon size={13} className={open ? 'rot' : ''} />
      </button>
      {open && <div className="thinking-body">{text}</div>}
    </div>
  );
}

/**
 * Live-Statuszeile (wie bei ChatGPT/Claude): zeigt während des Wartens,
 * was im Hintergrund passiert — inkl. Sekunden-Zähler und Retry-Countdown.
 */
function StreamStatusLine({ status, providerLabel }: { status: StreamStatus; providerLabel: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 400);
    return () => clearInterval(timer);
  }, []);

  let text = '';
  let isRetry = false;
  if (status.phase === 'connecting') {
    text = t('status.connecting', { provider: providerLabel });
  } else if (status.phase === 'waiting') {
    const s = Math.max(1, Math.round((Date.now() - status.since) / 1000));
    text = t('status.waiting', { s });
  } else if (status.phase === 'thinking') {
    text = t('status.thinking');
  } else if (status.phase === 'receiving') {
    text = t('status.receiving');
  } else if (status.phase === 'retrying') {
    isRetry = true;
    const left = Math.max(1, Math.ceil((status.until - Date.now()) / 1000));
    text = t('status.retry', { reason: status.reason, left, a: status.attempt, m: status.maxAttempts });
  }

  return (
    <div className={`stream-status${isRetry ? ' retry' : ''}`} role="status" aria-live="polite">
      <span className="ss-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="ss-text">{text}</span>
    </div>
  );
}

function AssistantMessage({
  m,
  streaming,
  status,
  providerLabel,
  onQuizAnswer,
}: {
  m: Message;
  streaming: boolean;
  status?: StreamStatus | null;
  providerLabel: string;
  onQuizAnswer: (msgId: string, result: QuizAnswered) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);

  useEffect(() => {
    if (!streaming) setTtsOn(false);
  }, [streaming]);

  const toggleTts = async () => {
    if (ttsOn) {
      await speech.stopSpeaking();
      setTtsOn(false);
      return;
    }
    await speech.speak(m.text, { rate: 1 });
    setTtsOn(true);
    const poll = setInterval(() => {
      if (!speech.isSpeakingNow()) {
        setTtsOn(false);
        clearInterval(poll);
      }
    }, 500);
  };

  // Protokollblöcke (lh-plan / lh-quiz) vom sichtbaren Text trennen
  const { clean, quiz } = useMemo(() => splitProtocol(m.text), [m.text]);

  return (
    <div className="msg-row assistant">
      {m.thinkingText && <ThinkingBlock text={m.thinkingText} />}
      {streaming && !m.text && status && <StreamStatusLine status={status} providerLabel={providerLabel} />}
      {m.error ? (
        <div className="msg-error">
          {m.text}
          <button
            className="msg-error-retry"
            onClick={() => window.dispatchEvent(new CustomEvent('lh-retry'))}
          >
            {t('msg.retry')}
          </button>
        </div>
      ) : (
        <>
          <div className={`assistant-body${streaming ? ' streaming' : ''}`}>
            {clean && <Markdown text={clean} />}
            {quiz && (
              <QuizCard
                quiz={quiz}
                answered={m.quizAnswered}
                streaming={streaming}
                onSubmit={(result) => onQuizAnswer(m.id, result)}
              />
            )}
          </div>
          {!streaming && m.text && (
            <div className="msg-actions">
              <button
                className={`msg-action${ttsOn ? ' active' : ''}`}
                aria-label={t('msg.speak')}
                onClick={toggleTts}
              >
                <SpeakerIcon size={15} />
              </button>
              <button
                className="msg-action"
                aria-label={t('msg.copy')}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(m.text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1400);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
              </button>
              {m.thinkingUsed && <span className="thought-chip">{t('msg.thoughtChip')}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function MessageList({
  messages,
  streamingId,
  streamStatus,
  providerLabel,
  plan,
  onQuizAnswer,
}: {
  messages: Message[];
  streamingId: string | null;
  streamStatus?: StreamStatus | null;
  providerLabel: string;
  plan?: import('../lib/protocol').PlanState | null;
  onQuizAnswer: (msgId: string, result: QuizAnswered) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      stickToBottom.current = nearBottom;
      setShowJump(!nearBottom);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streamingId]);

  return (
    <>
      <div className="msg-list" ref={scrollRef}>
        <div className="msg-list-inner">
          {plan && plan.nodes.length > 0 && <PlanPanel plan={plan} />}
          {messages.map((m) =>
            m.role === 'user' ? (
              <UserMessage key={m.id} m={m} />
            ) : (
              <AssistantMessage
                key={m.id}
                m={m}
                streaming={streamingId === m.id}
                status={streamingId === m.id ? streamStatus : null}
                providerLabel={providerLabel}
                onQuizAnswer={onQuizAnswer}
              />
            ),
          )}
        </div>
      </div>
      {showJump && (
        <button
          className="jump-btn"
          aria-label="↓"
          onClick={() => {
            const el = scrollRef.current;
            if (el) {
              el.scrollTop = el.scrollHeight;
              stickToBottom.current = true;
              setShowJump(false);
            }
          }}
        >
          <ChevronDownIcon size={16} />
        </button>
      )}
    </>
  );
}
