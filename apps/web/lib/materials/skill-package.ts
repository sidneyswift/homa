/**
 * Pure parser for a fleet skill package's SKILL.md (/admin/studio's
 * skill X-ray). Filesystem reads stay in lib/admin/studio-data.ts; this
 * module only takes text plus a directory listing, so the citation and
 * gap logic is unit-testable and never touches disk or the database.
 *
 * The gap detection is the point (founder ask 2026-07-18 evening: "see
 * the reference images stored in the skill, and what the input is to
 * choose it, so we can improve or identify gaps"): a reference the body
 * cites but the directory does not hold is a broken promise to the
 * model, and a file no section cites is dead weight.
 */

export interface SkillReferenceCitation {
  /** File name as cited, e.g. "homa-foldable-reference.png". */
  file: string;
  /** The ## section whose body cites it, or null for a preamble cite. */
  section: string | null;
  /** The lines right after the citation: what the reference shows and
   * when the skill reaches for it. */
  excerpt: string;
  /** False when the body cites it but the directory does not hold it. */
  present: boolean;
}

export interface SkillToolMention {
  /** Tool name as the agent calls it, e.g. "create_printable". */
  tool: string;
  /** The ## sections whose body names the tool, in body order; a
   * preamble mention shows as "(preamble)". */
  sections: string[];
}

export interface ParsedSkillPackage {
  /** The frontmatter description, the skill's routing contract. */
  description: string;
  /** The body (after frontmatter), verbatim. */
  body: string;
  lineCount: number;
  /** ## headings in body order. */
  sections: string[];
  /** Every references/<file> citation, in body order. */
  citations: SkillReferenceCitation[];
  /** Files on disk that no part of the body cites. */
  uncitedFiles: string[];
  /** Which sections drive each tool the body names (from toolNames),
   * ordered by first mention. Parsed, never hand-claimed, so the table
   * cannot drift from what SKILL.md actually says. */
  toolMentions: SkillToolMention[];
}

const CITATION_PATTERN = /references\/([a-z0-9][a-z0-9-]*\.(?:png|jpg|jpeg))/gi;

/** Lines following the citation that describe the reference, up to the
 * next blank line or heading, capped so a rogue body cannot bloat the
 * view. The citation token itself is stripped: the file name is already
 * the view's heading, repeating it teaches nothing. */
function excerptAfter(lines: string[], index: number): string {
  const collected: string[] = [];
  for (let i = index; i < lines.length && collected.length < 5; i++) {
    const line = (
      i === index
        ? lines[i]
            .replace(/Reference image:\s*/i, "")
            .replace(/`?references\/[a-z0-9-]+\.(?:png|jpe?g)`?/gi, "")
        : lines[i]
    ).trim();
    if (i > index && (line.length === 0 || line.startsWith("#"))) break;
    if (line.length > 0) collected.push(line);
  }
  return collected.join(" ").slice(0, 420);
}

export function parseSkillPackage(
  raw: string,
  filesOnDisk: readonly string[],
  toolNames: readonly string[] = [],
): ParsedSkillPackage {
  let description = "";
  let body = raw;
  const frontmatter = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (frontmatter) {
    body = raw.slice(frontmatter[0].length);
    const descriptionLine = frontmatter[1].match(/^description:\s*([\s\S]*)$/m);
    if (descriptionLine) description = descriptionLine[1].trim();
  }

  const lines = body.split("\n");
  const sections: string[] = [];
  const citations: SkillReferenceCitation[] = [];
  const onDisk = new Set(filesOnDisk);
  const seen = new Set<string>();
  const mentionSections = new Map<string, string[]>();
  const toolPatterns = toolNames.map(
    (tool) => [tool, new RegExp(`\\b${tool}\\b`)] as const,
  );
  let currentSection: string | null = null;

  for (const [index, line] of lines.entries()) {
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      currentSection = heading[1].trim();
      sections.push(currentSection);
      continue;
    }
    for (const match of line.matchAll(CITATION_PATTERN)) {
      const file = match[1];
      // One citation entry per file: the first mention carries the
      // "study it for" excerpt; later mentions (CSS snippets, path
      // notes) add nothing the founder needs twice.
      if (seen.has(file)) continue;
      seen.add(file);
      citations.push({
        file,
        section: currentSection,
        excerpt: excerptAfter(lines, index),
        present: onDisk.has(file),
      });
    }
    for (const [tool, pattern] of toolPatterns) {
      if (!pattern.test(line)) continue;
      const sectionLabel = currentSection ?? "(preamble)";
      const list = mentionSections.get(tool) ?? [];
      if (!list.includes(sectionLabel)) list.push(sectionLabel);
      if (!mentionSections.has(tool)) mentionSections.set(tool, list);
    }
  }

  return {
    description,
    body,
    lineCount: raw.split("\n").length,
    sections,
    citations,
    uncitedFiles: filesOnDisk.filter((file) => !seen.has(file)).sort(),
    toolMentions: [...mentionSections.entries()].map(([tool, toolSections]) => ({
      tool,
      sections: toolSections,
    })),
  };
}
