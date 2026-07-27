import { sharpFromBmp } from "@huh-david/bmp-js/sharp";
import type { FilePart, ImagePart } from "ai";
import type { Attachment } from "chat";
import mammoth from "mammoth";
import sharp from "sharp";
import * as XLSX from "xlsx";

import {
  describeVideoBytes,
  twelveLabsConfigured,
  VIDEO_BYTES_MAX,
} from "../video/twelvelabs";
import { captionSmsImage } from "./caption-image";
import { downloadTelnyxMedia } from "./telnyx-api";
import { transcribeAudio, transcribeSmsMedia } from "./transcribe";

/**
 * The SMS attachment normalizer (founder ruling 2026-07-10: never deny
 * input). Every inbound MMS attachment gets a lane that converts it into
 * something the chat model natively consumes:
 *
 *   image     -> image part, passed through by URL (Claude reads jpeg/
 *                png/gif/webp natively); BMP (carrier-legal MMS type
 *                Claude cannot read) converts to PNG first, see below.
 *                Linked-family photos ALSO get a one-line caption block
 *                (caption-image.ts): the image part is turn-scoped, so
 *                without a text trace a photo-only exchange is invisible
 *                to recall forever (the microwave lesson, founder review
 *                2026-07-10 evening). The caption rides the turn text
 *                into conversation_messages, where FTS and semantic
 *                search can find it.
 *   audio     -> speech transcript block (Telnyx STT, transcribe.ts);
 *                voice notes that arrive typed "file" with an audio MIME
 *                or a known audio filename extension take this same lane
 *                (CG-05, 2026-07-25: a real voice note arrived file-typed
 *                and was dropped as unreadable without reaching STT)
 *   video     -> watched-video description block (Twelve Labs Pegasus,
 *                lib/video/twelvelabs.ts: what happens on screen plus
 *                what is said); clips under the vendor floors (4s,
 *                360x360) get one freeze-frame pad/upscale retry where
 *                ffmpeg exists (lib/video/pad.ts; dev now, prod
 *                pending the ffmpeg-static decision in the build-log),
 *                and when the key is unset or the watch still fails,
 *                the audio-track transcript lane (same STT as audio)
 *                catches it
 *   document  -> PDF passes through as a file part (Claude reads PDFs);
 *                Word (.docx) and Excel (.xlsx/.xls) extract to plain
 *                text/CSV first (mammoth, SheetJS), since Claude has no
 *                native reader for either format
 *   text      -> contact cards / calendar / plain text inlined as text
 *   other     -> a bracketed note naming the type, so the agent can
 *                acknowledge it instead of the channel going silent
 *
 * Failures never throw and never vanish: an attachment that could not
 * be converted becomes a bracketed failure note in the turn, and the
 * caller emits one sms.attachment_processed event per attachment so the
 * funnel shows exactly which media types arrive and which lanes work.
 *
 * BMP (2026-07-10): Telnyx's own MMS allowlist includes image/bmp, but
 * Claude's vision API only accepts jpeg/png/gif/webp (verified against
 * Anthropic's docs). sharp (already a dependency, used by Next's image
 * optimizer) cannot decode BMP either, verified live. @huh-david/bmp-js
 * ships a decoder with a first-class sharp adapter built for exactly
 * this: BMP bytes -> sharp -> PNG, verified live with a real BMP file.
 *
 * HEIC and Live Photos need NO lane (2026-07-10, researched, not
 * guessed): Homa's Telnyx number is not an iMessage-registered address,
 * so every iPhone send here is a green-bubble SMS/MMS fallback, and iOS
 * unconditionally transcodes HEIC to JPEG and flattens a Live Photo to a
 * plain still JPEG before that fallback leaves the phone (motion, sound,
 * and the HEIC container never survive the trip). Both already ride the
 * ordinary jpeg image lane above; there is nothing to build.
 *
 * Word and Excel (2026-07-10): real Word (.docx) and Excel (.xlsx/.xls)
 * files, generated with LibreOffice and SheetJS and run through the
 * actual lanes below, extract cleanly. Legacy binary .doc (pre-2007
 * Word) is NOT supported: mammoth only parses the OOXML .docx container,
 * and verified live it throws a clean, catchable "not a zip file" error
 * on a real .doc, never a hang. Legacy binary .xls IS supported, since
 * SheetJS decodes it directly, also verified live. What is genuinely
 * NOT verified: whether Telnyx's inbound MMS webhook forwards docx/xlsx
 * content types at all. Their own documented "Files" allowlist lists
 * only application/pdf, text/vcard, and text/calendar; other messaging
 * platforms (Textel, Plivo) advertise office-document support on their
 * own gateways, and separately, an iPhone's Messages app cannot attach
 * ANY document format to a green-bubble MMS at all (confirmed: Aerialink
 * docs state iPhone-to-non-iMessage document sending is unsupported
 * outside iMessage; Android support is carrier- and app-dependent). So
 * this lane is real and cheap to keep dormant, but its true trigger rate
 * is unknown until real texts flow: the sms.attachment_processed event
 * (kind: "document", media_type: docx/xlsx/xls) will show it happening,
 * the day it happens, same as every other lane here.
 */

