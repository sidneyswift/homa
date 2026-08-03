import type { MapAnswer } from "@homa/core";

import { env, EVE_CHANNEL_HEADER } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import { createIdempotencyKey } from "./idempotency-key";
import type {
  DetailCardData,
  MakingPhase,
  MakingStatusMaterial,
  MakingStatusResponse,
  MapStateChild,
} from "./onboarding-card-model";

function apiPath(path: string): string {
  return `${env.apiUrl.replace(/\/+$/, "")}${path}`;
}

async function authenticatedRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session expired. Sign in again to continue.");
  return fetch(apiPath(path), {
    ...init,
    headers: {
      ...EVE_CHANNEL_HEADER,
      Authorization: `Bearer ${token}`,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
}

async function expectOk(response: Response): Promise<Record<string, unknown>> {
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || data.ok !== true) {
    throw new Error(
      response.status === 401
        ? "Your session expired. Sign in again to continue."
        : "That did not save. Nothing is lost, so try again.",
    );
  }
  return data;
}

export async function fetchMapChild(childId: string): Promise<MapStateChild> {
  const data = await expectOk(await authenticatedRequest("/api/map/state"));
  const children = Array.isArray(data.children) ? data.children as MapStateChild[] : [];
  const child = children.find((entry) => entry.id === childId);
  if (!child) throw new Error("Those questions are not available for this child.");
  return child;
}

export async function saveChecklistAnswer(input: {
  childId: string;
  itemId: string;
  answer: MapAnswer;
}): Promise<void> {
  await expectOk(await authenticatedRequest("/api/map/answer", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      source: "checklist",
      idempotencyKey: createIdempotencyKey(),
    }),
  }));
}

export type DetailValues = Record<string, string>;

export async function saveDetailCard(
  card: DetailCardData,
  values: DetailValues,
): Promise<void> {
  if (card.kind === "family_basics") {
    await expectOk(await authenticatedRequest("/api/onboarding/basics", {
      method: "POST",
      body: JSON.stringify({
        callMeName: values.callMeName.trim(),
        usState: values.usState.trim().toUpperCase(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    }));
    return;
  }
  if (card.kind === "homeschool_profile") {
    await expectOk(await authenticatedRequest("/api/onboarding/homeschool-profile", {
      method: "POST",
      body: JSON.stringify({
        styles: values.homeschoolStyles
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      }),
    }));
    return;
  }
  await expectOk(await authenticatedRequest("/api/map/children", {
    method: "POST",
    body: JSON.stringify({
      name: values.childName.trim(),
      birthDate: values.birthDate,
      interests: values.childInterests
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    }),
  }));
}

export async function finalizeReport(childId: string): Promise<void> {
  await expectOk(await authenticatedRequest("/api/map/score", {
    method: "POST",
    body: JSON.stringify({ childId }),
  }));
}

export async function reportNarrativeSettled(token: string): Promise<boolean> {
  const response = await fetch(
    apiPath(`/api/map/narrative-status?token=${encodeURIComponent(token)}`),
  );
  const data = await response.json().catch(() => ({})) as {
    ok?: boolean;
    status?: string;
  };
  return data.ok === true && typeof data.status === "string" && data.status !== "writing";
}

export async function recordReportReveal(token: string): Promise<void> {
  await fetch(apiPath("/api/map/report-viewed"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, entry: "chat" }),
  });
}

function isMakingPhase(value: unknown): value is MakingPhase {
  return value === "making"
    || value === "ready"
    || value === "stalled"
    || value === "stopped";
}

function parseMakingMaterial(value: unknown): MakingStatusMaterial | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const material = value as Record<string, unknown>;
  if (
    typeof material.id !== "string"
    || typeof material.title !== "string"
    || typeof material.previewUrl !== "string"
    || typeof material.pdfUrl !== "string"
  ) {
    return null;
  }
  return {
    id: material.id,
    title: material.title,
    kind: typeof material.kind === "string" ? material.kind : null,
    skill: typeof material.skill === "string" ? material.skill : null,
    childName: typeof material.childName === "string" ? material.childName : null,
    previewUrl: material.previewUrl,
    pdfUrl: material.pdfUrl,
    pageCount:
      typeof material.pageCount === "number" && material.pageCount >= 1
        ? Math.floor(material.pageCount)
        : 1,
    pagePreviewUrls: Array.isArray(material.pagePreviewUrls)
      ? material.pagePreviewUrls.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
  };
}

export async function fetchMakingStatus(
  jobId: string,
): Promise<MakingStatusResponse | null> {
  try {
    const response = await authenticatedRequest(
      `/api/onboarding/making-status?jobId=${encodeURIComponent(jobId)}`,
    );
    if (!response.ok) return null;
    const data = await response.json().catch(() => ({})) as {
      ok?: unknown;
      phase?: unknown;
      material?: unknown;
    };
    if (data.ok !== true || !isMakingPhase(data.phase)) return null;
    return {
      phase: data.phase,
      material: data.material === null || data.material === undefined
        ? null
        : parseMakingMaterial(data.material),
    };
  } catch {
    return null;
  }
}

export function reportUrl(token: string): string {
  return apiPath(`/onboarding/r/${encodeURIComponent(token)}`);
}
