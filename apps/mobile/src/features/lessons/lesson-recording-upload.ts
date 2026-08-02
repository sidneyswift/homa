import { File, UploadType } from "expo-file-system";

import { env, EVE_CHANNEL_HEADER } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import {
  parseNativeLessonReviewOutcome,
  type NativeLessonReview,
  type NativeLessonReviewOutcome,
  type PreparedLessonRecording,
} from "./lesson-recording-model";

interface NativeBlobUpload {
  url: string;
  storeId: string;
}

export type LessonSaveResult =
  | { status: "ready"; lessonId: string; review: NativeLessonReview }
  | { status: "processing"; lessonId: string }
  | ({ lessonId: string } & Extract<
      NativeLessonReviewOutcome,
      { status: "review_failed" }
    >)
  | { status: "failed"; reason: string };

export type LessonRetryResult =
  | NativeLessonReviewOutcome
  | { status: "request_failed"; reason: string };

export type LessonReviewStatusResult =
  | NativeLessonReviewOutcome
  | {
      status: "status_unavailable";
      reason: "temporary" | "not_found";
    };

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

async function loadLessonReviewStatusWithToken(
  lessonId: string,
  token: string,
): Promise<LessonReviewStatusResult> {
  let response: Response;
  try {
    response = await authenticatedFetch(`/api/lessons/${lessonId}/status`, token);
  } catch {
    return { status: "status_unavailable", reason: "temporary" };
  }
  const body = await jsonResponse(response);
  if (!response.ok) {
    return {
      status: "status_unavailable",
      reason: response.status === 404 ? "not_found" : "temporary",
    };
  }
  return parseNativeLessonReviewOutcome(body)
    ?? { status: "status_unavailable", reason: "temporary" };
}

export async function loadNativeLessonReviewStatus(
  lessonId: string,
): Promise<LessonReviewStatusResult> {
  try {
    const token = await sessionToken();
    return await loadLessonReviewStatusWithToken(lessonId, token);
  } catch {
    return { status: "status_unavailable", reason: "temporary" };
  }
}

async function loadReadyReview(
  lessonId: string,
  token: string,
): Promise<NativeLessonReviewOutcome> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const outcome = await loadLessonReviewStatusWithToken(lessonId, token);
    if (outcome.status === "ready" || outcome.status === "review_failed") {
      return outcome;
    }
    if (outcome.status === "status_unavailable") return { status: "processing" };
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return { status: "processing" };
}

export async function retryNativeLessonReview(
  lessonId: string,
): Promise<LessonRetryResult> {
  try {
    const token = await sessionToken();
    const response = await authenticatedFetch(
      `/api/lessons/${lessonId}/retry`,
      token,
      { method: "POST" },
    );
    const body = await jsonResponse(response);
    if (!response.ok) {
      if (
        body.reason === "attempts-exhausted" ||
        body.reason === "source-unavailable"
      ) {
        return parseNativeLessonReviewOutcome({
          ...body,
          status: "review_failed",
        }) ?? {
          status: "review_failed",
          retryable: false,
          reason: "unknown",
        };
      }
      return {
        status: "request_failed",
        reason:
          body.reason === "no-session"
            ? "Your session expired. Sign in again before asking Homa to retry."
            : "Homa could not confirm another review started. The lesson is still saved. Check your connection and try again.",
      };
    }
    const immediate = parseNativeLessonReviewOutcome(body);
    if (immediate?.status === "review_failed") return immediate;
    return await loadReadyReview(lessonId, token);
  } catch {
    return {
      status: "request_failed",
      reason:
        "Homa could not confirm another review started. The lesson is still saved. Check your connection and try again.",
    };
  }
}

export async function saveNativeLessonRecording(input: {
  intent: PreparedLessonRecording;
  uri: string;
  durationSeconds: number;
  onProgress?: (percentage: number) => void;
  onLessonSaved?: (lessonId: string) => Promise<void>;
}): Promise<LessonSaveResult> {
  let token: string | null = null;
  let lessonId: string | null = null;
  let blobUrl: string | null = null;
  let lessonSaved = false;
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
    lessonSaved = true;
    await input.onLessonSaved?.(lessonId);
    const reviewOutcome = await loadReadyReview(lessonId, token);
    if (reviewOutcome.status === "ready") {
      return { status: "ready", lessonId, review: reviewOutcome.review };
    }
    return reviewOutcome.status === "review_failed"
      ? { ...reviewOutcome, lessonId }
      : { status: "processing", lessonId };
  } catch (error) {
    if (lessonSaved && lessonId) {
      return { status: "processing", lessonId };
    }
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
