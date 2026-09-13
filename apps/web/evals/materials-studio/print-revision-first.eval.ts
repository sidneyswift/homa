import { defineEval } from "eve/evals";
import { sendEvalMessage } from "../../lib/eval-send-message";
import { EVAL_FIXTURE_MATERIAL_PRINT_REVISION_ID, EVAL_FIXTURE_MATERIAL_PRINT_REVISION_TITLE } from "../../lib/family-context-eval-fixture";
import { activeMaterialContext } from "../../lib/voice/active-material";

export default defineEval({
  description: "A requested change plus printing never prepares the old node before the parent sees the revision.",
  timeoutMs: 300_000,
  async test(t) {
    const turn = await sendEvalMessage(t, {
      message: "Love it. Make the title bigger and print two copies.",
      clientContext: activeMaterialContext({ id: EVAL_FIXTURE_MATERIAL_PRINT_REVISION_ID, title: EVAL_FIXTURE_MATERIAL_PRINT_REVISION_TITLE, status: "final", revisesId: null, pageCount: 1, pageRoles: ["child"] }),
    });
    t.succeeded();
    t.loadedSkill("materials-studio");
    t.calledTool("create_printable");
    t.eventsSatisfy("a real visible draft descends from the requested material", () => {
      const revisionIds = new Set<string>([EVAL_FIXTURE_MATERIAL_PRINT_REVISION_ID]);
      let visibleRevision = false;
      for (const call of turn.toolCalls) {
        if (call.name !== "create_printable") continue;
        const output = call.output as { created?: boolean; material?: { id?: string; status?: string; revisesId?: string; reviewPassed?: boolean | null } } | null;
        const material = output?.material;
        if (output?.created !== true || !material?.id || !material.revisesId
          || material.status !== "draft" || revisionIds.has(material.id)
          || !revisionIds.has(material.revisesId)) continue;
        revisionIds.add(material.id);
        if (material.reviewPassed !== false) visibleRevision = true;
      }
      return visibleRevision;
    });
    t.eventsSatisfy("revision remains awaiting the parent's review", () => turn.toolCalls.every((call) => call.name !== "prepare_material_print" && call.name !== "mark_material_final"));
  },
});
