import type { FilePart } from "ai";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

import { composeFileMarker, composePhotoMarker } from "./markers";
import { describeVideoAtUrl, twelveLabsConfigured } from "../video/twelvelabs";
import { captionSmsImage } from "../voice/caption-image";
import { transcribeAudio } from "../voice/transcribe";

/**
 * The web chat attachment normalizer (the SMS normalizer's sibling,
 * lib/voice/sms-attachments.ts; founder ruling 2026-07-10 carried over:
 * never deny input). Files arrive ALREADY uploaded to the family's own
 * chat blob space (/api/chat/upload), so unlike SMS there is no
 * carrier download step and URLs never expire: images and PDFs ride to
 * the model BY URL (plain https strings, which survive the JSON trip
 * through eve's session storage), while speech, video, and office
 * formats convert to text blocks through the exact lanes SMS uses
 * (Telnyx STT, Twelve Labs, mammoth, SheetJS).
 *
 * Every attachment also gets a MARKER line (markers.ts) carrying its
 * caption or filename plus the blob URL, which is what makes the file
 * findable in conversation_messages and re-renderable in scrollback.
 */

export type ChatAttachmentKind =
  | "image"
  | "audio"
  | "video"
  | "document"
  | "text"
  | "other";

export type ChatAttachmentOutcome =
  | "model_native"
  | "described"
  | "transcribed"
  | "extracted"
  | "inlined"
  | "failed";

export interface ChatAttachmentInput {
  url: string;
  mediaType: string;
  name: string | null;
}

export interface NormalizedChatAttachment {
  input: ChatAttachmentInput;
  kind: ChatAttachmentKind;
  outcome: ChatAttachmentOutcome;
  /** The searchable one-liner for the DB row: photo caption or filename. */
  caption: string | null;
  /** Model-facing text block (transcript, extraction, failure note). */
  block: string | null;
  /** The durable marker line for the turn text. */
  marker: string;
  /**
   * Model-consumable part (images and PDFs, by URL). Always a `file` part:
   * eve's /eve/v1/session parser accepts only `text` and `file`, so the AI
   * SDK image-part shape would 400 (BUG-P3-1). An image is a file part with
   * an image mediaType; eve lowers it to model vision content downstream.
   */
  part: FilePart | null;
}

const MODEL_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const WORD_DOCUMENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const SPREADSHEET_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

/** Office and text extraction guard, the SMS DOCUMENT_MAX_BYTES twin. */
const EXTRACT_MAX_BYTES = 8 * 1024 * 1024;

/** Voice notes above this stop being notes; STT gets the first slice
 *  of nothing rather than a stalled turn. */
const AUDIO_MAX_BYTES = 25 * 1024 * 1024;

const EXTRACTED_TEXT_MAX_CHARS = 4000;

const VOICE_NOTE_MARKER = "[Voice note, transcribed]";
const VIDEO_DESCRIBED_MARKER = "[Video attached, watched]";
const VIDEO_TRANSCRIBED_MARKER = "[Video attached, audio track transcribed]";
const WORD_DOCUMENT_MARKER = "[Attached Word document, text extracted]";
const SPREADSHEET_MARKER = "[Attached spreadsheet, extracted as CSV]";

const FAILURE_NOTES: Record<ChatAttachmentKind, string> = {
  image: "[An image was attached in a format that could not be read.]",
  audio: "[A voice note was attached but could not be transcribed.]",
  video: "[A video was attached but could not be watched or transcribed.]",
  document: "[A document was attached but could not be read.]",
  text: "[An attached file could not be read.]",
  other: "[An attachment of an unsupported type could not be read.]",
};

/** The chat reply path holds the composer while the model watches; the
 *  same patience budget the SMS webhook grants. */
const VIDEO_DESCRIBE_TIMEOUT_MS = 90_000;

function bareMediaType(mediaType: string): string {
  const bare = mediaType.split(";")[0]?.trim().toLowerCase() ?? "";
  return bare.length > 0 ? bare : "application/octet-stream";
}

