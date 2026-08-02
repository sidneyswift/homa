import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const RECOVERY_EMAIL_SUBJECT = "Reset your Homa password";
export const RECOVERY_REDIRECT_URL = "https://thankshoma.com/reset-password/confirm";

export function recoveryTemplateUpdate(content: string) {
  return {
    mailer_subjects_recovery: RECOVERY_EMAIL_SUBJECT,
    mailer_templates_recovery_content: content,
  } as const;
}

export function supabaseProjectRef(urlValue: string | undefined): string | null {
  if (!urlValue) return null;
  try {
    const url = new URL(urlValue);
    const match = /^([a-z]{20})\.supabase\.co$/u.exec(url.hostname);
    return url.protocol === "https:" ? (match?.[1] ?? null) : null;
  } catch {
    return null;
  }
}

type AuthConfig = {
  mailer_subjects_recovery?: string | null;
  mailer_templates_recovery_content?: string | null;
  uri_allow_list?: string | null;
};

export async function parseAuthConfigResponse(response: Response): Promise<AuthConfig> {
  if (!response.ok) {
    throw new Error(`Supabase Auth config request failed with HTTP ${response.status}.`);
  }
  const body = await response.text();
  return body ? (JSON.parse(body) as AuthConfig) : {};
}

export function withRecoveryRedirect(
  currentAllowList: string | null | undefined,
): string {
  const entries = (currentAllowList ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!entries.includes(RECOVERY_REDIRECT_URL)) entries.push(RECOVERY_REDIRECT_URL);
  return entries.join(",");
}

async function authConfigRequest(
  projectRef: string,
  accessToken: string,
  init?: RequestInit,
): Promise<AuthConfig> {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      signal: AbortSignal.timeout(15_000),
    },
  );
  return parseAuthConfigResponse(response);
}

function isCurrent(
  remote: AuthConfig,
  desired: ReturnType<typeof recoveryTemplateUpdate> & { uri_allow_list: string },
) {
  return (
    remote.mailer_subjects_recovery === desired.mailer_subjects_recovery &&
    remote.mailer_templates_recovery_content === desired.mailer_templates_recovery_content &&
    remote.uri_allow_list === desired.uri_allow_list
  );
}

export async function main() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const projectRef =
    process.env.SUPABASE_PROJECT_REF?.trim() ||
    supabaseProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const apply = process.argv.includes("--apply");

  if (!accessToken) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required to inspect hosted Auth configuration.");
  }
  if (!projectRef || !/^[a-z]{20}$/u.test(projectRef)) {
    throw new Error(
      "Set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL to the target Supabase project.",
    );
  }

  const templatePath = fileURLToPath(
    new URL("../supabase/templates/recovery.html", import.meta.url),
  );
  const current = await authConfigRequest(projectRef, accessToken);
  const desired = {
    ...recoveryTemplateUpdate(await readFile(templatePath, "utf8")),
    uri_allow_list: withRecoveryRedirect(current.uri_allow_list),
  };
  if (isCurrent(current, desired)) {
    console.log(`Recovery email template is current for ${projectRef}.`);
    return;
  }

  if (!apply) {
    throw new Error(
      `Recovery email template differs for ${projectRef}. Review it, then rerun with --apply.`,
    );
  }

  await authConfigRequest(projectRef, accessToken, {
    method: "PATCH",
    body: JSON.stringify(desired),
  });
  const verified = await authConfigRequest(projectRef, accessToken);
  if (!isCurrent(verified, desired)) {
    throw new Error("Supabase accepted the update, but the recovery template read-back differs.");
  }
  console.log(`Recovery email template updated and verified for ${projectRef}.`);
}

const entrypoint = process.argv[1];
if (entrypoint && fileURLToPath(import.meta.url) === entrypoint) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
