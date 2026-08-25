import { describe, it, expect } from "vitest";
import { sectionLinkFor } from "@/lib/header-nav";

describe("header section link", () => {
  // The reported bug: inside the classifieds the link pointed at the page you
  // were already on, so there was no way back to the directory.
  it("offers Businesses from anywhere in the classifieds", () => {
    for (const p of ["/classifieds", "/search", "/listing/abc123", "/post-ad", "/saved"]) {
      expect(sectionLinkFor(p), p).toEqual({ href: "/", label: "Businesses" });
    }
  });

  it("offers Classifieds from anywhere in the directory", () => {
    for (const p of ["/", "/directory/restaurants", "/directory/restaurants/toronto", "/biz/some-shop", "/about"]) {
      expect(sectionLinkFor(p), p).toEqual({ href: "/classifieds", label: "Classifieds" });
    }
  });

  // A prefix must not match a longer unrelated segment: "/searchers" is not
  // the classifieds.
  it("matches whole path segments, not prefixes of longer names", () => {
    expect(sectionLinkFor("/searchers").label).toBe("Classifieds");
    expect(sectionLinkFor("/listings-archive").label).toBe("Classifieds");
  });

  // Whichever section you are in, the link always leads out of it.
  it("never points at the section you are already in", () => {
    for (const p of ["/", "/classifieds", "/search", "/biz/x", "/directory/beauty"]) {
      expect(sectionLinkFor(p).href === p).toBe(false);
    }
  });
});
