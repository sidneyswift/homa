import { emitMapEvent } from "../../../../../lib/map/events";
import {
  getMaterialCaller,
  getMaterialPinned,
} from "../../../../../lib/materials/library";
import { requireFamilyWithActor } from "../../../../../lib/map/session";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

/**
 * GET /api/materials/[id]/pdf: the only link the material card gives out
 * for a material's PDF (field review, 2026-07-25). A parent's own click
 * is the one signal that a worksheet actually reached her, and nothing
 * recorded it before this: not finalize (a phrase she may never say),
 * not print (the browser owns that). This route logs
 * materials.pdf_opened, re-scoped to the signed-in family exactly like
 * every other caller-path material read, then sends her straight to the
 * real Blob URL. The PDF itself stays a public Blob URL either way; this
 * adds a signal, not a gate.
 *
 * requireFamilyWithActor resolves through two doors (resume-cookie or
 * real Supabase auth) but only the auth door leaves an RLS-visible
 * session; a resume-cookie sitting (anonymous onboarding, the exact
 * population materials-studio serves) reads through getMaterialPinned
 * instead, same split as every agent-tool material read.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const requestUrl = new URL(request.url);

  let access;
  try {
    access = await requireFamilyWithActor();
  } catch (error) {
    console.error(
      "materials/pdf auth lookup failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return new Response("Could not verify your session.", { status: 502 });
  }
  if (!access) {
    const signin = new URL("/signin", requestUrl);
    signin.searchParams.set("next", requestUrl.pathname + requestUrl.search);
    return Response.redirect(signin, 302);
  }
  const { family, memberUserId } = access;

  const material =
    memberUserId === null
      ? await getMaterialPinned(family.id, id)
      : await getMaterialCaller(
          await createSupabaseServerClient(),
          family.id,
          id,
        );
  if (!material) {
    return new Response("Material not found.", { status: 404 });
  }

  await emitMapEvent("materials.pdf_opened", {
    family_id: family.id,
    material_id: material.id,
    status: material.status,
  });

  return Response.redirect(material.pdfUrl, 302);
}
