/** @type {import('next').NextConfig} */
const nextConfig = {
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
