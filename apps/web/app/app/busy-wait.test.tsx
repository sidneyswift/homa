import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ALL_BEATS,
  BODY_GESTURES,
  EYE_GESTURES,
  ThinkingMark,
  type ThinkMood,
} from "../../components/brand/ThinkingMark";
import { EYES, HOUSE_PATH } from "../../components/brand/Logo";
import { ACT_IDS, COND_ART } from "../../components/brand/thinking-acts";
import { busyLabel, busyMood, genericBusyLabel } from "./message-parts";
import { TOOL_STATUS_LABELS } from "./tool-activity-labels";

/** The component source, read as text so the two files that must agree
 *  about act durations can be compared without exporting internals. */
const ThinkingMarkSource = readFileSync(
  join(import.meta.dirname, "..", "..", "components", "brand", "ThinkingMark.tsx"),
  "utf8",
);

/**
 * The wait: what Homa says while a turn runs, and how the little home
 * carries itself while she says it. Both escalate on one clock, and the
 * point of most of these is that they escalate on the SAME clock.
 */

/** Every group the stylesheet animates. Adding a layer means adding it
 *  here, which is what makes the reduced-motion test a real guard. */
const GROUPS = [
  "tm-arrive", "tm-lean", "tm-gesture", "tm-pop",
  "tm-bob", "tm-squish", "tm-eye", "tm-pupil", "tm-wink",
] as const;

/** Every line in every stage, for the rules that hold across all of them.
 *  The seed range must exceed the largest pool or this silently stops
 *  checking the tail of it. */
function everyLine(): string[] {
  const lines: string[] = [];
  for (const seconds of [0, 7, 20, 60]) {
    for (let seed = 0; seed < 400; seed += 1) {
      lines.push(genericBusyLabel(seconds, seed));
    }
  }
  return [...new Set(lines)];
}

/** The lines of one stage, in pool order. */
function stageLines(seconds: number): string[] {
  const seen: string[] = [];
  for (let seed = 0; seed < 400; seed += 1) {
    const line = genericBusyLabel(seconds, seed);
    if (seen.includes(line)) break;
    seen.push(line);
  }
  return seen;
}

