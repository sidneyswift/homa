# Phonics pattern reference chart

Golden anchor: pass `anchorIds: ["phonics-pattern-reference-chart"]` to
generate_image so the output matches the Homa phonics reference chart
bar (plain pattern title with one verified reminder line, two tall
rounded white boxes side by side with neutral group headings, five very
large lowercase words per box, only the target letters bold with a teal
underline, one short usage footer above a thin rule, star and pencil
motifs in the corners only). Write your own prompt with your own
content; the anchor sets the visual bar, not the specifics.

A one-page instructional reference for one already-taught sound-spelling,
syllable, or morphology pattern. It names the target plainly, groups a small
validated example set, and stays beside the child during real reading and
writing.

Great for: vowel teams, digraphs, affixes, syllable patterns, related-word
families, and any taught word-study relationship that benefits from a compact
visible reminder.

Always html. The chart depends on exact words, stable grouping, readable type,
and a literal target highlight, so generated art and free-form visual text are
the wrong paths.

## Build the chart blueprint

Use evidence about one child to choose one already-taught target. The private
blueprint contains:

- `targetSkillId`: one trusted current catalog id.
- `title`: the plain child-facing pattern name.
- `ruleText`: an optional verified one-sentence reminder.
- `groups`: one to three exact group ids with neutral labels.
- `examples`: stable word ids, display words, group ids, and literal target
  spans.
- `usagePrompt`: one short prompt for using the chart during reading or
  writing.

The model decides which taught target fits the request and how much support
the page needs. Deterministic validation owns catalog membership, word
identity, group membership, and target-span positions. Drop an example whose
span does not appear literally in its display word. If no validated examples
are available, ask for the family's exact words instead of inventing a chart.

## Copyright-safe content

- Preserve the instructional mechanic, never a publisher's chart title,
  examples, category names, order, colors, mascot, wording, or layout.
- Use Homa's trusted records or a parent-supplied closed set. Do not transcribe
  the source curriculum's example list.
- A rule sentence must be verified and true for every example shown. When a
  concise universal rule would be misleading, omit it and show the pattern
  through exact grouped examples.
- Keep exception words in a separately named validated group. Never hide an
  exception because it makes the chart less tidy.

## Design patterns (all binding for phonics-pattern-reference-chart)

- **One target per page**: the title, reminder, groups, and examples all serve
  the same trusted skill id.
- **Literal highlighting**: emphasize only the validated target span using
  weight, underline, or one dark accent. Never color letters by model guess.
- **Small closed set**: use 6 to 12 examples total. A reference chart is a
  quick lookup surface, not a complete word bank or assessment.
- **Neutral groups**: group by the blueprint's exact phonics or morphology
  relationship. Do not print grade bands or publisher-specific level names.
- **No answer hiding**: this is a visible aid during practice, so it does not
  double as a quiz. Use the diagnostic recipe for a check.
- **Practical footer**: one short prompt such as "Keep this beside you while
  you read." Never add a score, timer, mastery threshold, or lesson sequence.
- **Readable from the desk**: 28px or larger examples, generous cell padding,
  white background, and grayscale-safe borders.

## Tool sequence

1. Read the matching phonics or language subject reference and select one
   taught skill from family evidence.
2. Accept and validate the closed chart blueprint. Drop any word with a
   missing id, wrong group, or invalid literal target span.
3. Compose one html page and call `create_printable` with complete child,
   subject, skill, and curriculum metadata.
4. Compare the rendered page with the blueprint word by word and span by
   span. Fix overflow, ambiguous highlights, or an unhelpful rule sentence.
5. Revise through `revisesId` and finalize only after parent approval.

## Worked HTML

```html
<style>
  .chart { font-family: Andika, sans-serif; color: var(--homa-ink); }
  .title { font: 750 31px 'Plus Jakarta Sans', sans-serif;
    margin-bottom: 10px; }
  .reminder { font-size: 18px; line-height: 1.45; margin-bottom: 20px; }
  .groups { display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 16px; }
  .group { border: 2px solid #8c8175; border-radius: 12px;
    padding: 18px; background: #fff; }
  .group h2 { font: 700 18px 'Plus Jakarta Sans', sans-serif;
    margin: 0 0 12px; }
  .examples { display: grid; gap: 11px; }
  .example { font-size: 30px; line-height: 1.2; }
  .target { font-weight: 800; text-decoration: underline;
    text-decoration-thickness: 3px; text-underline-offset: 4px; }
  .use { margin-top: 22px; border-top: 1.5px solid var(--homa-control-boundary);
    padding-top: 14px; font: 600 17px 'Plus Jakarta Sans', sans-serif; }
</style>
<main class="chart">
  <h1 class="title">{{validated_pattern_title}}</h1>
  <p class="reminder">{{optional_verified_reminder}}</p>
  <div class="groups">
    <section class="group">
      <h2>{{validated_group_1}}</h2>
      <div class="examples">
        <div class="example">{{word_1_with_validated_target_span}}</div>
        <div class="example">{{word_2_with_validated_target_span}}</div>
        <div class="example">{{word_3_with_validated_target_span}}</div>
      </div>
    </section>
    <section class="group">
      <h2>{{validated_group_2}}</h2>
      <div class="examples">
        <div class="example">{{word_4_with_validated_target_span}}</div>
        <div class="example">{{word_5_with_validated_target_span}}</div>
        <div class="example">{{word_6_with_validated_target_span}}</div>
      </div>
    </section>
  </div>
  <p class="use">{{usage_prompt}}</p>
</main>
```

## Final quality gate

- One trusted skill id owns the whole chart.
- Every word, group, and target span matches the validated blueprint.
- The visible reminder is true for every shown example or is omitted.
- No publisher wording, source word list, sequence, colors, or art remains.
- The page contains no score, timer, mastery line, or hidden quiz.
- Type is readable, target marks are unambiguous, and the page passes review.
