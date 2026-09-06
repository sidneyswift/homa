import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import ts from "typescript";
import { z } from "zod";

import * as deadlines from "../../lib/agent-tool-deadline";
import * as hoursModel from "../../lib/hours-model";
import * as recordScope from "../../lib/hours-record-scope";
import * as summary from "../../lib/hours-summary";
import { HoursSummaryReadError, validateHoursSummaryRecord, type HoursSummaryRequest } from "../../lib/hours-summary-reader";
import * as timeZone from "../../lib/time-zone";
import { CHILDREN, FAMILY, NOW, ROWS, type HoursReadCase } from "./fixtures";

export interface CapturedTool {
  description: string;
  inputSchema: z.ZodType;
  execute: (input: unknown, ctx: unknown) => Promise<unknown>;
}
export const webRoot = () => resolve(process.cwd());

/** Execute the unchanged production tool body with only the authenticated
 * access/reader replaced. No database client is constructed or called. Unknown tool imports
 * fail closed. This is an eval seam, never a product runtime or authority. */
export async function hoursToolForCase(testCase: HoursReadCase): Promise<CapturedTool> {
  const source = await readFile(resolve(webRoot(), "agent/tools/find_hours.ts"), "utf8");
  // This seam replaces the SQL snapshot only. The production tool and
  // production receipt validator still execute; real SQL/RLS has a separate
  // disposable PostgreSQL contract. Expected numbers remain in fixtures.ts.
  const syntheticSnapshot = async (familyId: string, input: HoursSummaryRequest, now: Date) => {
    if (familyId !== FAMILY) throw new Error("Unexpected synthetic family.");
    if (testCase.complete === false) throw new HoursSummaryReadError("unavailable");
    const schoolYearStartOn = testCase.schoolYearStartOn === undefined ? "2026-09-01" : testCase.schoolYearStartOn;
    const today = timeZone.zonedDateString(now, "America/New_York");
    const window = summary.resolveHoursWindow(input.period ?? "week", today, schoolYearStartOn);
    const params = new URLSearchParams({ shared: input.includeShared === false ? "exclude" : "include" });
    if (input.childId !== undefined) params.set("child", input.childId);
    if (input.from !== undefined || window.from !== null) params.set("from", input.from ?? window.from!);
    params.set("through", input.through ?? window.through);
    const parsed = recordScope.parseHoursRecordRequest(params);
    if (!parsed) throw new HoursSummaryReadError("invalid");
    const matching = ROWS.filter(row => recordScope.matchesHoursRecordScope(row, parsed.scope)
      && (input.subject === undefined || row.subject === input.subject));
    const totals = summary.summarizeHours(matching);
    const custom = input.from !== undefined || input.through !== undefined;
    const raw = {
      status: "ready", familyId, timeZone: "America/New_York", schoolYearStartOn, today,
      window: { from: parsed.scope.from, through: parsed.scope.through,
        period: custom ? "custom" : window.period, schoolYearFallback: window.schoolYearFallback && !custom },
      children: CHILDREN, entryCount: totals.entryCount, totalMinutes: totals.totalMinutes,
      recordedDays: new Set(matching.map(row => row.happenedOn)).size,
      firstDay: totals.firstDay, lastDay: totals.lastDay,
      byEntryScope: totals.byChild, bySubject: totals.bySubject,
      recordedDaysByChild: recordScope.summarizeRecordedLearningDays(
        recordScope.deriveRecordedLearningDays(matching, CHILDREN, parsed.scope), CHILDREN, parsed.scope),
      entries: matching.slice(0, input.limit ?? 20).map(row => ({ ...row,
        note: row.note === null ? null : Array.from(row.note).slice(0, 200).join(""), noteTruncated: Array.from(row.note ?? "").length > 200 })),
    };
    return validateHoursSummaryRecord(raw, familyId, input, now);
  };
  const imports: Record<string, unknown> = {
    zod: { z },
    "../../lib/agent-db": {
      MissingFamilyContextError: class MissingFamilyContextError extends Error {},
      resolveAgentAccess: async () => ({ mode: "pinned", familyId: FAMILY }),
    },
    "../../lib/hours-summary-reader": {
      HoursSummaryReadError,
      readHoursSummaryPinned: syntheticSnapshot,
      readHoursSummaryCaller: () => { throw new Error("This model fixture does not emulate a caller JWT."); },
    },
    "../../lib/agent-tool-deadline": deadlines,
    "../../lib/hours-model": hoursModel,
    "../../lib/hours-record-scope": recordScope,
    "../../lib/hours-summary": summary,
    "../../lib/time-zone": timeZone,
  };
  class FixedDate extends Date { constructor(value?: string | number) { super(value ?? NOW); } }
  const exports: { default?: CapturedTool } = {};
  runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, URLSearchParams, Date: FixedDate, console,
    require: (name: string) => { if (!(name in imports)) throw new Error(`Unreviewed eval import: ${name}`); return imports[name]; },
  }, { timeout: 1000, filename: "find_hours.production-source.eval.js" });
  if (!exports.default?.inputSchema || !exports.default.execute) throw new Error("Production Hours tool shape changed.");
  return exports.default;
}

export async function stateRecordsDescription(): Promise<string> {
  const source = await readFile(resolve(webRoot(), "agent/tools/open_state_records.ts"), "utf8");
  const ast = ts.createSourceFile("tool.ts", source, ts.ScriptTarget.Latest, true);
  let description: string | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && node.name.getText(ast) === "description" && ts.isStringLiteral(node.initializer)) description = node.initializer.text;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  if (!description) throw new Error("State records description was not found.");
  return description;
}
