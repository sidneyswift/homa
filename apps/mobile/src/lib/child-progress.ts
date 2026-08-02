import {
  parseChildProgressView,
  type ChildProgressView,
  type OpenProgressConflictView,
  type ProgressConflictAdultAnswerView,
  type ProgressDomainView,
  type ProgressEvidenceAnswer,
  type ProgressEvidenceDerivation,
  type ProgressEvidenceSourceView,
  type ProgressSourceKind,
  type ProgressSubjectSummary,
  type ProgressSubjectView,
  type ProgressTopicView,
} from "@homa/core";

import { env, EVE_CHANNEL_HEADER } from "./env";
import {
  ChildProgressReadError,
  classifyChildProgressReadFailure,
  progressReadMessage,
} from "./child-progress-error";
import { supabase } from "./supabase";

export {
  ChildProgressReadError,
  classifyChildProgressReadFailure,
  shouldRetainStaleChildProgress,
  type ChildProgressReadFailureKind,
} from "./child-progress-error";

export type {
  ChildProgressView,
  OpenProgressConflictView,
  ProgressConflictAdultAnswerView,
  ProgressDomainView,
  ProgressEvidenceAnswer,
  ProgressEvidenceDerivation,
  ProgressEvidenceSourceView,
  ProgressSourceKind,
  ProgressSubjectSummary,
  ProgressSubjectView,
  ProgressTopicView,
};

function apiPath(path: string): string {
  return `${env.apiUrl.replace(/\/+$/, "")}${path}`;
}

async function progressFailureReason(response: Response): Promise<string | null> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) return null;
    const reason = (payload as Record<string, unknown>).reason;
    return typeof reason === "string" ? reason : null;
  } catch {
    return null;
  }
}

/**
 * Loads one server-validated Progress projection. The server re-derives the
 * family from the bearer token and re-scopes childId before returning data.
 */
export async function getChildProgressView(
  childId: string,
): Promise<ChildProgressView> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new ChildProgressReadError(
      "authentication",
      progressReadMessage("authentication"),
      null,
      "no-session",
    );
  }

  const response = await fetch(
    apiPath(`/api/progress/${encodeURIComponent(childId)}`),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        ...EVE_CHANNEL_HEADER,
      },
    },
  );
  if (!response.ok) {
    const reason = await progressFailureReason(response);
    const kind = classifyChildProgressReadFailure(response.status, reason);
    throw new ChildProgressReadError(
      kind,
      progressReadMessage(kind),
      response.status,
      reason,
    );
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ChildProgressReadError(
      "invalid",
      progressReadMessage("invalid"),
      response.status,
      "invalid-projection",
    );
  }
  if (typeof payload !== "object" || payload === null) {
    throw new ChildProgressReadError(
      "invalid",
      progressReadMessage("invalid"),
      response.status,
      "invalid-projection",
    );
  }
  const candidate = payload as Record<string, unknown>;
  if (candidate.ok !== true) {
    throw new ChildProgressReadError(
      "invalid",
      progressReadMessage("invalid"),
      response.status,
      "invalid-projection",
    );
  }
  let view: ChildProgressView;
  try {
    view = parseChildProgressView(candidate.view);
  } catch {
    throw new ChildProgressReadError(
      "invalid",
      progressReadMessage("invalid"),
      response.status,
      "invalid-projection",
    );
  }
  if (view.childId !== childId) {
    throw new ChildProgressReadError(
      "invalid",
      progressReadMessage("invalid"),
      response.status,
    );
  }
  return view;
}
