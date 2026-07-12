/**
 * Builds upload-ready social assets from Homa's canonical SVG mark and lockups.
 * Run with: pnpm gen:socials
 */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND_DIR = join(REPO_ROOT, "marketing/assets/brand");
const OUTPUT_DIR = join(REPO_ROOT, "marketing/assets/socials-starter-pack");

const CREAM = "#FBF7F0";
const NAVY = "#23304F";
const CLAY_500 = "#E7602F";
const CLAY_400 = "#F1793F";
const MEGABYTE = 1024 * 1024;

type RasterExpectation = {
  path: string;
  width: number;
  height?: number;
  transparent: boolean;
  background?: string;
  maxBytes?: number;
};

type BannerSpec = {
  platform: "youtube" | "x" | "linkedin";
  width: number;
  height: number;
  lockupWidth: number;
  maxBytes?: number;
};

const BANNERS: readonly BannerSpec[] = [
  { platform: "youtube", width: 2560, height: 1440, lockupWidth: 700, maxBytes: 6 * MEGABYTE },
  { platform: "x", width: 1500, height: 500, lockupWidth: 560 },
  { platform: "linkedin", width: 4200, height: 700, lockupWidth: 900, maxBytes: 3 * MEGABYTE },
];

function assertAsset(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function getSvgDeclaredWidth(svg: string): number {
  const width = /<svg[^>]*? width="([\d.]+)"/.exec(svg)?.[1];
  const viewBoxWidth = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+)/.exec(svg)?.[1];
  const declaredWidth = Number(width ?? viewBoxWidth);
  assertAsset(Number.isFinite(declaredWidth), "SVG has no readable width or viewBox.");
  return declaredWidth;
}

/** Rasterizes at the requested density so vector edges stay sharp. */
async function renderSvgAtWidth(svg: string, width: number): Promise<Buffer> {
  const density = (72 * width) / getSvgDeclaredWidth(svg);
  return sharp(Buffer.from(svg), { density })
    .resize({ width })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function renderCenteredAsset(options: {
  svg: string;
  artWidth: number;
  canvasWidth: number;
  canvasHeight: number;
  background: string;
}): Promise<Buffer> {
  const { svg, artWidth, canvasWidth, canvasHeight, background } = options;
  const artwork = await renderSvgAtWidth(svg, artWidth);
  const artworkMetadata = await sharp(artwork).metadata();
  const artworkHeight = artworkMetadata.height;
  assertAsset(typeof artworkHeight === "number", "Rendered artwork has no height.");

  return sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background,
    },
  })
    .composite([
      {
        input: artwork,
        left: Math.round((canvasWidth - artWidth) / 2),
        top: Math.round((canvasHeight - artworkHeight) / 2),
      },
    ])
    .flatten({ background })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function saveRaster(
  outputRelativePath: string,
  buffer: Buffer,
  expectation: Omit<RasterExpectation, "path">,
): Promise<RasterExpectation> {
  const path = join(OUTPUT_DIR, outputRelativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
  return { path, ...expectation };
}

function hexToRgb(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

async function verifyRaster(expectation: RasterExpectation): Promise<void> {
  const metadata = await sharp(expectation.path).metadata();
  const statistics = await sharp(expectation.path).stats();
  const alpha = statistics.channels[3];
  assertAsset(metadata.format === "png", `${expectation.path} is not a PNG.`);
  assertAsset(metadata.width === expectation.width, `${expectation.path} has the wrong width.`);
  if (expectation.height !== undefined) {
    assertAsset(metadata.height === expectation.height, `${expectation.path} has the wrong height.`);
  }
  const hasTransparentPixels = alpha !== undefined && alpha.min < 255 && alpha.max === 255;
  const isFullyOpaque = alpha === undefined || alpha.min === 255;
  assertAsset(
    expectation.transparent ? hasTransparentPixels : isFullyOpaque,
    `${expectation.path} has the wrong transparency.`,
  );

  if (expectation.background) {
    const pixel = await sharp(expectation.path)
      .ensureAlpha()
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer();
    const expectedRgb = hexToRgb(expectation.background);
    assertAsset(
      pixel[0] === expectedRgb[0] && pixel[1] === expectedRgb[1] && pixel[2] === expectedRgb[2] && pixel[3] === 255,
      `${expectation.path} has the wrong background color.`,
    );
  }

  const file = await stat(expectation.path);
  if (expectation.maxBytes !== undefined) {
    assertAsset(file.size <= expectation.maxBytes, `${expectation.path} exceeds its platform file-size limit.`);
  }

  const shownPath = relative(REPO_ROOT, expectation.path);
  console.log(`verified ${shownPath} (${metadata.width}x${metadata.height}, ${file.size} bytes)`);
}

async function main(): Promise<void> {
  const [markSvg, standardLockupSvg, reversedLockupSvg] = await Promise.all([
    readFile(join(BRAND_DIR, "homa-mark.svg"), "utf8"),
    readFile(join(BRAND_DIR, "homa-lockup.svg"), "utf8"),
    readFile(join(BRAND_DIR, "homa-lockup-dark.svg"), "utf8"),
  ]);
  const navyMarkSvg = markSvg.replace(CLAY_500, CLAY_400);
  const rasters: RasterExpectation[] = [];
  const tones = [
    { name: "cream", background: CREAM, markSvg, lockupSvg: standardLockupSvg },
    { name: "navy", background: NAVY, markSvg: navyMarkSvg, lockupSvg: reversedLockupSvg },
  ] as const;

  for (const tone of tones) {
    const pfp = await renderCenteredAsset({
      svg: tone.markSvg,
      artWidth: 780,
      canvasWidth: 1024,
      canvasHeight: 1024,
      background: tone.background,
    });
    rasters.push(
      await saveRaster(`pfp/homa-pfp-${tone.name}-1024.png`, pfp, {
        width: 1024,
        height: 1024,
        transparent: false,
        background: tone.background,
      }),
    );

    for (const banner of BANNERS) {
      const image = await renderCenteredAsset({
        svg: tone.lockupSvg,
        artWidth: banner.lockupWidth,
        canvasWidth: banner.width,
        canvasHeight: banner.height,
        background: tone.background,
      });
      rasters.push(
        await saveRaster(
          `banners/${banner.platform}/homa-${banner.platform}-banner-${tone.name}-${banner.width}x${banner.height}.png`,
          image,
          {
            width: banner.width,
            height: banner.height,
            transparent: false,
            background: tone.background,
            maxBytes: banner.maxBytes,
          },
        ),
      );
    }
  }

  const logoDir = join(OUTPUT_DIR, "logos");
  await mkdir(logoDir, { recursive: true });
  await writeFile(join(logoDir, "homa-lockup-transparent.svg"), standardLockupSvg);
  await writeFile(join(logoDir, "homa-lockup-reversed-transparent.svg"), reversedLockupSvg);

  for (const logo of [
    { name: "homa-lockup-transparent-2400.png", svg: standardLockupSvg },
    { name: "homa-lockup-reversed-transparent-2400.png", svg: reversedLockupSvg },
  ]) {
    rasters.push(
      await saveRaster(`logos/${logo.name}`, await renderSvgAtWidth(logo.svg, 2400), {
        width: 2400,
        transparent: true,
      }),
    );
  }

  for (const raster of rasters) {
    await verifyRaster(raster);
  }
}

await main();
