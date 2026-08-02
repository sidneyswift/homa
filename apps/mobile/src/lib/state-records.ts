import { env, EVE_CHANNEL_HEADER } from "./env";
import { supabase } from "./supabase";

export interface StateRecordDocument {
  id: string;
  type: "pack" | "filing";
  title: string;
  status: "final" | "superseded";
  previewUrl: string;
  pdfUrl: string;
  pdfPath: string;
  createdAt: string;
  pageCount: number;
  kind: "letter" | "worksheet" | null;
  gaps: string[];
  revisesId: string | null;
}

export interface StateRecordsSummary {
  state: { code: string; name: string };
  schoolYear: { startOn: string | null; label: string | null };
  includedRecords: string[];
  recordCoverage: {
    loggedEntries: number;
    daysWithLoggedTime: number;
    minutesLogged: number;
  };
  missingInformation: string[];
  sources: { label: string; url: string }[];
  lastVerified: string;
  filing: {
    kind: "letter" | "worksheet" | "not_required";
    entitled: boolean;
  };
  documents: StateRecordDocument[];
  parentAction: string;
}

export type StateRecordAction = "view" | "generate_pack" | "generate_filing";

export interface StateRecordsResult {
  summary: StateRecordsSummary | null;
  note: string | null;
  resolution: "settings" | "retry" | null;
}

async function bearerToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function apiUrl(path: string): string {
  return `${env.apiUrl.replace(/\/+$/, "")}${path}`;
}

async function request(path: string, init: RequestInit = {}): Promise<Response | null> {
  const token = await bearerToken();
  if (!token) return null;
  try {
    return await fetch(apiUrl(path), {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...EVE_CHANNEL_HEADER,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    return null;
  }
}

export async function fetchStateRecords(): Promise<StateRecordsResult> {
  const response = await request("/api/compliance/summary");
  if (!response) {
    return {
      summary: null,
      note: "Your state records could not load. Nothing changed.",
      resolution: "retry",
    };
  }
  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    summary?: StateRecordsSummary;
    note?: string;
    reason?: string;
  } | null;
  if (!response.ok || !body?.ok || !body.summary) {
    return {
      summary: null,
      note: body?.note ?? "Your state records could not load. Nothing changed.",
      resolution: body?.reason === "no-state-records" ? "settings" : "retry",
    };
  }
  return { summary: body.summary, note: null, resolution: null };
}

export async function generateStateRecord(
  action: Exclude<StateRecordAction, "view">,
): Promise<string | null> {
  const path = action === "generate_pack"
    ? "/api/compliance/pack"
    : "/api/compliance/filing";
  const response = await request(path, { method: "POST" });
  const documentName = action === "generate_pack" ? "pack" : "filing document";
  if (!response) return `Your ${documentName} could not be made. Nothing changed. Try again.`;
  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    note?: string;
  } | null;
  if (!response.ok || !body?.ok) {
    return body?.note ?? `Your ${documentName} could not be made. Nothing changed. Try again.`;
  }
  return null;
}
