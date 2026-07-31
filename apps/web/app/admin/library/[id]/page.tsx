import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireFounder } from "../../../../lib/admin/gate";
import { readLibraryBook } from "../../../../lib/admin/library-data";
import { dimensionCoverage, readAnalysis } from "../../../../lib/materials/library-reader";
import {
  SHELF_STATUS_BLURB,
  SHELF_STATUS_LABEL,
  SHELF_STATUS_TODO,
  type ShelfStatus,
} from "../../../../lib/materials/library-shelf";
import { EmptyNote, Pill, type PillTone } from "../../ui";
import { BookCover } from "../book-cover";
import { ReadableTree } from "../readable-tree";

/**
 * /admin/library/<record-id>: the book, opened. Founder ask 2026-07-31,
 * the second half: "when a book file is clicked, it opens to more info,
 * showing what was extracted, metadata tags, etc, but in a UI so it is
 * easy for a non technical human to understand."
 *
 * So the page leads with the things a person asks first (what is this,
 * who dropped it, do we still have the file) and puts the extraction
 * underneath, rendered as prose-shaped sections rather than as JSON.
 * The raw document stays available at the bottom, collapsed, because
 * the honest answer to "is that everything?" should be checkable
 * without leaving the page.
 */

export const metadata: Metadata = { title: "Book" };

const STATUS_TONE: Record<ShelfStatus, PillTone> = {
  unread: "rose",
  "original-lost": "gold",
  complete: "sage",
  "analysis-only": "stone",
};

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-subtle">
        {label}
      </p>
      <p className="mt-0.5 text-[0.86rem] font-semibold text-strong">{value}</p>
    </div>
  );
}

export default async function LibraryBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFounder();
  const { id } = await params;
  const book = await readLibraryBook(decodeURIComponent(id));
  if (!book) notFound();

  const todo = SHELF_STATUS_TODO[book.status];
  const coverage = dimensionCoverage(book.analysis);
  const sections = book.analysis ? readAnalysis(book.analysis) : [];

  return (
    <div>
      <Link
        href="/admin/library"
        className="inline-flex items-center gap-1 text-[0.8rem] font-semibold text-[var(--clay-600)] hover:underline"
      >
        Back to the shelf
      </Link>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row">
        <div className="w-[172px] shrink-0">
          <BookCover book={book} />
          {book.originalUrl ? (
            <a
              href={book.originalUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block rounded-md border border-border-subtle bg-card px-3 py-2 text-center text-[0.78rem] font-bold text-[var(--clay-600)] hover:bg-page"
            >
              Open the original
            </a>
          ) : null}
          {book.originalBytes ? (
            <p className="mt-1.5 text-center text-[0.68rem] text-subtle">
              {formatBytes(book.originalBytes)}
              {book.extraFileCount > 0
                ? ` · ${book.extraFileCount} more ${book.extraFileCount === 1 ? "file" : "files"}`
                : ""}
            </p>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={STATUS_TONE[book.status]}>{SHELF_STATUS_LABEL[book.status]}</Pill>
            <Pill tone="outline">{book.kind}</Pill>
            {book.origin === "scrape" ? <Pill tone="stone">web scrape</Pill> : null}
          </div>

          <h1 className="mt-2 font-display text-[1.5rem] font-bold leading-tight text-strong">
            {book.title}
          </h1>
          {book.series ? (
            <p className="mt-0.5 text-[0.88rem] text-muted">{book.series}</p>
          ) : null}

          {todo ? (
            <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--clay-200)] bg-[var(--clay-50)] px-3.5 py-3">
              <p className="text-[0.82rem] font-bold text-[var(--clay-700)]">{todo}</p>
              <p className="mt-1 text-[0.8rem] text-[var(--clay-700)] opacity-90">
                {SHELF_STATUS_BLURB[book.status]}
              </p>
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Fact label="Dropped by" value={book.droppedBy} />
            <Fact label="Dropped" value={book.droppedAt?.slice(0, 10) ?? "unknown"} />
            {book.publisher ? <Fact label="Publisher" value={book.publisher} /> : null}
            {book.subject ? <Fact label="Subject" value={book.subject} /> : null}
            {book.gradeLevel ? <Fact label="Grade" value={book.gradeLevel} /> : null}
            {book.format ? <Fact label="Format" value={book.format} /> : null}
            {book.pageCount ? <Fact label="Pages" value={String(book.pageCount)} /> : null}
          </div>

          <div className="mt-5">
            <p className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-subtle">
              What was extracted
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {coverage.map((dimension) => (
                <span
                  key={dimension.label}
                  className={
                    dimension.present
                      ? "rounded-pill bg-[var(--sage-50)] px-2.5 py-0.5 text-[0.72rem] font-bold text-[var(--sage-700)]"
                      : "rounded-pill border border-dashed border-border px-2.5 py-0.5 text-[0.72rem] font-semibold text-subtle line-through"
                  }
                  title={
                    dimension.present
                      ? `${dimension.label} was analysed`
                      : `${dimension.label} was never filled in`
                  }
                >
                  {dimension.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {book.analysis ? (
        <>
          <div className="mt-8">
            <ReadableTree nodes={sections} />
          </div>
          <details className="mt-6 rounded-[var(--radius-md)] border border-border-subtle bg-card px-4 py-3">
            <summary className="cursor-pointer text-[0.8rem] font-bold text-muted [&::-webkit-details-marker]:hidden">
              The raw analysis file
            </summary>
            <pre className="mt-3 overflow-x-auto rounded-md bg-page p-3 font-mono text-[0.7rem] leading-relaxed text-body">
              {JSON.stringify(book.analysis, null, 2)}
            </pre>
          </details>
        </>
      ) : (
        <EmptyNote>
          Nothing was ever extracted from this file. The bytes reached Blob and the ingestion
          skill never ran on them, so there is no analysis to show. Running
          reference-ingestion (or curriculum-ingestion, for a full curriculum) on the original
          above is all this needs.
        </EmptyNote>
      )}
    </div>
  );
}
