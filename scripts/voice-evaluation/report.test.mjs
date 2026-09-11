import assert from 'node:assert/strict';
import test from 'node:test';
import { summarize } from './report.mjs';
test('failed and ungraded calls cannot disappear into a passing average', () => {
  const result = summarize([{grade:{pass:true},responseGapsMs:[200,500]}, {grade:{pass:false},responseGapsMs:[1200]}, {harnessError:'no audio'}, {}]);
  assert.deepEqual(result.responseLatencyMs,{samples:3,p50:500,p90:1200});
  assert.equal(result.passed,1); assert.equal(result.failed,1); assert.equal(result.harnessFailures,1); assert.equal(result.ungraded,1);
  assert.equal(result.physicalPlayback,'unverified');
});
