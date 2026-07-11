> **M1-17 prototype input:** This file documents a standalone design-system
> specimen. It is not a production primitive until M1-17 ports and verifies it
> in application code.

Styled dropdown built on native `<select>`. Options are strings or `{value,label}`.

```jsx
<Select label="Grade level" options={['K','1st','2nd','3rd']} value={g} onChange={e => setG(e.target.value)} />
```

Matches Input sizing; custom chevron.
> **M1-17 prototype input:** This file documents a standalone design-system
> specimen. It is not a production primitive until M1-17 ports and verifies it
> in application code.
