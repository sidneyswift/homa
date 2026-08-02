import {
  parseProgressNextMoveResponse,
  type ProgressNextMoveResponse,
} from "@homa/core";

import {
  ChildProgressReadError,
  classifyChildProgressReadFailure,
  type ChildProgressReadFailureKind,
} from "./child-progress-error";
import { env, EVE_CHANNEL_HEADER } from "./env";
import { supabase } from "./supabase";
const NEXT_MOVE_REQUEST_TIMEOUT_MS = 35_000;

function apiPath(path: string): string {
  return `${env.apiUrl.replace(/\/+$/, "")}${path}`;
}

async function failureReason(response: Response): Promise<string | null> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) return null;
    const reason = (payload as Record<string, unknown>).reason;
    return typeof reason === "string" ? reason : null;
  } catch {
    return null;
  }
}

function nextMoveMessage(kind: ChildProgressReadFailureKind): string {
  switch (kind) {
    case "authentication":
      return "Sign in again to get a next move.";
    case "scope":
      return "A next move is not available for this child.";
    case "invalid":
      return "That next move could not be verified.";
    case "transient":
      return "Homa couldn’t choose a next move right now.";
  }
}

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new ChildProgressReadError(
      "authentication",
      nextMoveMessage("authentication"),
      null,
      "no-session",
    );
  }
  return token;
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    NEXT_MOVE_REQUEST_TIMEOUT_MS,
  );
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getProgressNextMove(
  childId: string,
  options: { retryFailed?: boolean } = {},
): Promise<ProgressNextMoveResponse> {
  const retryQuery = options.retryFailed ? "?retry=1" : "";
  const response = await timedFetch(
    apiPath(
      `/api/progress/${encodeURIComponent(childId)}/next-move${retryQuery}`,
    ),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        ...EVE_CHANNEL_HEADER,
      },
    },
  );
  if (!response.ok) {
    const reason = await failureReason(response);
    const kind = classifyChildProgressReadFailure(response.status, reason);
    throw new ChildProgressReadError(
      kind,
      nextMoveMessage(kind),
      response.status,
      reason,
    );
  }
  let payload: unknown;
  try {
    payload = await response.json();
    const parsed = parseProgressNextMoveResponse(payload);
    if (parsed.view.childId !== childId) throw new Error("wrong child");
    if (
      parsed.status === "settled" &&
      parsed.nextMove.sourceRevision !== parsed.sourceRevision
    ) {
      throw new Error("wrong source revision");
    }
    return parsed;
  } catch {
    throw new ChildProgressReadError(
      "invalid",
      nextMoveMessage("invalid"),
      response.status,
      "invalid-result",
    );
  }
}

export async function dismissProgressNextMove(
  childId: string,
  contextFingerprint: string,
): Promise<void> {
  const response = await timedFetch(
    apiPath(`/api/progress/${encodeURIComponent(childId)}/next-move`),
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "content-type": "application/json",
        ...EVE_CHANNEL_HEADER,
      },
      body: JSON.stringify({ contextFingerprint }),
    },
  );
  if (response.ok) return;
  const reason = await failureReason(response);
  const kind = classifyChildProgressReadFailure(response.status, reason);
  throw new ChildProgressReadError(
    kind,
    "Homa couldn’t hide that idea yet.",
    response.status,
    reason,
  );
}