export type SmsAttachmentKind =
  | "image"
  | "audio"
  | "video"
  | "document"
  | "text"
  | "other";

export type SmsAttachmentOutcome =
  /** The model consumes it directly, as delivered (images, PDFs). */
  | "model_native"
  /** Converted into a model-native format first (BMP images -> PNG). */
  | "converted"
  /** Speech became text through STT (voice notes; video clips when the
   *  visual lane is dark or the watch failed). */
  | "transcribed"
  /** A video was watched end to end (Twelve Labs): the block carries
   *  what happened on screen plus what was said. */
  | "described"
  /** Parsed text pulled out of a document format (Word, Excel). */
  | "extracted"
  /** A text-format file joined the turn as an inline block. */
  | "inlined"
  /** Unreadable; a bracketed note joined the turn instead. */
  | "failed";

export interface SmsAttachmentResult {
  kind: SmsAttachmentKind;
  mediaType: string;
  outcome: SmsAttachmentOutcome;
}

export interface NormalizedSmsAttachments {
  /** Marked text blocks in attachment order: transcripts, inlined text
   *  files, and failure notes. Joined into the turn text by the caller. */
  blocks: string[];
  /** Parts the model consumes directly: images by URL, PDFs as bytes. */
  mediaParts: Array<ImagePart | FilePart>;
  /** One entry per attachment, for analytics. */
  results: SmsAttachmentResult[];
  /** True when at least one attachment produced model-usable content. */
  hasContent: boolean;
}

/** Image types Claude accepts; an unsupported subtype sent as an image
 *  part would error the whole turn at the provider, so anything else
 *  either converts (below) or takes the failure-note lane. */
const MODEL_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/** BMP is a legacy-but-carrier-legal MMS image type (some Android/WAP
 *  stacks list it; modern phone cameras never produce it natively).
 *  Converts to PNG through @huh-david/bmp-js's sharp adapter. */
const CONVERTIBLE_IMAGE_TYPES = new Set(["image/bmp", "image/x-ms-bmp"]);

/** Same MMS size reasoning as DOCUMENT_MAX_BYTES below; a BMP this size
 *  would never survive carrier transcoding anyway. */
const IMAGE_CONVERT_MAX_BYTES = 4 * 1024 * 1024;

/** Document types Claude reads natively as file parts. */
const MODEL_DOCUMENT_TYPES = new Set(["application/pdf"]);

/** Word .docx: mammoth parses OOXML only, verified live; legacy binary
 *  .doc is a different, unsupported format (fails clean, see header). */
const WORD_DOCUMENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Excel .xlsx and legacy binary .xls: SheetJS reads both, verified
 *  live against a real LibreOffice-exported .xls. */
