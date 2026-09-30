import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  classMinutes,
  programDraftSchema,
  programScheduleSchema,
  type ProgramClass,
} from "./learning-programs";
const child = randomUUID();
const row: ProgramClass = {
  id: randomUUID(),
  title: "Nature lab",
  subject: "science",
  childIds: [child],
  weekday: 1,
  startTime: "09:15",
  endTime: "10:00",
  plannedMinutes: null,
  category: null,
};
test("schedule durations are exact and independent of actual attendance", () => {
  assert.equal(classMinutes(row), 45);
  assert.equal(classMinutes({ ...row, startTime: null, endTime: null }), null);
  assert.throws(() => classMinutes({ ...row, endTime: "09:00" }));
  assert.throws(() => classMinutes({ ...row, plannedMinutes: 1 }));
});
test("overlaps are per child, not per program", () => {
  const draft = {
    id: randomUUID(),
    expectedRevision: null,
    name: "Monday co-op",
    classes: [row, { ...row, id: randomUUID(), title: "Literature" }],
  };
  assert.equal(programDraftSchema.safeParse(draft).success, false);
  assert.equal(
    programDraftSchema.safeParse({
      ...draft,
      classes: [row, { ...draft.classes[1], childIds: [randomUUID()] }],
    }).success,
    true,
  );
});
test("recurrence is bounded and rejects invalid calendar dates", () => {
  const request = {
    programId: randomUUID(),
    expectedRevision: 1,
    from: "2026-09-01",
    through: "2026-09-30",
    excludedDates: [],
  };
  assert.equal(programScheduleSchema.safeParse(request).success, true);
  assert.equal(
    programScheduleSchema.safeParse({ ...request, from: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    programScheduleSchema.safeParse({ ...request, through: "2027-09-01" })
      .success,
    false,
  );
});
