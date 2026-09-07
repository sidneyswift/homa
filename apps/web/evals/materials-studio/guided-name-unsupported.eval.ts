import { defineEval } from "eve/evals";

export default defineEval({
  description: "Unsupported name spelling is an honest stop, never a manual or image tracing fallback.",
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send("My niece Zoë is visiting. She recognizes the letters in her name and wants a name-tracing page with a pale name on top, middle and baseline guides. Keep the exact spelling Zoë. Do not remove the diaeresis or change her name. If that spelling cannot be made accurately, explain before trying another activity.");
    t.loadedSkill("materials-studio");
    t.calledTool("read_file", { input: { filePath: /\/recipes\/name-tracing-page\.md$/u } });
    t.eventsSatisfy("no unverified printable or image fallback was delivered", () => !turn.toolCalls.some((call) => call.name === "generate_image" || call.name === "mark_material_final" || call.name === "create_printable" && (call.output as { created?: boolean })?.created === true));
    t.eventsSatisfy("any attempted guided input kept the unsupported literal name intact", () => turn.toolCalls.filter((call) => call.name === "create_printable").every((call) => {
      const input = call.input as { recipe?: string; handwritingRows?: { text: string; style: string }[] };
      return input.recipe === "name-tracing-page" && Boolean(input.handwritingRows?.length)
        && input.handwritingRows!.every((row) => row.style === "independent" ? row.text === "" : row.text === "Zoë");
    }));
  },
});
