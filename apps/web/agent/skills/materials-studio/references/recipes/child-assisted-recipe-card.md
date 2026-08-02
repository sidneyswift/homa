# Child-assisted recipe card

A one-page cooking guide that gives the adult the whole recipe while making
the child's real jobs unmistakable. Adult-only preparation and safety checks
stay separate from the picture-supported child sequence, so a preschooler can
participate without the page quietly handing them heat, blades, raw animal
proteins, or powered appliances.

Great for: ages 3-8, practical-life cooking, preschool theme weeks, family
snacks, simple measuring and counting practice, and turning a parent-approved
recipe into a page the child can follow alongside an adult.

Creation path: html. Measurements, actor labels, ingredient names, step order,
and safety ownership must remain exact and editable. Use small one-color inline
icons only as redundant picture cues. The written action and the ADULT or CHILD
badge are always authoritative.

## Source and safety gate

Before laying out the page:

1. Use a recipe the parent provided in the current family conversation, or
   write a genuinely original recipe. A publisher reference may teach this
   card's structure, but never supplies copied ingredients, wording, step
   order, title, or visual composition.
2. If an ingredient choice depends on unknown allergies, dietary rules, or a
   medical need, ask the parent one short question. Never promise that a food
   is allergen-free or suitable for a medical diet. The adult checks labels and
   decides what their child may eat.
3. Put heat, sharp blades, raw animal proteins, powered appliances, and any
   other hazardous preparation in **ADULT FIRST**. Do not disguise an adult
   action as a child job by adding "with help."
4. Keep the child beside an attentive adult. The page offers jobs, not a safety
   certification. The adult may reassign or skip any job.
5. Prefer no-cook assembly and low-risk household ingredients for an original
   preschool recipe. Do not add nutrition, health, or developmental claims.

## Design patterns (all binding for child-assisted-recipe-card)

- **One recipe, one page**: use a portrait letter page with four zones in this
  order: recipe header, ingredients plus ADULT FIRST, child sequence, serve and
  clean. A second page is allowed only when the parent supplied a longer recipe
  that cannot remain readable on one page.
- **Plain recipe header**: title, yield or servings, and honest total time. Add
  one short outcome line such as "Build six yogurt-and-fruit cups together."
  Do not market the food as healthy, perfect, or kid-approved.
- **Exact ingredient list**: show quantity, unit, and ingredient in one row.
  Every ingredient used in a step appears here, and every listed ingredient is
  used. Include required bowls, pans, and measuring tools in a short "Tools"
  line rather than hiding them in the steps.
- **ADULT FIRST safety strip**: a visually separate warm-gray box above the
  child sequence. It contains the adult's ingredient and label check, hazardous
  preparation, appliance work, and any cooling or portioning needed before the
  child begins. Use direct actor language: "ADULT: Slice the strawberries."
- **Real child jobs**: choose 3-6 observable actions such as wash, tear, count,
  scoop, pour a premeasured ingredient, stir a cool mixture, arrange, sprinkle,
  set the table, serve, or wipe. Do not call watching an adult a child step.
- **Picture-supported sequence**: each child step is a large numbered card with
  a CHILD badge, one simple one-color action icon, a bold verb, and one short
  sentence. The icon never carries information that the words omit. Keep the
  sequence left to right for 3-4 steps or in a single vertical column for 5-6.
- **Age follows evidence**: ages 3-4 get at most four large child steps with
  premeasured ingredients. Ages 5-8 may measure, read short labels, and handle
  more steps when the family's evidence supports it. Age alone never grants a
  hazardous job.
- **Math and sensory talk stay optional**: add no more than two tiny talk chips,
  such as "Count 6 cups," "Which scoop is fuller?", or "What do you smell?"
  These are invitations, never pressure to taste or finish.
- **Serve and clean are part of the work**: end with one child-owned serving
  job and one cleanup job. If food needs chilling, baking, or cooling first,
  the adult step happens before serving and states the wait clearly.
- **No copied cookbook page**: never reproduce a publisher's recipe, branded
  title, prose, illustrations, decorative border, or page composition. When a
  curriculum merely says to cook together, create a fresh recipe that fits the
  family's confirmed ingredients and the lesson goal.
- **Print-first geometry**: 15mm minimum outer margins, 16px minimum body type,
  22px step verbs, strong black actor labels, white background, warm-gray safety
  fill, and borders that remain distinct in grayscale. No script font.

## Content blueprint

