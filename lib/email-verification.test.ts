import { describe, it, expect } from "vitest";
import { isVerified, VERIFICATION_REQUIRED_FROM } from "@/lib/email-verification";

const before = new Date(VERIFICATION_REQUIRED_FROM.getTime() - 60_000);
const after = new Date(VERIFICATION_REQUIRED_FROM.getTime() + 60_000);

describe("isVerified", () => {
  it("lets a confirmed account through", () => {
    expect(isVerified({ emailVerified: new Date(), createdAt: after })).toBe(true);
  });

  it("stops an unconfirmed account registered after the gate existed", () => {
    expect(isVerified({ emailVerified: null, createdAt: after })).toBe(false);
  });

  // The ten accounts that survived the 2026-09-13 prune were reviewed by hand.
  // Locking them out to prove a mailbox they have already demonstrated would
  // be friction with no safety in return.
  it("grandfathers accounts that predate the gate", () => {
    expect(isVerified({ emailVerified: null, createdAt: before })).toBe(true);
  });

  // The exemption is a fixed date, not a rolling window: it must never drift
  // forward and quietly stop applying to new sign-ups.
  it("is a fixed line, so a new account can never fall inside it", () => {
    expect(isVerified({ emailVerified: null, createdAt: new Date() })).toBe(false);
    expect(VERIFICATION_REQUIRED_FROM.getTime()).toBeLessThan(Date.now());
  });

  it("a confirmed old account is still verified", () => {
    expect(isVerified({ emailVerified: new Date(), createdAt: before })).toBe(true);
  });
});
