Centered modal dialog for confirmations, quick forms, or onboarding steps. Serif title, warm scrim.

```jsx
<Dialog open={open} onClose={close} title="Add a child"
  footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button onClick={save}>Add</Button></>}>
  <Input label="Name" />
</Dialog>
```

Click scrim or Cancel to dismiss.
