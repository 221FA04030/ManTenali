import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, MapPin, Newspaper, Pause, Play, TicketPercent } from 'lucide-react';
import { cldUrl } from '../../../lib/cloudinary.js';
import { formatIsoDate } from '../../../lib/dates.js';
import { cn } from '../../../lib/cn.js';

const AUTO_MS = 4000;
/** After a touch, wait this long before moving on by itself again. */
const RESUME_AFTER_TOUCH_MS = 6000;

/** Title, line under it, place, link and photo for one banner item from GET /home. */
export function heroSlide({ type, item }, t, lang) {
  if (type === 'event') {
    return {
      to: `/events/${item.slug}`,
      place: item.venue?.area || t('home.tenali'),
      subtitle: [formatIsoDate(item.startLocal?.slice(0, 10), lang), item.venue?.name].filter(Boolean).join(' • '),
      image: item.bannerImage,
      icon: CalendarDays,
    };
  }
  if (type === 'offer') {
    return {
      to: `/offers/${item.id}`,
      place: item.business?.area || t('home.tenali'),
      subtitle: [item.discountLabel, item.business?.name].filter(Boolean).join(' • '),
      image: item.image,
      icon: TicketPercent,
    };
  }
  return { to: `/news/${item.slug}`, place: t('home.tenali'), subtitle: item.summary, image: item.coverImage, icon: Newspaper };
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Hero carousel overlapping the green header (DOCS/refrence.jpeg), filled from
 * the GET /home banner: pinned news, next events and live offers. Swipe (scroll
 * snap), clickable dots, and it moves on every 4 s. It pauses while touched,
 * hovered or focused, when the tab is hidden, with the pause button (WCAG 2.2.2),
 * and never moves by itself for people who prefer reduced motion.
 */
export function HeroCarousel({ items }) {
  const { t, i18n } = useTranslation();
  const scroller = useRef(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [holding, setHolding] = useState(false); // hover, focus or a recent touch
  const touchTimer = useRef(null);
  const count = items?.length ?? 0;

  const goTo = useCallback((i) => {
    const el = scroller.current;
    if (!el) return;
    const slide = el.children[i];
    if (slide) el.scrollTo({ left: slide.offsetLeft, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, []);

  // Which slide is in view (after a swipe, a dot or the timer).
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setIndex(Number(e.target.dataset.index));
      },
      { root: el, threshold: 0.6 },
    );
    [...el.children].forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [count]);

  // Auto-advance.
  useEffect(() => {
    if (count < 2 || paused || holding) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') goTo((index + 1) % count);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [count, paused, holding, index, goTo]);

  useEffect(() => () => clearTimeout(touchTimer.current), []);

  if (!count) return null;
  const onTouchStart = () => {
    clearTimeout(touchTimer.current);
    setHolding(true);
  };
  const onTouchEnd = () => {
    clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => setHolding(false), RESUME_AFTER_TOUCH_MS);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('home.heroLabel')}
      className="relative z-10 mx-2.5 -mt-10 overflow-hidden rounded-hero shadow-lg"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHolding(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHolding(false)}
      onFocus={() => setHolding(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHolding(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <ul ref={scroller} className="no-scrollbar flex aspect-[2.6/1] max-h-[200px] min-h-[152px] w-full snap-x snap-mandatory overflow-x-auto">
        {items.map((entry, i) => {
          const s = heroSlide(entry, t, i18n.language);
          const Icon = s.icon;
          return (
            <li
              key={`${entry.type}-${entry.item.id}`}
              data-index={i}
              aria-roledescription="slide"
              aria-label={t('home.slideOf', { n: i + 1, total: count })}
              className="relative h-full w-full shrink-0 snap-center"
            >
              <Link to={s.to} className="block h-full w-full focus-visible:ring-inset focus-visible:ring-white" tabIndex={i === index ? 0 : -1}>
                {s.image?.url ? (
                  <img
                    src={cldUrl(s.image.url, { w: 960, h: 400 })}
                    alt=""
                    width={960}
                    height={400}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <span aria-hidden="true" className="absolute inset-0 flex items-start justify-end bg-appbar-green p-5">
                    <Icon className="h-24 w-24 text-white/15" strokeWidth={1.25} />
                  </span>
                )}
                <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.65),rgba(0,0,0,0.1)_60%,transparent)]" />
                <span className="absolute inset-x-0 bottom-0 flex flex-col items-start px-4 pb-8 pr-12 text-white">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[clamp(0.75rem,3.1vw,0.8125rem)] font-medium leading-none">
                    <MapPin className="h-3.5 w-3.5 fill-white text-primary" strokeWidth={2} aria-hidden="true" />
                    {s.place}
                  </span>
                  <span className="mt-1.5 line-clamp-1 text-[clamp(1.125rem,5vw,1.5rem)] font-bold leading-tight [text-shadow:0_1px_3px_rgba(0,0,0,0.35)]">{entry.item.title}</span>
                  {s.subtitle && <span className="line-clamp-1 text-[clamp(0.8125rem,3.4vw,0.875rem)] text-white/90">{s.subtitle}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {count > 1 && (
        <>
          <div className="absolute bottom-2 left-2.5 flex" role="group" aria-label={t('home.slidesLabel')}>
            {items.map((entry, i) => (
              <button
                key={`dot-${entry.type}-${entry.item.id}`}
                type="button"
                onClick={() => goTo(i)}
                aria-label={t('home.showSlide', { n: i + 1, total: count })}
                aria-current={i === index ? 'true' : undefined}
                className="flex h-6 w-[14px] items-center justify-center focus-visible:ring-white"
              >
                <span aria-hidden="true" className={cn('h-2 w-2 rounded-full transition-colors', i === index ? 'bg-white' : 'bg-white/50')} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={t(paused ? 'home.playSlides' : 'home.pauseSlides')}
            className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/45 focus-visible:ring-white"
          >
            {paused ? <Play className="h-4 w-4 fill-white" aria-hidden="true" /> : <Pause className="h-4 w-4 fill-white" aria-hidden="true" />}
          </button>
        </>
      )}
    </section>
  );
}
