import type { ReactNode } from "react";

import { HOUSE_PATH, PUPIL_FILL } from "./Logo";

/**
 * Homa's acts: the twenty things she can actually DO while a parent waits,
 * as opposed to the small ways she can move.
 *
 * The distinction is the whole point of this file. A transform on a fixed
 * house can only ever wobble it, which is why the first pass read as
 * cheap (founder, 2026-07-29: "clunky and not really doing anything of
 * substance"). A cartoon character does things, and doing things needs
 * PROPS: a crayon that exists for eight hundred milliseconds and then
 * does not, a balloon string, a puff of dust, a paper plane.
 *
 * So each act ships its own art, mounted only while it runs and gone the
 * instant it ends. `body` rides inside the squash group, so it moves with
 * her and belongs to her (a string tied to her base, a crayon in hand).
 * `fx` sits at the root, unaffected by her squash and bob, because a dust
 * cloud she has just shaken off must NOT squash along with her.
 *
 * Every act keeps its art inside roughly the 48 unit box plus a small
 * margin. The mark renders at twenty pixels in the busy row, so a prop
 * that flies far outside would collide with the words beside it, and
 * detail finer than about two units is invisible there anyway. What reads
 * at that size is silhouette, big travel, and colour: hence a balloon
 * that swells past her own outline and turns pink, rather than a balloon
 * with a knot and a highlight.
 *
 * Timing, shaping and the reduced-motion cutout live in
 * app/thinking-acts.css. This file is only the art.
 */

export interface ActArt {
  /** Rides with her body: things she is holding or wearing. */
  body?: ReactNode;
  /** Independent of her body: dust, sparks, things that have left her. */
  fx?: ReactNode;
}

/** A puff of dust or smoke. `--i` staggers it against its siblings, so a
 *  cloud blooms rather than appearing all at once. */
function puff(key: number, cx: number, cy: number, r: number, delay: number, reach = 7) {
  // The outward vector, away from her centre. This used to happen for the
  // WRONG reason: `transform-box: view-box` with `transform-origin: center`
  // resolves to 24px 24px, the centre of the viewBox rather than of the
  // element, so every scale() flung the puff outward as a side effect. The
  // origin is now the element's own centre and the travel is explicit.
  const dx = cx - 24;
  const dy = cy - 26;
  const length = Math.hypot(dx, dy) || 1;
  return (
    <circle
      key={key}
      className="tm-puff"
      cx={cx}
      cy={cy}
      r={r}
      style={{
        "--i": delay,
        "--dx": `${((dx / length) * reach).toFixed(2)}px`,
        "--dy": `${((dy / length) * reach - 2).toFixed(2)}px`,
      } as never}
    />
  );
}

/** A four point star, the shape that reads as a glint at any size. */
function spark(key: number, x: number, y: number, s: number, delay: number) {
  return (
    <path
      key={key}
      className="tm-spark"
      style={{ "--i": delay } as never}
      d={`M${x} ${y - s} Q${x + s * 0.22} ${y - s * 0.22} ${x + s} ${y} Q${x + s * 0.22} ${y + s * 0.22} ${x} ${y + s} Q${x - s * 0.22} ${y + s * 0.22} ${x - s} ${y} Q${x - s * 0.22} ${y - s * 0.22} ${x} ${y - s} Z`}
    />
  );
}

/** A capital Z, drawn rather than typed: a <text> node would depend on a
 *  font that may not have loaded, and would not scale with the viewBox. */
function zed(key: number, x: number, y: number, s: number, delay: number) {
  return (
    <path
      key={key}
      className="tm-zed"
      style={{ "--i": delay } as never}
      d={`M${x} ${y} h${s} l${-s} ${s} h${s}`}
    />
  );
}

