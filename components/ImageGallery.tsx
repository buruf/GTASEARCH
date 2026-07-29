import Image from "next/image";

/**
 * A CSS scroll-snap strip. Swipes natively on touch devices with zero
 * JavaScript, and the thumbnails below are anchor links that scroll the strip
 * — so the gallery is fully usable with JS disabled. A desktop lightbox is a
 * later progressive enhancement.
 */
export function ImageGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-card bg-surface-alt text-ink-faint">
        No photos
      </div>
    );
  }

  return (
    <div>
      <div className="snap-strip flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-card">
        {images.map((src, i) => (
          <div
            key={src}
            id={`photo-${i}`}
            // 4:3 on mobile, but a fixed height on desktop: at full column
            // width a 4:3 image runs ~670px tall and pushes the title and price
            // below the fold, which is the first thing a buyer needs to see.
            className="relative aspect-[4/3] w-full shrink-0 snap-center overflow-hidden rounded-card bg-surface-alt lg:aspect-auto lg:h-[440px]"
          >
            <Image
              src={src}
              alt={
                images.length > 1
                  ? `${title} — photo ${i + 1} of ${images.length}`
                  : title
              }
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <li key={src} className="shrink-0">
              <a
                href={`#photo-${i}`}
                className="block h-16 w-20 overflow-hidden rounded-btn border border-line hover:border-brand"
                aria-label={`Go to photo ${i + 1}`}
              >
                <div className="relative h-full w-full bg-surface-alt">
                  <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
