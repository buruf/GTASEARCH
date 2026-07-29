// Category taxonomy.
//
// Held as a typed constant rather than a database table: twelve categories that
// change perhaps twice a year do not justify a join on every listing query, and
// a const gives compile-time safety on slugs across the whole app.

export interface Subcategory {
  slug: string;
  label: string;
}

export interface Category {
  slug: string;
  label: string;
  /** Key into the icon map in components/CategoryIcon.tsx */
  icon: string;
  subcategories: Subcategory[];
}

export const CATEGORIES: Category[] = [
  {
    slug: "real-estate",
    label: "Real Estate",
    icon: "home",
    subcategories: [
      { slug: "for-rent", label: "For Rent" },
      { slug: "for-sale", label: "For Sale" },
      { slug: "rooms-shared", label: "Rooms & Shared" },
      { slug: "short-term", label: "Short Term Rentals" },
      { slug: "parking-storage", label: "Parking & Storage" },
      { slug: "commercial", label: "Commercial & Office" },
    ],
  },
  {
    slug: "cars-vehicles",
    label: "Cars & Vehicles",
    icon: "car",
    subcategories: [
      { slug: "cars-trucks", label: "Cars & Trucks" },
      { slug: "suvs", label: "SUVs & Crossovers" },
      { slug: "motorcycles", label: "Motorcycles" },
      { slug: "parts-tires", label: "Parts & Tires" },
      { slug: "rvs-campers", label: "RVs & Campers" },
      { slug: "boats", label: "Boats & Watercraft" },
    ],
  },
  {
    slug: "jobs",
    label: "Jobs",
    icon: "briefcase",
    subcategories: [
      { slug: "full-time", label: "Full-Time" },
      { slug: "part-time", label: "Part-Time" },
      { slug: "skilled-trades", label: "Skilled Trades" },
      { slug: "hospitality", label: "Hospitality & Food" },
      { slug: "driving", label: "Driving & Delivery" },
      { slug: "office-admin", label: "Office & Admin" },
    ],
  },
  {
    slug: "electronics",
    label: "Electronics",
    icon: "device",
    subcategories: [
      { slug: "phones", label: "Phones" },
      { slug: "computers", label: "Computers & Laptops" },
      { slug: "tvs-audio", label: "TVs & Audio" },
      { slug: "gaming", label: "Video Games & Consoles" },
      { slug: "cameras", label: "Cameras" },
      { slug: "accessories", label: "Accessories" },
    ],
  },
  {
    slug: "furniture-home",
    label: "Furniture & Home",
    icon: "sofa",
    subcategories: [
      { slug: "living-room", label: "Living Room" },
      { slug: "bedroom", label: "Bedroom" },
      { slug: "dining-kitchen", label: "Dining & Kitchen" },
      { slug: "appliances", label: "Appliances" },
      { slug: "decor", label: "Home Decor" },
      { slug: "garden-outdoor", label: "Garden & Outdoor" },
    ],
  },
  {
    slug: "clothing-accessories",
    label: "Clothing & Accessories",
    icon: "shirt",
    subcategories: [
      { slug: "womens", label: "Women's" },
      { slug: "mens", label: "Men's" },
      { slug: "shoes", label: "Shoes" },
      { slug: "bags-luggage", label: "Bags & Luggage" },
      { slug: "jewellery-watches", label: "Jewellery & Watches" },
    ],
  },
  {
    slug: "services",
    label: "Services",
    icon: "tools",
    subcategories: [
      { slug: "moving-storage", label: "Moving & Storage" },
      { slug: "cleaning", label: "Cleaning" },
      { slug: "renovation", label: "Renovation & Handyman" },
      { slug: "tutoring", label: "Tutoring & Lessons" },
      { slug: "beauty-wellness", label: "Beauty & Wellness" },
      { slug: "financial-legal", label: "Financial & Legal" },
    ],
  },
  {
    slug: "pets",
    label: "Pets",
    icon: "paw",
    subcategories: [
      { slug: "dogs", label: "Dogs & Puppies" },
      { slug: "cats", label: "Cats & Kittens" },
      { slug: "small-pets", label: "Small Pets" },
      { slug: "pet-supplies", label: "Accessories & Supplies" },
      { slug: "pet-services", label: "Grooming & Boarding" },
    ],
  },
  {
    slug: "baby-kids",
    label: "Baby & Kids",
    icon: "stroller",
    subcategories: [
      { slug: "strollers-car-seats", label: "Strollers & Car Seats" },
      { slug: "cribs-furniture", label: "Cribs & Furniture" },
      { slug: "clothing", label: "Clothing" },
      { slug: "toys", label: "Toys & Games" },
      { slug: "gear", label: "Feeding & Gear" },
    ],
  },
  {
    slug: "sports-outdoors",
    label: "Sports & Outdoors",
    icon: "bike",
    subcategories: [
      { slug: "bikes", label: "Bicycles" },
      { slug: "winter-sports", label: "Ski & Snowboard" },
      { slug: "hockey", label: "Hockey" },
      { slug: "fitness", label: "Exercise Equipment" },
      { slug: "camping-fishing", label: "Camping & Fishing" },
      { slug: "golf", label: "Golf" },
    ],
  },
  {
    slug: "free-stuff",
    label: "Free Stuff",
    icon: "gift",
    subcategories: [
      { slug: "free-furniture", label: "Furniture" },
      { slug: "free-household", label: "Household" },
      { slug: "free-materials", label: "Building Materials" },
      { slug: "free-other", label: "Other" },
    ],
  },
  {
    slug: "community",
    label: "Community",
    icon: "users",
    subcategories: [
      { slug: "events", label: "Events" },
      { slug: "classes", label: "Classes & Workshops" },
      { slug: "lost-found", label: "Lost & Found" },
      { slug: "volunteers", label: "Volunteers" },
      { slug: "rideshare", label: "Rideshare" },
    ],
  },
];

const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

/** Returns the category, or undefined for an unknown slug. Callers must treat
 *  undefined as "filter not applied" rather than throwing — search URLs are
 *  user-editable and must never 500. */
export function getCategory(slug: string | undefined): Category | undefined {
  return slug ? CATEGORY_BY_SLUG.get(slug) : undefined;
}

export function getCategoryLabel(slug: string): string {
  return CATEGORY_BY_SLUG.get(slug)?.label ?? slug;
}

export function getSubcategoryLabel(
  categorySlug: string,
  subcategorySlug: string | null,
): string | null {
  if (!subcategorySlug) return null;
  const sub = CATEGORY_BY_SLUG.get(categorySlug)?.subcategories.find(
    (s) => s.slug === subcategorySlug,
  );
  return sub?.label ?? subcategorySlug;
}
