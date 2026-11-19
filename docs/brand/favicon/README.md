# CPeople favicon set

Exported from the master icon `docs/brand/ConSAP_CPeople.png` (never redraw it). Checked: clear at 32 and 48 px; at 16 px the tile and the C carry the brand.

When `apps/web` (Next.js App Router) is scaffolded:
- `favicon.ico` (16, 32, 48) → `apps/web/app/favicon.ico`
- `icon-512.png` → `apps/web/app/icon.png`
- `icon-180.png` → `apps/web/app/apple-icon.png`
- `icon-192.png`, `icon-512.png`, `site.webmanifest` → `apps/web/public/`, and add `manifest: '/site.webmanifest'` to the root layout metadata.

Next.js generates the `<link>` tags for the files in `app/` automatically.
