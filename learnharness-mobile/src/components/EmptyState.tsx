import { KeyIcon } from '../lib/icons';
import { t } from '../lib/i18n';

export function EmptyState({
  hasKey,
  onSetupKey,
  graphCount,
}: {
  hasKey: boolean;
  onSetupKey: () => void;
  graphCount: number;
}) {
  return (
    <div className="empty-state" role="status">
      <h1 className="hero-title">{t('empty.title')}</h1>
      <p className="hero-subtitle">
        {hasKey ? t('empty.subReady') : t('empty.subKey')}
      </p>
      {!hasKey && (
        <button className="setup-key-btn" onClick={onSetupKey}>
          <KeyIcon size={16} />
          {t('empty.setupKey')}
        </button>
      )}
      {hasKey && graphCount > 0 && (
        <p className="hero-graph-hint">
          {t('empty.graphHint', { n: graphCount, p: graphCount === 1 ? '' : 'e' })}
        </p>
      )}
    </div>
  );
}
