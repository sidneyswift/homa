# Chant and rhyme card

A one-page performance card for a traditional chant, nursery rhyme, or
fingerplay the family says aloud together: the full text in large read-aloud
type, one spoken line per printed line, with optional performance cues
(leader and everyone parts for call-and-response, echo marks, clap-along
hints) and a small parent footer explaining how to teach it. The page is for
the mouth and the ear, not the pencil: nothing to trace, cut, or fill in.

Great for: ages 2-6, circle-time and morning-basket routines, phonological
awareness through rhyme and rhythm before formal phonics, oral language for
toddlers and preschoolers who are years from worksheets, memory work,
call-and-response games, jump-rope and clapping chants for ages 5+. Pairs
naturally with copy-work-pages later (say it first for weeks, copy it once
writing starts) and with clip-cards for rhyme recognition.

Always html path. The card is text plus precise typographic cues (drop
caps, cue chips, line spacing a parent can follow mid-chant), which HTML
controls exactly and image generation reliably mangles. No illustration is
needed for the card to work; if a family asks for a decorated version, add
one small generated spot illustration via the hybrid path, never behind the
text.

Use only traditional, anonymous, public-domain rhymes and chants (Mother
Goose, folk counting-out and jump-rope chants) or chants the family made up
themselves. Never reproduce a published compiler's arrangement, adaptation,
or original verse from a copyrighted collection.

Design patterns (all binding for chant-and-rhyme-card):

- **Title + skill tag**: the chant's common name or first line as the
  title, plus a small uppercase tag naming the one skill it practices in
  plain parent words, for example "Practicing: Rhyme," "Practicing:
  Counting down," "Practicing: Call and response."
- **One spoken line per printed line**: never rewrap the chant as prose.
  Large type (at least 18px body), generous line height (1.7 or more), a
  blank line between verses. The parent must be able to find their place
  mid-chant from across a circle of children.
- **Performance cues as chips, only when the chant needs them**: for
  call-and-response chants, a small bordered chip before the line
  ("LEADER" / "EVERYONE"); for echo chants, one "echo each line" note
  under the title instead of a chip on every line. A straight rhyme
  everyone says together gets no chips at all. Cues never outnumber or
  outshout the chant text.
- **Clap and action hints in italics, in parentheses, at the end of the
  line**: for example "(clap on each number)" or "(hold up four
  fingers)". Never invent actions for a chant that has none.
- **Parent footer, one small box**: 2-3 sentences of how-to in warm plain
  language: say it first, let the child join on the parts they catch,
  repeat it for days not minutes, clap the rhythm or tap toes. Keep it
  reassuring; a chant is play, not a lesson to pass.
- **Our-own-chant variant (optional)**: swap the chant text area for 4-6
  wide blank writing lines under the same title layout, for capturing a
  chant the child made up. Keep the parent footer and title tag; name the
  card after the child's own chant when known.
- **No worksheet furniture**: no name line, no date line, no instructions
  block, no answer space. This is a saying card, not an activity sheet.

```html
<style>
  .crc-page { font-family: 'Andika', sans-serif; padding: 28px; }
  .crc-tag { display: inline-block; font-size: 12px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.04em; color: var(--homa-control-boundary);
    margin-bottom: 6px; }
  .crc-title { font-size: 28px; font-weight: 700; color: var(--homa-ink);
    margin-bottom: 18px; }
  .crc-verse { margin-bottom: 18px; }
  .crc-line { font-size: 19px; line-height: 1.75; color: var(--homa-ink); }
  .crc-cue { display: inline-block; border: 1.5px solid var(--homa-control-boundary);
    border-radius: 6px; padding: 1px 7px; font-size: 11px; font-weight: 700;
    letter-spacing: 0.04em; color: var(--homa-control-boundary); margin-right: 8px;
    vertical-align: 2px; }
  .crc-action { font-style: italic; font-size: 15px; color: var(--homa-control-boundary); }
  .crc-parent { border: 1.5px solid var(--homa-control-boundary); border-radius: 6px;
    padding: 12px 16px; margin-top: 24px; background: #f0ede8;
    font-size: 14px; line-height: 1.6; color: var(--homa-ink); }
</style>
<div class="crc-page">
  <div class="crc-tag">Practicing: Call and response</div>
  <div class="crc-title">Auntie, Will Your Dog Bite?</div>
  <div class="crc-verse">
    <div class="crc-line"><span class="crc-cue">LEADER</span>Auntie, will your dog bite?</div>
    <div class="crc-line"><span class="crc-cue">EVERYONE</span>No, child, no! <span class="crc-action">(shake heads)</span></div>
    <div class="crc-line"><span class="crc-cue">LEADER</span>Auntie, will your oven bake?</div>
    <div class="crc-line"><span class="crc-cue">EVERYONE</span>Yes, just try! <span class="crc-action">(clap twice)</span></div>
  </div>
  <div class="crc-parent">
    Say the leader lines and let your child answer. Do not worry about
    getting it right; repeat it over a few days and the answers will start
    arriving before you finish asking. Clap the rhythm or tap your toes as
    you go.
  </div>
</div>
```
