// Inline SVG icons, one per category. Inline rather than an icon library so
// there is no extra request, no JavaScript, and no render-blocking font — all
// of which matter for the mobile performance target.

interface Props {
  name: string;
  className?: string;
}

const paths: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-6h5v6" />,
  car: (
    <>
      <path d="M3 13.5h18M5.5 13.5 7 8.5a2 2 0 0 1 1.9-1.4h6.2A2 2 0 0 1 17 8.5l1.5 5" />
      <path d="M4 13.5h16v4H4zM7 17.5v2M17 17.5v2" />
      <circle cx="7.5" cy="15.5" r=".9" />
      <circle cx="16.5" cy="15.5" r=".9" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 12.5h18" />
    </>
  ),
  device: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  sofa: (
    <>
      <path d="M4 11V8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5V11" />
      <path d="M3 11.5a2 2 0 0 1 2 2V17h14v-3.5a2 2 0 1 1 2 0V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4.5a2 2 0 0 1 0-2z" />
      <path d="M6.5 11h11" />
    </>
  ),
  shirt: (
    <path d="M8 3.5 5 5.5 3.5 9l2.5 1.2V20h12v-9.8L20.5 9 19 5.5l-3-2-1.5 1.5a3 3 0 0 1-5 0z" />
  ),
  tools: (
    <>
      <path d="M14.5 6.5a3.5 3.5 0 0 0 4.6 4.6l-8 8a2.1 2.1 0 0 1-3-3z" />
      <path d="m5.5 4 2.5 2.5M4 8.5 7 6" />
    </>
  ),
  paw: (
    <>
      <ellipse cx="7" cy="9" rx="1.8" ry="2.3" />
      <ellipse cx="12" cy="7.5" rx="1.8" ry="2.3" />
      <ellipse cx="17" cy="9" rx="1.8" ry="2.3" />
      <path d="M12 12c-2.5 0-4.5 2-4.5 4.2 0 1.6 1.3 2.6 2.9 2.3 1-.2 2.2-.2 3.2 0 1.6.3 2.9-.7 2.9-2.3C16.5 14 14.5 12 12 12z" />
    </>
  ),
  stroller: (
    <>
      <path d="M4 5h2l2.5 8H18a3 3 0 0 0 3-3V8a5 5 0 0 0-5-5h-1" />
      <path d="M8.5 13 7 17h11" />
      <circle cx="8.5" cy="19" r="1.6" />
      <circle cx="17" cy="19" r="1.6" />
    </>
  ),
  bike: (
    <>
      <circle cx="6" cy="16.5" r="3.5" />
      <circle cx="18" cy="16.5" r="3.5" />
      <path d="m6 16.5 4-8h5l3 8M10 8.5h5.5M9 16.5h5" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="9.5" width="17" height="4" rx="1" />
      <path d="M5 13.5V20h14v-6.5M12 9.5V20" />
      <path d="M12 9.5S10.5 4 8 4a2 2 0 0 0 0 5.5zM12 9.5S13.5 4 16 4a2 2 0 0 1 0 5.5z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17 14.2a5.5 5.5 0 0 1 3.5 4.8" />
    </>
  ),

  // Business directory categories (Phase 5A).
  utensils: (
    <>
      <path d="M7 3v6a1.5 1.5 0 0 0 3 0V3" />
      <path d="M8.5 9v12" />
      <path d="M16.5 3c-1.8 1.6-2.5 4-2.5 6.3 0 2 1 3.2 2.5 3.2v8.5" />
    </>
  ),
  cross: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  wrench: (
    <>
      <path d="M14.5 6.5a3.5 3.5 0 0 0 4.6 4.6l-8 8a2.1 2.1 0 0 1-3-3z" />
      <path d="m5.5 4 2.5 2.5M4 8.5 7 6" />
    </>
  ),
  scissors: (
    <>
      <circle cx="7" cy="6" r="2.2" />
      <circle cx="7" cy="18" r="2.2" />
      <path d="M8.7 7.5 19 17M8.7 16.5 19 6.5" />
    </>
  ),
  bag: (
    <>
      <path d="M6 8h12l-1 12H7z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5c-1.6-1-4-1.5-8-1.5v13c4 0 6.4.5 8 1.5V6.5z" />
      <path d="M12 6.5c1.6-1 4-1.5 8-1.5v13c-4 0-6.4.5-8 1.5V6.5z" />
    </>
  ),
  dumbbell: (
    <>
      <rect x="2.5" y="9" width="3" height="6" rx="1" />
      <rect x="18.5" y="9" width="3" height="6" rx="1" />
      <path d="M6 9v6M18 9v6M6 12h12" />
    </>
  ),
};

export function CategoryIcon({ name, className = "h-6 w-6" }: Props) {
  const d = paths[name];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {d}
    </svg>
  );
}
