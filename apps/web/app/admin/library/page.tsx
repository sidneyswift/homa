import type { Metadata } from "next";
import Link from "next/link";

import { requireFounder } from "../../../lib/admin/gate";
import { readLibrary } from "../../../lib/admin/library-data";
import {
  needsWork,
  SHELF_STATUS_BLURB,
  SHELF_STATUS_LABEL,
  SHELF_STATUS_ORDER,
  SHELF_STATUS_TODO,
  type LibraryBook,
  type ShelfStatus,
} from "../../../lib/materials/library-shelf";
import { EmptyNote, Pill, SectionHead } from "../ui";
import { BookCover } from "./book-cover";

/**
 * /admin/library: the bookshelf. Founder ask 2026-07-31, verbatim: "we
 * upload things from homa-inspo but have a hard time seeing (as a
 * human) what has been uploaded, and what the extraction results and
 * metadata are."
 *
 * So the page answers two questions and nothing else. What do we have,
 * shown as covers rather than a table, because a shelf is legible at a
 * glance and a list of 240 slugs is not. And what is missing, shown as
 * its own shelf section with a plain-English to-do, because the drops
 * Cosmo silently skipped are exactly the ones that cannot be seen today
 * (founder direction, same day: mark what needs doing rather than
 * attempting recovery here).
 *
 * Shelves are ordered worst first. A founder should land on the
 * problems, not scroll past 150 finished books to reach them.
 */

export const metadata: Metadata = { title: "Library" };

const STATUS_TONE: Record<ShelfStatus, "rose" | "gold" | "sage" | "stone"> = {
  unread: "rose",
  "original-lost": "gold",
  "awaiting-source": "stone",
  complete: "sage",
  "analysis-only": "stone",
};

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}

function BookTile({ book }: { book: LibraryBook }) {
  const todo = SHELF_STATUS_TODO[book.status];
  return (
    <Link
      href={`/admin/library/${encodeURIComponent(book.id)}`}
      className="group block rounded-[var(--radius-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay-500)]"
    >
      <div className="transition-transform duration-150 group-hover:-translate-y-1">
        <BookCover book={book} />
      </div>
      <p className="mt-2 line-clamp-2 text-[0.78rem] font-semibold leading-snug text-strong">
        {book.title}
      </p>
      <p className="mt-0.5 line-clamp-1 text-[0.7rem] text-subtle">
        {book.droppedBy}
        {book.droppedAt ? ` · ${book.droppedAt.slice(0, 10)}` : ""}
      </p>
      {todo ? (
        <p className="mt-1 line-clamp-1 text-[0.68rem] font-semibold text-[var(--clay-600)]">
          {todo}
        </p>
      ) : null}
    </Link>
  );
}

function Shelf({ books }: { books: LibraryBook[] }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {books.map((book) => (
        <BookTile key={book.id} book={book} />
      ))}
    </div>
  );
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireFounder();
  const { status, q } = await searchParams;
  const { books, counts, blobReachable } = await readLibrary();

  const query = (q ?? "").trim().toLowerCase();
  const filtered = books.filter((book) => {
    if (status && book.status !== status) return false;
    if (!query) return true;
    return [book.title, book.publisher, book.subject, book.droppedBy, book.id]
      .filter(Boolean)
      .some((field) => (field as string).toLowerCase().includes(query));
  });

  const activeStatus = SHELF_STATUS_ORDER.includes(status as ShelfStatus)
    ? (status as ShelfStatus)
    : null;

  return (
    <div>
      <SectionHead
        eyebrow="Corpus"
        title="Library"
        sub="Every reference and curriculum we have ingested, as a shelf. Covers are page one of the real file where we still have it, and a designed cover where we do not."
      />

      {!blobReachable ? (
        <EmptyNote>
          Blob is unreachable from here, so no book can show its original file or its real
          cover. Every book below is drawn from its analysis JSON alone. This is a
          configuration problem on this deployment, not a corpus problem.
        </EmptyNote>
      ) : null}

      {/* The filter row carries every count, so the only numbers worth
          stating separately are the ones it cannot: what we physically
          hold, and how much of the shelf shows a real cover. */}
      <p className="mt-3 text-[0.78rem] text-subtle">
        {formatBytes(counts.originalBytes)} of originals held · {counts.withCover} real covers,{" "}
        {counts.total - counts.withCover} designed
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href="/admin/library"
          className={
            activeStatus === null
              ? "rounded-pill bg-brand-soft px-3 py-1 text-[0.75rem] font-bold text-[var(--clay-700)]"
              : "rounded-pill border border-border-subtle px-3 py-1 text-[0.75rem] font-semibold text-muted hover:bg-page"
          }
        >
          All {counts.total}
        </Link>
        {SHELF_STATUS_ORDER.map((value) => (
          <Link
            key={value}
            href={`/admin/library?status=${value}`}
            className={
              activeStatus === value
                ? "rounded-pill bg-brand-soft px-3 py-1 text-[0.75rem] font-bold text-[var(--clay-700)]"
                : "rounded-pill border border-border-subtle px-3 py-1 text-[0.75rem] font-semibold text-muted hover:bg-page"
            }
          >
            {SHELF_STATUS_LABEL[value]} {counts.byStatus[value]}
          </Link>
        ))}
      </div>

      <form method="get" className="mt-3">
        {activeStatus ? <input type="hidden" name="status" value={activeStatus} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search title, publisher, subject, or who dropped it"
          aria-label="Search the library"
          className="w-full max-w-md rounded-md border border-border-subtle bg-card px-3 py-2 text-sm text-body placeholder:text-subtle focus:border-[var(--clay-400)] focus:outline-none"
        />
      </form>

      {filtered.length === 0 ? (
        <EmptyNote>Nothing on the shelf matches that.</EmptyNote>
      ) : activeStatus || query ? (
        <>
          <p className="mt-6 text-[0.8rem] text-muted">
            {filtered.length} {filtered.length === 1 ? "book" : "books"}
            {activeStatus ? ` · ${SHELF_STATUS_BLURB[activeStatus]}` : ""}
          </p>
          <Shelf books={filtered} />
        </>
      ) : (
        SHELF_STATUS_ORDER.map((value) => {
          const shelf = filtered.filter((book) => book.status === value);
          if (shelf.length === 0) return null;
          return (
            <section key={value} className="mt-9">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="font-display text-[1.05rem] font-bold text-strong">
                  {SHELF_STATUS_LABEL[value]}
                </h3>
                <Pill tone={STATUS_TONE[value]}>{shelf.length}</Pill>
                {needsWork(value) ? <Pill tone="outline">{SHELF_STATUS_TODO[value]}</Pill> : null}
              </div>
              <p className="mt-1 max-w-2xl text-[0.82rem] text-muted">
                {SHELF_STATUS_BLURB[value]}
              </p>
              <Shelf books={shelf} />
            </section>
          );
        })
      )}
    </div>
  );
}
