import { fileURLToPath } from "node:url";

const AUTHORITATIVE_REPAIR = "ISSUE_878_REPAIR=repaired";
const VERIFIED_NOOP = "ISSUE_878_REPAIR=verified_noop";

export function assertIssue878RepairMarkers(mode, markers) {
  const expected = mode === "apply" ? AUTHORITATIVE_REPAIR : VERIFIED_NOOP;

  if (mode !== "apply" && mode !== "verify") {
    throw new Error(`Unknown issue 878 marker policy mode: ${mode}`);
  }
  if (markers.length !== 1 || markers[0] !== expected) {
    const recovery =
      mode === "apply"
        ? " A post-commit interruption requires separate reviewed verification; do not rerun until then."
        : "";
    throw new Error(
      `Expected exactly ${expected}, received ${JSON.stringify(
        markers
      )}.${recovery}`
    );
  }

  return expected;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = assertIssue878RepairMarkers(
      process.argv[2],
      process.argv.slice(3)
    );
    process.stdout.write(`${result}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}
