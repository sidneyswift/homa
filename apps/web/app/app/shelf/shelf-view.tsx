"use client";

import { upload } from "@vercel/blob/client";
import { BookMarked, Camera, ImageIcon, Plus, Trash2, X } from "lucide-react";
import { useCallback, useRef, useState, useTransition } from "react";
import Image from "next/image";

import { prepareChildPhotoForUpload } from "../../../lib/child-photo-prepare";
import { addShelfBook, removeShelfBook, type ShelfBook } from "./actions";

/**
 * ShelfView: the family's bookshelf. Grid of book cards with cover
 * images, an "Add a book" flow with photo upload, and remove/archive.
 * Follows the Binder pattern: warm earthy palette, rounded cards,
 * pill buttons.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type AddStep = "idle" | "photos" | "details" | "saving";

interface StagedPhoto {
  previewUrl: string;
  blobUrl: string | null;
  status: "uploading" | "ready" | "failed";
}

/* ------------------------------------------------------------------ */
/*  Photo upload helper                                               */
/* ------------------------------------------------------------------ */

async function uploadPhoto(
  file: File,
  familyId: string,
  slot: "cover" | "toc",
): Promise<string> {
  let payload: Blob = file;
  let mediaType = file.type || "image/jpeg";
  const pathName = `${slot}.jpg`;

  if (file.type.startsWith("image/")) {
    const prepared = await prepareChildPhotoForUpload(file);
    if (prepared) {
      payload = prepared;
      mediaType = "image/jpeg";
    }
  }

  const result = await upload(
    `families/${familyId}/shelf/${pathName}`,
    payload,
    {
      access: "public",
      handleUploadUrl: "/api/shelf/upload",
      clientPayload: mediaType,
      contentType: mediaType,
    },
  );
  return result.url;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ShelfView({
  books: initialBooks,
  familyId,
}: {
  books: ShelfBook[];
  familyId: string;
}) {
  const [books, setBooks] = useState(initialBooks);
  const [addStep, setAddStep] = useState<AddStep>("idle");
  const [cover, setCover] = useState<StagedPhoto | null>(null);
  const [toc, setToc] = useState<StagedPhoto | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const coverInputRef = useRef<HTMLInputElement>(null);
  const tocInputRef = useRef<HTMLInputElement>(null);
  const coverCameraRef = useRef<HTMLInputElement>(null);
  const tocCameraRef = useRef<HTMLInputElement>(null);

  /* -- Photo pick handlers -- */

  const handlePhotoPick = useCallback(
    (files: FileList | null, slot: "cover" | "toc") => {
      const file = files?.[0];
      if (!file) return;

      const previewUrl = URL.createObjectURL(file);
      const staged: StagedPhoto = { previewUrl, blobUrl: null, status: "uploading" };
      const setter = slot === "cover" ? setCover : setToc;
      setter(staged);

      void uploadPhoto(file, familyId, slot)
        .then((blobUrl) => {
          setter({ previewUrl, blobUrl, status: "ready" });
        })
        .catch(() => {
          setter({ previewUrl, blobUrl: null, status: "failed" });
        });
    },
    [familyId],
  );

  /* -- Reset the add flow -- */

  const resetAdd = useCallback(() => {
    if (cover?.previewUrl) URL.revokeObjectURL(cover.previewUrl);
    if (toc?.previewUrl) URL.revokeObjectURL(toc.previewUrl);
    setCover(null);
    setToc(null);
    setTitle("");
    setAuthor("");
    setNotes("");
    setError(null);
    setAddStep("idle");
  }, [cover, toc]);

  /* -- Save -- */

  const handleSave = useCallback(() => {
    if (!cover?.blobUrl || !title.trim()) return;
    setAddStep("saving");
    setError(null);

    startTransition(async () => {
      const result = await addShelfBook({
        title: title.trim(),
        author: author.trim() || undefined,
        coverUrl: cover.blobUrl!,
        tocUrl: toc?.blobUrl || undefined,
        notes: notes.trim() || undefined,
      });

      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        setAddStep("details");
        return;
      }

      // Optimistically add the book to the local list
      const newBook: ShelfBook = {
        id: crypto.randomUUID(),
        familyId,
        title: title.trim(),
        author: author.trim() || null,
        coverUrl: cover.blobUrl!,
        tocUrl: toc?.blobUrl || null,
        notes: notes.trim() || null,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setBooks((prev) => [newBook, ...prev]);
      resetAdd();
    });
  }, [cover, toc, title, author, notes, familyId, resetAdd]);

  /* -- Remove -- */

  const handleRemove = useCallback((bookId: string) => {
    setRemovingId(bookId);
    startTransition(async () => {
      const result = await removeShelfBook(bookId);
      if (result.ok) {
        setBooks((prev) => prev.filter((b) => b.id !== bookId));
      }
      setRemovingId(null);
    });
  }, []);

  /* -- Render -- */

  const canProceedToDetails =
    cover?.status === "ready";
  const canSave =
    canProceedToDetails && title.trim().length > 0 && addStep !== "saving";

  return (
    <>
      {/* Header */}
      <header>
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-subtle">
          Your reference library
        </p>
        <h1 className="mt-1.5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.015em] text-strong">
          Shelf
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted">
          Upload photos of the books and reference texts you use for
          homeschooling. Homa can reference them when building lessons and unit
          studies.
        </p>
      </header>

      {/* Add Book Flow */}
      {addStep !== "idle" ? (
        <div className="mt-6 rounded-[var(--radius-xl)] border border-border-subtle bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-strong">
              {addStep === "photos" ? "Add photos" : "Book details"}
            </h2>
            <button
              type="button"
              onClick={resetAdd}
              aria-label="Cancel"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-page hover:text-strong"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {addStep === "photos" ? (
            <>
              <p className="mt-2 text-sm text-muted">
                For best results, add a photo of the <strong>cover</strong> and
                the <strong>table of contents</strong>.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {/* Cover photo */}
                <div className="flex flex-col items-center gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-subtle">
                    Cover <span className="text-[var(--clay-400)]">*</span>
                  </p>
                  {cover ? (
                    <div className="relative aspect-[3/4] w-full max-w-[200px] overflow-hidden rounded-lg border border-border-subtle">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cover.previewUrl}
                        alt="Cover preview"
                        className={`h-full w-full object-cover ${cover.status === "uploading" ? "opacity-50" : ""}`}
                      />
                      {cover.status === "uploading" ? (
                        <span className="absolute inset-x-0 bottom-0 bg-[rgba(34,30,26,0.6)] py-1 text-center text-[10px] font-semibold text-white">
                          Uploading…
                        </span>
                      ) : null}
                      {cover.status === "failed" ? (
                        <span className="absolute inset-x-0 bottom-0 bg-danger py-1 text-center text-[10px] font-semibold text-white">
                          Upload failed — try again
                        </span>
                      ) : null}
                      <button
                        type="button"
                        aria-label="Remove cover photo"
                        onClick={() => {
                          URL.revokeObjectURL(cover.previewUrl);
                          setCover(null);
                        }}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(34,30,26,0.72)] text-white transition-colors hover:bg-[rgba(34,30,26,0.9)]"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex w-full max-w-[200px] flex-col gap-2">
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => handlePhotoPick(e.target.files, "cover")}
                      />
                      <input
                        ref={coverCameraRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        hidden
                        onChange={(e) => handlePhotoPick(e.target.files, "cover")}
                      />
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-default bg-page text-muted transition-colors hover:border-[var(--clay-300)] hover:text-body"
                      >
                        <ImageIcon size={28} aria-hidden="true" />
                        <span className="text-xs font-medium">Choose photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => coverCameraRef.current?.click()}
                        className="flex items-center justify-center gap-1.5 rounded-pill border border-border-default bg-card px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-[var(--clay-300)] hover:text-body"
                      >
                        <Camera size={14} aria-hidden="true" />
                        Take a photo
                      </button>
                    </div>
                  )}
                </div>

                {/* TOC photo */}
                <div className="flex flex-col items-center gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-subtle">
                    Table of contents <span className="text-[var(--clay-300)]">(optional)</span>
                  </p>
                  {toc ? (
                    <div className="relative aspect-[3/4] w-full max-w-[200px] overflow-hidden rounded-lg border border-border-subtle">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={toc.previewUrl}
                        alt="Table of contents preview"
                        className={`h-full w-full object-cover ${toc.status === "uploading" ? "opacity-50" : ""}`}
                      />
                      {toc.status === "uploading" ? (
                        <span className="absolute inset-x-0 bottom-0 bg-[rgba(34,30,26,0.6)] py-1 text-center text-[10px] font-semibold text-white">
                          Uploading…
                        </span>
                      ) : null}
                      {toc.status === "failed" ? (
                        <span className="absolute inset-x-0 bottom-0 bg-danger py-1 text-center text-[10px] font-semibold text-white">
                          Upload failed — try again
                        </span>
                      ) : null}
                      <button
                        type="button"
                        aria-label="Remove table of contents photo"
                        onClick={() => {
                          URL.revokeObjectURL(toc.previewUrl);
                          setToc(null);
                        }}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(34,30,26,0.72)] text-white transition-colors hover:bg-[rgba(34,30,26,0.9)]"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex w-full max-w-[200px] flex-col gap-2">
                      <input
                        ref={tocInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => handlePhotoPick(e.target.files, "toc")}
                      />
                      <input
                        ref={tocCameraRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        hidden
                        onChange={(e) => handlePhotoPick(e.target.files, "toc")}
                      />
                      <button
                        type="button"
                        onClick={() => tocInputRef.current?.click()}
                        className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-default bg-page text-muted transition-colors hover:border-[var(--clay-300)] hover:text-body"
                      >
                        <ImageIcon size={28} aria-hidden="true" />
                        <span className="text-xs font-medium">Choose photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => tocCameraRef.current?.click()}
                        className="flex items-center justify-center gap-1.5 rounded-pill border border-border-default bg-card px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-[var(--clay-300)] hover:text-body"
                      >
                        <Camera size={14} aria-hidden="true" />
                        Take a photo
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  disabled={!canProceedToDetails}
                  onClick={() => setAddStep("details")}
                  className="rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            /* Details step */
            <>
              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <label
                    htmlFor="shelf-title"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-subtle"
                  >
                    Title <span className="text-[var(--clay-400)]">*</span>
                  </label>
                  <input
                    id="shelf-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Story of the World, Vol. 1"
                    maxLength={200}
                    className="w-full rounded-lg border border-border-default bg-page px-3.5 py-2.5 text-sm text-body outline-none placeholder:text-subtle focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label
                    htmlFor="shelf-author"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-subtle"
                  >
                    Author <span className="text-[var(--clay-300)]">(optional)</span>
                  </label>
                  <input
                    id="shelf-author"
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="e.g. Susan Wise Bauer"
                    maxLength={200}
                    className="w-full rounded-lg border border-border-default bg-page px-3.5 py-2.5 text-sm text-body outline-none placeholder:text-subtle focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label
                    htmlFor="shelf-notes"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-subtle"
                  >
                    Notes <span className="text-[var(--clay-300)]">(optional)</span>
                  </label>
                  <textarea
                    id="shelf-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes about how you use this book"
                    maxLength={2000}
                    rows={2}
                    className="w-full rounded-lg border border-border-default bg-page px-3.5 py-2.5 text-sm text-body outline-none placeholder:text-subtle focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              {error ? (
                <p className="mt-3 text-sm text-danger">{error}</p>
              ) : null}

              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setAddStep("photos")}
                  className="rounded-pill border border-border-default bg-card px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-body"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={handleSave}
                  className="rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addStep === "saving" ? "Adding…" : "Add to shelf"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Book Grid */}
      {books.length === 0 && addStep === "idle" ? (
        <div className="mt-8 rounded-[var(--radius-xl)] border border-dashed border-border-default bg-card p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
            <BookMarked size={26} className="text-brand" aria-hidden="true" />
          </div>
          <p className="mt-4 font-display text-lg font-semibold text-strong">
            Your shelf is empty.
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            Add the books and reference texts you use for homeschooling.
            Homa will use them to build better lessons tailored to your
            curriculum.
          </p>
          <button
            type="button"
            onClick={() => setAddStep("photos")}
            className="mt-5 inline-flex items-center gap-2 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
          >
            <Plus size={16} aria-hidden="true" />
            Add your first book
          </button>
        </div>
      ) : (
        <section className="mt-7">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-strong">
              On your shelf
            </h2>
            <span className="text-xs text-subtle">
              {books.length} {books.length === 1 ? "book" : "books"}
            </span>
          </div>

          <div className="mt-4 grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {/* Add book card */}
            {addStep === "idle" ? (
              <button
                type="button"
                onClick={() => setAddStep("photos")}
                className="group flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-[var(--radius-xl)] border-2 border-dashed border-border-default bg-card transition-colors hover:border-[var(--clay-300)] hover:bg-page"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft transition-colors group-hover:bg-brand-soft">
                  <Plus
                    size={20}
                    className="text-brand"
                    aria-hidden="true"
                  />
                </div>
                <span className="text-sm font-medium text-muted group-hover:text-body">
                  Add a book
                </span>
              </button>
            ) : null}

            {/* Book cards */}
            {books.map((book) => (
              <div
                key={book.id}
                className="group relative overflow-hidden rounded-[var(--radius-xl)] border border-border-subtle bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="aspect-[3/4] overflow-hidden bg-page">
                  <Image
                    src={book.coverUrl}
                    alt={`Cover of ${book.title}`}
                    width={240}
                    height={320}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-strong">
                    {book.title}
                  </p>
                  {book.author ? (
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {book.author}
                    </p>
                  ) : null}
                </div>
                {/* Remove button (visible on hover / always on touch) */}
                <button
                  type="button"
                  aria-label={`Remove ${book.title}`}
                  disabled={removingId === book.id || isPending}
                  onClick={() => handleRemove(book.id)}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(34,30,26,0.6)] text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[rgba(34,30,26,0.85)] focus:opacity-100 disabled:opacity-50"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
