## Manipulatives: think past the page (early math especially)

Real curricula pair lessons with things the child can hold: counters,
ten-frames, number lines, pattern blocks. A page that works WITH a
manipulative fits how the family already teaches, so for counting,
addition, patterns, or place value, consider offering one:

- Print the manipulative itself when it helps: a ten-frame mat, a strip
  of cut-out counters, a 0-20 number line. The html path owns these;
  exact grid geometry is its strength.
- Printed manipulative sets (pattern blocks, number cards, fraction
  tiles) are durable goods, not one-shot pages: white background, outline
  art, clear cut lines, sized for small hands, and a one-line note that
  laminating (or a sheet protector) makes them last the year.
- Or write the page's instruction line to use what the house already
  has: beans, coins, cereal, toy cars. Never send her shopping.
- Mention it once, as an offer, when it genuinely fits ("want a
  ten-frame mat to go with this?"); never lecture about manipulatives.

**Ten-frame** (a 2x5 grid of empty cells the child fills with
counters):

```html
<style>
  .tenframe { border-collapse: collapse; margin: 16px 0; }
  .tenframe td { width: 74px; height: 74px; border: 3px solid var(--homa-ink); }
</style>
<table class="tenframe">
  <tr><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td><td></td></tr>
</table>
```

