import { resolveApiFamily } from "../../../lib/api-auth";
import { getFamilyBlobResponse } from "../../../lib/family-blob";
import { isFamilyBlobUrl } from "../../../lib/family-blob-url";

export async function GET(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const url = new URL(request.url).searchParams.get("url") ?? "";
  const space = isFamilyBlobUrl(url, auth.familyId, "chat")
    ? "chat"
    : isFamilyBlobUrl(url, auth.familyId, "library")
    ? "library"
    : isFamilyBlobUrl(url, auth.familyId, "workspace")
    ? "workspace"
    : null;
  if (!space) {
    return Response.json({ ok: false, reason: "not-found" }, { status: 404 });
  }
  const response = await getFamilyBlobResponse(
    url,
    auth.familyId,
    space,
    request.headers.get("if-none-match") ?? undefined
  );
  return (
    response ??
    Response.json({ ok: false, reason: "not-found" }, { status: 404 })
  );
}
