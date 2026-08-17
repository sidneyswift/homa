import {
  copy,
  del,
  get,
  head,
  issueSignedToken,
  presignUrl,
  put,
  type HeadBlobResult,
  type PutBlobResult,
} from "@vercel/blob";

import {
  familyBlobPathname,
  isFamilyBlobUrl,
  isPrivateFamilyBlobUrl,
  type FamilyBlobSpace,
} from "./family-blob-url";

export const FAMILY_BLOB_ACCESS = "private" as const;
const SIGNED_READ_TTL_MS = 15 * 60 * 1000;

export function familyBlobToken(): string | null {
  return (
    process.env.HOMA_FAMILY_READ_WRITE_TOKEN?.trim() ||
    process.env.HOMA_LESSON_READ_WRITE_TOKEN?.trim() ||
    null
  );
}

export function familyBlobConfigured(): boolean {
  return familyBlobToken() !== null;
}

function requiredFamilyBlobToken(): string {
  const token = familyBlobToken();
  if (!token) throw new Error("private family file store is not configured");
  return token;
}

export async function headFamilyBlob(
  url: string,
  familyId: string,
  space: FamilyBlobSpace
): Promise<HeadBlobResult> {
  if (!isFamilyBlobUrl(url, familyId, space)) {
    throw new Error("family file URL is outside the authenticated family");
  }
  return await head(
    url,
    isPrivateFamilyBlobUrl(url)
      ? { token: requiredFamilyBlobToken() }
      : undefined
  );
}

export async function deleteFamilyBlob(
  url: string,
  familyId: string,
  space: FamilyBlobSpace
): Promise<void> {
  if (!isFamilyBlobUrl(url, familyId, space)) {
    throw new Error("family file URL is outside the authenticated family");
  }
  await del(
    url,
    isPrivateFamilyBlobUrl(url)
      ? { token: requiredFamilyBlobToken() }
      : undefined
  );
}

export async function copyFamilyBlobToPrivate(input: {
  sourceUrl: string;
  familyId: string;
  sourceSpace: FamilyBlobSpace;
  destinationPathname: string;
  destinationSpace: FamilyBlobSpace;
  contentType: string;
}): Promise<PutBlobResult> {
  if (!isFamilyBlobUrl(input.sourceUrl, input.familyId, input.sourceSpace)) {
    throw new Error("family file URL is outside the authenticated family");
  }
  if (
    !input.destinationPathname.startsWith(
      `families/${input.familyId}/${input.destinationSpace}/`
    )
  ) {
    throw new Error(
      "family file destination is outside the authenticated family"
    );
  }

  const targetToken = requiredFamilyBlobToken();
  if (isPrivateFamilyBlobUrl(input.sourceUrl)) {
    return await copy(input.sourceUrl, input.destinationPathname, {
      access: FAMILY_BLOB_ACCESS,
      token: targetToken,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: input.contentType,
    });
  }

  const sourceToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!sourceToken)
    throw new Error("public family file store is not configured");
  const source = await get(input.sourceUrl, {
    access: "public",
    token: sourceToken,
    useCache: false,
  });
  if (!source?.stream || source.statusCode !== 200) {
    throw new Error("public family file could not be read");
  }
  return await put(input.destinationPathname, source.stream, {
    access: FAMILY_BLOB_ACCESS,
    token: targetToken,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: input.contentType,
  });
}

export async function signedFamilyBlobReadUrl(
  url: string,
  familyId: string,
  space: FamilyBlobSpace,
  validUntil = Date.now() + SIGNED_READ_TTL_MS
): Promise<string> {
  if (!isFamilyBlobUrl(url, familyId, space)) {
    throw new Error("family file URL is outside the authenticated family");
  }
  if (!isPrivateFamilyBlobUrl(url)) return url;
  const pathname = familyBlobPathname(url);
  if (!pathname) throw new Error("family file pathname is invalid");
  const signedToken = await issueSignedToken({
    token: requiredFamilyBlobToken(),
    pathname,
    operations: ["get"],
    validUntil,
  });
  const { presignedUrl } = await presignUrl(signedToken, {
    operation: "get",
    pathname,
    access: FAMILY_BLOB_ACCESS,
    validUntil,
    useCache: false,
  });
  return presignedUrl;
}

export async function getFamilyBlobResponse(
  url: string,
  familyId: string,
  space: FamilyBlobSpace,
  ifNoneMatch?: string
): Promise<Response | null> {
  if (!isFamilyBlobUrl(url, familyId, space)) return null;
  if (!isPrivateFamilyBlobUrl(url)) {
    const response = await fetch(url, {
      headers: ifNoneMatch ? { "If-None-Match": ifNoneMatch } : undefined,
    });
    return response.ok || response.status === 304 ? response : null;
  }
  const result = await get(url, {
    access: FAMILY_BLOB_ACCESS,
    token: requiredFamilyBlobToken(),
    ifNoneMatch,
    useCache: false,
  });
  if (!result || (result.statusCode !== 200 && result.statusCode !== 304)) {
    return null;
  }
  return new Response(result.statusCode === 304 ? null : result.stream, {
    status: result.statusCode,
    headers: {
      "Content-Type": result.blob.contentType ?? "application/octet-stream",
      "Content-Disposition": result.blob.contentDisposition,
      "Cache-Control": "private, no-cache",
      ETag: result.blob.etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
