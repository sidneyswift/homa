"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";

import { EYES, HOUSE_BASE, HOUSE_PATH, PUPIL_FILL } from "./Logo";
import { ACT_ART, COND_ART } from "./thinking-acts";

/**
 * The little home, thinking. The same art as `Logo` (imported, never
 * redrawn: the mark is the mark, brand-casing-homa 2026-07-28) with the
 * pieces split into their own groups so each one can move on its own.
 *
 * Why a character and not a spinner: the wait is the moment a parent is
 * most likely to wonder whether the app is broken (evidence memo 1,
 * MJ-06). A spinner says "a process is running". A face that breathes,
 * blinks, looks around and now and then does something says "someone is
 * here with you", which is the thing she actually wants to know.
 *
 * Two layers, and the split is the whole design:
 *
 * 1. THE AMBIENT LOOP, always running. Breath, squash and stretch, a
 *    slow rock, blinking, the occasional wink, a wandering gaze. Calm on
 *    purpose. This is what a parent sees most of the time.
 * 2. THE REPERTOIRE, now and then. A spin, a shake, a pop, a twist, a
 *    hop, a stretch, a wobble, a peek, an eye roll. One at a time, a few
 *    seconds apart, picked at random and never the same one twice
 *    running.
 *
 * Doing it the other way round is the trap. A spin that runs constantly
 * is nauseating within about fifteen seconds and unreadable behind
 * streaming text; a spin that happens once, unannounced, while a parent
 * waits is a small gift. Rarity is the entire reason the flourishes
 * work, so the gaps below are as much a part of this as the keyframes.
 *
 * The rig, outside in, one transform per group so nothing fights:
 *
 *   tm-lean     rocks on its feet, slow, own cycle          ambient
 *   tm-gesture  the turning and travelling flourishes       repertoire
 *   tm-pop      the swelling flourishes, grown from the base repertoire
 *   tm-bob      the breath, up and down                     ambient
 *   tm-squish   squash and stretch, scaled from the base    ambient
 *   tm-eye      both eyes blink together                    ambient
 *   tm-wink     one eye, rarely, alone                      ambient
 *   tm-pupil    the gaze, both pupils tracking together     ambient
 *
 * The ambient loops run at deliberately unrelated durations (1150, 3700,
 * 5300, 4300, 10300ms), so even with the repertoire switched off the
 * combination effectively never repeats. A single loop reads as a loop
 * within about three cycles; five coprime ones read as something alive.
 *
 * `mood` steps both layers through the same clock the wait label
 * escalates on (`busyMood` in app/app/message-parts.tsx owns the
 * thresholds), so the character changes gear at the same moment the
 * words do rather than performing on its own schedule. It sets the
 * ambient dials AND which flourishes are in the repertoire: shaking and
 * buzzing while she digs, stretching and wobbling once the wait is long,
 * because a shiver at ninety seconds reads as panic.
 *
 * Every layer is transform and opacity only, and all of it stops under
 * prefers-reduced-motion, where the mark rests as the plain logo and the
 * scheduler below never even starts a timer.
 */

/** How long the wait has been going, in the character's terms. */
export type ThinkMood = "settling" | "working" | "digging" | "long";

/**
 * One flourish. `body` and `eye` name the CSS channels it drives (see the
 * `tm-g-*` keyframes in globals.css); `ms` is how long the attribute stays
 * on, which must cover the longest channel or the animation is cut off
 * mid-move. A beat may drive one channel or both: both is how "an idea"
 * gets to be a pop and wide eyes at the same time.
 */
