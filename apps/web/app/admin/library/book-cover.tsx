import { ShelfCover } from "../../../components/library/shelf-cover";
import type { LibraryBook } from "../../../lib/materials/library-shelf";

/**
 * One book's cover on the library shelf.
 *
 * Two paths. A record whose original bytes survive has a real cover in
 * Blob at inspo-covers/<id>.jpg, page 1 of the actual PDF a co-founder
 * dropped, generated once by scripts/backfill-library-covers.mts. A
 * record with no original gets a designed cover instead (founder
 * direction 2026-07-31, "if there is not covers, make general ones"),
 * built from the metadata we do hold: subject picks the cloth colour,
 * the title sets in the serif, the publisher and format sit where a
 * real book puts them.
 *
 * The designed cover is deliberately a book and not a grey placeholder.
 * A shelf where a third of the spines are empty rectangles reads as
 * broken software; a shelf of real and designed covers reads as a
 * library that knows what it holds.
 */

export function BookCover({ book }: { book: LibraryBook }) {
  return (
    <ShelfCover
      title={book.title}
      publisher={book.publisher}
      series={book.series}
      subject={book.subject}
      footer={book.format ?? book.kind}
      imageUrl={book.coverUrl}
    />
  );
}