describe("genericBusyLabel", () => {
  it("keeps the original wording at seed zero", () => {
    // The contract that lets every other caller and test stay put.
    assert.equal(genericBusyLabel(0), "thinking…");
    assert.equal(genericBusyLabel(7), "working on it…");
    assert.equal(genericBusyLabel(20), "still working…");
    assert.equal(genericBusyLabel(90), "this one is taking a while…");
  });

  it("changes stage at five, fifteen and forty five seconds", () => {
    for (let seed = 0; seed < 6; seed += 1) {
      assert.notEqual(genericBusyLabel(4, seed), genericBusyLabel(5, seed));
      assert.notEqual(genericBusyLabel(14, seed), genericBusyLabel(15, seed));
      assert.notEqual(genericBusyLabel(44, seed), genericBusyLabel(45, seed));
    }
  });

  it("holds one line for the whole stage, so the words never churn", () => {
    // A label that rewrites itself while she reads it is a slot machine.
    for (let seed = 0; seed < 6; seed += 1) {
      for (const [from, to] of [
        [0, 4],
        [5, 14],
        [15, 44],
        [45, 600],
      ]) {
        const held = genericBusyLabel(from, seed);
        for (let seconds = from; seconds <= to; seconds += 1) {
          assert.equal(genericBusyLabel(seconds, seed), held);
        }
      }
    }
  });

  it("varies the line by seed inside a stage", () => {
    for (const seconds of [0, 7, 20, 90]) {
      const seen = new Set(
        [0, 1, 2, 3, 4].map((seed) => genericBusyLabel(seconds, seed)),
      );
      assert.equal(seen.size, 5, `stage at ${seconds}s repeats a line`);
    }
  });

  it("survives any seed the caller could hand it", () => {
    // The real seed is a string hash, so it is large and often negative,
    // and a future caller could hand this something fractional.
    for (const seed of [-1, -9_999, 0.5, -0.5, 1_753_800_000, 2 ** 40]) {
      for (const seconds of [0, 7, 20, 90]) {
        const line = genericBusyLabel(seconds, seed);
        assert.equal(typeof line, "string");
        assert.ok(line.length > 0, `empty line at seed ${seed}`);
      }
    }
  });

  it("never claims a step, and never promises an ending", () => {
    // The standing law on this string (see the doc comment): a wait label
    // may only say things that are true of ANY turn at that moment. Naming
    // a step lies on the turn that is only reading a date, and "almost
    // done" lies on every turn that is not.
    const claims = [
      "almost",
      "nearly there",
      "finishing",
      "wrapping up",
      "printing",
      "writing the",
      "drawing",
      "searching",
      "saving",
      "building",
    ];
    for (const line of everyLine()) {
      for (const claim of claims) {
        assert.ok(
          !line.toLowerCase().includes(claim),
          `"${line}" claims work that may not be happening ("${claim}")`,
        );
      }
    }
  });

  it("stays in Homa's voice", () => {
    for (const line of everyLine()) {
      assert.ok(line.endsWith("…"), `"${line}" should trail off`);
      assert.ok(!line.includes("—"), `"${line}" uses an em dash`);
      assert.ok(!line.includes("..."), `"${line}" should use one ellipsis glyph`);
      assert.equal(line, line.toLowerCase(), `"${line}" should be lower case`);
      assert.ok(!line.includes("HOMA"), `"${line}" miscases the name`);
      // Everything is lower case, so a bare "i" reads as a typo rather
      // than as her. Use "my", "me", or drop the pronoun.
      assert.ok(!/\bi\b/.test(line), `"${line}" has a lower case "i" pronoun`);
      // Short enough to read at a glance beside a ticking clock.
      assert.ok(line.length <= 36, `"${line}" is too long for the busy row`);
    }
  });

  it("carries enough lines that she does not repeat herself", () => {
    // Two founder asks pull against each other here, and the later one
    // sets the floor. First: a big repertoire, not four strings on
    // rotation, because a parent waits dozens of times a day. Then
    // (2026-07-28, on reading the first attempt): every line has to be
    // interesting or delightful, and some of these are just weird.
    //
    // Padding to a count is what produced the weird ones. At forty five a
    // stage, fifty eight of the hundred and eighty lines contained the
    // word "still" and the stretch entries were idioms that wandered in
    // ("tucking into that", "having a think"). Sixteen is comfortably
    // past "four strings on rotation" and is a length that can be held to
    // the quality bar, so the floor is set where curation is still
    // possible rather than where the pool sounds impressive.
    for (const seconds of [0, 7, 20, 60]) {
      const lines = stageLines(seconds);
      assert.ok(
        lines.length >= 12,
        `stage at ${seconds}s has only ${lines.length} lines`,
      );
      assert.equal(
        new Set(lines).size,
        lines.length,
        `stage at ${seconds}s repeats a line inside its own pool`,
      );
    }
  });

  it("never reuses a line across two stages", () => {
    // A line that appears in two stages makes the escalation invisible:
    // the words would not change when the wait crossed a boundary.
    const stages = [0, 7, 20, 60].map(stageLines);
    for (let a = 0; a < stages.length; a += 1) {
      for (let b = a + 1; b < stages.length; b += 1) {
        const shared = stages[a].filter((line) => stages[b].includes(line));
        assert.deepEqual(shared, [], `stages ${a} and ${b} share a line`);
      }
    }
  });
});

describe("busyLabel wording per turn", () => {
  const userTurn = (id: string) =>
    [{ id, role: "user", parts: [{ type: "text", text: "hi" }] }] as never;

  it("says the same thing all turn for one message", () => {
    // The seed is the id of the message she is answering, so it cannot move
    // while she answers it.
    for (const seconds of [0, 3, 7, 12, 20, 40, 60, 300]) {
      assert.equal(
        busyLabel(userTurn("turn_7:user"), seconds),
        busyLabel(userTurn("turn_7:user"), seconds),
      );
    }
  });

  it("does not open every turn with the same word", () => {
    const openings = new Set(
      ["turn_1:user", "turn_2:user", "turn_3:user", "turn_4:user", "turn_5:user"].map(
        (id) => busyLabel(userTurn(id), 0),
      ),
    );
    assert.ok(openings.size > 1, "every turn opens on the same line");
  });

  it("falls back to the original wording with nothing to answer", () => {
    assert.equal(busyLabel([], 0), "thinking…");
    assert.equal(busyLabel([], 90), "this one is taking a while…");
  });
});

