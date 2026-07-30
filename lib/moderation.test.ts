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
});
