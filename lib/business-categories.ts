// Business category taxonomy for the directory.
//
// Held as a typed constant rather than a database table: ten categories that
// change infrequently, giving compile-time safety on slugs across the directory.

export interface BusinessSubcategory {
  slug: string;
  label: string;
}

export interface BusinessCategory {
  slug: string;
  label: string;
  /** Key into the icon map in components/BusinessCategoryIcon.tsx */
  icon: string;
  subcategories: BusinessSubcategory[];
}

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  {
    slug: "restaurants",
    label: "Restaurants & Food",
    icon: "utensils",
    subcategories: [
      { slug: "pizza", label: "Pizza" },
      { slug: "coffee-tea", label: "Coffee & Tea" },
      { slug: "bakeries", label: "Bakeries" },
      { slug: "halal", label: "Halal" },
      { slug: "fast-food", label: "Fast Food" },
      { slug: "fine-dining", label: "Fine Dining" },
      { slug: "grocery", label: "Grocery" },
      { slug: "dessert", label: "Dessert" },
    ],
  },
  {
    slug: "health",
    label: "Health & Medical",
    icon: "cross",
    subcategories: [
      { slug: "dentists", label: "Dentists" },
      { slug: "family-doctors", label: "Family Doctors" },
      { slug: "walk-in-clinics", label: "Walk-in Clinics" },
      { slug: "pharmacies", label: "Pharmacies" },
      { slug: "optometrists", label: "Optometrists" },
      { slug: "physiotherapy", label: "Physiotherapy" },
      { slug: "chiropractors", label: "Chiropractors" },
    ],
  },
  {
    slug: "home-services",
    label: "Home Services",
    icon: "wrench",
    subcategories: [
      { slug: "plumbers", label: "Plumbers" },
      { slug: "electricians", label: "Electricians" },
      { slug: "hvac", label: "HVAC" },
      { slug: "cleaning", label: "Cleaning" },
      { slug: "landscaping", label: "Landscaping" },
      { slug: "painters", label: "Painters" },
      { slug: "roofing", label: "Roofing" },
      { slug: "movers", label: "Movers" },
      { slug: "handyman", label: "Handyman" },
    ],
  },
  {
    slug: "beauty",
    label: "Beauty & Wellness",
    icon: "scissors",
    subcategories: [
      { slug: "hair-salons", label: "Hair Salons" },
      { slug: "barbers", label: "Barbers" },
      { slug: "nail-salons", label: "Nail Salons" },
      { slug: "spas", label: "Spas" },
      { slug: "massage", label: "Massage" },
      { slug: "tattoo-piercing", label: "Tattoo & Piercing" },
    ],
  },
  {
    slug: "automotive",
    label: "Automotive",
    icon: "car",
    subcategories: [
      { slug: "auto-repair", label: "Auto Repair" },
      { slug: "oil-change", label: "Oil Change" },
      { slug: "tires", label: "Tires" },
      { slug: "car-wash", label: "Car Wash" },
      { slug: "detailing", label: "Detailing" },
      { slug: "body-shops", label: "Body Shops" },
    ],
  },
  {
    slug: "professional",
    label: "Professional Services",
    icon: "briefcase",
    subcategories: [
      { slug: "lawyers", label: "Lawyers" },
      { slug: "accountants", label: "Accountants" },
      { slug: "real-estate-agents", label: "Real Estate Agents" },
      { slug: "insurance", label: "Insurance" },
      { slug: "mortgage-brokers", label: "Mortgage Brokers" },
      { slug: "marketing", label: "Marketing" },
    ],
  },
  {
    slug: "shopping",
    label: "Shopping & Retail",
    icon: "bag",
    subcategories: [
      { slug: "clothing", label: "Clothing" },
      { slug: "electronics-stores", label: "Electronics" },
      { slug: "furniture-stores", label: "Furniture" },
      { slug: "jewellery", label: "Jewellery" },
      { slug: "florists", label: "Florists" },
    ],
  },
  {
    slug: "education",
    label: "Education & Childcare",
    icon: "book",
    subcategories: [
      { slug: "daycares", label: "Daycares" },
      { slug: "tutoring-centres", label: "Tutoring Centres" },
      { slug: "driving-schools", label: "Driving Schools" },
      { slug: "music-lessons", label: "Music Lessons" },
    ],
  },
  {
    slug: "fitness",
    label: "Fitness & Recreation",
    icon: "dumbbell",
    subcategories: [
      { slug: "gyms", label: "Gyms" },
      { slug: "yoga-pilates", label: "Yoga & Pilates" },
      { slug: "martial-arts", label: "Martial Arts" },
      { slug: "swimming", label: "Swimming" },
      { slug: "sports-clubs", label: "Sports Clubs" },
    ],
  },
  {
    slug: "pets",
    label: "Pets",
    icon: "paw",
    subcategories: [
      { slug: "veterinarians", label: "Veterinarians" },
      { slug: "grooming", label: "Grooming" },
      { slug: "pet-stores", label: "Pet Stores" },
      { slug: "boarding-daycare", label: "Boarding & Daycare" },
    ],
  },
];

const BY_SLUG = new Map(BUSINESS_CATEGORIES.map((c) => [c.slug, c]));

/** Returns the category, or undefined for an unknown slug. Callers must treat
 *  undefined as "filter not applied" rather than throwing — search URLs are
 *  user-editable and must never 500. */
export function getBusinessCategory(slug: string | undefined): BusinessCategory | undefined {
  return slug ? BY_SLUG.get(slug) : undefined;
}

export function getBusinessCategoryLabel(slug: string): string {
  return BY_SLUG.get(slug)?.label ?? slug;
}

export function getBusinessSubcategoryLabel(categorySlug: string, subcategorySlug: string | null): string | null {
  if (!subcategorySlug) return null;
  return BY_SLUG.get(categorySlug)?.subcategories.find((s) => s.slug === subcategorySlug)?.label ?? subcategorySlug;
}
