> **M1-17 prototype input:** This file documents a standalone design-system
> specimen. It is not a production primitive until M1-17 ports and verifies it
> in application code.

Centered modal-dialog prototype for confirmations, quick forms, or onboarding
steps. It uses the display face for the title and a warm scrim.

```jsx
<Dialog open={open} onClose={close} title="Add a child"
  footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button onClick={save}>Add</Button></>}>
  <Input label="Name" />
</Dialog>
```

Click scrim or Cancel to dismiss.
> **M1-17 prototype input:** This file documents a standalone design-system
> specimen. It is not a production primitive until M1-17 ports and verifies it
> in application code.
