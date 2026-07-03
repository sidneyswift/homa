Quiet confirmation pill for transient feedback, saved, added to planner, undo.

```jsx
<Toast message="Added to Maya's week" icon={<Icon name="check" size={16} color="var(--gold-400)" />} action="Undo" onAction={undo} />
```

Dark pill by default; `tone="light"` for a white version. Keep copy short and warm ("Saved, nice work" not "Operation successful"). One at a time, bottom-center.
