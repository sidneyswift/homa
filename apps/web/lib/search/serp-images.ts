import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Google Images search for the materials studio, through SerpAPI
 * (SERPAPI_API_KEY, server-only). The one thing generate_image cannot
 * honestly make is a photograph of a real thing: a monarch on milkweed,
 * real coins for money math, what a curriculum workbook actually looks
 * like. This module finds those.
 *
 * Safety posture (decision record: docs/homa-planning/plans/
 * 2026-07-13-serpapi-web-photos.html): the model chooses a QUERY, never
 * a URL, matching the founder's web_search/web_fetch ruling (2026-07-09,
 * 15-agentic-architecture.md §3). Search runs server-side against the
 * fixed vendor host with safe=active forced and unsafe-flagged results
 * dropped. Results hand the model HMAC-signed tokens instead of raw
 * URLs; fetchable targets are therefore Google-authored, family-bound,
 * and tamper-evident, and the model can never compose an arbitrary URL
 * for our servers to fetch. Bytes are rehosted into the family's own
 * blob space before anything can embed or reference them.
 *
 * Quota reality: the account is SerpAPI's free plan (250 searches per
 * month, shared fleet-wide). Callers cap per-family use; this module
 * turns vendor failures into model-readable notes and never throws.
 */

const SEARCH_ENDPOINT = "https://serpapi.com/search.json";
const SEARCH_TIMEOUT_MS = 15_000;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_RESULTS = 12;
const DEFAULT_RESULTS = 8;
const MAX_TITLE_CHARS = 120;

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Raster formats the printable renderer and image model both accept.
 * SVG is deliberately out: script-capable markup never enters the
 * family's artifact space. */
const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export const PHOTO_KINDS = ["photo", "clipart", "lineart", "any"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

const KIND_TO_IMAGE_TYPE: Record<PhotoKind, string | null> = {
  photo: "photo",
  clipart: "clipart",
  lineart: "lineart",
  any: null,
};

export function serpConfigured(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY);
}

export interface WebPhotoResult {
  photoNumber: number;
  title: string;
  /** The publishing site's domain, for the model's relevance judgment
   * and honest attribution ("a photo from nps.gov"). */
  source: string;
  width: number;
  height: number;
  /** Signed claim ticket for keep_photo; the model never sees the URL. */
  photoToken: string;
}

export type SearchWebPhotosOutcome =
  | { ok: true; photos: WebPhotoResult[] }
  | { ok: false; note: string };

/** Signing key derived from the vendor key: no second secret to
 * provision, rotates with the key, absent exactly when the feature is
 * unconfigured. */
function tokenKey(): Buffer | null {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return null;
  return createHash("sha256").update(`homa-photo-token-v1:${apiKey}`).digest();
}

interface PhotoTokenPayload {
  v: 1;
  f: string;
  u: string;
  w: number;
  h: number;
}

function signPhotoToken(payload: PhotoTokenPayload): string | null {
  const key = tokenKey();
  if (!key) return null;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export interface VerifiedPhoto {
  url: string;
  width: number;
  height: number;
}

/**
 * verifyPhotoToken(token, familyId): VerifiedPhoto | null
 * Accepts only tokens this deployment signed for THIS family; anything
 * tampered, foreign, or malformed reads as null.
 */
export function verifyPhotoToken(token: string, familyId: string): VerifiedPhoto | null {
  const key = tokenKey();
  if (!key) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = createHmac("sha256", key).update(body).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as
      | PhotoTokenPayload
      | null;
    if (
      !payload ||
      payload.v !== 1 ||
      payload.f !== familyId ||
      typeof payload.u !== "string" ||
      typeof payload.w !== "number" ||
      typeof payload.h !== "number"
    ) {
      return null;
    }
    const parsed = new URL(payload.u);
    if (parsed.protocol !== "https:") return null;
    return { url: payload.u, width: payload.w, height: payload.h };
  } catch {
    return null;
  }
}

interface SerpImagesResult {
  title?: unknown;
  source?: unknown;
  original?: unknown;
  original_width?: unknown;
  original_height?: unknown;
  unsafe?: unknown;
}

interface SerpImagesResponse {
  error?: unknown;
  images_results?: unknown;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Stock-photo agencies whose preview images routinely carry a visible
 * watermark or sample-text overlay (a real family's printed page nearly
 * shipped one, 2026-07-23: a butterfly photo with stock-site text across
 * it). Google Images has no reliable "watermarked" signal, so this is a
 * source-domain deny-list, matched against the publishing site and the
 * image's own host (a stock agency's preview often serves off a CDN
 * subdomain, e.g. media.gettyimages.com). Narrow and deterministic on
 * purpose: it excludes known offenders without touching relevance
 * ranking, unlike a hard usage-rights filter, which can starve a niche
 * query of results entirely.
 */
const STOCK_AGENCY_HOSTS = [
  "shutterstock.com",
  "istockphoto.com",
  "gettyimages.com",
  "alamy.com",
  "dreamstime.com",
  "depositphotos.com",
  "123rf.com",
  // Not bare "adobe.com": that domain also serves help.adobe.com,
  // blog.adobe.com, and general marketing pages, none of which are stock
  // previews. Every other entry here is a single-purpose stock-photo
  // domain, where blocking the whole thing costs nothing; this one stays
  // scoped to the storefront so it does not starve an unrelated query.
  "stock.adobe.com",
  "bigstockphoto.com",
  "canstockphoto.com",
] as const;

