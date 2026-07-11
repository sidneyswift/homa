interface ProdWriteGuardInput {
  scriptName: string;
  supabaseUrl: string | undefined;
  argv?: string[];
}

function isLocalSupabaseHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  );
}

/**
 * Hosted Supabase writes require an explicit acknowledgement. Local stacks
 * remain frictionless; CI and production scripts fail closed before opening
 * a database connection (2026-07-11 review, CR-59).
 */
export function assertConfirmedProdWrite(input: ProdWriteGuardInput): void {
  if (!input.supabaseUrl) return;

  let hostname: string;
  try {
    hostname = new URL(input.supabaseUrl).hostname;
  } catch {
    console.error(`${input.scriptName}: NEXT_PUBLIC_SUPABASE_URL is not a valid URL.`);
    process.exit(2);
  }

  if (isLocalSupabaseHost(hostname)) return;
  if ((input.argv ?? process.argv.slice(2)).includes("--confirm-prod")) return;

  console.error(
    `${input.scriptName}: refusing to write to hosted Supabase project ${hostname} ` +
      "without --confirm-prod.",
  );
  process.exit(2);
}
