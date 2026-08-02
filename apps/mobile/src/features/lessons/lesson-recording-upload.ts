import { uploadPresigned } from "@vercel/blob/client";
import { File } from "expo-file-system";

import { env, EVE_CHANNEL_HEADER } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import type { PreparedLessonRecording } from "./lesson-recording-model";

interface LessonReview {
  summary: string;
  evidenceCount: number;
  observationCount: number;
}

export type LessonSaveResult =
  | { status: "ready"; lessonId: string; review: LessonReview }
  | { status: "processing"; lessonId: string }
  | { status: "failed"; reason: string };

function apiUrl(path: string): string {
  return `${env.apiUrl.replace(/\/+$/, "")}${path}`;
}

async function sessionToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session expired. Sign in again before recording.");
  return token;
}

async function authenticatedFetch(path: string, token: string, init: RequestInit = {}) {
  return fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...EVE_CHANNEL_HEADER,
      ...(init.headers ?? {}),
    },
  });
}

async function jsonResponse(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

export async function grantNativeLessonConsent(): Promise<void> {
  const token = await sessionToken();
  const response = await authenticatedFetch("/api/lessons/consent", token, { method: "POST" });
  if (!response.ok) throw new Error("Homa could not save your privacy choice. Nothing was recorded.");
}

async function loadReadyReview(lessonId: string, token: string): Promise<LessonReview | null> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await authenticatedFetch(`/api/lessons/${lessonId}/status`, token);
    const body = await jsonResponse(response);
    if (!response.ok || body.status === "failed") return null;
    const review = body.review as Record<string, unknown> | null;
    if (body.status === "ready" && review && typeof review.summary === "string") {
      return {
        summary: review.summary,
        evidenceCount: Number(review.evidenceCount) || 0,
        observationCount: Number(review.observationCount) || 0,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return null;
}

export async function saveNativeLessonRecording(input: {
  intent: PreparedLessonRecording;
  uri: string;
  durationSeconds: number;
  onProgress?: (percentage: number) => void;
}): Promise<LessonSaveResult> {
  const token = await sessionToken();
  const createResponse = await authenticatedFetch("/api/lessons", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ childId: input.intent.childId, source: "recorder" }),
  });
  const created = await jsonResponse(createResponse);
  if (!createResponse.ok || typeof created.lessonId !== "string" || typeof created.uploadPrefix !== "string") {
    return { status: "failed", reason: "Homa could not open a private lesson record. Nothing was uploaded." };
  }
  const lessonId = created.lessonId;
  let blobUrl: string | null = null;
  try {
    const file = new File(input.uri);
    if (!file.exists || file.size === 0) throw new Error("The recording file is empty.");
    const blob = await uploadPresigned(`${created.uploadPrefix}segment-1.m4a`, file, {
      access: "private",
      handleUploadUrl: apiUrl("/api/lessons/upload"),
      headers: { Authorization: `Bearer ${token}`, ...EVE_CHANNEL_HEADER },
      contentType: file.type || "audio/mp4",
      multipart: file.size > 8 * 1024 * 1024,
      onUploadProgress: ({ percentage }) => input.onProgress?.(Math.round(percentage)),
    });
    blobUrl = blob.url;
    const segmentResponse = await authenticatedFetch(`/api/lessons/${lessonId}/segments`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seq: 1,
        blobUrl,
        contentType: file.type || "audio/mp4",
        durationSeconds: input.durationSeconds,
      }),
    });
    if (!segmentResponse.ok) throw new Error("Homa could not securely register the recording.");

    const finishResponse = await authenticatedFetch(`/api/lessons/${lessonId}/finish`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSeconds: input.durationSeconds }),
    });
    if (!finishResponse.ok) throw new Error("Homa could not finish the lesson review.");
    const review = await loadReadyReview(lessonId, token);
    return review
      ? { status: "ready", lessonId, review }
      : { status: "processing", lessonId };
  } catch (error) {
    await authenticatedFetch(`/api/lessons/${lessonId}`, token, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blobUrl }),
    }).catch(() => undefined);
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "Homa could not save this recording.",
    };
  }
}
