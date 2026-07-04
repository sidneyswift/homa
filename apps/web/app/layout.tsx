import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// WIREFRAME: neutral metadata only; SEO title/description come from the
// copy kit (journeys/07 §5) with the design pass.
export const metadata: Metadata = {
  metadataBase: new URL("https://thankshoma.com"),
  title: {
    default: "HOMA",
    template: "%s · HOMA",
  },
  description: "A homeschool assistant for families. Join the waitlist.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
