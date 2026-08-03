import { describe, it, expect } from "vitest";
import {
  FREE_PHOTO_LIMIT,
  PRO_PHOTO_LIMIT,
  PRO_PRICE_CENTS,
  isPro,
  photoLimitFor,
} from "@/lib/plans";

describe("plans", () => {
  it("prices Pro at $19 CAD/month", () => {
    expect(PRO_PRICE_CENTS).toBe(1900);
  });

  it("gives Pro a higher photo ceiling without gating the basics", () => {
    expect(photoLimitFor("free")).toBe(FREE_PHOTO_LIMIT);
    expect(photoLimitFor("pro")).toBe(PRO_PHOTO_LIMIT);
    expect(PRO_PHOTO_LIMIT).toBeGreaterThan(FREE_PHOTO_LIMIT);
    // A free claimed listing must still be able to show photos at all —
    // charging for basic accuracy is the thing we said we would not do.
    expect(FREE_PHOTO_LIMIT).toBeGreaterThan(0);
  });

  it("treats an unknown plan as free rather than as paid", () => {
    expect(photoLimitFor("")).toBe(FREE_PHOTO_LIMIT);
    expect(photoLimitFor("enterprise")).toBe(FREE_PHOTO_LIMIT);
  });

  describe("isPro", () => {
    const future = new Date("2026-09-01T00:00:00Z");
    const past = new Date("2026-07-01T00:00:00Z");
    const now = new Date("2026-08-03T00:00:00Z");

    it("is true only while the paid period is still running", () => {
      expect(isPro("pro", future, now)).toBe(true);
      expect(isPro("pro", past, now)).toBe(false);
    });

    it("is false for a free plan whatever the date says", () => {
      expect(isPro("free", future, now)).toBe(false);
    });

    it("is false when there is no renewal date at all", () => {
      // Belt and braces for a webhook we never received: without a period end
      // there is no evidence anybody paid, so do not grant benefits.
      expect(isPro("pro", null, now)).toBe(false);
    });
  });
});
