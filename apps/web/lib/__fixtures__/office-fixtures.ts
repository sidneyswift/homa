import { readFileSync } from "node:fs";

export const officeFixtures = [
  { name: "reading.docx", mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", text: "Reading practice: café, 日本語." },
  { name: "counting-xlsx.xlsx", mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", text: "café 日本語,10" },
  { name: "counting-biff8.xls", mediaType: "application/vnd.ms-excel", text: "café 日本語,10" },
  { name: "counting-biff5.xls", mediaType: "application/vnd.ms-excel", text: "café £,10" },
].map((fixture) => ({
  ...fixture,
  bytes: new Uint8Array(readFileSync(new URL(`./office/${fixture.name}`, import.meta.url))),
}));
