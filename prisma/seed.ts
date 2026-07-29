// Seed data for GTASearch.
//
// Idempotent: wipes and recreates. Deterministic: no randomness, so the same
// listings, dates and boosts appear on every run and the UI is comparable
// between sessions.
//
// Run with: npm run db:seed

import { PrismaClient, Prisma } from "@prisma/client";

const db = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

type Boost = "none" | "top" | "featured" | "super";

interface SeedListing {
  title: string;
  description: string;
  price: number | null;
  priceType: "fixed" | "free" | "contact" | "trade";
  category: string;
  subcategory: string;
  city: string;
  neighbourhood: string;
  /** How many days ago it was posted. Drives createdAt and expiresAt. */
  daysAgo: number;
  boost?: Boost;
  /** Set to expire the boost in the past — exercises the effective-boost rule. */
  boostExpired?: boolean;
  images?: number;
  views?: number;
}

const USERS = [
  { email: "amina.hassan@example.com", name: "Amina Hassan", phone: "416-555-0142" },
  { email: "david.chen@example.com", name: "David Chen", phone: "647-555-0178" },
  { email: "priya.sharma@example.com", name: "Priya Sharma", phone: "905-555-0119" },
  { email: "marcus.oliveira@example.com", name: "Marcus Oliveira", phone: null },
  { email: "sarah.kowalski@example.com", name: "Sarah Kowalski", phone: "289-555-0163" },
];

