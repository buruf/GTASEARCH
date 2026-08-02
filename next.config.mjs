/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Aug 2026 pivot: the directory hub was promoted to the homepage.
      // Only the exact hub path redirects — /directory/[category] pages
      // and /directory/search still resolve normally.
      {
        source: "/directory",
        destination: "/",
        permanent: true,
      },
    ];
  },
  images: {
    // Seed data uses picsum.photos placeholders; Phase 2 listing photos are
    // uploaded to Cloudinary (see lib/validation.ts cloudinaryUrlPattern).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "fastly.picsum.photos",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
