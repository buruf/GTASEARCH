/**
 * A tiny in-process cache with a time-to-live.
 *
 * Deliberately NOT next/cache's unstable_cache: that throws "incrementalCache
 * missing" whenever it is called outside a Next request context, which would
 * break the integration tests and any maintenance script that imports the
 * wrapped function. A plain module-level map has no such coupling and works
 * identically in a page, a test and a script.
 *
 * On serverless this caches per warm instance rather than globally, which is
 * the right trade here: the goal is to stop one page re-running the same
 * expensive aggregate on every request through a pool with connection_limit=1,
 * not to build a shared cache tier.
 *
 * For values that must never be stale — anything a user just changed — do not
 * use this. It is for counts that only move when an importer runs.
 */
interface Entry<T> {
  value: T;
  expires: number;
}

export interface Memoized<A extends unknown[], T> {
  (...args: A): Promise<T>;
  /**
   * Drops everything cached. Tests that mutate data and then assert on a
   * cached aggregate must call this first, otherwise they assert against
   * numbers from before their own fixtures existed — a trap that passes by
   * luck until someone reorders the tests.
   */
  clear(): void;
}

export function memoizeTtl<A extends unknown[], T>(
  fn: (...args: A) => Promise<T>,
  ttlMs: number,
  keyOf: (...args: A) => string = (...args) => JSON.stringify(args),
): Memoized<A, T> {
  const cache = new Map<string, Entry<T>>();
  // In-flight requests share one promise, so a burst of concurrent callers
  // does not each start their own copy of an expensive query — which is the
  // exact failure being fixed.
  const inflight = new Map<string, Promise<T>>();

  const memo = async (...args: A): Promise<T> => {
    const key = keyOf(...args);
    const now = Date.now();

    const hit = cache.get(key);
    if (hit && hit.expires > now) return hit.value;

    const pending = inflight.get(key);
    if (pending) return pending;

    const promise = fn(...args)
      .then((value) => {
        cache.set(key, { value, expires: Date.now() + ttlMs });
        return value;
      })
      .finally(() => {
        inflight.delete(key);
      });

    inflight.set(key, promise);
    return promise;
  };

  memo.clear = () => {
    cache.clear();
    inflight.clear();
  };

  return memo;
}
