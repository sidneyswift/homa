import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

import { loadSharp } from "../sharp-loader.ts";
import { rasterizePdfToJpegs } from "./rasterize-pdf.ts";

const ZIP_PRIMARY_DOMINANCE_RATIO = 4;
const MAX_PRINTABLE_ENTRY_BYTES = 200 * 1024 * 1024;
const COMMAND_TIMEOUT_MS = 120_000;

export interface ZipPrintableEntry {
  name: string;
  uncompressedSize: number;
}

export interface LibraryCoverBlob {
  pathname: string;
  url: string;
  size: number;
  etag?: string;
}

export interface LibraryCoverReceipt {
  version: 1;
  recordId: string;
  source: {
    pathname: string;
    url: string;
    size: number;
    etag: string;
  };
  cover: {
    pathname: string;
    url: string;
    size: number;
    etag: string;
    sha256: string;
  };
  renderedFrom: string;
}

export interface LibraryCoverEvidence {
  size: number;
  sha256: string;
  width: number;
  height: number;
}

export function blobPathnamesMatch(listed: string, readBack: string): boolean {
  try {
    return listed === decodeURIComponent(readBack);
  } catch {
    return false;
  }
}

export function blobEtagsMatch(listed: string | undefined, readBack: string | undefined): boolean {
  const normalize = (value: string | undefined) => value?.replace(/^W\//, "");
  return Boolean(listed) && normalize(listed) === normalize(readBack);
}

export function blobReportedSizeMatches(listed: number, readBack: number): boolean {
  return readBack === 0 || listed === readBack;
}

export async function retryLibraryCoverReadBack<T>(
  read: () => Promise<T>,
  options: {
    attempts?: number;
    wait?: (milliseconds: number) => Promise<void>;
  } = {},
): Promise<T> {
  const attempts = options.attempts ?? 6;
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error("read-back attempts must be a positive integer");
  }
  const wait = options.wait ?? ((milliseconds) => new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  }));
  let lastError: unknown = new Error("library cover read-back failed");
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await wait(Math.min(250 * 2 ** (attempt - 1), 2_000));
      }
    }
  }
  throw lastError;
}

export function shouldPreserveLegacyLibraryCover(options: {
  force: boolean;
  exactRecord: boolean;
  cover?: LibraryCoverBlob;
  receipt?: LibraryCoverBlob;
}): boolean {
  return (
    !options.force &&
    !options.exactRecord &&
    Boolean(options.cover) &&
    !options.receipt
  );
}

type PrintableKind = "image" | "pdf" | "pptx";
type CoverSourceKind = PrintableKind | "zip";

interface RasterizedPages {
  pageJpegs: Buffer[];
  pageCount: number;
}

export interface PptxRenderDependencies {
  convertPptxToPdf: (pptx: Buffer) => Promise<Buffer>;
  rasterizePdfToJpegs: (
    pdf: Buffer,
    maxPages: number,
  ) => Promise<RasterizedPages>;
}

export interface RenderLibraryCoverOptions {
  pdfPassword?: string;
}

export interface RenderedLibraryCover {
  jpeg: Buffer;
  renderedFrom: string;
}

export function libraryCoverReceiptMatches(
  receipt: unknown,
  recordId: string,
  source: LibraryCoverBlob,
  cover: LibraryCoverBlob,
): receipt is LibraryCoverReceipt {
  if (!receipt || typeof receipt !== "object") return false;
  const candidate = receipt as Partial<LibraryCoverReceipt>;
  return (
    candidate.version === 1 &&
    candidate.recordId === recordId &&
    candidate.source?.pathname === source.pathname &&
    candidate.source.url === source.url &&
    candidate.source.size === source.size &&
    Boolean(source.etag) &&
    candidate.source.etag === source.etag &&
    candidate.cover?.pathname === cover.pathname &&
    candidate.cover.url === cover.url &&
    candidate.cover.size === cover.size &&
    Boolean(cover.etag) &&
    candidate.cover.etag === cover.etag &&
    typeof candidate.cover.sha256 === "string" &&
    /^[0-9a-f]{64}$/.test(candidate.cover.sha256) &&
    typeof candidate.renderedFrom === "string" &&
    Boolean(candidate.renderedFrom)
  );
}

export async function inspectLibraryCoverJpeg(
  bytes: Buffer,
): Promise<LibraryCoverEvidence> {
  if (!bytes.length) throw new Error("cover is empty");
  const sharp = await loadSharp();
  const metadata = await sharp(bytes).metadata();
  if (
    metadata.format !== "jpeg" ||
    !metadata.width ||
    !metadata.height
  ) {
    throw new Error("cover is not a decodable JPEG");
  }
  return {
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: metadata.width,
    height: metadata.height,
  };
}

