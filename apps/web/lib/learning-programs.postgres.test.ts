import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { mapDb } from "./map/db";
import {
  readLearningPrograms,
  saveLearningProgram,
  scheduleLearningProgram,
} from "./learning-programs-server";
import { inspectHoursEntry, correctHoursEntry } from "./hours-corrections";
import { type ProgramDraft } from "./learning-programs";
const available = Boolean(process.env.HOMA_EVAL_DATABASE_URL);
after(async () => {
  if (available) await mapDb().end({ timeout: 5 });
});
test(
  "programs preserve attendance, exact retries, independent children and tenant boundaries",
  { skip: !available },
  async () => {
    const sql = mapDb(),
      family = randomUUID(),
      other = randomUUID(),
      user = randomUUID(),
      first = randomUUID(),
      second = randomUUID();
    await sql`insert into public.families(id,name,sandbox) values(${family},'Program fixture',true),(${other},'Other fixture',true)`;
    await sql`insert into auth.users(id,email) values(${user},${`program-${user}@example.test`})`;
    await sql`insert into public.family_members(family_id,user_id,role) values(${family},${user},'parent')`;
    await sql`insert into public.children(id,family_id,name,birth_month) values(${first},${family},'One','2019-01-01'),(${second},${family},'Two','2017-01-01')`;
    const access = { mode: "pinned" as const, familyId: family };
    const draft: ProgramDraft = {
      id: randomUUID(),
      expectedRevision: null,
      name: "Monday co-op",
      classes: [
        {
          id: randomUUID(),
          title: "Nature lab",
          subject: "science",
          childIds: [first, second],
          weekday: 1,
          startTime: "09:00",
          endTime: "09:45",
          plannedMinutes: null,
          category: "Nature",
        },
      ],
    };
    const save = await saveLearningProgram(access, draft);
    assert.equal(save.status, "saved");
    assert.equal((await saveLearningProgram(access, draft)).revision, 1);
    assert.equal(
      (
        await saveLearningProgram(
          { ...access, familyId: other },
          { ...draft, expectedRevision: 1, name: "Stolen" },
        )
      ).status,
      "not_found",
    );
    const schedule = {
      programId: draft.id,
      expectedRevision: 1,
      from: "2026-09-14",
      through: "2026-09-28",
      excludedDates: ["2026-09-21"],
    };
    assert.equal((await scheduleLearningProgram(access, schedule)).created, 4);
    assert.equal((await scheduleLearningProgram(access, schedule)).created, 0);
    assert.equal(
      (
        await sql`select count(*)::int n from public.hours_log where family_id=${family}`
      )[0].n,
      0,
    );
    const initial = await readLearningPrograms(
      access,
      schedule.from,
      schedule.through,
    );
    assert.equal(initial.occurrences.length, 4);
    assert.equal(initial.occurrences[0].plannedMinutes, 45);
    const selected = initial.occurrences.find((o) => o.childId === first)!;
    const apply = async (
      operation: string,
      minutes: number | null,
      revision = selected.revision,
    ) =>
      sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.sub',${user},true)`;
        await tx`set local role authenticated`;
        return (
          await tx`select public.change_program_occurrence(${family}::uuid,${selected.activityId}::uuid,${revision}::text::timestamptz,${operation},${minutes}) receipt`
        )[0].receipt;
      });
    const recorded = await apply("record", 40);
    assert.equal(
      recorded.result,
      "applied",
      JSON.stringify({ recorded, selected }),
    );
    assert.equal(
      (await apply("record", 1)).result,
      "conflict",
      "stale writes cannot overwrite attendance",
    );
    let hours =
      await sql`select * from public.hours_log where family_id=${family}`;
    assert.equal(hours.length, 1);
    assert.equal(hours[0].minutes, 40);
    assert.equal(hours[0].child_id, first);
    assert.equal(hours[0].custom_label, "Nature");
    assert.equal(
      (
        await readLearningPrograms(
          { ...access, familyId: other },
          schedule.from,
          schedule.through,
        )
      ).occurrences.length,
      0,
    );
    await assert.rejects(
      sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.sub',${user},true)`;
        await tx`set local role authenticated`;
        await tx`select public.read_learning_programs(${other}::uuid,'2026-09-01','2026-09-30')`;
      }),
      /Family unavailable/,
    );
    await assert.rejects(
      sql.begin(async (tx) => {
        await tx`set local role authenticated`;
        await tx`select public.read_learning_programs_pinned(${family}::uuid,'2026-09-01','2026-09-30')`;
      }),
      /permission denied/,
    );
    const context = await inspectHoursEntry(access, hours[0].id);
    assert.equal(context.result, "ready");
    if (context.result !== "ready") throw Error();
    assert.equal(
      (
        await correctHoursEntry(access, {
          entryId: hours[0].id,
          revision: context.revision,
          scope: "child",
          operation: "update",
          subject: "science",
          minutes: 35,
          category: "Nature",
          note: null,
        })
      ).result,
      "applied",
    );
    hours = await sql`select * from public.hours_log where family_id=${family}`;
    assert.equal(hours[0].minutes, 35);
    const changed = await readLearningPrograms(
      access,
      schedule.from,
      schedule.through,
    );
    assert.equal(
      (
        await apply(
          "cancel",
          null,
          changed.occurrences.find((o) => o.activityId === selected.activityId)!
            .revision,
        )
      ).result,
      "applied",
    );
    assert.equal(
      (await scheduleLearningProgram(access, schedule)).created,
      0,
      "removed occurrence is not resurrected",
    );
    assert.equal(
      (
        await sql`select count(*)::int n from public.hours_log where family_id=${family}`
      )[0].n,
      0,
    );
    assert.equal(
      (
        await readLearningPrograms(access, schedule.from, schedule.through)
      ).occurrences.filter((o) => o.status === "removed").length,
      1,
    );
    // Reproduce a historical shared class, then correct only one child.
    const shared = initial.occurrences.find((o) => o.childId === second)!;
    await sql`insert into public.planner_learning_activity_children(family_id,activity_id,child_id) values(${family},${shared.activityId},${first})`;
    await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub',${user},true)`;
      await tx`select public.update_planner_learning_activity_record(${shared.activityId}::uuid,${shared.revision}::text::timestamptz,'Shared class',null,1)`;
    });
    const sharedHours =
      await sql`select h.* from public.hours_log h join public.planner_learning_activity_hours l on l.hours_entry_id=h.id where l.activity_id=${shared.activityId}`;
    const chosen = sharedHours.find((h) => h.child_id === first)!;
    const before = await inspectHoursEntry(access, chosen.id);
    if (before.result !== "ready") throw Error();
    const correction = {
      entryId: chosen.id,
      revision: before.revision,
      scope: "child" as const,
      operation: "update" as const,
      subject: "science" as const,
      minutes: 45,
      category: null,
      note: null,
    };
    assert.equal(
      (await correctHoursEntry({ ...access, familyId: other }, correction))
        .result,
      "not_found",
    );
    assert.equal(
      (await correctHoursEntry(access, correction)).result,
      "applied",
    );
    const final =
      await sql`select child_id,minutes from public.hours_log where family_id=${family}`;
    assert.equal(final.find((h) => h.child_id === first)!.minutes, 45);
    assert.equal(final.find((h) => h.child_id === second)!.minutes, 1);
  },
);