interface Beat {
  id: string;
  body?: string;
  eye?: string;
  /** An ACT: a whole piece of business with its own props (thinking-acts.tsx
   *  for the art, app/thinking-acts.css for the timing). Where `body` and
   *  `eye` can only move the pieces that already exist, an act brings its
   *  own crayon, balloon or dust cloud on for the length of the beat. */
  act?: string;
  ms: number;
  /** Conditions this beat leaves behind, and for how long. THE thing the
   *  library lacked: every act used to be a closed loop that returned to
   *  zero, so nothing she did ever cost her anything or survived her doing
   *  it. A dusty Homa who is STILL dusty when the next act starts is what
   *  turns twenty performances into one wait. */
  sets?: readonly { id: string; ms: number }[];
  /** Fire only once per wait, however long the wait runs. For the big ones,
   *  which stop being big the second they repeat. */
  once?: boolean;
  /** Not eligible until the wait has run this long. A parent who waits two
   *  minutes should get something a parent who waits eight seconds never
   *  sees. */
  minSeconds?: number;
  /** Sets up a payoff that a later beat collects, so the shuffle can build
   *  instead of only shuffling. */
  arms?: string;
  /** Only eligible once `arms` of the same name has fired, and preferred
   *  when it has. */
  pays?: string;
  /** Tools that make this act TRUE right now. She draws while a page is
   *  genuinely being made, which is the one honest way to tie the character
   *  to the work: the act is biased by the tool, never used to assert it.
   *  Pair with `once` so it lands as a moment rather than a status light. */
  whenTool?: readonly string[];
}

const BEAT = {
  pop: { id: "pop", body: "pop", ms: 600 },
  twist: { id: "twist", body: "twist", ms: 740 },
  nod: { id: "nod", body: "nod", ms: 760 },
  hop: { id: "hop", body: "hop", ms: 820 },
  shake: { id: "shake", body: "shake", ms: 660 },
  buzz: { id: "buzz", body: "buzz", ms: 740 },
  spin: { id: "spin", body: "spin", ms: 940 },
  roll: { id: "roll", body: "roll", ms: 1140 },
  wobble: { id: "wobble", body: "wobble", ms: 940 },
  peek: { id: "peek", body: "peek", ms: 1040 },
  stretch: { id: "stretch", body: "stretch", ms: 1240 },
  // Both channels: the flourish and the face agree about what just happened.
  tilt: { id: "tilt", body: "tilt", eye: "roll", ms: 1140 },
  idea: { id: "idea", body: "pop", eye: "wide", ms: 740 },
  doubleTake: { id: "doubleTake", body: "twist", eye: "doubletake", ms: 840 },
  // Face only: small enough to land while she is otherwise still.
  squint: { id: "squint", eye: "squint", ms: 1140 },
  eyeRoll: { id: "eyeRoll", eye: "roll", ms: 940 },

  // The acts. Durations MUST match the animation-duration in
  // app/thinking-acts.css: the attribute coming off early cuts the act
  // mid move, and staying on late leaves a prop frozen on screen. A test
  // reads both files and fails when they disagree.
  balloon: { id: "balloon", act: "balloon", ms: 2400 },
  // Leaves her grubby, and the grime outlives the act by eight seconds.
  dust: { id: "dust", act: "dust", ms: 1400, sets: [{ id: "grimy", ms: 11_000 }] },
  melt: { id: "melt", act: "melt", ms: 2400 },
  rocket: { id: "rocket", act: "rocket", ms: 2200 },
  pancake: { id: "pancake", act: "pancake", ms: 2000 },
  jelly: { id: "jelly", act: "jelly", ms: 1400 },
  door: { id: "door", act: "door", ms: 1450, arms: "worked" },
  // Keyed to real work: she draws WHILE a page is genuinely being made.
  // Once per wait, so it reads as a moment rather than a status light.
  crayon: {
    id: "crayon", act: "crayon", ms: 2100, arms: "worked", once: true,
    whenTool: ["create_printable", "start_first_making", "generate_image", "show_material"],
  },
  bulb: { id: "bulb", act: "bulb", ms: 2000, arms: "worked" },
  bubble: { id: "bubble", act: "bubble", ms: 1500 },
  mug: { id: "mug", act: "mug", ms: 1500 },
  plane: { id: "plane", act: "plane", ms: 1500 },
  // The other honest pairing: she has a closer look while something is
  // genuinely being looked up.
  magnify: {
    id: "magnify", act: "magnify", ms: 1600, once: true,
    whenTool: ["get_children", "find_materials", "search_photos", "list_family_events", "load_skill"],
  },
  // Payoff only: a curtain call after she has actually made something,
  // rather than a character being pleased about nothing.
  sparkle: { id: "sparkle", act: "sparkle", ms: 1300, pays: "worked" },
  snooze: { id: "snooze", act: "snooze", ms: 2600 },
  rain: { id: "rain", act: "rain", ms: 1800 },
  juggle: { id: "juggle", act: "juggle", ms: 1600 },
  windup: { id: "windup", act: "windup", ms: 1700 },
  sneeze: { id: "sneeze", act: "sneeze", ms: 2000 },
  // Ninety seconds in, once ever. The gate IS the act: if a parent could
  // see this in an eight second wait it would be a trick, and at two
  // minutes it is the app noticing she is still sitting there.
  seesyou: { id: "seesyou", act: "seesyou", ms: 3400, once: true, minSeconds: 90 },
  // The first peek arms the passenger; the condition is what puts the
  // creature on her roof for everything she does afterwards.
  lodger: {
    id: "lodger", act: "lodger", ms: 2200, once: true, minSeconds: 25,
    sets: [{ id: "lodger-out", ms: 60_000 }],
  },
  split: { id: "split", act: "split", ms: 2400, once: true, minSeconds: 40, arms: "worked" },
  // The longest act in the library, and the only one whose result outlives
  // the wait that produced it.
  build: {
    id: "build", act: "build", ms: 4200, once: true, minSeconds: 55,
    arms: "worked", sets: [{ id: "built", ms: 120_000 }],
  },
  // Acknowledges THIS wait: not that waiting happens, but that it is now
  // forty seconds and she can see the number too.
  timer: { id: "timer", act: "timer", ms: 1900, minSeconds: 30 },
} as const satisfies Record<string, Beat>;

