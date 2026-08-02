import { File, UploadType } from "expo-file-system";

import { env, EVE_CHANNEL_HEADER } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import type { PreparedLessonRecording } from "./lesson-recording-model";

interface LessonReview {
  summary: string;
  evidenceCount: number;
  observationCount: number;
}

interface NativeBlobUpload {
  url: string;
  storeId: string;
}

export type LessonSaveResult =
  | { status: "ready"; lessonId: string; review: LessonReview }
  | { status: "processing"; lessonId: string }
  | { status: "review_failed"; lessonId: string }
  | { status: "failed"; reason: string };

type LessonReviewOutcome =
  | { status: "ready"; review: LessonReview }
  | { status: "processing" }
  | { status: "review_failed" };

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

function nativeBlobUpload(body: Record<string, unknown>): NativeBlobUpload {
  const value = body.nativeUpload as Record<string, unknown> | undefined;
  if (
    !value ||
    typeof value.url !== "string" ||
    typeof value.storeId !== "string"
  ) {
    throw new Error("Homa could not authorize the private recording upload.");
  }
  return { url: value.url, storeId: value.storeId };
}

async function uploadLessonFile(input: {
  file: File;
  pathname: string;
  contentType: string;
  token: string;
  onProgress?: (percentage: number) => void;
}): Promise<string> {
  const authorization = await authenticatedFetch(
    "/api/lessons/upload",
    input.token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "blob.generate-presigned-url",
        payload: {
          pathname: input.pathname,
          clientPayload: input.contentType,
          multipart: false,
        },
      }),
    },
  );
  const authorizationBody = await jsonResponse(authorization);
  if (!authorization.ok) {
    throw new Error("Homa could not authorize the private recording upload.");
  }
  const upload = nativeBlobUpload(authorizationBody);
  const requestId = `${upload.storeId}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  const task = input.file.createUploadTask(upload.url, {
    httpMethod: "PUT",
    uploadType: UploadType.BINARY_CONTENT,
    mimeType: input.contentType,
    sessionType: "background",
    headers: {
      "x-api-blob-request-id": requestId,
      "x-vercel-blob-store-id": upload.storeId,
      "x-api-blob-request-attempt": "0",
      "x-api-version": "12",
      "x-vercel-blob-access": "private",
      "x-content-type": input.contentType,
      "x-content-length": String(input.file.size),
    },
    onProgress: ({ bytesSent, totalBytes }) => {
      const total = totalBytes > 0 ? totalBytes : input.file.size;
      if (total > 0) {
        input.onProgress?.(Math.min(100, Math.round((bytesSent / total) * 100)));
      }
    },
  });
  let result;
  try {
    result = await task.uploadAsync();
  } finally {
    task.release();
  }
  if (result.status < 200 || result.status >= 300) {
    throw new Error("Homa could not securely upload the recording.");
  }
  let uploaded: Record<string, unknown>;
  try {
    uploaded = JSON.parse(result.body) as Record<string, unknown>;
  } catch {
    throw new Error("Homa could not confirm the private recording upload.");
  }
  if (typeof uploaded.url !== "string") {
    throw new Error("Homa could not confirm the private recording upload.");
  }
  input.onProgress?.(100);
  return uploaded.url;
}

export async function grantNativeLessonConsent(): Promise<void> {
  const token = await sessionToken();
  const response = await authenticatedFetch("/api/lessons/consent", token, { method: "POST" });
  if (!response.ok) throw new Error("Homa could not save your privacy choice. Nothing was recorded.");
}

async function loadReadyReview(
  lessonId: string,
  token: string,
): Promise<LessonReviewOutcome> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    let response: Response;
    try {
      response = await authenticatedFetch(`/api/lessons/${lessonId}/status`, token);
    } catch {
      return { status: "processing" };
    }
    const body = await jsonResponse(response);
    if (!response.ok) return { status: "processing" };
    if (body.status === "failed") return { status: "review_failed" };
    const review = body.review as Record<string, unknown> | null;
    if (body.status === "ready" && review && typeof review.summary === "string") {
      return {
        status: "ready",
        review: {
          summary: review.summary,
          evidenceCount: Number(review.evidenceCount) || 0,
          observationCount: Number(review.observationCount) || 0,
        },
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return { status: "processing" };
}

export async function saveNativeLessonRecording(input: {
  intent: PreparedLessonRecording;
  uri: string;
  durationSeconds: number;
  onProgress?: (percentage: number) => void;
}): Promise<LessonSaveResult> {
  let token: string | null = null;
  let lessonId: string | null = null;
  let blobUrl: string | null = null;
  try {
    token = await sessionToken();
    const createResponse = await authenticatedFetch("/api/lessons", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId: input.intent.childId, source: "recorder" }),
    });
    const created = await jsonResponse(createResponse);
    if (
      !createResponse.ok ||
      typeof created.lessonId !== "string" ||
      typeof created.uploadPrefix !== "string"
    ) {
      return {
        status: "failed",
        reason: "Homa could not open a private lesson record. Nothing was uploaded.",
      };
    }
    lessonId = created.lessonId;
    const file = new File(input.uri);
    if (!file.exists || file.size === 0) throw new Error("The recording file is empty.");
    const contentType = file.type || "audio/mp4";
    blobUrl = await uploadLessonFile({
      file,
      pathname: `${created.uploadPrefix}segment-1.m4a`,
      contentType,
      token,
      onProgress: input.onProgress,
    });
    const segmentResponse = await authenticatedFetch(`/api/lessons/${lessonId}/segments`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seq: 1,
        blobUrl,
        contentType,
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
    const reviewOutcome = await loadReadyReview(lessonId, token);
    if (reviewOutcome.status === "ready") {
      return { status: "ready", lessonId, review: reviewOutcome.review };
    }
    return { status: reviewOutcome.status, lessonId };
  } catch (error) {
    if (token && lessonId) {
      await authenticatedFetch(`/api/lessons/${lessonId}`, token, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl }),
      }).catch(() => undefined);
    }
    return {
      status: "failed",
      reason:
        error instanceof Error && error.message.startsWith("Your session expired.")
          ? error.message
          : "Homa could not save this recording. It is still on this phone. Check your connection and try again.",
    };
  }
}
