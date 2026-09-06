import { resolveApiFamily } from "../../../../../lib/api-auth";
import { emitMapEvent } from "../../../../../lib/map/events";
import { prepareMaterialPrintCaller } from "../../../../../lib/materials/print";
import { createMaterialPrintPost } from "../../../../../lib/materials/print-route";

/** Explicit web/native button twin of prepare_material_print. */
export const POST = createMaterialPrintPost({ resolveFamily: resolveApiFamily, prepare: prepareMaterialPrintCaller, emit: emitMapEvent });
