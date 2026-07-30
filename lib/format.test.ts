import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { formatPrice, formatRelativeTime, truncateSnippet, formatUnreadCount } from "@/lib/format";

describe("formatPrice", () => {
  it("formats whole dollars in CAD without cents", () => {
    expect(formatPrice(850, "fixed")).toBe("$850");
    expect(formatPrice(1249000, "fixed")).toBe("$1,249,000");
  });

  it("keeps cents when the amount is not whole", () => {
    expect(formatPrice(4.99, "fixed")).toBe("$4.99");
  });

  it("accepts numeric strings", () => {
    expect(formatPrice("2950", "fixed")).toBe("$2,950");
  });

  // Regression: Prisma returns price as a Decimal instance, not a primitive.
  // An earlier version type-checked for string and rendered every real price
  // on the site as "Please contact".
  it("accepts a Prisma Decimal instance", () => {
    expect(formatPrice(new Prisma.Decimal(2950), "fixed")).toBe("$2,950");
    expect(formatPrice(new Prisma.Decimal("1249000.00"), "fixed")).toBe(
      "$1,249,000",
    );
    expect(formatPrice(new Prisma.Decimal("4.99"), "fixed")).toBe("$4.99");
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

describe("truncateSnippet", () => {
  it("passes short text through unchanged", () => {
    expect(truncateSnippet("Is this available?")).toBe("Is this available?");
  });
  it("collapses newlines to spaces", () => {
    expect(truncateSnippet("line one\nline two")).toBe("line one line two");
  });
  it("truncates at the limit with an ellipsis", () => {
    const out = truncateSnippet("a".repeat(200), 120);
    expect(out.length).toBe(121); // 120 + ellipsis char
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("formatUnreadCount", () => {
  it("returns null for zero", () => expect(formatUnreadCount(0)).toBeNull());
  it("passes small counts through", () => expect(formatUnreadCount(4)).toBe("4"));
  it("caps at 9+", () => expect(formatUnreadCount(23)).toBe("9+"));
});
