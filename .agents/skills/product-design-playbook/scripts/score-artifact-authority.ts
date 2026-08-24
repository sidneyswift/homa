import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  ScoreValidationError,
} from "./score-contract.ts";

function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertCommittedAuditAuthority(
  repositoryRoot: string,
  repositoryRelativePath: string,
  expectedHash: string,
): void {
  try {
    execFileSync(
      "git",
      [
        "-C",
        repositoryRoot,
        "ls-files",
        "--error-unmatch",
        "--",
        repositoryRelativePath,
      ],
      { stdio: "ignore" },
    );
    const committedBytes = execFileSync(
      "git",
      [
        "-C",
        repositoryRoot,
        "show",
        `HEAD:${repositoryRelativePath}`,
      ],
    );
    if (hashBytes(committedBytes) !== expectedHash.toLowerCase()) {
      throw new Error("committed hash differs");
    }
  } catch {
    throw new ScoreValidationError(
      `committed audit authority is required: ${repositoryRelativePath}`,
    );
  }
}