export const ACT_ART: Record<string, () => ActArt> = {
  // ---------------------------------------------------------------- body
  /** Swells, reddens, and bursts. The dip before the swell is what makes
   *  the inflation read as effort rather than as a scale keyframe. */
  balloon: () => ({
    body: <line className="tm-string" x1="24" y1="43" x2="24" y2="52" />,
    fx: (
      <g className="tm-burst">
        {Array.from({ length: 9 }, (_, i) => (
          <line
            key={i}
            className="tm-burst-ray"
            style={{ "--a": `${i * 40}deg` } as never}
            x1="24"
            y1="24"
            x2="24"
            y2="4"
          />
        ))}
      </g>
    ),
  }),

  /** Spins herself into a dust devil and shakes it off. */
  dust: () => ({
    fx: (
      <g className="tm-dust">
        {[
          [10, 34, 5.5, 0], [38, 32, 5, 1], [15, 18, 4, 2],
          [34, 16, 4.5, 3], [24, 40, 5, 1.5], [6, 24, 3.5, 2.5],
          [42, 24, 3.5, 0.5],
        ].map(([x, y, r, d], i) => puff(i, x, y, r, d))}
      </g>
    ),
  }),

  /** Sags into a puddle and springs back. The drips leave her BEFORE the
   *  body reaches the floor, which is what sells it as melting. */
  melt: () => ({
    fx: (
      <g className="tm-drips">
        <ellipse className="tm-puddle" cx="24" cy="44" rx="20" ry="3.4" />
        {[[15, 36, 1.5, 0], [32, 34, 1.8, 1], [24, 38, 1.3, 2]].map(
          ([x, y, r, d], i) => (
            <circle key={i} className="tm-drip" cx={x} cy={y} r={r} style={{ "--i": d } as never} />
          ),
        )}
      </g>
    ),
  }),

  /** Crouches, lights up, leaves. */
  rocket: () => ({
    body: (
      <path
        className="tm-flame"
        d="M24 44 C20 48 20.5 54 24 58 C27.5 54 28 48 24 44 Z"
      />
    ),
    fx: (
      <g className="tm-launch">
        {[[16, 42, 4, 0], [32, 42, 4, 0.6], [24, 45, 5, 0.3]].map(
          ([x, y, r, d], i) => puff(i, x, y, r, d),
        )}
      </g>
    ),
  }),

  /** Flattened, held a beat, re inflated. The hold is the joke. */
  pancake: () => ({
    fx: (
      <g className="tm-squeeze">
        {[[4, 41, 3, 0], [44, 41, 3, 0.2]].map(([x, y, r, d], i) => puff(i, x, y, r, d))}
      </g>
    ),
  }),

  /** Leaves the frame entirely and lands hard. */
  jelly: () => ({
    fx: (
      <g className="tm-impact">
        <ellipse className="tm-ring" cx="24" cy="44" rx="12" ry="2.6" />
        <ellipse className="tm-ring tm-ring-2" cx="24" cy="44" rx="12" ry="2.6" />
      </g>
    ),
  }),

  /** She is a house, so she has a door. It opens, and something comes
   *  out. The only act with a second beat and a reveal, which is what a
   *  senior animator asked for after the first pass: every other act is
   *  one move, and this one has a set up and a punchline. */
  door: () => ({
    body: (
      // In her SIDE WALL, not her face. The first version put an 11x13
      // dark rectangle dead centre below the eyes, which on a character
      // designed without a mouth reads as exactly one thing: a mouth.
      <g className="tm-door">
        <rect className="tm-door-hole" x="29" y="30" width="10" height="13.5" rx="1.4" />
        <rect className="tm-door-leaf" x="29" y="30" width="10" height="13.5" rx="1.4" />
      </g>
    ),
    fx: (
      // The flag leaves SIDEWAYS, out of the silhouette. Routing it up
      // through her body was the rain spike all over again: a near black
      // line rising between her eyes.
      <g className="tm-flagrig">
        <line className="tm-flag-pole" x1="39" y1="36.5" x2="47" y2="36.5" />
        <path className="tm-flag" d="M47 36.5 q0 -6 0 -8 q4 1.5 7 0 q-1.5 4 0 8 q-3 1.5 -7 0 Z" />
      </g>
    ),
  }),


  /** SHE SEES YOU. Ninety seconds in, once ever, everything stops. The
   *  ambient loop stopping is itself the event, because it has never
   *  stopped. She turns, looks straight out, holds a genuinely long beat,
   *  blinks once, nods, and gets back to work.
   *
   *  The only act here with no gag in it, and the one that matters most:
   *  at two minutes of waiting, with a kid at the table, a character who
   *  notices you are still there is worth more than nineteen tricks.
   *  Reassure before inform, in motion. */
  seesyou: () => ({}),

  /** THE LODGER. She is a house. Someone lives in her. The door opens and
   *  a small creature looks out, sees you, and goes back in.
   *
   *  It escalates across one wait: the first time it only peeks, and the
   *  `lodger-out` condition it leaves behind is what puts it on her roof
   *  for everything she does afterwards. That persistence is the act's
   *  whole reason to exist. */
  lodger: () => ({
    body: (
      <g className="tm-lodge">
        <rect className="tm-lodge-hole" x="29" y="30" width="10" height="13.5" rx="1.4" />
        <g className="tm-lodger">
          <circle className="tm-lodger-body" cx="35" cy="35" r="6.2" />
          <circle className="tm-lodger-eye" cx="32.6" cy="33.8" r="1.6" />
          <circle className="tm-lodger-eye" cx="37.4" cy="33.8" r="1.6" />
          {/* An ear each side, so the silhouette is not just another circle. */}
          <circle className="tm-lodger-body" cx="30.6" cy="30.4" r="2.2" />
          <circle className="tm-lodger-body" cx="39.4" cy="30.4" r="2.2" />
        </g>
        <rect className="tm-lodge-leaf" x="29" y="30" width="10" height="13.5" rx="1.4" />
      </g>
    ),
  }),

  /** THE SPLIT. She strains, divides into two, they glance at each other,
   *  then slam back together in a clap of dust. Silhouette count is the one
   *  thing that reads unambiguously at 28px, and this is the only act that
   *  changes it. It is also a picture of what the agent is actually doing
   *  behind the wait: two things at once. */
  split: () => ({
    fx: (
      <g className="tm-twins">
        <g className="tm-twin tm-twin-l">
          <path d={HOUSE_PATH} fill="var(--brand)" />
          <circle cx="17.4" cy="26" r="4.8" fill="#FFFFFF" />
          <circle cx="30.6" cy="26" r="4.8" fill="#FFFFFF" />
          <circle cx="18.3" cy="26.7" r="2.2" fill={PUPIL_FILL} />
          <circle cx="31.5" cy="26.7" r="2.2" fill={PUPIL_FILL} />
        </g>
        <g className="tm-twin tm-twin-r">
          <path d={HOUSE_PATH} fill="var(--brand)" />
          <circle cx="17.4" cy="26" r="4.8" fill="#FFFFFF" />
          <circle cx="30.6" cy="26" r="4.8" fill="#FFFFFF" />
          <circle cx="18.3" cy="26.7" r="2.2" fill={PUPIL_FILL} />
          <circle cx="31.5" cy="26.7" r="2.2" fill={PUPIL_FILL} />
        </g>
        {[[14, 40, 4, 0], [34, 40, 4, 0.5], [24, 44, 4.5, 1]].map(([x, y, r, d], i) =>
          puff(i, x, y, r, d))}
      </g>
    ),
  }),

  /** THE BUILD. The longest act in the library, gated to a genuinely long
   *  wait, once ever. She studies a plan, then builds a second tiny house
   *  beside her: three blocks with real weight, a roof placed and nudged
   *  square, a beat of quiet admiration.
   *
   *  And it STAYS. It sits beside her for the rest of the wait, through
   *  every act that follows. Every loading indicator anyone has seen
   *  returns to its start state; this one does not, and that is the entire
   *  reason it exists. */
  build: () => ({
    fx: (
      <g className="tm-build">
        <rect className="tm-plan" x="2" y="26" width="15" height="11" rx="1.2" />
        <g className="tm-blocks">
          <rect className="tm-block tm-block-1" x="2" y="38" width="9" height="6" rx="1" />
          <rect className="tm-block tm-block-2" x="2" y="32" width="9" height="6" rx="1" />
          <path className="tm-block tm-block-3" d="M6.5 24 L12.5 31 L0.5 31 Z" />
        </g>
      </g>
    ),
  }),

  /** THE TIMER. She notices the seconds counter ticking beside her, tracks
   *  the digits, and looks back out with an opinion about it. The only act
   *  that acknowledges THIS wait rather than the idea of waiting: not that
   *  waiting happens, but that it is now forty seconds and she can see the
   *  number too. */
  timer: () => ({}),

  // ---------------------------------------------------------------- props
  /** Produces a crayon and draws. The scribble is a stroke that draws
   *  itself in, so the line arrives at the speed a hand would make it. */
  crayon: () => ({
    body: (
      <g className="tm-hand">
        <rect className="tm-crayon" x="33" y="28" width="4.4" height="13" rx="1.6" />
        <path className="tm-crayon-tip" d="M33 28 L35.2 24 L37.4 28 Z" />
      </g>
    ),
    fx: (
      <g>
        {/* The scribble resolves: a roofline and two dots turn the mess into
            a little house. It is her. Then a proud dot beside it, like a
            signature. The one act in the library that is about what the
            product actually does. */}
        <path className="tm-scribble" d="M6 43 C10 35 14 43 18 37 C22 31 26 41 31 34" />
        <path className="tm-drawn-face" style={{ "--i": 0 } as never}
          d="M9 40 L15 33 L21 40 Z" />
        <circle className="tm-drawn-face" style={{ "--i": 1 } as never} cx="13" cy="39" r="1.5" />
        <circle className="tm-drawn-face" style={{ "--i": 2 } as never} cx="17.6" cy="39" r="1.5" />
        <circle className="tm-drawn-face" style={{ "--i": 4 } as never} cx="27" cy="41" r="1.7" />
      </g>
    ),
  }),

  /** The idea. Bulb pops in, rays flash, eyes go wide underneath. */
  bulb: () => ({
    fx: (
      <g className="tm-bulb">
        <circle className="tm-bulb-glass" cx="24" cy="-3" r="6" />
        <rect className="tm-bulb-base" x="21.4" y="2.6" width="5.2" height="3.4" rx="1" />
        {Array.from({ length: 6 }, (_, i) => (
          <line
            key={i}
            className="tm-bulb-ray"
            style={{ "--a": `${i * 60}deg` } as never}
            x1="24"
            y1="-12"
            x2="24"
            y2="-16"
          />
        ))}
      </g>
    ),
  }),

  /** Thinking, visibly. Trailing bubbles then the thought itself. */
  bubble: () => ({
    fx: (
      <g className="tm-bubble">
        <circle className="tm-bub tm-bub-1" cx="33" cy="14" r="1.8" style={{ "--i": 0 } as never} />
        <circle className="tm-bub tm-bub-2" cx="35" cy="7" r="2.6" style={{ "--i": 1 } as never} />
        <circle className="tm-bub tm-bub-3" cx="37" cy="-2" r="6.4" style={{ "--i": 2 } as never} />
        {[34.4, 37, 39.6].map((x, i) => (
          <circle key={i} className="tm-bub-dot" cx={x} cy="-2" r="0.9" style={{ "--i": i } as never} />
        ))}
      </g>
    ),
  }),

  /** A cup of something. She leans in, steam curls off. */
  mug: () => ({
    fx: (
      <g className="tm-mug">
        {/* Pulled inside the box: the first version put five pixels of blue
            rectangle on the first letter of the wait label. */}
        <rect className="tm-mug-body" x="28" y="27" width="12.5" height="13" rx="2.4" />
        <path className="tm-mug-handle" d="M40.5 30.5 q3.4 3 0 6" />
        <path className="tm-steam" d="M32 25 q3 -3.5 0 -7 q-3 -3.5 0 -7" style={{ "--i": 0 } as never} />
        <path className="tm-steam" d="M37 25 q3 -3.5 0 -7 q-3 -3.5 0 -7" style={{ "--i": 1 } as never} />
      </g>
    ),
  }),

  /** Folds one and launches it. */
  plane: () => ({
    fx: (
      <g className="tm-plane">
        <rect className="tm-paper tm-paper-1" x="0" y="0" width="15" height="12" rx="0.6" />
        <rect className="tm-paper tm-paper-2" x="0" y="0" width="8" height="12" rx="0.6" />
        <g className="tm-paper tm-paper-3">
          <path className="tm-plane-body" d="M0 0 L16 6 L0 12 L3.6 6 Z" />
          <path className="tm-plane-fold" d="M0 0 L3.6 6 L0 12" />
        </g>
      </g>
    ),
  }),

  /** Has a closer look. The eye behind the lens genuinely enlarges. */
  magnify: () => ({
    fx: (
      <g className="tm-magnify">
        <circle className="tm-lens" cx="31" cy="25" r="10" />
        <line className="tm-lens-handle" x1="38.4" y1="32.4" x2="47" y2="41" />
      </g>
    ),
  }),

  /** Pleased with herself. */
  sparkle: () => ({
    fx: (
      <g className="tm-sparkles">
        {[[8, 12, 6, 0], [39, 10, 6.5, 1], [42, 30, 5.5, 2], [6, 32, 5, 1.5], [24, 2, 6, 0.5]].map(
          ([x, y, s, d], i) => spark(i, x, y, s, d),
        )}
      </g>
    ),
  }),

  /** The long wait, admitted with good humour. */
  snooze: () => ({
    fx: (
      <g className="tm-snooze">
        {[[33, 16, 4, 0], [36, 6, 5, 1], [39, -6, 6.4, 2]].map(([x, y, s, d], i) =>
          zed(i, x, y, s, d),
        )}
      </g>
    ),
  }),

  /** A small private downpour, and an umbrella. */
  rain: () => ({
    fx: (
      <g className="tm-weather">
        <g className="tm-cloud">
          <circle cx="17" cy="-4" r="5.4" />
          <circle cx="25" cy="-6.4" r="7" />
          <circle cx="33" cy="-4" r="5.4" />
          <rect x="12" y="-4" width="26" height="6" rx="3" />
        </g>
        {[[17, 3, 0], [25, 3, 1]].map(([x, y, d], i) => (
          <ellipse key={i} className="tm-drop" cx={x} cy={y} rx="1.1" ry="2.2" style={{ "--i": d } as never} />
        ))}
        {/* No handle. She has no arms, and a line from the top of her head
            down between her eyes reads as a spike through her skull, which
            is what the first version of this actually did. The canopy lands
            ON her roof, like a hat, which is the only way a house holds an
            umbrella. */}
        <path className="tm-brolly" d="M9 20 A15 15 0 0 1 39 20 Z" />
        <path className="tm-brolly-rim" d="M9 20 q3.75 3.5 7.5 0 q3.75 3.5 7.5 0 q3.75 3.5 7.5 0 q3.75 3.5 7.5 0" />
        {/* The punchline drop paints AFTER the canopy and falls down the gap
            beside it (the canopy spans x9-39), so the beat she reacts to is
            actually visible. Before this it fell behind an opaque prop and
            she blinked at nothing. */}
        <ellipse className="tm-drop tm-drop-last" cx="41" cy="3" rx="1.1" ry="2.2" style={{ "--i": 2 } as never} />
      </g>
    ),
  }),

  /** Three things in the air at once, which is the joke. */
  juggle: () => ({
    fx: (
      <g className="tm-juggle">
        {/* Based at her feet and thrown ABOVE the roofline. The first
            version arced from (15,30) to (24,8) to (33,30), every point of
            which is inside her own silhouette, so the balls slid around on
            her face like buttons. */}
        {[0, 1].map((i) => (
          <circle key={i} className="tm-ball" cx="24" cy="41" r="3.6" style={{ "--i": i } as never} />
        ))}
        {/* The one she drops. A juggler who never drops one is a machine. */}
        <circle className="tm-ball tm-ball-drop" cx="24" cy="41" r="3.6" />
      </g>
    ),
  }),

  /** Wound up and let go. The key turns the whole time she scoots. */
  windup: () => ({
    body: (
      // Outside her silhouette and deliberately ASYMMETRIC. The first
      // version was a circle plus a cross, which is four fold symmetric:
      // it turned three hundred degrees and looked four degrees different.
      // An oval bow on a stem reads its own angle at a glance.
      <g className="tm-key">
        <line className="tm-key-stem" x1="12" y1="24" x2="6.5" y2="24" />
        <ellipse className="tm-key-bow" cx="3.4" cy="24" rx="3.4" ry="2.2" />
      </g>
    ),
  }),

  /** Builds, and lets go. */
  sneeze: () => ({
    fx: (
      <g className="tm-sneeze">
        {/* Double the reach of a settling dust cloud: this is a blast, and
            the horizontal bleed is the whole act. */}
        {[[33, 30, 3.4, 0], [37, 27, 2.6, 0.4], [41, 23, 2, 0.8], [36, 35, 2.2, 0.6]].map(
          ([x, y, r, d], i) => puff(i, x, y, r, d, 14),
        )}
      </g>
    ),
  }),

};

