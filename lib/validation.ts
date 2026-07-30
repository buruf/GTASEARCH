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
