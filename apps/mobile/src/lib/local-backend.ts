/**
 * True when the app points at a backend on a developer's own machine (the
 * local stack, tooling/local-stack/README.md): loopback for the simulator,
 * or a private LAN address for a phone on the same wifi. Hosted Supabase
 * and thankshoma.com are never local, so dev-only shortcuts keyed on this
 * stay invisible against production even in a dev build.
 */
export function isLocalBackendUrl(url: string | undefined): boolean {
  if (!url) return false;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (host === "[::1]" || host === "::1") return true;
  const octets = host.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  const [a, b] = octets;
  return (
    a === 127 ||
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
}
