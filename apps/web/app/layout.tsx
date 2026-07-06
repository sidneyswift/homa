import type { Metadata } from "next";
import { Caveat, EB_Garamond, Fredoka, Hanken_Grotesk, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

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
    >
      <body className="min-h-full flex flex-col">
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
