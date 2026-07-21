import { useCallback, useEffect, useState } from "react";

import { getMyChildren, getMyFamily } from "../../lib/family";
import {
  getLessonRecording,
  getLessonReview,
  listLessonMedia,
  listLessonSegments,
  type LessonMedia,
  type LessonRecording,
  type LessonReview,
  type LessonSegment,
} from "../../lib/lessons";

/**
 * Loads one lesson's review data, the mobile twin of the server reads
 * in apps/web/app/app/lessons/[lessonId]/page.tsx. All reads are
 * RLS-scoped selects (see src/lib/lessons.ts). While the pipeline is
 * still running this hook re-reads every ten seconds, standing in for
 * the web page's LessonStatusPoll: the same honest progress, fed by
 * the same tables instead of an API route.
 */

const POLL_MS = 10_000;

const RUNNING_STATUSES: ReadonlySet<string> = new Set([
  "recording",
  "uploaded",
  "analyzing",
]);

interface LessonData {
  loading: boolean;
  error: string | null;
  /** Null after loading means not this family's lesson (or none at all). */
  lesson: LessonRecording | null;
  childName: string;
  review: LessonReview | null;
  media: LessonMedia[];
  segments: LessonSegment[];
  reload: () => Promise<void>;
}

export function useLessonData(lessonId: string | null): LessonData {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<LessonRecording | null>(null);
  const [childName, setChildName] = useState("your child");
  const [review, setReview] = useState<LessonReview | null>(null);
  const [media, setMedia] = useState<LessonMedia[]>([]);
  const [segments, setSegments] = useState<LessonSegment[]>([]);

  const reload = useCallback(async () => {
    if (!lessonId) {
      setLesson(null);
      setLoading(false);
      return;
    }
    try {
      const family = await getMyFamily();
      if (!family) {
        setLesson(null);
        setError(null);
        return;
      }
      const nextLesson = await getLessonRecording(lessonId, family.id);
      if (!nextLesson) {
        setLesson(null);
        setError(null);
        return;
      }
      const children = await getMyChildren(family.id);
      setChildName(
        children.find((child) => child.id === nextLesson.childId)?.name ??
          "your child",
      );
      if (nextLesson.status === "ready") {
        const [nextReview, nextMedia, nextSegments] = await Promise.all([
          getLessonReview(lessonId, family.id),
          listLessonMedia(lessonId, family.id),
          listLessonSegments(lessonId, family.id),
        ]);
        setReview(nextReview);
        setMedia(nextMedia);
        setSegments(nextSegments);
      } else {
        // Pre-ready, segments alone carry the honest progress counts.
        setSegments(await listLessonSegments(lessonId, family.id));
      }
      setLesson(nextLesson);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  // The poll only runs while Homa is still listening; a ready or failed
  // lesson is settled and a missed refresh costs nothing.
  const running = lesson !== null && RUNNING_STATUSES.has(lesson.status);
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      void reload();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [running, reload]);

  return { loading, error, lesson, childName, review, media, segments, reload };
}
