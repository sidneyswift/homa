interface ProdWriteGuardInput {
  scriptName: string;
  supabaseUrl: string | undefined;
  argv?: string[];
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function isLocalSupabaseHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  );
}

export function assertConfirmedProdWrite(input: ProdWriteGuardInput): void {
  if (!input.supabaseUrl) return;

  let hostname: string;
  try {
    hostname = new URL(input.supabaseUrl).hostname;
  } catch {
    return;
  }

  if (isLocalSupabaseHost(hostname)) return;
  if (hasFlag(input.argv ?? process.argv.slice(2), "--confirm-prod")) return;

  console.error(
    `${input.scriptName}: refusing to write to hosted Supabase project ${hostname} ` +
      "without --confirm-prod.",
  );
  process.exit(2);
}
