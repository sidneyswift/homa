import { readActivityPlan, type ActivityPlan } from "./materials/activity-plan";
/**
 * Pure model for the server-rendered chat history (the M1-02 render
 * slice, founder cut 2026-07-12): the web transcript's scrollback comes
 * from public.conversation_messages instead of the device's localStorage
 * cache, so every device shows the same one thread.
 *
 * Privacy shape (ruling chat-privacy-per-adult, 2026-07-12): an adult
 * sees only their own conversations plus messages Homa addressed to
 * them. The fetch layer (chat-history.ts) queries three per-adult
 * slices; this module is the channel/role vocabulary plus the pure
 * merge those queries share. Pure on purpose: node --test covers it
 * without a database.
 */

import type { EveMessage } from "eve/client";

import {
  familyAssetReferencesForSurface,
  parseFamilyAssetReferenceSnapshots,
  type FamilyAssetReference,
} from "./library/family-asset-reference";
import {
  selectParentVisibleMaterialRevisions,
  type MaterialRevisionCandidate,
} from "./materials/parent-visible";
import { isHiddenDirective } from "./onboarding/directives";

export type ChatHistoryChannel = "web" | "sms" | "email" | "dispatch";

export interface ChatHistoryMessage {
  id: string;
  sessionId: string;
  turnId: string | null;
  role: "user" | "assistant";
  channel: ChatHistoryChannel;
  /** How the turn arrived. In-app voice is channel "web" (that is where
   * it happened) and modality "voice", so the transcript can mark a
   * spoken stretch without lying about the surface it came from. */
  modality: "text" | "voice";
  content: string;
  /** created_at as epoch ms, the transcript's day-separator clock. */
  atMs: number;
}

/**
 * A material made during one of the scrollback's sessions, read from
 * public.materials (which stamps its creating session in generation).
 * conversation_messages stores plain text, so without this join a
 * material card lives only in the live eve stream: one dead stream or
 * one reload and the worksheet she was told to "take a look" at has no
 * card anywhere (the Vega family incident, 2026-07-13).
 */
export interface ChatHistoryMaterial extends MaterialRevisionCandidate {
  id: string;
  sessionId: string;
  title: string;
  kind: string | null;
  skill: string | null;
  childName: string | null;
  previewUrl: string;
  pdfUrl: string;
  /** PDF pages (1 for classic single-page materials). */
  pageCount: number;
  /** Per-page previews for multi-page materials, page 1 first. */
  pagePreviewUrls: string[] | null;
  activityPlan?: ActivityPlan;
  /** Verified Family Library inputs, linked back to their originals. */
  sources: FamilyAssetReference[];
  /** materials.created_at as epoch ms, for transcript placement. */
  atMs: number;
}

/** Raw row shape as selected from materials (JSON paths aliased). */
export interface ChatHistoryMaterialRow {
  id: string;
  title: string | null;
  kind: string | null;
  skill: string | null;
  preview_url: string | null;
  pdf_url: string | null;
  created_at: string;
  session_id: string | null;
  child_name: string | null;
  page_count?: number | string | null;
  page_preview_urls?: unknown;
  activity_plan?: unknown;
  family_sources?: unknown;
  status: "draft" | "final" | "superseded";
  revises: string | null;
  review_pass: string | null;
}

/** Everything the chat page's server read hands the client. */
export interface ChatHistoryPayload {
  messages: ChatHistoryMessage[];
  materials: ChatHistoryMaterial[];
  materialsUnavailable?: boolean;
}

/** Raw row shape as selected from conversation_messages. */
export interface ChatHistoryRow {
  id: string;
  session_id: string;
  turn_id: string | null;
  role: string;
  channel: string;
  /** Null for every row written before the column existed, which is all
   * of them at migration time; those are text. */
  modality?: string | null;
  content: string | null;
  created_at: string;
}

const CHANNELS: readonly ChatHistoryChannel[] = [
  "web",
  "sms",
  "email",
  "dispatch",
];

