/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Seed data uses picsum.photos placeholders. Phase 2 adds Cloudinary here.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "fastly.picsum.photos",
      },
    ],
  },
};

export default nextConfig;
