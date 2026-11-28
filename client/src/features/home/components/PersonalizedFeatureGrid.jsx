import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight, LayoutGrid } from 'lucide-react';
import { CategoryTile } from '../../../components/ui/CategoryTile.jsx';
import { ComingSoonBadge } from '../../../components/ui/Badge.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { ENGAGEMENT, HOME_FEATURES } from '../../../config/features.js';
import { useBusinessCategoryLink } from '../../categories/api.js';
import { useFeatureOrder } from '../engagement/useFeatureEngagement.js';
import { cn } from '../../../lib/cn.js';

const BY_KEY = new Map(HOME_FEATURES.map((f) => [f.key, f]));

/** Features in this person's order, each with where it opens (or `missing` if it cannot open yet). */
function useRankedFeatures() {
  const order = useFeatureOrder();
  const categoryLink = useBusinessCategoryLink();
  return useMemo(
    () =>
      order.map((key) => {
        const f = BY_KEY.get(key);
        const link = f.categorySlug ? categoryLink(f.categorySlug) : { to: f.to };
        return { ...f, href: link.to, unavailable: Boolean(f.comingSoon || link.missing) };
      }),
    [order, categoryLink],
  );
}

/**
 * Home's personalised shortcuts: exactly ENGAGEMENT.visibleCount (8) features,
 * most used first, then a More Features tile (not ranked) that lists all the
 * rest. Features that cannot open yet go to the end, so the 8 shown all work.
 */
export function PersonalizedFeatureGrid() {
  const { t } = useTranslation();
  const ranked = useRankedFeatures();
  const [moreOpen, setMoreOpen] = useState(false);
  const sorted = useMemo(() => [...ranked.filter((f) => !f.unavailable), ...ranked.filter((f) => f.unavailable)], [ranked]);
  const visible = sorted.slice(0, ENGAGEMENT.visibleCount);
  const rest = sorted.slice(ENGAGEMENT.visibleCount);

  return (
    <section aria-label={t('home.categoriesLabel')} className="feat-grid mx-auto mt-5 w-full max-w-[40rem]">
      <ul>
        {visible.map((f) => (
          <li key={f.key}>
            <CategoryTile icon={f.icon} label={t(f.labelKey)} to={f.href} comingSoon={f.unavailable} tint={f.tint} />
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setMoreOpen(true)}
        aria-haspopup="dialog"
        className="mt-4 flex min-h-[48px] w-full items-center gap-3 rounded-2xl border border-line bg-surface-soft px-4 text-left transition-colors hover:bg-primary-light focus-visible:ring-primary"
      >
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-primary ring-1 ring-line">
          <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1 text-[15px] font-semibold text-primary-dark">{t('features.more')}</span>
        {rest.length > 0 && (
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-meta ring-1 ring-line">
            {t('features.moreCount', { count: rest.length })}
          </span>
        )}
        <ChevronRight className="h-5 w-5 shrink-0 text-meta" aria-hidden="true" />
      </button>
      <MoreFeaturesSheet open={moreOpen} onClose={() => setMoreOpen(false)} features={rest} />
    </section>
  );
}

/** Every feature not on Home's grid, in the same personal order, with a short description. */
export function MoreFeaturesSheet({ open, onClose, features }) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={t('features.moreTitle')}>
      <p className="-mt-2 mb-3 text-sm text-meta">{t('features.moreSubtitle')}</p>
      {features.length === 0 ? (
        <p className="py-6 text-center text-sm text-meta">{t('features.allShown')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {features.map((f) => {
            const Icon = f.icon;
            const body = (
              <>
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={f.unavailable ? undefined : { backgroundColor: f.tint.bg, color: f.tint.fg }}
                >
                  <Icon className={cn('h-5 w-5', f.unavailable && 'text-gray-500')} strokeWidth={1.75} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold leading-snug text-heading">{t(f.labelKey)}</span>
                  <span className="text-[13px] leading-snug text-meta">{t(f.descKey)}</span>
                </span>
              </>
            );
            return (
              <li key={f.key}>
                {f.unavailable ? (
                  <div className="flex min-h-[64px] items-center gap-3 py-2 opacity-70" aria-disabled="true" data-coming-soon="true">
                    {body}
                    <ComingSoonBadge short />
                  </div>
                ) : (
                  <Link to={f.href} onClick={onClose} className="flex min-h-[64px] items-center gap-3 rounded-xl py-2 hover:bg-surface-soft">
                    {body}
                    <ChevronRight className="h-5 w-5 shrink-0 text-meta" aria-hidden="true" />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
