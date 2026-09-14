const importWordParser = () => import("mammoth");
const importSpreadsheetParser = () => import("xlsx");

/** Ordinary text turns do not need Office parsers or their encoding tables.
 * Literal imports keep both packages discoverable by Next and Eve builds. */
export async function loadWordParser() {
  return (await importWordParser()).default;
}

export async function loadSpreadsheetParser() {
  return importSpreadsheetParser();
}
