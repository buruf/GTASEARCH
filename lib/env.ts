// Degraded-mode contract (spec §8): every external service is optional until
// its keys arrive. These helpers are the single source of truth for "is this
// service configured" — UI and actions must never read the raw vars directly.

export function googleEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function resendEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function cloudinaryConfig(): { cloudName: string; uploadPreset: string } | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) return null;
  return { cloudName, uploadPreset };
}

export function appUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3020";
}

/** Destination for report notifications; null disables them (degraded mode). */
export function adminEmail(): string | null {
  return process.env.ADMIN_EMAIL || null;
}