describe("busyMood", () => {
  it("changes gear exactly where the words do", () => {
    // The claim the busy row makes on screen: seconds, mood and words are
    // one reading of one wait. If these ever drift apart, the character
    // starts performing on a schedule of its own.
    let lastMood: ThinkMood = busyMood(0);
    let lastLine = genericBusyLabel(0);
    for (let seconds = 1; seconds <= 120; seconds += 1) {
      const mood = busyMood(seconds);
      const line = genericBusyLabel(seconds);
      assert.equal(
        mood !== lastMood,
        line !== lastLine,
        `mood and label disagree about the stage at ${seconds}s`,
      );
      lastMood = mood;
      lastLine = line;
    }
  });

  it("walks the four moods in order and then holds", () => {
    assert.equal(busyMood(0), "settling");
    assert.equal(busyMood(4), "settling");
    assert.equal(busyMood(5), "working");
    assert.equal(busyMood(14), "working");
    assert.equal(busyMood(15), "digging");
    assert.equal(busyMood(44), "digging");
    assert.equal(busyMood(45), "long");
    assert.equal(busyMood(3600), "long");
  });
});

describe("ThinkingMark", () => {
  it("draws the real mark rather than a lookalike", () => {
    // brand-casing-homa (2026-07-28): where the brand appears as a mark it
    // is THE mark. The character animates the logo's own geometry, so a
    // change to the logo can never leave a stale copy behind here.
    const html = renderToStaticMarkup(<ThinkingMark />);
    assert.ok(html.includes(HOUSE_PATH), "house path is not the logo's");
    for (const eye of EYES) {
      assert.ok(
        html.includes(`cx="${eye.cx}"`) && html.includes(`cx="${eye.pupilCx}"`),
        `eye at ${eye.cx} is not the logo's`,
      );
    }
  });

  it("carries the mood so the CSS can pick up the clock", () => {
    for (const mood of ["settling", "working", "digging", "long"] as const) {
      assert.ok(
        renderToStaticMarkup(<ThinkingMark mood={mood} />).includes(
          `data-mood="${mood}"`,
        ),
      );
    }
  });

  it("stays out of the accessibility tree", () => {
    // The label beside it is what a screen reader should read; a bobbing
    // house announcing itself would just be noise on every turn.
    assert.ok(renderToStaticMarkup(<ThinkingMark />).includes('aria-hidden="true"'));
  });

  it("hangs every animated group on a class the stylesheet drives", () => {
    const html = renderToStaticMarkup(<ThinkingMark />);
    for (const hook of GROUPS) {
      assert.ok(html.includes(hook), `${hook} is not in the markup`);
    }
  });

  it("starts still, so the server and the first client render agree", () => {
    // The repertoire is scheduled in an effect. If a flourish were picked
    // during render it would differ between server and client and blow up
    // hydration, and every mark on the page would start mid-spin.
    const html = renderToStaticMarkup(<ThinkingMark mood="digging" />);
    assert.ok(!html.includes("data-gesture"), "renders mid-gesture");
    assert.ok(!html.includes("data-eye"), "renders mid-expression");
  });
});

