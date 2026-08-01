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
});
