import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  analyzeCaptureLoopUsage,
  captureLoopStagingMatches,
} from "./events-check-lib.mts";

const BASE_FILES = {
  "core.ts": `
    export const CAPTURE_LOOP_EVENT_NAMES = ["product.loop_stage_recorded"] as const;
    export const CAPTURE_LOOP_EVENT_NAME = CAPTURE_LOOP_EVENT_NAMES[0];
  `,
  "web/capture-loop-events.ts": `
    import { CAPTURE_LOOP_EVENT_NAME } from "../core";
    export async function persistCaptureLoopEvent(): Promise<void> {}
    export async function persistCaptureLoopEventWithSql(): Promise<void> {}
    export async function emitWebCaptureLoopStage(): Promise<void> {
      await persistCaptureLoopEvent();
      void CAPTURE_LOOP_EVENT_NAME;
    }
  `,
  "mobile/capture-loop-events.ts": `
    import { CAPTURE_LOOP_EVENT_NAME } from "../core";
    async function emitFamilyEvent(..._args: unknown[]): Promise<void> {}
    export async function emitNativeCaptureLoopStage(): Promise<void> {
      await emitFamilyEvent(null, CAPTURE_LOOP_EVENT_NAME, {});
    }
  `,
} as const;

async function fixtureAnalysis(
  files: Readonly<Record<string, string>>,
  allowedLowLevelFiles: ReadonlyArray<string> = [],
) {
  const root = await mkdtemp(join(tmpdir(), "homa-events-check-"));
  const allFiles = { ...BASE_FILES, ...files };
  try {
    await Promise.all(
      Object.entries(allFiles).map(async ([relativePath, source]) => {
        const path = join(root, relativePath);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, source, "utf8");
      }),
    );
    const sourceFiles = Object.keys(allFiles).map((path) => join(root, path));
    return analyzeCaptureLoopUsage({
      sourceFiles,
      wrapperModuleFiles: [
        join(root, "web/capture-loop-events.ts"),
        join(root, "mobile/capture-loop-events.ts"),
      ],
      captureContractFile: join(root, "core.ts"),
      allowedLowLevelFiles: [
        join(root, "web/capture-loop-events.ts"),
        join(root, "mobile/capture-loop-events.ts"),
        ...allowedLowLevelFiles.map((path) => join(root, path)),
      ],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("staged and live registry states require the opposite caller states", () => {
  assert.equal(captureLoopStagingMatches(true, new Set()), true);
  assert.equal(captureLoopStagingMatches(true, new Set(["caller.ts"])), false);
  assert.equal(captureLoopStagingMatches(false, new Set()), false);
  assert.equal(captureLoopStagingMatches(false, new Set(["caller.ts"])), true);
});

test("symbol resolution finds aliases, namespaces, and barrel re-exports", async () => {
  const analysis = await fixtureAnalysis({
    "alias.ts": `
      import { emitWebCaptureLoopStage as emit } from "./web/capture-loop-events";
      void emit();
    `,
    "namespace.ts": `
      import * as loop from "./mobile/capture-loop-events";
      void loop.emitNativeCaptureLoopStage();
    `,
    "barrel.ts": `
      export { emitWebCaptureLoopStage } from "./web/capture-loop-events";
    `,
    "barrel-consumer.ts": `
      import { emitWebCaptureLoopStage } from "./barrel";
      void emitWebCaptureLoopStage();
    `,
    "alias-path.ts": `
      import { emitWebCaptureLoopStage } from "@/lib/capture-loop-events";
      void emitWebCaptureLoopStage();
    `,
  });
  assert.deepEqual(
    [...analysis.wrapperCallSites].sort().map((path) => path.split("/").at(-1)),
    ["alias-path.ts", "alias.ts", "barrel-consumer.ts", "namespace.ts"],
  );
  assert.deepEqual([...analysis.unsupportedWrapperSites], []);
  assert.deepEqual([...analysis.lowLevelBypassSites], []);
  assert.deepEqual(analysis.configurationFailures, []);
});

test("indirect wrapper syntax fails closed", async () => {
  const analysis = await fixtureAnalysis({
    "indirect.ts": `
      import { emitWebCaptureLoopStage } from "./web/capture-loop-events";
      const hidden = emitWebCaptureLoopStage;
      void hidden();
    `,
    "destructured.ts": `
      import * as loop from "./web/capture-loop-events";
      const { emitWebCaptureLoopStage: hidden } = loop;
      void hidden();
    `,
    "element.ts": `
      import * as loop from "./web/capture-loop-events";
      void loop["emitWebCaptureLoopStage"]();
    `,
    "dynamic.ts": `
      void (await import("./web/capture-loop-events")).emitWebCaptureLoopStage();
    `,
  });
  assert.deepEqual(
    [...analysis.unsupportedWrapperSites]
      .sort()
      .map((path) => path.split("/").at(-1)),
    ["destructured.ts", "dynamic.ts", "element.ts", "indirect.ts"],
  );
});

test("alias barrels and namespace combinations fail closed", async () => {
  const analysis = await fixtureAnalysis({
    "web/barrel.ts": `
      export {
        emitWebCaptureLoopStage,
        persistCaptureLoopEvent,
      } from "@/lib/capture-loop-events";
    `,
    "barrel-consumer.ts": `
      import {
        emitWebCaptureLoopStage,
        persistCaptureLoopEvent,
      } from "@/lib/barrel";
      void emitWebCaptureLoopStage();
      void persistCaptureLoopEvent();
    `,
    "namespace-destructure.ts": `
      import * as loop from "@/lib/capture-loop-events";
      const {
        emitWebCaptureLoopStage: emit,
        persistCaptureLoopEvent: persist,
      } = loop;
      void emit();
      void persist();
    `,
    "namespace-element.ts": `
      import * as loop from "@/lib/capture-loop-events";
      void loop["persistCaptureLoopEvent"]();
    `,
    "dynamic-barrel.ts": `
      void (await import("@/lib/barrel")).emitWebCaptureLoopStage();
      void (await import("@/lib/barrel"))["persistCaptureLoopEvent"]();
    `,
    "future-emitter.mts": `
      import { emitWebCaptureLoopStage } from "@/lib/barrel";
      void emitWebCaptureLoopStage();
    `,
    "dynamic-assignment.ts": `
      const {
        emitWebCaptureLoopStage: emit,
        persistCaptureLoopEvent: persist,
      } = await import("@/lib/barrel");
      void emit();
      void persist();
    `,
    "namespace-reexport.ts": `
      export * as capture from "@/lib/capture-loop-events";
    `,
    "namespace-reexport-consumer.ts": `
      import { capture } from "@/lib/namespace-reexport";
      void capture.emitWebCaptureLoopStage();
      void capture.persistCaptureLoopEvent();
    `,
    "namespace-element-extract.ts": `
      import * as loop from "@/lib/capture-loop-events";
      const persist = loop["persistCaptureLoopEvent"];
      void persist();
    `,
    "commonjs.cts": `
      declare function require(name: string): Record<string, () => void>;
      const loop = require("@/lib/capture-loop-events");
      void loop.emitWebCaptureLoopStage();
      void loop.persistCaptureLoopEvent();
    `,
    "computed-const.ts": `
      import * as loop from "./web/capture-loop-events";
      const wrapperKey = "emitWebCaptureLoopStage" as const;
      const persistenceKey = "persistCaptureLoopEvent" as const;
      void loop[wrapperKey]();
      void loop[persistenceKey]();
    `,
    "computed-composition.ts": `
      import * as loop from "./web/capture-loop-events";
      void loop["emitWeb" + "CaptureLoopStage"]();
      void loop["persistCapture" + "LoopEvent"]();
    `,
    "computed-const-composition.ts": `
      import * as loop from "./web/capture-loop-events";
      const wrapperKey = "emitWeb" + "CaptureLoopStage";
      const persistenceKey = "persistCapture" + "LoopEvent";
      void loop[wrapperKey]();
      void loop[persistenceKey]();
    `,
    "widened-key-map.ts": `
      import * as loop from "./web/capture-loop-events";
      const keys = {
        emit: "emitWebCaptureLoopStage",
        persist: "persistCaptureLoopEvent",
      };
      void loop[keys.emit]();
      void loop[keys.persist]();
    `,
    "composed-key-map.ts": `
      import * as loop from "./web/capture-loop-events";
      const keys = {
        emit: "emitWeb" + "CaptureLoopStage",
        persist: "persistCapture" + "LoopEvent",
      };
      void loop[keys.emit]();
      void loop[keys.persist]();
    `,
    "joined-key-map.ts": `
      import * as loop from "./web/capture-loop-events";
      const keys = {
        emit: ["emitWeb", "CaptureLoopStage"].join(""),
        persist: "persistCapture".concat("LoopEvent"),
      };
      void loop[keys.emit]();
      void loop[keys.persist]();
    `,
    "tuple-joined-key-map.ts": `
      import * as loop from "./web/capture-loop-events";
      const emitParts = ["emitWeb", "CaptureLoopStage"] as const;
      const persistParts = (["persistCapture", "LoopEvent"] as const);
      const keys = {
        emit: emitParts.join(""),
        persist: persistParts.join(""),
      };
      void loop[keys.emit]();
      void loop[keys.persist]();
    `,
    "object-tuple-dot-key-map.ts": `
      import * as loop from "./web/capture-loop-events";
      const registry = {
        emit: ["emitWeb", "CaptureLoopStage"] as const,
        persist: ["persistCapture", "LoopEvent"] as const,
      } as const;
      void loop[registry.emit.join("")]();
      void loop[registry.persist.join("")]();
    `,
    "object-tuple-element-key-map.ts": `
      import * as loop from "./web/capture-loop-events";
      const registry = {
        emit: ["emitWeb", "CaptureLoopStage"] as const,
        persist: ["persistCapture", "LoopEvent"] as const,
      } as const;
      void loop[registry["emit"].join("")]();
      void loop[registry["persist"].join("")]();
    `,
    "shorthand-tuple-key-map.ts": `
      import * as loop from "./web/capture-loop-events";
      const emit = ["emitWeb", "CaptureLoopStage"] as const;
      const persist = ["persistCapture", "LoopEvent"] as const;
      const registry = { emit, persist } as const;
      void loop[registry.emit.join("")]();
      void loop[registry.persist.join("")]();
    `,
    "destructured-tuple-key-map.ts": `
      import * as loop from "./web/capture-loop-events";
      const registry = {
        emit: ["emitWeb", "CaptureLoopStage"] as const,
        persist: ["persistCapture", "LoopEvent"] as const,
      } as const;
      const { emit, persist } = registry;
      void loop[emit.join("")]();
      void loop[persist.join("")]();
    `,
    "renamed-destructured-tuple-key-map.ts": `
      import * as loop from "./web/capture-loop-events";
      const registry = {
        emit: ["emitWeb", "CaptureLoopStage"] as const,
        persist: ["persistCapture", "LoopEvent"] as const,
      } as const;
      const { emit: emitParts, persist: persistParts } = registry;
      void loop[emitParts.join("")]();
      void loop[persistParts.join("")]();
    `,
    "spread-joined-key-map.ts": `
      import * as loop from "./web/capture-loop-events";
      const emitPrefix = ["emitWeb"] as const;
      const persistPrefix = ["persistCapture"] as const;
      const emit = [...emitPrefix, "CaptureLoopStage"] as const;
      const persist = [...persistPrefix, "LoopEvent"] as const;
      void loop[emit.join("")]();
      void loop[persist.join("")]();
    `,
    "quoted-namespace-destructure.ts": `
      import * as loop from "./web/capture-loop-events";
      const {
        "emitWebCaptureLoopStage": emit,
        "persistCaptureLoopEvent": persist,
      } = loop;
      void emit();
      void persist();
    `,
    "barrel-one.ts": `
      export {
        emitWebCaptureLoopStage,
        persistCaptureLoopEvent,
      } from "./web/capture-loop-events";
    `,
    "barrel-two.ts": `
      export {
        emitWebCaptureLoopStage as recordStage,
        persistCaptureLoopEvent as saveStage,
      } from "./barrel-one";
    `,
    "two-hop-dynamic.ts": `
      const { recordStage, saveStage } = await import("./barrel-two");
      void recordStage();
      void saveStage();
    `,
  });
  assert.deepEqual(
    [...analysis.wrapperCallSites].sort().map((path) => path.split("/").at(-1)),
    ["barrel-consumer.ts", "future-emitter.mts"],
  );
  assert.deepEqual(
    [...analysis.unsupportedWrapperSites]
      .sort()
      .map((path) => path.split("/").at(-1)),
    [
      "commonjs.cts",
      "composed-key-map.ts",
      "computed-composition.ts",
      "computed-const-composition.ts",
      "computed-const.ts",
      "destructured-tuple-key-map.ts",
      "dynamic-assignment.ts",
      "dynamic-barrel.ts",
      "joined-key-map.ts",
      "namespace-destructure.ts",
      "namespace-reexport-consumer.ts",
      "object-tuple-dot-key-map.ts",
      "object-tuple-element-key-map.ts",
      "quoted-namespace-destructure.ts",
      "renamed-destructured-tuple-key-map.ts",
      "shorthand-tuple-key-map.ts",
      "spread-joined-key-map.ts",
      "tuple-joined-key-map.ts",
      "two-hop-dynamic.ts",
      "widened-key-map.ts",
    ],
  );
  assert.deepEqual(
    [...analysis.lowLevelBypassSites]
      .sort()
      .map((path) => path.split("/").at(-1)),
    [
      "barrel-consumer.ts",
      "commonjs.cts",
      "composed-key-map.ts",
      "computed-composition.ts",
      "computed-const-composition.ts",
      "computed-const.ts",
      "destructured-tuple-key-map.ts",
      "dynamic-assignment.ts",
      "dynamic-barrel.ts",
      "joined-key-map.ts",
      "namespace-destructure.ts",
      "namespace-element-extract.ts",
      "namespace-element.ts",
      "namespace-reexport-consumer.ts",
      "object-tuple-dot-key-map.ts",
      "object-tuple-element-key-map.ts",
      "quoted-namespace-destructure.ts",
      "renamed-destructured-tuple-key-map.ts",
      "shorthand-tuple-key-map.ts",
      "spread-joined-key-map.ts",
      "tuple-joined-key-map.ts",
      "two-hop-dynamic.ts",
      "widened-key-map.ts",
    ],
  );
  assert.equal(
    analysis.configurationFailures.some((failure) =>
      failure.includes("indirect capture-loop namespace re-export"),
    ),
    true,
  );
});

test("direct persistence and generic constant emission cannot bypass adapters", async () => {
  const analysis = await fixtureAnalysis({
    "persistence.ts": `
      import { persistCaptureLoopEvent } from "./web/capture-loop-events";
      void persistCaptureLoopEvent();
    `,
    "indirect-persistence.ts": `
      import { persistCaptureLoopEvent } from "./web/capture-loop-events";
      const hidden = persistCaptureLoopEvent;
      void hidden();
    `,
    "generic.ts": `
      import { CAPTURE_LOOP_EVENT_NAME } from "./core";
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      void emitFamilyEvent(null, CAPTURE_LOOP_EVENT_NAME, {});
    `,
    "literal.ts": `
      declare function emitEvent(...args: unknown[]): Promise<void>;
      void emitEvent("product.loop_stage_recorded", {});
    `,
    "template.ts": `
      declare function emitMapEvent(...args: unknown[]): Promise<void>;
      void emitMapEvent(\`product.loop_stage_recorded\`, {});
    `,
    "literal-alias.ts": `
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      const eventName = "product.loop_stage_recorded" as const;
      void emitFamilyEvent(null, eventName, {});
    `,
    "plural.ts": `
      import { CAPTURE_LOOP_EVENT_NAMES } from "./core";
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      void emitFamilyEvent(null, CAPTURE_LOOP_EVENT_NAMES[0], {});
    `,
    "alias-persistence.ts": `
      import { persistCaptureLoopEvent } from "@/lib/capture-loop-events";
      void persistCaptureLoopEvent();
    `,
    "composed-event.ts": `
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      const prefix = "product.loop_" as const;
      void emitFamilyEvent(null, prefix + "stage_" + "recorded", {});
    `,
    "assigned-composed-event.ts": `
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      const eventName = "product." + "loop_stage_recorded";
      void emitFamilyEvent(null, eventName, {});
    `,
    "widened-event-map.ts": `
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      const events = { capture: "product.loop_stage_recorded" };
      void emitFamilyEvent(null, events.capture, {});
    `,
    "composed-event-map.ts": `
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      const namespace = "product.";
      const events = { capture: namespace + "loop_stage_recorded" };
      void emitFamilyEvent(null, events.capture, {});
    `,
    "joined-event.ts": `
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      const eventName = ["product", "loop_stage_recorded"].join(".");
      void emitFamilyEvent(null, eventName, {});
    `,
    "tuple-joined-event.ts": `
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      const eventParts = ["product", "loop_stage_recorded"] as const;
      const eventName = eventParts.join(".");
      void emitFamilyEvent(null, eventName, {});
    `,
    "asserted-joined-event.ts": `
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      const eventName = (["product", "loop_stage_recorded"] as const).join(".");
      void emitFamilyEvent(null, eventName, {});
    `,
    "object-tuple-dot-event.ts": `
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      const registry = {
        capture: ["product", "loop_stage_recorded"] as const,
      } as const;
      void emitFamilyEvent(null, registry.capture.join("."), {});
    `,
    "object-tuple-element-event.ts": `
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      const registry = {
        capture: ["product", "loop_stage_recorded"] as const,
      } as const;
      void emitFamilyEvent(null, registry["capture"].join("."), {});
    `,
    "shorthand-tuple-event.ts": `
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      const capture = ["product", "loop_stage_recorded"] as const;
      const registry = { capture } as const;
      void emitFamilyEvent(null, registry.capture.join("."), {});
    `,
    "destructured-tuple-event.ts": `
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      const registry = {
        capture: ["product", "loop_stage_recorded"] as const,
      } as const;
      const { capture } = registry;
      void emitFamilyEvent(null, capture.join("."), {});
    `,
    "renamed-destructured-tuple-event.ts": `
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      const registry = {
        capture: ["product", "loop_stage_recorded"] as const,
      } as const;
      const { capture: eventParts } = registry;
      void emitFamilyEvent(null, eventParts.join("."), {});
    `,
    "spread-joined-event.ts": `
      declare function emitFamilyEvent(...args: unknown[]): Promise<void>;
      const domain = ["product"] as const;
      const eventParts = [...domain, "loop_stage_recorded"] as const;
      void emitFamilyEvent(null, eventParts.join("."), {});
    `,
  });
  assert.deepEqual(
    [...analysis.lowLevelBypassSites]
      .sort()
      .map((path) => path.split("/").at(-1)),
    [
      "generic.ts",
      "alias-persistence.ts",
      "assigned-composed-event.ts",
      "asserted-joined-event.ts",
      "composed-event.ts",
      "composed-event-map.ts",
      "destructured-tuple-event.ts",
      "indirect-persistence.ts",
      "joined-event.ts",
      "literal-alias.ts",
      "literal.ts",
      "object-tuple-dot-event.ts",
      "object-tuple-element-event.ts",
      "persistence.ts",
      "plural.ts",
      "renamed-destructured-tuple-event.ts",
      "shorthand-tuple-event.ts",
      "spread-joined-event.ts",
      "template.ts",
      "tuple-joined-event.ts",
      "widened-event-map.ts",
    ].sort(),
  );
});

test("mobile aliases resolve inside the mobile app", async () => {
  const analysis = await fixtureAnalysis({
    "mobile/barrel-one.ts": `
      export { emitNativeCaptureLoopStage } from "@/lib/capture-loop-events";
    `,
    "mobile/barrel-two.ts": `
      export { emitNativeCaptureLoopStage as recordStage } from "@/lib/barrel-one";
    `,
    "mobile/journey.ts": `
      import { recordStage } from "@/lib/barrel-two";
      void recordStage();
    `,
    "mobile/dynamic-journey.ts": `
      const { recordStage } = await import("@/lib/barrel-two");
      void recordStage();
    `,
  });

  assert.deepEqual(
    [...analysis.wrapperCallSites].map((path) => path.split("/").at(-1)),
    ["journey.ts"],
  );
  assert.deepEqual(
    [...analysis.unsupportedWrapperSites]
      .sort()
      .map((path) => path.split("/").at(-1)),
    ["dynamic-journey.ts"],
  );
  assert.equal(
    analysis.configurationFailures.some((failure) =>
      failure.includes("aliased capture-loop re-export"),
    ),
    true,
  );
});

test("helpers inside a canonical adapter cannot hide journey adoption", async () => {
  const analysis = await fixtureAnalysis({
    "web/capture-loop-events.ts": `
      import { CAPTURE_LOOP_EVENT_NAME } from "../core";
      export async function persistCaptureLoopEvent(): Promise<void> {}
      export async function persistCaptureLoopEventWithSql(): Promise<void> {}
      export async function emitWebCaptureLoopStage(): Promise<void> {
        await persistCaptureLoopEvent();
        void CAPTURE_LOOP_EVENT_NAME;
      }
      export async function recordStage(): Promise<void> {
        await emitWebCaptureLoopStage();
      }
      export async function saveStage(): Promise<void> {
        await persistCaptureLoopEvent();
      }
    `,
    "mobile/capture-loop-events.ts": `
      import { CAPTURE_LOOP_EVENT_NAME } from "../core";
      async function emitFamilyEvent(..._args: unknown[]): Promise<void> {}
      export async function emitNativeCaptureLoopStage(): Promise<void> {
        await emitFamilyEvent(null, CAPTURE_LOOP_EVENT_NAME, {});
      }
      export async function recordNativeStage(): Promise<void> {
        await emitFamilyEvent(null, CAPTURE_LOOP_EVENT_NAME, {});
      }
    `,
    "hidden-adapter-consumer.ts": `
      import { recordStage, saveStage } from "./web/capture-loop-events";
      void recordStage();
      void saveStage();
    `,
    "hidden-native-adapter-consumer.ts": `
      import { recordNativeStage } from "./mobile/capture-loop-events";
      void recordNativeStage();
    `,
  });

  assert.deepEqual(
    [...analysis.unsupportedWrapperSites].map((path) => path.split("/").at(-1)),
    ["capture-loop-events.ts"],
  );
  assert.deepEqual(
    [...analysis.lowLevelBypassSites]
      .sort()
      .map((path) => path.split("/").slice(-2).join("/")),
    ["mobile/capture-loop-events.ts", "web/capture-loop-events.ts"],
  );
});

test("the authenticated relay remains an explicit low-level exception", async () => {
  const analysis = await fixtureAnalysis(
    {
      "relay.ts": `
        import { CAPTURE_LOOP_EVENT_NAME } from "./core";
        import { persistCaptureLoopEvent } from "./web/capture-loop-events";
        export async function relay(name: string): Promise<void> {
          if (name === CAPTURE_LOOP_EVENT_NAME) await persistCaptureLoopEvent();
        }
      `,
    },
    ["relay.ts"],
  );
  assert.deepEqual([...analysis.lowLevelBypassSites], []);
});

test("missing canonical symbols fail scanner configuration closed", async () => {
  const analysis = await fixtureAnalysis({
    "web/capture-loop-events.ts": `
      import { CAPTURE_LOOP_EVENT_NAME } from "../core";
      export async function persistCaptureLoopEvent(): Promise<void> {}
      export async function persistCaptureLoopEventWithSql(): Promise<void> {}
      void CAPTURE_LOOP_EVENT_NAME;
    `,
  });
  assert.deepEqual(analysis.configurationFailures, [
    "missing canonical wrapper symbol emitWebCaptureLoopStage",
  ]);
});

test("exported arrow wrappers and persistence functions remain discoverable", async () => {
  const analysis = await fixtureAnalysis({
    "web/capture-loop-events.ts": `
      import { CAPTURE_LOOP_EVENT_NAME } from "../core";
      export const persistCaptureLoopEvent = async (): Promise<void> => {};
      export const persistCaptureLoopEventWithSql = async (): Promise<void> => {};
      export const emitWebCaptureLoopStage = async (): Promise<void> => {
        await persistCaptureLoopEvent();
        void CAPTURE_LOOP_EVENT_NAME;
      };
    `,
    "arrow-consumer.ts": `
      import { emitWebCaptureLoopStage } from "./web/capture-loop-events";
      void emitWebCaptureLoopStage();
    `,
  });
  assert.deepEqual(analysis.configurationFailures, []);
  assert.deepEqual(
    [...analysis.wrapperCallSites].map((path) => path.split("/").at(-1)),
    ["arrow-consumer.ts"],
  );
});
