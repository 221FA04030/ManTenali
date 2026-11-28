import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/cn.js';
import vaikuntapuram from '../../../assets/banners/vaikuntapuram.png';
import railwayStation from '../../../assets/banners/tenali-railway-station.png';
import vinayakaStatue from '../../../assets/banners/vinayaka-statue.png';

/** The three Tenali banners (DOCS/banners), in this order. Images are 1774 × 887 (2:1). */
const BANNERS = [
  { key: 'vaikuntapuram', src: vaikuntapuram },
  { key: 'railwayStation', src: railwayStation },
  { key: 'vinayakaStatue', src: vinayakaStatue },
];
const COUNT = BANNERS.length;
const AUTO_MS = 3000;
const SLIDE_MS = 600;
/** A swipe longer than this share of the width moves to the next banner. */
const SWIPE_SHARE = 0.18;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Banner carousel at the top of Home: slides to the next banner every 3 s and
 * loops seamlessly (a copy of the last banner sits before the first and of the
 * first after the last, so 3 → 1 keeps sliding forward instead of jumping
 * back). Swipe left or right; the dots show and choose the banner. It pauses
 * while touched, dragged, hovered or focused and when the tab is hidden, then
 * carries on. People who prefer reduced motion get no automatic sliding.
 */
export function TenaliBannerCarousel() {
  const { t } = useTranslation();
  const frame = useRef(null);
  // Track position: 0 = copy of the last banner, 1..COUNT = banners, COUNT + 1 = copy of the first.
  const [pos, setPos] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [dragPx, setDragPx] = useState(0);
  const [holding, setHolding] = useState(false);
  const drag = useRef(null);
  const active = (pos - 1 + COUNT) % COUNT;
  const onCopy = pos === 0 || pos === COUNT + 1;

  const go = useCallback((next) => {
    setAnimate(!prefersReducedMotion());
    setPos((p) => (p === 0 || p === COUNT + 1 ? p : Math.max(0, Math.min(COUNT + 1, next(p)))));
  }, []);

  // Once a slide onto a copy ends, swap to the real banner without animating.
  const settle = useCallback(() => {
    setPos((p) => {
      if (p !== 0 && p !== COUNT + 1) return p;
      setAnimate(false);
      return p === 0 ? COUNT : 1;
    });
  }, []);
  // Without animation there is no transitionend, so settle straight away.
  useEffect(() => {
    if (onCopy && !animate) settle();
  }, [onCopy, animate, settle]);
  // Turn the animation back on after the silent swap has been painted.
  useEffect(() => {
    if (animate || onCopy || prefersReducedMotion()) return undefined;
    let inner;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setAnimate(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [animate, onCopy]);

  // Auto-advance every 3 s; the timer starts again after every move or interaction.
  useEffect(() => {
    if (holding || prefersReducedMotion()) return undefined;
    const id = setTimeout(() => {
      if (document.visibilityState === 'visible') go((p) => p + 1);
    }, AUTO_MS);
    return () => clearTimeout(id);
  }, [active, holding, go]);

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, horizontal: null };
    setHolding(true);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.horizontal === null && Math.abs(dx) + Math.abs(dy) > 6) {
      d.horizontal = Math.abs(dx) > Math.abs(dy);
      if (d.horizontal) e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (d.horizontal) setDragPx(dx);
  };
  const endDrag = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const width = frame.current?.offsetWidth || 1;
    const dx = d.horizontal ? e.clientX - d.x : 0;
    setDragPx(0);
    if (Math.abs(dx) > width * SWIPE_SHARE) go((p) => p + (dx < 0 ? 1 : -1));
    else setAnimate(!prefersReducedMotion());
    if (e.pointerType !== 'mouse') setHolding(false);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('home.tenaliBanners.label')}
      className="relative z-10 mx-auto -mt-10 w-[calc(100%-1.25rem)] max-w-[48rem]"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHolding(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHolding(false)}
      onFocus={() => setHolding(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHolding(false)}
    >
      <div
        ref={frame}
        className="aspect-[2/1] w-full touch-pan-y select-none overflow-hidden rounded-hero bg-appbar-green shadow-lg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <ul
          className="flex h-full"
          style={{
            transform: `translate3d(calc(${-pos * 100}% + ${dragPx}px), 0, 0)`,
            transition: animate && !dragPx ? `transform ${SLIDE_MS}ms cubic-bezier(0.25, 0.8, 0.25, 1)` : 'none',
          }}
          onTransitionEnd={(e) => e.target === e.currentTarget && settle()}
        >
          {[BANNERS[COUNT - 1], ...BANNERS, BANNERS[0]].map((b, i) => {
            const copy = i === 0 || i === COUNT + 1;
            return (
              <li
                key={copy ? `copy-${i}` : b.key}
                aria-hidden={copy || i !== pos ? 'true' : undefined}
                aria-roledescription={copy ? undefined : 'slide'}
                aria-label={copy ? undefined : t('home.slideOf', { n: i, total: COUNT })}
                className="h-full w-full shrink-0"
              >
                <img
                  src={b.src}
                  alt={copy ? '' : t(`home.tenaliBanners.${b.key}`)}
                  width={1774}
                  height={887}
                  loading={i === 1 ? 'eager' : 'lazy'}
                  decoding="async"
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-2 flex justify-center" role="group" aria-label={t('home.slidesLabel')}>
        {BANNERS.map((b, i) => (
          <button
            key={`dot-${b.key}`}
            type="button"
            onClick={() => go(() => i + 1)}
            aria-label={t('home.showSlide', { n: i + 1, total: COUNT })}
            aria-current={i === active ? 'true' : undefined}
            className="flex h-6 w-5 items-center justify-center"
          >
            <span
              aria-hidden="true"
              className={cn('h-2 rounded-full transition-all duration-300', i === active ? 'w-5 bg-primary' : 'w-2 bg-primary/30')}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
