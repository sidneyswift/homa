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
 * - apps/mobile/assets/brand/                       (Expo icon, adaptive icon,
 *   monochrome icon, and splash SVGs; the same contract geometry and colors)
 * - apps/mobile/assets/images/                     (the PNG projections Expo
 *   consumes, rasterized from the native SVGs above)
 *
 * The wordmark letters are converted to vector paths via satori + the vendored
 * Fredoka 600 WOFF, so the SVGs render correctly without the font installed.
 * Token hexes are inlined from the Quiet authority contract so generated
 * distribution assets do not create a second palette authority.
 */

import { mkdir, readFile, writeFile as writeGeneratedFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import sharp from "sharp";
import { colorTokens, logoGeometry } from "../packages/design/src/contract/index.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_ROOT = join(REPO_ROOT, "apps/web");
const BRAND_DIR = join(WEB_ROOT, "public/brand");
const MARKETING_BRAND_DIR = join(REPO_ROOT, "marketing/assets/brand");
const MOBILE_BRAND_DIR = join(REPO_ROOT, "apps/mobile/assets/brand");
const MOBILE_IMAGE_DIR = join(REPO_ROOT, "apps/mobile/assets/images");
const CHECK = process.argv.includes("--check");

const VISUAL_CORAL = colorTokens.visualCoral;
const INK = colorTokens.ink;
const MINERAL_CANVAS = colorTokens.canvas;
const CONTAINED_BAND = colorTokens.containedBand;

const HOUSE_PATH = logoGeometry.housePath;

async function writeOutput(path: string, content: string | Buffer): Promise<void> {
  if (!CHECK) {
    await writeGeneratedFile(path, content);
    return;
  }
  let existing: Buffer;
  try {
    existing = await readFile(path);
  } catch {
    throw new Error(`Generated brand asset is missing: ${path}`);
  }
  const expected = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (existing.equals(expected)) return;

  // PNG encoders can produce different chunk/compression bytes on macOS and
  // Linux even when they rasterize the exact same image. Compare decoded
  // pixels for raster projections so CI proves the visual asset is current
  // without making a platform-specific zlib stream an accidental authority.
  if (path.endsWith(".png")) {
    const [existingRaster, expectedRaster] = await Promise.all([
      sharp(existing).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(expected).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ]);
    const sameRaster =
      existingRaster.info.width === expectedRaster.info.width
      && existingRaster.info.height === expectedRaster.info.height
      && existingRaster.info.channels === expectedRaster.info.channels
      && existingRaster.data.equals(expectedRaster.data);
    if (sameRaster) return;

    // libvips can also vary a handful of anti-aliased edge pixels between
    // bundled builds. A 64px visual signature, quantized to four bits per
    // channel, still catches palette, geometry, and crop drift while
    // remaining stable across those renderer-level differences.
    const [existingSignature, expectedSignature] = await Promise.all([
      sharp(existing)
        .removeAlpha()
        .resize({ width: 64, height: 64, fit: "fill" })
        .raw()
        .toBuffer(),
      sharp(expected)
        .removeAlpha()
        .resize({ width: 64, height: 64, fit: "fill" })
        .raw()
        .toBuffer(),
    ]);
    if (
      existingSignature.length === expectedSignature.length
      && existingSignature.every((value, index) => (value >> 4) === (expectedSignature[index] >> 4))
    ) return;
  }

  throw new Error(`Generated brand asset is stale: ${path}`);
}

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
    el("circle", { cx: 18.3, cy: 26.7, r: 2.2, fill: INK }),
    el("circle", { cx: 31.5, cy: 26.7, r: 2.2, fill: INK }),
  );
}

function lockupElement(tone: "light" | "dark") {
  const body = VISUAL_CORAL;
  const word = tone === "dark" ? colorTokens.paper : INK;
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

// The two approved mark colorways: solid = visual-coral house with paper eyes;
// inverse = paper house with coral eyes for a visual-coral surface.
function markSvgColored(
  viewBox: keyof typeof MARK_BOXES,
  colors: { body: string; eyes: string; pupils: string },
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_BOXES[viewBox]}">
  <!-- The little-home mark from the real Logo component, token values
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
  return markSvgColored(viewBox, { body: VISUAL_CORAL, eyes: colorTokens.paper, pupils: INK });
}

