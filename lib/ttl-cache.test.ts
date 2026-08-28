import { describe, it, expect, vi } from "vitest";
import { memoizeTtl } from "@/lib/ttl-cache";

describe("memoizeTtl", () => {
  it("calls through once, then serves from cache", async () => {
    const fn = vi.fn(async (n: number) => n * 2);
    const memo = memoizeTtl(fn, 60_000);
    expect(await memo(2)).toBe(4);
    expect(await memo(2)).toBe(4);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // A category-scoped call must never be served the directory-wide numbers.
  it("keys by argument", async () => {
    const fn = vi.fn(async (s: string) => s.toUpperCase());
    const memo = memoizeTtl(fn, 60_000);
    expect(await memo("a")).toBe("A");
    expect(await memo("b")).toBe("B");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("re-runs once the ttl has passed", async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn(async () => Date.now());
      const memo = memoizeTtl(fn, 1_000);
      await memo();
      vi.advanceTimersByTime(1_500);
      await memo();
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  // The point of the fix: a burst of concurrent requests must not each start
  // their own copy of the expensive query.
  it("shares one in-flight promise across concurrent callers", async () => {
    let resolve: (v: number) => void = () => {};
    const fn = vi.fn(() => new Promise<number>((r) => { resolve = r; }));
    const memo = memoizeTtl(fn, 60_000);
    const all = Promise.all([memo(), memo(), memo()]);
    resolve(7);
    expect(await all).toEqual([7, 7, 7]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // A failure must not be cached, or one blip would persist for the whole TTL.
  it("does not cache a rejection", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");
    const memo = memoizeTtl(fn as () => Promise<string>, 60_000);
    await expect(memo()).rejects.toThrow("boom");
    await expect(memo()).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("memoizeTtl clear", () => {
  it("forgets everything, so a test can assert against fresh data", async () => {
    let n = 0;
    const memo = memoizeTtl(async () => ++n, 60_000);
    expect(await memo()).toBe(1);
    expect(await memo()).toBe(1);
    memo.clear();
    expect(await memo()).toBe(2);
  });
});
