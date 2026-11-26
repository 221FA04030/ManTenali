import { NavLink } from 'react-router-dom';
import { Bookmark, Compass, House, Plus, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn.js';

const ITEMS = [
  { to: '/', key: 'home', icon: House, end: true, fill: true },
  { to: '/discover', key: 'discover', icon: Compass },
  { to: '/suggest', key: 'post', icon: Plus, center: true },
  { to: '/saved', key: 'saved', icon: Bookmark, fill: true },
  { to: '/profile', key: 'profile', icon: User },
];

/** Always-visible bottom navigation (Home, Discover, Post, Saved, Profile). The centre button opens the "add something" hub. */
export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-app rounded-t-3xl bg-white shadow-nav safe-bottom"
    >
      <ul className="grid grid-cols-5 items-end px-1 pb-1.5 pt-1.5">
        {ITEMS.map(({ to, key, icon: Icon, end, center, fill }) => (
          <li key={key} className="flex justify-center">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[56px] min-w-[60px] flex-col items-center justify-end gap-1 rounded-2xl px-2 pb-1 text-[12px] font-medium transition-colors',
                  center ? 'text-ink' : isActive ? 'bg-brand-100 text-brand-800' : 'text-ink hover:text-brand-800',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {center ? (
                    <span
                      className={cn(
                        '-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-lift ring-4 ring-white',
                        isActive && 'bg-brand-800',
                      )}
                    >
                      <Icon className="h-7 w-7" strokeWidth={2.6} aria-hidden="true" />
                    </span>
                  ) : (
                    <Icon
                      className={cn('h-6 w-6', isActive && 'text-brand-800', isActive && fill && 'fill-brand-700')}
                      strokeWidth={isActive ? 2.4 : 2}
                      aria-hidden="true"
                    />
                  )}
                  <span className={cn('max-w-[68px] truncate leading-tight', isActive && 'font-semibold text-brand-800')}>
                    {t(`nav.${key}`)}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