export function toChatHistoryMessage(
  row: ChatHistoryRow,
): ChatHistoryMessage | null {
  if (row.role !== "user" && row.role !== "assistant") return null;
  if (!CHANNELS.includes(row.channel as ChatHistoryChannel)) return null;
  const content = (row.content ?? "").trim();
  if (content.length === 0) return null;
  // A hidden onboarding directive is the app talking on her behalf, so
  // it renders no bubble. The fetch layer already filters to
  // visibility='family' and these rows persist internal, so this is the
  // second lock on the same door: rendering one as her own message is
  // the exact failure the directive contract exists to prevent, and it
  // would be invisible in review until a parent saw brackets in her own
  // scrollback.
  if (isHiddenDirective(content)) return null;
  const atMs = Date.parse(row.created_at);
  if (Number.isNaN(atMs)) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    turnId: row.turn_id,
    role: row.role,
    channel: row.channel as ChatHistoryChannel,
    // Anything but the one known spoken value is text: an unrecognized
    // modality should render as an ordinary message, never vanish.
    modality: row.modality === "voice" ? "voice" : "text",
    content,
    atMs,
  };
}

/**
 * mergeChatHistoryRows(batches, cap): one transcript from the per-adult
 * query slices. Rows dedupe by id (a delivered web reply appears in both
 * the session slice and the delivery slice), sort oldest first, and only
 * the most recent `cap` messages survive (the render archive stays
 * bounded; recall covers the deep past).
 */
export function mergeChatHistoryRows(
  batches: readonly (readonly ChatHistoryRow[])[],
  cap: number,
): ChatHistoryMessage[] {
  const byId = new Map<string, ChatHistoryMessage>();
  for (const batch of batches) {
    for (const row of batch) {
      const message = toChatHistoryMessage(row);
      if (message && !byId.has(message.id)) byId.set(message.id, message);
    }
  }
  const merged = [...byId.values()].sort(
    (a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id),
  );
  return merged.length > cap ? merged.slice(merged.length - cap) : merged;
}

/** Rows older than the packet work carry no pageCount; they are one page. */
function parsePageCount(raw: number | string | null | undefined): number {
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 1
    ? parsed
    : 1;
}

function parsePagePreviewUrls(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const urls = raw.filter((entry): entry is string => typeof entry === "string");
  return urls.length > 1 ? urls : null;
}

export function toChatHistoryMaterial(
  row: ChatHistoryMaterialRow,
): ChatHistoryMaterial | null {
  if (!row.session_id || !row.title || !row.preview_url || !row.pdf_url) {
    return null;
  }
  const atMs = Date.parse(row.created_at);
  if (Number.isNaN(atMs)) return null;
  const reviewPass =
    row.review_pass === "true"
      ? true
      : row.review_pass === "false"
        ? false
        : null;
  return {
    id: row.id,
    revisesId: row.revises,
    status: row.status,
    reviewPass,
    order: atMs,
    sessionId: row.session_id,
    title: row.title,
    kind: row.kind,
    skill: row.skill,
    childName: row.child_name,
    previewUrl: row.preview_url,
    pdfUrl: row.pdf_url,
    pageCount: parsePageCount(row.page_count),
    pagePreviewUrls: parsePagePreviewUrls(row.page_preview_urls),
    activityPlan: readActivityPlan(row.activity_plan),
    sources: familyAssetReferencesForSurface(
      parseFamilyAssetReferenceSnapshots(row.family_sources),
    ),
    atMs,
  };
}

/** The dynamic-tool part shape message-parts.tsx renders as a
 *  MaterialCard, rebuilt from the durable materials row. */
function materialToolPart(material: ChatHistoryMaterial) {
  return {
    type: "dynamic-tool",
    state: "output-available",
    toolName: "create_printable",
    output: {
      created: true,
      material: {
        id: material.id,
        title: material.title,
        kind: material.kind ?? undefined,
        skill: material.skill,
        childName: material.childName,
        previewUrl: material.previewUrl,
        pdfUrl: material.pdfUrl,
        pageCount: material.pageCount,
        ...(material.activityPlan ? { activityPlan: material.activityPlan } : {}),
        ...(material.pagePreviewUrls
          ? { pagePreviewUrls: material.pagePreviewUrls }
          : {}),
        sources: material.sources,
        status: material.status,
        revisesId: material.revisesId,
        reviewPassed: material.reviewPass,
      },
    },
  };
}

