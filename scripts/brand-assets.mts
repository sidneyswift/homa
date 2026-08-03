/**
 * Generate the static Homa brand assets from the design-system logo geometry
 * (@homa/design's generated brand contract, projected in web and native
 * adapters). Run with: pnpm gen:brand
 *
 * Outputs:
 * - apps/web/public/brand/homa-lockup.svg / .png    (mark + bounced wordmark, light surfaces)
 * - apps/web/public/brand/homa-lockup-dark.svg / .png (reversed: clay-400 mark, white wordmark)
 * - apps/web/public/brand/homa-mark.svg             (the little-home mark alone)
 * - apps/web/public/brand/homa-mark-512.png
 * - apps/web/app/icon.svg                           (SVG favicon, same mark)
 * - apps/web/app/favicon.ico                        (16/32/48 fallback favicon)
 * - marketing/assets/brand/                         (same lockups + the avatar-safe
 *   padded mark at 512/120, for social profiles, OAuth screens, thumbnails)
 * - marketing/assets/brand/phone/                   (solid-background rasters:
 *   1024 contact photos / pfps in the brand card's three surface treatments,
 *   and 1320x2868 phone wallpapers, the largest current iPhone resolution,
 *   iOS scales down cleanly. Solid backgrounds on purpose: iOS composites
 *   transparent avatars onto an auto-picked color that can swallow the mark.)
 *
 * The wordmark letters are converted to vector paths via satori + the vendored
 * Fredoka 600 WOFF, so the SVGs render correctly without the font installed.
 * Token hexes are inlined from the Quiet authority contract so generated
 * distribution assets do not create a second palette authority.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import sharp from "sharp";
import { colorTokens, logoGeometry } from "../packages/design/src/contract/index.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_ROOT = join(REPO_ROOT, "apps/web");
const BRAND_DIR = join(WEB_ROOT, "public/brand");
const MARKETING_BRAND_DIR = join(REPO_ROOT, "marketing/assets/brand");

const CLAY_500 = colorTokens.visualCoral;
const CLAY_400 = colorTokens.visualCoral;
const STONE_900 = colorTokens.ink;
const CLAY_50 = "#FBE8DF";
const BG_PAGE = colorTokens.canvas;
const NIGHT_NAVY = colorTokens.containedBand;

const HOUSE_PATH = logoGeometry.housePath;

// [letter, baseline offset in em, rotation in deg], the bounced wordmark.
const WORDMARK_LETTERS: ReadonlyArray<readonly [string, number, number]> = [
  ["H", -0.06, -3],
  ["o", 0.05, 0],
  ["m", -0.04, 2],
  ["a", 0.06, -2],
];

// Lockup proportions from the Logo component, rendered at mark size 96 for
// sub-pixel precision: gap size*0.3, wordmark font size*0.98, top nudge -0.04.
const MARK_SIZE = 96;
const CANVAS = { width: 560, height: 200 };

/** Satori element helper (satori takes plain React-shaped objects). */
function el(type: string, props: Record<string, unknown>, ...children: unknown[]) {
  return { type, props: { ...props, children: children.length === 1 ? children[0] : children } };
}

function houseMarkElement(size: number, body: string) {
  return el(
    "svg",
    { width: size, height: size, viewBox: "0 0 48 48" },
    el("path", { d: HOUSE_PATH, fill: body }),
    el("circle", { cx: 17.4, cy: 26, r: 4.8, fill: colorTokens.paper }),
    el("circle", { cx: 30.6, cy: 26, r: 4.8, fill: colorTokens.paper }),
    el("circle", { cx: 18.3, cy: 26.7, r: 2.2, fill: STONE_900 }),
    el("circle", { cx: 31.5, cy: 26.7, r: 2.2, fill: STONE_900 }),
  );
}

function lockupElement(tone: "light" | "dark") {
  const body = tone === "dark" ? CLAY_400 : CLAY_500;
  const word = tone === "dark" ? colorTokens.paper : STONE_900;
  const fontSize = MARK_SIZE * 0.98;

  return el(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    },
    el(
      "div",
      { style: { display: "flex", alignItems: "center", gap: MARK_SIZE * 0.3 } },
      houseMarkElement(MARK_SIZE, body),
      el(
        "div",
        { style: { display: "flex", marginTop: MARK_SIZE * -0.04 } },
        ...WORDMARK_LETTERS.map(([letter, offsetEm, rotateDeg]) =>
          el(
            "div",
            {
              style: {
                display: "flex",
                fontFamily: "Fredoka",
                fontWeight: 600,
                fontSize,
                lineHeight: 1,
                color: word,
                transform: `translateY(${offsetEm * fontSize}px) rotate(${rotateDeg}deg)`,
              },
            },
            letter,
          ),
        ),
      ),
    ),
  );
}

