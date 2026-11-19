---
name: cpeople-design
description: Use for any CPeople UI work (screens, components, forms, tables, payslips, e-mails). Applies the fixed ConSAP brand and HR/payroll screen patterns, and checks the result with Playwright screenshots. Takes priority over frontend-design wherever they differ.
---

# CPeople design

CPeople's brand is **fixed and approved**. The `frontend-design` skill is useful for craft (type scale, restraint, copywriting, self-critique), but its advice to invent a new palette or typeface does **not** apply here: the brief pins those down.

## Brand tokens (source: `packages/ui`, never redefine locally)
| Token | Hex | Use |
|---|---|---|
| navy | `#0F1937` | Headings, primary text on light, sidebar background option |
| cyan | `#3FB3D7` | Primary actions, focus ring, active states |
| blue | `#0E7BB0` | Links, secondary actions, "BY CONSAP" |
| light-cyan | `#5DCBE5` | Accents on dark backgrounds |
| page | `#F0F0F0` | App background |
| tint | `#E6F3FA` | Selected rows, info panels |
| body | `#4E566B` | Body text |
| night | `#060A14` | Dark surfaces only |

Check contrast: cyan `#3FB3D7` on white is too light for body text or small labels. Use navy or blue for text, and keep cyan for fills, icons and large elements. Status colors (success, warning, error) must be added to `packages/ui` once, checked for WCAG AA, and reused.

**Type:** Montserrat only. Light 300 for large display figures and page titles, Regular 400 for body, SemiBold 600 for labels and buttons. Use tabular numerals (`font-variant-numeric: tabular-nums`) for every amount, date and count.

**Logo and icon:** use the files in `docs/brand/` as they are. Never redraw, recolor or move the C.

## App theme (decided 18 Nov 2026: option B, brand blue)
- **Hero / key panel** (e.g. the payroll month on Home): solid blue `#0E7BB0`, all text **white** (white is the only text colour that passes AA on it; build hierarchy with size and weight). Inner cards `rgba(15,25,55,0.16)` with a `rgba(255,255,255,0.2)` border. Primary button white with navy text; secondary button transparent with a white border. Progress: white for done, `rgba(255,255,255,0.3)` for to-do.
- **Accents elsewhere are sky blues:** count badges and "today" chips cyan `#3FB3D7` with navy text; chart series blue `#0E7BB0` plus light sky `#9ED8EC`; progress bars cyan.
- **Navy `#0F1937` is ink only:** headings, body emphasis, small badges. No large navy surfaces.
- **Shell:** white collapsible sidebar (76 px icons only, 260 px with names on hover, focus or pin; drawer on phones), page background `#F0F0F0`, white cards with a `#E3E7EE` border.
- Reference mockup: `docs/design/home-dashboard.dc.html`.

## Feel
Airy, premium, calm. CPeople handles people's pay, so the UI must feel trustworthy and precise. One memorable element per screen at most; everything else stays quiet. No decorative gradients on content surfaces (the gradient belongs to the icon tile).

## HR and payroll patterns
- **Amounts:** right-aligned, tabular, with currency (`12 345,67 MAD` in FR, `MAD 12,345.67` in EN, formatted by locale via `Intl.NumberFormat`). Never round silently.
- **Tables** are the main working surface: sticky header, comfortable row height, clear sort and filter, row selection with the tint color, totals row where it makes sense. Don't chop table data into cards.
- **Payroll run status** is a real sequence (open → collect → calculate → review → approved → locked), so a stepper is appropriate there. Locked periods look visibly read-only.
- **Approvals** (leave N+1 / N+2, expenses): show who approves next and where the request is now.
- **Sensitive fields** (salary, CIN, RIB): masked by default for roles that may only partly see them; show only to roles allowed to see them.
- **Forms:** labels above fields, inline validation in plain words, one primary action per form, named for what it does ("Approve payroll", then the toast says "Payroll approved").
- **Empty states** tell the user what to do next ("No employees yet. Import your employee file or add one.").
- **i18n and RTL:** every string comes from `packages/shared` messages (EN and FR now, AR later). Use logical CSS properties (`ms-*`, `pe-*`, `start`, `end`), never left/right, so Arabic works later without a rewrite.

## Quality floor (every screen)
Responsive down to 375 px, visible keyboard focus (cyan ring), `prefers-reduced-motion` respected, WCAG AA contrast, no layout shift when data loads (skeletons sized like the content).

## Check your work with Playwright
After building or changing a screen:
1. Make sure the dev server is running (`pnpm dev`).
2. Use the Playwright MCP browser tools (configured in `.mcp.json`) to open the page, take screenshots at 1440 px and 375 px, and look at them.
3. Check them against this skill: tokens, Montserrat, alignment of amounts, contrast, focus states, French strings fitting their space.
4. Fix what's off, then add or update a test in `e2e/` for the screen's main path.
Before calling the screen done, take one more look and remove one thing that doesn't earn its place.
