// Star rating display. Inline SVG (no icon font, no extra request) and always
// accompanied by the number of reviews wherever it is used — an average with
// no count is the easiest way to mislead, since "5.0" from one review looks
// identical to "5.0" from two hundred.

export function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  const rounded = Math.round(rating * 2) / 2; // nearest half
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = rounded >= i ? 1 : rounded >= i - 0.5 ? 0.5 : 0;
        return (
          <svg key={i} viewBox="0 0 20 20" className="h-4 w-4">
            <defs>
              <linearGradient id={`half-${i}`}>
                <stop offset="50%" stopColor="#F5A623" />
                <stop offset="50%" stopColor="#E0E0E0" />
              </linearGradient>
            </defs>
            <path
              d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2l-4.94 2.6.94-5.5-4-3.9 5.53-.8z"
              fill={fill === 1 ? "#F5A623" : fill === 0.5 ? `url(#half-${i})` : "#E0E0E0"}
            />
          </svg>
        );
      })}
    </span>
  );
}

/** Screen-reader-friendly summary, e.g. "Rated 4.5 out of 5 from 12 reviews". */
export function ratingLabel(rating: number | null, count: number): string {
  if (rating === null || count === 0) return "No reviews yet";
  return `Rated ${rating} out of 5 from ${count} ${count === 1 ? "review" : "reviews"}`;
}
