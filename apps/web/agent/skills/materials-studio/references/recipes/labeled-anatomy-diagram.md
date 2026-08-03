# Labeled anatomy diagram

A scientific illustration with numbered leader lines pointing to parts,
word bank at bottom. Scaffolded versions: fully labeled → numbered with
word bank → completely blank for testing.

Great for: ages 5-12, science (body systems, animal anatomy, plant
parts), geography (map labeling). The three scaffolding levels let the
parent choose the right challenge.

Always hybrid path. generate_image produces the scientific illustration;
HTML overlays the leader lines, numbers, and word bank with precision.

Design patterns (all binding for labeled-anatomy-diagram):

- **Central illustration**: takes 60% of page height. Clean, detailed,
  B&W line art suitable for coloring.
- **Leader lines**: extend from numbered circles on the illustration to
  the margin. Numbers in small circles (`width: 24px; height: 24px;
  border-radius: 50%; border: 2px solid var(--homa-ink); font-size: 14px;`).
- **Word bank**: bordered box at bottom (`border: 1.5px solid var(--homa-control-boundary);
  border-radius: 6px; padding: 12px;`) with shuffled terms in a
  horizontal list separated by bullet dots.
- **Three scaffolding levels** (generate all three as separate pages
  in one packet, or let the parent choose):
  1. Fully labeled (reference): lines connect to printed labels.
  2. Numbered with word bank (guided): lines connect to numbers,
     word bank below.
  3. Blank lines only (assessment): lines end at blank underscores,
     no word bank.
- **Name/date header** at top of page.
