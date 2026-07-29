import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { parseAlertSource } from "./alert-acks";

/**
 * The founder console notices a family stuck on a failing tool (gh#372).
 *
 * During the 2026-07-26/27 incident a co-founder hit repeated
 * create_printable failures for hours, and the only escalation that
 * fired was Homa telling her to report the bug to the Homa team herself.
 * The customer was the pager.
 *
 * Threshold calibrated against 30 days of real non-sandbox traffic:
 * three errors for one family and one tool inside one hour fires exactly
 * twice (a find_materials burst on 07-17, a create_printable burst on
 * 07-28, which is the same afternoon her finalizes were stranding) and
 * never otherwise. One-off errors are the common case and stay quiet.
 */

const overview = readFileSync(
  path.join(import.meta.dirname, "overview-data.ts"),
  "utf8",
);
const acks = readFileSync(path.join(import.meta.dirname, "alert-acks.ts"), "utf8");
const adminPage = readFileSync(
  path.join(path.resolve(import.meta.dirname, "..", "..", "app", "admin"), "page.tsx"),
  "utf8",
);

describe("tool failure alert", () => {
  it("needs a burst, not a single error", () => {
    assert.match(overview, /having count\(\*\) >= 3/u);
  });

  it("groups per family, per tool, per hour, so unrelated errors do not add up", () => {
    assert.match(overview, /group by t\.family_id, t\.tool, date_trunc\('hour', t\.created_at\)/u);
  });

  it("excludes sandbox families, like every other alert here", () => {
    const query = overview.slice(overview.indexOf("with bursts as ("));
    assert.match(query.slice(0, 900), /f\.sandbox is not true/u);
  });

  it("hides a burst the founder already handled", () => {
    const query = overview.slice(overview.indexOf("with bursts as ("));
    assert.match(query.slice(0, 1600), /source = 'tool_failure'/u);
  });

  it("is a real alert source, so the ack button works", () => {
    assert.equal(parseAlertSource("tool_failure"), "tool_failure");
    assert.match(acks, /from public\.agent_tool_calls where id = \$\{sourceId\}/u);
  });

  it("shows on the console with the family, the tool, and how many times", () => {
    assert.match(adminPage, /data\.toolTroubles/u);
    assert.match(adminPage, /\{t\.tool\} failing \{t\.failures\} times/u);
  });

  it("counts toward whether the console shows an alert strip at all", () => {
    assert.match(adminPage, /data\.toolTroubles\.length > 0 \|\|/u);
  });

  it("records the limit it cannot see, so nobody trusts it for the wrong thing", () => {
    // gh#345 produced no rows here: the tool was missing from the turn
    // rather than failing in it, so absence needs its own detection.
    assert.match(overview, /cannot see a tool that was never OFFERED/u);
  });
});