/**
 * archiveFromServerHistory(payload, liveMessages): server rows in the
 * render archive's shape. A server row is excluded only when the live
 * reducer proves that it has the same session, turn and role. This keeps a
 * partially replayed current session from hiding durable work while
 * still preventing duplicate bubbles. The `hist:` id prefix keeps
 * server ids from ever colliding with eve's turn ids.
 *
 * Materials render as cards in scrollback, same as a live turn: each
 * one becomes a create_printable part on the first assistant message
 * of its session at or after its creation (cards above the reply text,
 * matching live part order). A material whose reply text never
 * persisted still shows, as its own `mat:` message at its timestamp.
 */
export function archiveFromServerHistory(
  payload: ChatHistoryPayload,
  liveMessages: readonly EveMessage[],
  liveSessionId?: string,
): {
  at: number;
  channel: ChatHistoryChannel;
  modality: "text" | "voice";
  message: EveMessage;
  sessionId: string;
}[] {
  const liveMessageIds = new Set(liveMessages.map((message) => message.id));
  const history = payload.messages.filter(
    (entry) =>
      // Without a live session id (/app today) keep the original turn/role rule.
      (liveSessionId !== undefined && entry.sessionId !== liveSessionId) ||
      entry.turnId === null ||
      !liveMessageIds.has(`${entry.turnId}:${entry.role}`),
  );
  const liveMaterialIds = new Set<string>();
  for (const message of liveMessages) {
    for (const part of message.parts) {
      if (part.type !== "dynamic-tool" || part.state !== "output-available") {
        continue;
      }
      const materialId = (
        part.output as { material?: { id?: unknown } } | undefined
      )?.material?.id;
      if (typeof materialId === "string") liveMaterialIds.add(materialId);
    }
  }
  const materials = selectParentVisibleMaterialRevisions(
    payload.materials.filter(
      (material) => !liveMaterialIds.has(material.id),
    ),
  );

  const cardsByMessageId = new Map<string, ChatHistoryMaterial[]>();
  const standalone: ChatHistoryMaterial[] = [];
  for (const material of materials) {
    const host = history.find(
      (entry) =>
        entry.role === "assistant" &&
        entry.sessionId === material.sessionId &&
        entry.atMs >= material.atMs,
    );
    if (host) {
      const cards = cardsByMessageId.get(host.id) ?? [];
      cards.push(material);
      cardsByMessageId.set(host.id, cards);
    } else {
      standalone.push(material);
    }
  }

  const archive = history.map((entry) => ({
    at: entry.atMs,
    channel: entry.channel,
    modality: entry.modality,
    sessionId: entry.sessionId,
    message: {
      id: `hist:${entry.id}`,
      role: entry.role,
      parts: [
        ...(cardsByMessageId.get(entry.id) ?? []).map(materialToolPart),
        { type: "text", text: entry.content },
      ],
    } as EveMessage,
  }));

  for (const material of standalone) {
    archive.push({
      at: material.atMs,
      channel: "web",
      modality: "text",
      sessionId: material.sessionId,
      message: {
        id: `mat:${material.id}`,
        role: "assistant",
        parts: [materialToolPart(material)],
      } as EveMessage,
    });
  }

  return archive.sort((a, b) => a.at - b.at);
}

/**
 * recentSessionIds(rows, cap): the distinct sessions behind an adult's
 * own messages, newest first, capped so the companion-row query's IN
 * list stays a sane URL. Sessions are how Homa's replies (stored with
 * no member attribution) get tied back to the adult who was talking.
 */
export function recentSessionIds(
  rows: readonly ChatHistoryRow[],
  cap: number,
): string[] {
  const ordered = [...rows].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  const seen = new Set<string>();
  for (const row of ordered) {
    if (row.session_id) seen.add(row.session_id);
    if (seen.size >= cap) break;
  }
  return [...seen];
}
