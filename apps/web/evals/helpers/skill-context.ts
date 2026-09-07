import matter from "gray-matter";

export function availableSkillsAnnouncement(skills: readonly { name: string; description: string }[]) {
  return [
    "Available skills",
    "Listed skills are available in this run. Do not claim a listed skill is inaccessible unless activation or workspace inspection actually fails.",
    "If the user names a skill or the request clearly matches one of the descriptions below, call load_skill before proceeding.",
    "If multiple skills match, activate the minimal set that covers the task. After activation, follow the returned instructions instead of improvising around them.",
    "If activation fails, say so briefly and continue with the best fallback. Packaged sibling files under a skill path can be inspected with bash or read_file when needed.",
    ...skills.map(({ name, description }) => `- ${name}: ${description} (path: /workspace/skills/${name}/SKILL.md)`),
  ].join("\n");
}

/** Focused harness seam, checked against installed Eve 0.19.0's
 * execution/skills/instructions.js and runtime/skills/sandbox-access.js.
 * A loaded skill is plain tool text. Do not secretly preload it or elevate
 * it into a system message; full-fleet routing is evaluated through Eve. */
export function focusedSkillContext(name: string, markdown: string) {
  const parsed = matter(markdown);
  if (typeof parsed.data.description !== "string") {
    throw new Error(`Missing skill description: ${name}`);
  }
  return {
    body: parsed.content,
    announcement: availableSkillsAnnouncement([{ name, description: parsed.data.description }]),
    loadDescription: [
      "Load the full instructions for one available skill by name or id.",
      "Use this tool when the request clearly matches a listed skill description or when the user explicitly asks for that skill.",
      "This is not for MCP connections; use connection_search to access an installed connection.",
      "Loading adds the skill instructions to the current turn.",
      'Choose the "skill" value from the Available skills block.',
    ].join(" "),
  };
}
