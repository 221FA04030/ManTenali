import { useTranslation } from 'react-i18next';
import { Banner } from '../../../components/ui/Banner.jsx';
import { cldUrl } from '../../../lib/cloudinary.js';
import { EventWhen } from '../../events/components/EventBits.jsx';

/** What each banner item links to and shows. */
function bannerProps({ type, item }, t) {
  if (type === 'event') {
    return {
      to: `/events/${item.slug}`,
      eyebrow: t('home.banner.event'),
      subtitle: <EventWhen startLocal={item.startLocal} endLocal={item.endLocal} allDay={item.allDay} />,
      image: item.bannerImage,
    };
  }
  if (type === 'offer') {
    return {
      to: `/offers/${item.id}`,
      eyebrow: t('home.banner.offer'),
      subtitle: [item.discountLabel, item.business?.name].filter(Boolean).join(' • '),
      image: item.image,
    };
  }
  return { to: `/news/${item.slug}`, eyebrow: t(`news.types.${item.type}`), subtitle: item.summary, image: item.coverImage };
}

/**
 * "What's Happening in Tenali?" (spec section 11): up to 5 items from GET /home,
 * swiped sideways (scroll snap; no auto-rotation, so nothing moves on its own).
 * Hidden when there is nothing to show.
 */
export function HomeBanner({ items }) {
  const { t } = useTranslation();
  if (!items?.length) return null;
  return (
    <section aria-labelledby="home-banner-title" className="page-pad">
      <h2 id="home-banner-title" className="mb-3 text-lg font-bold text-ink">
        {t('home.bannerTitle')}
      </h2>
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {items.map((entry) => {
          const p = bannerProps(entry, t);
          return (
            <li key={`${entry.type}-${entry.item.id}`} className={`shrink-0 snap-start ${items.length > 1 ? 'w-[88%]' : 'w-full'}`}>
              <Banner
                title={entry.item.title}
                eyebrow={p.eyebrow}
                subtitle={p.subtitle}
                ctaLabel={t('home.viewNow')}
                to={p.to}
                imageUrl={p.image?.url ? cldUrl(p.image.url, { w: 320, h: 320 }) : undefined}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
