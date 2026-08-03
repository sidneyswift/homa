# Word fluency repeated reading

A calm repeated-reading sheet for building automatic recognition of one
already-taught word set. The child reads the same closed list more than once
while the parent notices accuracy, smoothness, and self-correction. It is
practice, not a race, score, reading-level test, or mastery verdict.

Great for: familiar phonics patterns, high-frequency words, morphology sets,
and multisyllabic words that a child can decode accurately but not yet read
smoothly in connected work.

Always html through the packet path. Exact word identity, stable order,
parent-only observation fields, and matched rereading geometry matter more
than art.

## Choose the practice set

Start with evidence about one child and one already-taught skill. Build a
private blueprint with:

- `targetSkillId`: one trusted current catalog id.
- `wordIds`: stable ids for a closed validated word set.
- `displayWords`: the exact words tied to those ids.
- `bands`: optional support bands from one skill, never grade labels.
- `roundCount`: two or three readings of the same set.
- `timingPolicy`: either `untimed` or a versioned code-issued policy.
- `stopRule`: stop when the child asks, looks frustrated, or accuracy breaks
  down enough that rereading has become guessing.

The model may choose the taught skill and presentation from family evidence.
Deterministic validation owns word membership, ids, exact display text, and
any timing or progression policy. If the closed word set is missing, ask for
the target instead of inventing a broad list. If a timing policy is absent,
the page is untimed. Never author a seconds target, words-per-minute goal,
pass line, or next-skill threshold in prose.

## Copyright-safe content

- Build the set from Homa's trusted skill data or a parent-supplied target.
  Never transcribe a publisher's word list, band labels, sequence, timings,
  chart design, or teacher script.
- Keep all words inside one taught pattern or one named retrieval set. A
  harder band may add length or morphology only when its exact members were
  validated under the same skill purpose.
- Do not reuse a copyrighted passage. This recipe is for a closed word set;
  use decodable-story-page or an original reading passage for connected text.
- Do not add pictures, rebuses, or definitions that reveal a decoding answer.

## Design patterns (all binding for word-fluency-repeated-reading)

- **Two-page packet**: one child practice page and one parent observation
  page. Pass `pageRoles: ["child", "parent_guide"]`.
- **Same set each round**: preserve every word id and display word. A round
  may change row or column order only when the blueprint explicitly supplies
  that order; never silently swap in new words.
- **Warm child language**: use "Read it again" or the skill name. Never print
  speed drill, test, score, level, slow, behind, or beat your time.
- **Large readable words**: at least 24px for ages 8 to 10, with one word per
  cell and enough spacing to prevent accidental line skipping.
- **Observation, not judgment**: the parent page has one row per round for
  exact miscues, self-corrections, and a short smoothness note. It carries no
  generated aggregate score or child verdict.
- **Timing is conditional**: an untimed blueprint gets no clock field. A
  code-issued policy may add an elapsed-time blank and its exact neutral
  instruction, but the printable never derives or interprets the result.
- **Stop before guessing**: the parent note says to pause and return to a
  smaller taught set when the child starts guessing or becomes frustrated.
- **Ink-light**: black type, white background, thin rules, and no decoration
  that competes with the words.

## Tool sequence

1. Read the matching phonics or language subject reference and choose one
   taught skill from family evidence.
2. Accept a closed validated word blueprint. Reject any missing, duplicate,
   out-of-skill, or unverified item before composing the page.
3. Call `create_printable` once with the child page and parent page in packet
   order, plus exact page roles and complete skill metadata.
4. Check every rendered word against the blueprint and verify that the child
   page contains no answers, thresholds, or parent observation language.
5. Revise through `revisesId` when needed. Finalize only after the parent
   approves.

## Worked HTML

```html
<style>
  .practice { font-family: Andika, sans-serif; color: var(--homa-ink); }
  .head { display: flex; justify-content: space-between;
    align-items: baseline; margin-bottom: 18px; }
  .title { font: 750 28px 'Plus Jakarta Sans', sans-serif; }
  .meta { font: 500 14px 'Plus Jakarta Sans', sans-serif; }
  .direction { font: 600 17px 'Plus Jakarta Sans', sans-serif;
    margin-bottom: 18px; }
  .band { margin-bottom: 22px; }
  .band h2 { font: 700 18px 'Plus Jakarta Sans', sans-serif;
    margin: 0 0 10px; }
  .words { display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 12px; }
  .word { min-height: 68px; border: 1.5px solid var(--homa-control-boundary);
    border-radius: 8px; display: grid; place-items: center;
    font-size: 29px; background: #fff; }
</style>
<main class="practice">
  <header class="head">
    <div class="title">Read it again</div>
    <div class="meta">Name: {{child_name}} &nbsp; Round: {{round_number}}</div>
  </header>
  <p class="direction">Read each word in your own steady voice. Stop whenever you need.</p>
  <section class="band">
    <h2>{{trusted_band_label}}</h2>
    <div class="words">
      <div class="word">{{validated_word_1}}</div>
      <div class="word">{{validated_word_2}}</div>
      <div class="word">{{validated_word_3}}</div>
      <div class="word">{{validated_word_4}}</div>
      <div class="word">{{validated_word_5}}</div>
      <div class="word">{{validated_word_6}}</div>
    </div>
  </section>
</main>
```

## Final quality gate

- Every printed word and id matches the validated blueprint exactly.
- The set targets one already-taught skill and contains no source sequence.
- Any order change is blueprint-supplied and preserves exact membership.
- No timer, timing direction, pass line, or progression rule appears without
  a valid code-issued policy.
- The child page uses warm practice language and contains no score fields.
- The parent page records observable details without generating a verdict.
- Page roles, metadata, and rendered words all pass review.
