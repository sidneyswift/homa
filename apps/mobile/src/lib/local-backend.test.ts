import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import {
  freshNewParentEmail,
  isLocalPersonaId,
  LOCAL_PERSONA_IDS,
  LOCAL_PERSONAS,
  NEW_PARENT_EMAIL_PATTERN,
} from "../features/dev/local-personas";

import { isLocalBackendUrl } from "./local-backend";

describe("isLocalBackendUrl", () => {
  it("accepts the simulator's loopback and a phone's LAN addresses", () => {
    for (const url of [
      "http://127.0.0.1:54321",
      "http://localhost:3000",
      "http://[::1]:54321",
      "http://192.168.1.20:54321",
      "http://10.0.0.5:3000",
      "http://172.20.1.4:54321",
      "http://sidneys-mac.local:54321",
    ]) {
      assert.equal(isLocalBackendUrl(url), true, url);
    }
  });

  it("rejects hosted backends and anything unparseable", () => {
    for (const url of [
      "https://kzplntcdtsvdowntvlza.supabase.co",
      "https://thankshoma.com",
      "http://172.32.0.1:54321",
      "http://8.8.8.8",
      "http://127.0.0.1.example.com",
      "not a url",
      "",
      undefined,
    ]) {
      assert.equal(isLocalBackendUrl(url), false, String(url));
    }
  });
});

describe("local personas", () => {
  it("lists every persona id exactly once", () => {
    assert.deepEqual(
      LOCAL_PERSONAS.map((persona) => persona.id),
      [...LOCAL_PERSONA_IDS],
    );
    assert.equal(isLocalPersonaId("established"), true);
    assert.equal(isLocalPersonaId("admin"), false);
  });

  it("uses only reserved test addresses that fence a family as a test family", () => {
    const emails = [
      ...LOCAL_PERSONAS.flatMap((persona) => (persona.email ? [persona.email] : [])),
      freshNewParentEmail(1_700_000_000_000),
    ];
    for (const email of emails) {
      assert.match(email, /\+homatest@homa\.test$/u, email);
    }
    assert.match(freshNewParentEmail(1_700_000_000_000), NEW_PARENT_EMAIL_PATTERN);
  });

  it("is imported only by the labs picker, which Metro keeps out of production", () => {
    const srcRoot = join(import.meta.dirname, "..");
    const importers: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        const path = join(directory, name);
        if (statSync(path).isDirectory()) {
          walk(path);
        } else if (/\.tsx?$/u.test(name) && !/\.test\.tsx?$/u.test(name)) {
          if (/features\/dev\/local-personas/u.test(readFileSync(path, "utf8"))) {
            importers.push(relative(srcRoot, path));
          }
        }
      }
    };
    walk(srcRoot);
    assert.deepEqual(importers, ["app/labs/personas.tsx"]);
    const metro = readFileSync(join(srcRoot, "..", "metro.config.js"), "utf8");
    assert.match(metro, /src\[\/\\\\\]app\[\/\\\\\]labs/u);
  });
});