export function chatAttachmentKind(mediaType: string): ChatAttachmentKind {
  const bare = bareMediaType(mediaType);
  if (bare.startsWith("image/")) return "image";
  if (bare.startsWith("audio/")) return "audio";
  if (bare.startsWith("video/")) return "video";
  if (
    bare === "application/pdf" ||
    bare === WORD_DOCUMENT_TYPE ||
    SPREADSHEET_TYPES.has(bare)
  ) {
    return "document";
  }
  if (bare.startsWith("text/")) return "text";
  return "other";
}

function clipExtractedText(text: string): string {
  return text.length > EXTRACTED_TEXT_MAX_CHARS
    ? `${text.slice(0, EXTRACTED_TEXT_MAX_CHARS)}\n[truncated]`
    : text;
}

/** Blob fetch for the conversion lanes. Fail-soft: null, never throws. */
async function fetchBlobBytes(
  url: string,
  maxBytes: number,
): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) return null;
    return bytes;
  } catch {
    return null;
  }
}

function failed(
  input: ChatAttachmentInput,
  kind: ChatAttachmentKind,
): NormalizedChatAttachment {
  return {
    input,
    kind,
    outcome: "failed",
    caption: input.name,
    block: FAILURE_NOTES[kind],
    marker: composeFileMarker({ name: input.name, url: input.url }),
    part: null,
  };
}

async function processImage(
  input: ChatAttachmentInput,
  mediaType: string,
  familyId: string,
): Promise<NormalizedChatAttachment> {
  if (!MODEL_IMAGE_TYPES.has(mediaType)) return failed(input, "image");
  const caption = await captionSmsImage({
    image: new URL(input.url),
    mediaType,
    familyId,
    attribution: {
      resourceKind: "attachment",
      resourceId: input.url,
    },
  });
  return {
    input,
    kind: "image",
    outcome: "model_native",
    caption,
    block: null,
    marker: composePhotoMarker({ caption, url: input.url }),
    // A `file` part with an image mediaType, not the AI SDK `image` part:
    // eve's session parser rejects `image` (BUG-P3-1) and lowers a file part
    // with an image mediaType to model vision content, exactly like the PDF
    // lane above.
    part: {
      type: "file",
      data: input.url,
      mediaType,
      ...(input.name ? { filename: input.name } : {}),
    },
  };
}

function processPdf(
  input: ChatAttachmentInput,
  mediaType: string,
): NormalizedChatAttachment {
  return {
    input,
    kind: "document",
    outcome: "model_native",
    caption: input.name,
    block: null,
    marker: composeFileMarker({ name: input.name, url: input.url }),
    part: {
      type: "file",
      data: input.url,
      mediaType,
      ...(input.name ? { filename: input.name } : {}),
    },
  };
}

async function processAudio(
  input: ChatAttachmentInput,
  mediaType: string,
): Promise<NormalizedChatAttachment> {
  const bytes = await fetchBlobBytes(input.url, AUDIO_MAX_BYTES);
  const transcript = bytes ? await transcribeAudio(bytes, mediaType) : null;
  if (!transcript) return failed(input, "audio");
  return {
    input,
    kind: "audio",
    outcome: "transcribed",
    caption: input.name,
    block: `${VOICE_NOTE_MARKER}: ${transcript}`,
    marker: composeFileMarker({ name: input.name, url: input.url }),
    part: null,
  };
}

async function processVideo(
  input: ChatAttachmentInput,
  mediaType: string,
): Promise<NormalizedChatAttachment> {
  const marker = composeFileMarker({ name: input.name, url: input.url });
  if (twelveLabsConfigured()) {
    const description = await describeVideoAtUrl(input.url, {
      timeoutMs: VIDEO_DESCRIBE_TIMEOUT_MS,
    });
    if (description) {
      return {
        input,
        kind: "video",
        outcome: "described",
        caption: input.name,
        block: `${VIDEO_DESCRIBED_MARKER}: ${description}`,
        marker,
        part: null,
      };
    }
  }
  // The audio-track fallback, so a clip never gets LESS understanding
  // than a voice note would.
  const bytes = await fetchBlobBytes(input.url, AUDIO_MAX_BYTES);
  const transcript = bytes ? await transcribeAudio(bytes, mediaType) : null;
  if (!transcript) return failed(input, "video");
  return {
    input,
    kind: "video",
    outcome: "transcribed",
    caption: input.name,
    block: `${VIDEO_TRANSCRIBED_MARKER}: ${transcript}`,
    marker,
    part: null,
  };
}

