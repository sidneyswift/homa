"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";

import { prepareChildPhotoForUpload } from "../../../../lib/child-photo-prepare";
import { keptAudioNote } from "../../../../lib/lessons/keep-audio";

/**
 * The review page's client slivers (plan 2026-07-13-lesson-listen.md
 * §4.6): the narrative-status-style poll while Homa listens, the
 * retry button on honest failure, and the forever "Add photos"
 * affordance. The heavy render stays on the server page.
 */

export function LessonStatusPoll({
  lessonId,
  initialTranscribed,
  initialTotal,
}: {
  lessonId: string;
  initialTranscribed: number;
  initialTotal: number;
}) {
  const router = useRouter();
  const [transcribed, setTranscribed] = useState(initialTranscribed);
  const [total, setTotal] = useState(initialTotal);

  useEffect(() => {
    let stopped = false;
    const interval = setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/lessons/${lessonId}/status`);
          if (!response.ok) return;
          const payload = (await response.json()) as {
            status?: string;
            segmentCount?: number;
            transcribedCount?: number;
          };
          if (stopped) return;
          setTotal(payload.segmentCount ?? 0);
          setTranscribed(payload.transcribedCount ?? 0);
          if (payload.status === "ready" || payload.status === "failed") {
            router.refresh();
          }
        } catch {
          // A missed poll is fine; the next tick tries again.
        }
      })();
    }, 10_000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [lessonId, router]);

  return (
    <p className="mt-2 text-sm text-muted" aria-live="polite">
      {total > 0
        ? `Listened through about ${transcribed * 3} of ${total * 3} minutes so far.`
        : "Getting the recording ready."}
    </p>
  );
}

export function RetryLessonAnalysis({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void fetch(`/api/lessons/${lessonId}/finish`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        })
          .then(() => router.refresh())
          .finally(() => setPending(false));
      }}
      className="mt-3 min-h-10 cursor-pointer rounded-pill bg-brand px-5 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
    >
      {pending ? "Homa is trying again\u2026" : "Have Homa try again"}
    </button>
  );
}

/**
 * The keep-their-voice notice: Homa kept this recording without being
 * asked, so the parent is told, and the undo lives in the same box as
 * the news. Two taps rather than one, deliberately: this is the only
 * irreversible control on the page, and the copy is the only place the
 * consequence ("the audio goes, the write-up stays") is stated.
 */
export function KeptAudioNotice({
  lessonId,
  childName,
  day,
}: {
  lessonId: string;
  childName: string;
  day: string;
}) {
  const router = useRouter();
  const note = keptAudioNote(childName, day);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [gone, setGone] = useState(false);

  if (gone) {
    return (
      <section
        aria-label="Recording"
        className="mt-4 rounded-lg border border-border-subtle bg-card p-5"
      >
        <p className="text-sm text-body">
          The recording is deleted. Everything Homa wrote about the
          lesson is still here.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Recording"
      className="mt-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm"
    >
      <p className="font-display text-base font-semibold text-strong">
        {note.heading}
      </p>
      <p className="mt-1 text-sm text-body">{note.body}</p>
      {confirming ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void fetch(`/api/lessons/${lessonId}/audio`, {
                method: "DELETE",
              })
                .then((response) => {
                  if (response.ok) setGone(true);
                  router.refresh();
                })
                .finally(() => setPending(false));
            }}
            className="min-h-10 cursor-pointer rounded-pill bg-brand px-5 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Yes, delete the recording"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="min-h-10 cursor-pointer text-sm font-medium text-muted underline underline-offset-4"
          >
            Keep it
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 min-h-10 cursor-pointer text-sm font-medium text-muted underline underline-offset-4"
        >
          {note.action}
        </button>
      )}
    </section>
  );
}

export function AddLessonPhotos({
  familyId,
  lessonId,
}: {
  familyId: string;
  lessonId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPhoto = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setError(null);
      setPending(true);
      try {
        const prepared = await prepareChildPhotoForUpload(file);
        if (!prepared) {
          setError("That photo didn't open. Try a different one.");
          return;
        }
        const result = await upload(
          `families/${familyId}/lessons/${lessonId}/photo-${Date.now()}.jpg`,
          prepared,
          {
            access: "public",
            handleUploadUrl: "/api/lessons/upload",
            clientPayload: "image/jpeg",
            contentType: "image/jpeg",
          },
        );
        const response = await fetch(`/api/lessons/${lessonId}/media`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            blobUrl: result.url,
            contentType: "image/jpeg",
            capturedDuringSeq: null,
          }),
        });
        const payload = (await response.json()) as { ok: boolean; reason?: string };
        if (!payload.ok) {
          setError(
            payload.reason === "media-cap"
              ? "This lesson holds twelve photos, and it's full."
              : "That photo didn't save. Try once more.",
          );
          return;
        }
        router.refresh();
      } catch {
        setError("That photo didn't save. Try once more.");
      } finally {
        setPending(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [familyId, lessonId, router],
  );

  return (
    <div className="mt-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(event) => void addPhoto(event.target.files?.[0] ?? null)}
        className="sr-only"
        aria-label="Add a photo to this lesson"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="min-h-9 cursor-pointer rounded-pill border border-border bg-card px-4 py-1.5 text-sm font-medium text-body transition-colors hover:border-brand disabled:opacity-60"
      >
        {pending ? "Adding\u2026" : "Add photos"}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