const LISTINGS: SeedListing[] = [
  // ---------------------------------------------------------------- real estate
  {
    title: "Bright 2 bedroom condo near Union Station",
    description:
      "Spacious 2 bed, 2 bath condo on the 18th floor with south-facing views of the lake. Floor-to-ceiling windows, in-suite laundry, stainless steel appliances and a large balcony. Building has a gym, party room and 24 hour concierge. One underground parking spot and a locker included. Steps to the PATH, Union Station and the waterfront. Available immediately, first and last required.",
    price: 2950,
    priceType: "fixed",
    category: "real-estate",
    subcategory: "for-rent",
    city: "toronto",
    neighbourhood: "Downtown",
    daysAgo: 1,
    boost: "super",
    images: 5,
    views: 412,
  },
  {
    title: "Detached 4 bedroom home with finished basement",
    description:
      "Well maintained detached home on a quiet crescent. Four bedrooms upstairs, two full baths, and a fully finished basement with a separate entrance — ideal for an in-law suite or rental income. Renovated kitchen with quartz counters, hardwood throughout the main floor, and a fenced backyard with a mature maple. Double garage plus parking for three. Walking distance to schools and the community centre.",
    price: 1249000,
    priceType: "fixed",
    category: "real-estate",
    subcategory: "for-sale",
    city: "markham",
    neighbourhood: "Unionville",
    daysAgo: 6,
    boost: "featured",
    images: 6,
    views: 288,
  },
  {
    title: "Furnished room for rent, all utilities included",
    description:
      "Clean furnished room available in a quiet, shared townhouse. Includes bed, desk, dresser and closet. Shared kitchen and two bathrooms with one other tenant. Wifi, heat, hydro and water all included in the price. Laundry on site at no extra cost. Close to transit and a ten minute walk to the plaza. No smoking, no pets please. Suitable for a student or working professional.",
    price: 850,
    priceType: "fixed",
    category: "real-estate",
    subcategory: "rooms-shared",
    city: "brampton",
    neighbourhood: "Bramalea",
    daysAgo: 3,
    images: 3,
    views: 97,
  },
  {
    title: "Indoor parking spot available monthly",
    description:
      "Secure underground parking spot available in a well managed building. Gated access with fob entry and cameras throughout the garage. Spot is on P1 close to the elevator, easy to get in and out of, fits a full size SUV comfortably. Month to month, no long term commitment required.",
    price: 175,
    priceType: "fixed",
    category: "real-estate",
    subcategory: "parking-storage",
    city: "etobicoke",
    neighbourhood: "Mimico",
    daysAgo: 11,
    images: 2,
    views: 54,
  },
  {
    title: "Renovated 1 bedroom basement apartment",
    description:
      "Newly renovated one bedroom basement apartment with a private separate entrance. Above grade windows so it gets real daylight, not a dark unit. Brand new kitchen with full size fridge and stove, new three piece bathroom, and vinyl plank flooring throughout. Shared laundry. One parking spot on the driveway included. Quiet residential street, close to the GO station.",
    price: 1650,
    priceType: "fixed",
    category: "real-estate",
    subcategory: "for-rent",
    city: "pickering",
    neighbourhood: "Bay Ridges",
    daysAgo: 8,
    boost: "top",
    images: 4,
    views: 163,
  },

  // -------------------------------------------------------------- cars & vehicles
  {
    title: "2018 Honda Civic EX-T, low kilometres, safetied",
    description:
      "2018 Honda Civic EX-T with 78,000 km. One owner, non smoker, no accidents, clean CarFax available on request. Turbo 1.5L, automatic, sunroof, heated seats, backup camera, Apple CarPlay and Android Auto. Winter tires on steel rims included. Just had an oil change and full inspection, safety certificate included in the asking price. Runs and drives excellent.",
    price: 21500,
    priceType: "fixed",
    category: "cars-vehicles",
    subcategory: "cars-trucks",
    city: "mississauga",
    neighbourhood: "Streetsville",
    daysAgo: 2,
    boost: "super",
    images: 6,
    views: 731,
  },
  {
    title: "2016 Toyota RAV4 AWD, well maintained",
    description:
      "2016 Toyota RAV4 all wheel drive with 142,000 km. Regular dealer maintenance with all records available. Heated seats, backup camera, Bluetooth, cruise control, roof rails. Some minor stone chips on the hood, otherwise the body is in very good shape and the interior is clean. New brakes front and rear last year. Selling because we upgraded to a minivan.",
    price: 17800,
    priceType: "fixed",
    category: "cars-vehicles",
    subcategory: "suvs",
    city: "oshawa",
    neighbourhood: "Taunton",
    daysAgo: 9,
    images: 5,
    views: 344,
  },
  {
    title: "Winter tires 205/55R16 on steel rims, set of 4",
    description:
      "Set of four Michelin X-Ice winter tires mounted on 16 inch steel rims. Used for three seasons, roughly 60 percent tread remaining and wearing evenly. No plugs, patches or sidewall damage. Fits most Civic, Corolla, Elantra and Mazda3 models. Pickup only, they are heavy. Cash on pickup please.",
    price: 380,
    priceType: "fixed",
    category: "cars-vehicles",
    subcategory: "parts-tires",
    city: "ajax",
    neighbourhood: "South Ajax",
    daysAgo: 5,
    images: 3,
    views: 121,
  },
  {
    title: "2019 Yamaha MT-07, garage kept",
    description:
      "2019 Yamaha MT-07 with only 9,400 km. Always garage kept and never ridden in the rain. Adult owned, never dropped. Upgrades include an aftermarket exhaust, frame sliders and a comfort seat. Original exhaust and seat included in the sale. Fresh oil change and new rear tire this spring. Safety available. Serious inquiries only.",
    price: 7900,
    priceType: "fixed",
    category: "cars-vehicles",
    subcategory: "motorcycles",
    city: "barrie",
    neighbourhood: "Allandale",
    daysAgo: 14,
    boost: "featured",
    boostExpired: true,
    images: 4,
    views: 502,
  },
  {
    title: "2014 Ford F-150 XLT, trade for smaller SUV",
    description:
      "2014 F-150 XLT SuperCrew 4x4 with 198,000 km, mostly highway. Solid working truck, tows well, 5.0L V8. Some rust starting on the rear wheel wells which I have been honest about in the photos. Would consider a straight trade for a smaller SUV or crossover in similar condition, or will sell outright. Message me with what you have.",
    price: null,
    priceType: "trade",
    category: "cars-vehicles",
    subcategory: "cars-trucks",
    city: "newmarket",
    neighbourhood: "Armitage",
    daysAgo: 17,
    images: 4,
    views: 209,
  },

  // ------------------------------------------------------------------------ jobs
  {
    title: "Licensed electrician needed, full time",
    description:
      "Established residential and light commercial contractor is hiring a licensed 309A electrician for full time work across the GTA. Must have valid licence, own hand tools, reliable transportation and a clean driving record. Work is a mix of renovations, service calls and new installs. We offer competitive wages based on experience, benefits after three months, and steady year round work. Apprentices with hours may also apply.",
    price: null,
    priceType: "contact",
    category: "jobs",
    subcategory: "skilled-trades",
    city: "vaughan",
    neighbourhood: "Concord",
    daysAgo: 4,
    boost: "top",
    images: 1,
    views: 187,
  },
  {
    title: "Part time barista, weekends",
    description:
      "Independent cafe looking for a friendly part time barista for weekend shifts. Previous espresso experience is an asset but we are happy to train the right person. You should be comfortable on your feet, good with customers and reliable. Roughly 16 to 20 hours per week, Saturday and Sunday, with the possibility of picking up weekday shifts. Tips are pooled and shared.",
    price: null,
    priceType: "contact",
    category: "jobs",
    subcategory: "hospitality",
    city: "toronto",
    neighbourhood: "Leslieville",
    daysAgo: 7,
    images: 1,
    views: 143,
  },
  {
    title: "AZ drivers wanted, local runs, home daily",
    description:
      "Transport company hiring AZ licensed drivers for local and regional runs. Home every day, no long haul. Must have a minimum of two years verifiable experience and a clean abstract and CVOR. We run a modern fleet with automatic transmissions and all trucks are equipped and well maintained. Competitive hourly rate plus overtime after 44 hours, benefits package available.",
    price: null,
    priceType: "contact",
    category: "jobs",
    subcategory: "driving",
    city: "brampton",
    neighbourhood: "Springdale",
    daysAgo: 12,
    images: 1,
    views: 265,
  },
  {
    title: "Administrative assistant, small office",
    description:
      "Small professional office is seeking an organized administrative assistant. Duties include answering phones, scheduling appointments, managing correspondence, basic bookkeeping entry and general office upkeep. Strong written English and comfort with Microsoft Office required. Monday to Friday, regular business hours, no evenings or weekends. Friendly team and a quiet working environment.",
    price: null,
    priceType: "contact",
    category: "jobs",
    subcategory: "office-admin",
    city: "burlington",
    neighbourhood: "Aldershot",
    daysAgo: 19,
    images: 1,
    views: 98,
  },

  // ----------------------------------------------------------------- electronics
  {
    title: "iPhone 13 Pro 256GB unlocked, excellent condition",
    description:
      "iPhone 13 Pro in Sierra Blue, 256GB, factory unlocked and works with any carrier. Battery health is 89 percent. Always kept in a case with a screen protector from day one, so the screen is flawless and there are only very light marks on the stainless frame. Includes the original box and a USB-C to Lightning cable. No trades, no holds, first come first served.",
    price: 610,
    priceType: "fixed",
    category: "electronics",
    subcategory: "phones",
    city: "scarborough",
    neighbourhood: "Agincourt",
    daysAgo: 1,
    boost: "featured",
    images: 4,
    views: 588,
  },
  {
    title: "Dell XPS 15 laptop, 32GB RAM, 1TB SSD",
    description:
      "Dell XPS 15 9520 with an i7 processor, 32GB of RAM and a 1TB NVMe SSD. Excellent machine for development, photo editing or CAD work. 15.6 inch OLED display, backlit keyboard, fingerprint reader. Battery still holds a solid five to six hours of normal use. Small scuff on the bottom casing, screen and keyboard are perfect. Comes with the original 130W charger.",
    price: 1150,
    priceType: "fixed",
    category: "electronics",
    subcategory: "computers",
    city: "toronto",
    neighbourhood: "Liberty Village",
    daysAgo: 3,
    boost: "top",
    images: 5,
    views: 331,
  },
  {
    title: "Samsung 65 inch 4K smart TV",
    description:
      "Samsung 65 inch 4K UHD smart TV, about three years old and working perfectly. Sharp picture, all smart features and apps work, remote included. No dead pixels, no scratches on the screen. Selling because we mounted a larger one in the living room. Stand included, wall bracket is not. You will want a second person to help carry it.",
    price: 425,
    priceType: "fixed",
    category: "electronics",
    subcategory: "tvs-audio",
    city: "mississauga",
    neighbourhood: "Square One",
    daysAgo: 6,
    images: 3,
    views: 219,
  },
  {
    title: "PlayStation 5 with two controllers and 4 games",
    description:
      "PlayStation 5 disc edition in great shape, comes with two DualSense controllers and four games. Console has been kept in a well ventilated open shelf and is regularly dusted, runs quiet and cool. Both controllers have full stick function with no drift. Original box and all cables included. Selling as a bundle only, not parting out.",
    price: 520,
    priceType: "fixed",
    category: "electronics",
    subcategory: "gaming",
    city: "richmond-hill",
    neighbourhood: "Bayview Hill",
    daysAgo: 2,
    images: 4,
    views: 476,
  },
  {
    title: "Canon EOS R6 body with extra battery",
    description:
      "Canon EOS R6 mirrorless body, shutter count just under 21,000. Superb low light performance and in body stabilisation. Body only, no lens included. Comes with two genuine Canon batteries, the charger, the original strap and box. A few light marks on the base plate from tripod use, otherwise cosmetically very clean. Sensor has been professionally cleaned.",
    price: 1750,
    priceType: "fixed",
    category: "electronics",
    subcategory: "cameras",
    city: "oakville",
    neighbourhood: "Old Oakville",
    daysAgo: 10,
    images: 5,
    views: 187,
  },
  {
    title: "Mechanical keyboard and gaming mouse bundle",
    description:
      "Keychron K8 mechanical keyboard with brown switches, wireless and wired, plus a Logitech G502 mouse. Keyboard has PBT keycaps and a wrist rest included. Both work perfectly, no missed keystrokes or double clicks. Cables and dongles included. Great starter set for someone building a desk setup on a budget.",
    price: 95,
    priceType: "fixed",
    category: "electronics",
    subcategory: "accessories",
    city: "vaughan",
    neighbourhood: "Maple",
    daysAgo: 15,
    images: 2,
    views: 76,
  },

  // ------------------------------------------------------------- furniture & home
  {
    title: "Brown leather sectional sofa, excellent condition",
    description:
      "Genuine top grain leather sectional in a warm brown, seats five comfortably. Right hand chaise, which can be positioned on either side. From a smoke free and pet free home. The leather has developed a nice patina but there are no rips, tears or peeling anywhere. Extremely comfortable and very solid underneath. Must be picked up, we can help you load it.",
    price: 850,
    priceType: "fixed",
    category: "furniture-home",
    subcategory: "living-room",
    city: "toronto",
    neighbourhood: "The Annex",
    daysAgo: 2,
    boost: "top",
    images: 5,
    views: 394,
  },
  {
    title: "IKEA Malm dresser, 6 drawer, white",
    description:
      "IKEA Malm six drawer dresser in white. All drawers slide smoothly and the anti tip hardware is included. There is a small chip on the rear left corner which is not visible once the unit is against a wall, shown in the last photo. Disassembled and ready to transport, all hardware bagged and labelled. Assembly instructions included.",
    price: 90,
    priceType: "fixed",
    category: "furniture-home",
    subcategory: "bedroom",
    city: "etobicoke",
    neighbourhood: "The Kingsway",
    daysAgo: 4,
    images: 3,
    views: 152,
  },
  {
    title: "Solid wood dining table with 6 chairs",
    description:
      "Solid oak dining table with six matching upholstered chairs. Table measures 72 by 38 inches and includes a removable leaf that extends it to 90 inches for larger gatherings. Some light surface scratches on the top consistent with normal family use, structurally rock solid with no wobble. Chairs are all tight with clean fabric.",
    price: 575,
    priceType: "fixed",
    category: "furniture-home",
    subcategory: "dining-kitchen",
    city: "burlington",
    neighbourhood: "Millcroft",
    daysAgo: 8,
    images: 4,
    views: 168,
  },
  {
    title: "LG front load washer and dryer pair",
    description:
      "Matching LG front load washer and dryer, both fully working and recently used daily without issue. Roughly six years old. Large capacity, great for families. Includes the stacking kit if you need to save space, plus hoses. Dryer is electric, not gas. Selling because our new place has laundry included. Buyer must disconnect and remove.",
    price: 700,
    priceType: "fixed",
    category: "furniture-home",
    subcategory: "appliances",
    city: "oshawa",
    neighbourhood: "Windfields",
    daysAgo: 13,
    images: 3,
    views: 233,
  },
  {
    title: "Queen bed frame with upholstered headboard",
    description:
      "Queen size platform bed frame with a tall grey upholstered headboard. Slatted base so no box spring is required. Fabric is clean with no stains or pet damage. Very sturdy with no squeaks. Mattress is not included. Comes apart into four pieces for transport and fits in most SUVs with the seats down.",
    price: 240,
    priceType: "fixed",
    category: "furniture-home",
    subcategory: "bedroom",
    city: "newmarket",
    neighbourhood: "Glenway",
    daysAgo: 16,
    images: 3,
    views: 111,
  },
  {
    title: "Patio set, table with 4 chairs and umbrella",
    description:
      "Outdoor patio dining set including a tempered glass top table, four cushioned chairs and a tilting umbrella with base. Powder coated aluminium frame so it does not rust. Cushions have been stored indoors every winter and are still in good shape with no fading or mildew. Everything shown in the photos is included.",
    price: 310,
    priceType: "fixed",
    category: "furniture-home",
    subcategory: "garden-outdoor",
    city: "pickering",
    neighbourhood: "Amberlea",
    daysAgo: 21,
    images: 4,
    views: 89,
  },

  // -------------------------------------------------------- clothing & accessories
  {
    title: "Canada Goose parka, women's small, authentic",
    description:
      "Authentic Canada Goose Trillium parka in black, women's small. Purchased from a licensed retailer, hologram tag intact and serial number present. Worn for two winters and professionally cleaned at the end of last season. Fur ruff is removable. No rips, no broken zippers, all snaps work. Extremely warm, easily handles a Toronto January.",
    price: 620,
    priceType: "fixed",
    category: "clothing-accessories",
    subcategory: "womens",
    city: "toronto",
    neighbourhood: "Yorkville",
    daysAgo: 5,
    boost: "featured",
    images: 4,
    views: 341,
  },
  {
    title: "Men's dress shoes, size 10, barely worn",
    description:
      "Brown leather oxford dress shoes in size 10. Worn twice, to a wedding and an interview, so the soles are barely marked. Genuine leather upper and lining, Goodyear welted so they can be resoled. Original box and dust bags included. Selling because they run slightly narrow for me. A great deal on a shoe that retails for well over three times this price.",
    price: 85,
    priceType: "fixed",
    category: "clothing-accessories",
    subcategory: "shoes",
    city: "mississauga",
    neighbourhood: "Erin Mills",
    daysAgo: 12,
    images: 3,
    views: 67,
  },
  {
    title: "Leather handbag, genuine, like new",
    description:
      "Genuine pebbled leather handbag in tan, used only a handful of times. Interior is spotless with no pen marks or stains, which is usually the first thing to go on a used bag. All hardware is bright with no scratches, and the zipper runs smoothly. Includes the dust bag. Fits a 13 inch laptop, a tablet and everything else you need for a work day.",
    price: 140,
    priceType: "fixed",
    category: "clothing-accessories",
    subcategory: "bags-luggage",
    city: "markham",
    neighbourhood: "Thornhill",
    daysAgo: 18,
    images: 3,
    views: 124,
  },

  // -------------------------------------------------------------------- services
  {
    title: "Professional moving service, 2 movers and truck",
    description:
      "Fully insured moving company serving the entire GTA. Two experienced movers and a 26 foot truck, with blankets, straps, dollies and shrink wrap all included at no extra charge. We handle apartments, condos, houses and small offices. No hidden fees and no charge for stairs or elevators. Same day and weekend availability. Call or message for a free quote.",
    price: 130,
    priceType: "fixed",
    category: "services",
    subcategory: "moving-storage",
    city: "toronto",
    neighbourhood: "Downtown",
    daysAgo: 3,
    boost: "super",
    images: 3,
    views: 549,
  },
  {
    title: "House cleaning, weekly or biweekly",
    description:
      "Reliable and thorough house cleaning with over eight years of experience and references available on request. Regular weekly, biweekly or monthly service, plus deep cleans and move in or move out cleans. I bring my own supplies and equipment, and eco friendly products are available on request. Fully bonded. Serving Mississauga, Oakville and west Toronto.",
    price: null,
    priceType: "contact",
    category: "services",
    subcategory: "cleaning",
    city: "mississauga",
    neighbourhood: "Clarkson",
    daysAgo: 9,
    images: 2,
    views: 176,
  },
  {
    title: "Math and physics tutoring, grades 9 to 12",
    description:
      "Certified Ontario teacher offering tutoring in mathematics and physics for grades 9 through 12, including advanced functions, calculus and vectors. Lessons can be in person at your home or online, whichever suits. I focus on building genuine understanding rather than memorising steps, and provide practice material tailored to your child's course and teacher. First session is half price.",
    price: 45,
    priceType: "fixed",
    category: "services",
    subcategory: "tutoring",
    city: "richmond-hill",
    neighbourhood: "Mill Pond",
    daysAgo: 7,
    boost: "top",
    images: 1,
    views: 203,
  },
  {
    title: "Licensed plumber, drain cleaning and repairs",
    description:
      "Licensed and insured plumber available for repairs, installations and drain cleaning across Durham Region. Faucets, toilets, sump pumps, water heaters, backed up drains and emergency leaks. Upfront pricing agreed before any work starts, so there are no surprises on the invoice. Evening and weekend calls accepted. Over fifteen years in the trade.",
    price: null,
    priceType: "contact",
    category: "services",
    subcategory: "renovation",
    city: "ajax",
    neighbourhood: "Westney Heights",
    daysAgo: 20,
    images: 2,
    views: 142,
  },

  // ------------------------------------------------------------------------ pets
  {
    title: "Large dog crate, folding metal, like new",
    description:
      "Heavy duty folding wire dog crate suitable for a large breed, roughly 42 inches long. Includes the removable plastic tray for easy cleaning and a divider panel so it can grow with a puppy. Folds flat in seconds for storage or travel. Used for only a few months during crate training. No rust, no bent bars, both doors latch securely.",
    price: 75,
    priceType: "fixed",
    category: "pets",
    subcategory: "pet-supplies",
    city: "scarborough",
    neighbourhood: "Guildwood",
    daysAgo: 6,
    images: 3,
    views: 94,
  },
  {
    title: "Professional dog grooming, all breeds",
    description:
      "Certified groomer with a fully equipped home salon offering baths, haircuts, nail trims, ear cleaning and de-shedding treatments for all breeds and sizes. Small, calm environment with one dog at a time, which suits anxious or senior dogs far better than a busy shop. Appointments only. Please message with your dog's breed and approximate weight for a quote.",
    price: null,
    priceType: "contact",
    category: "pets",
    subcategory: "pet-services",
    city: "vaughan",
    neighbourhood: "Woodbridge",
    daysAgo: 11,
    images: 2,
    views: 118,
  },
  {
    title: "Cat tree, 5 feet tall with scratching posts",
    description:
      "Five foot tall cat tree with three platforms, a covered hideaway, a hanging toy and sisal wrapped scratching posts on every level. Sturdy base that does not tip even when two cats are chasing each other up it. Some normal wear on the sisal, all carpet surfaces are clean and have been vacuumed. Our cats have moved on to a window perch.",
    price: 45,
    priceType: "fixed",
    category: "pets",
    subcategory: "pet-supplies",
    city: "barrie",
    neighbourhood: "Holly",
    daysAgo: 22,
    images: 2,
    views: 61,
  },

  // ------------------------------------------------------------------ baby & kids
  {
    title: "UPPAbaby Vista stroller with bassinet",
    description:
      "UPPAbaby Vista stroller in excellent condition, including the bassinet attachment, toddler seat, rain shield and bug net. Wheels roll smoothly and all the brakes and folding mechanisms work exactly as they should. Fabric has been washed and is clean with no stains. This is a fantastic system that converts to a double later if you need it. Manual included.",
    price: 550,
    priceType: "fixed",
    category: "baby-kids",
    subcategory: "strollers-car-seats",
    city: "oakville",
    neighbourhood: "Glen Abbey",
    daysAgo: 4,
    boost: "featured",
    images: 5,
    views: 297,
  },
  {
    title: "Convertible crib with toddler rail and mattress",
    description:
      "Solid wood convertible crib in natural finish, converts from a crib to a toddler bed to a daybed. Toddler conversion rail and all original hardware included. Comes with a barely used firm mattress that meets current Canadian safety standards. No recalls on this model. Disassembled and ready to go, instructions included.",
    price: 180,
    priceType: "fixed",
    category: "baby-kids",
    subcategory: "cribs-furniture",
    city: "brampton",
    neighbourhood: "Mount Pleasant",
    daysAgo: 14,
    images: 3,
    views: 132,
  },
  {
    title: "Box of toddler boy clothes, 2T to 3T",
    description:
      "Large box of toddler boy clothing in sizes 2T and 3T. Includes roughly forty pieces: long sleeve tops, t-shirts, pants, two pairs of pyjamas and a light spring jacket. Brands include Carter's, Joe Fresh and Gap. Everything has been washed and is in good used condition, a few items still have tags. Taking the whole box only please, no picking through.",
    price: 40,
    priceType: "fixed",
    category: "baby-kids",
    subcategory: "clothing",
    city: "oshawa",
    neighbourhood: "Lakeview",
    daysAgo: 17,
    images: 2,
    views: 73,
  },

  // ------------------------------------------------------------- sports & outdoors
  {
    title: "Trek hybrid bike, medium frame, tuned up",
    description:
      "Trek FX hybrid bike with a medium aluminium frame, suits riders roughly five foot seven to six foot. Just back from a full tune up at a local shop: new cables, new chain, trued wheels and fresh brake pads. Rides smooth and shifts crisply through all gears. Comfortable upright position, great for commuting or the waterfront trail. Includes a kickstand and bottle cage.",
    price: 395,
    priceType: "fixed",
    category: "sports-outdoors",
    subcategory: "bikes",
    city: "toronto",
    neighbourhood: "High Park",
    daysAgo: 5,
    boost: "top",
    images: 4,
    views: 268,
  },
  {
    title: "Bauer hockey skates, size 9, sharpened",
    description:
      "Bauer Vapor hockey skates in senior size 9. Blades have plenty of steel left and have just been freshly sharpened, so they are ready to go straight on the ice. Boots still hold good structure with no cracking in the eyelets or the ankle. Have been baked once for fit. Comes with blade guards and a carry bag.",
    price: 110,
    priceType: "fixed",
    category: "sports-outdoors",
    subcategory: "hockey",
    city: "markham",
    neighbourhood: "Cornell",
    daysAgo: 10,
    images: 3,
    views: 105,
  },
  {
    title: "Adjustable dumbbell set, 5 to 52.5 lbs",
    description:
      "Pair of adjustable dumbbells that replace fifteen sets of weights, adjusting from 5 up to 52.5 pounds each with a dial. Includes both cradles. Everything locks in reliably with no rattling or slipping mid set. A serious space saver for a home gym or a condo. These are heavy, so please bring a bag or a hand truck.",
    price: 480,
    priceType: "fixed",
    category: "sports-outdoors",
    subcategory: "fitness",
    city: "mississauga",
    neighbourhood: "Meadowvale",
    daysAgo: 8,
    images: 3,
    views: 314,
  },
  {
    title: "4 person tent with vestibule, used twice",
    description:
      "Four person dome tent with a full rainfly and a covered vestibule for boots and packs. Used on two weekend trips and always dried thoroughly before being packed away, so there is no mildew or musty smell. All poles are straight, no tears in the fly or floor, and every zipper runs cleanly. Includes stakes, guylines and the original stuff sack.",
    price: 120,
    priceType: "fixed",
    category: "sports-outdoors",
    subcategory: "camping-fishing",
    city: "newmarket",
    neighbourhood: "Stonehaven",
    daysAgo: 15,
    images: 3,
    views: 88,
  },
  {
    title: "Full set of golf clubs with stand bag",
    description:
      "Complete set of golf clubs including driver, three wood, hybrid, irons four through pitching wedge, sand wedge and putter. Comes with a lightweight stand bag with a rain hood. Grips are still tacky and were replaced two seasons ago. Good honest set for a beginner or an improving player who does not want to spend a fortune. A few head covers included.",
    price: 265,
    priceType: "fixed",
    category: "sports-outdoors",
    subcategory: "golf",
    city: "burlington",
    neighbourhood: "Roseland",
    daysAgo: 23,
    images: 4,
    views: 96,
  },

  // ------------------------------------------------------------------ free stuff
  {
    title: "Free moving boxes, various sizes",
    description:
      "About twenty five moving boxes in assorted sizes, all clean, dry and flattened for easy transport. Mostly small and medium book boxes plus a few large ones. Also included is a partial roll of packing tape and some bubble wrap we did not use. First come first served, they are on the porch. Please take all of them if you can.",
    price: null,
    priceType: "free",
    category: "free-stuff",
    subcategory: "free-household",
    city: "etobicoke",
    neighbourhood: "Long Branch",
    daysAgo: 1,
    images: 2,
    views: 187,
  },
  {
    title: "Free sofa, needs to go this weekend",
    description:
      "Three seater fabric sofa, free to whoever can pick it up this weekend. It is comfortable and structurally sound with no broken springs, but the cushions are faded and there is a small tear on one arm which I have photographed honestly. Perfect for a basement, a garage or a first apartment. You will need two people and a truck or van.",
    price: null,
    priceType: "free",
    category: "free-stuff",
    subcategory: "free-furniture",
    city: "scarborough",
    neighbourhood: "Birch Cliff",
    daysAgo: 2,
    images: 3,
    views: 421,
  },
  {
    title: "Free interlocking patio stones, you dig and haul",
    description:
      "Approximately one hundred and fifty interlocking patio stones available free to anyone willing to lift them and haul them away. They are currently in place in the backyard, so this is a dig up job, not a pile ready to load. Standard grey rectangular pavers, some have moss on them but they clean up fine with a pressure washer. Bring gloves and a wheelbarrow.",
    price: null,
    priceType: "free",
    category: "free-stuff",
    subcategory: "free-materials",
    city: "pickering",
    neighbourhood: "Rougemount",
    daysAgo: 9,
    images: 2,
    views: 156,
  },

  // ------------------------------------------------------------------- community
  {
    title: "Community garage sale, Saturday morning",
    description:
      "Annual neighbourhood garage sale running this Saturday from 8am to 2pm, rain or shine. Over twenty households taking part along the street and the surrounding crescents. Expect furniture, tools, kids toys, books, sporting goods, kitchenware and plenty of surprises. Cash is best, though some sellers may take e-transfer. Come early for the good stuff, parking is easiest on the main road.",
    price: null,
    priceType: "free",
    category: "community",
    subcategory: "events",
    city: "richmond-hill",
    neighbourhood: "Oak Ridges",
    daysAgo: 2,
    images: 2,
    views: 233,
  },
  {
    title: "Beginner pottery workshop, small group",
    description:
      "Four week beginner pottery workshop in a small studio, limited to six people so everyone gets real attention and plenty of wheel time. All clay, tools, glazing and firing are included in the price. No experience needed at all. You will finish the course with several pieces of your own. Runs Wednesday evenings from 7 to 9pm. Message to reserve a spot.",
    price: 180,
    priceType: "fixed",
    category: "community",
    subcategory: "classes",
    city: "toronto",
    neighbourhood: "Little Italy",
    daysAgo: 12,
    images: 3,
    views: 147,
  },
  {
    title: "Lost tabby cat near the lakefront, reward",
    description:
      "Our tabby cat slipped out of the back door on the evening of the 12th and has not come home. He is a brown and grey tabby with a white chest and white front paws, and he is microchipped but not wearing a collar. He is shy and likely hiding under a porch or a deck rather than out in the open. Please check your garages and sheds. Reward offered for his safe return.",
    price: null,
    priceType: "free",
    category: "community",
    subcategory: "lost-found",
    city: "burlington",
    neighbourhood: "Alton Village",
    daysAgo: 4,
    images: 2,
    views: 512,
  },
];

