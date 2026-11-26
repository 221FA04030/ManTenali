import { Link } from 'react-router-dom';
import { Clock, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge, SampleBadge } from '../../../components/ui/Badge.jsx';
import { categoryName } from '../../categories/api.js';
import { cldUrl } from '../../../lib/cloudinary.js';
import { DateBlock, EventWhen } from './EventBits.jsx';

/** Event card: date block, title, time, venue area, category, cancelled label, banner thumbnail when there is one. */
export function EventCard({ event: e }) {
  const { t, i18n } = useTranslation();
  return (
    <Link
      to={`/events/${e.slug}`}
      className="flex gap-3 rounded-card bg-white p-3 shadow-card ring-1 ring-brand-100 transition-shadow hover:shadow-lift"
    >
      <DateBlock startLocal={e.startLocal} muted={e.isCancelled} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap gap-1.5">
          {e.isCancelled && <Badge tone="red">{t('events.cancelled')}</Badge>}
          {e.category && <Badge tone="gray">{categoryName(e.category, i18n.language)}</Badge>}
          {e.isSeed && <SampleBadge />}
        </span>
        <span className={`line-clamp-2 font-bold leading-snug ${e.isCancelled ? 'text-ink-muted line-through' : ''}`}>{e.title}</span>
        <span className="flex items-start gap-1 text-[13px] text-ink-muted">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <EventWhen startLocal={e.startLocal} endLocal={e.endLocal} allDay={e.allDay} />
        </span>
        <span className="flex min-w-0 items-center gap-1 text-[13px] text-ink-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{[e.venue.name, e.venue.area].join(' • ')}</span>
        </span>
      </span>
      {e.bannerImage && (
        <img
          src={cldUrl(e.bannerImage.url, { w: 192, h: 192 })}
          alt=""
          loading="lazy"
          className={`h-[88px] w-[88px] shrink-0 self-center rounded-2xl object-cover ${e.isCancelled ? 'opacity-60 grayscale' : ''}`}
        />
      )}
    </Link>
  );
}
