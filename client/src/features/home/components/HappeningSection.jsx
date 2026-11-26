import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarDays, MapPin, Newspaper, TicketPercent } from 'lucide-react';
import { cldUrl } from '../../../lib/cloudinary.js';
import { formatDate } from '../../../lib/format.js';
import { formatIsoDate } from '../../../lib/dates.js';

const BADGE = {
  event: 'bg-primary-light text-primary',
  offer: 'bg-white text-offer-text',
  news: 'bg-white text-news',
};
const PLACEHOLDER_ICON = { event: CalendarDays, offer: TicketPercent, news: Newspaper };

/** Card fields for one event, offer or news item (real data from GET /home). */
function cardOf(type, item, t, lang) {
  if (type === 'event') {
    return {
      to: `/events/${item.slug}`,
      image: item.bannerImage,
      meta: [
        { icon: CalendarDays, text: formatIsoDate(item.startLocal?.slice(0, 10), lang) },
        { icon: MapPin, text: item.venue?.area },
      ],
    };
  }
  if (type === 'offer') {
    return { to: `/offers/${item.id}`, image: item.image, meta: [{ icon: MapPin, text: item.business?.name }] };
  }
  return { to: `/news/${item.slug}`, image: item.coverImage, meta: [{ icon: CalendarDays, text: formatDate(item.publishedAt ?? item.updatedAt, lang) }] };
}

/** Events, offers and news taken in turns, so the row mixes all three. */
export function mixHappening({ events = [], offers = [], news = [] }) {
  const out = [];
  for (let i = 0; i < Math.max(events.length, offers.length, news.length); i += 1) {
    if (events[i]) out.push({ type: 'event', item: events[i] });
    if (offers[i]) out.push({ type: 'offer', item: offers[i] });
    if (news[i]) out.push({ type: 'news', item: news[i] });
  }
  return out;
}

export function HappeningCard({ type, item }) {
  const { t, i18n } = useTranslation();
  const c = cardOf(type, item, t, i18n.language);
  const Icon = PLACEHOLDER_ICON[type];
  return (
    <Link to={c.to} className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-black/[0.03] transition-shadow hover:shadow-lift">
      <span className="relative block h-[82px] shrink-0">
        {c.image?.url ? (
          <img src={cldUrl(c.image.url, { w: 320, h: 164 })} alt="" width={320} height={164} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-photo-placeholder">
            <Icon className="h-8 w-8 text-primary/40" strokeWidth={1.5} />
          </span>
        )}
        <span className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-[clamp(0.75rem,3.1vw,0.8125rem)] font-semibold leading-5 shadow-sm ${BADGE[type]}`}>
          {t(`home.badge.${type}`)}
        </span>
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="line-clamp-2 text-[clamp(0.875rem,3.6vw,0.9375rem)] font-semibold leading-snug text-heading">{item.title}</span>
        <span className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-meta">
          {c.meta
            .filter((m) => m.text)
            .map(({ icon: MetaIcon, text }) => (
              <span key={text} className="inline-flex min-w-0 items-center gap-1">
                <MetaIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate">{text}</span>
              </span>
            ))}
        </span>
      </span>
    </Link>
  );
}

/** "What's Happening in Tenali": a sideways row of real events, offers and news. Hidden when empty. */
export function HappeningSection({ items }) {
  const { t } = useTranslation();
  if (!items?.length) return null;
  return (
    <section aria-labelledby="home-happening-title" className="px-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-happening-title" className="text-[clamp(1.0625rem,4.4vw,1.375rem)] font-bold leading-tight text-heading">
          {t('home.bannerTitle')}
        </h2>
        <Link to="/discover" className="inline-flex min-h-tap shrink-0 items-center gap-1 text-[clamp(0.875rem,3.6vw,1rem)] font-medium text-primary hover:underline">
          {t('common.viewAll')}
          <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
        </Link>
      </div>
      <ul className="no-scrollbar -mr-4 mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 pr-4 pt-1">
        {items.map(({ type, item }) => (
          <li key={`${type}-${item.id}`} className="w-[clamp(9rem,37vw,10rem)] shrink-0 snap-start">
            <HappeningCard type={type} item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
