import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

// Self-hosted at build time by next/font — no runtime request to Google, which
// would otherwise be a render-blocking third-party round trip and the most
// common reason a page like this misses its mobile performance target.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gtasearch.com"),
  title: {
    default: "GTASearch — Buy, sell and find anything in the Greater Toronto Area",
    template: "%s | GTASearch",
  },
  description:
    "Free classifieds for the Greater Toronto Area. Browse cars, real estate, jobs, electronics, furniture and more across Toronto, Mississauga, Brampton, Markham and the wider GTA.",
  openGraph: {
    type: "website",
    locale: "en_CA",
    siteName: "GTASearch",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-CA" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-btn focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
