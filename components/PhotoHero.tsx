import Image from "next/image";
import heroPhoto from "@/public/toronto-hero.jpg";

/**
 * The site's one hero treatment: the owner's own aerial photograph of downtown
 * Toronto, taken from a plane (so there is no licence question and no
 * attribution to carry — see /data-sources, and ask before ever swapping it
 * for stock).
 *
 * Extracted from app/page.tsx so /classifieds can use it too. Until now the
 * directory sat on this photograph and classifieds sat on an illustrated SVG
 * skyline over a pale blue gradient — the pre-pivot design, which nobody
 * updated when the directory took over `/`. Moving between the two sections
 * looked like moving between two different websites, which is exactly the
 * impression a directory trying to be believed cannot afford.
 *
 * Everything about the framing and the scrim below was measured rather than
 * eyeballed; the comments record why, because each value has a failure mode
 * on the other side of it.
 */
export function PhotoHero({
  children,
  /** Inner padding. The directory hero carries a stats strip and chips below
   *  its search box and so needs more room than the classifieds one. */
  className = "pb-16 pt-10 sm:pb-20 sm:pt-14",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-[#0B1F2E]">
      <Image
        src={heroPhoto}
        alt=""
        fill
        priority
        sizes="100vw"
        placeholder="blur"
        // 55, not the 75 default, because this image is viewed through a
        // 60% black scrim that hides the compression artefacts which would
        // make 55 unacceptable on a photo shown plainly.
        //
        // It does NOT buy back the Lighthouse score, and it was wrong of me
        // to assume it would: measured on production, mobile performance is
        // 98 with LCP 2.3s at BOTH q=55 and q=72. The remaining half-second
        // is the round trip for an above-the-fold image at all, not its
        // weight. Kept anyway on the honest ground it does help — 69KB
        // versus 82KB at 828w, ~16% less to pull on a slow connection, even
        // though the score bucket does not move.
        quality={55}
        // Framing, worked out from the source rather than by eye. The hero
        // band is ~3.4:1 and the photo is 4:3, so object-cover shows only
        // about 39% of the image's height. In the original the CN Tower
        // spans roughly 31–51% down and the downtown core 39–59%; anchoring
        // at 65% put the visible window at 45–85%, which cut the tower off
        // at the top edge and filled the band with the residential grid.
        // 42% centres the window on the skyline itself.
        className="object-cover object-[center_42%]"
      />
      <div
        aria-hidden="true"
        // 60% is the floor, not a preference: against the brightest thing
        // the crop can put behind the subhead, it holds white text at about
        // 5.7:1, where 55% measured ~3.96:1 and failed the 4.5:1 AA floor.
        // Worst-case is the right test because the crop — and so what sits
        // behind the text — changes with every viewport.
        //
        // The top stop was 75%, which buried the photo: the whole point of
        // real photography is that you can tell it is Toronto. Dropped to
        // 60% so the lake and skyline read, which is safe because the only
        // thing up there is the h1, and large bold text needs 3:1, not 4.5.
        className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/60 to-black/70"
      />
      <div className={`relative mx-auto max-w-5xl px-4 text-center ${className}`}>
        {children}
      </div>
    </section>
  );
}