const SPREADSHEET_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

/** Carriers cap MMS near 1MB; this guard only exists so a misbehaving
 *  media URL can never balloon a turn. */
const DOCUMENT_MAX_BYTES = 4 * 1024 * 1024;

/** Extracted or inlined text is clipped so a large export cannot flood
 *  the context window; MMS-size files stay far under this. */
const EXTRACTED_TEXT_MAX_CHARS = 4000;

const VOICE_NOTE_MARKER = "[Voice note, transcribed]";
const VIDEO_MARKER = "[Video attached, audio track transcribed]";
const VIDEO_DESCRIBED_MARKER = "[Video attached, watched]";

/** The SMS reply path holds the parent's thread while the model
 *  watches; MMS clips run a few seconds to a minute, so this stays far
 *  under the webhook's patience while leaving the STT fallback time to
 *  run after a miss. */
const VIDEO_DESCRIBE_TIMEOUT_MS = 90_000;
const WORD_DOCUMENT_MARKER = "[Attached Word document, text extracted]";
const SPREADSHEET_MARKER = "[Attached spreadsheet, extracted as CSV]";
/** Bare markers so an attachment's EXISTENCE always reaches the durable
 *  record, even when captioning is off or fails; the parts themselves
 *  are turn-scoped and leave no searchable trace. */
const PHOTO_MARKER = "[Photo attached]";
const PDF_MARKER = "[PDF attached]";

/** Shared by every extraction lane (text files, Word, Excel) so a large
 *  file degrades to a truncated block instead of flooding the turn. */
function clipExtractedText(text: string): string {
  return text.length > EXTRACTED_TEXT_MAX_CHARS
    ? `${text.slice(0, EXTRACTED_TEXT_MAX_CHARS)}\n[truncated]`
    : text;
}

const FAILURE_NOTES: Record<SmsAttachmentKind, string> = {
  image: "[An image was attached in a format that could not be read.]",
  audio: "[A voice note was attached but could not be transcribed.]",
  video: "[A video was attached but could not be transcribed.]",
  document: "[A document was attached but could not be read.]",
  text: "[An attached file could not be read.]",
  other: "[An attachment of an unsupported type could not be read.]",
};

/** Labels for inlined text formats, so the model knows what it reads. */
function inlineLabelFor(mediaType: string): string {
  if (mediaType === "text/vcard" || mediaType === "text/x-vcard") {
    return "[Attached contact card]";
  }
  if (mediaType === "text/calendar") return "[Attached calendar file]";
  return "[Attached text file]";
}

function bareMediaType(mimeType: string | undefined): string {
  const bare = (mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return bare.length > 0 ? bare : "application/octet-stream";
}

/** "file"-typed attachments split into the lanes the model can take.
 *  "document" now covers every office format with a working extraction
 *  lane (pdf passes through natively; docx/xlsx/xls extract to text).
 *  Audio is rerouted BEFORE this split (fileAudioContentType below):
 *  a voice note typed "file" belongs to the transcript lane, not here. */
function kindForFile(mediaType: string): SmsAttachmentKind {
  if (
    MODEL_DOCUMENT_TYPES.has(mediaType) ||
    mediaType === WORD_DOCUMENT_TYPE ||
    SPREADSHEET_TYPES.has(mediaType)
  ) {
    return "document";
  }
  if (mediaType.startsWith("text/")) return "text";
  return "other";
}

/** Audio content types resolved from bare filename extensions, for
 *  voice notes that arrive typed "file" with a generic MIME. Only the
 *  unambiguously-audio subset of what transcribe.ts's STT upload
 *  allowlist already handles, including the iPhone AMR/3gpp family;
 *  extensions that usually mean video (.mp4, .webm) stay out, since a
 *  "[Voice note, transcribed]" marker on a video would mislabel it. */
const AUDIO_CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/m4a",
  wav: "audio/wav",
  ogg: "audio/ogg",
  amr: "audio/amr",
  awb: "audio/amr-wb",
  "3ga": "audio/3gpp",
  "3gp": "audio/3gpp",
  "3gpp": "audio/3gpp",
  "3g2": "audio/3gpp2",
};

