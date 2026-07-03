Single-line text field with label, hint/error text, and optional leading icon. Focus shows a clay ring.

```jsx
<Input label="Child's name" placeholder="e.g. Maya" value={v} onChange={e => setV(e.target.value)} />
<Input label="Email" type="email" error="Please enter a valid email" />
```

Sizes `sm | md | lg`. Rounded-md corners, 1.5px border, sunken-free.
