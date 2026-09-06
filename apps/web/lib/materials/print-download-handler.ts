import { parsePrintPdfQuery } from "@homa/core";
import type { resolveApiFamily } from "../api-auth";
import type { getMaterialCaller } from "./library";
import type { resolveActiveMaterialCaller } from "../voice/active-material";
import { fetchBoundedAssetBytes } from "../library/family-asset-bytes";
import { isFamilyArtifactUrl } from "./artifact-store";
import { downloadPreparedPrint } from "./print-download";
import { MAX_PRINT_PDF_BYTES, PRINT_PDF_BUDGET_MS } from "./print-pdf";

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function refuse(note: string, status: number): Response {
  return Response.json({ ready: false, note }, { status, headers: privateHeaders });
}
export function createPrintDownloadGet(deps: {
  resolveFamily: typeof resolveApiFamily;
  material: typeof getMaterialCaller;
  active: typeof resolveActiveMaterialCaller;
  fetch: typeof fetch;
}) {
  return async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(PRINT_PDF_BUDGET_MS)]);
    let stop: (() => void) | undefined;
    const timedOut = new Promise<Response>((resolve) => {
      stop = () => resolve(refuse("Print preparation took too long. Please try again.", 504));
      signal.addEventListener("abort", stop, { once: true });
      if (signal.aborted) stop();
    });
    const prepare = async (): Promise<Response> => {
      try {
        const auth = await deps.resolveFamily(request);
        signal.throwIfAborted();
        if (!auth) return refuse("Sign in again to prepare this PDF.", 401);
        const { id } = await params;
        const selection = parsePrintPdfQuery(id, new URL(request.url).searchParams);
        if (!selection) return refuse("These print details are invalid. Prepare the material again.", 400);
        const result = await downloadPreparedPrint({ request: selection, signal,
          access: {
            active: () => deps.active(auth.supabase, auth.familyId, id),
            material: () => deps.material(auth.supabase, auth.familyId, id),
            bytes: async (url, downloadSignal) => {
              if (!isFamilyArtifactUrl(url, auth.familyId)) return null;
              const parsed = new URL(url);
              if (parsed.username || parsed.password || parsed.port) return null;
              const result = await fetchBoundedAssetBytes(url, MAX_PRINT_PDF_BYTES, downloadSignal,
                (target, options) => deps.fetch(target, { ...options, redirect: "error", cache: "no-store" }));
              return result.ok ? result.bytes : null;
            },
          },
        });
        if (!result.ready) return refuse(result.note, 409);
        let offset = 0;
        return new Response(new ReadableStream<Uint8Array>({
          pull(controller) {
            if (signal.aborted) { controller.error(new Error("Print download timed out")); return; }
            if (offset >= result.bytes.length) { controller.close(); return; }
            controller.enqueue(result.bytes.subarray(offset, offset + 64 * 1024));
            offset += 64 * 1024;
          },
        }), { headers: { ...privateHeaders, "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="homa-selected-pages.pdf"' } });
      } catch {
        return refuse("I could not verify this PDF for printing. Try preparing it again. Nothing was sent to a printer.", 422);
      }
    };
    try { return await Promise.race([prepare(), timedOut]); }
    finally { if (stop) signal.removeEventListener("abort", stop); }
  };
}
