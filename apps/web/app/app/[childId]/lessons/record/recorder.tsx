"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { uploadPresigned } from "@vercel/blob/client";

import { prepareChildPhotoForUpload } from "../../../../../lib/child-photo-prepare";
import { KidAvatar } from "../../../../../components/dashboard/kid-avatar";
import { agreeLessonAudioConsentAction } from "./actions";

/**
 * The lesson recorder (plan 2026-07-13-lesson-listen.md §4.2). Built
 * to make a 45-minute phone recording survivable:
 *
 *   segments · MediaRecorder stops and restarts every 3 minutes, so
 *     every segment is a standalone file, uploaded the moment it
 *     closes. A crash loses at most the current segment.
 *   wake lock · the screen stays awake while recording, re-acquired
 *     whenever the tab comes back, and the UI says so honestly.
 *   photos · the camera button uploads a worksheet photo without
 *     stopping the lesson; on iOS the camera may pause listening for
 *     a moment, and the segment boundary keeps that gap bounded.
 *   fallback · "already recorded it?" takes a file from the phone's
 *     own recorder app into the same pipeline.
 *
 * MIME fallback chain copied from dictation.tsx (the shipped voice
 * surface): webm+opus, webm, then mp4 for iOS Safari. Both containers
 * are in transcribe.ts's extension map.
 */

const SEGMENT_SECONDS = 180;

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
] as const;

// Reworded through both copy gates (2026-07-13 late night). Reader
// gate: kitchen-table privacy terms, an honest word about other kids
// in the room, transcript permanence next to the delete promise.
// Editor gate: one name per concept (Homa listens, the recording is
// the recording), one idea per sentence, no trust-me intensifiers.
// Every commitment is enforced in code: the DELETE route removes
// recording, transcript, and review together.
function consentCommitments(childName: string): string[] {
  return [
    `Homa uses recordings for one thing: this lesson's review and ${childName}'s progress. Nothing else.`,
    "Homa works under contracts that forbid learning from your recordings.",
    "The recording deletes itself after 30 days. The written transcript and review stay with the lesson, and you can read both any time.",
    "Homa never identifies anyone by voice. If another child is in the room, the review can say someone else was there, and that is all.",
    "Delete a lesson any time. That removes the recording, the transcript, and the review. The progress it added stays until you change it in chat.",
  ];
}

