import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Site-wide Open Graph card (1200x630), generated at build time. Design
 * follows the landing hero: cream page, one gold glow (rule of restraint:
 * one playful device), the little-home lockup with the bounced Fredoka
 * wordmark, display headline with the single clay accent word. Colors are
 * hand-copied hexes from globals.css tokens (ImageResponse cannot read CSS
 * variables); if the tokens change, update these too. Fonts are the latin
 * WOFF subsets vendored in apps/web/assets/fonts/.
 */

export const alt = "Homa, the homeschool assistant that shows you it's working";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// globals.css tokens, by hand: stone-50, stone-600, stone-900 (text-strong),
// clay-500 (brand), clay-600, gold-100.
const BG_PAGE = "#FBF7F0";
const TEXT_STRONG = "#221E1A";
const TEXT_MUTED = "#6B6259";
const BRAND = "#E7602F";
const CLAY_ACCENT = "#C44C22";
const GOLD_GLOW = "#FFF3C2";

const HOUSE_PATH =
  "M24 5.6 C22.5 5.6 21 6.2 19.8 7.3 L7.1 18.9 C5.5 20.4 4.6 22.5 4.6 24.7 L4.6 35.2 C4.6 40.1 8.5 44 13.4 44 L34.6 44 C39.5 44 43.4 40.1 43.4 35.2 L43.4 24.7 C43.4 22.5 42.5 20.4 40.9 18.9 L28.2 7.3 C27 6.2 25.5 5.6 24 5.6 Z";

// [letter, baseline offset in em, rotation in deg], the bounced wordmark
// from components/brand/Logo.tsx.
const WORDMARK_LETTERS: ReadonlyArray<readonly [string, number, number]> = [
  ["H", -0.06, -3],
  ["o", 0.05, 0],
  ["m", -0.04, 2],
  ["a", 0.06, -2],
];

export default async function Image() {
  const [fredoka, schibsted] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/fredoka-600-latin.woff")),
    readFile(join(process.cwd(), "assets/fonts/schibsted-grotesk-700-latin.woff")),
  ]);

  const wordmarkSize = 84;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px 64px",
          backgroundColor: BG_PAGE,
          // The landing hero's corner glow, same geometry as globals.css.
          backgroundImage: `radial-gradient(100% 130% at 88% 0%, ${GOLD_GLOW} 0%, ${BG_PAGE} 58%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <svg width={88} height={88} viewBox="0 0 48 48">
            <path d={HOUSE_PATH} fill={BRAND} />
            <circle cx="17.4" cy="26" r="4.8" fill="#FFFFFF" />
            <circle cx="30.6" cy="26" r="4.8" fill="#FFFFFF" />
            <circle cx="18.3" cy="26.7" r="2.2" fill={TEXT_STRONG} />
            <circle cx="31.5" cy="26.7" r="2.2" fill={TEXT_STRONG} />
          </svg>
          <div style={{ display: "flex" }}>
            {WORDMARK_LETTERS.map(([letter, offsetEm, rotateDeg]) => (
              <div
                key={letter}
                style={{
                  display: "flex",
                  fontFamily: "Fredoka",
                  fontSize: wordmarkSize,
                  color: TEXT_STRONG,
                  transform: `translateY(${offsetEm * wordmarkSize}px) rotate(${rotateDeg}deg)`,
                }}
              >
                {letter}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontFamily: "Schibsted Grotesk",
            fontSize: 66,
            lineHeight: 1.08,
            letterSpacing: "-0.015em",
            color: TEXT_STRONG,
            maxWidth: 980,
          }}
        >
          <div style={{ display: "flex" }}>
            The homeschool&nbsp;<span style={{ color: CLAY_ACCENT }}>assistant</span>
          </div>
          <div style={{ display: "flex" }}>that shows you it&#8217;s working.</div>
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: "Schibsted Grotesk",
            fontSize: 30,
            color: TEXT_MUTED,
          }}
        >
          thankshoma.com
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fredoka", data: fredoka, weight: 600, style: "normal" },
        { name: "Schibsted Grotesk", data: schibsted, weight: 700, style: "normal" },
      ],
    },
  );
}
