import { MAP_ANSWERS } from "@homa/core";
import {
  askableTopicIds,
  nextWalkCard,
  walkCardStatement,
  walkOutcome,
} from "@homa/taxonomy";
import { z } from "zod";

import { liveProgressEnabled } from "../../../../lib/child-progress/flag";
import {
  emitProgressEvents,
  progressEventsForWalkAnswer,
} from "../../../../lib/child-progress/progress-events";
import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamilyWithActor } from "../../../../lib/map/session";
import { walkAnsweredEventProperties } from "../../../../lib/map/walk-answer-event";
import {
  consumeMapWalkPrompt,
  createMapWalkPrompt,
  retireMapWalkPrompt,
} from "../../../../lib/map/walk-prompt-store";
import {
  childAgeMonths,
  loadWalkAnswers,
  saveWalkAnswer,
} from "../../../../lib/map/walk-store";

/**
 * POST /api/map/walk
 * One graph-walk turn (plans/2026-07-11-onboarding-depth-fork.md § The
 * seam). The card selection runs server-side on purpose: the taxonomy is
 * a few MB and never enters a client bundle, unlike the checklist's
 * client-computed anchored ladder.
 *
 * Body shapes, one route, three moments:
 *   { childId, subject, sitting }                    first card
 *   { childId, subject, sitting, answer }            save + next card
 *   { childId, subject, sitting, end: true }         she stopped early
 *
 * Replies { done: false, card } while cards remain, { done: true,
 * outcome } when the sitting is over (walk_ended emits exactly once, on
 * that reply or on the end beacon). Statements come from the authored
 * card layer only; topics without a card are never served.
 */
