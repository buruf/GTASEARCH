import { z } from "zod";
import { getCategory } from "@/lib/categories";
import { getCity } from "@/lib/cities";

// All server actions validate through these schemas. HTML client validation is
// a convenience only; these are the real gate.

export const RegisterSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(50),
    lastName: z.string().trim().min(1, "Last name is required").max(50),
    email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
    password: z.string().min(8, "Password must be at least 8 characters").max(100),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export const CategoryStepSchema = z
  .object({
    category: z.string(),
    subcategory: z.string().optional().default(""),
  })
  .superRefine((d, ctx) => {
    const cat = getCategory(d.category);
    if (!cat) {
      ctx.addIssue({ code: "custom", path: ["category"], message: "Pick a category" });
      return;
    }
    if (d.subcategory && !cat.subcategories.some((s) => s.slug === d.subcategory)) {
      ctx.addIssue({ code: "custom", path: ["subcategory"], message: "Pick a valid subcategory" });
    }
  });

export const DetailsStepSchema = z
  .object({
    title: z.string().trim().min(4, "Title is too short").max(80, "Max 80 characters"),
    description: z.string().trim().min(20, "Describe your item in at least 20 characters").max(2000),
    priceType: z.enum(["fixed", "free", "contact", "trade"]),
    price: z.string().optional().default(""),
  })
  .transform((d, ctx) => {
    if (d.priceType !== "fixed") return { ...d, price: null as number | null };
    const n = Number(d.price);
    if (d.price === "" || !Number.isFinite(n) || n < 0 || n > 9_999_999) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Enter a price between $0 and $9,999,999" });
      return z.NEVER;
    }
    return { ...d, price: Math.round(n * 100) / 100 };
  });

export const LocationStepSchema = z.object({
  city: z.string().refine((s) => Boolean(getCity(s)), "Pick a city from the list"),
  neighbourhood: z.string().trim().max(80).optional().default(""),
  postalCode: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .default("")
    .refine((s) => s === "" || /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/.test(s), "Enter a valid postal code (e.g. M5V 2T6)"),
});

export function cloudinaryUrlPattern(cloudName: string): RegExp {
  const esc = cloudName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^https://res\\.cloudinary\\.com/${esc}/image/upload/`);
}

export const PhotosStepSchema = (cloudName: string) =>
  z.object({
    images: z
      .array(z.string().regex(cloudinaryUrlPattern(cloudName), "Invalid image URL"))
      .max(10, "Maximum 10 photos"),
  });

export const ChangePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    password: z.string().min(8, "New password must be at least 8 characters").max(100),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const ProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((s) => s === "" || /^[\d\s()+-]{7,20}$/.test(s), "Enter a valid phone number"),
});

export const MessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write a message first")
    .max(2000, "Messages are limited to 2000 characters"),
});

/** Slug → label shown as radio options on the report form. */
export const REPORT_REASONS: Record<string, string> = {
  prohibited: "Prohibited item",
  scam: "Scam or fraud",
  "wrong-category": "Wrong category",
  offensive: "Offensive content",
  other: "Other",
};

export const ReportSchema = z.object({
  reason: z
    .string()
    .refine((r) => Object.hasOwn(REPORT_REASONS, r), "Pick a reason"),
  details: z.string().trim().max(500, "Keep details under 500 characters").optional().default(""),
});

/**
 * What an owner may change on a claimed business.
 *
 * Deliberately excludes name, category, address and city. Those are the facts
 * the directory is built on and are cross-checked against the municipal
 * source; letting an owner rewrite them turns a verified listing into an
 * unverifiable one, and makes a claimed listing a way to point somebody
 * else's address at your business. Corrections to those go through /contact.
 */
export const BusinessProfileSchema = z.object({
  description: z
    .string()
    .trim()
    .min(20, "Write at least a sentence about the business")
    .max(1500, "Keep the description under 1500 characters"),
  phone: z.string().trim().max(30).optional().default(""),
  website: z
    .string()
    .trim()
    .max(200)
    .optional()
    .default("")
    .refine((v) => v === "" || /^https?:\/\/\S+\.\S+/.test(v), "Enter a full URL starting with https://"),
  hours: z.string().trim().max(300, "Keep hours under 300 characters").optional().default(""),
});

export const ReviewSchema = z.object({
  rating: z.coerce
    .number()
    .int("Pick a rating")
    .min(1, "Pick a rating from 1 to 5")
    .max(5, "Pick a rating from 1 to 5"),
  body: z
    .string()
    .trim()
    .min(20, "Tell people a little about your experience — at least 20 characters")
    .max(2000, "Keep your review under 2000 characters"),
});

export const OwnerResponseSchema = z.object({
  response: z.string().trim().max(1000, "Keep your reply under 1000 characters"),
});

/** Slug → label for "what is your role at this business?" on the claim form. */
export const CLAIM_ROLES: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  employee: "Employee",
  agency: "Agency or representative",
};

export const ClaimSchema = z.object({
  contactName: z.string().trim().min(2, "Enter your full name").max(80),
  contactEmail: z.string().trim().toLowerCase().email("Enter a valid email"),
  contactPhone: z.string().trim().max(30).optional().default(""),
  // Object.hasOwn, not `in` — `in` walks the prototype chain and would accept
  // "constructor" as a role (the ReportSchema lesson).
  roleAtBusiness: z
    .string()
    .refine((r) => Object.hasOwn(CLAIM_ROLES, r), "Tell us your role"),
  evidence: z
    .string()
    .trim()
    .min(10, "Give us something checkable — a website, business number, or an email at the business's domain")
    .max(1000, "Keep this under 1000 characters"),
});
