"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";

import { prepareChildPhotoForUpload } from "../../../../lib/child-photo-prepare";
import { keptAudioNote } from "../../../../lib/lessons/keep-audio";
import { requestLessonReviewRetry } from "../../../../lib/lessons/retry-client";
import { QuietAction } from "../../../../components/design/QuietAction";

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
    <p className="mt-2 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]" aria-live="polite">
      {total > 0
        ? `Listened through about ${transcribed * 3} of ${total * 3} minutes so far.`
        : "Getting the recording ready."}
    </p>
  );
}

export function RetryLessonAnalysis({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <QuietAction
        kind="primary"
        size="default"
        disabled={pending}
        onClick={() => {
          setPending(true);
          setMessage(null);
          void (async () => {
            const result = await requestLessonReviewRetry(fetch, lessonId);
            if (result.status === "refresh") {
              router.refresh();
            } else {
              setMessage(result.message);
            }
            setPending(false);
          })();
        }}
        className="mt-3 px-5 text-sm"
      >
        {pending ? "Homa is trying again\u2026" : "Have Homa try again"}
      </QuietAction>
      {message ? (
        <p role="alert" className="mt-3 text-sm text-[color:var(--homa-error-ink)]">
          {message}
        </p>
      ) : null}
    </div>
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
        className="quiet-frame quiet-frame--paper mt-4 p-5"
      >
        <p className="text-sm text-[color:var(--homa-ink)]">
          The recording is deleted. Everything Homa wrote about the
          lesson is still here.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Recording"
      className="quiet-frame quiet-frame--paper mt-4 p-5"
    >
      <p className="font-display text-base font-semibold text-[color:var(--homa-ink)]">
        {note.heading}
      </p>
      <p className="mt-1 text-sm text-[color:var(--homa-ink)]">{note.body}</p>
      {confirming ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <QuietAction
            kind="primary"
            size="default"
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
            className="px-5 text-sm"
          >
            {pending ? "Deleting…" : "Yes, delete the recording"}
          </QuietAction>
          <QuietAction
            kind="quiet"
            size="default"
            onClick={() => setConfirming(false)}
            className="text-sm underline underline-offset-4"
          >
            Keep it
          </QuietAction>
        </div>
      ) : (
        <QuietAction
          kind="quiet"
          size="default"
          onClick={() => setConfirming(true)}
          className="mt-3 text-sm underline underline-offset-4"
        >
          {note.action}
        </QuietAction>
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
      <QuietAction
        kind="secondary"
        size="default"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="px-4 text-sm"
      >
        {pending ? "Adding\u2026" : "Add photos"}
      </QuietAction>
      {error ? (
        <p className="mt-2 text-sm text-[color:var(--homa-error-ink)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