/**
 * Tighten a satori SVG (fixed canvas) to its inked content: rasterize at 4x,
 * measure sharp's transparent-edge trim, map the offsets back to SVG units,
 * and rewrite the root viewBox with half a unit of anti-aliasing padding.
 */
async function cropSvgToContent(svg: string): Promise<string> {
  const scale = 4;
  const { info } = await sharp(Buffer.from(svg), { density: 72 * scale })
    .trim()
    .png()
    .toBuffer({ resolveWithObject: true });

  const pad = 0.5;
  const x = Math.abs(info.trimOffsetLeft ?? 0) / scale - pad;
  const y = Math.abs(info.trimOffsetTop ?? 0) / scale - pad;
  const width = info.width / scale + pad * 2;
  const height = info.height / scale + pad * 2;

  const round = (n: number) => Math.round(n * 100) / 100;
  return svg.replace(
    /^<svg width="\d+" height="\d+" viewBox="[^"]*"/,
    `<svg width="${round(width)}" height="${round(height)}" viewBox="${round(x)} ${round(y)} ${round(width)} ${round(height)}"`,
  );
}

const MARK_BOXES = {
  standard: "0 0 48 48",
  tight: "4.2 5 39.6 39.6",
  avatar: "-8 -8 64 64",
} as const;

// The two brand-card mark colorways (guidelines/brand-logo-lockup.card.html):
// solid = colored house with white eyes; inverse = white house with colored
// eyes (the app-icon treatment for sitting on a clay surface).
function markSvgColored(
  viewBox: keyof typeof MARK_BOXES,
  colors: { body: string; eyes: string; pupils: string },
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_BOXES[viewBox]}">
  <!-- The little-home mark from components/brand/Logo.tsx, token hexes
       inlined. Generated by scripts/brand-assets.mts, do not edit by hand. -->
  <path d="${HOUSE_PATH}" fill="${colors.body}"/>
  <circle cx="17.4" cy="26" r="4.8" fill="${colors.eyes}"/>
  <circle cx="30.6" cy="26" r="4.8" fill="${colors.eyes}"/>
  <circle cx="18.3" cy="26.7" r="2.2" fill="${colors.pupils}"/>
  <circle cx="31.5" cy="26.7" r="2.2" fill="${colors.pupils}"/>
