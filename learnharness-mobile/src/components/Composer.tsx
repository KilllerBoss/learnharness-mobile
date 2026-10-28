import { useEffect, useRef, useState } from 'react';
import type { Attachment, GeminiModel, ModelId } from '../lib/types';
import type { ModelsStatus } from '../lib/models';
import { t } from '../lib/i18n';
import { speech } from '../lib/speech';
import { uid } from '../lib/storage';
import {
  ArrowUpIcon,
  BulbIcon,
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  CubeIcon,
  ImageIcon,
  MicIcon,
  NoteIcon,
  PlusIcon,
  RefreshIcon,
  StopIcon,
  XIcon,
} from '../lib/icons';

/** Bild auf max. 1568px Kante skalieren und als JPEG-Base64 zurückgeben. */
async function fileToAttachment(file: File, maxEdge = 1568): Promise<Attachment> {
  if (file.type.startsWith('image/')) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
      i.src = dataUrl;
    });
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas nicht verfügbar');
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL('image/jpeg', 0.85);
    return {
      id: uid(),
      name: file.name || 'foto.jpg',
      mimeType: 'image/jpeg',
      data: out.split(',')[1] ?? '',
    };
  }
  // Text-Notizen (.txt/.md)
  const text = await file.text();
  return { id: uid(), name: file.name || 'notiz.txt', mimeType: 'text/plain', data: '' + '' , textNote: text } as Attachment & { textNote: string };
}

export interface ComposerProps {
  thinking: boolean;
  /** Denkmodus nur bei Google (Thinking-Budget) sichtbar */
  thinkingSupported: boolean;
  onToggleThinking: () => void;
  model: ModelId;
  onSelectModel: (m: ModelId) => void;
  /** Aktuell bekannte Modelle (live geladen oder gebündelter Fallback) */
  models: GeminiModel[];
  modelsStatus: ModelsStatus;
  onRefreshModels: (force?: boolean) => void;
  streaming: boolean;
  hasKey: boolean;
  /** Fallback-Label in der Model-Pill (z. B. Anbietername) */
  providerLabel: string;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  onNeedKey: () => void;
}

