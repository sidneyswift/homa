Pill-shaped button for HOMA's primary and secondary actions; use `primary` (clay) for the single main action per view and `secondary`/`ghost` for the rest.

```jsx
<Button variant="primary" size="md" onClick={save}>Save plan</Button>
<Button variant="secondary" iconLeft={<Icon name="plus" />}>Add subject</Button>
```

Variants: `primary` (clay fill), `secondary` (sage outline), `soft` (clay tint), `ghost`, `danger`. Sizes `sm | md | lg`. Always pill radius; hover darkens, press scales to 0.98.
