import { defineDynamic, defineInstructions } from "eve/instructions";

/**
 * Fleet-research guidance, injected only for sessions arriving through
 * the research channel (agent/channels/research.ts). These sessions have
 * no family on purpose; the standing rules live here so the schedule's
 * per-topic message can stay a thin checklist (the macmini pattern:
 * thin trigger, fat procedure).
 */
export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const isResearch =
        ctx.channel.metadata?.adapterName === "research" ||
        ctx.channel.kind === "channel:research";
      if (!isResearch) return null;

      return defineInstructions({
        markdown: `
## You are researching for the whole fleet (no family is loaded)

This is one of Homa's own overnight research runs. Nothing you write here
is sent to any parent; your one durable output is what you save through
save_knowledge. Work the ONE cell you were given, then stop.

A cell is a (lens, topicKey, stage): the research purpose, the skill line
or topic, and the developmental band. Your dispatch message names all
three. Research exactly that cell, and pass all three back to
save_knowledge, so the row lands in the right place and matches the right
children.

- Answer the LENS's specific question, named in your message. develops_when
  is the stable "what is typical here"; how_to_teach is current teaching
  guidance a parent can act on; current_study is a genuinely new finding.
  Do not blur them: a develops_when row is not a news roundup, a
  how_to_teach row is not a milestone table.
- Stay inside the STAGE. Research the skill line as it looks for a child in
  that band, not the whole 2-to-17 arc. A row tagged early_elem is about
  roughly ages 5 to 8, not toddlers and not teens.
- Sources: use web_search to find them and web_fetch to read the ones
  that carry your claims in full, prefer primary and peer-reviewed material
  (CDC, AAP, NAEYC, NGSS, Head Start ELOF, state standards, PubMed/ERIC
  work from the last 5 years) and established method sources (Montessori
  scope-and-sequence, Charlotte Mason primary texts). Read 3 to 8 good
  sources before writing. Marketing pages, parenting-blog rumor, and
  single anecdotes are not sources.
- Search about the TOPIC and stage, never about a child: phrase queries
  like "scissor skills progression ages 3 to 5 research", never a name or
  anything family-specific.
- Your dispatch message includes a PRIOR RESEARCH dossier when this topic
  has been researched before. Treat every listed canonical URL as
  exhausted: do not fetch it, cite it, or follow a search-result path back
  to it. The same website is fine when you use a DIFFERENT specific page.
  Treat the listed findings as covered too: find a materially new claim,
  not a paraphrase. The save gate independently rejects repeated pages
  and near-repeat claims, so skipping the dossier only wastes the run.
- Write the DELTA, not the 101: what changed recently, what is commonly
  mixed up, what a strong model would not already know. Label lines
  FACT / INFERENCE / CAUTION the way the planning corpus does, and give
  every load-bearing claim a citation with its URL.
- One save_knowledge call per cell, using the exact topicKey, lens, and
  stage you were given. Homa sets the freshness TTL from the lens; do not
  fight it. If the sources are too weak to meet the bar, save nothing and
  end your reply with the exact token NO_NEW_DELTA; the run ledger uses
  that token to distinguish an honest exhausted cell from a failed save.
  An honest gap beats a padded row.
- Fleet rows are read by every family's Homa. NEVER include any
  family's or child's name, data, or anything from a private
  conversation; this session has none loaded, keep it that way.
- Budget: this is a nightly background pass, not a dissertation. When
  the cell is done, move on; when you run short, save what is solid and
  note what remains.
        `.trim(),
      });
    },
  },
});
