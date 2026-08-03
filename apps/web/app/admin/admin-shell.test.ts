import { readFileSync } from "node:fs";
import { test } from "node:test";

const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
const nav = readFileSync(new URL("./admin-nav.tsx", import.meta.url), "utf8");
const overview = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const sharedUi = readFileSync(new URL("./ui.tsx", import.meta.url), "utf8");

test("admin shell exposes Quiet authority boundaries", () => {
  if (!layout.includes('data-brand-surface="admin"')) throw new Error("admin surface marker missing");
  if (!layout.includes('data-brand-layer="admin-mobile-header"')) throw new Error("mobile header marker missing");
  if (!nav.includes("quiet-admin__nav-item--active")) throw new Error("admin active nav treatment missing");
  if (!overview.includes('data-brand-surface="admin-overview"')) throw new Error("overview surface marker missing");
});

test("admin shared UI uses contract-backed status colors", () => {
  for (const token of ["homa-constructive-tint", "homa-highlight-tint", "homa-error-tint", "homa-info-tint"]) {
    if (!sharedUi.includes(`var(--${token})`)) throw new Error(`missing ${token}`);
  }
});
