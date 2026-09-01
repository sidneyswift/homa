import type { MapAnswer } from "@homa/core";

import { env, EVE_CHANNEL_HEADER } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import { createIdempotencyKey } from "./idempotency-key";
import type { DetailCardData, MapStateChild } from "./onboarding-card-model";

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

async function expectOk(
  response: Response,
  failureMessage = "That did not save. Nothing is lost, so try again.",
): Promise<Record<string, unknown>> {
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || data.ok !== true) {
    throw new Error(
      response.status === 401
        ? "Your session expired. Sign in again to continue."
        : failureMessage,
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
  // Deck S8 save-error string (approved 2026-08-31, editor-gate
  // contraction fix): thrown here because this message is exactly what
  // the checklist renders. The default expectOk message keeps serving
  // the loads and detail saves, which are not answers.
  await expectOk(
    await authenticatedRequest("/api/map/answer", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        source: "checklist",
        idempotencyKey: createIdempotencyKey(),
      }),
    }),
    "That answer didn't save. Try it again.",
  );
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

export function reportUrl(token: string): string {
  return apiPath(`/onboarding/r/${encodeURIComponent(token)}`);
}
