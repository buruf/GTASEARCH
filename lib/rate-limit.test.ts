import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, resetRateLimiter, MAX_KEYS } from "@/lib/rate-limit";

beforeEach(() => resetRateLimiter());

describe("rateLimit", () => {
  it("allows up to the limit then refuses", () => {
    const t = 1_000_000;
    expect(rateLimit("k", 3, 60_000, t)).toBe(true);
    expect(rateLimit("k", 3, 60_000, t + 1)).toBe(true);
    expect(rateLimit("k", 3, 60_000, t + 2)).toBe(true);
    expect(rateLimit("k", 3, 60_000, t + 3)).toBe(false);
  });

  it("window slides: old hits expire", () => {
    const t = 1_000_000;
    rateLimit("k", 2, 1_000, t);
    rateLimit("k", 2, 1_000, t + 10);
    expect(rateLimit("k", 2, 1_000, t + 20)).toBe(false);
    expect(rateLimit("k", 2, 1_000, t + 1_011)).toBe(true);
  });

  it("keys are independent", () => {
    const t = 1_000_000;
    expect(rateLimit("a", 1, 60_000, t)).toBe(true);
    expect(rateLimit("b", 1, 60_000, t)).toBe(true);
    expect(rateLimit("a", 1, 60_000, t + 1)).toBe(false);
  });

  it("a refused call does not consume quota", () => {
    const t = 1_000_000;
    rateLimit("k", 1, 1_000, t);
    rateLimit("k", 1, 1_000, t + 1); // refused
    expect(rateLimit("k", 1, 1_000, t + 1_001)).toBe(true);
  });

  it("enforces a hard cap on distinct keys even when all of them are still active", () => {
    const t = 1_000_000;
    const bigWindow = 1_000_000_000; // nothing expires naturally during this test

    // Fill the map to exactly MAX_KEYS with distinct, still-active keys.
    for (let i = 0; i < MAX_KEYS; i++) {
      expect(rateLimit(`cap-${i}`, 1, bigWindow, t + i)).toBe(true);
    }

    // One more distinct key pushes the map over the cap. Since none of the
    // existing keys are actually expired, a real bound must fall back to
    // evicting the stalest key (oldest most-recent-hit) — here, "cap-0".
    expect(rateLimit("cap-overflow", 1, bigWindow, t + MAX_KEYS)).toBe(true);

    // "cap-0" should have been evicted to keep the map within MAX_KEYS, so its
    // quota was reset and this call is allowed again even though, if it were
    // still tracked, its still-active hit would refuse this call.
    expect(rateLimit("cap-0", 1, bigWindow, t + MAX_KEYS + 1)).toBe(true);
  });

  it("does not let a short-window sweep wrongly clear an active long-window key", () => {
    const t0 = 1_000_000;
    const oneHour = 3_600_000;
    const oneDay = 86_400_000;

    // A key on a 24h window records its one allowed hit.
    expect(rateLimit("long-lived-key", 1, oneDay, t0)).toBe(true);

    // A batch of short-window keys registered shortly after t0. By the time
    // the map is swept (~2h later, below), these will be genuinely expired
    // under their OWN 1h window — they exist purely to be cleaned up by the
    // expired-key pass without needing to fall back to stalest-eviction.
    const staleCount = MAX_KEYS / 2;
    for (let i = 0; i < staleCount; i++) {
      rateLimit(`stale-short-${i}`, 1, oneHour, t0 + 1_000 + i);
    }

    // Jump forward ~2h (past the stale batch's 1h window, well within the
    // long-lived key's 24h window) and register fresh short-window keys,
    // filling the map past MAX_KEYS to trigger a sweep.
    const tLate = t0 + 2 * oneHour;
    const freshCount = MAX_KEYS / 2;
    for (let i = 0; i < freshCount; i++) {
      rateLimit(`fresh-short-${i}`, 1, oneHour, tLate + i);
    }

    // The sweep was triggered by 1h-window calls, but the 24h-window key's
    // single hit (30-90 minutes into its 24h window at this point) must
    // survive: it is far from expired under its OWN window, regardless of
    // the short window used by whichever call happened to trigger the sweep.
    // A refusal here proves the hit is still tracked (quota not reset).
    expect(rateLimit("long-lived-key", 1, oneDay, tLate + freshCount)).toBe(
      false,
    );
  });
});
