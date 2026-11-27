import { Link, NavLink } from 'react-router-dom';
import { Bookmark, Compass, House, Plus, Search, TicketPercent, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn.js';

const ITEMS = [
  { to: '/', key: 'home', icon: House, end: true },
  { to: '/discover', key: 'discover', icon: Compass },
  { to: '/search', key: 'search', icon: Search },
  { to: '/offers', key: 'offers', icon: TicketPercent },
  { to: '/saved', key: 'saved', icon: Bookmark },
  { to: '/profile', key: 'profile', icon: User },
];

/**
 * Desktop sidebar (laid out like the reference's web view): the app name, the
 * main sections, and the green "Post" button. Replaces the bottom bar on wide
 * screens; rendered only there.
 */
export function SideNav() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('nav.main')} className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-100 bg-white px-5 py-7">
      <Link to="/" className="mb-8 rounded-lg px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span className="block text-[22px] font-extrabold leading-tight text-primary">{t('app.name')}</span>
        <span className="block text-[12px] text-meta">{t('app.tagline')}</span>
      </Link>
      <ul className="flex flex-col gap-1">
        {ITEMS.map(({ to, key, icon: Icon, end }) => (
          <li key={key}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[48px] items-center gap-4 rounded-xl px-3 text-[16px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive ? 'bg-primary-light text-primary' : 'text-label hover:bg-gray-50 hover:text-primary',
                )
              }
            >
              <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              {t(`nav.${key}`)}
            </NavLink>
          </li>
        ))}
      </ul>
      <Link
        to="/suggest"
        className="mt-auto flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-primary px-4 text-[15px] font-bold text-primary transition hover:bg-primary hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        {t('pages.addSomething')}
      </Link>
    </nav>
  );
}
