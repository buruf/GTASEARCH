import { describe, it, expect } from "vitest";
import { BOOST_TIERS, isBoostTierKey, effectiveBoostOf } from "@/lib/boost";

describe("BOOST_TIERS", () => {
  it("matches the product brief exactly", () => {
    expect(BOOST_TIERS.top).toMatchObject({ cents: 499, days: 7, level: "top" });
    expect(BOOST_TIERS.featured).toMatchObject({ cents: 999, days: 14, level: "featured" });
    expect(BOOST_TIERS.super).toMatchObject({ cents: 1499, days: 30, level: "super" });
  });
  it("isBoostTierKey guards hostile input", () => {
    expect(isBoostTierKey("super")).toBe(true);
    expect(isBoostTierKey("free")).toBe(false);
    expect(isBoostTierKey("constructor")).toBe(false);
  });
});

describe("effectiveBoostOf — must match lib/search.ts SQL CASE truth table", () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);
  it("live boosts rank 0/1/2", () => {
    expect(effectiveBoostOf("super", future)).toBe(0);
    expect(effectiveBoostOf("featured", future)).toBe(1);
    expect(effectiveBoostOf("top", future)).toBe(2);
  });
  it("null expiry, past expiry, none, and unknown levels all rank 3", () => {
    expect(effectiveBoostOf("super", null)).toBe(3);
    expect(effectiveBoostOf("super", past)).toBe(3);
    expect(effectiveBoostOf("none", future)).toBe(3);
    expect(effectiveBoostOf("gold", future)).toBe(3);
  });
  it("expiry exactly now ranks 3 (SQL uses <=)", () => {
    const now = new Date();
    expect(effectiveBoostOf("super", now, now)).toBe(3);
  });
});
