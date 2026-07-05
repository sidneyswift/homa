import type { Metadata } from "next";
import { Caveat, Hanken_Grotesk, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";

// Homa Design System v2 fonts (docs/homa-design/tokens/fonts.css), loaded via
// next/font for self-hosting + zero layout shift instead of the DS's raw
// Google Fonts @import. Weights mirror the token file exactly.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
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
    default: "HOMA \u00b7 the homeschool assistant that shows you it's working",
    template: "%s \u00b7 HOMA",
  },
  description:
    "The calm homeschool assistant. HOMA learns each child, makes printable materials just for them, tracks hours for your state, and shows you it's working.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${hankenGrotesk.variable} ${caveat.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