const walkRequestSchema = z.object({
  childId: z.uuid(),
  subject: z.string().min(1).max(40),
  /** Cards answered this sitting, client-tracked like the deep dive's
   * count, INCLUDING the answer carried in this request (so 0 on the
   * first fetch, 1 when submitting the first answer). The budget check
   * and walk_ended's questions_answered both read this number. */
  sitting: z.number().int().min(0).max(50),
  answer: z
    .object({
      topicId: z.string().min(3).max(120),
      answer: z.enum(MAP_ANSWERS),
    })
    .optional(),
  idempotencyKey: z.uuid().optional(),
  promptId: z.uuid().optional(),
  end: z.boolean().optional(),
});

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`walk:${clientIp(request)}`, 120)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  let access;
  try {
    access = await requireFamilyWithActor();
  } catch (error) {
    console.error(
      "map/walk auth lookup failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { ok: false, reason: "auth-lookup-failed" },
      { status: 502 },
    );
  }
  if (!access) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = walkRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  if (
    liveProgressEnabled() &&
    (parsed.data.answer || parsed.data.end) &&
    (!parsed.data.idempotencyKey || !parsed.data.promptId)
  ) {
    return Response.json(
      { ok: false, reason: "missing-prompt-identity" },
      { status: 400 },
    );
  }
  const { childId, subject, sitting } = parsed.data;

  try {
    const ageMonths = await childAgeMonths(
      access.family.id,
      childId,
    );
    if (ageMonths === null) {
      return Response.json({ ok: false, reason: "unknown-child" }, { status: 400 });
    }

    if (parsed.data.end) {
      if (liveProgressEnabled()) {
        const retired = await retireMapWalkPrompt({
          promptId: parsed.data.promptId ?? "",
          familyId: access.family.id,
          childId,
          memberUserId: access.memberUserId,
          subjectId: subject,
          answeredCount: sitting,
          idempotencyKey: parsed.data.idempotencyKey ?? "",
        });
        if (retired.status === "rejected") {
          return Response.json(
            { ok: false, reason: retired.reason },
            { status: 409 },
          );
        }
        if (retired.status === "accepted") {
          await emitMapEvent("map.walk_ended", {
            family_id: access.family.id,
            child_id: childId,
            subject,
            questions_answered: sitting,
            outcome: "stopped_early",
          });
        }
        return Response.json(retired.response);
      }
      await emitMapEvent("map.walk_ended", {
        family_id: access.family.id,
        child_id: childId,
        subject,
        questions_answered: sitting,
        outcome: "stopped_early",
      });
      return Response.json({ ok: true, done: true, outcome: "stopped_early" });
    }

    if (parsed.data.answer) {
      if (liveProgressEnabled()) {
        const consumed = await consumeMapWalkPrompt({
          promptId: parsed.data.promptId ?? "",
          familyId: access.family.id,
          childId,
          subjectId: subject,
          topicId: parsed.data.answer.topicId,
          answer: parsed.data.answer.answer,
          sitting,
          memberUserId: access.memberUserId,
          channel: "web",
          idempotencyKey: parsed.data.idempotencyKey ?? "",
        });
        if (consumed.status === "rejected") {
          return Response.json(
            { ok: false, reason: consumed.reason },
            { status: 409 },
          );
        }
        if (
          consumed.status === "replay" &&
          !consumed.response.ok
        ) {
          return Response.json(
            consumed.response,
            { status: 409 },
          );
        }
        if (consumed.status === "accepted") {
          await emitProgressEvents(
            progressEventsForWalkAnswer({
              familyId: access.family.id,
              childId,
              subject,
              domain: consumed.domainId,
              answer: parsed.data.answer.answer,
              evidenceRecorded:
                consumed.progress.evidenceRecorded,
              projectionUpdated:
                consumed.progress.projectionUpdated,
              hadConflict: consumed.progress.hadConflict,
            }),
          );
          await emitMapEvent(
            "map.walk_answered",
            walkAnsweredEventProperties({
              familyId: access.family.id,
              childId,
              subject,
              domain: consumed.domainId,
              answer: parsed.data.answer.answer,
            }),
          );
          if (consumed.response.done) {
            await emitMapEvent("map.walk_ended", {
              family_id: access.family.id,
              child_id: childId,
              subject,
              questions_answered: sitting,
              outcome: consumed.response.outcome,
            });
          }
        }
        return Response.json(consumed.response);
      }
      const saved = await saveWalkAnswer(
        access.family.id,
        childId,
        subject,
        parsed.data.answer.topicId,
        parsed.data.answer.answer,
        {
          memberUserId: access.memberUserId,
          idempotencyKey: parsed.data.idempotencyKey,
        },
      );
      if (!saved.ok) {
        return Response.json({ ok: false, reason: "unknown-topic-or-child" }, { status: 400 });
      }
      await emitMapEvent("map.walk_answered", walkAnsweredEventProperties({
        familyId: access.family.id,
        childId,
        subject,
        domain: saved.domainId ?? "unknown",
        answer: parsed.data.answer.answer,
      }));
    }

    const answers = await loadWalkAnswers(
      access.family.id,
      childId,
    );
    if (answers === null) {
      return Response.json({ ok: false, reason: "unknown-child" }, { status: 400 });
    }

    const askable = askableTopicIds();
    const card = nextWalkCard(subject, ageMonths, answers, sitting, askable);
    if (card) {
      const promptId = liveProgressEnabled()
        ? await createMapWalkPrompt({
            familyId: access.family.id,
            childId,
            memberUserId: access.memberUserId,
            subjectId: subject,
            topicId: card.topic.id,
            sitting: sitting + 1,
          })
        : null;
      if (liveProgressEnabled() && !promptId) {
        return Response.json(
          { ok: false, reason: "prompt-create-failed" },
          { status: 409 },
        );
      }
      return Response.json({
        ok: true,
        done: false,
        card: {
          ...(promptId ? { promptId } : {}),
          topicId: card.topic.id,
          domainId: card.domain.id,
          domainName: card.domain.displayName,
          /** {{name}} placeholder intact; the client personalizes. */
          statement: walkCardStatement(card.topic.id),
        },
      });
    }

    const outcome = walkOutcome(subject, ageMonths, answers, sitting, askable);
    await emitMapEvent("map.walk_ended", {
      family_id: access.family.id,
      child_id: childId,
      subject,
      questions_answered: sitting,
      outcome,
    });
    return Response.json({ ok: true, done: true, outcome });
  } catch (error) {
    console.error("map/walk failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