/** Extension lookup that accepts either a bare filename (attachment
 *  name) or a full media URL (query strings and fragments ignored). */
function audioTypeForExtension(candidate: string | undefined): string | null {
  if (!candidate) return null;
  let path = candidate;
  try {
    path = new URL(candidate).pathname;
  } catch {
    // A bare filename is not a URL; use it as given.
  }
  const dot = path.lastIndexOf(".");
  if (dot === -1) return null;
  return AUDIO_CONTENT_TYPE_BY_EXTENSION[path.slice(dot + 1).toLowerCase()] ?? null;
}

/** The CG-05 gap (2026-07-25): some gateway stacks deliver a voice note
 *  typed "file" rather than "audio", and it used to drop as unreadable
 *  without ever reaching STT. An audio MIME wins outright; otherwise a
 *  known audio filename extension supplies the content type STT should
 *  assume, but only when no other lane claims the MIME: a document or
 *  text type keeps its lane under any filename, and video stays out of
 *  scope (the "file" split never distinguished it). Null means this
 *  attachment is not audio. */
function fileAudioContentType(
  mediaType: string,
  fileName: string | undefined,
  url: string | undefined,
): string | null {
  if (mediaType.startsWith("audio/")) return mediaType;
  if (mediaType.startsWith("video/")) return null;
  if (kindForFile(mediaType) !== "other") return null;
  return audioTypeForExtension(fileName) ?? audioTypeForExtension(url);
}

interface ProcessedSmsAttachment {
  result: SmsAttachmentResult;
  block?: string;
  part?: ImagePart | FilePart;
}

function failedAttachment(
  kind: SmsAttachmentKind,
  mediaType: string,
): ProcessedSmsAttachment {
  return {
    result: { kind, mediaType, outcome: "failed" },
    block: FAILURE_NOTES[kind],
  };
}

/** The photo's searchable trace: a captioned block for linked families
 *  (null familyId skips the model call; unlinked sessions never persist,
 *  so a caption would buy nothing), the bare marker otherwise. */
async function photoBlock(
  image: Uint8Array | URL,
  mediaType: string,
  familyId: string | null,
): Promise<string> {
  if (!familyId) return PHOTO_MARKER;
  const caption = await captionSmsImage({ image, mediaType, familyId });
  return caption ? `[Photo attached: ${caption}]` : PHOTO_MARKER;
}

async function convertBmpToPng(
  url: string,
  familyId: string | null,
): Promise<ProcessedSmsAttachment> {
  const bytes = await downloadTelnyxMedia(url);
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength > IMAGE_CONVERT_MAX_BYTES) {
    return failedAttachment("image", "image/bmp");
  }
  try {
    const png = await sharpFromBmp(new Uint8Array(bytes), sharp).png().toBuffer();
    return {
      result: { kind: "image", mediaType: "image/bmp", outcome: "converted" },
      part: { type: "image", image: png, mediaType: "image/png" },
      block: await photoBlock(png, "image/png", familyId),
    };
  } catch (error) {
    console.error(
      "BMP-to-PNG conversion failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return failedAttachment("image", "image/bmp");
  }
}

async function processImage(
  url: string,
  mediaType: string,
  familyId: string | null,
): Promise<ProcessedSmsAttachment> {
  if (MODEL_IMAGE_TYPES.has(mediaType)) {
    return {
      result: { kind: "image", mediaType, outcome: "model_native" },
      part: { type: "image", image: new URL(url) },
      block: await photoBlock(new URL(url), mediaType, familyId),
    };
  }
  if (CONVERTIBLE_IMAGE_TYPES.has(mediaType)) {
    return await convertBmpToPng(url, familyId);
  }
  return failedAttachment("image", mediaType);
}

