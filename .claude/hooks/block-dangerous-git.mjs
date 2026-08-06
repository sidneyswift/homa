#!/usr/bin/env node

import { readFileSync } from "node:fs";

function block(message) {
  process.stderr.write(`BLOCKED: ${message}\n`);
  process.exit(2);
}

function commandTokens(command) {
  return command.match(/--?[A-Za-z0-9][A-Za-z0-9-]*(?:=[^\s'";&|()]+)?|[A-Za-z0-9_./:@+~=-]+/gu) ?? [];
}

function isGitToken(token) {
  const normalized = token.replace(/\\/gu, "/");
  return normalized === "git" || normalized.endsWith("/git");
}

function gitSubcommand(tokens, gitIndex) {
  let index = gitIndex + 1;
  while (index < tokens.length) {
    const token = tokens[index];
    if (["-C", "-c", "--config-env", "--exec-path", "--git-dir", "--namespace", "--work-tree"].includes(token)) {
      index += 2;
      continue;
    }
    if (/^-C.+/u.test(token)) {
      index += 1;
      continue;
    }
    if (/^--(?:config-env|exec-path|git-dir|namespace|work-tree)=/u.test(token)) {
      index += 1;
      continue;
    }
    if (token.startsWith("-")) {
      index += 1;
      continue;
    }
    return { index, name: token, args: tokens.slice(index + 1) };
  }
  return null;
}

function hasShortFlag(args, flag) {
  return args.some((argument) => new RegExp(`^-[^-]*${flag}`, "u").test(argument));
}

function dangerousGitReason(tokens) {
  for (let index = 0; index < tokens.length; index += 1) {
    if (!isGitToken(tokens[index])) continue;
    const command = gitSubcommand(tokens, index);
    if (!command) continue;
    const { name, args } = command;

    if (name === "push") return "Git push requires an explicit reviewed action outside this advisory hook.";
    if (name === "worktree" && args.includes("remove")) {
      return "Direct worktree removal is disabled. Use scripts/remove-worktree-safely.mjs.";
    }
    if (name === "worktree" && args.includes("prune")) {
      return "Direct worktree pruning requires an explicit reviewed action outside this advisory hook.";
    }
    if (name === "reset" && args.some((argument) => argument === "--hard" || argument.startsWith("--hard="))) {
      return "Hard reset is disabled by the project Git safety policy.";
    }
    if (name === "clean" && (args.includes("--force") || hasShortFlag(args, "f"))) {
      return "Forced Git clean is disabled by the project Git safety policy.";
    }
    const deletesBranch = args.includes("-D") || args.includes("--delete") || hasShortFlag(args, "d");
    const forcesBranch = args.includes("-D") || args.includes("--force") || hasShortFlag(args, "f");
    if (name === "branch" && deletesBranch && forcesBranch) {
      return "Forced branch deletion is disabled by the project Git safety policy.";
    }
    if (["checkout", "restore"].includes(name) && (args.includes(".") || args.includes(":/"))) {
      return "Whole-worktree checkout or restore is disabled by the project Git safety policy.";
    }
  }
  return null;
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch (error) {
  block(`The advisory Git hook could not parse its request: ${error instanceof Error ? error.message : String(error)}`);
}

const command = input?.tool_input?.command ?? input?.tool_input?.cmd;
if (typeof command !== "string" || command.trim() === "") {
  block("The advisory Git hook received no Bash command to inspect.");
}

const reason = dangerousGitReason(commandTokens(command));
if (reason) block(reason);

process.exit(0);
