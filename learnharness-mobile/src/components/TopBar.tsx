import { BrandIcon } from '../lib/icons';
import { t } from '../lib/i18n';

export function TopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="topbar" role="banner">
      <button className="brand-btn" aria-label={t('top.menu')} onClick={onMenu}>
        <BrandIcon size={22} />
      </button>
    </header>
  );
}
