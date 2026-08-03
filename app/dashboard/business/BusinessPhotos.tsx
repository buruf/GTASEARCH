"use client";

import { useState } from "react";
import Image from "next/image";
import { useFormState, useFormStatus } from "react-dom";
import { updateBusinessPhotos, type OwnerState } from "./actions";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-btn bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save photos"}
    </button>
  );
}

/**
 * Business photo manager. Uploads go straight from the browser to Cloudinary
 * with an unsigned preset (same approach as the listing wizard) so image bytes
 * never pass through our server; only the resulting URLs are submitted.
 */
export function BusinessPhotos({
  businessId,
  initial,
  limit,
}: {
  businessId: string;
  initial: string[];
  limit: number;
}) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  const canUpload = Boolean(cloudName && uploadPreset);

  const [urls, setUrls] = useState<string[]>(initial);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [state, formAction] = useFormState<OwnerState | undefined, FormData>(
    updateBusinessPhotos,
    undefined,
  );

  async function onFiles(list: FileList | null) {
    if (!list || !cloudName || !uploadPreset) return;
    setError(null);
    const room = limit - urls.length;
    if (room <= 0) {
      setError(`You can have up to ${limit} photos on this plan.`);
      return;
    }
    for (const f of Array.from(list).slice(0, room)) {
      if (!TYPES.includes(f.type)) {
        setError("Only JPEG, PNG or WEBP images.");
        continue;
      }
      if (f.size > MAX_BYTES) {
        setError("Each photo must be under 5 MB.");
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const body = new FormData();
        body.append("file", f);
        body.append("upload_preset", uploadPreset);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body,
        });
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

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="businessId" value={businessId} />
      {urls.map((u) => (
        <input key={u} type="hidden" name="photos" value={u} />
      ))}

      {(error || state?.error) && (
        <p role="alert" className="rounded-btn bg-red-50 px-3 py-2 text-sm text-red-800">
          {error ?? state?.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="rounded-btn bg-brand-50 px-3 py-2 text-sm text-ink">
          {state.ok}
        </p>
      )}

      {urls.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {urls.map((u, i) => (
            <li key={u} className="relative">
              <div className="relative aspect-square overflow-hidden rounded-card bg-surface-alt">
                <Image src={u} alt="" fill sizes="25vw" className="object-cover" />
              </div>
              <button
                type="button"
                onClick={() => setUrls((all) => all.filter((_, j) => j !== i))}
                className="mt-1 w-full rounded-btn border border-line px-2 py-1 text-xs text-ink-muted hover:bg-surface-alt hover:text-ink"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {canUpload ? (
        <div>
          <label
            htmlFor="business-photos"
            className="inline-block cursor-pointer rounded-btn border border-line px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-alt hover:text-ink"
          >
            {uploading > 0 ? `Uploading ${uploading}…` : "Add photos"}
          </label>
          <input
            id="business-photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
          />
          <p className="mt-1 text-xs text-ink-faint">
            {urls.length} of {limit} used. JPEG, PNG or WEBP, up to 5 MB each.
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">
          Photo uploads are unavailable right now. Your existing photos are
          unaffected.
        </p>
      )}

      <Save />
    </form>
  );
}
