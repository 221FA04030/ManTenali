import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Decorative clock-tower illustration used until owner-supplied banner art exists (U3). */
function TowerArt() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true" focusable="false">
      <circle cx="78" cy="40" r="26" fill="#FDE68A" opacity="0.25" />
      <g fill="#E8C9A0">
        <rect x="66" y="40" width="20" height="70" rx="2" />
        <path d="M62 40h28l-14-22z" />
      </g>
      <circle cx="76" cy="52" r="6" fill="#fff" />
      <path d="M76 48v4l3 2" stroke="#166534" strokeWidth="1.5" fill="none" />
      <g fill="#0F5A2A">
        <rect x="100" y="70" width="2.5" height="40" />
        <path d="M101 70c-8-2-13 2-15 6 6-3 10-4 15-6zm0 0c8-2 13 2 15 6-6-3-10-4-15-6zm0 0c-3-6-9-8-12-7 4 1 8 3 12 7z" />
        <rect x="40" y="78" width="2.5" height="32" />
        <path d="M41 78c-7-2-12 2-14 5 5-2 10-3 14-5zm0 0c7-2 12 2 14 5-5-2-10-3-14-5z" />
        <rect x="0" y="104" width="120" height="16" />
      </g>
    </svg>
  );
}

/** Green promo banner card ("What's Happening in Tenali?"). */
export function Banner({ title, subtitle, eyebrow, ctaLabel, to, imageUrl, imageAlt = '' }) {
  return (
    <div className="relative flex min-h-[150px] overflow-hidden rounded-card bg-banner-green text-white shadow-lift">
      <div className="relative z-10 flex flex-1 flex-col justify-center gap-1.5 p-5 pr-2">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{eyebrow}</p>}
        <h3 className="line-clamp-3 text-xl font-bold leading-tight">{title}</h3>
        {subtitle && <p className="line-clamp-2 text-sm text-white/90">{subtitle}</p>}
        {to && ctaLabel && (
          <Link
            to={to}
            className="mt-2 inline-flex min-h-[40px] w-fit items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-brand-800 shadow-sm hover:bg-brand-50"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="relative w-[38%] shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={imageAlt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <TowerArt />
        )}
        <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-brand-700 to-transparent" />
      </div>
    </div>
  );
}