/** What she is liable to do at each point in the wait. Light and greeting
 *  at the start, busiest while she digs, bigger and slower once it is long. */
const REPERTOIRE: Record<ThinkMood, readonly Beat[]> = {
  // Under five seconds there is only room for something quick and bright,
  // and most turns end here, so this pool stays light on its feet.
  settling: [
    BEAT.bulb, BEAT.sparkle, BEAT.bubble, BEAT.door, BEAT.doubleTake,
    BEAT.nod, BEAT.pop, BEAT.twist,
  ],
  // Properly working: making things, fetching things, having ideas.
  working: [
    BEAT.crayon, BEAT.mug, BEAT.plane, BEAT.bubble, BEAT.bulb,
    BEAT.juggle, BEAT.magnify, BEAT.sparkle,
    BEAT.twist, BEAT.hop, BEAT.doubleTake,
  ],
  // Digging: the effortful, undignified ones. This is where she is
  // allowed to spin herself into a dust cloud.
  digging: [
    BEAT.dust, BEAT.balloon, BEAT.magnify, BEAT.windup, BEAT.pancake,
    BEAT.jelly, BEAT.sneeze, BEAT.juggle, BEAT.crayon, BEAT.lodger, BEAT.split,
    BEAT.timer,
    BEAT.squint, BEAT.shake,
  ],
  // Long: bigger and slower, and the two that acknowledge the wait
  // outright. Nothing frantic, because frantic at ninety seconds reads
  // as panic rather than as effort.
  long: [
    BEAT.snooze, BEAT.rain, BEAT.melt, BEAT.rocket, BEAT.balloon,
    BEAT.mug, BEAT.stretch, BEAT.tilt,
    BEAT.seesyou, BEAT.lodger, BEAT.split, BEAT.sparkle, BEAT.build, BEAT.timer,
  ],
};

/** The quiet between flourishes, in milliseconds, picked at random inside
 *  each range. `first` is shorter than `between` so a turn that only lasts
 *  four seconds still gets to see something happen. */
