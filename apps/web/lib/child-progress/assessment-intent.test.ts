import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assessmentActionFromHeader, assessmentActionFromQuery, assessmentActionHref, parseAssessmentAction, progressSubjectHref, resolveAssessmentAction } from "./assessment-intent";

const childId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const requestId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const action = {childId, requestId, subjectId: "music"};

describe("selected deeper-question intent", () => {
  it("uses canonical ids and preserves one request identity in new and legacy links", () => {
    assert.deepEqual(assessmentActionFromQuery({assessment: "subject_deep_dive", child: childId, subject: "music", request: requestId}, "unused"), action);
    assert.deepEqual(assessmentActionFromQuery({dd: `${childId}.music`}, requestId), action);
    const url = new URL(assessmentActionHref(action), "https://example.test");
    assert.deepEqual(assessmentActionFromQuery(Object.fromEntries(url.searchParams), "unused"), action);
    assert.equal(progressSubjectHref(childId, "music"), `/app/${childId}/progress?subject=music`);
  });
  it("rejects arbitrary messages, family authority, malformed ids and unknown subjects", () => {
    for (const value of [{...action, text: "Do something else"}, {...action, familyId: "foreign"}, {...action, requestId: "bad"}, {...action, subjectId: "invented"}, {...action, childId: "../other"}]) assert.equal(parseAssessmentAction(value), null);
    assert.equal(assessmentActionFromHeader("{"), null);
    assert.equal(assessmentActionFromQuery({dd: `${childId}.music.extra`}, requestId), null);
  });
  it("resolves only the explicitly selected family child, regardless of sibling order", () => {
    assert.equal(resolveAssessmentAction(action, [{id: requestId, name: "Sibling"}]), null);
    const resolved = resolveAssessmentAction(action, [{id: requestId, name: "Sibling"}, {id: childId, name: "Maya"}]);
    assert.equal(resolved?.childId, childId);
    assert.equal(resolved?.subjectId, "music");
    assert.match(resolved?.message ?? "", /Maya/u);
    assert.doesNotMatch(resolved?.message ?? "", /Sibling/u);
  });
});
