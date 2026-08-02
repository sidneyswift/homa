import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import postgres from "postgres";

import { mapDb } from "../map/db";
import { resolveActiveObject } from "../voice/active-object";
import {
  claimLessonAnalysis,
  getLessonAnalysisRetryState,
  requestLessonAnalysisRetry,
} from "./store";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;

describe(
  "recorded lesson retry PostgreSQL contract",
  { skip: databaseUrl === undefined },
  () => {
    it("preserves attempt bounds, tenant scope, source gates, and race safety", async () => {
      assert.ok(databaseUrl);
      const sql = postgres(databaseUrl, { prepare: false, max: 2 });
      const familyId = randomUUID();
      const foreignFamilyId = randomUUID();
      const childId = randomUUID();
      const foreignChildId = randomUUID();

      async function insertFailedLesson(input: {
        attempts: number;
        audioDeleted?: boolean;
        transcript?: string | null;
      }): Promise<string> {
        const lessonId = randomUUID();
        await sql`
          insert into public.lesson_recordings
            (id, family_id, child_id, status, source, finished_at,
             attempts, audio_deleted_at, error)
          values
            (${lessonId}, ${familyId}, ${childId}, 'failed', 'recorder',
             now(), ${input.attempts},
             ${input.audioDeleted ? new Date().toISOString() : null},
             'retry fixture')
        `;
        if (input.transcript !== undefined) {
          await sql`
            insert into public.lesson_segments
              (lesson_id, family_id, seq, blob_url, content_type, transcript)
            values
              (${lessonId}, ${familyId}, 1,
               ${`https://blob.example/${lessonId}.m4a`}, 'audio/mp4',
               ${input.transcript})
          `;
        }
        return lessonId;
      }

      try {
        await sql`
          insert into public.families (id, name)
          values (${familyId}, 'Retry family'),
                 (${foreignFamilyId}, 'Foreign retry family')
        `;
        await sql`
          insert into public.children (id, family_id, name, birth_month)
          values (${childId}, ${familyId}, 'Maya', '2018-01-01'),
                 (${foreignChildId}, ${foreignFamilyId}, 'Noah', '2017-01-01')
        `;

        const attemptOne = await insertFailedLesson({ attempts: 1 });
        assert.deepEqual(
          await requestLessonAnalysisRetry(attemptOne, familyId),
          { status: "queued", attempts: 1 },
        );
        const claimedTwo = await claimLessonAnalysis(attemptOne, familyId);
        assert.equal(claimedTwo?.attempts, 2);

        const attemptThree = await insertFailedLesson({ attempts: 3 });
        assert.deepEqual(
          await requestLessonAnalysisRetry(attemptThree, familyId),
          { status: "queued", attempts: 3 },
        );
        const claimedFour = await claimLessonAnalysis(attemptThree, familyId);
        assert.equal(claimedFour?.attempts, 4);

        const attemptFour = await insertFailedLesson({ attempts: 4 });
        assert.deepEqual(
          await requestLessonAnalysisRetry(attemptFour, familyId),
          { status: "exhausted", attempts: 4 },
        );

        const concurrent = await insertFailedLesson({ attempts: 1 });
        const requests = await Promise.all([
          requestLessonAnalysisRetry(concurrent, familyId),
          requestLessonAnalysisRetry(concurrent, familyId),
        ]);
        assert.deepEqual(
          requests.map((result) => result.status).sort(),
          ["processing", "queued"],
        );
        const claims = await Promise.all([
          claimLessonAnalysis(concurrent, familyId),
          claimLessonAnalysis(concurrent, familyId),
        ]);
        assert.equal(claims.filter((claim) => claim !== null).length, 1);
        assert.equal(claims.find((claim) => claim !== null)?.attempts, 2);

        const foreign = await insertFailedLesson({ attempts: 1 });
        assert.deepEqual(
          await requestLessonAnalysisRetry(foreign, foreignFamilyId),
          { status: "not_found" },
        );
        assert.equal(
          (await getLessonAnalysisRetryState(foreign, familyId)).status,
          "available",
        );

        const unavailable = await insertFailedLesson({
          attempts: 1,
          audioDeleted: true,
          transcript: "   ",
        });
        assert.deepEqual(
          await requestLessonAnalysisRetry(unavailable, familyId),
          { status: "source_unavailable", attempts: 1 },
        );

        const transcriptOnly = await insertFailedLesson({
          attempts: 1,
          audioDeleted: true,
          transcript: "Maya read the page aloud.",
        });
        assert.deepEqual(
          await requestLessonAnalysisRetry(transcriptOnly, familyId),
          { status: "queued", attempts: 1 },
        );

        const visibleReview = await insertFailedLesson({ attempts: 1 });
        await sql`
          update public.lesson_recordings
          set status = 'ready'
          where id = ${visibleReview} and family_id = ${familyId}
        `;
        await sql`
          insert into public.lesson_reviews
            (lesson_id, family_id, child_id, summary, insights,
             evidence_count, observation_count)
          values
            (${visibleReview}, ${familyId}, ${childId},
             'Maya stayed with the tricky ending sounds.',
             ${sql.json({ observations: ["kept trying"] })}, 2, 1)
        `;
        const activeReview = await resolveActiveObject(familyId, {
          kind: "recording",
          objectId: visibleReview,
          version: "current-parent-visible",
        });
        assert.equal(activeReview.ok, true);
        if (activeReview.ok) {
          assert.match(activeReview.contextMarkdown, /tricky ending sounds/u);
          assert.match(activeReview.contextMarkdown, /Maya/u);
        }
        assert.deepEqual(
          await resolveActiveObject(foreignFamilyId, {
            kind: "recording",
            objectId: visibleReview,
            version: "current-parent-visible",
          }),
          { ok: false, reason: "missing" },
        );

        const [raceRow] = await sql<{ status: string; attempts: number }[]>`
          select status, attempts
          from public.lesson_recordings
          where id = ${concurrent} and family_id = ${familyId}
        `;
        assert.deepEqual(raceRow, { status: "analyzing", attempts: 2 });
      } finally {
        await sql`
          delete from public.families
          where id in (${familyId}, ${foreignFamilyId})
        `.catch(() => undefined);
        await Promise.all([
          sql.end({ timeout: 5 }),
          mapDb().end({ timeout: 5 }),
        ]);
      }
    });
  },
);
