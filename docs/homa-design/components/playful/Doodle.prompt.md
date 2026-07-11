> **M1-17 prototype input:** This file documents a standalone design-system
> specimen. It is not a production primitive until M1-17 ports and verifies it
> in application code.

Small hand-drawn decorative shapes, scattered like margin stickers around headlines, cards, and bands; decoration only, never UI or icons.

```jsx
<Doodle name="star" rotate={-10} />
<Doodle name="flower" color="var(--pop-blush)" size={28} rotate={-6} />
<Doodle name="cloud" color="var(--sky-500)" size={28} />
```

Names: `star`, `heart`, `sun`, `sparkle`, `squiggle`, `flower`, `cloud`, `moon`, `zigzag`, `loop`. Props: `size` (px, default 24), `color` (any token, default `--pop-cobalt`), `rotate` (deg). Rotate a few degrees so they feel hand-placed; one or two per surface, max.
> **M1-17 prototype input:** This file documents a standalone design-system
> specimen. It is not a production primitive until M1-17 ports and verifies it
> in application code.
