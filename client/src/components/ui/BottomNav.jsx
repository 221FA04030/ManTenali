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

/** Label size: 15px on most phones, a little smaller on narrow ones so five labels always fit. */
const label = 'text-[clamp(0.6875rem,3.3vw,0.9375rem)] leading-tight';

/**
 * Always-visible bottom navigation (DOCS/refrence.jpeg): Home, Discover, Post,
 * Saved, Profile. The active tab sits on a light-green pill with a filled
 * icon; the raised green Post button opens the "add something" hub.
 */
export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('nav.main')} className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-app rounded-t-[24px] border-t border-line bg-white shadow-bar safe-bottom">
      <ul className="grid h-[clamp(4.25rem,19vw,5.25rem)] grid-cols-5 items-center px-1">
        {ITEMS.map(({ to, key, icon: Icon, end, center, fill }) => (
          <li key={key} className="flex h-full items-center justify-center">
            {center ? (
              <NavLink to={to} className="group -mt-[clamp(1.25rem,6vw,2rem)] flex flex-col items-center gap-1 rounded-2xl text-meta">
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'flex h-[clamp(3.25rem,14vw,4.25rem)] w-[clamp(3.25rem,14vw,4.25rem)] items-center justify-center rounded-full bg-primary text-white shadow-post ring-4 ring-white transition-transform group-active:scale-95',
                        isActive && 'bg-primary-dark',
                      )}
                    >
                      <Icon className="h-1/2 w-1/2" strokeWidth={2.5} aria-hidden="true" />
                    </span>
                    <span className={cn(label, isActive && 'font-semibold text-primary-dark')}>{t(`nav.${key}`)}</span>
                  </>
                )}
              </NavLink>
            ) : (
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[52px] min-w-[52px] flex-col items-center justify-center gap-0.5 rounded-2xl px-[clamp(0.375rem,3vw,1.5rem)] py-1.5 transition-colors',
                    isActive ? 'bg-primary-light text-primary-dark' : 'text-meta hover:text-primary',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn('h-[clamp(1.375rem,6vw,1.625rem)] w-[clamp(1.375rem,6vw,1.625rem)]', isActive && fill && 'fill-primary text-primary')}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className={cn(label, isActive && 'font-semibold')}>{t(`nav.${key}`)}</span>
                  </>
                )}
              </NavLink>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