const GAP: Record<ThinkMood, { first: readonly [number, number]; between: readonly [number, number] }> = {
  // Two dials, and the second one is the one that matters. The gaps below
  // are roughly double what they were, because at one act every three
  // seconds she read as a toy performing rather than as someone working who
  // occasionally does something. Acts run 1.4 to 4.2s, so these gaps put
  // her on screen doing something about a fifth of the time and simply
  // being alive the rest of it. The ambient loop is the product; the acts
  // are the garnish.
  //
  // A turn that resolves in two seconds should show a calm, breathing mark
  // and NOTHING else.
  settling: { first: [2600, 4600], between: [7000, 12_000] },
  working: { first: [2400, 4200], between: [6000, 10_500] },
  // Busiest while she digs, because that is when effort is the honest read.
  digging: { first: [2000, 3600], between: [5000, 9000] },
  // Slower and bigger once it is long: at ninety seconds, frantic reads as
  // panic and spectacle reads as the app playing while she is stuck.
  long: { first: [2800, 4800], between: [6500, 12_000] },
};

/** Every channel value the CSS must define, exported so a test can prove
 *  the stylesheet and the repertoire have not drifted apart, and so the
 *  dev bench can enumerate them instead of hand-listing them. */
export const BODY_GESTURES = [
  "pop", "twist", "nod", "hop", "shake", "buzz",
  "spin", "roll", "wobble", "peek", "stretch", "tilt",
] as const;
export const EYE_GESTURES = ["roll", "wide", "doubletake", "squint"] as const;
export const ALL_BEATS: readonly Beat[] = Object.values(BEAT);

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function motionIsReduced(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION).matches;
}

/**
 * Picks a flourish, performs it, rests, repeats. Returns whichever beat is
 * running right now, or null during the quiet.
 *
 * Randomness lives here rather than in CSS because CSS cannot be random:
 * a stylesheet can only offer the same flourish on the same cycle, which
 * is a loop wearing a costume. Every setState happens inside a timer
 * callback, never in the effect body.
 */
/** What the scheduler hands the component: the beat running now, whatever
 *  conditions are still in force from earlier beats, and how many beats
 *  deep into this wait we are. */
export interface Performance {
  beat: Beat | null;
  conditions: readonly string[];
  index: number;
}

