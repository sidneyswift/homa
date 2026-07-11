import { MAP_ANSWERS } from "@homa/core";
import {
  askableTopicIds,
  nextWalkCard,
  walkCardStatement,
  walkOutcome,
} from "@homa/taxonomy";
import { z } from "zod";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamily } from "../../../../lib/map/session";
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
  end: z.boolean().optional(),
});

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`walk:${clientIp(request)}`, 120)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const family = await requireFamily();
  if (!family) {
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
  const { childId, subject, sitting } = parsed.data;

  try {
    const ageMonths = await childAgeMonths(family.id, childId);
    if (ageMonths === null) {
      return Response.json({ ok: false, reason: "unknown-child" }, { status: 400 });
    }

    if (parsed.data.end) {
      await emitMapEvent("map.walk_ended", {
        family_id: family.id,
        child_id: childId,
        subject,
        questions_answered: sitting,
        outcome: "stopped_early",
      });
      return Response.json({ ok: true, done: true, outcome: "stopped_early" });
    }

    if (parsed.data.answer) {
      const saved = await saveWalkAnswer(
        family.id,
        childId,
        subject,
        parsed.data.answer.topicId,
        parsed.data.answer.answer,
      );
      if (!saved.ok) {
        return Response.json({ ok: false, reason: "unknown-topic-or-child" }, { status: 400 });
      }
      await emitMapEvent("map.walk_answered", {
        family_id: family.id,
        child_id: childId,
        subject,
        domain: saved.domainId ?? "unknown",
        answer: parsed.data.answer.answer,
      });
    }

    const answers = await loadWalkAnswers(family.id, childId);
    if (answers === null) {
      return Response.json({ ok: false, reason: "unknown-child" }, { status: 400 });
    }

    const askable = askableTopicIds();
    const card = nextWalkCard(subject, ageMonths, answers, sitting, askable);
    if (card) {
      return Response.json({
        ok: true,
        done: false,
        card: {
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
      family_id: family.id,
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