</svg>
`;
}

/**
 * The little-home mark (solid treatment) in three crops:
 * - "standard": the component's own 48x48 canvas and breathing room
 * - "tight": cropped to the house bounds so favicon raster sizes (16/32)
 *   use the whole pixel grid and the eyes stay readable
 * - "avatar": 48 mark centered on a 64 canvas so circular crops (social
 *   profiles, OAuth consent screens) never clip the corners
 */
function markSvg(viewBox: keyof typeof MARK_BOXES = "standard"): string {
  return markSvgColored(viewBox, { body: CLAY_500, eyes: colorTokens.paper, pupils: STONE_900 });
}

/** Solid-background raster: the mark centered on a filled canvas (no alpha). */
async function renderMarkOnBackground(options: {
  markSvgText: string;
  markWidth: number;
  canvas: { width: number; height: number };
  background: string;
  markCenterY?: number;
}): Promise<Buffer> {
  const { markSvgText, markWidth, canvas, background, markCenterY = 0.5 } = options;
  const mark = await renderSvgToPng(markSvgText, markWidth);
  const markMeta = await sharp(mark).metadata();
  return sharp({ create: { ...canvas, channels: 4, background } })
    .composite([
      {
        input: mark,
        left: Math.round((canvas.width - markWidth) / 2),
        top: Math.round(canvas.height * markCenterY - (markMeta.height ?? markWidth) / 2),
      },
    ])
    .flatten({ background })
    .png()
    .toBuffer();
}

async function renderSvgToPng(svg: string, targetWidth: number): Promise<Buffer> {
  const widthAttr = /<svg[^>]*? width="([\d.]+)"/.exec(svg)?.[1];
  const viewBoxWidth = /<svg[^>]*?viewBox="[\d.-]+ [\d.-]+ ([\d.]+)/.exec(svg)?.[1];
  const declaredWidth = Number(widthAttr ?? viewBoxWidth);
  const density = (72 * targetWidth) / declaredWidth;
  return sharp(Buffer.from(svg), { density }).resize({ width: targetWidth }).png().toBuffer();
}

/** Pack PNG buffers into a .ico container (modern browsers accept PNG entries). */
function packIco(entries: ReadonlyArray<{ size: number; png: Buffer }>): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const directory: Buffer[] = [];
  const blobs: Buffer[] = [];
  let offset = 6 + entries.length * 16;

  for (const { size, png } of entries) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    directory.push(entry);
    blobs.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...directory, ...blobs]);
}

async function main() {
  const fredoka = await readFile(join(WEB_ROOT, "assets/fonts/fredoka-600-latin.woff"));
  const fonts = [{ name: "Fredoka", data: fredoka, weight: 600, style: "normal" }] as const;

  await mkdir(BRAND_DIR, { recursive: true });
  await mkdir(MARKETING_BRAND_DIR, { recursive: true });

  for (const tone of ["light", "dark"] as const) {
    const raw = await satori(lockupElement(tone) as never, { ...CANVAS, fonts: [...fonts] });
    const svg = await cropSvgToContent(raw);
    const png = await renderSvgToPng(svg, 1200);
    const suffix = tone === "dark" ? "-dark" : "";
    for (const dir of [BRAND_DIR, MARKETING_BRAND_DIR]) {
      await writeFile(join(dir, `homa-lockup${suffix}.svg`), svg);
      await writeFile(join(dir, `homa-lockup${suffix}.png`), png);
    }
    console.log(`wrote homa-lockup${suffix}.svg + .png (web public + marketing)`);
  }

  const mark = markSvg();
  const tightMark = markSvg("tight");
  const avatarMark = markSvg("avatar");
  await writeFile(join(BRAND_DIR, "homa-mark.svg"), mark);
  await writeFile(join(BRAND_DIR, "homa-mark-512.png"), await renderSvgToPng(mark, 512));
  await writeFile(join(WEB_ROOT, "app/icon.svg"), tightMark);
  console.log("wrote homa-mark.svg, homa-mark-512.png, app/icon.svg");

  // Marketing gets the avatar-safe padded mark (social profiles, OAuth
  // consent screens), preserving the sizes the existing files shipped with.
  await writeFile(join(MARKETING_BRAND_DIR, "homa-mark.svg"), avatarMark);
  await writeFile(join(MARKETING_BRAND_DIR, "homa-mark-512.png"), await renderSvgToPng(avatarMark, 512));
  await writeFile(join(MARKETING_BRAND_DIR, "homa-mark-120.png"), await renderSvgToPng(avatarMark, 120));
  console.log("wrote marketing homa-mark.svg + 512/120 PNGs");

  // Phone-ready rasters with SOLID backgrounds (iOS composites transparent
  // avatars onto an auto-picked color that can swallow the clay house).
  // Colorways are the brand card's three sanctioned surface treatments.
  const inverseAvatarMark = markSvgColored("avatar", {
    body: "#FFFFFF",
    eyes: CLAY_500,
    pupils: "#FFFFFF",
  });
  const nightAvatarMark = markSvgColored("avatar", {
    body: CLAY_400,
    eyes: "#FFFFFF",
    pupils: STONE_900,
  });
  const nightStandardMark = markSvgColored("standard", {
    body: CLAY_400,
    eyes: "#FFFFFF",
    pupils: STONE_900,
  });

  const PHONE_DIR = join(MARKETING_BRAND_DIR, "phone");
  await mkdir(PHONE_DIR, { recursive: true });

  const pfpCanvas = { width: 1024, height: 1024 };
  const pfps = [
    { name: "homa-pfp-clay-1024.png", svg: inverseAvatarMark, background: CLAY_500 },
    { name: "homa-pfp-cream-1024.png", svg: avatarMark, background: CLAY_50 },
    { name: "homa-pfp-night-1024.png", svg: nightAvatarMark, background: NIGHT_NAVY },
  ];
  for (const { name, svg, background } of pfps) {
    await writeFile(
      join(PHONE_DIR, name),
      await renderMarkOnBackground({ markSvgText: svg, markWidth: 780, canvas: pfpCanvas, background }),
    );
  }
  console.log("wrote phone pfps (clay, cream, night) at 1024");

  // 1320x2868 = iPhone Pro Max native; smaller iPhones scale it down cleanly.
  // Mark sits a touch above center so iOS name/clock chrome doesn't crowd it.
  const wallCanvas = { width: 1320, height: 2868 };
  const walls = [
    { name: "homa-wallpaper-cream.png", svg: markSvg(), background: BG_PAGE },
    { name: "homa-wallpaper-night.png", svg: nightStandardMark, background: NIGHT_NAVY },
  ];
  for (const { name, svg, background } of walls) {
    await writeFile(
      join(PHONE_DIR, name),
      await renderMarkOnBackground({
        markSvgText: svg,
        markWidth: 620,
        canvas: wallCanvas,
        background,
        markCenterY: 0.45,
      }),
    );
  }
  console.log("wrote phone wallpapers (cream, night) at 1320x2868");

  const icoEntries = [];
  for (const size of [16, 32, 48]) {
    icoEntries.push({ size, png: await renderSvgToPng(tightMark, size) });
  }
  await writeFile(join(WEB_ROOT, "app/favicon.ico"), packIco(icoEntries));
  console.log("wrote app/favicon.ico (16, 32, 48)");
}

await main();
