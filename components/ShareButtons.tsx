"use client";

import { useState } from "react";

/**
 * WhatsApp and X are plain links and work without JavaScript. Copy Link is the
 * only control that needs it, and it degrades to a visible URL if unavailable.
 */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(title);

  const btn =
    "inline-flex items-center gap-1.5 rounded-btn border border-line px-3 py-2 text-sm font-medium text-ink hover:border-brand hover:text-brand";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by permissions or a non-secure context.
      // Select the URL as a fallback so the user can copy it manually.
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className={btn}
      >
        WhatsApp
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className={btn}
      >
        Share on X
      </a>
      <button type="button" onClick={copy} className={btn}>
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}
