import type { Metadata, Viewport } from "next";
import { Caveat, EB_Garamond, Fredoka, Hanken_Grotesk, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { DevToolbarSlot } from "../components/dev/dev-toolbar-slot";
import { WaitlistQueueFlusher } from "./waitlist-queue-flusher";

// Homa Design System v3 fonts (docs/homa-design/tokens/fonts.css), loaded via
// next/font for self-hosting + zero layout shift instead of the DS's raw
// Google Fonts @import. Weights mirror the token file exactly.
const schibstedGrotesk = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://thankshoma.com"),
  title: {
    default: "Homa \u00b7 the homeschool assistant that shows you it's working",
    template: "%s \u00b7 Homa",
  },
  description:
    "The calm homeschool assistant. Homa learns each child, makes printable materials just for them, tracks hours for your state, and shows you it's working.",
  // Attribution meta: no personal bylines to fabricate (copy laws), so the
  // organization is the named author everywhere.
  applicationName: "Homa",
  authors: [{ name: "Homa", url: "https://thankshoma.com" }],
  creator: "Homa",
  publisher: "Homa",
  openGraph: {
    siteName: "Homa",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
  // Default is already index+follow; the googleBot extras lift the caps on
  // snippet length and image preview size in search results.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#FBF7F0",
};

/**
 * Site-wide entity graph, rendered on every page. Page-level schema
 * (WebApplication + FAQPage on the landing, Article on blog posts) points
 * at the Organization node by @id instead of re-declaring it.
 */
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://thankshoma.com/#organization",
      name: "Homa",
      url: "https://thankshoma.com",
      email: "hello@mail.thankshoma.com",
      description:
        "The calm homeschool assistant. Homa learns each child, makes printable materials just for them, tracks hours for your state, and shows you it's working.",
    },
    {
      "@type": "WebSite",
      "@id": "https://thankshoma.com/#website",
      name: "Homa",
      url: "https://thankshoma.com",
      publisher: { "@id": "https://thankshoma.com/#organization" },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${schibstedGrotesk.variable} ${ebGaramond.variable} ${fredoka.variable} ${hankenGrotesk.variable} ${caveat.variable} ${jetBrainsMono.variable} h-full antialiased`}
      // The landing page arms its scroll-reveal system pre-paint with an
      // inline script that adds .rv-armed to this element before hydration
      // (app/page.tsx); suppress the one-level attribute check so React
      // does not flag that class as a mismatch. Same pattern as pre-paint
      // theme scripts.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd).replace(/</g, "\\u003c") }}
        />
        <WaitlistQueueFlusher />
        {/* Development only, and it renders null unless the reset route
            exists and this is a test family. See dev-toolbar-slot.tsx. */}
        <DevToolbarSlot />
        {children}
        {/* Pageview beacon for the landing -> signup conversion denominator
            (docs/homa-planning/journeys/06-metrics-instrumentation.md). Product
            events stay first-party in public.events; pageviews are the one
            metric allowed outside it. No-ops when Vercel Analytics is off. */}
        <Analytics />
      </body>
    </html>
  );
}
