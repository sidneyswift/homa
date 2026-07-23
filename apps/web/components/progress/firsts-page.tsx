import { PageColumn } from "../dashboard/page-column";
import {
  FIRSTS_JUMP_RECENT,
  FIRSTS_PROVENANCE_SUMMARY,
  firstsEmptyBody,
  firstsEmptyHeading,
  firstsHeading,
  firstsIntro,
} from "../../lib/child-progress/firsts-copy";
import type { ChildFirstsPage } from "../../lib/child-progress/firsts-from-ledger";
import { ProvenanceBody } from "./provenance-body";

/**
 * The firsts page: one child, ordered strictly by date, oldest at the
 * top, the parent's own words leading each row.
 *
 * A server component with no state. What it must never render, each
 * pinned by a test: a per-row "First time" chip, a beginning label, a
 * month or year heading, a period grouping, any element whose text is a
 * bare number, a percentage, another child's name, a kid comparison, the
 * words "finally" or "at last", or an em dash. The kid switcher is not
 * rendered here; swapping children is handled by the sidebar through
 * kidSwitchTargetPath, which navigates to that child's Progress page.
 */

function FirstsEmpty({ childName }: { childName: string }) {
  return (
    <section
      aria-label="Firsts"
      className="mt-6 rounded-lg border border-border-subtle bg-card p-5 shadow-sm"
    >
      <p className="font-display text-lg font-semibold text-strong">
        {firstsEmptyHeading(childName)}
      </p>
      <p className="mt-1 max-w-2xl text-sm text-body">
        {firstsEmptyBody(childName)}
      </p>
    </section>
  );
}

export function FirstsPage({ page }: { page: ChildFirstsPage }) {
  const lastRowId =
    page.rows.length > 0
      ? page.rows[page.rows.length - 1].provenance.evidenceId
      : null;

  return (
    <PageColumn>
      <div className="mx-auto w-full max-w-[var(--container-md)]">
        <header>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-[-0.015em] text-strong sm:text-4xl">
            {firstsHeading(page.childName)}
          </h1>
          <p className="mt-2 max-w-2xl text-body">{firstsIntro(page.childName)}</p>
        </header>

        {page.rows.length === 0 ? (
          <FirstsEmpty childName={page.childName} />
        ) : (
          <>
            {/* The list runs oldest first because the record starts at
                the top; this anchor is how a mother reaches today
                without scrolling. A link, never a count. */}
            {page.rows.length >= 3 && lastRowId ? (
              <p className="mt-4">
                <a
                  href={`#first-${lastRowId}`}
                  className="text-sm font-medium text-[var(--sage-700)] underline underline-offset-4"
                >
                  {FIRSTS_JUMP_RECENT}
                </a>
              </p>
            ) : null}

            <ol className="mt-4 space-y-4">
              {page.rows.map((row) => (
                <li
                  key={row.provenance.evidenceId}
                  id={`first-${row.provenance.evidenceId}`}
                  className="rounded-lg border border-border-subtle bg-card p-5 shadow-sm"
                >
                  {row.subjectMarker ? (
                    <div className="mb-3">
                      <p className="font-display text-sm font-semibold text-[var(--sage-700)]">
                        {row.subjectMarker.heading}
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        {row.subjectMarker.body}
                      </p>
                    </div>
                  ) : null}

                  {/* The lead. The parent's sentence when there is one,
                      as the row's largest text; otherwise the authored
                      bank sentence in the same slot. The receipt leads;
                      the catalog label does not. */}
                  {row.lead.kind === "quote" ? (
                    <blockquote className="border-l-2 border-sage/50 pl-4 font-display text-lg text-strong">
                      {row.lead.text}
                    </blockquote>
                  ) : (
                    <p className="font-display text-lg text-strong">
                      {row.lead.text}
                    </p>
                  )}

                  <p className="mt-2 text-sm text-muted">
                    {row.provenance.metaLine}
                  </p>

                  {row.contestedLine ? (
                    <p className="mt-2 text-sm text-body">{row.contestedLine}</p>
                  ) : null}

                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-[var(--sage-700)]">
                      {FIRSTS_PROVENANCE_SUMMARY}
                    </summary>
                    <div className="mt-2">
                      <ProvenanceBody
                        data={{ kind: "reported", provenance: row.provenance }}
                      />
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </PageColumn>
  );
}