async function processSpeech(
  kind: "audio" | "video",
  url: string,
  mediaType: string,
): Promise<ProcessedSmsAttachment> {
  const transcript = await transcribeSmsMedia(url, mediaType);
  if (!transcript) return failedAttachment(kind, mediaType);
  const marker = kind === "audio" ? VOICE_NOTE_MARKER : VIDEO_MARKER;
  return {
    result: { kind, mediaType, outcome: "transcribed" },
    block: `${marker}: ${transcript}`,
  };
}

/** The video lane: Pegasus watches the whole clip (visuals + speech)
 *  when the gateway is configured; any miss falls back to the original
 *  audio-track transcript, so a video never gets LESS understanding
 *  than it did before the visual lane existed. Bytes download once and
 *  feed both attempts. */
async function processVideo(
  url: string,
  mediaType: string,
): Promise<ProcessedSmsAttachment> {
  if (!twelveLabsConfigured()) return await processSpeech("video", url, mediaType);

  const bytes = await downloadTelnyxMedia(url);
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength > VIDEO_BYTES_MAX) {
    return failedAttachment("video", mediaType);
  }

  const description = await describeVideoBytes(bytes, {
    timeoutMs: VIDEO_DESCRIBE_TIMEOUT_MS,
  });
  if (description) {
    return {
      result: { kind: "video", mediaType, outcome: "described" },
      block: `${VIDEO_DESCRIBED_MARKER}: ${description}`,
    };
  }

  const transcript = await transcribeAudio(bytes, mediaType);
  if (!transcript) return failedAttachment("video", mediaType);
  return {
    result: { kind: "video", mediaType, outcome: "transcribed" },
    block: `${VIDEO_MARKER}: ${transcript}`,
  };
}

async function processPdf(
  url: string,
  mediaType: string,
): Promise<ProcessedSmsAttachment> {
  const bytes = await downloadTelnyxMedia(url);
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength > DOCUMENT_MAX_BYTES) {
    return failedAttachment("document", mediaType);
  }
  // Base64 (not Uint8Array) on purpose: the part survives every JSON
  // serialization on its way through eve's session storage.
  return {
    result: { kind: "document", mediaType, outcome: "model_native" },
    part: {
      type: "file",
      data: Buffer.from(bytes).toString("base64"),
      mediaType,
    },
    // File parts are turn-scoped like image parts; the marker keeps the
    // PDF's existence in the durable record (a caption lane for PDFs is
    // a noted follow-up).
    block: PDF_MARKER,
  };
}

async function processWordDocument(
  url: string,
  mediaType: string,
): Promise<ProcessedSmsAttachment> {
  const bytes = await downloadTelnyxMedia(url);
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength > DOCUMENT_MAX_BYTES) {
    return failedAttachment("document", mediaType);
  }
  try {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    const text = value.trim();
    if (text.length === 0) return failedAttachment("document", mediaType);
    return {
      result: { kind: "document", mediaType, outcome: "extracted" },
      block: `${WORD_DOCUMENT_MARKER}\n${clipExtractedText(text)}`,
    };
  } catch (error) {
    // Legacy binary .doc lands here too (mammoth only reads OOXML .docx);
    // verified live it throws a clean "not a zip file" error, not a hang.
    console.error(
      "Word document extraction failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return failedAttachment("document", mediaType);
  }
}

