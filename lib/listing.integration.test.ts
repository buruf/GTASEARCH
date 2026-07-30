import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { getPublicListing } from "@/lib/listing";

const STAMP = Date.now();
const EMAILS = {
  withPhone: `vitest-listing-with-phone-${STAMP}@example.com`,
  noPhone: `vitest-listing-no-phone-${STAMP}@example.com`,
};
const PHONE = "416-555-0199";
const POSTAL_CODE = "M5V 2T6";
let withPhoneListingId: string, noPhoneListingId: string;

beforeAll(async () => {
  const seller = await db.user.create({
    data: { email: EMAILS.withPhone, name: "Payload Hygiene Seller", phone: PHONE },
  });
  withPhoneListingId = (await db.listing.create({ data: {
    title: "Payload hygiene fixture desk",
    description: "A desk that exists so the payload-hygiene test has something to protect.",
    category: "furniture-home", city: "toronto", images: [], status: "active",
    postalCode: POSTAL_CODE,
    expiresAt: new Date(Date.now() + 30 * 86_400_000),
    userId: seller.id,
  } })).id;

  const sellerNoPhone = await db.user.create({
    data: { email: EMAILS.noPhone, name: "Phoneless Seller" },
  });
  noPhoneListingId = (await db.listing.create({ data: {
    title: "Payload hygiene fixture lamp",
    description: "A lamp whose seller has no phone number on file.",
    category: "furniture-home", city: "toronto", images: [], status: "active",
    expiresAt: new Date(Date.now() + 30 * 86_400_000),
    userId: sellerNoPhone.id,
  } })).id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: Object.values(EMAILS) } } });
  await db.$disconnect();
});

describe("getPublicListing payload hygiene", () => {
  it("never leaks phone or postalCode, but reports hasPhone", async () => {
    const result = await getPublicListing(withPhoneListingId);
    expect(result).not.toBeNull();

    const json = JSON.stringify(result);
    expect(json).not.toContain(PHONE);
    expect(result!.user).not.toHaveProperty("phone");

    expect(json).not.toContain(POSTAL_CODE);
    expect(result).not.toHaveProperty("postalCode");

    expect(result!.hasPhone).toBe(true);
  });

  it("reports hasPhone === false for a seller with no phone on file", async () => {
    const result = await getPublicListing(noPhoneListingId);
    expect(result).not.toBeNull();
    expect(result!.hasPhone).toBe(false);
  });
});
