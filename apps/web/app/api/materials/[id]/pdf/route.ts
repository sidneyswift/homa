import { STATE_PACK_SUBJECT } from "../../../../../lib/compliance/pack-store";
import { mapDb } from "../../../../../lib/map/db";
import { emitMapEvent } from "../../../../../lib/map/events";
import {
  getMaterialCaller,
  getMaterialPinned,
} from "../../../../../lib/materials/library";
import { requireFamilyWithActor } from "../../../../../lib/map/session";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import { resolveApiFamily } from "../../../../../lib/api-auth";

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
async function readStatePackState(
  familyId: string,
  materialId: string,
): Promise<string | null> {
  try {
    const sql = mapDb();
    const rows = await sql<{ state: string | null }[]>`
      select generation->'statePack'->>'state' as state
      from public.materials
      where id = ${materialId} and family_id = ${familyId}
    `;
    return rows[0]?.state ?? null;
  } catch (error) {
    console.error(
      "state pack state lookup failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const requestUrl = new URL(request.url);

  const bearer = request.headers.get("authorization");
  let familyId: string;
  let familyState: string | null = null;
  let material;
  if (bearer) {
    const auth = await resolveApiFamily(request);
    if (!auth) return new Response("Could not verify your session.", { status: 401 });
    familyId = auth.familyId;
    material = await getMaterialCaller(auth.supabase, auth.familyId, id);
    const { data: family } = await auth.supabase
      .from("families")
      .select("us_state")
      .eq("id", auth.familyId)
      .maybeSingle();
    familyState = typeof family?.us_state === "string" ? family.us_state : null;
  } else {
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
    familyId = access.family.id;
    familyState = access.family.us_state;
    material = access.memberUserId === null
      ? await getMaterialPinned(access.family.id, id)
      : await getMaterialCaller(
          await createSupabaseServerClient(),
          access.family.id,
          id,
        );
  }
  if (!material) {
    return new Response("Material not found.", { status: 404 });
  }

  await emitMapEvent("materials.pdf_opened", {
    family_id: familyId,
    material_id: material.id,
    status: material.status,
  });

  // The state pack's J4 terminal (journeys/06 row 50): the parent's own
  // click on the pack PDF, the only signal the pack reached her. The
  // event carries the pack's OWN state (stamped at generation), not the
  // family's current one, so a family that moved after generating still
  // attributes the download to the state the pack describes.
  if (material.subject === STATE_PACK_SUBJECT) {
    const packState = await readStatePackState(familyId, material.id);
    const state = packState ?? familyState;
    if (state) {
      await emitMapEvent("compliance.report_downloaded", {
        family_id: familyId,
        state,
      });
    }
  }

  const accept = request.headers.get("accept") ?? "";
  if (bearer && accept.includes("application/pdf")) {
    const upstream = await fetch(material.pdfUrl);
    if (!upstream.ok || !upstream.body) {
      return new Response("Printable file unavailable.", { status: 502 });
    }
    return new Response(upstream.body, {
      headers: {
        "content-type": "application/pdf",
        "cache-control": "private, no-store",
      },
    });
  }
  return Response.redirect(material.pdfUrl, 302);
}
