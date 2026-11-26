import { Bell, ChevronLeft, LogIn, Menu, Search, Sprout } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMenu } from '../../app/MenuContext.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { cldUrl } from '../../lib/cloudinary.js';
import { cn } from '../../lib/cn.js';
import { usePageTitle } from '../../lib/usePageTitle.js';

const iconBtn =
  'flex min-h-tap min-w-tap items-center justify-center rounded-full transition-colors focus-visible:ring-white';
/** 44px white circle used by the header's search and account buttons. */
const whiteCircle =
  'flex h-[clamp(2.25rem,7.9vw,2.75rem)] w-[clamp(2.25rem,7.9vw,2.75rem)] shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm transition-transform active:scale-95 focus-visible:ring-white';

/** Profile photo or first initial when signed in; a log-in button otherwise. */
function AccountButton() {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (!user) {
    return (
      <Link to="/login" className={whiteCircle} aria-label={t('auth.login')}>
        <LogIn className="h-[46%] w-[46%]" strokeWidth={2} aria-hidden="true" />
      </Link>
    );
  }
  return (
    <Link to="/profile" className={cn(whiteCircle, 'overflow-hidden')} aria-label={t('header.profile', { name: user.name })}>
      {user.avatarUrl ? (
        <img src={cldUrl(user.avatarUrl, { w: 88, h: 88 })} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true" className="text-[clamp(0.9375rem,3.2vw,1.125rem)] font-semibold">
          {user.name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </Link>
  );
}

/**
 * Home app bar (DOCS/refrence.jpeg): green gradient; menu, "Mana Tenali" with
 * a sprout and the tagline; search, notices and account on the right. With
 * `overlap`, the bottom ~40px is covered by the hero card.
 */
export function HomeHeader({ overlap = true }) {
  const { t } = useTranslation();
  usePageTitle(null);
  const navigate = useNavigate();
  const { openMenu } = useMenu();
  return (
    <header className={cn('bg-appbar-green px-2 pt-[max(env(safe-area-inset-top),10px)] text-white', overlap ? 'pb-14' : 'pb-3')}>
      <div className="flex items-center gap-1 py-2 pr-1.5">
        <button type="button" className={cn(iconBtn, 'shrink-0 text-white hover:bg-white/15')} onClick={openMenu} aria-label={t('menu.open')}>
          <Menu className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1 text-[clamp(1.125rem,5vw,1.75rem)] font-bold leading-tight tracking-tight">
            <span className="truncate">{t('app.name')}</span>
            <Sprout className="h-[1.1em] w-[1.1em] shrink-0 text-leaf" strokeWidth={2} aria-hidden="true" />
          </h1>
          <p className="truncate text-[clamp(0.75rem,3.2vw,0.9375rem)] text-white/90">{t('header.tagline')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-[clamp(0.125rem,1.6vw,0.875rem)]">
          <button type="button" className={whiteCircle} onClick={() => navigate('/search')} aria-label={t('header.search')}>
            <Search className="h-1/2 w-1/2" strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={cn(iconBtn, 'text-white hover:bg-white/15')}
            onClick={() => navigate('/news')}
            aria-label={t('header.notifications')}
          >
            <Bell className="h-[clamp(1.375rem,4.6vw,1.625rem)] w-[clamp(1.375rem,4.6vw,1.625rem)]" strokeWidth={1.75} aria-hidden="true" />
          </button>
          <AccountButton />
        </div>
      </div>
    </header>
  );
}

/** Sub-page header. `variant="mint"` is the Explore style; default is compact green. */
export function PageHeader({ title, subtitle, back = true, variant = 'green', actions }) {
  const { t } = useTranslation();
  usePageTitle(typeof title === 'string' ? title : null);
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
      <div className={cn('mx-auto flex max-w-app items-center gap-2 px-3 md:max-w-shell', mint ? 'min-h-[88px] py-3' : 'min-h-[60px]')}>
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
          {subtitle && <p className={cn('text-sm', mint ? 'text-ink' : 'text-white')}>{subtitle}</p>}
        </div>
        <div className="flex min-w-11 items-center justify-end gap-1">{actions}</div>
      </div>
    </header>
  );
}