function useRepertoire(mood: ThinkMood, seconds: number, tool: string | null): Performance {
  const reduced = useSyncExternalStore(
    subscribeToMotionPreference,
    motionIsReduced,
    () => false,
  );
  const [state, setState] = useState<Performance>({
    beat: null,
    conditions: [],
    index: 0,
  });
  // The clock the gates read. Kept in a ref so a new second does not restart
  // the scheduler and cut whatever is mid performance, and written in an
  // effect rather than during render. The gates only read it inside a timer
  // callback, which always runs after the commit.
  const secondsRef = useRef(seconds);
  const toolRef = useRef(tool);
  useEffect(() => {
    secondsRef.current = seconds;
    toolRef.current = tool;
  }, [seconds, tool]);

  useEffect(() => {
    // Under reduced motion the CSS already suppresses every flourish; not
    // scheduling them at all means no timers and no pointless renders.
    // Nothing to clear here: the hook returns a null beat while reduced, so
    // a beat left in state from before the preference changed cannot render.
    if (reduced) return;
    let timer: ReturnType<typeof setTimeout>;
    let previous = "";
    let index = 0;
    /** condition id -> when it stops applying. */
    const conditions = new Map<string, number>();
    /** payoff name -> when it became eligible. */
    const armed = new Map<string, number>();
    const spent = new Set<string>();

    const live = (now: number) => {
      for (const [id, until] of conditions) if (until <= now) conditions.delete(id);
      return [...conditions.keys()];
    };

    const rest = (opening: boolean) => {
      const gap = GAP[mood];
      const [min, max] = opening ? gap.first : gap.between;
      timer = setTimeout(perform, min + Math.random() * (max - min));
    };

    const perform = () => {
      const now = Date.now();
      const secs = secondsRef.current;
      const running = toolRef.current;
      const pool = REPERTOIRE[mood].filter((option) => {
        if (option.id === previous) return false;
        if (option.once && spent.has(option.id)) return false;
        if (option.minSeconds !== undefined && secs < option.minSeconds) return false;
        // A payoff is only allowed once its set-up has actually happened,
        // and only after a beat has passed, so the pair reads as a callback
        // rather than as one long act.
        if (option.pays) {
          const at = armed.get(option.pays);
          if (at === undefined || now - at < 1200) return false;
        }
        return true;
      });
      // An act keyed to the tool that is running right now takes precedence
      // over everything else, because it is the one moment where what she is
      // doing and what the app is doing are the same thing.
      const onTool = running
        ? pool.filter((option) => option.whenTool?.includes(running))
        : [];
      if (pool.length === 0) { rest(false); return; }
      // A ready payoff jumps the queue: that is what makes the shuffle feel
      // like it is going somewhere.
      const payoffs = pool.filter((option) => option.pays);
      const choices = onTool.length > 0
        ? onTool
        : payoffs.length > 0 && Math.random() < 0.75 ? payoffs : pool;
      const next = choices[Math.floor(Math.random() * choices.length)];

      previous = next.id;
      index += 1;
      if (next.once) spent.add(next.id);
      if (next.arms) armed.set(next.arms, now);
      if (next.pays) armed.delete(next.pays);
      for (const c of next.sets ?? []) conditions.set(c.id, now + c.ms);

      setState({ beat: next, conditions: live(now), index });
      // Clear the beat before resting, so picking the same one later still
      // restarts the animation rather than leaving the attribute set. The
      // conditions deliberately do NOT clear with it.
      timer = setTimeout(() => {
        setState((current) => ({
          beat: null,
          conditions: live(Date.now()),
          index: current.index,
        }));
        rest(false);
      }, next.ms);
    };

    rest(true);
    return () => clearTimeout(timer);
  }, [mood, reduced]);

  return reduced ? { beat: null, conditions: [], index: 0 } : state;
}

