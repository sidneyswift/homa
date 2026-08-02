# Picture bingo board

A set of bingo-style game boards built from one shared pool of items, either
illustrated vocabulary or exact text such as math facts, sight words, or a
taught phonics set. Each board is a grid, usually 3x3, holding a different
shuffled arrangement from the same pool plus one labeled free space. A caller
names or shows one item at a time; the child covers or marks it on their own
board if it appears there. Unlike a themed worksheet or counting mat, the
whole point is printing several boards from one pool so more than one child,
or one child playing several rounds, never sees the same arrangement twice.

Great for: ages 3-8, vocabulary recall and listening practice in any subject
or language, a lower-pressure recall alternative to a flash-card drill,
text-only decoding rounds from one taught phonics pool, and group or co-op
play where every child needs a unique board from the same caller list.

Creation path: hybrid for picture boards, with one complete picture-grid
composition and one generate_image call per board. Embed that composition
unchanged, then align one HTML grid over it for exact labels, the free space,
and the frame. Use html only for text boards. Never generate art for a
text-only decoding board. A pool of 8-9 items fills a 3x3 board; a larger pool
of 12-16 supports a 4x4 board.

Design patterns (all binding for picture-bingo-board):

- **One shared item pool, many shuffled boards**: describe the same pool
  consistently in every complete-board prompt. Each board gets its own
  random arrangement (and, for a pool
  bigger than the grid, its own random subset) so families printing
  multiple boards can run a real multi-player round without duplicate
  cards.
- **Choose one cue mode**: a picture board uses image recognition with exact
  overlay labels when requested. A text-only board uses one validated taught
  word or grapheme per cell, no image, emoji, rebus, or color-family cue.
- **Text-only phonics stays controlled**: use one trusted taught pool. The
  caller list contains exactly that pool, and each marked word is read aloud
  once so locating a square does not replace decoding it. Never copy a source
  word list, board arrangement, caller order, or free-space treatment.
- **Grid size matches the pool and age**: a 3x3 grid (8 image cells plus
  1 free space) for ages 3-6 or pools of 8-9 items; a 4x4 grid (15 image
  cells plus 1 free space, or all 16 filled with no free space for older
  players) for ages 7+ or larger pools. Never so small the images crowd,
  never so large recognition becomes a stamina test.
- **One labeled free space**, usually centered, styled distinctly from
  the item cells (different fill color, a simple "FREE" or themed label
  such as "¡Gratis!" for a target-language board) so it reads as a gift
  square, not a missing image.
- **Title band**: a bold game title across the top of every board (for
  example "BINGO" or a target-language equivalent), consistent across
  the whole set so the boards visually belong together.
- **Per-board frame variation**: vary the border color or a small corner
  illustration from board to board (not the grid content) so a parent or
  teacher can tell boards apart at a glance while calling items, without
  needing to compare every cell.
- **Even grid lines, no cell ambiguity**: solid ruled borders
  (`border: 2px solid #221e1a;`) between every cell, square aspect ratio
  per cell, image filling most of the cell with a small margin so nothing
  touches the grid line.
- **Caller list note**: below or beside the boards (or in the parent
  instructions), list the full item pool once, so the parent calling
  items has the complete word list without hunting across boards.

```html
<style>
  .bingo-board { width: 100%; max-width: 480px; margin: 0 auto;
    border: 10px solid #4a8f6b; border-radius: 6px; padding: 10px;
    background: #fff; }
  .bingo-title { text-align: center; font-size: 34px; font-weight: 800;
    color: #e0a730; letter-spacing: 0.06em; margin-bottom: 10px; }
  .bingo-grid { display: grid; grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr); border: 2px solid #221e1a; }
  .bingo-cell { border: 2px solid #221e1a; aspect-ratio: 1 / 1;
    display: flex; align-items: center; justify-content: center;
    padding: 6px; }
  .bingo-cell img { max-width: 90%; max-height: 90%; object-fit: contain; }
  .bingo-word { font: 700 29px Andika, sans-serif; color: #221e1a;
    text-align: center; }
  .bingo-free { display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 700; color: #e0a730; text-align: center; }
</style>

<div class="bingo-board">
  <div class="bingo-title">BINGO</div>
  <div class="bingo-grid">
    <!-- Picture variant: one composed image aligned beneath this grid.
         Text variant: 8 cells containing .bingo-word, no image at all.
         Place one .bingo-free cell at the center grid position. -->
  </div>
</div>
```

Never generate a fresh illustration per item. For picture boards, keep one
board to one page and one composed image call, repeat the same full visual
descriptions across boards, and let HTML own the exact caller list. For
text-only boards, use no image call and let HTML own every exact word.
