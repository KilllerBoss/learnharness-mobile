import { useRef } from 'react';
import type { Chat } from '../lib/types';
import { APP_VERSION } from '../lib/version';
import { t } from '../lib/i18n';
import { BrandIcon, GearIcon, GraphIcon, NoteIcon, PlusIcon, TrashIcon, XIcon } from '../lib/icons';

export function Drawer({
  open,
  chats,
  activeId,
  onClose,
  onNewChat,
  onSelect,
  onDelete,
  onOpenGraph,
  onImportNotes,
  onOpenSettings,
}: {
  open: boolean;
  chats: Chat[];
  activeId: string | null;
  onClose: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenGraph: () => void;
  onImportNotes: (files: FileList) => void;
  onOpenSettings: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className={`drawer-scrim${open ? ' show' : ''}`} onClick={onClose} />
      <aside className={`drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <div className="drawer-brand">
            <BrandIcon size={20} />
            <span>LearnHarness</span>
          </div>
          <button className="drawer-close" aria-label={t('close')} onClick={onClose}>
            <XIcon size={16} />
          </button>
        </div>

        <button
          className="drawer-new"
          onClick={() => {
            onNewChat();
            onClose();
          }}
        >
          <PlusIcon size={16} /> {t('drawer.newSession')}
        </button>

        <div className="drawer-section">{t('drawer.history')}</div>
        <div className="drawer-chats">
          {chats.length === 0 && <div className="drawer-empty">{t('drawer.noSessions')}</div>}
          {chats.map((c) => (
            <div
              key={c.id}
              className={`drawer-chat${c.id === activeId ? ' active' : ''}`}
              onClick={() => {
                onSelect(c.id);
                onClose();
              }}
            >
              <div className="drawer-chat-main">
                <span className="drawer-chat-title">{c.title || t('drawer.newTitle')}</span>
                <span className="drawer-chat-meta">
                  {c.messages.filter((m) => m.role === 'user').length} {t('drawer.msgShort')} ·{' '}
                  {new Date(c.updatedAt).toLocaleDateString(undefined, {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </div>
              <button
                className="drawer-chat-del"
                aria-label={t('drawer.delete')}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
              >
                <TrashIcon size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="drawer-section">{t('drawer.tools')}</div>
        <div className="drawer-tools">
          <button
            onClick={() => {
              onOpenGraph();
              onClose();
            }}
          >
            <GraphIcon size={17} /> {t('drawer.graph')}
          </button>
          <button onClick={() => fileRef.current?.click()}>
            <NoteIcon size={17} /> {t('drawer.importNotes')}
          </button>
          <button
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
          >
            <GearIcon size={17} /> {t('drawer.settings')}
          </button>
        </div>

        <div className="drawer-foot">LearnHarness Mobile · v{APP_VERSION}</div>

        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) onImportNotes(e.target.files);
            e.target.value = '';
            onClose();
          }}
        />
      </aside>
    </>
  );
}