describe("the repertoire", () => {
  const css = readFileSync(join(import.meta.dirname, "..", "globals.css"), "utf8");

  /** Every one-shot rule in the stylesheet: attribute value, target group,
   *  keyframe name and duration. */
  function gestureRules() {
    return [
      ...css.matchAll(
        /\.tm\[data-(gesture|eye)="([\w-]+)"\]\s+\.(tm-[\w-]+)\s*\{\s*animation:\s*(tm-g-[\w-]+)\s+(\d+)ms/g,
      ),
    ].map((m) => ({
      channel: m[1], value: m[2], group: m[3], frames: m[4], ms: Number(m[5]),
    }));
  }

  it("gives every gesture the CSS it names", () => {
    // The bug this exists for: a beat naming a gesture the stylesheet does
    // not define fails silently. The character just never does it, and
    // nothing anywhere says so.
    const rules = gestureRules();
    for (const body of BODY_GESTURES) {
      const rule = rules.find((r) => r.channel === "gesture" && r.value === body);
      assert.ok(rule, `no CSS rule for body gesture "${body}"`);
      assert.ok(
        css.includes(`@keyframes ${rule.frames} {`),
        `${rule.frames} has a rule but no keyframes`,
      );
    }
    for (const eye of EYE_GESTURES) {
      const rule = rules.find((r) => r.channel === "eye" && r.value === eye);
      assert.ok(rule, `no CSS rule for eye gesture "${eye}"`);
      assert.ok(
        css.includes(`@keyframes ${rule.frames} {`),
        `${rule.frames} has a rule but no keyframes`,
      );
    }
  });

  it("defines no CSS gesture the repertoire cannot reach", () => {
    for (const rule of gestureRules()) {
      const known: readonly string[] =
        rule.channel === "gesture" ? BODY_GESTURES : EYE_GESTURES;
      assert.ok(known.includes(rule.value), `"${rule.value}" is dead CSS`);
    }
  });

  it("holds each beat on screen long enough to finish its move", () => {
    // The attribute comes off after `ms`. Come off early and the animation
    // is cut mid-move and snaps back, which reads as a glitch.
    const rules = gestureRules();
    for (const beat of ALL_BEATS) {
      const channels = [
        beat.body ? rules.find((r) => r.channel === "gesture" && r.value === beat.body) : null,
        beat.eye ? rules.find((r) => r.channel === "eye" && r.value === beat.eye) : null,
      ].filter(Boolean) as { ms: number; frames: string }[];
      // An ACT drives its own channels in thinking-acts.css instead of the
      // gesture/eye ones checked here; the "Homa's acts" suite below is
      // what holds acts to the same rule.
      if (beat.act) continue;
      assert.ok(channels.length > 0, `beat "${beat.id}" drives no channel`);
      for (const channel of channels) {
        assert.ok(
          beat.ms >= channel.ms,
          `beat "${beat.id}" is pulled after ${beat.ms}ms but ${channel.frames} runs ${channel.ms}ms`,
        );
      }
    }
  });

  it("runs every flourish exactly once", () => {
    // An infinite flourish is the thing this whole design avoids.
    for (const rule of gestureRules()) {
      const declaration = css.slice(css.indexOf(`animation: ${rule.frames}`));
      const value = declaration.slice(0, declaration.indexOf(";"));
      assert.ok(
        / 1$/.test(value.trim()),
        `${rule.frames} does not end on an iteration count of 1: "${value.trim()}"`,
      );
    }
  });
});

describe("thinking mark stylesheet", () => {
  const css = readFileSync(
    join(import.meta.dirname, "..", "globals.css"),
    "utf8",
  );

  it("stops every loop under reduced motion", () => {
    // Five infinite loops is exactly the shape of motion that makes some
    // people ill. Each animated class must be named in the reduce block,
    // and a sixth one added later must be added there too.
    const reduceBlocks = css
      .split("@media (prefers-reduced-motion: reduce), print {")
      .slice(1)
      .join("\n");
    for (const hook of GROUPS) {
      assert.ok(
        reduceBlocks.includes(`.${hook}`),
        `.${hook} keeps animating under prefers-reduced-motion`,
      );
    }
  });

  it("winks only in the middle of a wait", () => {
    // A wink has no time to land under five seconds, and a parent waiting
    // on something genuinely slow should not be winked at. The markup
    // always ships the group; this gate is the whole behaviour.
    const gate = css.match(
      /((?:\.tm\[data-mood="\w+"\] \.tm-wink,?\s*)+)\{\s*animation: tm-wink/,
    );
    assert.ok(gate, "the wink is not gated by mood at all");
    assert.ok(gate[1].includes('data-mood="working"'));
    assert.ok(gate[1].includes('data-mood="digging"'));
    assert.ok(!gate[1].includes('data-mood="long"'), "winks at a stuck parent");
    assert.ok(!gate[1].includes('data-mood="settling"'), "winks before it can land");
  });

  it("moves only transforms and opacity", () => {
    // A loop that runs for a minute beside streaming text must not be able
    // to trigger layout or repaint the surface around it.
    const frames = css.matchAll(/@keyframes (tm-[\w-]+) \{([\s\S]*?)\n\}/g);
    const seen: string[] = [];
    for (const [, name, body] of frames) {
      seen.push(name);
      for (const declaration of body.matchAll(/([a-z-]+)\s*:/g)) {
        assert.ok(
          ["transform", "opacity"].includes(declaration[1]),
          `@keyframes ${name} animates ${declaration[1]}`,
        );
      }
    }
    assert.ok(seen.length >= 7, `only found ${seen.length} keyframe sets`);
  });
});

describe("Homa's acts", () => {
  const actCss = readFileSync(
    join(import.meta.dirname, "..", "thinking-acts.css"),
    "utf8",
  );

  it("gives every act a body, a face and a gaze", () => {
    // The senior animator's first note (2026-07-29), and the one most
    // likely to be undone by accident: an act that does not claim
    // .tm-eye and .tm-pupil leaves them dead, because the stand-down
    // rule kills the ambient blink and gaze for the act's duration.
    // Before this rule, eighteen of twenty one acts had no face at all
    // and she could WINK mid way through melting into a puddle.
    for (const id of ACT_IDS) {
      for (const channel of ["tm-act", "tm-eye", "tm-pupil"]) {
        const rule = new RegExp(
          `\\.tm\\[data-act="${id}"\\][^{]*\\.${channel}\\b[^{]*\\{[^}]*animation:`,
        );
        assert.ok(
          rule.test(actCss),
          `act "${id}" never drives .${channel}`,
        );
      }
    }
  });

  it("keeps every act's attribute on for exactly as long as its animation", () => {
    // The beat's `ms` holds data-act on the element. Come off early and
    // the act is cut mid move; stay on late and a prop is left frozen on
    // screen. These are written in two files and drift silently.
    // Beats now span several lines and carry gates and consequences, so the
    // pair is read per beat object rather than off one fixed line shape.
    const declared = new Map<string, number>();
    for (const [, body] of ThinkingMarkSource.matchAll(/\{\s*(id: "\w+",[\s\S]*?)\},?\n/g)) {
      const id = body.match(/id: "(\w+)"/);
      const act = body.match(/act: "(\w+)"/);
      const ms = body.match(/\bms: (\d+)/);
      if (id && act && ms) declared.set(id[1], Number(ms[1]));
    }
    for (const [, id, ms] of actCss.matchAll(
      /\.tm\[data-act="(\w+)"\]\s+\.tm-act\s*\{\s*animation:\s*[\w-]+\s+(\d+)ms/g,
    )) {
      assert.equal(
        declared.get(id),
        Number(ms),
        `act "${id}": stylesheet says ${ms}ms, the beat says ${declared.get(id)}ms`,
      );
    }
    assert.equal(declared.size, ACT_IDS.length, "an act has no beat");
  });

  it("gates the big acts so a short wait can never see them", () => {
    // The gate IS the act for these. `seesyou` at eight seconds would be a
    // trick; at ninety seconds it is the app noticing she is still sitting
    // there. And a once-per-wait act stops being big the second it repeats.
    const gated = [...ThinkingMarkSource.matchAll(
      /\{\s*id: "(\w+)"[^}]*?minSeconds: (\d+)/g)];
    const byId = new Map(gated.map(([, id, secs]) => [id, Number(secs)]));
    assert.ok((byId.get("seesyou") ?? 0) >= 60, "seesyou is not reserved for a long wait");
    for (const id of ["seesyou", "lodger", "split"]) {
      assert.ok(byId.has(id), `${id} has no minSeconds gate`);
      assert.ok(
        new RegExp(`\\{\\s*id: "${id}"[^}]*?once: true`).test(ThinkingMarkSource),
        `${id} can repeat, which is what makes a big act stop being big`,
      );
    }
  });

  it("keeps a consequence alive past the act that caused it", () => {
    // The difference between twenty short films and one wait. An act that
    // declares `sets` must have condition art to mount, or the consequence
    // is invisible and the whole point is lost.
    const sets = [...ThinkingMarkSource.matchAll(/sets: \[\{ id: "([\w-]+)"/g)]
      .map(([, id]) => id);
    assert.ok(sets.length > 0, "no act leaves anything behind");
    for (const id of sets) {
      assert.ok(COND_ART[id], `condition "${id}" has no art, so it cannot be seen`);
    }
  });

  it("only pays off something that was actually set up", () => {
    // A payoff with no set-up is a character being pleased about nothing,
    // which is exactly what sparkle used to be.
    const arms = new Set([...ThinkingMarkSource.matchAll(/arms: "(\w+)"/g)].map(([, a]) => a));
    const pays = [...ThinkingMarkSource.matchAll(/pays: "(\w+)"/g)].map(([, p]) => p);
    assert.ok(pays.length > 0, "nothing pays anything off");
    for (const p of pays) {
      assert.ok(arms.has(p), `"${p}" is paid off but never armed`);
    }
  });

  it("keys only honest acts to real work, and only once", () => {
    // The standing law on the busy row is that it may never claim work that
    // is not happening. That binds the character too: an act may be BIASED
    // by a running tool, never used to assert one. So the pairing has to be
    // true by construction (she draws while a page is genuinely being made)
    // and it has to be `once`, or it degrades into a status light that
    // asserts a tool is running every time it fires.
    const keyed = [...ThinkingMarkSource.matchAll(
      /\{\s*(id: "\w+",[\s\S]*?whenTool:[\s\S]*?)\},?\n/g)].map(([, body]) => body);
    assert.ok(keyed.length > 0, "nothing is keyed to real work");
    for (const body of keyed) {
      const id = body.match(/id: "(\w+)"/)![1];
      assert.ok(/once: true/.test(body), `"${id}" is keyed to a tool but can repeat`);
      const tools = [...body.matchAll(/"(\w+)"/g)].map(([, t]) => t);
      assert.ok(tools.length > 1, `"${id}" names no tools`);
    }
  });

  it("only names tools the product actually has", () => {
    // A pairing against a tool that does not exist is a pairing that can
    // never fire, and it would fail silently forever.
    const known = new Set(Object.keys(TOOL_STATUS_LABELS));
    const named = [...ThinkingMarkSource.matchAll(/whenTool: \[([^\]]+)\]/g)]
      .flatMap(([, list]) => [...list.matchAll(/"(\w+)"/g)].map(([, t]) => t));
    assert.ok(named.length > 0);
    for (const tool of named) {
      assert.ok(known.has(tool), `"${tool}" is not a tool this product has`);
    }
  });

  it("leaves room to breathe between acts", () => {
    // Founder note 2026-07-29: one act every three seconds "seems
    // excessive". Acts run 1.4 to 4.2s, so a gap under about 4s puts her
    // performing more than she is simply alive, and the ambient loop is
    // what a parent actually watches.
    const gaps = [...ThinkingMarkSource.matchAll(
      /(\w+): \{ first: \[(\d+), (\d+)\], between: \[([\d_]+), ([\d_]+)\] \}/g)];
    assert.equal(gaps.length, 4, "expected four stages");
    for (const [, stage, firstMin, , betweenMin] of gaps) {
      assert.ok(
        Number(firstMin) >= 1800,
        `${stage} performs within ${firstMin}ms of arriving`,
      );
      assert.ok(
        Number(betweenMin.replace(/_/g, "")) >= 4500,
        `${stage} repeats every ${betweenMin}ms, which reads as a toy`,
      );
    }
  });

  it("stops every act under reduced motion", () => {
    const reduce = actCss
      .split("@media (prefers-reduced-motion: reduce), print {")
      .slice(1)
      .join("\n");
    assert.ok(reduce.includes(".tm[data-act] .tm-act"), "acts keep moving");
    assert.ok(reduce.includes(".tm[data-act] .tm-eye"), "faces keep moving");
    assert.ok(reduce.includes(".tm[data-act] .tm-pupil"), "gazes keep moving");
  });

  it("keeps the ambient loops cheap even though acts may paint", () => {
    // Acts run about a second and may animate fill and stroke-dashoffset.
    // The AMBIENT loops run for the length of a whole wait, so they stay
    // transform and opacity only. That split is deliberate, and this is
    // the guard on it.
    const ambient = readFileSync(
      join(import.meta.dirname, "..", "globals.css"),
      "utf8",
    );
    for (const [, name, body] of ambient.matchAll(/@keyframes (tm-[\w-]+) \{([\s\S]*?)\n\}/g)) {
      for (const [, prop] of body.matchAll(/([a-z-]+)\s*:/g)) {
        assert.ok(
          ["transform", "opacity"].includes(prop),
          `ambient @keyframes ${name} animates ${prop}`,
        );
      }
    }
  });

  it("keeps prop strokes thick enough to survive the ship size", () => {
    // At 28px one viewBox unit is 0.583 device pixels, so a 1.1 unit
    // stroke renders at 0.64px and disappears. The animator measured
    // thirteen of twenty one acts as illegible before this floor.
    for (const [, width] of actCss.matchAll(/stroke-width:\s*([\d.]+)/g)) {
      assert.ok(
        Number(width) >= 2,
        `a prop stroke is ${width} units, which is sub pixel at ship size`,
      );
    }
  });
});