export function Composer({
  thinking,
  thinkingSupported,
  onToggleThinking,
  model,
  onSelectModel,
  models,
  modelsStatus,
  onRefreshModels,
  streaming,
  hasKey,
  providerLabel,
  onSend,
  onStop,
  onNeedKey,
}: ComposerProps) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [modelMenu, setModelMenu] = useState(false);
  const [plusMenu, setPlusMenu] = useState(false);
  const [listening, setListening] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const dictBaseRef = useRef('');
  const fileImgRef = useRef<HTMLInputElement>(null);
  const fileCamRef = useRef<HTMLInputElement>(null);
  const fileNoteRef = useRef<HTMLInputElement>(null);

  const currentModel = models.find((m) => m.id === model) ?? models[0];
  const canSend = (text.trim().length > 0 || attachments.length > 0) && !streaming;

  // Auto-Grow der Textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = Math.min(ta.scrollHeight, 132) + 'px';
  }, [text]);

  // Dictation
  useEffect(() => {
    return () => {
      if (listening) speech.stopDictation().catch(() => undefined);
    };
  }, [listening]);

  const toggleDictation = async () => {
    if (listening) {
      await speech.stopDictation();
      setListening(false);
      return;
    }
    setListening(true);
    dictBaseRef.current = text;
    try {
      const ok = await speech.startDictation({
        partial: (partial) => setText((dictBaseRef.current ? dictBaseRef.current + ' ' : '') + partial),
        result: (result) => {
          dictBaseRef.current = (dictBaseRef.current ? dictBaseRef.current + ' ' : '') + result;
          setText(dictBaseRef.current);
        },
        end: () => setListening(false),
      });
      if (!ok) {
        setListening(false);
        window.dispatchEvent(new CustomEvent('lh-toast', { detail: t('composer.micNa') }));
      }
    } catch {
      setListening(false);
      window.dispatchEvent(new CustomEvent('lh-toast', { detail: t('composer.micErr') }));
    }
  };

  const submit = () => {
    if (streaming) {
      onStop();
      return;
    }
    if (!canSend) return;
    if (!hasKey) {
      onNeedKey();
      return;
    }
    let toSend = text.trim();
    let atts = attachments;
    // Text-Notizen als Text anhängen
    for (const a of atts) {
      const note = (a as Attachment & { textNote?: string }).textNote;
      if (note) toSend += (toSend ? '\n\n' : '') + `--- Notiz: ${a.name} ---\n${note}`;
    }
    atts = atts.filter((a) => a.mimeType.startsWith('image/'));
    onSend(toSend, atts);
    setText('');
    setAttachments([]);
    setModelMenu(false);
    setPlusMenu(false);
  };

  return (
    <footer className="composer-zone">
      {/* Anhänge-Vorschau */}
      {attachments.length > 0 && (
        <div className="composer-atts">
          {attachments.map((a) => (
            <div key={a.id} className="att-chip">
              {a.mimeType.startsWith('image/') ? (
                <img src={`data:${a.mimeType};base64,${a.data}`} alt={a.name} />
              ) : (
                <span className="att-note-name">{a.name}</span>
              )}
              <button
                aria-label={t('composer.removeAtt')}
                onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
              >
                <XIcon size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={`composer${listening ? ' listening' : ''}`}>
        <textarea
          ref={taRef}
          className="composer-input"
          placeholder={listening ? t('composer.listening') : t('composer.placeholder')}
          rows={1}
          value={text}
          enterKeyHint="send"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="composer-toolbar">
          {/* Linke Gruppe */}
          <div className="toolbar-group">
            <button
              className="round-btn"
              aria-label={t('composer.attach')}
              onClick={() => {
                setPlusMenu((v) => !v);
                setModelMenu(false);
              }}
            >
              <PlusIcon size={18} />
            </button>
            <button
              className={`round-btn${listening ? ' mic-active' : ''}`}
              aria-label={listening ? t('composer.micStop') : t('composer.mic')}
              onClick={toggleDictation}
            >
              <MicIcon size={18} />
            </button>
          </div>

          {/* Rechte Gruppe */}
          <div className="toolbar-group">
            {thinkingSupported && (
              <button
                className={`icon-btn bulb${thinking ? ' on' : ''}`}
                aria-label={thinking ? t('composer.bulbOn') : t('composer.bulbOff')}
                onClick={onToggleThinking}
              >
                <BulbIcon size={18} filled={thinking} />
              </button>
            )}
            <div className="model-selector-wrap">
              <button
                className="model-pill"
                aria-label={t('composer.modelSelect')}
                onClick={() => {
                  setModelMenu((v) => {
                    if (!v) onRefreshModels(); // beim Öffnen ggf. frische Modell-Liste laden
                    return !v;
                  });
                  setPlusMenu(false);
                }}
              >
                <CubeIcon size={14} />
                <span className="model-label">{currentModel?.label ?? providerLabel}</span>
                <span className="model-badge">{currentModel?.badge ?? 'AI'}</span>
                <ChevronDownIcon size={12} className="pill-chevron" />
              </button>
              {modelMenu && (
                <div className="model-menu" role="menu">
                  <div className="model-menu-head">
                    <span>{t('composer.model')}</span>
                    <button
                      className={`mm-refresh${modelsStatus === 'loading' ? ' spin' : ''}`}
                      aria-label={t('composer.refresh')}
                      onClick={() => onRefreshModels(true)}
                      disabled={modelsStatus === 'loading'}
                    >
                      <RefreshIcon size={13} />
                    </button>
                  </div>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      className={`model-menu-item${m.id === model ? ' sel' : ''}`}
                      onClick={() => {
                        onSelectModel(m.id);
                        setModelMenu(false);
                      }}
                    >
                      <div className="mm-main">
                        <span className="mm-name">{m.full}</span>
                        {m.hint && <span className="mm-hint">{m.hint}</span>}
                      </div>
                      {m.id === model && <CheckIcon size={15} />}
                    </button>
                  ))}
                  {modelsStatus === 'loading' && (
                    <div className="mm-state">{t('composer.loadingModels')}</div>
                  )}
                  {modelsStatus === 'error' && (
                    <div className="mm-state error">{t('composer.modelsError')}</div>
                  )}
                </div>
              )}
            </div>
            <button
              className={`send-btn${canSend || streaming ? '' : ' disabled'}`}
              aria-label={streaming ? t('composer.stop') : t('composer.send')}
              onClick={submit}
            >
              {streaming ? <StopIcon size={16} /> : <ArrowUpIcon size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* +-Menü */}
      {plusMenu && (
        <div className="plus-menu">
          <button
            onClick={() => {
              setPlusMenu(false);
              fileCamRef.current?.click();
            }}
          >
            <CameraIcon size={17} /> {t('composer.photo')}
          </button>
          <button
            onClick={() => {
              setPlusMenu(false);
              fileImgRef.current?.click();
            }}
          >
            <ImageIcon size={17} /> {t('composer.image')}
          </button>
          <button
            onClick={() => {
              setPlusMenu(false);
              fileNoteRef.current?.click();
            }}
          >
            <NoteIcon size={17} /> {t('composer.note')}
          </button>
        </div>
      )}

      {/* Versteckte File-Inputs */}
      <input
        ref={fileCamRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          handleFiles(e.target.files, setAttachments);
          e.target.value = '';
        }}
      />
      <input
        ref={fileImgRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files, setAttachments);
          e.target.value = '';
        }}
      />
      <input
        ref={fileNoteRef}
        type="file"
        accept=".txt,.md,text/plain,text/markdown"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files, setAttachments);
          e.target.value = '';
        }}
      />
    </footer>
  );
}

function handleFiles(
  files: FileList | null,
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>,
) {
  if (!files) return;
  Array.from(files)
    .slice(0, 4)
    .forEach((f) => {
      if (f.size > 12 * 1024 * 1024) {
        window.dispatchEvent(new CustomEvent('lh-toast', { detail: t('composer.tooBig', { name: f.name }) }));
        return;
      }
      fileToAttachment(f)
        .then((att) => setAttachments((prev) => [...prev, att]))
        .catch((err) =>
          window.dispatchEvent(new CustomEvent('lh-toast', { detail: String((err as Error).message) })),
        );
    });
}