export function ThinkingMark({
  size = 28,
  mood = "settling",
  className = "",
  style = {},
  hold,
  seconds = 0,
  tool = null,
}: {
  size?: number;
  mood?: ThinkMood;
  className?: string;
  style?: CSSProperties;
  /** Pins one flourish instead of scheduling the repertoire. Only the dev
   *  bench passes this, to show every gesture at once; in the product the
   *  whole point is that nobody chooses which one happens. */
  hold?: { body?: string; eye?: string; act?: string; cond?: readonly string[] };
  /** How long the wait has run. The gates read it, so the acts reserved for
   *  a long wait can exist at all. */
  seconds?: number;
  /** The tool running right now, if any. A couple of acts are keyed to real
   *  work; everything else ignores it. */
  tool?: string | null;
}) {
  // A gear change is an event, not a settings change. When the wait crosses
  // into a new stage the dials used to swap silently mid loop; now she
  // visibly registers it, which is the moment the escalation becomes
  // something she is doing rather than something being done to her.
  const [gear, setGear] = useState<ThinkMood | null>(null);
  const lastMood = useRef(mood);
  useEffect(() => {
    if (lastMood.current === mood) return;
    lastMood.current = mood;
    setGear(mood);
    const timer = setTimeout(() => setGear(null), 900);
    return () => clearTimeout(timer);
  }, [mood]);

  const scheduled = useRepertoire(mood, seconds, tool);
  const beat = hold ?? scheduled.beat;
  // Conditions outlive the act that set them, which is the whole point, so
  // they are suppressed only when the bench is pinning one act.
  const conditions = hold ? (hold.cond ?? []) : scheduled.conditions;
  // Act art exists only while its act runs, so the shipped mark is a house
  // and two eyes again the moment the beat ends. Mounting all twenty one
  // acts permanently would put roughly a hundred hidden nodes inside a
  // twenty pixel logo that renders on every turn.
  const art = beat?.act ? ACT_ART[beat.act]?.() : undefined;
  // Condition art mounts on its own clock, NOT with the act. It has to sit
  // outside the act group too, because the stand-down rule freezes
  // everything inside `[data-act]` for the act's duration, and a hat that
  // freezes mid act is worse than no hat.
  const worn = conditions.map((id) => COND_ART[id]).filter(Boolean);

  const fromBase: CSSProperties = {
    transformBox: "view-box",
    transformOrigin: `${HOUSE_BASE.x}px ${HOUSE_BASE.y}px`,
  };
  // Turning and travelling pivot from the middle of the body, not the
  // floor: a spin around the base is a door swinging, a spin around here
  // is a somersault.
  const fromHips: CSSProperties = {
    transformBox: "view-box",
    transformOrigin: `${HOUSE_BASE.x}px 30px`,
  };

  return (
    <span
      aria-hidden="true"
      className={`tm-arrive inline-flex shrink-0 ${className}`}
      style={style}
    >
      <svg
        className="tm"
        data-mood={mood}
        data-gesture={beat?.body}
        data-eye={beat?.eye}
        data-act={beat?.act}
        data-cond={conditions.length > 0 ? conditions.join(" ") : undefined}
        data-nth={scheduled.index > 0 ? Math.min(scheduled.index, 9) : undefined}
        data-shift={gear && !beat ? gear : undefined}
        width={size}
        height={size}
        viewBox="0 0 48 48"
        style={{ display: "block", overflow: "visible" }}
      >
        <g className="tm-lean" style={fromBase}>
          {/* The act moves the whole character, outside the small
              flourishes and outside the breath, both of which stand down
              while it runs (thinking-acts.css). Its own group, because a
              balloon inflating and a breath cannot share one transform. */}
          <g className="tm-act">
            <g className="tm-gesture" style={fromHips}>
              <g className="tm-pop" style={fromBase}>
                <g className="tm-bob">
                <g className="tm-squish" style={fromBase}>
                  <path className="tm-house" d={HOUSE_PATH} fill="var(--brand)" />
                  {EYES.map((eye, index) => {
                    // Each eye closes around its own centre, so the lid
                    // comes down on the eye instead of sliding it toward
                    // the middle of the house.
                    const atEye: CSSProperties = {
                      transformBox: "view-box",
                      transformOrigin: `${eye.cx}px ${eye.cy}px`,
                    };
                    const white = (
                      <>
                        <circle cx={eye.cx} cy={eye.cy} r={eye.r} fill="#FFFFFF" />
                        <circle
                          className="tm-pupil"
                          cx={eye.pupilCx}
                          cy={eye.pupilCy}
                          r={eye.pupilR}
                          fill={PUPIL_FILL}
                        />
                      </>
                    );
                    return (
                      <g key={eye.cx} className="tm-eye" style={atEye}>
                        {/* The wink lives on the left eye alone and only in
                            the middle moods. At five seconds there is no
                            time for it, and past forty five seconds a
                            parent waiting on something slow should not be
                            winked at. */}
                        {index === 0 ? (
                          <g className="tm-wink" style={atEye}>
                            {white}
                          </g>
                        ) : (
                          white
                        )}
                      </g>
                    );
                  })}
                  {/* Things she is holding or wearing: they ride with the
                      body, because a crayon that does not move with her
                      hand is a sticker. */}
                  {art?.body}
                </g>
                </g>
              </g>
            </g>
          </g>
          {/* Things that have left her, or never belonged to her: dust,
              sparks, a paper plane. Outside every body transform, because
              a cloud she has just shaken off must not squash with her. */}
          {art?.fx}
        </g>
        {/* Whatever she is still carrying from an earlier act. */}
        {worn.map((render, i) => <g key={i} className="tm-cond">{render!()}</g>)}
      </svg>
    </span>
  );
}