async function processWordDocument(
  input: ChatAttachmentInput,
): Promise<NormalizedChatAttachment> {
  const bytes = await fetchBlobBytes(input.url, EXTRACT_MAX_BYTES);
  if (!bytes) return failed(input, "document");
  try {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    const text = value.trim();
    if (text.length === 0) return failed(input, "document");
    return {
      input,
      kind: "document",
      outcome: "extracted",
      caption: input.name,
      block: `${WORD_DOCUMENT_MARKER}\n${clipExtractedText(text)}`,
      marker: composeFileMarker({ name: input.name, url: input.url }),
      part: null,
    };
  } catch {
    return failed(input, "document");
  }
}

async function processSpreadsheet(
  input: ChatAttachmentInput,
): Promise<NormalizedChatAttachment> {
  const bytes = await fetchBlobBytes(input.url, EXTRACT_MAX_BYTES);
  if (!bytes) return failed(input, "document");
  try {
    const workbook = XLSX.read(Buffer.from(bytes), { type: "buffer" });
    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const csv = sheet ? XLSX.utils.sheet_to_csv(sheet).trim() : "";
      return csv.length > 0 ? `Sheet "${name}":\n${csv}` : null;
    }).filter((sheet): sheet is string => sheet !== null);
    if (sheets.length === 0) return failed(input, "document");
    return {
      input,
      kind: "document",
      outcome: "extracted",
      caption: input.name,
      block: `${SPREADSHEET_MARKER}\n${clipExtractedText(sheets.join("\n\n"))}`,
      marker: composeFileMarker({ name: input.name, url: input.url }),
      part: null,
    };
  } catch {
    return failed(input, "document");
  }
}

async function processTextFile(
  input: ChatAttachmentInput,
): Promise<NormalizedChatAttachment> {
  const bytes = await fetchBlobBytes(input.url, EXTRACT_MAX_BYTES);
  if (!bytes) return failed(input, "text");
  const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
  if (raw.length === 0) return failed(input, "text");
  return {
    input,
    kind: "text",
    outcome: "inlined",
    caption: input.name,
    block: `[Attached text file]\n${clipExtractedText(raw)}`,
    marker: composeFileMarker({ name: input.name, url: input.url }),
    part: null,
  };
}

export async function normalizeOneChatAttachment(
  input: ChatAttachmentInput,
  familyId: string,
): Promise<NormalizedChatAttachment> {
  const mediaType = bareMediaType(input.mediaType);
  const kind = chatAttachmentKind(mediaType);
  switch (kind) {
    case "image":
      return await processImage(input, mediaType, familyId);
    case "audio":
      return await processAudio(input, mediaType);
    case "video":
      return await processVideo(input, mediaType);
    case "document":
      if (mediaType === "application/pdf") return processPdf(input, mediaType);
      if (mediaType === WORD_DOCUMENT_TYPE) return await processWordDocument(input);
      return await processSpreadsheet(input);
    case "text":
      return await processTextFile(input);
    case "other":
      return failed(input, "other");
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/**
 * normalizeChatAttachments(items, familyId): every uploaded file
 * becomes model-usable content or a bracketed failure note, in input
 * order. Never throws; the caller persists rows and emits one
 * chat.attachment_processed event per item.
 */
export async function normalizeChatAttachments(
  items: readonly ChatAttachmentInput[],
  familyId: string,
): Promise<NormalizedChatAttachment[]> {
  const normalized: NormalizedChatAttachment[] = [];
  for (const item of items) {
    normalized.push(await normalizeOneChatAttachment(item, familyId));
  }
  return normalized;
}
