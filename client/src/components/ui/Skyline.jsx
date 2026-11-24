/**
 * Decorative Tenali skyline silhouette (temple gopurams, clock tower, palms,
 * town buildings). Original vector placeholder until the owner supplies art
 * (spec U3). Purely decorative - hidden from assistive tech.
 */
export function Skyline({ className }) {
  const fill = '#0F5A2A';
  const light = '#1E7A3B';
  return (
    <svg
      className={className}
      viewBox="0 0 400 90"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      {/* distant buildings */}
      <g fill={light} opacity="0.55">
        <rect x="40" y="58" width="22" height="32" />
        <rect x="66" y="50" width="16" height="40" />
        <rect x="150" y="54" width="26" height="36" />
        <rect x="214" y="52" width="20" height="38" />
        <rect x="250" y="60" width="30" height="30" />
        <rect x="318" y="56" width="18" height="34" />
      </g>
      <g fill={fill}>
        {/* left gopuram */}
        <path d="M96 90V62h4v-6h3v-7h3v-8h3v-8h3v-6h2v-5h2l1-4 1 4h2v5h2v6h3v8h3v8h3v7h3v6h4v28z" />
        {/* clock tower */}
        <path d="M196 90V50h-3l4-5V30h-2l7-10 7 10h-2v15l4 5h-3v40z" />
        <circle cx="203" cy="38" r="3" fill="#CDEFD2" />
        {/* right gopuram (tallest) */}
        <path d="M300 90V58h5v-8h3v-9h3v-9h3v-8h3v-7h2v-5h2l1-5 1 5h2v5h2v7h3v8h3v9h3v9h3v8h5v32z" />
        {/* row of town buildings */}
        <path d="M0 90V74h10v-6h8v6h14v-8h10v24z" />
        <path d="M132 90V70h8v-5h10v5h8v20z" />
        <path d="M232 90V72h12v-6h4v6h10v18z" />
        <path d="M352 90V70h10v-4h8v4h12v-6h18v26z" />
        {/* palms */}
        <g>
          <rect x="22" y="56" width="2.5" height="34" />
          <path d="M23 56c-8-2-14 2-16 6 6-3 11-4 16-6zm0 0c8-2 14 2 16 6-6-3-11-4-16-6zm0 0c-3-6-9-8-13-7 5 1 9 3 13 7zm0 0c3-6 9-8 13-7-5 1-9 3-13 7z" />
          <rect x="176" y="60" width="2.5" height="30" />
          <path d="M177 60c-7-2-12 2-14 5 5-2 10-3 14-5zm0 0c7-2 12 2 14 5-5-2-10-3-14-5zm0 0c-3-5-8-7-11-6 4 1 8 3 11 6zm0 0c3-5 8-7 11-6-4 1-8 3-11 6z" />
          <rect x="284" y="58" width="2.5" height="32" />
          <path d="M285 58c-8-2-13 2-15 6 6-3 10-4 15-6zm0 0c8-2 13 2 15 6-6-3-10-4-15-6zm0 0c-3-6-9-8-12-7 4 1 8 3 12 7zm0 0c3-6 9-8 12-7-4 1-8 3-12 7z" />
          <rect x="384" y="54" width="2.5" height="36" />
          <path d="M385 54c-8-2-13 2-15 6 6-3 10-4 15-6zm0 0c8-2 13 2 15 6-6-3-10-4-15-6zm0 0c-3-6-9-8-12-7 4 1 8 3 12 7z" />
        </g>
      </g>
    </svg>
  );
}
