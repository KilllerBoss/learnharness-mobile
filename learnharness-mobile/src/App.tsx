import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopBar } from './components/TopBar';
import { EmptyState } from './components/EmptyState';
import { MessageList } from './components/MessageList';
import { Composer } from './components/Composer';
import { Drawer } from './components/Drawer';
import { GraphView } from './components/GraphView';
import { SettingsSheet } from './components/SettingsSheet';
import { generateJson, streamChat, type StreamStatus } from './lib/gemini';
import {
  generateJsonOpenAi,
  streamOpenAiChat,
  fetchOpenAiModels,
  synthesizeOpenAiModel,
} from './lib/openai';
import { getProvider, providerBaseUrl } from './lib/providers';
import {
  fetchAvailableModels,
  isCacheStale,
  loadCachedModels,
  type ModelsStatus,
} from './lib/models';
import {
  tutorSystemPrompt,
  extractionSystem,
  EXTRACTION_SCHEMA,
  buildExtractionRequest,
  type TutorLangs,
} from './lib/tutor';
import { mergeExtraction, transcriptForExtraction } from './lib/graph';
import { splitProtocol, mergePlan, serializeQuizAnswer, type QuizAnswered } from './lib/protocol';
import { setUiLang, t } from './lib/i18n';
import { speech } from './lib/speech';
import {
  clearAllData,
  loadActiveChatId,
  loadChats,
  loadGraph,
  loadSettings,
  saveActiveChatId,
  saveChats,
  saveGraph,
  saveSettings,
  uid,
} from './lib/storage';
import type {
  Attachment,
  Chat,
  GeminiModel,
  GraphExtraction,
  KnowledgeGraph,
  Message,
  ModelId,
  Settings,
} from './lib/types';
import { MIGRATE_MODEL, MODELS as MODELS_FALLBACK } from './lib/types';

