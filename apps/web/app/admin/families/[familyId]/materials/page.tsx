import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getFamilyMaterialsDeep } from "../../../../../lib/admin/family-deep-data";
import { requireFounder } from "../../../../../lib/admin/gate";
import { timeAgo } from "../../../../../lib/admin/format";
import { AdminArtifactPreview } from "../../../artifact-preview";
import { EmptyNote, Pill, statusTone } from "../../../ui";
import { FamilyShell, isUuid } from "../family-shell";

/**
 * The family file's Materials chapter: every generated page with its
 * real preview, and, for rows written after the capture layer, the
 * generation record: what the tool was asked for, by which session,
 * and what the vision review said.
 */

export const metadata: Metadata = { title: "Family materials" };

export default async function AdminFamilyMaterialsPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  await requireFounder();
  const { familyId } = await params;
  if (!isUuid(familyId)) notFound();
  const materials = await getFamilyMaterialsDeep(familyId);

  return (
    <FamilyShell
      familyId={familyId}
      title="· Materials"
      sub="Everything the studio made for this family, drafts and finals, with generation provenance where captured."
    >
      {() => (
        <div>
          {materials.length === 0 ? (
            <EmptyNote>No materials yet.</EmptyNote>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {materials.map((material) => (
                <div
                  key={material.id}
                  className="overflow-hidden rounded-lg border border-border-subtle bg-card shadow-sm"
                >
                  <AdminArtifactPreview
                    src={material.previewUrl}
                    alt={`Preview of ${material.title}`}
                    href={material.pdfUrl}
                    className="border-0 rounded-none shadow-none"
                    imageClassName="aspect-[8.5/6]"
                  />
                  <div className="p-3.5">
                    <p className="truncate font-display text-sm font-bold text-strong">
                      {material.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Pill tone="stone">{material.kind}</Pill>
                      <Pill tone={statusTone(material.status)}>{material.status}</Pill>
                      {material.generation?.review ? (
                        <Pill tone={material.generation.review.pass ? "sage" : "gold"}>
                          {material.generation.review.pass ? "review passed" : "review flagged"}
                        </Pill>
                      ) : null}
                    </div>
                    <p className="mt-1.5 font-mono text-[0.62rem] text-subtle">
                      {material.childName ?? "whole family"} · {material.channel ?? "web"} ·{" "}
                      {timeAgo(material.createdAt)}
                      {material.revises ? " · revision" : ""}
                    </p>
                    {material.generation ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[var(--homa-info-ink)]">
                          How this was made
                        </summary>
                        <div className="mt-1.5 rounded-md bg-[var(--homa-canvas)] p-2.5 font-mono text-[0.68rem] text-muted">
                          {material.generation.input ? (
                            <p className="whitespace-pre-wrap break-words">
                              {Object.entries(material.generation.input)
                                .filter(([, value]) => value !== null && value !== undefined)
                                .map(([key, value]) =>
                                  `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
                                .join("\n")}
                            </p>
                          ) : null}
                          {material.generation.review && !material.generation.review.pass ? (
                            <p className="mt-1.5 text-[var(--homa-highlight-ink)]">
                              review issues: {material.generation.review.issues.join("; ")}
                            </p>
                          ) : null}
                          {/* Problems on later pages ship with the material
                              rather than holding it back (gh#368), so the
                              flagged pill never shows them. Without this line
                              they would be invisible to the console that is
                              supposed to be how quality gets watched. */}
                          {material.generation.review?.advisoryIssues?.length ? (
                            <p className="mt-1.5 text-[var(--homa-highlight-ink)]">
                              later-page notes (shipped, not held):{" "}
                              {material.generation.review.advisoryIssues.join("; ")}
                            </p>
                          ) : null}
                          {material.generation.sessionId ? (
                            <p className="mt-1.5">
                              <Link
                                href={`/admin/sessions/${encodeURIComponent(material.generation.sessionId)}`}
                                className="text-[var(--homa-info-ink)] hover:underline"
                              >
                                open the session that made it
                              </Link>
                            </p>
                          ) : null}
                        </div>
                      </details>
                    ) : (
                      <p className="mt-2 font-mono text-[0.62rem] text-subtle">
                        generation record not captured (pre-capture row)
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </FamilyShell>
  );
}
