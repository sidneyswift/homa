import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeTelnyxUsPhone,
  readSoleProprietorIdentity,
} from "./telnyx-shared.mts";

const BASE_IDENTITY_ENV = {
  TELNYX_SP_FIRST_NAME: "Test",
  TELNYX_SP_LAST_NAME: "User",
  TELNYX_SP_EMAIL: "test@example.com",
  TELNYX_SP_STREET: "1 Test St",
  TELNYX_SP_CITY: "Miami",
  TELNYX_SP_STATE: "FL",
  TELNYX_SP_POSTAL: "33101",
};

function withEnv(values: Record<string, string>, run: () => void): void {
  const keys = Object.keys(values);
  const original = new Map(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    run();
  } finally {
    for (const key of keys) {
      const value = original.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("Telnyx sole-prop phone normalization accepts formatted US numbers", () => {
  withEnv(
    {
      ...BASE_IDENTITY_ENV,
      TELNYX_SP_MOBILE: "(954) 990-3497",
    },
    () => {
      assert.equal(readSoleProprietorIdentity().mobilePhone, "+19549903497");
    },
  );
});

test("Telnyx script phone normalization rejects non-US plus-prefixed values", () => {
  assert.equal(normalizeTelnyxUsPhone("+441234567890"), null);
  assert.equal(normalizeTelnyxUsPhone("+1 954 990 3497"), "+19549903497");
});

test("Telnyx sole-prop phone normalization rejects invalid plus-prefixed values", () => {
  withEnv(
    {
      ...BASE_IDENTITY_ENV,
      TELNYX_SP_MOBILE: "+441234567890",
    },
    () => {
      const originalExit = process.exit;
      let exitCode: string | number | null | undefined;
      process.exit = ((code?: string | number | null) => {
        exitCode = code;
        throw new Error("process.exit");
      }) as typeof process.exit;

      try {
        assert.throws(() => readSoleProprietorIdentity(), /process\.exit/);
        assert.equal(exitCode, 2);
      } finally {
        process.exit = originalExit;
      }
    },
  );
});
