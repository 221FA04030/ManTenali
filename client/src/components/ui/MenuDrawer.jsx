import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Globe, Info, LogIn, LogOut, Plus, ShieldCheck, Store, User, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMenu } from '../../app/MenuContext.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { authApi } from '../../features/auth/api.js';
import { LANGUAGES } from '../../app/i18n.js';
import { cn } from '../../lib/cn.js';

const linkCls =
  'flex min-h-tap items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-ink hover:bg-brand-50';

/** Side drawer: language switch, login/profile, about, admin link for admins. */
export function MenuDrawer() {
  const { t, i18n } = useTranslation();
  const { open, closeMenu } = useMenu();
  const { user, logout, setSessionUser } = useAuth();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    // Remember the choice on the account too, so it follows the user across devices.
    if (user && user.language !== lng) {
      authApi.updateMe({ language: lng }).then(setSessionUser).catch(() => {});
    }
  };
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && closeMenu();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closeMenu]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label={t('menu.close')} onClick={closeMenu} tabIndex={-1} />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('menu.title')}
        className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-white shadow-lift"
      >
        <div className="flex items-center justify-between bg-header-green px-4 pb-6 pt-[max(env(safe-area-inset-top),16px)] text-white">
          <div>
            <p className="text-xl font-bold">{t('app.name')}</p>
            <p className="text-sm text-white/90">{user ? user.name : t('app.tagline')}</p>
          </div>
          <button
            type="button"
            onClick={closeMenu}
            aria-label={t('menu.close')}
            className="flex min-h-tap min-w-tap items-center justify-center rounded-full hover:bg-white/15"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <fieldset className="mb-2 rounded-2xl bg-brand-50 p-3">
            <legend className="sr-only">{t('menu.language')}</legend>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-muted">
              <Globe className="h-4 w-4" aria-hidden="true" />
              {t('menu.language')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((lng) => {
                const active = i18n.resolvedLanguage === lng;
                return (
                  <button
                    key={lng}
                    type="button"
                    lang={lng}
                    aria-pressed={active}
                    onClick={() => changeLanguage(lng)}
                    className={cn(
                      'min-h-tap rounded-xl text-[15px] font-semibold ring-1 transition-colors',
                      active ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-ink ring-brand-200 hover:bg-brand-100',
                    )}
                  >
                    {lng === 'en' ? t('common.english') : t('common.telugu')}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {user ? (
            <Link to="/profile" className={linkCls} onClick={closeMenu}>
              <User className="h-5 w-5 text-brand-700" aria-hidden="true" />
              {t('menu.profile')}
            </Link>
          ) : (
            <Link to="/login" className={linkCls} onClick={closeMenu}>
              <LogIn className="h-5 w-5 text-brand-700" aria-hidden="true" />
              {t('menu.login')}
            </Link>
          )}
          <Link to="/manage/new" className={linkCls} onClick={closeMenu}>
            <Plus className="h-5 w-5 text-brand-700" aria-hidden="true" />
            {t('submit.addYourBusiness')}
          </Link>
          {user && (
            <Link to="/manage" className={linkCls} onClick={closeMenu}>
              <Store className="h-5 w-5 text-brand-700" aria-hidden="true" />
              {t('profile.myBusinesses')}
            </Link>
          )}
          <Link to={user ? '/events/submissions' : '/events/submit'} className={linkCls} onClick={closeMenu}>
            <CalendarPlus className="h-5 w-5 text-brand-700" aria-hidden="true" />
            {user ? t('events.mySubmissions') : t('events.submitTitle')}
          </Link>
          <Link to="/about" className={linkCls} onClick={closeMenu}>
            <Info className="h-5 w-5 text-brand-700" aria-hidden="true" />
            {t('menu.about')}
          </Link>
          {user?.role === 'admin' && (
            <Link to="/admin" className={linkCls} onClick={closeMenu}>
              <ShieldCheck className="h-5 w-5 text-brand-700" aria-hidden="true" />
              {t('menu.admin')}
            </Link>
          )}
          {user && (
            <button
              type="button"
              className={cn(linkCls, 'text-left')}
              onClick={async () => {
                closeMenu();
                await logout();
              }}
            >
              <LogOut className="h-5 w-5 text-brand-700" aria-hidden="true" />
              {t('menu.logout')}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
