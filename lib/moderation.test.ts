import { describe, it, expect } from "vitest";
import { violatesModeration } from "@/lib/moderation";

describe("violatesModeration", () => {
  it("flags a banned word", () => {
    expect(violatesModeration("cheap cocaine for sale")).toBe(true);
  });
  it("is case-insensitive", () => {
    expect(violatesModeration("Buy COCAINE now")).toBe(true);
  });
  it("catches simple leet-speak", () => {
    expect(violatesModeration("selling c0ca1ne cheap")).toBe(true);
  });
  it("respects word boundaries — 'class' must not trip 'ass'", () => {
    expect(violatesModeration("world class sofa in great condition")).toBe(false);
  });
  it("'Scunthorpe'-style substrings do not trip", () => {
    expect(violatesModeration("vintage assorted glassware")).toBe(false);
  });
  it("clean text passes", () => {
    expect(violatesModeration("Brown leather sectional sofa, excellent condition")).toBe(false);
  });
  it("purely numeric token must not leet-decode into a banned word — engine displacement", () => {
    expect(violatesModeration("Selling Olds 455 engine")).toBe(false);
  });
  it("purely numeric/symbol tokens (price, displacement) must not trip", () => {
    expect(violatesModeration("350 small block, $4500 obo")).toBe(false);
  });
  it("mixed alnum leet-speak still trips — 'c0ca1ne'", () => {
    expect(violatesModeration("c0ca1ne")).toBe(true);
  });
  it("mixed alnum leet-speak still trips — 's3x' style token", () => {
    expect(violatesModeration("looking for s3x toys")).toBe(true);
  });
});