function mobileMarkGroup(options: {
  scale: number;
  body: string;
  eyes?: string;
  pupils?: string;
}): string {
  const eyes = options.eyes ?? colorTokens.paper;
  const pupils = options.pupils ?? INK;
  return `<g transform="translate(24 24.8) scale(${options.scale}) translate(-24 -24.8)">
    <path d="${HOUSE_PATH}" fill="${options.body}" />
    <circle cx="17.4" cy="26" r="4.8" fill="${eyes}" />
    <circle cx="30.6" cy="26" r="4.8" fill="${eyes}" />
    <circle cx="18.3" cy="26.7" r="2.2" fill="${pupils}" />
    <circle cx="31.5" cy="26.7" r="2.2" fill="${pupils}" />
  </g>`;
}

/** Native SVG projections are generated here so Expo cannot drift from the
 * same contract that powers web and marketing assets. */
function mobileAssetSvgs(): Readonly<Record<string, string>> {
  const body = colorTokens.visualCoral;
  const canvas = colorTokens.canvas;
  const paper = colorTokens.paper;
  const ink = colorTokens.ink;
  return {
    "android-background.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">\n  <rect x="0" y="0" width="48" height="48" fill="${canvas}" />\n</svg>\n`,
    "android-foreground.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">\n  <!-- Android adaptive foreground: mark inside the ~66% safe zone. -->\n  ${mobileMarkGroup({ scale: 0.52, body, eyes: paper, pupils: ink })}\n</svg>\n`,
    "android-monochrome.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">\n  <!-- Android monochrome glyph: single-color silhouette, OS tints it. -->\n  <g transform="translate(24 24.8) scale(0.52) translate(-24 -24.8)">\n    <path d="${HOUSE_PATH}" fill="${paper}" />\n  </g>\n</svg>\n`,
    "icon.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">\n  <!-- App icon: the master Homa mark on the Quiet canvas. -->\n  <rect x="0" y="0" width="48" height="48" fill="${canvas}" />\n  ${mobileMarkGroup({ scale: 0.66, body, eyes: paper, pupils: ink })}\n</svg>\n`,
    "splash-icon.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">\n  <!-- Transparent splash mark. Expo supplies the Quiet canvas behind it. -->\n  ${mobileMarkGroup({ scale: 1, body, eyes: paper, pupils: ink }).replace(/ transform="[^"]+"/, "")}\n</svg>\n`,
  };
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
  await mkdir(MOBILE_BRAND_DIR, { recursive: true });
  await mkdir(MOBILE_IMAGE_DIR, { recursive: true });

  const mobileSvgs = mobileAssetSvgs();
  for (const [name, svg] of Object.entries(mobileSvgs)) {
    await writeOutput(join(MOBILE_BRAND_DIR, name), svg);
  }
  console.log("wrote native SVG brand assets (Expo icon, adaptive icon, monochrome icon, splash)");

  const mobilePngs = [
    ["android-background.svg", "android-icon-background.png", 1024],
    ["android-foreground.svg", "android-icon-foreground.png", 1024],
    ["android-monochrome.svg", "android-icon-monochrome.png", 1024],
    ["icon.svg", "icon.png", 1024],
    ["icon.svg", "favicon.png", 48],
    ["splash-icon.svg", "splash-icon.png", 1024],
  ] as const;
  for (const [svgName, pngName, width] of mobilePngs) {
    await writeOutput(join(MOBILE_IMAGE_DIR, pngName), await renderSvgToPng(mobileSvgs[svgName], width));
  }
  console.log("wrote native PNG projections (Expo icon, adaptive icon, monochrome icon, favicon, splash)");

  for (const tone of ["light", "dark"] as const) {
    const raw = await satori(lockupElement(tone) as never, { ...CANVAS, fonts: [...fonts] });
    const svg = await cropSvgToContent(raw);
    const png = await renderSvgToPng(svg, 1200);
    const suffix = tone === "dark" ? "-dark" : "";
    for (const dir of [BRAND_DIR, MARKETING_BRAND_DIR]) {
      await writeOutput(join(dir, `homa-lockup${suffix}.svg`), svg);
      await writeOutput(join(dir, `homa-lockup${suffix}.png`), png);
    }
    console.log(`wrote homa-lockup${suffix}.svg + .png (web public + marketing)`);
  }

  const mark = markSvg();
  const tightMark = markSvg("tight");
  const avatarMark = markSvg("avatar");
  await writeOutput(join(BRAND_DIR, "homa-mark.svg"), mark);
  await writeOutput(join(BRAND_DIR, "homa-mark-512.png"), await renderSvgToPng(mark, 512));
  await writeOutput(join(WEB_ROOT, "app/icon.svg"), tightMark);
  console.log("wrote homa-mark.svg, homa-mark-512.png, app/icon.svg");

  // Marketing gets the avatar-safe padded mark (social profiles, OAuth
  // consent screens), preserving the sizes the existing files shipped with.
  await writeOutput(join(MARKETING_BRAND_DIR, "homa-mark.svg"), avatarMark);
  await writeOutput(join(MARKETING_BRAND_DIR, "homa-mark-512.png"), await renderSvgToPng(avatarMark, 512));
  await writeOutput(join(MARKETING_BRAND_DIR, "homa-mark-120.png"), await renderSvgToPng(avatarMark, 120));
  console.log("wrote marketing homa-mark.svg + 512/120 PNGs");

  // Phone-ready rasters with SOLID backgrounds (iOS composites transparent
  // avatars onto an auto-picked color that can swallow the clay house).
  // Colorways are the brand card's three sanctioned surface treatments.
  const inverseAvatarMark = markSvgColored("avatar", {
    body: "#FFFFFF",
    eyes: VISUAL_CORAL,
    pupils: "#FFFFFF",
  });
  const nightAvatarMark = markSvgColored("avatar", {
    body: VISUAL_CORAL,
    eyes: "#FFFFFF",
    pupils: INK,
  });
  const nightStandardMark = markSvgColored("standard", {
    body: VISUAL_CORAL,
    eyes: "#FFFFFF",
    pupils: INK,
  });

  const PHONE_DIR = join(MARKETING_BRAND_DIR, "phone");
  await mkdir(PHONE_DIR, { recursive: true });

  const pfpCanvas = { width: 1024, height: 1024 };
  const pfps = [
    { name: "homa-pfp-clay-1024.png", svg: inverseAvatarMark, background: VISUAL_CORAL },
    { name: "homa-pfp-cream-1024.png", svg: avatarMark, background: MINERAL_CANVAS },
    { name: "homa-pfp-night-1024.png", svg: nightAvatarMark, background: CONTAINED_BAND },
  ];
  for (const { name, svg, background } of pfps) {
    await writeOutput(
      join(PHONE_DIR, name),
      await renderMarkOnBackground({ markSvgText: svg, markWidth: 780, canvas: pfpCanvas, background }),
    );
  }
  console.log("wrote phone pfps (clay, cream, night) at 1024");

  // 1320x2868 = iPhone Pro Max native; smaller iPhones scale it down cleanly.
  // Mark sits a touch above center so iOS name/clock chrome doesn't crowd it.
  const wallCanvas = { width: 1320, height: 2868 };
  const walls = [
    { name: "homa-wallpaper-cream.png", svg: markSvg(), background: MINERAL_CANVAS },
    { name: "homa-wallpaper-night.png", svg: nightStandardMark, background: CONTAINED_BAND },
  ];
  for (const { name, svg, background } of walls) {
    await writeOutput(
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
  await writeOutput(join(WEB_ROOT, "app/favicon.ico"), packIco(icoEntries));
  console.log("wrote app/favicon.ico (16, 32, 48)");
}

await main();