type Overlay = 'none' | 'graph' | 'settings';

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [chats, setChats] = useState<Chat[]>(loadChats);
  const [activeId, setActiveId] = useState<string | null>(loadActiveChatId);
  const [graph, setGraph] = useState<KnowledgeGraph>(loadGraph);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [thinking, setThinking] = useState(settings.thinkingDefault);
  const [toast, setToast] = useState<string | null>(null);
  const [liveModels, setLiveModels] = useState<GeminiModel[]>(() => loadCachedModels(settings.provider));
  const [modelsStatus, setModelsStatus] = useState<ModelsStatus>('idle');
  const abortRef = useRef<AbortController | null>(null);

  // i18n: Modul-Sprache synchron zur Einstellung (vor dem Rendern der Kinder)
  setUiLang(settings.uiLang);

  const provider = useMemo(() => getProvider(settings.provider), [settings.provider]);
  const providerBase = useMemo(
    () => providerBaseUrl(provider, settings.customBase),
    [provider, settings.customBase],
  );
  const isGoogle = provider.kind === 'google';

  const activeChat = useMemo(() => chats.find((c) => c.id === activeId) ?? null, [chats, activeId]);
  const hasKey = isGoogle
    ? settings.apiKey.trim().length > 8
    : provider.keyMode === 'none' || settings.openaiKey.trim().length > 4;
  const models = useMemo(
    () =>
      liveModels.length > 0
        ? liveModels
        : isGoogle
          ? MODELS_FALLBACK
          // Live-Abruf fehlgeschlagen (z. B. CORS): statische Provider-Liste zeigen
          : (provider.fallbackModels ?? []).map((id) => synthesizeOpenAiModel(id, provider, false)),
    [liveModels, isGoogle, provider],
  );

  // ── Persistenz ──
  useEffect(() => saveChats(chats), [chats]);
  useEffect(() => saveActiveChatId(activeId), [activeId]);
  useEffect(() => saveGraph(graph), [graph]);
  useEffect(() => saveSettings(settings), [settings]);

  // <html lang> an App-Sprache anpassen (Screenreader, iOS-Tastatur etc.)
  useEffect(() => {
    document.documentElement.lang = settings.uiLang;
  }, [settings.uiLang]);

  // Diktat- & Vorlese-Sprache an App-Sprache koppeln
  useEffect(() => {
    speech.setUiLang(settings.uiLang);
  }, [settings.uiLang]);

  // ── Toast ──
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const h = (e: Event) => {
      setToast((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 3200);
    };
    window.addEventListener('lh-toast', h);
    return () => {
      window.removeEventListener('lh-toast', h);
      clearTimeout(timer);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    window.dispatchEvent(new CustomEvent('lh-toast', { detail: msg }));
  }, []);

  // ── Live-Modellkatalog (provider-abhängig) ──
  const refreshModels = useCallback(
    async (force = false) => {
      const prov = getProvider(settings.provider);
      const key = prov.kind === 'google' ? settings.apiKey.trim() : settings.openaiKey.trim();
      if (prov.keyMode === 'required' && !key && !(prov.needsBaseUrl && settings.customBase.trim())) return;
      if (!force && !isCacheStale(prov.id) && liveModels.length > 0) return;
      setModelsStatus((s) => (s === 'loading' ? s : 'loading'));
      try {
        const list =
          prov.kind === 'google'
            ? await fetchAvailableModels(key)
            : await fetchOpenAiModels(prov, providerBaseUrl(prov, settings.customBase), key);
        setLiveModels(list);
        setModelsStatus('ok');
        // Gewähltes Modell nicht verfügbar? → automatisch migrieren
        setSettings((s) => {
          const curProv = getProvider(s.provider);
          if (curProv.id !== prov.id) return s;
          if (list.some((m) => m.id === s.model)) return s;
          const mig = prov.kind === 'google' ? MIGRATE_MODEL[s.model] : undefined;
          const target = mig && list.some((m) => m.id === mig) ? mig : list[0]?.id;
          if (!target || target === s.model) return s;
          const name = list.find((m) => m.id === target)?.full ?? target;
          window.dispatchEvent(
            new CustomEvent('lh-toast', { detail: t('toast.migrated', { name }) }),
          );
          return { ...s, model: target };
        });
      } catch {
        setModelsStatus('error');
      }
    },
    [settings.provider, settings.apiKey, settings.openaiKey, settings.customBase, liveModels.length],
  );

  // Beim Start: alte 2.5-Auswahl migrieren + einmal frische Modelle laden
  useEffect(() => {
    setSettings((s) => {
      const mig = MIGRATE_MODEL[s.model];
      return mig && s.provider === 'gemini' ? { ...s, model: mig } : s;
    });
    void refreshModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Anbieter-/Key-Wechsel: Modell-Cache nachladen
  useEffect(() => {
    setLiveModels(loadCachedModels(settings.provider));
    setModelsStatus('idle');
    void refreshModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.provider]);

  const updateChat = useCallback((id: string, fn: (c: Chat) => Chat) => {
    setChats((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
  }, []);

  // ── Wissensgraph-Extraktion (im Hintergrund, nach jeder Assistant-Antwort) ──
  const graphRef = useRef(graph);
  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  // Stale-Closure-Schutz: send() behält eine alte runTurn-Referenz, solange
  // sich activeId nicht ändert — Settings/Thinking müssen daher IMMER frisch
  // aus Refs gelesen werden (Bug: Key-Eintrag + sofortiges Senden im selben
  // Setup-Flow lieferte keyOk=false → stummer Abbruch, Settings öffnete sich).
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const thinkingRef = useRef(thinking);
  useEffect(() => {
    thinkingRef.current = thinking;
  }, [thinking]);

  const langsRef = useRef<TutorLangs>({
    uiLang: settings.uiLang,
    nativeLang: settings.nativeLang,
    targetLang: settings.targetLang,
  });
  useEffect(() => {
    langsRef.current = {
      uiLang: settings.uiLang,
      nativeLang: settings.nativeLang,
      targetLang: settings.targetLang,
    };
  }, [settings.uiLang, settings.nativeLang, settings.targetLang]);

  const runExtraction = useCallback(
    async (messages: Message[]) => {
      const s = settingsRef.current;
      const p = getProvider(s.provider);
      const exKey = p.kind === 'google' ? s.apiKey.trim() : s.openaiKey.trim();
      if (!s.graphExtraction || exKey.length < 5) return;
      const transcript = transcriptForExtraction(messages);
      if (transcript.trim().length < 40) return;
      const prov = p;
      const key = exKey;
      const providerBaseEx = providerBaseUrl(prov, s.customBase);
      const sys = extractionSystem(langsRef.current);
      const req = buildExtractionRequest(transcript);
      const tryOnce = async (): Promise<GraphExtraction | null> => {
        if (prov.kind === 'google') {
          // Günstiges Modell für die Extraktion: bevorzugt Flash-Lite-Klasse
          const exModel =
            models.find((m) => m.id.includes('flash-lite'))?.id ??
            models.find((m) => m.id.includes('flash'))?.id ??
            s.model;
          const first = await generateJson<GraphExtraction>(
            key, exModel, sys, req,
            EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
          );
          if (first && (first.concepts?.length || first.propositions?.length)) return first;
          // Fallback: gewähltes Modell
          return generateJson<GraphExtraction>(
            key, s.model, sys, req,
            EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
          );
        }
        return generateJsonOpenAi<GraphExtraction>(
          providerBaseEx, prov.chatPath, key, s.model, sys, req,
        );
      };
      try {
        const ext = await tryOnce();
        if (ext && (ext.concepts?.length || ext.propositions?.length)) {
          const before = Object.keys(graphRef.current.concepts).length;
          const merged = mergeExtraction(graphRef.current, ext, Date.now());
          graphRef.current = merged;
          setGraph(merged);
          const added = Object.keys(merged.concepts).length - before;
          if (added > 0) {
            showToast(
              t('toast.concepts', { n: added, p: added === 1 ? '' : 'e' }),
            );
          }
        }
      } catch {
        /* still — Extraction ist optional */
      }
    },
    [hasKey, models, showToast],
  );

  // ── Senden ──
  const send = useCallback(
    async (
      text: string,
      attachments: Attachment[],
      retryChatId?: string,
      meta?: 'quiz-answer',
      quizAnswered?: QuizAnswered,
    ) => {
      let chatId = retryChatId ?? activeId;
      const userMsg: Message = {
        id: uid(),
        role: 'user',
        text,
        attachments: attachments.length ? attachments : undefined,
        ts: Date.now(),
        meta,
        quizAnswered,
      };

      // WICHTIG: Die Nachrichtenliste wird SYNCHRON bestimmt und an runTurn
      // übergeben. setState ist async — der alte Code las hier ein leeres
      // contents-Array an die API gehen ("contents is not specified").
      let baseMessages: Message[];
      if (!chatId) {
        const c: Chat = {
          id: uid(),
          title: text.slice(0, 42) || t('drawer.newTitle'),
          messages: [userMsg],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        chatId = c.id;
        baseMessages = [userMsg];
        setChats((prev) => [c, ...prev]);
        setActiveId(c.id);
      } else {
        const existing = chatsRef.current.find((ch) => ch.id === chatId);
        baseMessages = [...(existing?.messages ?? []), userMsg];
        updateChat(chatId, (c) => ({
          ...c,
          title: c.messages.length === 0 ? text.slice(0, 42) || c.title : c.title,
          messages: [...c.messages, userMsg],
          updatedAt: Date.now(),
        }));
      }

      await runTurn(chatId, baseMessages);
    },
    [activeId, updateChat],
  );

  const runTurn = useCallback(
    async (chatId: string, baseMessages?: Message[]) => {
      // Settings/Thinking IMMER frisch aus Refs lesen (stale-closure-sicher)
      const s = settingsRef.current;
      const prov = getProvider(s.provider);
      const key = prov.kind === 'google' ? s.apiKey.trim() : s.openaiKey.trim();
      const base = providerBaseUrl(prov, s.customBase);
      const keyOk = prov.kind === 'google'
        ? key.length > 8
        : prov.keyMode === 'none' || key.length > 4;
      if (!keyOk || (prov.needsBaseUrl && !base)) {
        setOverlay('settings');
        return;
      }
      const thinkingOn = thinkingRef.current;
      const assistantId = uid();
      const placeholder: Message = {
        id: assistantId,
        role: 'assistant',
        text: '',
        ts: Date.now(),
        model: s.model,
        thinkingUsed: prov.kind === 'google' && thinkingOn,
      };
      updateChat(chatId, (c) => ({
        ...c,
        messages: [...c.messages, placeholder],
        updatedAt: Date.now(),
      }));
      setStreamingId(assistantId);

      const ac = new AbortController();
      abortRef.current = ac;
      let acc = '';
      let thoughtAcc = '';

      const flush = (text: string, thought: string) => {
        updateChat(chatId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantId
              ? { ...m, text, thinkingText: thought || undefined }
              : m,
          ),
        }));
        // Sichtbarer Lernplan: lh-plan Blöcke live in chat.plan mergen
        const sp = splitProtocol(text);
        if (sp.plan) {
          const patch = sp.plan;
          setChats((prev) =>
            prev.map((c) => (c.id === chatId ? { ...c, plan: mergePlan(c.plan ?? null, patch) } : c)),
          );
        }
      };

      let lastFlush = 0;
      const throttledFlush = () => {
        const now = Date.now();
        if (now - lastFlush > 90) {
          lastFlush = now;
          flush(acc, thoughtAcc);
        }
      };

      try {
        // baseMessages kommt synchron von send()/Retry — kein stale-ref-Race.
        const chat = chatsRef.current.find((c) => c.id === chatId);
        const source = baseMessages ?? chat?.messages ?? [];
        const history = source.filter(
          (m) => m.id !== assistantId && !m.error && (m.text.trim() || m.attachments?.length),
        );
        const systemInstruction = tutorSystemPrompt(
          graphRef.current,
          prov.kind === 'google' ? thinkingOn : false,
          chatsRef.current.find((c) => c.id === chatId)?.plan ?? null,
          langsRef.current,
        );
        const callbacks = {
          onText: (d: string) => {
            acc += d;
            throttledFlush();
          },
          onThought: (d: string) => {
            thoughtAcc += d;
            throttledFlush();
          },
          onStatus: (s: StreamStatus) => setStreamStatus(s),
        };
        if (prov.kind === 'google') {
          await streamChat(
            {
              apiKey: key,
              model: s.model,
              systemInstruction,
              history,
              thinking: thinkingOn,
              signal: ac.signal,
            },
            callbacks,
          );
        } else {
          await streamOpenAiChat(
            {
              baseUrl: base,
              chatPath: prov.chatPath,
              apiKey: key,
              model: s.model,
              systemInstruction,
              history,
              signal: ac.signal,
            },
            callbacks,
          );
        }
        flush(acc, thoughtAcc);
        setStreamStatus(null);
        // Auto-Vorlesen
        if (s.ttsEnabled && acc) {
          speech.speak(acc, { rate: s.ttsRate }).catch(() => undefined);
        }
        // Wissensgraph im Hintergrund pflegen — mit EXPLIZITEN Nachrichten
        const finalAssistant: Message = {
          id: assistantId,
          role: 'assistant',
          text: acc,
          ts: Date.now(),
        };
        void runExtraction([...source, finalAssistant]);
      } catch (e) {
        const msg = (e as Error).message || t('err.unknown');
        setStreamStatus(null);
        updateChat(chatId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantId
              ? { ...m, text: acc || msg, error: !acc, thinkingText: thoughtAcc || undefined }
              : m,
          ),
        }));
        showToast(msg);
      } finally {
        setStreamingId(null);
        setStreamStatus(null);
        abortRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateChat, runExtraction, showToast],
  );

  // chatsRef: immer aktueller Stand für async closures
  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  // Quiz-Antwort aus der Karte: Ergebnis persistieren + strukturiert senden
  const handleQuizAnswer = useCallback(
    (msgId: string, result: QuizAnswered) => {
      const chatId = activeId;
      if (!chatId) return;
      const chat = chatsRef.current.find((c) => c.id === chatId);
      const msg = chat?.messages.find((m) => m.id === msgId);
      if (!chat || !msg || msg.quizAnswered) return; // Doppel-Senden-Schutz
      const sp = splitProtocol(msg.text);
      if (!sp.quiz) return;
      const correctLabels = (sp.quiz.correct ?? [])
        .map((i) => sp.quiz?.options[i]?.label ?? '')
        .filter(Boolean);
      const text = serializeQuizAnswer(sp.quiz.question, result, correctLabels);
      updateChat(chatId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === msgId ? { ...m, quizAnswered: result } : m,
        ),
      }));
      void send(text, [], chatId, 'quiz-answer', result);
    },
    [activeId, send, updateChat],
  );

  // Retry-Event aus Fehlermeldungen
  useEffect(() => {
    const h = () => {
      const chat = chatsRef.current.find((c) => c.id === activeId);
      if (!chat) return;
      // Fehlermeldung entfernen und Turn neu starten
      const cleaned = chat.messages.filter((m) => !(m.error && m.role === 'assistant'));
      setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, messages: cleaned } : c)));
      setTimeout(() => void runTurn(chat.id, cleaned), 60);
    };
    window.addEventListener('lh-retry', h);
    return () => window.removeEventListener('lh-retry', h);
  }, [activeId, runTurn]);

  // ── Chat-Verwaltung ──
  const newChat = useCallback(() => {
    const c: Chat = {
      id: uid(),
      title: t('drawer.newTitle'),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setChats((prev) => [c, ...prev]);
    setActiveId(c.id);
  }, []);

  const deleteChat = useCallback(
    (id: string) => {
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    },
    [activeId],
  );

  const importNotes = useCallback(
    (files: FileList) => {
      let pending = files.length;
      const texts: string[] = [];
      Array.from(files).forEach((f) => {
        f.text()
          .then((txt) => {
            texts.push(`--- ${f.name} ---\n${txt.slice(0, 12000)}`);
          })
          .catch(() => undefined)
          .finally(() => {
            pending -= 1;
            if (pending === 0) {
              const combined = texts.join('\n\n');
              void send(`${t('notes.importPrompt')}\n\n${combined}`, []);
            }
          });
      });
    },
    [send],
  );

  const practice = useCallback(
    (concept: string) => {
      void send(t('practice.prompt', { c: concept }), []);
    },
    [send],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setStreamingId(null);
  }, []);

  const graphCount = Object.keys(graph.concepts).length;

  return (
    <div className="app" role="application">
      <TopBar onMenu={() => setDrawerOpen(true)} />

      <main className="stage">
        {!activeChat || activeChat.messages.length === 0 ? (
          <EmptyState
            hasKey={hasKey}
            graphCount={graphCount}
            onSetupKey={() => setOverlay('settings')}
          />
        ) : (
          <MessageList
            messages={activeChat.messages}
            streamingId={streamingId}
            streamStatus={streamingId !== null ? streamStatus : null}
            providerLabel={provider.label}
            plan={activeChat.plan ?? null}
            onQuizAnswer={handleQuizAnswer}
          />
        )}
      </main>

      <Composer
        thinking={thinking}
        thinkingSupported={isGoogle}
        onToggleThinking={() => setThinking((prev) => !prev)}
        model={settings.model}
        onSelectModel={(m: ModelId) => setSettings((s) => ({ ...s, model: m }))}
        models={models}
        modelsStatus={modelsStatus}
        onRefreshModels={refreshModels}
        streaming={streamingId !== null}
        hasKey={hasKey}
        providerLabel={provider.label}
        onSend={(text, atts) => void send(text, atts)}
        onStop={stopStreaming}
        onNeedKey={() => setOverlay('settings')}
      />

      <Drawer
        open={drawerOpen}
        chats={chats}
        activeId={activeId}
        onClose={() => setDrawerOpen(false)}
        onNewChat={newChat}
        onSelect={setActiveId}
        onDelete={deleteChat}
        onOpenGraph={() => setOverlay('graph')}
        onImportNotes={importNotes}
        onOpenSettings={() => setOverlay('settings')}
      />

      {overlay === 'graph' && (
        <GraphView graph={graph} onClose={() => setOverlay('none')} onPractice={practice} />
      )}

      <SettingsSheet
        open={overlay === 'settings'}
        settings={settings}
        onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
        onClose={() => setOverlay('none')}
        onRefreshModels={refreshModels}
        onClearData={() => {
          clearAllData();
          setSettings(loadSettings());
          setChats([]);
          setActiveId(null);
          setGraph(loadGraph());
          setThinking(loadSettings().thinkingDefault);
          setLiveModels([]);
          showToast(t('toast.deleted'));
        }}
        graphCount={graphCount}
        models={models}
        modelsStatus={modelsStatus}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
