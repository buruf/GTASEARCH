import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design system from the product brief.
        brand: {
          DEFAULT: "#2E7D32",
          dark: "#1B5E20",
          light: "#66BB6A",
          // Tinted surfaces derived from the primary, for badges and hovers.
          50: "#F1F8F2",
          100: "#DCEDDE",
        },
        ink: {
          DEFAULT: "#212121",
          muted: "#616161",
          faint: "#9E9E9E",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          alt: "#F5F5F5",
        },
        line: "#E0E0E0",
      },
      borderRadius: {
        card: "8px",
        btn: "6px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
