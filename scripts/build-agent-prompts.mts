import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const VOICE_MARKER = "@@shared-voice-rules@@";
export const PROMPT_TARGETS = [
  { source: "chat.md", output: "instructions.md" },
  { source: "report.md", output: "report-writer.md" },
  { source: "curriculum.md", output: "curriculum-writer.md" },
] as const;

export function assertCleanRuntimePrompt(markdown: string, label: string): void {
  if (!markdown.trim()) throw new Error(`${label}: runtime prompt is empty`);
  if (/<!--|-->/u.test(markdown)) {
    throw new Error(`${label}: developer comments belong in AGENTS.md, not a runtime prompt`);
  }
  if (/@@[a-z-]+@@/u.test(markdown)) {
    throw new Error(`${label}: unresolved prompt-source marker`);
  }
}

export function renderAgentPrompt(template: string, voiceRules: string): string {
  if (template.split(VOICE_MARKER).length !== 2) {
    throw new Error("Each role template must include shared voice rules exactly once");
  }
  assertCleanRuntimePrompt(voiceRules, "shared voice rules");
  const rendered = template.replace(VOICE_MARKER, () => voiceRules.trim());
  assertCleanRuntimePrompt(rendered, "rendered agent prompt");
  return rendered;
}

export function buildAgentPrompts(repoRoot: string, check: boolean): void {
  const webRoot = path.join(repoRoot, "apps/web");
  const sources = path.join(webRoot, "prompt-sources");
  const voiceRules = readFileSync(path.join(sources, "voice-rules.md"), "utf8");
  for (const { source, output } of PROMPT_TARGETS) {
    const rendered = renderAgentPrompt(readFileSync(path.join(sources, source), "utf8"), voiceRules);
    const outputPath = path.join(webRoot, "agent", output);
    if (check) {
      const committed = readFileSync(outputPath, "utf8");
      assertCleanRuntimePrompt(committed, output);
      if (committed !== rendered) {
        throw new Error(`${output} is stale. Edit prompt-sources, then run pnpm build:agent-prompts`);
      }
    } else {
      writeFileSync(outputPath, rendered, "utf8");
    }
    console.log(`${check ? "Checked" : "Generated"} agent/${output} from prompt-sources/${source}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildAgentPrompts(path.dirname(path.dirname(fileURLToPath(import.meta.url))), process.argv.includes("--check"));
}