async function processSpreadsheet(
  url: string,
  mediaType: string,
): Promise<ProcessedSmsAttachment> {
  const bytes = await downloadTelnyxMedia(url);
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength > DOCUMENT_MAX_BYTES) {
    return failedAttachment("document", mediaType);
  }
  try {
    const workbook = XLSX.read(Buffer.from(bytes), { type: "buffer" });
    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const csv = sheet ? XLSX.utils.sheet_to_csv(sheet).trim() : "";
      return csv.length > 0 ? `Sheet "${name}":\n${csv}` : null;
    }).filter((sheet): sheet is string => sheet !== null);
    if (sheets.length === 0) return failedAttachment("document", mediaType);
    return {
      result: { kind: "document", mediaType, outcome: "extracted" },
      block: `${SPREADSHEET_MARKER}\n${clipExtractedText(sheets.join("\n\n"))}`,
    };
  } catch (error) {
    console.error(
      "Spreadsheet extraction failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return failedAttachment("document", mediaType);
  }
}

async function processDocument(
  url: string,
  mediaType: string,
): Promise<ProcessedSmsAttachment> {
  if (MODEL_DOCUMENT_TYPES.has(mediaType)) return await processPdf(url, mediaType);
  if (mediaType === WORD_DOCUMENT_TYPE) return await processWordDocument(url, mediaType);
  if (SPREADSHEET_TYPES.has(mediaType)) return await processSpreadsheet(url, mediaType);
  return failedAttachment("document", mediaType);
}

async function processTextFile(
  url: string,
  mediaType: string,
): Promise<ProcessedSmsAttachment> {
  const bytes = await downloadTelnyxMedia(url);
  if (!bytes || bytes.byteLength === 0) return failedAttachment("text", mediaType);
  const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
  if (raw.length === 0) return failedAttachment("text", mediaType);
  return {
    result: { kind: "text", mediaType, outcome: "inlined" },
    block: `${inlineLabelFor(mediaType)}\n${clipExtractedText(raw)}`,
  };
}

async function processOneSmsAttachment(
  attachment: Attachment,
  familyId: string | null,
): Promise<ProcessedSmsAttachment> {
  const mediaType = bareMediaType(attachment.mimeType);
  const url = attachment.url;

  switch (attachment.type) {
    case "image": {
      if (!url) return failedAttachment("image", mediaType);
      return await processImage(url, mediaType, familyId);
    }
    case "audio": {
      if (!url) return failedAttachment("audio", mediaType);
      return await processSpeech("audio", url, mediaType);
    }
    case "video": {
      if (!url) return failedAttachment("video", mediaType);
      return await processVideo(url, mediaType);
    }
    case "file": {
      const audioType = fileAudioContentType(mediaType, attachment.name, url);
      if (audioType !== null) {
        if (!url) return failedAttachment("audio", audioType);
        return await processSpeech("audio", url, audioType);
      }
      const kind = kindForFile(mediaType);
      if (!url || kind === "other") return failedAttachment(kind, mediaType);
      if (kind === "document") return await processDocument(url, mediaType);
      return await processTextFile(url, mediaType);
    }
    default: {
      const exhaustive: never = attachment.type;
      return failedAttachment("other", `${String(exhaustive)}/${mediaType}`);
    }
  }
}

/**
 * normalizeSmsAttachments(attachments, options): converts every inbound
 * MMS attachment into model-usable content (or a bracketed failure
 * note). Never throws; per-attachment outcomes come back for analytics.
 * options.familyId (the channel's auth context, never model input)
 * turns on photo captioning for linked families. Used by
 * agent/channels/telnyx.ts.
 */
export async function normalizeSmsAttachments(
  attachments: Attachment[],
  options?: { familyId?: string | null },
): Promise<NormalizedSmsAttachments> {
  const blocks: string[] = [];
  const mediaParts: Array<ImagePart | FilePart> = [];
  const results: SmsAttachmentResult[] = [];
  const familyId = options?.familyId ?? null;

  for (const attachment of attachments) {
    const processed = await processOneSmsAttachment(attachment, familyId);
    results.push(processed.result);
    if (processed.block) blocks.push(processed.block);
    if (processed.part) mediaParts.push(processed.part);
  }

  return {
    blocks,
    mediaParts,
    results,
    hasContent: results.some((result) => result.outcome !== "failed"),
  };
}
