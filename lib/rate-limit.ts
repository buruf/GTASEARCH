// In-memory sliding-window limiter. Per-instance only — the same acknowledged
// stopgap as eduyro's; Redis/Upstash is the known upgrade path. Good enough to
// blunt casual abuse of register / forgot-password / publish.

const buckets = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }

  hits.push(now);
  buckets.set(key, hits);

  // TTL eviction so the map cannot grow without bound.
  if (buckets.size > MAX_KEYS) {
    for (const [k, v] of buckets) {
      if (v.every((t) => t <= cutoff)) buckets.delete(k);
    }
  }
  return true;
}

export function resetRateLimiter(): void {
  buckets.clear();
}