/**
 * Select the source object for one canonical Library record.
 *
 * An explicit URL is an identity claim, so it is accepted only when the
 * current live Blob listing contains it exactly once and its pathname belongs
 * to the requested record. Without an explicit URL, choose the largest sibling
 * that the cover renderer actually supports.
 */
export function selectLibraryCoverSource(
  originals: LibraryCoverBlob[],
  recordId: string,
  sourceUrl?: string | null,
  claimedSourceUrls: ReadonlySet<string> = new Set(),
): LibraryCoverBlob {
  const recordSources = originals.filter((blob) => {
    const parts = blob.pathname.split("/");
    return parts.length >= 3 && parts[0] === "inspo" && parts[1] === recordId;
  });

  if (sourceUrl !== null && sourceUrl !== undefined) {
    const exactMatches = originals.filter((blob) => blob.url === sourceUrl);
    if (exactMatches.length !== 1) {
      throw new Error(
        `source URL must match exactly one live inspo object, found ${exactMatches.length}`,
      );
    }
    const selected = exactMatches[0];
    if (!recordSources.includes(selected) && !claimedSourceUrls.has(selected.url)) {
      throw new Error(`source URL does not belong to record ${recordId}`);
    }
    if (!isSupportedLibraryCoverSource(selected.pathname)) {
      throw new Error(`source URL is not renderable for record ${recordId}`);
    }
    return selected;
  }

  const selected = recordSources
    .filter((blob) => isSupportedLibraryCoverSource(blob.pathname))
    .sort(
      (left, right) =>
        right.size - left.size || left.pathname.localeCompare(right.pathname),
    )[0];
  if (!selected) {
    throw new Error(`no renderable live inspo objects found for record ${recordId}`);
  }
  return selected;
}

function sourceKind(name: string): CoverSourceKind | null {
  if (/\.pdf$/i.test(name)) return "pdf";
  if (/\.pptx$/i.test(name)) return "pptx";
  if (/\.(jpe?g|png|webp|gif)$/i.test(name)) return "image";
  if (/\.zip$/i.test(name)) return "zip";
  return null;
}

function printableKind(name: string): PrintableKind | null {
  const kind = sourceKind(name);
  return kind === "zip" ? null : kind;
}

function isStructuralMetadata(name: string): boolean {
  const parts = name.split(/[\\/]/);
  const leaf = parts.at(-1) ?? "";
  return parts.includes("__MACOSX") || leaf.startsWith("._") || leaf === ".DS_Store";
}

export function isSupportedLibraryCoverSource(name: string): boolean {
  return sourceKind(name) !== null;
}

/**
 * Pick one trustworthy printable from an archive. A unique candidate is
 * safe. With multiple candidates, the largest must be at least four times
 * the next largest, otherwise the archive does not establish which document
 * is primary and the caller must stop.
 */
export function chooseZipPrintableEntry(
  entries: ZipPrintableEntry[],
): ZipPrintableEntry {
  const candidates = entries
    .filter(
      (entry) =>
        entry.uncompressedSize > 0 &&
        !entry.name.endsWith("/") &&
        !isStructuralMetadata(entry.name) &&
        printableKind(entry.name) !== null,
    )
    .sort(
      (left, right) =>
        right.uncompressedSize - left.uncompressedSize ||
        left.name.localeCompare(right.name),
    );

  const selected = candidates[0];
  if (!selected) {
    throw new Error("archive has no supported printable content");
  }

  const runnerUp = candidates[1];
  if (
    runnerUp &&
    selected.uncompressedSize <
      runnerUp.uncompressedSize * ZIP_PRIMARY_DOMINANCE_RATIO
  ) {
    throw new Error(
      `ambiguous archive: ${candidates.length} comparable printable files`,
    );
  }

  if (selected.uncompressedSize > MAX_PRINTABLE_ENTRY_BYTES) {
    throw new Error(
      `archive printable exceeds ${MAX_PRINTABLE_ENTRY_BYTES} bytes`,
    );
  }

  return selected;
}

/** Parse the stable, C-locale table emitted by `unzip -l`. */
export function parseUnzipList(output: string): ZipPrintableEntry[] {
  const entries: ZipPrintableEntry[] = [];
  for (const line of output.split("\n")) {
    const match = line.match(
      /^\s*(\d+)\s+\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}\s+(.+?)\s*$/,
    );
    if (!match) continue;
    entries.push({
      name: match[2],
      uncompressedSize: Number(match[1]),
    });
  }
  return entries;
}

function runTextCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        encoding: "utf8",
        env: { ...process.env, LC_ALL: "C" },
        maxBuffer: 8 * 1024 * 1024,
        timeout: COMMAND_TIMEOUT_MS,
      },
      (error, stdout, stderr) => {
        if (error) {
          const detail = stderr.trim() || error.message;
          reject(new Error(`${basename(command)} failed: ${detail}`));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function runBinaryCommand(
  command: string,
  args: string[],
  maxBytes: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, LC_ALL: "C" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let overflowed = false;
    let timedOut = false;
    let settled = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, COMMAND_TIMEOUT_MS);

    const finish = (error: Error | null, result?: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(result ?? Buffer.alloc(0));
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxBytes) {
        overflowed = true;
        child.kill();
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (timedOut) {
        finish(new Error(`${basename(command)} timed out`));
        return;
      }
      if (overflowed) {
        finish(new Error(`archive printable exceeds ${maxBytes} bytes`));
        return;
      }
      if (code !== 0) {
        const detail = Buffer.concat(stderr).toString("utf8").trim();
        finish(
          new Error(
            `${basename(command)} failed with exit ${code}${detail ? `: ${detail}` : ""}`,
          ),
        );
        return;
      }
      finish(null, Buffer.concat(stdout));
    });
  });
}

async function extractZipPrintable(
  archive: Buffer,
): Promise<{ bytes: Buffer; entry: ZipPrintableEntry }> {
  const tempDirectory = await mkdtemp(join(tmpdir(), "homa-library-cover-"));
  const archivePath = join(tempDirectory, "source.zip");
  try {
    await writeFile(archivePath, archive);
    const listing = await runTextCommand("unzip", ["-l", archivePath]);
    const entry = chooseZipPrintableEntry(parseUnzipList(listing));
    const bytes = await runBinaryCommand(
      "unzip",
      ["-p", archivePath, entry.name],
      MAX_PRINTABLE_ENTRY_BYTES,
    );
    if (bytes.length !== entry.uncompressedSize) {
      throw new Error(
        `archive printable size mismatch: expected ${entry.uncompressedSize}, got ${bytes.length}`,
      );
    }
    return { bytes, entry };
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
}

async function convertPptxToPdf(pptx: Buffer): Promise<Buffer> {
  const tempDirectory = await mkdtemp(join(tmpdir(), "homa-library-cover-"));
  const inputPath = join(tempDirectory, "source.pptx");
  const outputPath = join(tempDirectory, "source.pdf");
  const profilePath = join(tempDirectory, "libreoffice-profile");
  try {
    await writeFile(inputPath, pptx);
    await runTextCommand(process.env.SOFFICE_BIN ?? "soffice", [
      `-env:UserInstallation=${pathToFileURL(profilePath).href}`,
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      tempDirectory,
      inputPath,
    ]);
    const pdf = await readFile(outputPath);
    if (!pdf.length) throw new Error("LibreOffice produced an empty PDF");
    return pdf;
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
}

const defaultPptxDependencies: PptxRenderDependencies = {
  convertPptxToPdf,
  rasterizePdfToJpegs,
};

export async function renderPptxFirstSlide(
  pptx: Buffer,
  dependencies: PptxRenderDependencies = defaultPptxDependencies,
): Promise<Buffer> {
  const pdf = await dependencies.convertPptxToPdf(pptx);
  const { pageJpegs } = await dependencies.rasterizePdfToJpegs(pdf, 1);
  const firstSlide = pageJpegs[0];
  if (!firstSlide) throw new Error("no slides rendered from presentation");
  return firstSlide;
}

async function renderPrintable(
  name: string,
  bytes: Buffer,
  options: RenderLibraryCoverOptions,
): Promise<Buffer> {
  const kind = printableKind(name);
  if (kind === "image") {
    const sharp = await loadSharp();
    return sharp(bytes, { limitInputPixels: 100_000_000 })
      .rotate()
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  }
  if (kind === "pptx") return renderPptxFirstSlide(bytes);
  if (kind === "pdf") {
    const { pageJpegs } = await rasterizePdfToJpegs(bytes, 1, {
      password: options.pdfPassword,
    });
    const firstPage = pageJpegs[0];
    if (!firstPage) throw new Error("no pages rendered from PDF");
    return firstPage;
  }
  throw new Error(`unsupported cover source: ${name}`);
}

export async function renderLibraryCover(
  name: string,
  bytes: Buffer,
  options: RenderLibraryCoverOptions = {},
): Promise<RenderedLibraryCover> {
  const kind = sourceKind(name);
  if (!kind) throw new Error(`unsupported cover source: ${name}`);

  if (kind === "zip") {
    const extracted = await extractZipPrintable(bytes);
    return {
      jpeg: await renderPrintable(extracted.entry.name, extracted.bytes, options),
      renderedFrom: extracted.entry.name,
    };
  }

  return {
    jpeg: await renderPrintable(name, bytes, options),
    renderedFrom: name,
  };
}
