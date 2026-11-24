import { Bell, ChevronLeft, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo.jsx';
import { Skyline } from './Skyline.jsx';
import { useMenu } from '../../app/MenuContext.jsx';
import { cn } from '../../lib/cn.js';

const iconBtn =
  'flex min-h-tap min-w-tap items-center justify-center rounded-full transition-colors focus-visible:ring-white';

/**
 * Home header: green gradient fading into mint, menu, wordmark, bell, skyline.
 * `children` (the search bar) overlaps the bottom edge like the reference.
 */
export function HomeHeader({ children }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openMenu } = useMenu();
  return (
    <header className="relative bg-header-green pt-[max(env(safe-area-inset-top),12px)]">
      <div className="relative z-10 flex items-start justify-between px-3 pt-2">
        <button type="button" className={cn(iconBtn, 'text-white hover:bg-white/15')} onClick={openMenu} aria-label={t('menu.open')}>
          <Menu className="h-7 w-7" aria-hidden="true" />
        </button>
        <div className="pt-3">
          <Logo />
        </div>
        <button
          type="button"
          className={cn(iconBtn, 'text-white hover:bg-white/15')}
          onClick={() => navigate('/news')}
          aria-label={t('header.notifications')}
        >
          <Bell className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
      <Skyline className="relative -mt-1 block h-20 w-full sm:h-24" />
      <div className="relative z-10 -mt-3 bg-gradient-to-b from-[#CDEFD2] to-brand-100 px-4 pb-4">{children}</div>
    </header>
  );
}

/** Sub-page header. `variant="mint"` is the Explore style; default is compact green. */
export function PageHeader({ title, subtitle, back = true, variant = 'green', actions }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mint = variant === 'mint';
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));
  return (
    <header
      className={cn(
        'sticky top-0 z-30 pt-[max(env(safe-area-inset-top),8px)]',
        mint ? 'bg-explore-mint' : 'bg-brand-700 text-white shadow-sm',
      )}
    >
      <div className={cn('mx-auto flex max-w-app items-center gap-2 px-3', mint ? 'min-h-[88px] py-3' : 'min-h-[60px]')}>
        {back ? (
          <button
            type="button"
            onClick={goBack}
            aria-label={t('nav.back')}
            className={cn(
              iconBtn,
              mint ? 'h-12 w-12 bg-white/80 text-brand-800 shadow-card hover:bg-white' : 'text-white hover:bg-white/15',
            )}
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
        ) : (
          <span className="w-11" />
        )}
        <div className={cn('flex min-w-0 flex-1 flex-col', mint ? 'items-center text-center' : '')}>
          <h1 className={cn('truncate font-bold', mint ? 'text-2xl text-ink' : 'text-lg')}>{title}</h1>
          {subtitle && <p className={cn('text-sm', mint ? 'text-ink' : 'text-white/85')}>{subtitle}</p>}
        </div>
        <div className="flex min-w-11 items-center justify-end gap-1">{actions}</div>
      </div>
    </header>
  );
}
