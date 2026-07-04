The Homa logo, "the bright home" mark (a home with a spark of magic inside) plus the Newsreader wordmark. Use this everywhere the brand appears; never redraw the mark by hand.

```jsx
<Logo size={32} />                         {/* full lockup on light bg */}
<Logo size={28} tone="dark" />             {/* reversed, for dark surfaces */}
<Logo variant="mark" size={40} />          {/* symbol only, favicon / app icon */}
<Logo treatment="duo" size={32} />         {/* 2-tone: soft-filled home + gold spark */}
```

`tone` = the background the logo sits on. On light: clay mark + spark, near-black wordmark. On dark: clay-400 mark, gold-400 spark, white wordmark. Keep clear-space of ~0.5× the mark height on all sides.