/**
 * CONDITIONS: art that outlives the act that caused it.
 *
 * This is the difference between a set of short films and one wait. A
 * parent who notices that Homa is STILL dusty, or that the creature is
 * still sitting on her roof forty seconds later, retroactively upgrades
 * every act in the library, because now any of them might be connected.
 *
 * Mounted outside the act group on purpose: the stand-down rule freezes
 * everything inside `[data-act]`, and a passenger that freezes mid act is
 * worse than no passenger.
 */
export const COND_ART: Record<string, () => ReactNode> = {
  /** Grime from the dust devil, decaying over the next several seconds. */
  grimy: () => (
    <g className="tm-grime">
      {[[15, 30, 2.2], [31, 33, 1.8], [23, 20, 1.5], [35, 24, 1.9], [12, 38, 1.6]].map(
        ([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />,
      )}
    </g>
  ),
  /** The little house she built. It stays for the rest of the wait, which
   *  is the point: a parent who notices it is still there has noticed
   *  continuity, and continuity retroactively upgrades every act. */
  built: () => (
    <g className="tm-built">
      <rect x="2" y="38" width="9" height="6" rx="1" />
      <rect x="2" y="32" width="9" height="6" rx="1" />
      <path d="M6.5 24.5 L12.5 31.5 L0.5 31.5 Z" />
    </g>
  ),
  /** The lodger, now living on her roof and riding everything she does. */
  "lodger-out": () => (
    <g className="tm-passenger">
      <circle className="tm-lodger-body" cx="24" cy="2" r="5.6" />
      <circle className="tm-lodger-eye" cx="21.8" cy="0.9" r="1.5" />
      <circle className="tm-lodger-eye" cx="26.2" cy="0.9" r="1.5" />
      <circle className="tm-lodger-body" cx="20" cy="-2.6" r="2" />
      <circle className="tm-lodger-body" cx="28" cy="-2.6" r="2" />
    </g>
  ),
};

/** Every act id the stylesheet must define, exported so a test can prove
 *  the art and the keyframes have not drifted apart. */
export const ACT_IDS = Object.keys(ACT_ART);
