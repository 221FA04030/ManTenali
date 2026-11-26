import { Bell, ChevronLeft, LocateFixed, MapPin, Menu, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo.jsx';
import { Skyline } from './Skyline.jsx';
import { useMenu } from '../../app/MenuContext.jsx';
import { useLocationContext } from '../../app/providers/LocationProvider.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { TENALI_AREAS } from '../../config/areas.js';
import { cldUrl } from '../../lib/cloudinary.js';
import { cn } from '../../lib/cn.js';
import { usePageTitle } from '../../lib/usePageTitle.js';

const iconBtn =
  'flex min-h-tap min-w-tap items-center justify-center rounded-full transition-colors focus-visible:ring-white';

/**
 * Where the Home feed is for: an area of Tenali, all of Tenali, or "near me"
 * (shown while location is on; choosing an area turns it off).
 */
function LocationChip() {
  const { t } = useTranslation();
  const { area, setArea, coords, clearNearMe } = useLocationContext();
  const Icon = coords ? LocateFixed : MapPin;
  return (
    <label className="relative inline-flex max-w-full items-center">
      <span className="sr-only">{t('location.area')}</span>
      <Icon className="pointer-events-none absolute left-3 h-4 w-4 text-white" aria-hidden="true" />
      <select
        value={coords ? '__near' : area}
        onChange={(e) => {
          if (coords) clearNearMe();
          setArea(e.target.value === '__near' ? area : e.target.value);
        }}
        className="min-h-[36px] max-w-[11rem] appearance-none sm:max-w-[15rem] truncate rounded-full bg-white/20 pl-8 pr-4 text-sm font-semibold text-white ring-1 ring-white/50 focus:outline-none focus:ring-2 focus:ring-white [&>option]:text-ink"
      >
        {coords && <option value="__near">{t('location.nearMeChip')}</option>}
        <option value="">{t('location.allTenali')}</option>
        {TENALI_AREAS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Profile photo / initial when signed in, otherwise a log-in button. */
function AccountButton() {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (!user) {
    return (
      <Link to="/login" className={cn(iconBtn, 'text-white hover:bg-white/15')} aria-label={t('auth.login')}>
        <UserRound className="h-6 w-6" aria-hidden="true" />
      </Link>
    );
  }
  return (
    <Link to="/profile" className={cn(iconBtn, 'hover:bg-white/15')} aria-label={t('header.profile', { name: user.name })}>
      {user.avatarUrl ? (
        <img src={cldUrl(user.avatarUrl, { w: 72, h: 72 })} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-white" />
      ) : (
        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-white font-bold text-brand-800">
          {user.name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </Link>
  );
}

/**
 * Home header: green gradient fading into mint, menu, wordmark, location chip,
 * notices bell and account button, skyline. `children` (the search bar)
 * overlaps the bottom edge like the reference.
 */
export function HomeHeader({ children }) {
  const { t } = useTranslation();
  usePageTitle(null);
  const navigate = useNavigate();
  const { openMenu } = useMenu();
  return (
    <header className="relative bg-header-green pt-[max(env(safe-area-inset-top),12px)]">
      <div className="relative z-10 flex items-start justify-between px-3 pt-2">
        <button type="button" className={cn(iconBtn, 'text-white hover:bg-white/15')} onClick={openMenu} aria-label={t('menu.open')}>
          <Menu className="h-7 w-7" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-col items-center gap-2 pt-3">
          <Logo />
          <LocationChip />
        </div>
        <div className="flex items-center">
          <button
            type="button"
            className={cn(iconBtn, 'text-white hover:bg-white/15')}
            onClick={() => navigate('/news')}
            aria-label={t('header.notifications')}
          >
            <Bell className="h-6 w-6" aria-hidden="true" />
          </button>
          <AccountButton />
        </div>
      </div>
      <Skyline className="relative -mt-1 block h-20 w-full sm:h-24" />
      <div className="relative z-10 -mt-3 bg-gradient-to-b from-[#CDEFD2] to-brand-100 px-4 pb-4">{children}</div>
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
          {subtitle && <p className={cn('text-sm', mint ? 'text-ink' : 'text-white/85')}>{subtitle}</p>}
        </div>
        <div className="flex min-w-11 items-center justify-end gap-1">{actions}</div>
      </div>
    </header>
  );
}
