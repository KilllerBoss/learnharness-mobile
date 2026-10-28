import { useState } from 'react';
import type { Settings, GeminiModel, UiLangSetting, TargetLangSetting } from '../lib/types';
import type { ModelsStatus } from '../lib/models';
import { APP_VERSION } from '../lib/version';
import { t, LANG_LABELS } from '../lib/i18n';
import { PROVIDERS, getProvider, providerBaseUrl } from '../lib/providers';
import { validateKey } from '../lib/gemini';
import { validateOpenAiKey } from '../lib/openai';
import { exportAll, markLangTouched } from '../lib/storage';
import { CheckIcon, KeyIcon, XIcon } from '../lib/icons';

const BADGE_KEYS: Record<string, string> = {
  free: 'badge.free',
  noKey: 'badge.noKey',
  ruOk: 'badge.ruOk',
  ruBlocked: 'badge.ruBlocked',
  ruTest: 'badge.ruTest',
  paid: 'badge.paid',
};

export function SettingsSheet({
  open,
  settings,
  onChange,
  onClose,
  onClearData,
  onRefreshModels,
  graphCount,
  models,
  modelsStatus,
}: {
  open: boolean;
  settings: Settings;
  onChange: (s: Partial<Settings>) => void;
  onClose: () => void;
  onClearData: () => void;
  onRefreshModels: (force?: boolean) => void;
  graphCount: number;
  models: GeminiModel[];
  modelsStatus: ModelsStatus;
}) {
  const [showKey, setShowKey] = useState(false);
  const [keyTest, setKeyTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  if (!open) return null;

  const preset = getProvider(settings.provider);
  const base = providerBaseUrl(preset, settings.customBase);
  const isGoogle = preset.kind === 'google';
  const activeKey = isGoogle ? settings.apiKey.trim() : settings.openaiKey.trim();

  const testKey = async () => {
    setTesting(true);
    setKeyTest(null);
    const r = isGoogle
      ? await validateKey(settings.apiKey.trim())
      : await validateOpenAiKey(
          base,
          settings.openaiKey.trim(),
          preset.chatPath,
          preset.defaultModel || settings.model || undefined,
        );
    setKeyTest(r);
    setTesting(false);
  };

  const modelsNote =
    modelsStatus === 'ok'
      ? t('settings.modelsNoteOk', { n: models.length })
      : modelsStatus === 'loading'
        ? t('settings.modelsNoteLoading')
        : t('settings.modelsNoteFallback');

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('settings.title')}>
        <div className="sheet-head">
          <h2>{t('settings.title')}</h2>
          <button className="sheet-close" aria-label={t('close')} onClick={onClose}>
            <XIcon size={16} />
          </button>
        </div>
        <div className="sheet-body">
          {/* ── Anbieter ── */}
          <div className="sheet-section">{t('settings.providerSection')}</div>
          <div className="model-choices">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                className={`model-choice${settings.provider === p.id ? ' sel' : ''}`}
                onClick={() => {
                  if (p.id === settings.provider) return;
                  onChange({
                    provider: p.id,
                    model: p.defaultModel || settings.model,
                  });
                  setKeyTest(null);
                  setTimeout(() => onRefreshModels(true), 50);
                }}
              >
                <span className="mc-name">{p.label}</span>
                <span className="mc-badges">
                  {p.badges.map((b) => (
                    <span key={b} className={`prov-badge pb-${b}`}>
                      {t(BADGE_KEYS[b])}
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>

          {/* ── Zugang ── */}
          <div className="sheet-section">
            {isGoogle ? 'Gemini API' : `${preset.label} API`}
          </div>

          {preset.needsBaseUrl && (
            <>
              <label className="field-label" htmlFor="custom-base">
                {t('settings.baseUrl')}
              </label>
              <input
                id="custom-base"
                className="text-input"
                type="text"
                value={settings.customBase}
                placeholder="https://api.anbieter.de/v1"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => onChange({ customBase: e.target.value })}
              />
            </>
          )}

          {preset.keyMode === 'none' ? (
            <>
              <label className="field-label" htmlFor="api-key-input">
                {t('settings.openaiKey', { provider: preset.label })}
                <span className="field-label-note"> · {t('settings.keyOptional')}</span>
              </label>
              <div className="key-row">
                <div className="key-input-wrap">
                  <KeyIcon size={15} />
                  <input
                    id="api-key-input"
                    type={showKey ? 'text' : 'password'}
                    value={settings.openaiKey}
                    placeholder="(optional)"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => {
                      onChange({ openaiKey: e.target.value });
                      setKeyTest(null);
                    }}
                  />
                  <button className="key-show" onClick={() => setShowKey((v) => !v)}>
                    {showKey ? t('settings.hide') : t('settings.show')}
                  </button>
                </div>
                <button className="key-test" onClick={testKey} disabled={testing}>
                  {testing ? '…' : t('settings.test')}
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="field-label" htmlFor="api-key-input">
                {isGoogle ? t('settings.apiKey') : t('settings.openaiKey', { provider: preset.label })}
              </label>
              <div className="key-row">
                <div className="key-input-wrap">
                  <KeyIcon size={15} />
                  <input
                    id="api-key-input"
                    type={showKey ? 'text' : 'password'}
                    value={activeKey}
                    placeholder={isGoogle ? 'AIza…' : 'sk-…'}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => {
                      onChange(isGoogle ? { apiKey: e.target.value } : { openaiKey: e.target.value });
                      setKeyTest(null);
                    }}
                  />
                  <button className="key-show" onClick={() => setShowKey((v) => !v)}>
                    {showKey ? t('settings.hide') : t('settings.show')}
                  </button>
                </div>
                <button
                  className="key-test"
                  onClick={testKey}
                  disabled={testing || (preset.needsBaseUrl ? !settings.customBase.trim() : !activeKey)}
                >
                  {testing ? '…' : t('settings.test')}
                </button>
              </div>
            </>
          )}

          {keyTest && (
            <p className={`key-result ${keyTest.ok ? 'ok' : 'bad'}`}>
              {keyTest.ok && <CheckIcon size={13} />} {keyTest.message}
            </p>
          )}

          {preset.keyUrl && (
            <p className="field-hint">
              {t('settings.getKey')}{' '}
              <a href={preset.keyUrl} target="_blank" rel="noreferrer">
                {preset.keyUrl.replace(/^https?:\/\//, '')}
              </a>
              <br />
              {isGoogle
                ? t('settings.keyLocalGoogle')
                : t('settings.keyLocal')}
            </p>
          )}

          {/* ── Sprachen ── */}
          <div className="sheet-section">{t('settings.learningSection')}</div>
          <label className="field-label">{t('settings.uiLang')}</label>
          <div className="lang-chips">
            {(['de', 'ru', 'en'] as UiLangSetting[]).map((l) => (
              <button
                key={l}
                className={`lang-chip${settings.uiLang === l ? ' sel' : ''}`}
                onClick={() => {
                  markLangTouched();
                  onChange({ uiLang: l, nativeLang: l });
                }}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
          <label className="field-label">{t('settings.nativeLang')}</label>
          <div className="lang-chips">
            {(['de', 'ru', 'en'] as UiLangSetting[]).map((l) => (
              <button
                key={l}
                className={`lang-chip${settings.nativeLang === l ? ' sel' : ''}`}
                onClick={() => {
                  markLangTouched();
                  onChange({ nativeLang: l });
                }}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
          <label className="field-label">{t('settings.targetLang')}</label>
          <div className="lang-chips">
            {(['de', 'en', 'ru'] as TargetLangSetting[]).map((l) => (
              <button
                key={l}
                className={`lang-chip${settings.targetLang === l ? ' sel' : ''}`}
                onClick={() => {
                  markLangTouched();
                  onChange({ targetLang: l });
                }}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>

          {/* ── Modell ── */}
          <label className="field-label">
            {t('composer.model')}
            <span className="field-label-note">{modelsNote}</span>
          </label>
          <div className="model-choices">
            {models.map((m) => (
              <button
                key={m.id}
                className={`model-choice${settings.model === m.id ? ' sel' : ''}`}
                onClick={() => onChange({ model: m.id })}
              >
                <span className="mc-name">{m.full}</span>
                {m.hint && <span className="mc-hint">{m.hint}</span>}
              </button>
            ))}
          </div>
          {!isGoogle && (
            <>
              <label className="field-label" htmlFor="manual-model">
                {t('settings.modelManual')}
              </label>
              <input
                id="manual-model"
                className="text-input"
                type="text"
                value={settings.model}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => onChange({ model: e.target.value.trim() })}
              />
            </>
          )}

          <label className="toggle-row">
            <div>
              <span className="toggle-title">{t('settings.thinkingDefault')}</span>
              <span className="toggle-hint">{t('settings.thinkingHint')}</span>
            </div>
            <input
              type="checkbox"
              checked={settings.thinkingDefault}
              onChange={(e) => onChange({ thinkingDefault: e.target.checked })}
            />
            <span className="toggle-ui" />
          </label>

          <label className="toggle-row">
            <div>
              <span className="toggle-title">{t('settings.graphToggle')}</span>
              <span className="toggle-hint">{t('settings.graphHint', { n: graphCount })}</span>
            </div>
            <input
              type="checkbox"
              checked={settings.graphExtraction}
              onChange={(e) => onChange({ graphExtraction: e.target.checked })}
            />
            <span className="toggle-ui" />
          </label>

          {/* ── TTS ── */}
          <div className="sheet-section">{t('settings.ttsSection')}</div>
          <label className="toggle-row">
            <div>
              <span className="toggle-title">{t('settings.ttsEnable')}</span>
              <span className="toggle-hint">{t('settings.ttsHint')}</span>
            </div>
            <input
              type="checkbox"
              checked={settings.ttsEnabled}
              onChange={(e) => onChange({ ttsEnabled: e.target.checked })}
            />
            <span className="toggle-ui" />
          </label>
          <label className="field-label" htmlFor="tts-rate">
            {t('settings.ttsRate', { x: settings.ttsRate.toFixed(1) })}
          </label>
          <input
            id="tts-rate"
            type="range"
            min={0.6}
            max={1.6}
            step={0.1}
            value={settings.ttsRate}
            onChange={(e) => onChange({ ttsRate: Number(e.target.value) })}
            className="slider"
          />

          {/* ── Daten ── */}
          <div className="sheet-section">{t('settings.dataSection')}</div>
          <div className="data-actions">
            <button
              className="data-btn"
              onClick={() => {
                const blob = new Blob([exportAll()], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `learnharness-export-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              {t('settings.export')}
            </button>
            <button
              className="data-btn danger"
              onClick={() => {
                if (confirm(t('settings.confirmDelete'))) {
                  onClearData();
                  onClose();
                }
              }}
            >
              {t('settings.deleteAll')}
            </button>
          </div>

          <div className="sheet-section">{t('settings.about')}</div>
          <p className="about-text">
            {t('settings.aboutText', { v: APP_VERSION, provider: preset.label })}
          </p>
        </div>
      </div>
    </div>
  );
}
