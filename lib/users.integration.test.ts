import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createUser, verifyPassword } from "@/lib/users";

const EMAIL = `vitest-phase2-${Date.now()}@example.com`;

afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  await db.$disconnect();
});

describe("createUser", () => {
  it("creates a user with a bcrypt hash, never storing the raw password", async () => {
    const r = await createUser({ firstName: "Test", lastName: "User", email: EMAIL, password: "hunter2hunter2" });
    expect(r.ok).toBe(true);
    const u = await db.user.findUnique({ where: { email: EMAIL } });
    expect(u).not.toBeNull();
    expect(u!.name).toBe("Test User");
    expect(u!.passwordHash).not.toContain("hunter2");
    expect(await verifyPassword("hunter2hunter2", u!.passwordHash!)).toBe(true);
    expect(await verifyPassword("wrong-password", u!.passwordHash!)).toBe(false);
  });

  it("returns the identical success shape for a duplicate email (anti-enumeration)", async () => {
    const r = await createUser({ firstName: "Dup", lastName: "User", email: EMAIL, password: "differentpass1" });
    expect(r).toEqual({ ok: true });
    const count = await db.user.count({ where: { email: EMAIL } });
    expect(count).toBe(1);
  });
});
