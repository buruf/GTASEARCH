// Simple banned-words moderation, checked at publish (spec §4). Matching is
// word-boundary on a leet-normalised copy, so "c0ca1ne" trips but "class"
// and "assorted" never do. Rejections are generic — the caller must NOT echo
// which word matched.

const BANNED = [
  "cocaine", "heroin", "fentanyl", "meth", "mdma", "ecstasy",
  "counterfeit", "replica watches", "stolen",
  "escort", "sex", "porn", "nude",
  "glock", "pistol", "rifle", "ammunition", "silencer",
  "ass", "fuck", "shit", "bitch", "cunt",
];

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s",
};

// Leet substitution is only applied within a whitespace-delimited token when
// that token also contains at least one ASCII letter. This lets mixed tokens
// like "c0ca1ne" or "s3x" still decode and trip, while purely numeric/symbol
// tokens — prices ("$550"), engine displacements ("350", "455"), phone
// numbers ("416-555-0142") — are left untouched and can never become a
// banned word by accident.
function normalise(text: string): string {
  return text
    .toLowerCase()
    .split(/(\s+)/)
    .map((token) =>
      /[a-z]/.test(token) ? token.replace(/[013457@$]/g, (c) => LEET[c] ?? c) : token,
    )
    .join("");
}

// Input is already lowercased by normalise() before matching, so the "i"
// flag is redundant here — kept only as defense-in-depth.
const PATTERNS = BANNED.map(
  (w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
);

export function violatesModeration(text: string): boolean {
  const n = normalise(text);
  return PATTERNS.some((p) => p.test(n));
}
