import { readActivityPlan, type ActivityPlan } from "@homa/core";
import type {
  EveMessage,
  HandleMessageStreamEvent,
  SessionState,
} from "eve/client";

import { env, EVE_CHANNEL_HEADER } from "./env";
import {
  archiveMessages,
  foldEventsToMessages,
  MAX_ARCHIVED_MESSAGES,
  type ArchivedMessage,
  type PreparedChat,
} from "./chat-storage";

type ChatHistoryChannel = "web" | "sms" | "email" | "dispatch";

export interface MobileChatHistoryMessage {
  id: string;
  sessionId: string;
  turnId: string | null;
  role: "user" | "assistant";
  channel: ChatHistoryChannel;
  modality: "text" | "voice";
  content: string;
  atMs: number;
}

export interface MobileChatHistoryMaterial {
  id: string;
  sessionId: string;
  title: string;
  kind: string | null;
  skill: string | null;
  childName: string | null;
  previewUrl: string;
  pdfUrl: string;
  activityPlan?: ActivityPlan;
  pageCount: number;
  pagePreviewUrls: string[] | null;
  sources: unknown[];
  status: "draft" | "final" | "superseded";
  revisesId: string | null;
  reviewPass: boolean | null;
  atMs: number;
}

export interface MobileChatHistoryPayload {
  messages: MobileChatHistoryMessage[];
  materials: MobileChatHistoryMaterial[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? value as Record<string, unknown>
    : null;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function historyMessage(value: unknown): MobileChatHistoryMessage | null {
  const row = record(value);
  if (!row) return null;
  const channels: readonly string[] = ["web", "sms", "email", "dispatch"];
  if (
    typeof row.id !== "string" ||
    typeof row.sessionId !== "string" ||
    !nullableString(row.turnId) ||
    (row.role !== "user" && row.role !== "assistant") ||
    typeof row.channel !== "string" ||
    !channels.includes(row.channel) ||
    (row.modality !== "text" && row.modality !== "voice") ||
    typeof row.content !== "string" ||
    typeof row.atMs !== "number" ||
    !Number.isFinite(row.atMs)
  ) {
    return null;
  }
  return row as unknown as MobileChatHistoryMessage;
}

function historyMaterial(value: unknown): MobileChatHistoryMaterial | null {
  const row = record(value);
  if (!row) return null;
  const pagePreviewUrls = row.pagePreviewUrls;
  const previewsValid =
    pagePreviewUrls === null ||
    (Array.isArray(pagePreviewUrls) && pagePreviewUrls.every((item) => typeof item === "string"));
  if (
    typeof row.id !== "string" ||
    typeof row.sessionId !== "string" ||
    typeof row.title !== "string" ||
    !nullableString(row.kind) ||
    !nullableString(row.skill) ||
    !nullableString(row.childName) ||
    typeof row.previewUrl !== "string" ||
    typeof row.pdfUrl !== "string" ||
    typeof row.pageCount !== "number" ||
    !Number.isFinite(row.pageCount) ||
    row.pageCount < 1 ||
    !previewsValid ||
    !Array.isArray(row.sources) ||
    (row.status !== "draft" && row.status !== "final" && row.status !== "superseded") ||
    !nullableString(row.revisesId) ||
    (row.reviewPass !== null && typeof row.reviewPass !== "boolean") ||
    typeof row.atMs !== "number" ||
    !Number.isFinite(row.atMs)
  ) {
    return null;
  }
  return row as unknown as MobileChatHistoryMaterial;
}

function parsePayload(value: unknown): MobileChatHistoryPayload | null {
  const body = record(value);
  if (!body || !Array.isArray(body.messages) || !Array.isArray(body.materials)) {
    return null;
  }
  const messages = body.messages.map(historyMessage);
  const materials = body.materials.map(historyMaterial);
  if (messages.some((item) => item === null) || materials.some((item) => item === null)) {
    return null;
  }
  return {
    messages: messages as MobileChatHistoryMessage[],
    materials: materials as MobileChatHistoryMaterial[],
  };
}

export async function fetchMobileChatHistory(
  accessToken: string,
  options: {
    apiOrigin?: string;
    request?: typeof fetch;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
): Promise<MobileChatHistoryPayload | null> {
  const origin = (options.apiOrigin ?? env.apiUrl).replace(/\/+$/, "");
  const request = options.request ?? fetch;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) {
    controller.abort();
  } else {
    options.signal?.addEventListener("abort", abort);
  }
  const timeout = setTimeout(abort, options.timeoutMs ?? 5_000);
  try {
    const response = await request(`${origin}/api/chat/history`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...EVE_CHANNEL_HEADER,
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = record(await response.json());
    if (!body || body.ok !== true) return null;
    return parsePayload(body.history);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

function normalizedSources(
  sources: unknown[],
  apiOrigin: string | undefined,
): unknown[] {
  return sources.map((source) => {
    const value = record(source);
    if (
      !value ||
      typeof value.libraryUrl !== "string" ||
      !value.libraryUrl.startsWith("/")
    ) {
      return source;
    }
    const origin = (apiOrigin ?? env.apiUrl).replace(/\/+$/, "");
    return { ...value, libraryUrl: `${origin}${value.libraryUrl}` };
  });
}

function materialToolPart(
  material: MobileChatHistoryMaterial,
  apiOrigin: string | undefined,
) {
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
        activityPlan: readActivityPlan(material.activityPlan),
        ...(material.pagePreviewUrls
          ? { pagePreviewUrls: material.pagePreviewUrls }
          : {}),
        sources: normalizedSources(material.sources, apiOrigin),
        status: material.status,
        revisesId: material.revisesId,
        reviewPassed: material.reviewPass,
      },
    },
  };
}

/** Mobile projection of the same payload the web archive projects. */
export function projectServerChatHistory(
  payload: MobileChatHistoryPayload,
  liveMessages: readonly EveMessage[],
  options: { apiOrigin?: string } = {},
): ArchivedMessage[] {
  const liveMessageIds = new Set(liveMessages.map((message) => message.id));
  const messages = payload.messages.filter(
    (message) =>
      message.turnId === null ||
      !liveMessageIds.has(`${message.turnId}:${message.role}`),
  );
  const liveMaterialIds = new Set<string>();
  for (const message of liveMessages) {
    for (const part of message.parts) {
      if (part.type !== "dynamic-tool" || part.state !== "output-available") continue;
      const materialId = (
        part.output as { material?: { id?: unknown } } | undefined
      )?.material?.id;
      if (typeof materialId === "string") liveMaterialIds.add(materialId);
    }
  }

  const cardsByMessageId = new Map<string, MobileChatHistoryMaterial[]>();
  const standalone: MobileChatHistoryMaterial[] = [];
  for (const material of payload.materials) {
    if (liveMaterialIds.has(material.id)) continue;
    const host = messages.find(
      (message) =>
        message.role === "assistant" &&
        message.sessionId === material.sessionId &&
        message.atMs >= material.atMs,
    );
    if (!host) {
      standalone.push(material);
      continue;
    }
    const cards = cardsByMessageId.get(host.id) ?? [];
    cards.push(material);
    cardsByMessageId.set(host.id, cards);
  }

  const archive: ArchivedMessage[] = messages.map((message) => ({
    at: message.atMs,
    message: {
      id: `hist:${message.id}`,
      role: message.role,
      parts: [
        ...(cardsByMessageId.get(message.id) ?? []).map((material) =>
          materialToolPart(material, options.apiOrigin)
        ),
        { type: "text", text: message.content },
      ],
    } as EveMessage,
  }));
  for (const material of standalone) {
    archive.push({
      at: material.atMs,
      message: {
        id: `mat:${material.id}`,
        role: "assistant",
        parts: [materialToolPart(material, options.apiOrigin)],
      } as EveMessage,
    });
  }
  archive.sort((left, right) => (left.at ?? 0) - (right.at ?? 0));
  return archive.length > MAX_ARCHIVED_MESSAGES
    ? archive.slice(archive.length - MAX_ARCHIVED_MESSAGES)
    : archive;
}

/**
 * Server-first mobile bootstrap. A live, resumable local session remains an
 * overlay; a sessionless event log is discarded once its durable rows exist.
 */
export function hydratePreparedChatWithServerHistory(
  prepared: PreparedChat,
  payload: MobileChatHistoryPayload,
): PreparedChat {
  const staleSessionlessEvents =
    !prepared.initialSession?.sessionId && prepared.initialEvents.length > 0;
  const liveMessages = foldEventsToMessages(prepared.initialEvents);
  if (staleSessionlessEvents) {
    const durableMessageIds = new Set(
      payload.messages.flatMap((message) =>
        message.turnId ? [`${message.turnId}:${message.role}`] : [],
      ),
    );
    const unmatched = liveMessages.filter(
      (message) => !durableMessageIds.has(message.id),
    );
    const archived = [
      ...projectServerChatHistory(payload, []),
      ...archiveMessages(unmatched, prepared.messageTimes),
    ].sort((left, right) => (left.at ?? 0) - (right.at ?? 0));
    return {
      ...prepared,
      archived: archived.length > MAX_ARCHIVED_MESSAGES
        ? archived.slice(archived.length - MAX_ARCHIVED_MESSAGES)
        : archived,
      initialEvents: [],
      initialSession: undefined,
      messageTimes: {},
    };
  }
  return {
    ...prepared,
    archived: projectServerChatHistory(payload, liveMessages),
    initialEvents: prepared.initialEvents,
    initialSession: prepared.initialSession,
    messageTimes: prepared.messageTimes,
  };
}

/**
 * Replaces a sessionless local event log with authenticated server replay.
 * Messages absent from that replay remain visible in the archive.
 */
export function adoptServerBoundSession(
  prepared: PreparedChat,
  events: readonly HandleMessageStreamEvent[],
  session: SessionState | undefined,
): PreparedChat {
  const restoredMessageIds = new Set(
    foldEventsToMessages(events).map((message) => message.id),
  );
  const unmatched = foldEventsToMessages(prepared.initialEvents).filter(
    (message) => !restoredMessageIds.has(message.id),
  );
  const archived = [
    ...prepared.archived,
    ...archiveMessages(unmatched, prepared.messageTimes),
  ].sort((left, right) => (left.at ?? 0) - (right.at ?? 0));
  return {
    ...prepared,
    archived: archived.length > MAX_ARCHIVED_MESSAGES
      ? archived.slice(archived.length - MAX_ARCHIVED_MESSAGES)
      : archived,
    initialEvents: events,
    initialSession: session,
    messageTimes: {},
  };
}
