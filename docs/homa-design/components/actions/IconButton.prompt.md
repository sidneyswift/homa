> **M1-17 prototype input:** This file documents a standalone design-system
> specimen. It is not a production primitive until M1-17 ports and verifies it
> in application code.

Compact button holding a single icon, toolbar actions, close buttons, composer controls.

```jsx
<IconButton ariaLabel="New chat" variant="soft"><Icon name="plus" /></IconButton>
<IconButton ariaLabel="Send" variant="primary"><Icon name="arrow-up" color="#fff" /></IconButton>
```

Variants: `ghost | soft | outline | primary`. Sizes `sm(32) | md(40) | lg(48)`. Always pass `ariaLabel`.
> **M1-17 prototype input:** This file documents a standalone design-system
> specimen. It is not a production primitive until M1-17 ports and verifies it
> in application code.
