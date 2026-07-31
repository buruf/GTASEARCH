// Brand logo: green app-icon tile with a white CN Tower, beside the two-tone
// wordmark. The tile is inline SVG so it stays crisp at any size with no
// image request; the wordmark is real text so it uses the site font and
// scales with the header. app/icon.svg carries the same tile as the favicon —
// change them together.

export function LogoTile({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 72 72"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="4" width="64" height="64" rx="14" fill="#2E7D32" />
      <line
        x1="36" y1="12" x2="36" y2="20"
        stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round"
      />
      <ellipse cx="36" cy="27" rx="10" ry="4.5" fill="#ffffff" />
      <rect x="33.5" y="30" width="5" height="26" fill="#ffffff" />
      <path d="M26 60 L36 48 L46 60 Z" fill="#ffffff" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoTile />
      {/* Two-tone in dark greens: brand-light (#66BB6A) fails WCAG contrast
          as text on white (2.2:1), so the split is dark-vs-mid instead. */}
      <span className="text-xl font-extrabold tracking-tight text-brand-dark sm:text-2xl">
        GTA<span className="text-brand">Search</span>
      </span>
    </span>
  );
}
