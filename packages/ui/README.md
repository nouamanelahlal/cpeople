# @cpeople/ui

ConSAP design tokens for CPeople. The brand is approved and fixed, so this package is
the only place colour and type are defined.

```css
/* in an app's global stylesheet */
@import "tailwindcss";
@import "@cpeople/ui/tokens.css";
```

Shared React components will be added here as screens are built (see the
`cpeople-design` skill for the patterns they must follow). Status colours
(success, warning, error) must be added here once, checked for WCAG AA, and reused.
