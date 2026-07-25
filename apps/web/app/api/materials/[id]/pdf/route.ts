import { emitMapEvent } from "../../../../../lib/map/events";
import { getMaterialCaller } from "../../../../../lib/materials/library";
import { requireFamily } from "../../../../../lib/map/session";
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
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const requestUrl = new URL(request.url);

  const family = await requireFamily();
  if (!family) {
    const signin = new URL("/signin", requestUrl);
    signin.searchParams.set("next", requestUrl.pathname + requestUrl.search);
    return Response.redirect(signin, 302);
  }

  const supabase = await createSupabaseServerClient();
  const material = await getMaterialCaller(supabase, family.id, id);
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
