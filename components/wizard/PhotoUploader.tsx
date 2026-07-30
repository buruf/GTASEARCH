"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { savePhotos } from "@/app/post-ad/actions";
import type { FormState } from "@/app/auth/actions";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export function PhotoUploader({
  cloudName, uploadPreset, initial, action = savePhotos, listingId, submitLabel = "Continue",
}: {
  cloudName?: string;
  uploadPreset?: string;
  initial: string[];
  // Defaults to the wizard's savePhotos; edit page passes updatePhotos instead
  // of duplicating this component (spec §6).
  action?: (prev: FormState, formData: FormData) => Promise<FormState>;
  listingId?: string;
  submitLabel?: string;
}) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [state, formAction] = useFormState<FormState, FormData>(action, { ok: false });
  const canUpload = Boolean(cloudName && uploadPreset);

  async function onFiles(list: FileList | null) {
    if (!list || !cloudName || !uploadPreset) return;
    setError(null);
    const files = Array.from(list).slice(0, 10 - urls.length);
    for (const f of files) {
      if (!TYPES.includes(f.type)) { setError("Only JPEG, PNG or WEBP images."); continue; }
      if (f.size > MAX_BYTES) { setError("Each photo must be under 5 MB."); continue; }
      setUploading((n) => n + 1);
      try {
        const body = new FormData();
        body.append("file", f);
        body.append("upload_preset", uploadPreset);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { secure_url: string };
        setUrls((u) => [...u, json.secure_url]);
      } catch {
        setError("Upload failed — please try that photo again.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  const move = (i: number, dir: -1 | 1) => setUrls((u) => {
    const j = i + dir;
    if (j < 0 || j >= u.length) return u;
    const copy = [...u]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy;
  });

  return (
    <form action={formAction}>
      {listingId && <input type="hidden" name="listingId" value={listingId} />}
      {urls.map((u) => <input key={u} type="hidden" name="images" value={u} />)}

      {canUpload ? (
        <label className="mt-4 flex cursor-pointer flex-col items-center rounded-card border-2 border-dashed border-line p-8 text-center hover:border-brand">
          <span className="text-sm font-medium text-ink">Click to add photos</span>
          <span className="mt-1 text-xs text-ink-faint">Up to 10 · JPEG, PNG or WEBP · 5 MB each</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only"
            onChange={(e) => onFiles(e.target.files)} disabled={urls.length >= 10} />
        </label>
      ) : (
        <p className="mt-4 rounded-card bg-surface-alt px-4 py-3 text-sm text-ink-muted">
          Photo uploads aren&apos;t configured yet. You can still reorder or remove existing photos.
        </p>
      )}

      {uploading > 0 && <p className="mt-2 text-sm text-ink-muted">Uploading {uploading}…</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      {state.error && <p role="alert" className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="mt-2 text-sm text-green-700">Saved.</p>}

      <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {urls.map((u, i) => (
          <li key={u} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary preview thumbnails; next/image not worth remotePatterns churn here */}
            <img src={u} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-btn object-cover ring-1 ring-line" />
            {i === 0 && <span className="absolute left-1 top-1 rounded bg-brand px-1 text-[10px] font-semibold text-white">Cover</span>}
            <div className="mt-1 flex justify-center gap-1 text-xs">
              <button type="button" onClick={() => move(i, -1)} aria-label="Move earlier" className="rounded border border-line px-1.5 hover:border-brand">←</button>
              <button type="button" onClick={() => setUrls((x) => x.filter((_, j) => j !== i))} aria-label="Remove" className="rounded border border-line px-1.5 text-red-600 hover:border-red-600">✕</button>
              <button type="button" onClick={() => move(i, 1)} aria-label="Move later" className="rounded border border-line px-1.5 hover:border-brand">→</button>
            </div>
          </li>
        ))}
      </ul>

      <button type="submit" disabled={uploading > 0}
        className="mt-6 h-11 w-full rounded-btn bg-brand text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
        {submitLabel}
      </button>
    </form>
  );
}