Draft this structured content before writing HTML:

```text
title
yield
totalTime
outcomeLine
ingredients[] = { amount, unit, ingredient }
tools[]
adultFirst[] = { action, reason }
childSteps[] = { number, iconLabel, verb, instruction }
talkChips[]
serveJob
cleanupJob
adultFooter
```

The adult footer always includes: "A grown-up checks ingredients, portions,
and every job for this child."

## Worked HTML

```html
<style>
  .car-page { font-family: 'Andika', sans-serif; color: #221e1a;
    padding: 15mm; background: #fff; }
  .car-title { font-size: 30px; font-weight: 750; margin: 0 0 4px; }
  .car-meta { display: flex; gap: 12px; font-size: 15px;
    margin-bottom: 14px; }
  .car-top { display: grid; grid-template-columns: 1fr 1fr;
    gap: 14px; }
  .car-box { border: 2px solid #221e1a; border-radius: 8px;
    padding: 12px 14px; }
  .car-adult { background: #f0ede8; }
  .car-label { font-size: 13px; font-weight: 800; letter-spacing: .05em;
    text-transform: uppercase; }
  .car-steps { display: grid; grid-template-columns: 1fr 1fr;
    gap: 10px; margin-top: 14px; }
  .car-step { display: grid; grid-template-columns: 42px 1fr;
    gap: 10px; align-items: center; border: 2px solid #221e1a;
    border-radius: 8px; padding: 10px; min-height: 92px; }
  .car-icon { width: 40px; height: 40px; border: 2px solid #221e1a;
    border-radius: 50%; display: flex; align-items: center;
    justify-content: center; font-size: 13px; font-weight: 800; }
  .car-verb { display: block; font-size: 22px; font-weight: 800; }
  .car-child { font-size: 11px; font-weight: 800; letter-spacing: .05em; }
  .car-finish { display: grid; grid-template-columns: 1fr 1fr;
    gap: 10px; margin-top: 12px; }
  .car-footer { font-size: 12px; color: #6b6259; margin-top: 10px; }
</style>
<main class="car-page">
  <h1 class="car-title">Berry yogurt cups</h1>
  <div class="car-meta"><span>Makes 6</span><span>15 minutes</span></div>
  <p>Build six cool fruit-and-yogurt cups together.</p>
  <section class="car-top">
    <div class="car-box">
      <div class="car-label">Ingredients</div>
      <ul><li>2 cups plain yogurt</li><li>1 cup prepared berries</li>
        <li>1/2 cup oat cereal</li></ul>
      <p><strong>Tools:</strong> bowl, spoon, 1/2-cup measure, 6 cups</p>
    </div>
    <div class="car-box car-adult">
      <div class="car-label">Adult first</div>
      <p><strong>ADULT:</strong> Check ingredient labels. Wash and prepare the
        berries, then set out the measured ingredients.</p>
    </div>
  </section>
  <section class="car-steps">
    <div class="car-step"><div class="car-icon">1</div><div>
      <span class="car-child">CHILD</span><span class="car-verb">Count</span>
      Put 6 empty cups in a row.</div></div>
    <div class="car-step"><div class="car-icon">2</div><div>
      <span class="car-child">CHILD</span><span class="car-verb">Scoop</span>
      Add yogurt to each cup.</div></div>
    <div class="car-step"><div class="car-icon">3</div><div>
      <span class="car-child">CHILD</span><span class="car-verb">Add</span>
      Place berries on the yogurt.</div></div>
    <div class="car-step"><div class="car-icon">4</div><div>
      <span class="car-child">CHILD</span><span class="car-verb">Sprinkle</span>
      Finish each cup with cereal.</div></div>
  </section>
  <section class="car-finish">
    <div class="car-box"><strong>Serve:</strong> Carry one cup at a time.</div>
    <div class="car-box"><strong>Clean:</strong> Wipe the table together.</div>
  </section>
  <p class="car-footer">A grown-up checks ingredients, portions, and every job
    for this child.</p>
</main>
```

## Final quality check

- Recipe is original or parent-provided, with no publisher-specific language.
- Ingredient amounts, yield, tools, adult preparation, and child steps agree.
- Every hazardous action is visibly adult-owned and occurs in the right order.
- Child steps are real, observable work and the text remains clear without icons.
- Type, actor badges, borders, and sequence survive grayscale printing.
- Serving, waiting, and cleanup are explicit, with no nutrition or safety claim.
