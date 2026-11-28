import { Link } from 'react-router-dom';
import { AdminModerationMenu } from '../../moderation/components/AdminModerationMenu.jsx';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { SectionHeader } from '../../../components/ui/SectionHeader.jsx';
import { formatRelative } from '../../../lib/format.js';
import { NewsTypeIcon } from '../../news/components/NewsBits.jsx';
import { EventWhen } from '../../events/components/EventBits.jsx';

const row = 'flex min-h-[64px] items-center gap-3 px-4 py-3 hover:bg-surface-soft';

/**
 * Today in Tenali (spec section 11): latest time-sensitive notices (traffic,
 * weather, power, water, announcements) with source and updated time, plus the
 * next upcoming event. "View All" opens /news.
 */
export function TodayInTenali({ today }) {
  const { t, i18n } = useTranslation();
  const notices = today?.notices ?? [];
  const event = today?.nextEvent;
  return (
    <section aria-labelledby="home-today-title" className="page-pad">
      <div id="home-today-title">
        <SectionHeader title={t('home.todayTitle')} to="/news" />
      </div>
      {notices.length === 0 && !event ? (
        <p className="rounded-card border border-line bg-white p-4 text-sm text-meta">{t('home.noUpdates')}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
          {notices.map((n) => (
            <li key={n.id} className="flex items-center">
              <Link to={`/news/${n.slug}`} className={`${row} min-w-0 flex-1`}>
                <NewsTypeIcon type={n.type} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="line-clamp-2 font-semibold leading-snug text-heading">{n.title}</span>
                  <span className="truncate text-[13px] text-meta">
                    {n.sourceName} • {t('common.updated', { time: formatRelative(n.updatedAt, i18n.language) })}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-meta" aria-hidden="true" />
              </Link>
              <AdminModerationMenu type="news" id={n.id} title={n.title} className="mr-1" />
            </li>
          ))}
          {event && (
            <li className="flex items-center">
              <Link to={`/events/${event.slug}`} className={`${row} min-w-0 flex-1`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-status-eventBg text-status-event" aria-hidden="true">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-xs font-semibold text-status-event">{t('home.nextEvent')}</span>
                  <span className="line-clamp-2 font-semibold leading-snug text-heading">{event.title}</span>
                  <span className="truncate text-[13px] text-meta">
                    <EventWhen startLocal={event.startLocal} endLocal={event.endLocal} allDay={event.allDay} /> • {event.venue.area}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-meta" aria-hidden="true" />
              </Link>
              <AdminModerationMenu type="event" id={event.id} title={event.title} className="mr-1" />
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
