#!/usr/bin/env node

const ABSENT_STATE = "false|false|false|false|false|false";
const SAME_RUN_COMPLETE_STATE = "true|true|true|true|true|true";

function normalizedState(value) {
  return value
    .trim()
    .split("|")
    .map((part) => {
      if (part === "t") return "true";
      if (part === "f") return "false";
      return part;
    })
    .join("|");
}

export function classifyIssue606ProductionRun({ runAttempt, state }) {
  if (!/^[1-9][0-9]*$/u.test(runAttempt)) {
    throw new Error("The GitHub run attempt is not a positive integer.");
  }
  const normalized = normalizedState(state);
  if (runAttempt === "1") {
    if (normalized !== ABSENT_STATE) {
      throw new Error(
        "Attempt 1 requires the reviewed pre-correction issue #606 state."
      );
    }
    return {
      firstConnectionMode: "repair-required",
      evidenceKind: "repaired-drained-and-verified",
    };
  }
  if (normalized !== SAME_RUN_COMPLETE_STATE) {
    throw new Error(
      "Recovery requires the complete issue #606 state bound to this exact GitHub run."
    );
  }
  return {
    firstConnectionMode: "recovery",
    evidenceKind: "recovered-drained-and-verified",
  };
}

function argumentsByName(values) {
  const allowed = new Set(["run-attempt", "state"]);
  const result = new Map();
  for (const value of values) {
    const match = /^--([a-z-]+)=(.*)$/u.exec(value);
    if (!match?.[1] || !allowed.has(match[1]) || result.has(match[1])) {
      throw new Error(`Unknown, duplicate, or malformed argument: ${value}`);
    }
    result.set(match[1], match[2] ?? "");
  }
  return result;
}

function requiredArgument(values, name) {
  const value = values.get(name)?.trim();
  if (!value) throw new Error(`Pass --${name}=<value>.`);
  return value;
}

function main() {
  const args = argumentsByName(process.argv.slice(2));
  const result = classifyIssue606ProductionRun({
    runAttempt: requiredArgument(args, "run-attempt"),
    state: requiredArgument(args, "state"),
  });
  console.log(`ISSUE_606_FIRST_CONNECTION_MODE=${result.firstConnectionMode}`);
  console.log(`ISSUE_606_EVIDENCE_KIND=${result.evidenceKind}`);
}

if (process.argv[1]?.endsWith("issue-606-production-run-contract.mjs")) {
  main();
}
