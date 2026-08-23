import { generateObject } from "ai";
import { z } from "zod";
import { MOBILE_ONBOARDING_INTENTS } from "@homa/core";

import { clientIp, rateLimited } from "../../../../../lib/map/ratelimit";
import { requireFamilyFromBearer } from "../../../../../lib/map/session";

/**
 * POST /api/mobile/onboarding/react
 * Homa's give-back lines for the native onboarding walk (founder ruling
 * D7, 2026-08-18: live model per answer, never a curated bank). The
 * model writes one warm, specific line reacting to what the parent just
 * said; deterministic code verifies shape, register, and novelty, and a
 * pre-written warm fallback ships whenever the model is slow, refuses,
 * or breaks a law. The line is presentation copy only: it grants
 * nothing, writes nothing, and the walk proceeds identically without it.
 */

const requestSchema = z
  .object({
    kind: z.enum(["intent", "love"]),
    intent: z.enum(MOBILE_ONBOARDING_INTENTS).optional(),
    childName: z.string().trim().min(1).max(40).optional(),
    love: z.string().trim().min(1).max(80).optional(),
    priorLines: z.array(z.string().max(200)).max(8).default([]),
  })
  .strict();

const lineSchema = z.object({
  line: z.string().min(8).max(180),
});

const INTENT_FALLBACKS: Record<string, string> = {
  worksheets: "Worksheets it is. Straight to the good stuff.",
  plan: "A real plan for a real week. Let's build it.",
  hours: "Hours that track themselves while you teach. On it.",
  research: "Answers and pep talks, on tap. I'm ready.",
  all: "All of it. Respect. We'll start with the thing kids actually grab.",
};

const LOVE_FALLBACK = "Noted, and I know exactly what to do with that.";

// U+2014 EM DASH, written as a code point so this enforcement line
// itself never trips the repo's own em-dash lint (AGENTS.md: no em
// dash, ever, anywhere, including in code that checks for one).
const EM_DASH = String.fromCharCode(0x2014);

/** The register floor the model must clear; violations fall back. */
function violatesVoice(line: string): boolean {
  if (line.includes(EM_DASH)) return true;
  if (/\b(behind|ahead of|smarter than)\b/iu.test(line)) return true;
  // Abstract-metaphor filler the prompt bans; the gate backstops it
  // (model proposes, code verifies). Named nouns only, measured from a
  // real production line ("a tidy little stack of momentum", 2026-08-21).
  if (/\b(momentum|journey|adventure)\b/iu.test(line)) return true;
  return false;
}

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`onboarding-react:${clientIp(request)}`, 60)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const family = await requireFamilyFromBearer(request);
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const input = parsed.data;

  const fallback =
    input.kind === "intent"
      ? INTENT_FALLBACKS[input.intent ?? "all"]
      : LOVE_FALLBACK;

  const subject =
    input.kind === "intent"
      ? `The parent just said what would help most this week: "${input.intent ?? "all"}".`
      : `The parent just said their kid ${input.childName ? `(${input.childName}) ` : ""}loves: "${input.love ?? ""}".`;

  const model =
    process.env.HOMA_ONBOARDING_REACT_MODEL ?? "openai/gpt-5.6-terra";

  try {
    const generation = generateObject({
      model: model as Parameters<typeof generateObject>[0]["model"],
      schema: lineSchema,
      prompt: `You are Homa, a homeschool assistant meeting a new family during signup. Write ONE short reaction line (under 140 characters) to what the parent just picked.

${subject}

What a good line does: it reacts to THIS pick, and it names something real from a homeschool day (a printed page, a kitchen table, a Sunday night, a kid asking why) or says plainly what happens next. If the line would fit any pick, it fails.

Hard rules:
- Concrete beats poetic. Never describe the pick with an abstract metaphor: no "momentum", "journey", "spark", "magic", "adventure", no "a little stack of X". Every noun should be something you could print, touch, or put on a calendar.
- Warm and confident with a little sass. Never syrupy, never corporate.
- Promise only what this pick actually does next. Nothing grander, no timelines you can't keep.
- Sentence case. No em dash. No emoji. No exclamation stacking.
- Never judge or rank the child, never mention ages or levels.
- Never promise a specific franchise's artwork or characters. Being charmed by the interest is fine; promising its art is not.

GOOD examples (match this register, never copy them):
- Pick "worksheets": "Worksheets it is. Something to print, put on the table, and actually get done."
- Pick "plan": "A plan, smart. By Sunday night you'll know exactly what Tuesday looks like."
- Pick "hours": "Hours, handled. You teach the lesson, I keep the log."
- Pick "all": "All of it, respect. We'll start with the part your kids can hold in their hands."
- Love "dinosaurs": "Dinosaurs, excellent. Fractions go down easier with a T. rex in the room."
- Love "Minecraft": "Minecraft, noted. Anything that holds a kid's focus for hours is something we can borrow."

BAD examples (this is the failure, never write like this):
- "A tidy little stack of momentum sounds perfect for this week." (abstract metaphor, means nothing, fits any pick)
- "What a wonderful journey you're beginning together." (syrupy, generic, promises nothing real)

Do not reuse or lightly rephrase any of these earlier lines: ${input.priorLines.length ? input.priorLines.map((l) => `"${l}"`).join(", ") : "(none)"}`,
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 2_500),
    );
    const { object } = await Promise.race([generation, timeout]);

    const line = object.line.trim();
    const repeatsPrior = input.priorLines.some(
      (prior) => prior.trim().toLowerCase() === line.toLowerCase(),
    );
    if (!line || violatesVoice(line) || repeatsPrior) {
      return Response.json({ ok: true, line: fallback, source: "fallback" });
    }
    return Response.json({ ok: true, line, source: "model" });
  } catch {
    return Response.json({ ok: true, line: fallback, source: "fallback" });
  }
}
