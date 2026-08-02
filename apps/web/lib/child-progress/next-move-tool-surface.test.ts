import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ToolContext } from "eve/tools";

import {
  RESTRICTED_PROGRESS_FRAMEWORK_TOOLS,
  isRestrictedProgressTask,
  resolveProgressTaskBoundaryTools,
} from "../../agent/tools/progress_task_boundary";
import { ToolAccessBoundaryError } from "../agent-tool-deadline";

describe("Progress next-move effective framework tool boundary", () => {
  it("activates only for the exact internal channel", () => {
    assert.equal(
      isRestrictedProgressTask({ channel: "progress_next_move" }),
      true,
    );
    assert.equal(
      isRestrictedProgressTask({ channel: "progress-next-move" }),
      false,
    );
    assert.equal(isRestrictedProgressTask({ channel: "mobile" }), false);
    assert.equal(resolveProgressTaskBoundaryTools(undefined), null);
  });

  it("replaces every unrelated framework effect with the shared access denial", async () => {
    const tools = resolveProgressTaskBoundaryTools({
      channel: "progress_next_move",
    });
    assert.ok(tools);
    assert.deepEqual(
      Object.keys(tools).sort(),
      [...RESTRICTED_PROGRESS_FRAMEWORK_TOOLS].sort(),
    );
    assert.equal("load_skill" in tools, false);
    assert.equal("persist_progress_next_move" in tools, false);

    const context = {
      session: {
        auth: {
          current: { attributes: { channel: "progress_next_move" } },
        },
      },
    } as unknown as ToolContext;
    for (const [toolName, tool] of Object.entries(tools)) {
      await assert.rejects(
        async () => await tool.execute({ query: "private child context" }, context),
        (error: unknown) =>
          error instanceof ToolAccessBoundaryError &&
          error.channel === "progress_next_move" &&
          RESTRICTED_PROGRESS_FRAMEWORK_TOOLS.includes(
            toolName as RestrictedToolName,
          ),
      );
    }
  });
});

type RestrictedToolName =
  (typeof RESTRICTED_PROGRESS_FRAMEWORK_TOOLS)[number];
