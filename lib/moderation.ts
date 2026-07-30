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

function normalise(text: string): string {
  return text.toLowerCase().replace(/[013457@$]/g, (c) => LEET[c] ?? c);
}

const PATTERNS = BANNED.map(
  (w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
);

export function violatesModeration(text: string): boolean {
  const n = normalise(text);
  return PATTERNS.some((p) => p.test(n));
}
