import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { isAdminEmail } from "@/lib/admin";

const saved = process.env.ADMIN_EMAIL;
beforeEach(() => { delete process.env.ADMIN_EMAIL; });
afterAll(() => { if (saved !== undefined) process.env.ADMIN_EMAIL = saved; });

describe("isAdminEmail", () => {
  it("is false for everyone when ADMIN_EMAIL is unset (degraded mode)", () => {
    expect(isAdminEmail("owner@example.com")).toBe(false);
  });
  it("matches case-insensitively with trimming", () => {
    process.env.ADMIN_EMAIL = " Owner@Example.com ";
    expect(isAdminEmail("owner@example.com")).toBe(true);
    expect(isAdminEmail("OWNER@EXAMPLE.COM")).toBe(true);
  });
  it("rejects non-matching and empty emails", () => {
    process.env.ADMIN_EMAIL = "owner@example.com";
    expect(isAdminEmail("intruder@example.com")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });

  // The Header now feeds this straight into UserMenu's `isAdmin`, which draws
  // the only link to /admin anywhere on the site. A true for the wrong person
  // would not grant access — requireAdmin() still 404s them and every action
  // re-checks — but it would advertise that the console exists, which the
  // 404-not-403 rule exists to avoid. Signed-in-but-not-admin is the case that
  // matters, because that is everyone who can see a UserMenu at all.
  it("keeps the admin link hidden from an ordinary signed-in user", () => {
    process.env.ADMIN_EMAIL = "owner@example.com";
    expect(isAdminEmail("someone-else@example.com")).toBe(false);
    // Near-misses must not pass: same local part on another domain, and the
    // owner's own second account registered under a different address — the
    // exact shape that made the first real claim look unreachable.
    expect(isAdminEmail("owner@example.org")).toBe(false);
    expect(isAdminEmail("owner1@example.com")).toBe(false);
  });
});
