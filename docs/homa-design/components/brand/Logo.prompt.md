> **M1-17 prototype input:** This file documents a standalone design-system
> specimen. It is not a production primitive until M1-17 ports and verifies it
> in application code.

The Homa logo, "the little home": a chunky rounded clay house with bright eyes, Homa personified, plus the bounced **Fredoka 600** wordmark, "Homa" with each letter nudged a hair off the baseline. Use this everywhere the brand appears; never redraw the mark or re-set the wordmark by hand.

```jsx
<Logo size={32} />                         {/* full lockup on light bg */}
<Logo size={28} tone="dark" />             {/* reversed, for dark surfaces */}
<Logo variant="mark" size={40} />          {/* symbol only, favicon / app icon */}
<Logo treatment="line" size={32} />        {/* quiet one-color outline, stamps & print */}
```

`tone` = the background the logo sits on. On light: clay mark, near-black wordmark. On dark: clay-400 mark, white wordmark. Keep clear-space of ~0.5× the mark height on all sides.
> **M1-17 prototype input:** This file documents a standalone design-system
> specimen. It is not a production primitive until M1-17 ports and verifies it
> in application code.
