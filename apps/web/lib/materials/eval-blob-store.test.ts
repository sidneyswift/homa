import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import {
  EVAL_BLOB_DIR_ENV_VAR,
  EVAL_BLOB_URL_ENV_VAR,
  EVAL_ISOLATION_FLAG,
} from "../eval-isolation";
import {
  evalBlobDeleteFamily,
  evalBlobPut,
  isEvalBlobFamilyUrl,
  resolveEvalBlobStore,
  type EvalBlobStore,
} from "./eval-blob-store";

const FAMILY = "00000000-0000-4000-8000-00000000fam1";

describe("resolveEvalBlobStore", () => {
  it("resolves only while eval isolation is active with both variables set", () => {
    const base = {
      [EVAL_BLOB_DIR_ENV_VAR]: "/tmp/blob",
      [EVAL_BLOB_URL_ENV_VAR]: "http://127.0.0.1:5000/",
    };

    assert.equal(resolveEvalBlobStore(base), null);
    assert.equal(
      resolveEvalBlobStore({ ...base, [EVAL_ISOLATION_FLAG]: "1", VERCEL: "1" }),
      null,
    );
    assert.deepEqual(resolveEvalBlobStore({ ...base, [EVAL_ISOLATION_FLAG]: "1" }), {
      dir: "/tmp/blob",
      baseUrl: "http://127.0.0.1:5000",
    });
    assert.equal(resolveEvalBlobStore({ [EVAL_ISOLATION_FLAG]: "1" }), null);
  });
});

describe("eval blob store filesystem behavior", () => {
  let store: EvalBlobStore;

  before(async () => {
    store = {
      dir: await mkdtemp(join(tmpdir(), "homa-eval-blob-test-")),
      baseUrl: "http://127.0.0.1:5000",
    };
  });

  after(async () => {
    await rm(store.dir, { recursive: true, force: true });
  });

  it("writes bytes under a random-suffixed key and returns a served URL", async () => {
    const { url } = await evalBlobPut(
      store,
      `families/${FAMILY}/materials/counting.pdf`,
      Buffer.from("pdf-bytes"),
    );

    assert.match(url, /^http:\/\/127\.0\.0\.1:5000\/families\//);
    assert.match(url, /counting-[0-9a-f]{8}\.pdf$/);
    const stored = await readFile(join(store.dir, new URL(url).pathname.slice(1)));
    assert.equal(stored.toString(), "pdf-bytes");
  });

  it("refuses a key that escapes the store directory", async () => {
    await assert.rejects(
      evalBlobPut(store, "../outside.pdf", Buffer.from("x")),
      /escapes the store directory/,
    );
  });

  it("scopes URL acceptance to the family prefix, like production", () => {
    const ours = `${store.baseUrl}/families/${FAMILY}/images/a.png`;
    const theirs = `${store.baseUrl}/families/other-family/images/a.png`;

    assert.equal(isEvalBlobFamilyUrl(store, ours, FAMILY), true);
    assert.equal(isEvalBlobFamilyUrl(store, theirs, FAMILY), false);
  });

  it("deletes exactly one family's files and reports the count", async () => {
    await evalBlobPut(store, `families/${FAMILY}/images/one.png`, Buffer.from("1"));
    await evalBlobPut(store, `families/${FAMILY}/images/two.png`, Buffer.from("2"));
    await evalBlobPut(store, "families/other-family/images/keep.png", Buffer.from("3"));
    // A file written earlier in this suite also lives under FAMILY.
    const removed = await evalBlobDeleteFamily(store, FAMILY);

    assert.ok(removed >= 2);
    assert.equal(await evalBlobDeleteFamily(store, FAMILY), 0);
    assert.equal(await evalBlobDeleteFamily(store, "other-family"), 1);
  });
});
