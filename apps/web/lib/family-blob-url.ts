export type FamilyBlobSpace = "chat" | "library" | "workspace";

const PUBLIC_BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";
const PRIVATE_BLOB_HOST_SUFFIX = ".private.blob.vercel-storage.com";

export function isPrivateFamilyBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(PRIVATE_BLOB_HOST_SUFFIX)
    );
  } catch {
    return false;
  }
}

export function isFamilyBlobUrl(
  url: string,
  familyId: string,
  space: FamilyBlobSpace
): boolean {
  try {
    const parsed = new URL(url);
    const supportedHost =
      parsed.hostname.endsWith(PUBLIC_BLOB_HOST_SUFFIX) ||
      parsed.hostname.endsWith(PRIVATE_BLOB_HOST_SUFFIX);
    return (
      parsed.protocol === "https:" &&
      supportedHost &&
      parsed.pathname.startsWith(`/families/${familyId}/${space}/`)
    );
  } catch {
    return false;
  }
}

export function familyBlobPathname(url: string): string | null {
  try {
    const parsed = new URL(url);
    const supportedHost =
      parsed.hostname.endsWith(PUBLIC_BLOB_HOST_SUFFIX) ||
      parsed.hostname.endsWith(PRIVATE_BLOB_HOST_SUFFIX);
    if (parsed.protocol !== "https:" || !supportedHost) return null;
    return decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
  } catch {
    return null;
  }
}

/**
 * canonicalFamilyBlobUrl(url): the URL as tables store it, without the
 * query or fragment. A signed read link (find_attachments hands these to
 * the model) carries a short-lived token in its query; matching it
 * against a stored row, or re-signing it, needs the bare URL.
 */
export function canonicalFamilyBlobUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return null;
  }
}

export function familyBlobBrowserUrl(url: string): string {
  return isPrivateFamilyBlobUrl(url)
    ? `/api/family-files?url=${encodeURIComponent(url)}`
    : url;
}
