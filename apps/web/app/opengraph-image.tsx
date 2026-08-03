import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { colorTokens, logoGeometry } from "@homa/design/contract";

/**
 * Site-wide Open Graph card (1200x630), generated at build time. Design
 * follows the Quiet authority signature: mineral page, one restrained
 * highlight, the real Homa lockup, Garamond display, and a single coral
 * recognition moment. ImageResponse cannot read CSS variables, so colors are
 * imported from the contract and the embedded font files are hashed assets.
 */

export const alt = "Homa, the homeschool assistant that shows you it's working";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG_PAGE = colorTokens.canvas;
const TEXT_STRONG = colorTokens.ink;
const TEXT_MUTED = "#5B5852";
const BRAND = colorTokens.visualCoral;
const CLAY_ACCENT = colorTokens.brandText;
const GOLD_GLOW = colorTokens.highlightTint;

const HOUSE_PATH = logoGeometry.housePath;

// [letter, baseline offset in em, rotation in deg], the bounced wordmark
// from components/brand/Logo.tsx.
const WORDMARK_LETTERS: ReadonlyArray<readonly [string, number, number]> = [
  ["H", -0.06, -3],
  ["o", 0.05, 0],
  ["m", -0.04, 2],
  ["a", 0.06, -2],
];

export default async function Image() {
  const [fredoka, dmSans, ebGaramond] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/fredoka-600-latin.woff")),
    readFile(join(process.cwd(), "assets/fonts/quiet-authority/dm-sans-700-latin.ttf")),
    readFile(join(process.cwd(), "assets/fonts/quiet-authority/eb-garamond-600-latin.ttf")),
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
            <circle cx="17.4" cy="26" r="4.8" fill={colorTokens.paper} />
            <circle cx="30.6" cy="26" r="4.8" fill={colorTokens.paper} />
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
            fontFamily: "EB Garamond",
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
            fontFamily: "DM Sans",
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
        { name: "DM Sans", data: dmSans, weight: 700, style: "normal" },
        { name: "EB Garamond", data: ebGaramond, weight: 600, style: "normal" },
      ],
    },
  );
}
