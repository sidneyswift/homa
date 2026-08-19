import { EVE_CHANNEL_HEADER, env } from "../../lib/env";
import { supabase } from "../../lib/supabase";

/**
 * Client for the native first making (wave 3): starts the durable
 * single-stage materials-studio job for a child and polls its status
 * for the building screen's honest steps. The job survives the app
 * being closed; the finished page also lands in the Binder on its own.
 */

export interface MakingJob {
  id: string;
  status: string;
  title: string;
  currentStage: number;
  totalStages: number;
  progressNote: string | null;
}

async function bearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function startFirstMaking(
  childId: string,
): Promise<{ jobId: string; title: string } | null> {
  const token = await bearer();
  if (!token) return null;
  try {
    const response = await fetch(
      `${env.apiUrl.replace(/\/+$/u, "")}/api/mobile/onboarding/making`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...EVE_CHANNEL_HEADER,
        },
        body: JSON.stringify({ childId }),
      },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      ok: boolean;
      jobId?: string;
      title?: string;
    };
    if (!body.ok || !body.jobId) return null;
    return { jobId: body.jobId, title: body.title ?? "" };
  } catch {
    return null;
  }
}

export async function getMakingStatus(
  jobId: string,
): Promise<MakingJob | null> {
  const token = await bearer();
  if (!token) return null;
  try {
    const response = await fetch(
      `${env.apiUrl.replace(/\/+$/u, "")}/api/mobile/onboarding/making?jobId=${encodeURIComponent(jobId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...EVE_CHANNEL_HEADER,
        },
      },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { ok: boolean; job?: MakingJob };
    return body.ok && body.job ? body.job : null;
  } catch {
    return null;
  }
}