function imagesFor(slug: string, count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `https://picsum.photos/seed/${slug}-${i}/800/600`,
  );
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function main() {
  console.log("Clearing existing data...");
  // Order matters: children before parents, even with cascades declared.
  await db.report.deleteMany();
  await db.boostPayment.deleteMany();
  await db.savedListing.deleteMany();
  await db.message.deleteMany();
  await db.conversation.deleteMany();
  await db.listing.deleteMany();
  await db.user.deleteMany();

  console.log(`Creating ${USERS.length} users...`);
  const users = [];
  for (const [i, u] of USERS.entries()) {
    users.push(
      await db.user.create({
        data: {
          email: u.email,
          name: u.name,
          phone: u.phone,
          // Stagger join dates so "member since" varies on listing pages.
          createdAt: new Date(now - (120 + i * 95) * DAY),
        },
      }),
    );
  }

  console.log(`Creating ${LISTINGS.length} listings...`);
  let count = 0;
  for (const [i, l] of LISTINGS.entries()) {
    const createdAt = new Date(now - l.daysAgo * DAY);
    const boost = l.boost ?? "none";

    // Boosted listings get an expiry 7 days out from posting. The one flagged
    // boostExpired gets a past date instead, so the search ordering rule that
    // ignores lapsed boosts is exercised by real seeded data.
    let boostExpiresAt: Date | null = null;
    if (boost !== "none") {
      boostExpiresAt = l.boostExpired
        ? new Date(now - 2 * DAY)
        : new Date(createdAt.getTime() + 7 * DAY);
    }

    await db.listing.create({
      data: {
        title: l.title,
        description: l.description,
        price: l.price === null ? null : new Prisma.Decimal(l.price),
        priceType: l.priceType,
        category: l.category,
        subcategory: l.subcategory,
        city: l.city,
        neighbourhood: l.neighbourhood,
        // Deliberately populated to prove it is never leaked to the client.
        postalCode: `M${(i % 9) + 1}A 1B${i % 10}`,
        images: imagesFor(slugify(l.title), l.images ?? 3),
        status: "active",
        boostLevel: boost,
        boostExpiresAt,
        expiresAt: new Date(createdAt.getTime() + 30 * DAY),
        views: l.views ?? 0,
        userId: users[i % users.length].id,
        createdAt,
        updatedAt: createdAt,
      },
    });
    count++;
  }

  const byBoost = await db.listing.groupBy({
    by: ["boostLevel"],
    _count: true,
  });

  console.log(`\nSeeded ${count} listings across ${users.length} users.`);
  console.log("Boost distribution:");
  for (const b of byBoost) console.log(`  ${b.boostLevel}: ${b._count}`);
  const expired = await db.listing.count({
    where: { boostLevel: { not: "none" }, boostExpiresAt: { lt: new Date() } },
  });
  console.log(`  (${expired} with a lapsed boost, for ordering tests)`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
