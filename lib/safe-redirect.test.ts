import { describe, it, expect } from "vitest";
import { safeCallbackUrl } from "@/lib/safe-redirect";

describe("safeCallbackUrl", () => {
  it("accepts a plain same-origin path", () => {
    expect(safeCallbackUrl("/post-ad")).toBe("/post-ad");
  });

  it("accepts a same-origin path with a query string", () => {
    expect(safeCallbackUrl("/listing/abc/edit?x=1")).toBe("/listing/abc/edit?x=1");
  });

  it("rejects an absolute URL to another host", () => {
    expect(safeCallbackUrl("https://evil.tld")).toBe("/dashboard");
  });

  it("rejects a protocol-relative URL (//host)", () => {
    expect(safeCallbackUrl("//evil.tld")).toBe("/dashboard");
  });

  it("rejects a backslash-disguised protocol-relative URL", () => {
    expect(safeCallbackUrl("/\\evil.tld")).toBe("/dashboard");
  });

  it("rejects a javascript: scheme URL", () => {
    expect(safeCallbackUrl("javascript:alert(1)")).toBe("/dashboard");
  });

  it("defaults to /dashboard when given null", () => {
    expect(safeCallbackUrl(null)).toBe("/dashboard");
  });

  it("rejects an empty string", () => {
    expect(safeCallbackUrl("")).toBe("/dashboard");
  });

  it("rejects a path that does not start with a slash", () => {
    expect(safeCallbackUrl("dashboard")).toBe("/dashboard");
  });
});
