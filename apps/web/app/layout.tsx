import type { Metadata, Viewport } from "next";
import { DM_Sans, Fredoka } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { DevToolbarSlot } from "../components/dev/dev-toolbar-slot";
import { WaitlistQueueFlusher } from "./waitlist-queue-flusher";

// Temporary legacy font projection. The Quiet authority font projection is
// owned by @homa/design and rolls out through the surface gauntlets.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Keep the display face local. A preview must not depend on Google Fonts being
// reachable while Next generates the font CSS during its production build.
const ebGaramond = localFont({
  src: "../assets/fonts/quiet-authority/eb-garamond-600-latin.ttf",
  variable: "--font-eb-garamond",
  weight: "600",
  display: "swap",
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600"],
});

// JetBrains Mono is not an approved Homa product face. Keep the legacy CSS
// variable defined with the platform monospace fallback while its token
// migration remains separately owned by #729.
const monoFontFallback = {
  "--font-jetbrains": "ui-monospace",
} as React.CSSProperties;

export const metadata: Metadata = {
  metadataBase: new URL("https://thankshoma.com"),
  title: {
    default: "Homa \u00b7 Homeschool, handled.",
    template: "%s \u00b7 Homa",
  },
  description:
    "Homa is an AI assistant for homeschool parents. She plans the week, makes practice pages, keeps teaching hours and records, and shows what to try next.",
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
  themeColor: "#F7F4EE",
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
        "Homa is an AI assistant for homeschool parents. She plans the week, makes practice pages, keeps teaching hours and records, and shows what to try next.",
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
      className={`${dmSans.variable} ${ebGaramond.variable} ${fredoka.variable} h-full antialiased`}
      style={monoFontFallback}
      // The landing page arms its scroll-reveal system pre-paint with an
      // inline script that adds .rv-armed to this element before hydration
      // (app/page.tsx); suppress the one-level attribute check so React
      // does not flag that class as a mismatch. Same pattern as pre-paint
      // theme scripts.
      suppressHydrationWarning
    >
      <body className="quiet-root min-h-full flex flex-col">
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
