import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { googleEnabled, resendEnabled, cloudinaryConfig, appUrl } from "@/lib/env";

const saved = { ...process.env };
beforeEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.RESEND_API_KEY;
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_UPLOAD_PRESET;
  delete process.env.NEXTAUTH_URL;
});
afterAll(() => { Object.assign(process.env, saved); });

describe("env degraded-mode helpers", () => {
  it("googleEnabled needs BOTH id and secret", () => {
    expect(googleEnabled()).toBe(false);
    process.env.GOOGLE_CLIENT_ID = "x";
    expect(googleEnabled()).toBe(false);
    process.env.GOOGLE_CLIENT_SECRET = "y";
    expect(googleEnabled()).toBe(true);
  });

  it("cloudinaryConfig returns null unless both vars set", () => {
    expect(cloudinaryConfig()).toBeNull();
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    expect(cloudinaryConfig()).toBeNull();
    process.env.CLOUDINARY_UPLOAD_PRESET = "unsigned1";
    expect(cloudinaryConfig()).toEqual({ cloudName: "demo", uploadPreset: "unsigned1" });
  });

  it("resendEnabled reflects RESEND_API_KEY", () => {
    expect(resendEnabled()).toBe(false);
    process.env.RESEND_API_KEY = "re_123";
    expect(resendEnabled()).toBe(true);
  });

  it("appUrl falls back to localhost dev port", () => {
    expect(appUrl()).toBe("http://localhost:3020");
    process.env.NEXTAUTH_URL = "https://gtasearch.com";
    expect(appUrl()).toBe("https://gtasearch.com");
  });
});
