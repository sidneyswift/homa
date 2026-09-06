import { resolveApiFamily } from "../../../../../../lib/api-auth";
import { getMaterialCaller } from "../../../../../../lib/materials/library";
import { createPrintDownloadGet } from "../../../../../../lib/materials/print-download-handler";
import { resolveActiveMaterialCaller } from "../../../../../../lib/voice/active-material";

export const runtime = "nodejs";
export const maxDuration = 60;
/** Read-only selected bytes. Generic/history PDF access remains separate. */
export const GET = createPrintDownloadGet({
  resolveFamily: resolveApiFamily,
  material: getMaterialCaller,
  active: resolveActiveMaterialCaller,
  fetch,
});
