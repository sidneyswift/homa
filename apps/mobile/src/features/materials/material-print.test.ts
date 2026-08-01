import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parsePreparedPrintRequest,
  printResultMessage,
  readyPrintMessage,
} from "./material-print-contract";

const ID = "11111111-1111-4111-8111-111111111111";
const valid = {
  materialId: ID,
  title: "Maya's fractions",
  authorizedPdfPath: `/api/materials/${ID}/pdf`,
  pageIndexes: [0],
  pageCount: 2,
  copies: 2,
  answerKeyExcluded: true,
};

describe("native material print contract", () => {
  it("accepts only the matching authorized material route and bounded pages", () => {
    assert.deepEqual(parsePreparedPrintRequest(valid), valid);
    assert.equal(parsePreparedPrintRequest({ ...valid, authorizedPdfPath: "https://other.test/a.pdf" }), null);
    assert.equal(parsePreparedPrintRequest({ ...valid, pageIndexes: [2] }), null);
    assert.equal(parsePreparedPrintRequest({ ...valid, copies: 0 }), null);
  });

  it("previews the requested copies without claiming they printed", () => {
    const message = readyPrintMessage(valid);
    assert.match(message, /2 copies requested/u);
    assert.match(message, /answer key is left out/u);
    assert.doesNotMatch(message, /printed/u);
  });

  it("uses the operating-system result for every terminal message", () => {
    assert.equal(printResultMessage({ status: "completed" }), "The print job completed.");
    assert.match(printResultMessage({ status: "canceled" }), /Nothing was sent/u);
    assert.match(
      printResultMessage({ status: "failed", reason: "printer-error" }),
      /did not finish/u,
    );
  });
});