function pickMimeType(): string {
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

function fileExtension(mimeType: string): string {
  return mimeType.includes("mp4") ? "m4a" : "webm";
}

type RecorderPhase = "idle" | "recording" | "finishing" | "uploading_file";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

export interface RecorderKidOption {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Position in the family list (drives the avatar tone). */
  index: number;
}

export function LessonRecorder({
  childId,
  childName,
  kids,
  consentGranted,
  openLessonId,
}: {
  childId: string;
  childName: string;
  /** Every kid in the family; multi-kid families get the switcher. */
  kids: RecorderKidOption[];
  consentGranted: boolean;
  openLessonId: string | null;
}) {
  const router = useRouter();
  const [consentedNow, setConsentedNow] = useState(false);
  const [consentPending, setConsentPending] = useState(false);
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [uploadedSegments, setUploadedSegments] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resumeOffer, setResumeOffer] = useState(openLessonId);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lessonIdRef = useRef<string | null>(null);
  const uploadPrefixRef = useRef<string | null>(null);
  const seqRef = useRef(1);
  const mimeRef = useRef("");
  const segmentStartedAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const phaseRef = useRef<RecorderPhase>("idle");
  const uploadsRef = useRef<Promise<void>[]>([]);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const consented = consentGranted || consentedNow;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const acquireWakeLock = useCallback(async () => {
    try {
      const wakeLock = (
        navigator as Navigator & {
          wakeLock?: { request: (kind: "screen") => Promise<WakeLockSentinelLike> };
        }
      ).wakeLock;
      if (wakeLock) {
        wakeLockRef.current = await wakeLock.request("screen");
      }
    } catch {
      // No wake lock is survivable: segments bound the loss either way.
    }
  }, []);

  const uploadSegment = useCallback(
    (seq: number, blob: Blob, durationSeconds: number) => {
      const lessonId = lessonIdRef.current;
      const uploadPrefix = uploadPrefixRef.current;
      if (!lessonId || !uploadPrefix || blob.size === 0) return;
      const mimeType = mimeRef.current || "audio/webm";
      const task = (async () => {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const result = await uploadPresigned(
              `${uploadPrefix}segment-${String(seq).padStart(4, "0")}.${fileExtension(mimeType)}`,
              blob,
              {
                access: "private",
                handleUploadUrl: "/api/lessons/upload",
                clientPayload: mimeType,
                contentType: mimeType,
              },
            );
            await fetch(`/api/lessons/${lessonId}/segments`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                seq,
                blobUrl: result.url,
                contentType: mimeType,
                durationSeconds,
              }),
            });
            setUploadedSegments((count) => count + 1);
            return;
          } catch {
            // One quiet retry; after that the finish pass and the
            // hourly sweep own recovery for registered segments, and
            // an unregistered one surfaces in the honest counter.
          }
        }
      })();
      uploadsRef.current.push(task);
    },
    [],
  );

  // onstop restarts the next segment through this ref, which breaks
  // the self-reference a rotating recorder otherwise needs.
  const startSegmentRef = useRef<() => void>(() => undefined);

  const startSegmentRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = mimeRef.current;
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : { audioBitsPerSecond: 32_000 },
    );
    chunksRef.current = [];
    segmentStartedAtRef.current = Date.now();
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const seq = seqRef.current;
      const blob = new Blob(chunksRef.current, {
        type: mimeType || "audio/webm",
      });
      const durationSeconds = Math.round(
        (Date.now() - segmentStartedAtRef.current) / 1000,
      );
      uploadSegment(seq, blob, durationSeconds);
      if (phaseRef.current === "recording") {
        seqRef.current = seq + 1;
        startSegmentRef.current();
      }
    };
    recorderRef.current = recorder;
    recorder.start();
  }, [uploadSegment]);

  useEffect(() => {
    startSegmentRef.current = startSegmentRecorder;
  }, [startSegmentRecorder]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/lessons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ childId, source: "recorder" }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        lessonId?: string;
        uploadPrefix?: string;
        reason?: string;
      };
      if (!payload.ok || !payload.lessonId || !payload.uploadPrefix) {
        setError(
          payload.reason === "daily-cap"
            ? "Six lessons in a day is Homa's current limit. Tomorrow opens more."
            : "That didn't start. Give it another try.",
        );
        return;
      }
      lessonIdRef.current = payload.lessonId;
      uploadPrefixRef.current = payload.uploadPrefix;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mimeRef.current = pickMimeType();
      seqRef.current = 1;
      startedAtRef.current = Date.now();
      setSeconds(0);
      setUploadedSegments(0);
      setPhotoCount(0);
      setPhase("recording");
      phaseRef.current = "recording";
      startSegmentRecorder();
      await acquireWakeLock();
    } catch {
      setError(
        "Homa couldn't reach the microphone. Check the mic permission and try again.",
      );
    }
  }, [childId, startSegmentRecorder, acquireWakeLock]);

  const finishRecording = useCallback(async () => {
    const lessonId = lessonIdRef.current;
    if (!lessonId) return;
    setPhase("finishing");
    phaseRef.current = "finishing";
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    await wakeLockRef.current?.release().catch(() => undefined);

    // The last segment's upload starts inside onstop; give the queue a
    // moment, then hand off. The finish route and the sweep transcribe
    // whatever registered, so waiting longer buys nothing.
    await Promise.race([
      Promise.allSettled(uploadsRef.current),
      new Promise((resolve) => setTimeout(resolve, 20_000)),
    ]);
    const durationSeconds = Math.round(
      (Date.now() - startedAtRef.current) / 1000,
    );
    void fetch(`/api/lessons/${lessonId}/finish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ durationSeconds }),
    });
    router.push(`/app/lessons/${lessonId}`);
  }, [router]);

  // Screen lock and app switches suspend the mic on phones. Closing
  // the segment on hide and opening a fresh one on return turns an
  // interruption into a bounded gap instead of a broken lesson.
  useEffect(() => {
    function onVisibilityChange() {
      if (phaseRef.current !== "recording") return;
      const recorder = recorderRef.current;
      if (document.visibilityState === "hidden") {
        if (recorder && recorder.state === "recording") recorder.stop();
      } else {
        void acquireWakeLock();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [acquireWakeLock]);

  // The clock, and the 3-minute segment rotation.
  useEffect(() => {
    if (phase !== "recording") return;
    const interval = setInterval(() => {
      setSeconds(Math.round((Date.now() - startedAtRef.current) / 1000));
      const recorder = recorderRef.current;
      if (
        recorder &&
        recorder.state === "recording" &&
        Date.now() - segmentStartedAtRef.current >= SEGMENT_SECONDS * 1000
      ) {
        recorder.stop();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const addPhoto = useCallback(
    async (file: File | null) => {
      const lessonId = lessonIdRef.current;
      const uploadPrefix = uploadPrefixRef.current;
      if (!file || !lessonId || !uploadPrefix) return;
      const prepared = await prepareChildPhotoForUpload(file);
      if (!prepared) {
        setError("That photo didn't open. Try taking it again.");
        return;
      }
      try {
        const result = await uploadPresigned(
          `${uploadPrefix}photo-${Date.now()}.jpg`,
          prepared,
          {
            access: "private",
            handleUploadUrl: "/api/lessons/upload",
            clientPayload: "image/jpeg",
            contentType: "image/jpeg",
          },
        );
        await fetch(`/api/lessons/${lessonId}/media`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            blobUrl: result.url,
            contentType: "image/jpeg",
            capturedDuringSeq:
              phaseRef.current === "recording" ? seqRef.current : null,
          }),
        });
        setPhotoCount((count) => count + 1);
      } catch {
        setError("That photo didn't save. The recording kept going.");
      } finally {
        if (photoInputRef.current) photoInputRef.current.value = "";
      }
    },
    [],
  );

  const uploadExistingFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setError(null);
      setPhase("uploading_file");
      try {
        const response = await fetch("/api/lessons", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ childId, source: "upload" }),
        });
        const payload = (await response.json()) as {
          ok: boolean;
          lessonId?: string;
          uploadPrefix?: string;
          reason?: string;
        };
        if (!payload.ok || !payload.lessonId || !payload.uploadPrefix) {
          setError(
            payload.reason === "daily-cap"
              ? "Six lessons in a day is Homa's current limit. Tomorrow opens more."
              : "That didn't start. Give it another try.",
          );
          setPhase("idle");
          return;
        }
        const lessonId = payload.lessonId;
        const mimeType = file.type || "audio/mp4";
        const durationSeconds = await readAudioDuration(file);
        const result = await uploadPresigned(
          `${payload.uploadPrefix}upload.${fileExtension(mimeType)}`,
          file,
          {
            access: "private",
            handleUploadUrl: "/api/lessons/upload",
            clientPayload: mimeType,
            contentType: mimeType,
          },
        );
        await fetch(`/api/lessons/${lessonId}/segments`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            seq: 1,
            blobUrl: result.url,
            contentType: mimeType,
            // Unknown duration still routes the long-file lane
            // (worker.ts isLikelyLongFile) instead of pulling a big
            // file through a function.
            durationSeconds: durationSeconds ?? 11 * 60,
          }),
        });
        void fetch(`/api/lessons/${lessonId}/finish`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ durationSeconds }),
        });
        router.push(`/app/lessons/${lessonId}`);
      } catch {
        setError("That file didn't come through. Try choosing it again.");
        setPhase("idle");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [childId, router],
  );

  function agree() {
    setConsentPending(true);
    void agreeLessonAudioConsentAction()
      .then((result) => {
        if (result.error) {
          setError(result.error);
          return;
        }
        setConsentedNow(true);
        router.refresh();
      })
      .finally(() => setConsentPending(false));
  }

  if (!consented) {
    return (
      <section className="mx-auto max-w-xl">
        <h1 className="font-display text-2xl font-semibold text-strong">
          One agreement before the first lesson
        </h1>
        <p className="mt-2 text-body">
          Lesson recordings include {childName}&apos;s voice. After you
          finish teaching, Homa listens and writes a review: what went
          well, where {childName} lit up or drifted, and ideas for next
          time. Short quotes from the lesson back up what it says.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-body">
          {consentCommitments(childName).map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden="true" className="text-brand">
                {"\u2022"}
              </span>
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={agree}
            disabled={consentPending}
            className="min-h-11 cursor-pointer rounded-pill bg-brand px-6 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {consentPending ? "Saving\u2026" : "I agree"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="min-h-11 cursor-pointer rounded-pill px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:text-strong"
          >
            Not now
          </button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return (
    <section className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-semibold text-strong">
        {phase === "recording"
          ? `Recording ${childName}'s lesson`
          : `Record a lesson with ${childName}`}
      </h1>

      {phase === "idle" ? (
        <>
          {/* Which kid this lesson is for (founder direction 2026-07-14):
              the kid page's own sibling switcher, one tap, replace
              navigation so the resume offer and lesson list stay scoped
              to the right kid. Locked once recording starts. */}
          {kids.length > 1 ? (
            <nav
              aria-label="Record for which kid"
              className="mt-3 flex flex-wrap gap-2"
            >
              {kids.map((kid) => {
                const current = kid.id === childId;
                return (
                  <Link
                    key={kid.id}
                    replace
                    href={`/app/${kid.id}/lessons/record`}
                    aria-current={current ? "page" : undefined}
                    className={
                      current
                        ? "inline-flex items-center gap-2 rounded-pill bg-brand-soft px-3.5 py-1.5 text-sm font-bold text-[var(--clay-700)]"
                        : "inline-flex items-center gap-2 rounded-pill border border-border-subtle bg-card px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:border-brand hover:text-body"
                    }
                  >
                    <KidAvatar
                      name={kid.name}
                      index={kid.index}
                      avatarUrl={kid.avatarUrl}
                      size={20}
                    />
                    {kid.name}
                  </Link>
                );
              })}
            </nav>
          ) : null}
          <p className="mt-2 text-body">
            Set the phone nearby, screen up, and teach like always. Homa
            listens and writes the review after you finish. Nothing
            interrupts the lesson.
          </p>
          {resumeOffer ? (
            <div className="mt-4 rounded-md border border-border bg-card p-4">
              <p className="text-sm text-body">
                A lesson from earlier is still open. What it recorded is
                saved.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const lessonId = resumeOffer;
                    setResumeOffer(null);
                    void fetch(`/api/lessons/${lessonId}/finish`, {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({}),
                    });
                    router.push(`/app/lessons/${lessonId}`);
                  }}
                  className="min-h-9 cursor-pointer rounded-pill border border-border bg-card px-4 py-1.5 text-sm font-medium text-body transition-colors hover:border-brand"
                >
                  Send it for review
                </button>
                <button
                  type="button"
                  onClick={() => setResumeOffer(null)}
                  className="min-h-9 cursor-pointer rounded-pill px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-strong"
                >
                  Start a new lesson
                </button>
              </div>
            </div>
          ) : null}
          {/* Who this lesson is about, said in words, next to the button
              that starts it (gh#353). The sibling switcher above already
              marks the current kid, and on 2026-07-27 a parent still
              recorded 28 minutes with her three-year-old while the page
              was armed for her nine-year-old: a highlighted pill is
              something you look at, and she was looking at her child.
              The cost of the mistake is 28 minutes and a progress claim
              landing on the wrong kid, so it earns a plain sentence. */}
          {kids.length > 1 ? (
            <p className="mt-6 text-sm text-body">
              This lesson will be saved for{" "}
              <span className="font-semibold text-strong">{childName}</span>.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void startRecording()}
              className="min-h-12 cursor-pointer rounded-pill bg-brand px-7 py-3 text-base font-semibold text-on-brand transition-colors hover:bg-brand-hover"
            >
              Start recording
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-12 cursor-pointer rounded-pill border border-border bg-card px-5 py-3 text-sm font-medium text-body transition-colors hover:border-brand"
            >
              Upload a recording you already made
            </button>
          </div>
          <p className="mt-3 text-xs text-muted">
            Recording keeps the screen awake. Plugging the phone in helps on
            long lessons.
          </p>
        </>
      ) : null}

      {phase === "recording" ? (
        <>
          <div className="mt-6 rounded-lg border border-border-subtle bg-card p-6 text-center shadow-sm">
            <p
              className="font-mono text-4xl font-semibold tabular-nums text-strong"
              aria-live="off"
            >
              {minutes}:{String(remainder).padStart(2, "0")}
            </p>
            <p className="mt-2 text-sm text-muted">
              {uploadedSegments > 0
                ? `${uploadedSegments * 3} minutes saved so far.`
                : "Saving starts as you teach."}
              {photoCount > 0
                ? ` ${photoCount} ${photoCount === 1 ? "photo" : "photos"} attached.`
                : ""}
            </p>
            <p className="mt-1 text-xs text-muted">
              Keep this screen open while you teach. If it closes, the
              recording pauses and picks back up when you return. Minutes
              already saved stay safe.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void finishRecording()}
              className="min-h-12 cursor-pointer rounded-pill bg-brand px-7 py-3 text-base font-semibold text-on-brand transition-colors hover:bg-brand-hover"
            >
              Finish the lesson
            </button>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="min-h-12 cursor-pointer rounded-pill border border-border bg-card px-5 py-3 text-sm font-medium text-body transition-colors hover:border-brand"
            >
              Snap a worksheet photo
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Snapping a photo can pause the recording for a moment while
            the camera is open.
          </p>
        </>
      ) : null}

      {phase === "finishing" || phase === "uploading_file" ? (
        <div className="mt-6 rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
          <p className="font-display text-lg font-semibold text-strong">
            {phase === "finishing"
              ? "Wrapping up the recording\u2026"
              : "Bringing the recording in\u2026"}
          </p>
          <p className="mt-1 text-sm text-muted">
            The review page opens in a moment. Homa listens back through the
            lesson there.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => void addPhoto(event.target.files?.[0] ?? null)}
        className="sr-only"
        aria-label="Snap a worksheet photo"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*"
        onChange={(event) =>
          void uploadExistingFile(event.target.files?.[0] ?? null)
        }
        className="sr-only"
        aria-label="Upload a recording"
      />
    </section>
  );
}

/** Voice Memos files carry readable metadata; when they don't, the
 *  caller falls back to a duration that routes the long-file lane. */
function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const element = document.createElement("audio");
    const objectUrl = URL.createObjectURL(file);
    const done = (value: number | null) => {
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };
    element.onloadedmetadata = () => {
      done(
        Number.isFinite(element.duration)
          ? Math.round(element.duration)
          : null,
      );
    };
    element.onerror = () => done(null);
    element.src = objectUrl;
  });
}
