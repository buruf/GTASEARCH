// Brand logo: the CN Tower inside a map pin, beside the two-tone wordmark.
// The pin silhouette carries the "local / find it here" meaning that a plain
// rounded tile did not, and the tower keeps it unmistakably Toronto. Kept as
// one solid shape with knocked-out white detail so it survives being scaled
// down to a 16px favicon. Inline SVG: crisp at any size, no image request.
// app/icon.svg carries the same mark — change them together.

export function LogoTile({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 72 72"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Pin: circular head over a tapered point, drawn as one path so there
          is no seam where the two meet at small sizes. */}
      <path
        d="M36 4a26 26 0 0 0-26 26c0 17.5 20.6 34.4 24.4 37.4a2.5 2.5 0 0 0 3.2 0C41.4 64.4 62 47.5 62 30A26 26 0 0 0 36 4z"
        fill="#2E7D32"
      />
      {/* CN Tower, knocked out in white inside the pin head. */}
      <line
        x1="36" y1="11" x2="36" y2="17"
        stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round"
      />
      <ellipse cx="36" cy="23" rx="8.5" ry="3.8" fill="#ffffff" />
      <rect x="34" y="25.5" width="4" height="21" fill="#ffffff" />
      <path d="M28.5 49 L36 39 L43.5 49 Z" fill="#ffffff" />
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
