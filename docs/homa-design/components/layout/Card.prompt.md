> **M1-17 prototype input:** This file documents a standalone design-system
> specimen. It is not a production primitive until M1-17 ports and verifies it
> in application code.

The standalone prototype currently uses `--radius-xl` (28px). M1-17 must align
the production card with the current `--radius-lg` (22px) design law before it
is ported.

```jsx
<Card padding="md"><h3>Today's plan</h3>…</Card>
<Card interactive elevated onClick={open}>…</Card>
```

`interactive` lifts on hover. Padding `none | sm | md | lg`.
> **M1-17 prototype input:** This file documents a standalone design-system
> specimen. It is not a production primitive until M1-17 ports and verifies it
> in application code.