function matchesStockAgencyHost(host: string): boolean {
  // A trailing root-label dot (a syntactically valid, DNS-equivalent
  // form of the same host, e.g. "gettyimages.com.") would otherwise
  // defeat both the equality and the endsWith check below.
  const normalized = host.toLowerCase().replace(/\.+$/, "");
  return STOCK_AGENCY_HOSTS.some(
    (blocked) => normalized === blocked || normalized.endsWith(`.${blocked}`),
  );
}

function isStockAgencyResult(url: string, source: string): boolean {
  if (matchesStockAgencyHost(source)) return true;
  try {
    return matchesStockAgencyHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * normalizeImagesResponse(json, familyId, count): WebPhotoResult[]
 * Pure result shaping, exported for tests: drops unsafe-flagged,
 * non-https, dimensionless, and stock-agency-sourced entries (their
 * previews routinely carry a watermark), bounds titles, and signs one
 * family-bound token per kept result.
 */
export function normalizeImagesResponse(
  json: SerpImagesResponse,
  familyId: string,
  count: number,
): WebPhotoResult[] {
  const raw = Array.isArray(json.images_results) ? json.images_results : [];
  const photos: WebPhotoResult[] = [];
  for (const entry of raw as SerpImagesResult[]) {
    if (photos.length >= count) break;
    if (entry.unsafe === true) continue;
    const url = typeof entry.original === "string" ? entry.original : null;
    const width = typeof entry.original_width === "number" ? entry.original_width : null;
    const height =
      typeof entry.original_height === "number" ? entry.original_height : null;
    if (!url || !isHttpsUrl(url) || !width || !height) continue;
    const title = typeof entry.title === "string" ? entry.title : "";
    const source = typeof entry.source === "string" ? entry.source : "";
    if (isStockAgencyResult(url, source)) continue;
    const token = signPhotoToken({ v: 1, f: familyId, u: url, w: width, h: height });
    if (!token) continue;
    photos.push({
      photoNumber: photos.length + 1,
      title: title.slice(0, MAX_TITLE_CHARS),
      source: source.slice(0, 80),
      width,
      height,
      photoToken: token,
    });
  }
  return photos;
}

/**
 * searchWebPhotos(...): family-bound photo results or a model-readable
 * failure note. Never throws: quota or vendor hiccups read as "here is
 * what to do instead", not a broken turn.
 */
export async function searchWebPhotos(input: {
  familyId: string;
  query: string;
  kind?: PhotoKind;
  count?: number;
}): Promise<SearchWebPhotosOutcome> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      note: "Photo search is not configured on this deployment. Design with generated art or plain description instead.",
    };
  }

  const params = new URLSearchParams({
    engine: "google_images",
    q: input.query,
    api_key: apiKey,
    safe: "active",
    gl: "us",
    hl: "en",
  });
  const imageType = KIND_TO_IMAGE_TYPE[input.kind ?? "photo"];
  if (imageType) params.set("image_type", imageType);

  const count = Math.min(Math.max(input.count ?? DEFAULT_RESULTS, 1), MAX_RESULTS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
    });
    const json = (await response.json()) as SerpImagesResponse;
    if (!response.ok || typeof json.error === "string") {
      const message = typeof json.error === "string" ? json.error : `HTTP ${response.status}`;
      if (/run out of searches|rate limit/i.test(message)) {
        return {
          ok: false,
          note: "The photo-search budget for this month is used up. Use generate_image or describe the real thing in words instead.",
        };
      }
      console.error("searchWebPhotos vendor error:", message);
      return {
        ok: false,
        note: "Photo search hiccuped this time. Try once more with different words, or design without it.",
      };
    }
    return { ok: true, photos: normalizeImagesResponse(json, input.familyId, count) };
  } catch (error) {
    if (!controller.signal.aborted) {
      console.error(
        "searchWebPhotos failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
    return {
      ok: false,
      note: "Photo search did not respond this time. Try once more, or design without it.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * isAllowedPhotoType(mediaType): boolean
 * Raster-only allowlist for fetched bytes (content-type header value,
 * parameters tolerated).
 */
export function isAllowedPhotoType(mediaType: string): boolean {
  return ALLOWED_PHOTO_TYPES.has(mediaType.split(";")[0].trim().toLowerCase());
}

export type FetchPhotoOutcome =
  | { ok: true; bytes: Buffer; mediaType: string }
  | { ok: false; reason: "too_large" | "not_image" | "unreachable" };

/**
 * fetchWebPhotoBytes(url): the verified photo's bytes, size-capped while
 * streaming so a mislabeled giant file stops at the cap instead of
 * filling memory. The url must come from verifyPhotoToken, never from
 * model input.
 */
export async function fetchWebPhotoBytes(url: string): Promise<FetchPhotoOutcome> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) return { ok: false, reason: "unreachable" };
    const mediaType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!isAllowedPhotoType(mediaType)) return { ok: false, reason: "not_image" };
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PHOTO_BYTES) {
      return { ok: false, reason: "too_large" };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PHOTO_BYTES) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
    if (total === 0) return { ok: false, reason: "unreachable" };
    return { ok: true, bytes: Buffer.concat(chunks), mediaType };
  } catch {
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timeout);
  }
}
