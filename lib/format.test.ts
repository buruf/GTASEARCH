import { describe, it, expect } from "vitest";
import { formatPrice, formatRelativeTime } from "@/lib/format";

describe("formatPrice", () => {
  it("formats whole dollars in CAD without cents", () => {
    expect(formatPrice(850, "fixed")).toBe("$850");
    expect(formatPrice(1249000, "fixed")).toBe("$1,249,000");
  });

  it("keeps cents when the amount is not whole", () => {
    expect(formatPrice(4.99, "fixed")).toBe("$4.99");
  });

  it("accepts Decimal values arriving from Prisma as strings", () => {
    expect(formatPrice("2950", "fixed")).toBe("$2,950");
  });

  it("renders non-fixed price types as words, ignoring any price", () => {
    expect(formatPrice(null, "free")).toBe("Free");
    expect(formatPrice(null, "contact")).toBe("Please contact");
    expect(formatPrice(null, "trade")).toBe("Trade");
    // A stale price on a free listing must not leak a dollar amount.
    expect(formatPrice(500, "free")).toBe("Free");
  });

  it("degrades to 'Please contact' rather than showing NaN", () => {
    expect(formatPrice("not-a-number", "fixed")).toBe("Please contact");
    expect(formatPrice(null, "fixed")).toBe("Please contact");
    expect(formatPrice(undefined, "fixed")).toBe("Please contact");
  });
});

describe("formatRelativeTime", () => {
  const ago = (ms: number) => new Date(Date.now() - ms);

  it("describes recent times", () => {
    expect(formatRelativeTime(ago(5_000))).toBe("Just now");
    expect(formatRelativeTime(ago(60_000))).toBe("1 minute ago");
    expect(formatRelativeTime(ago(120_000))).toBe("2 minutes ago");
  });

  it("switches units as the gap widens", () => {
    expect(formatRelativeTime(ago(3 * 3600_000))).toBe("3 hours ago");
    expect(formatRelativeTime(ago(2 * 86400_000))).toBe("2 days ago");
    expect(formatRelativeTime(ago(10 * 86400_000))).toBe("1 week ago");
    expect(formatRelativeTime(ago(45 * 86400_000))).toBe("1 month ago");
  });

  it("singularises correctly", () => {
    expect(formatRelativeTime(ago(86400_000))).toBe("1 day ago");
  });
});
