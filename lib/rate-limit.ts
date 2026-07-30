// In-memory sliding-window limiter. Per-instance only — the same acknowledged
// stopgap as eduyro's; Redis/Upstash is the known upgrade path. Good enough to
// blunt casual abuse of register / forgot-password / publish.
//
// MAX_KEYS is a real hard bound on the number of distinct keys tracked, not
// just a trigger for best-effort cleanup: once over the cap, expired keys are
// swept first (each judged by ITS OWN windowMs, so a sweep triggered by a
// short-window caller can never mistake a still-active long-window key for
// expired), and if the map is still over the cap the stalest keys (oldest
// most-recent-hit) are evicted — even if still active — until back within
// bound.

interface Bucket {
  hits: number[];
  windowMs: number;
}

const buckets = new Map<string, Bucket>();
export const MAX_KEYS = 10_000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  const cutoff = now - windowMs;
  const hits = (buckets.get(key)?.hits ?? []).filter((t) => t > cutoff);

  if (hits.length >= limit) {
    buckets.set(key, { hits, windowMs });
    return false;
  }

  hits.push(now);
  buckets.set(key, { hits, windowMs });

  if (buckets.size > MAX_KEYS) sweep(now);
  return true;
}

// Enforce MAX_KEYS as a real bound: first drop keys that are genuinely
// expired under their own window, then — if still over the cap — evict the
// stalest keys regardless of expiry, so the map can never grow unbounded.
function sweep(now: number): void {
  for (const [k, b] of buckets) {
    const ownCutoff = now - b.windowMs;
    if (b.hits.every((t) => t <= ownCutoff)) buckets.delete(k);
  }

  if (buckets.size > MAX_KEYS) {
    const stalestFirst = [...buckets.entries()].sort((a, b) => {
      const lastA = a[1].hits[a[1].hits.length - 1] ?? -Infinity;
      const lastB = b[1].hits[b[1].hits.length - 1] ?? -Infinity;
      return lastA - lastB;
    });
    const excess = buckets.size - MAX_KEYS;
    for (let i = 0; i < excess; i++) buckets.delete(stalestFirst[i][0]);
  }
}

export function resetRateLimiter(): void {
  buckets.clear();
}
