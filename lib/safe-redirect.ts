/**
 * Guards against open-redirect via a user-controlled `callbackUrl` query
 * param. Only a same-origin relative path is allowed through; anything else
 * (absolute URL, protocol-relative "//host", backslash-disguised
 * "/\\host", a "javascript:" scheme, or a non-path string) falls back to a
 * safe default.
 */
export function safeCallbackUrl(raw: string | null): string {
  const DEFAULT = "/dashboard";
  if (!raw) return DEFAULT;

  // Must start with a single forward slash — rules out absolute URLs
  // ("https://evil.tld"), scheme URLs ("javascript:alert(1)"), and bare
  // paths without a leading slash ("dashboard").
  if (!raw.startsWith("/")) return DEFAULT;

  // "//evil.tld" is protocol-relative (browser treats it as same-scheme,
  // other-host) and "/\\evil.tld" is a backslash variant some browsers
  // normalize the same way. Reject any second leading slash or backslash.
  if (raw.startsWith("//") || raw.startsWith("/\\")) return DEFAULT;

  return raw;
}
