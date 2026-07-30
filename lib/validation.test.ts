import { describe, it, expect } from "vitest";
import {
  RegisterSchema, DetailsStepSchema, LocationStepSchema, PhotosStepSchema,
  MessageSchema, ReportSchema,
} from "@/lib/validation";

describe("RegisterSchema", () => {
  const ok = { firstName: "Amina", lastName: "Hassan", email: "A@B.co", password: "longenough", confirm: "longenough" };
  it("accepts valid input and lowercases email", () => {
    const r = RegisterSchema.parse(ok);
    expect(r.email).toBe("a@b.co");
  });
  it("rejects mismatched confirm", () => {
    expect(RegisterSchema.safeParse({ ...ok, confirm: "different1" }).success).toBe(false);
  });
  it("rejects short password", () => {
    expect(RegisterSchema.safeParse({ ...ok, password: "short", confirm: "short" }).success).toBe(false);
  });
});

describe("DetailsStepSchema", () => {
  const ok = { title: "Solid oak table", description: "A perfectly good table, six chairs included.", priceType: "fixed", price: "575" };
  it("accepts valid fixed-price input, coercing price", () => {
    const r = DetailsStepSchema.parse(ok);
    expect(r.price).toBe(575);
  });
  it("requires price when priceType is fixed", () => {
    expect(DetailsStepSchema.safeParse({ ...ok, price: "" }).success).toBe(false);
  });
  it("nulls price when priceType is free", () => {
    const r = DetailsStepSchema.parse({ ...ok, priceType: "free", price: "999" });
    expect(r.price).toBeNull();
  });
  it("rejects negative and absurd prices", () => {
    expect(DetailsStepSchema.safeParse({ ...ok, price: "-5" }).success).toBe(false);
    expect(DetailsStepSchema.safeParse({ ...ok, price: "10000000" }).success).toBe(false);
  });
  it("rejects title over 80 chars and description under 20", () => {
    expect(DetailsStepSchema.safeParse({ ...ok, title: "x".repeat(81) }).success).toBe(false);
    expect(DetailsStepSchema.safeParse({ ...ok, description: "too short" }).success).toBe(false);
  });
});

describe("LocationStepSchema", () => {
  it("accepts a known city slug", () => {
    expect(LocationStepSchema.safeParse({ city: "toronto", neighbourhood: "", postalCode: "" }).success).toBe(true);
  });
  it("rejects an unknown city", () => {
    expect(LocationStepSchema.safeParse({ city: "winnipeg", neighbourhood: "", postalCode: "" }).success).toBe(false);
  });
  it("accepts a valid Canadian postal code and rejects garbage", () => {
    expect(LocationStepSchema.safeParse({ city: "ajax", neighbourhood: "", postalCode: "L1S 3V4" }).success).toBe(true);
    expect(LocationStepSchema.safeParse({ city: "ajax", neighbourhood: "", postalCode: "12345" }).success).toBe(false);
  });
});

describe("PhotosStepSchema", () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => `https://res.cloudinary.com/demo/image/upload/v1/x${i}.jpg`);
  it("accepts up to 10 cloudinary URLs on our cloud", () => {
    expect(PhotosStepSchema("demo").safeParse({ images: mk(10) }).success).toBe(true);
  });
  it("rejects 11 images", () => {
    expect(PhotosStepSchema("demo").safeParse({ images: mk(11) }).success).toBe(false);
  });
  it("rejects URLs from another cloud or host", () => {
    expect(PhotosStepSchema("demo").safeParse({ images: ["https://res.cloudinary.com/evil/image/upload/x.jpg"] }).success).toBe(false);
    expect(PhotosStepSchema("demo").safeParse({ images: ["https://example.com/x.jpg"] }).success).toBe(false);
  });
});

describe("MessageSchema", () => {
  it("trims and accepts 1-2000 chars", () => {
    expect(MessageSchema.parse({ content: "  hi there  " }).content).toBe("hi there");
  });
  it("rejects empty and whitespace-only content", () => {
    expect(MessageSchema.safeParse({ content: "   " }).success).toBe(false);
  });
  it("rejects content over 2000 chars", () => {
    expect(MessageSchema.safeParse({ content: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("ReportSchema", () => {
  it("accepts a known reason with empty details", () => {
    const r = ReportSchema.parse({ reason: "scam", details: "" });
    expect(r.reason).toBe("scam");
    expect(r.details).toBe("");
  });
  it("rejects an unknown reason", () => {
    expect(ReportSchema.safeParse({ reason: "dislike", details: "" }).success).toBe(false);
  });
  it("rejects details over 500 chars", () => {
    expect(ReportSchema.safeParse({ reason: "other", details: "x".repeat(501) }).success).toBe(false);
  });
});
