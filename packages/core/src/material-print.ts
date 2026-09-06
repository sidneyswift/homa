/** Exact prepared-print receipts shared by web and native. No device effect. */
export const MAX_PRINT_PAGES = 240;
export const MAX_PRINT_COPIES = 20;
export const PRINT_STALE_MESSAGE = "That is not the current visible version anymore. Show the material again before printing.";
export const PRINT_INVALID_MESSAGE = "I could not verify these print details. Show the material again and ask me to prepare it for printing.";

export interface PreparedPrintRequest {
  materialId: string;
  title: string;
  /** Retained for older native clients, which subset the original locally. */
  authorizedPdfPath: string;
  /** Ordered, zero-based indexes in the original PDF, never output indexes. */
  pageIndexes: number[];
  pageCount: number;
  copies: number;
  includeAnswerKey?: boolean;
  /** True only when verified answer-key pages were actually removed. */
  answerKeyExcluded: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export function isPrintMaterialId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parsePreparedPrintRequest(value: unknown): PreparedPrintRequest | null {
  if (!record(value) || !isPrintMaterialId(value.materialId)
    || typeof value.title !== "string" || !value.title.trim() || value.title.length > 1000
    || value.authorizedPdfPath !== `/api/materials/${value.materialId}/pdf`
    || !Number.isInteger(value.pageCount) || (value.pageCount as number) < 1 || (value.pageCount as number) > MAX_PRINT_PAGES
    || !Number.isInteger(value.copies) || (value.copies as number) < 1 || (value.copies as number) > MAX_PRINT_COPIES
    || typeof value.answerKeyExcluded !== "boolean"
    || (value.includeAnswerKey !== undefined && typeof value.includeAnswerKey !== "boolean")
    || !Array.isArray(value.pageIndexes) || value.pageIndexes.length < 1 || value.pageIndexes.length > MAX_PRINT_PAGES
  ) return null;
  const indexes = value.pageIndexes;
  if (!indexes.every((index, position) => Number.isInteger(index) && index >= 0 && index < (value.pageCount as number)
    && (position === 0 || index > indexes[position - 1]))) return null;
  if (value.answerKeyExcluded && (value.includeAnswerKey === true || indexes.length === value.pageCount)) return null;
  if (!value.answerKeyExcluded && indexes.length !== value.pageCount) return null;
  return {
    materialId: value.materialId, title: value.title, authorizedPdfPath: value.authorizedPdfPath as string,
    pageIndexes: [...indexes], pageCount: value.pageCount as number, copies: value.copies as number,
    ...(typeof value.includeAnswerKey === "boolean" ? { includeAnswerKey: value.includeAnswerKey } : {}),
    answerKeyExcluded: value.answerKeyExcluded,
  };
}

export function requestedAnswerKey(request: PreparedPrintRequest): boolean {
  // Old receipts carried only the exclusion flag. Revalidation still checks
  // the exact selected pages; the old flag alone never authorizes exclusion.
  return request.includeAnswerKey ?? !request.answerKeyExcluded;
}

export type PrintHandoff = { ready: true; request: PreparedPrintRequest } | { ready: false; note: string };
export function parsePreparedPrintResponse(value: unknown, expectedId: string): PrintHandoff {
  if (!record(value)) return { ready: false, note: PRINT_INVALID_MESSAGE };
  if (value.ready === false) return { ready: false, note: typeof value.note === "string" && value.note.trim() && value.note.length <= 2000 ? value.note : PRINT_INVALID_MESSAGE };
  const request = value.ready === true ? parsePreparedPrintRequest(value.printRequest) : null;
  return request?.materialId === expectedId ? { ready: true, request } : { ready: false, note: PRINT_INVALID_MESSAGE };
}
export function parseMaterialPrintPart(part: unknown): PrintHandoff | null {
  if (!record(part) || part.type !== "dynamic-tool" || part.state !== "output-available" || part.toolName !== "prepare_material_print") return null;
  const output = part.output;
  if (!record(output)) return { ready: false, note: PRINT_INVALID_MESSAGE };
  if (output.ready === false) return parsePreparedPrintResponse(output, "");
  if (!record(output.material) || output.material.status !== "final" || !isPrintMaterialId(output.material.id)) return { ready: false, note: PRINT_INVALID_MESSAGE };
  const parsed = parsePreparedPrintResponse(output, output.material.id);
  if (parsed.ready && (output.material.pageCount !== parsed.request.pageCount || output.material.title !== parsed.request.title)) return { ready: false, note: PRINT_INVALID_MESSAGE };
  return parsed;
}

export function samePrintSelection(left: PreparedPrintRequest, right: PreparedPrintRequest): boolean {
  return left.materialId === right.materialId && left.pageCount === right.pageCount
    && left.copies === right.copies && requestedAnswerKey(left) === requestedAnswerKey(right)
    && left.answerKeyExcluded === right.answerKeyExcluded
    && left.pageIndexes.length === right.pageIndexes.length
    && left.pageIndexes.every((index, position) => index === right.pageIndexes[position]);
}
export function printPdfPath(request: PreparedPrintRequest): string {
  const query = new URLSearchParams({
    pageCount: String(request.pageCount), pages: request.pageIndexes.join(","),
    copies: String(request.copies), includeAnswerKey: String(requestedAnswerKey(request)),
    answerKeyExcluded: String(request.answerKeyExcluded),
  });
  return `/api/materials/${request.materialId}/print/pdf?${query}`;
}
export function parsePrintPdfQuery(materialId: string, query: URLSearchParams): PreparedPrintRequest | null {
  const keys = ["pageCount", "pages", "copies", "includeAnswerKey", "answerKeyExcluded"];
  if ([...query.keys()].length !== keys.length || keys.some((key) => query.getAll(key).length !== 1)) return null;
  const pages = query.get("pages")!;
  if (pages.length > MAX_PRINT_PAGES * 4 || !/^\d+(,\d+)*$/u.test(pages)) return null;
  if (!/^\d+$/u.test(query.get("pageCount")!) || !/^\d+$/u.test(query.get("copies")!)) return null;
  if (!["true", "false"].includes(query.get("includeAnswerKey")!) || !["true", "false"].includes(query.get("answerKeyExcluded")!)) return null;
  return parsePreparedPrintRequest({
    materialId, title: "Prepared PDF", authorizedPdfPath: `/api/materials/${materialId}/pdf`,
    pageCount: Number(query.get("pageCount")), pageIndexes: pages.split(",").map(Number),
    copies: Number(query.get("copies")), includeAnswerKey: query.get("includeAnswerKey") === "true",
    answerKeyExcluded: query.get("answerKeyExcluded") === "true",
  });
}
export function printPageSummary(request: PreparedPrintRequest): string {
  const ranges: string[] = [];
  for (let position = 0; position < request.pageIndexes.length; position++) {
    const start = request.pageIndexes[position]! + 1;
    let end = start;
    while (request.pageIndexes[position + 1] === end) { position++; end++; }
    ranges.push(start === end ? String(start) : `${start}-${end}`);
  }
  return `${request.pageIndexes.length === 1 ? "Page" : "Pages"} ${ranges.join(", ")} of ${request.pageCount}. ${request.copies} ${request.copies === 1 ? "copy" : "copies"} requested.${request.answerKeyExcluded ? " Answer key excluded." : ""}`;
}

/** Explicit activation re-prepares the same ID and options, including replayed cards. */
export async function refreshPrintHandoff(
  request: PreparedPrintRequest,
  prepare: (materialId: string, options: { copies: number; includeAnswerKey: boolean }) => Promise<unknown>,
): Promise<PrintHandoff> {
  if (!parsePreparedPrintRequest(request)) return { ready: false, note: PRINT_INVALID_MESSAGE };
  try {
    const result = parsePreparedPrintResponse(await prepare(request.materialId, { copies: request.copies, includeAnswerKey: requestedAnswerKey(request) }), request.materialId);
    if (result.ready && !samePrintSelection(request, result.request)) return { ready: false, note: "The selected pages changed. Show the material again before printing." };
    return result;
  } catch {
    return { ready: false, note: "I could not check this material. Try preparing it again when you are connected." };
  }
}
