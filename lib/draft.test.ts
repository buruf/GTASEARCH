import { describe, it, expect } from "vitest";
import { firstIncompleteStep, stepPath } from "@/lib/draft";

const base = { category: "electronics", title: "iPhone 13 Pro unlocked", description: "Great condition, 256GB, battery 89%, includes box.", city: "toronto" };

describe("firstIncompleteStep", () => {
  it("empty draft → category", () => {
    expect(firstIncompleteStep({ category: "", title: "", description: "", city: "" })).toBe("category");
  });
  it("category done, no details → details", () => {
    expect(firstIncompleteStep({ ...base, title: "", description: "" })).toBe("details");
  });
  it("details too short still → details", () => {
    expect(firstIncompleteStep({ ...base, title: "abc", description: "short" })).toBe("details");
  });
  it("no city → location", () => {
    expect(firstIncompleteStep({ ...base, city: "" })).toBe("location");
  });
  it("complete draft → review (photos and boost are optional)", () => {
    expect(firstIncompleteStep(base)).toBe("review");
  });
});

describe("stepPath", () => {
  it("category is the wizard root; others are subroutes", () => {
    expect(stepPath("category")).toBe("/post-ad");
    expect(stepPath("review")).toBe("/post-ad/review");
  });
});
