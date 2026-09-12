import { describe, it, expect } from "vitest";
import {
  canonicalEmail,
  isDisposableEmail,
  looksAutomated,
  MIN_FORM_FILL_MS,
} from "@/lib/email-identity";

describe("canonicalEmail", () => {
  // The exact attack seen in production: 131 accounts between Sep 4 and Sep 12
  // 2026, every one a dot-permutation of a real business inbox.
  it("collapses the Gmail dot trick to one mailbox", () => {
    expect(canonicalEmail("kle.an.o.l.og.y.fo.r.y.ou@gmail.com")).toBe("kleanologyforyou@gmail.com");
    expect(canonicalEmail("k.lea.no.lo.gy.f.or.you@gmail.com")).toBe("kleanologyforyou@gmail.com");
    expect(canonicalEmail("r.ob.e.r.t.sbo.d.ysh.o.p.p@gmail.com")).toBe("robertsbodyshopp@gmail.com");
  });

  it("strips sub-addressing for every provider", () => {
    expect(canonicalEmail("owner+gtasearch@example.com")).toBe("owner@example.com");
    expect(canonicalEmail("owner+a+b@example.com")).toBe("owner@example.com");
  });

  it("treats googlemail as gmail", () => {
    expect(canonicalEmail("first.last@googlemail.com")).toBe("firstlast@gmail.com");
  });

  // Dots are significant almost everywhere else. Collapsing them for other
  // providers would merge two real, unrelated people into one account.
  it("keeps dots for providers that treat them as significant", () => {
    expect(canonicalEmail("first.last@yahoo.com")).toBe("first.last@yahoo.com");
    expect(canonicalEmail("first.last@outlook.com")).toBe("first.last@outlook.com");
    expect(canonicalEmail("a.b@gtasearch.com")).toBe("a.b@gtasearch.com");
  });

  it("normalises case and surrounding whitespace", () => {
    expect(canonicalEmail("  Owner@Example.COM ")).toBe("owner@example.com");
  });

  it("leaves malformed input alone rather than inventing a mailbox", () => {
    expect(canonicalEmail("not-an-email")).toBe("not-an-email");
    // A local part of nothing but dots must not collapse to "@gmail.com",
    // which would then match every other degenerate address.
    expect(canonicalEmail("...@gmail.com")).toBe("...@gmail.com");
    expect(canonicalEmail("+tag@gmail.com")).toBe("+tag@gmail.com");
  });

  it("is idempotent", () => {
    const once = canonicalEmail("f.i.r.s.t+tag@googlemail.com");
    expect(canonicalEmail(once)).toBe(once);
  });
});

describe("isDisposableEmail", () => {
  it("catches throwaway inbox providers", () => {
    expect(isDisposableEmail("someone@mailinator.com")).toBe(true);
    expect(isDisposableEmail("SOMEONE@YOPMAIL.COM")).toBe(true);
  });
  // Refusing a real provider is worse than admitting one throwaway: a
  // directory needs business owners to be able to sign up at all.
  it("leaves ordinary providers alone", () => {
    for (const d of ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "rogers.com", "bell.net"]) {
      expect(isDisposableEmail(`owner@${d}`), d).toBe(false);
    }
  });
});

describe("looksAutomated", () => {
  it("flags anything that filled the hidden field", () => {
    expect(looksAutomated("http://spam.example", 9_000)).toBe(true);
    expect(looksAutomated("anything", null)).toBe(true);
  });
  it("flags a form submitted faster than a person can type", () => {
    expect(looksAutomated(null, 0)).toBe(true);
    expect(looksAutomated("", MIN_FORM_FILL_MS - 1)).toBe(true);
  });
  it("passes a real submission", () => {
    expect(looksAutomated("", MIN_FORM_FILL_MS)).toBe(false);
    expect(looksAutomated(null, 30_000)).toBe(false);
    // Missing timing (JS disabled, or a stale form) must not block a human —
    // the honeypot and the canonical-email check still apply.
    expect(looksAutomated(null, null)).toBe(false);
    // A negative elapsed time means a clock skew, not a bot.
    expect(looksAutomated(null, -5_000)).toBe(false);
  });
});
