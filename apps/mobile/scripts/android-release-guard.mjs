#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DISPOSITION_PATH = fileURLToPath(new URL("../release/platform-disposition.json", import.meta.url));
const SHELL_LINE_CONTINUATION = /\\\r?\n[\t ]*/gu;
const SHELL_COMMAND_BOUNDARY = /\r?\n|&&|\|\||[;|(){}\u0060]/gu;
const SHELL_TOKEN = /"(?:\\.|[^"\\])*"|'[^']*'|[^\s]+/gu;
const EAS_EXECUTABLE = /^(?:.*\/)?(?:eas|eas-cli(?:@[^\s]+)?)$/iu;
const EAS_EMBEDDED_EXECUTABLE = /(?:^|[^a-z0-9_.-])(?:eas|eas-cli(?:@[a-z0-9_.-]+)?)(?:$|[^a-z0-9_@.-])/iu;
const EAS_PUBLIC_ACTION = /^(?:build|submit)$/iu;
const EAS_PUBLIC_ACTION_WORD = /(?:^|\s)(?:build|submit)(?:$|\s)/iu;
const EAS_LITERAL_ACTION = /^[a-z][a-z0-9:_-]*$/iu;
const SHELL_DYNAMIC_WORD = /[$*?]/u;
const SHELL_ASSIGNMENT = /^[a-z_][a-z0-9_]*=/iu;
const SHELL_COMMAND_PREFIX = /^(?:!|command|exec|env|if|then|elif|do|while|until|sudo|nohup|time)$/u;
const AUDITED_NON_MOBILE_WORKFLOW_SHA256 = new Set([
  "7b671bf43899443968a2f1afcacbb45fa57e4eaf4c20ddac6c33154e6f7446b1",
  "bbc328bf15848cb6a9936653879ead957378f1f88002763826e8342395a7b3a6",
  "8de4f1ac311ee9e96036cf70f10d2c30c513a2faa88732fcbaf546295b0af185",
  "df1c2954b93068385ec6953288f53b4739546f6924b32893ae8415e30af206b3",
  "fe317dd3e9891273f4ea8307c9c9e4213a0181b75d86b6eda4287101a3550157",
]);
const require = createRequire(import.meta.url);

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function readPlatformDisposition(path = DISPOSITION_PATH) {
  let value;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Mobile platform disposition is unreadable: ${error instanceof Error ? error.message : String(error)}`);
  }
  const disposition = asRecord(value);
  const android = asRecord(disposition?.android);
  if (
    disposition?.schemaVersion !== 1
    || disposition?.owner !== "founder"
    || android?.publicDistribution !== "blocked"
    || android?.allowedScope !== "compile-only"
  ) {
    throw new Error("Mobile platform disposition does not preserve the founder-owned Android compile-only boundary");
  }
  return disposition;
}

export function containsAndroidPublicReleaseCommand(value) {
  // Reviewed non-mobile repair workflows have exact release-seal contracts
  // and contain shell data that this intentionally conservative scan rejects.
  // Any byte change loses the exception and falls back to the full scan.
  if (AUDITED_NON_MOBILE_WORKFLOW_SHA256.has(createHash("sha256").update(value).digest("hex"))) return false;
  const commandSources = extractRunScalars(value);
  if (commandSources === null) return true;
  return commandSources.some(({ value: commandSource, direct }) => containsUnapprovedEasCommandSource(commandSource, direct));
}

export function containsUnapprovedEasCommandSource(commandSource, direct = true) {
  const relevantSource = direct ? stripShellHeredocBodies(commandSource) : commandSource;
  const commands = relevantSource.replace(SHELL_LINE_CONTINUATION, " ").split(SHELL_COMMAND_BOUNDARY);
  return commands.some((command) => commandHasUnapprovedPublicRelease(command, direct));
}

function stripShellHeredocBodies(value) {
  const output = [];
  let delimiter = null;
  let stripTabs = false;
  for (const line of value.split(/\r?\n/u)) {
    if (delimiter !== null) {
      const candidate = stripTabs ? line.replace(/^\t+/u, "") : line;
      if (candidate === delimiter) {
        delimiter = null;
        stripTabs = false;
      } else if (EAS_EMBEDDED_EXECUTABLE.test(normalizeStaticShellWord(line))) {
        output.push(line);
      }
      continue;
    }
    const match = /<<(-)?\s*(['"]?)([a-z_][a-z0-9_]*)\2/iu.exec(line);
    if (!match) {
      output.push(line);
      continue;
    }
    output.push(line.slice(0, match.index));
    delimiter = match[3];
    stripTabs = match[1] === "-";
  }
  if (delimiter !== null) return `${output.join("\n")}\n$UNCLOSED_HEREDOC`;
  return output.join("\n");
}

function extractRunScalars(value) {
  let parsed;
  try {
    const { parse } = require("yaml");
    parsed = parse(value, { merge: true, maxAliasCount: 100 });
  } catch {
    return null;
  }

  if (typeof parsed === "string") return [{ value: parsed, direct: true }];
  const runs = [];
  const indirectCommands = [];
  let malformedRun = false;
  const collectStringLeaves = (node) => {
    if (typeof node === "string") {
      indirectCommands.push({ value: node, direct: false });
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) collectStringLeaves(child);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const child of Object.values(node)) collectStringLeaves(child);
  };
  const visit = (node) => {
    if (Array.isArray(node)) {
      for (const value of node) visit(value);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      if (key === "run") {
        if (typeof child === "string") runs.push({ value: child, direct: true });
        else malformedRun = true;
      }
      if (key === "env" || key === "matrix") collectStringLeaves(child);
      visit(child);
    }
  };
  visit(parsed);
  if (malformedRun) return null;
  if (runs.length === 0 && /\b(?:eas|eas-cli)\b/iu.test(value)) {
    return null;
  }
  return [...runs, ...indirectCommands];
}

function normalizeStaticShellWord(value) {
  let result = "";
  let quote = null;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "'" || character === '"') {
      if (quote === character) quote = null;
      else if (quote === null) quote = character;
      else result += character;
      continue;
    }
    if (character === "\\" && index + 1 < value.length) {
      result += value[index + 1];
      index += 1;
      continue;
    }
    result += character;
  }
  return result;
}

function platformValue(token) {
  const assignment = /^(?:--platform|-p)=["']?([^"']+)["']?$/iu.exec(token);
  return assignment?.[1] ?? null;
}

function commandHasUnapprovedPublicRelease(command, rejectDynamicExecutable) {
  const normalizedCommand = normalizeStaticShellWord(command);
  if (
    /[<>]/u.test(command)
    && EAS_EMBEDDED_EXECUTABLE.test(normalizedCommand)
    && EAS_PUBLIC_ACTION_WORD.test(normalizedCommand)
  ) return true;
  const tokens = Array.from(command.matchAll(SHELL_TOKEN), (match) => normalizeStaticShellWord(match[0]));
  let commandIndex = 0;
  while (SHELL_ASSIGNMENT.test(tokens[commandIndex] ?? "") || SHELL_COMMAND_PREFIX.test(tokens[commandIndex] ?? "")) {
    commandIndex += 1;
  }
  if (rejectDynamicExecutable && SHELL_DYNAMIC_WORD.test(tokens[commandIndex] ?? "")) return true;

  for (let index = 0; index < tokens.length; index += 1) {
    const executable = tokens[index];
    if (EAS_EMBEDDED_EXECUTABLE.test(executable) && !EAS_EXECUTABLE.test(executable)) return true;

    let actionIndex = index + 1;
    while (tokens[actionIndex] === "--") actionIndex += 1;
    const action = tokens[actionIndex];
    if (SHELL_DYNAMIC_WORD.test(executable) && EAS_PUBLIC_ACTION.test(action ?? "")) return true;
    if (!EAS_EXECUTABLE.test(executable)) continue;
    if (!action || !EAS_LITERAL_ACTION.test(action)) return true;
    if (!EAS_PUBLIC_ACTION.test(action)) continue;

    const platforms = [];
    for (let cursor = actionIndex + 1; cursor < tokens.length; cursor += 1) {
      const token = tokens[cursor];
      const assigned = platformValue(token);
      if (assigned !== null) {
        platforms.push(assigned);
        continue;
      }
      if (token === "--platform" || token === "-p") {
        platforms.push(tokens[cursor + 1] ?? "");
        cursor += 1;
      }
    }
    if (platforms.length !== 1 || platforms[0].toLowerCase() !== "ios") return true;
  }
  return false;
}

export function assertEasBuildPlatform(environment = process.env, disposition = readPlatformDisposition()) {
  if (environment.EAS_BUILD !== "true") return { status: "not-eas-build" };
  const platform = environment.EAS_BUILD_PLATFORM;
  if (platform !== "ios" && platform !== "android") {
    throw new Error("EAS_BUILD_PLATFORM must be ios or android during an EAS build");
  }
  if (platform === "android" && disposition.android.publicDistribution !== "approved") {
    throw new Error(
      "Android public distribution is blocked. Homa's founder-owned disposition permits compile-only CI until a complete Google Play rail is approved.",
    );
  }
  return { status: "allowed", platform };
}

function main() {
  const result = assertEasBuildPlatform();
  console.log(result.status === "allowed" ? `EAS ${result.platform} build allowed` : "Not running inside EAS Build");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`Mobile public-release guard: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
