import path from "node:path";

/** Verify filesystem references, not the meaning of a parent's request.
 * Legacy recipe tables name slugs; newer routers name package-relative paths.
 * Only edges from reachable files count, so an orphan cycle cannot pass. */
export function unreachableSkillReferences(
  documents: ReadonlyMap<string, string>,
): string[] {
  const references = [...documents.keys()].filter((file) => file.startsWith("references/"));
  const reached = new Set<string>(["SKILL.md"]);
  const queue = ["SKILL.md"];
  for (let index = 0; index < queue.length; index += 1) {
    const source = queue[index];
    const content = documents.get(source) ?? "";
    for (const target of references) {
      if (reached.has(target)) continue;
      const slug = path.basename(target, path.extname(target));
      const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const named = new RegExp(`(?<![A-Za-z0-9_-])${escaped}(?![A-Za-z0-9_-])`, "u");
      if (content.includes(target) || named.test(content)) {
        reached.add(target);
        queue.push(target);
      }
    }
  }
  return references.filter((file) => !reached.has(file)).sort();
}

/** Recipe table validation applies to all supporting documents, not just
 * the root. Return named recipe files so the caller checks actual files. */
export function recipeTableSlugs(content: string): string[] {
  const slugs: string[] = [];
  let inTable = false;
  for (const line of content.split("\n")) {
    if (/^\|.*\|\s*$/.test(line) && /\|\s*Recipe file\s*\|/i.test(line)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!/^\|.*\|\s*$/.test(line)) {
      inTable = false;
      continue;
    }
    const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
    const slug = cells[cells.length - 1];
    if (slug && !/^[-\s]+$/.test(slug)) slugs.push(slug);
  }
  return slugs;
}
