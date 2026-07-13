/**
 * The web chat attachment marker format, one module for both directions
 * (composed at send time by /api/chat/attachments, parsed at render
 * time by the transcript). conversation_messages is a text column, so
 * an attachment's durable trace is a bracketed line in the message
 * content, the SMS convention, EXTENDED with the blob URL so web
 * scrollback can re-render the photo itself (SMS markers stay URL-less;
 * Telnyx URLs expire, blob URLs do not).
 *
 *   [Photo attached · <caption> · <url>]
 *   [File attached · <name> · <url>]
 *
 * The model reads the full marker in the turn text (it says what rode
 * along and what it shows); recall greps it; the bubble renderer strips
 * marker lines from the visible text and draws the photo or file chip
 * instead. eve's own part placeholders ("[image: image/jpeg]",
 * "[file: name (type)]") are stripped too: the marker carries strictly
 * more information.
 *
 * Pure module, no imports, unit-tested without a browser.
 */

export interface PhotoMarker {
  kind: "photo";
  caption: string;
  url: string;
}

export interface FileMarker {
  kind: "file";
  name: string;
  url: string;
}

export type AttachmentMarker = PhotoMarker | FileMarker;

export interface ParsedMessageText {
  /** The message text with marker and placeholder lines removed. */
  visibleText: string;
  markers: AttachmentMarker[];
}

const PHOTO_PREFIX = "[Photo attached · ";
const FILE_PREFIX = "[File attached · ";

/** eve's summarizeUserContent placeholders for non-text parts; carried
 *  in the persisted text but redundant next to our markers. */
const EVE_PLACEHOLDER = /^\[(?:image|file): [^\]]*\]$/;

/** The separator and closer are structural; a caption or name that
 *  contains them would corrupt the line, so they flatten to spaces. */
function sanitizeMarkerField(value: string): string {
  return value.replace(/[·\[\]]/gu, " ").replace(/\s+/gu, " ").trim();
}

export function composePhotoMarker(input: {
  caption: string | null;
  url: string;
}): string {
  const caption = sanitizeMarkerField(input.caption ?? "") || "photo";
  return `${PHOTO_PREFIX}${caption} · ${input.url}]`;
}

export function composeFileMarker(input: {
  name: string | null;
  url: string;
}): string {
  const name = sanitizeMarkerField(input.name ?? "") || "file";
  return `${FILE_PREFIX}${name} · ${input.url}]`;
}

function parseMarkerLine(line: string): AttachmentMarker | null {
  const trimmed = line.trim();
  if (!trimmed.endsWith("]")) return null;
  const isPhoto = trimmed.startsWith(PHOTO_PREFIX);
  const isFile = trimmed.startsWith(FILE_PREFIX);
  if (!isPhoto && !isFile) return null;
  const prefix = isPhoto ? PHOTO_PREFIX : FILE_PREFIX;
  const body = trimmed.slice(prefix.length, -1);
  const lastSeparator = body.lastIndexOf(" · ");
  if (lastSeparator === -1) return null;
  const label = body.slice(0, lastSeparator).trim();
  const url = body.slice(lastSeparator + 3).trim();
  if (!url.startsWith("https://")) return null;
  return isPhoto
    ? { kind: "photo", caption: label, url }
    : { kind: "file", name: label, url };
}

/**
 * parseAttachmentMarkers(text): the visible message text plus every
 * attachment marker found, in order. Marker and eve-placeholder lines
 * leave the visible text; everything else stays byte for byte.
 */
export function parseAttachmentMarkers(text: string): ParsedMessageText {
  const markers: AttachmentMarker[] = [];
  const keptLines: string[] = [];
  for (const line of text.split("\n")) {
    const marker = parseMarkerLine(line);
    if (marker) {
      markers.push(marker);
      continue;
    }
    if (EVE_PLACEHOLDER.test(line.trim())) continue;
    keptLines.push(line);
  }
  return { visibleText: keptLines.join("\n").trim(), markers };
}

/**
 * isFamilyChatAttachmentUrl(url, familyId): the render-side wall. Only
 * URLs inside THIS family's own chat blob space render as media; a
 * marker hand-typed into the composer (or replayed cross-family) shows
 * nothing. Mirrors isFamilyArtifactUrl (lib/materials/artifact-store).
 */
export function isFamilyChatAttachmentUrl(
  url: string,
  familyId: string | null,
): boolean {
  if (!familyId) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".public.blob.vercel-storage.com") &&
      parsed.pathname.startsWith(`/families/${familyId}/chat/`)
    );
  } catch {
    return false;
  }
}
