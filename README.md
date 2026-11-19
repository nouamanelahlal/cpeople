# CPeople by ConSAP

HR & Payroll SaaS. See `CLAUDE.md` for the rules and layout, `docs/mvp-scope.md` for the committed MVP scope.

## Getting started

```bash
corepack enable
pnpm install
pnpm exec playwright install chromium          # once
docker compose -f infra/docker/docker-compose.yml up -d
pnpm db:migrate                                # schema + row-level-security policies
pnpm db:seed                                   # two fake tenants
pnpm dev                                       # web on :3000, API on :3100
```

No `.env` is needed locally: the scripts above set `CPEOPLE_LOCAL_DEV=true`, which lets the
Docker credentials in `infra/docker/docker-compose.yml` stand in for `DATABASE_URL`. That
fallback is local only — in Dev, Test or Prod a missing `DATABASE_URL` stops the API at
startup rather than quietly pointing it at a localhost database.

The same goes for the tenant: until Keycloak lands (M02) an `x-tenant-id` header can choose it,
and that is honoured only when `TENANT_HEADER_ALLOWED=true` *and* `CPEOPLE_LOCAL_DEV=true`.
Setting it in a deployed environment stops the API at boot. See CLAUDE.md for both settings.

| Command | What it does |
|---|---|
| `pnpm dev` | Next.js on :3000 and NestJS on :3100 (OpenAPI at `/api/docs`) |
| `pnpm test` | Unit tests, including the tenant-isolation tests against Postgres |
| `pnpm e2e` | Playwright end-to-end tests (starts the web app itself) |
| `pnpm lint` · `pnpm typecheck` · `pnpm build` | The rest of the gate CI runs |
| `pnpm db:migrate` · `pnpm db:deploy` · `pnpm db:reset` · `pnpm db:seed` | Database |

## Tenant isolation

Every business table carries `tenant_id` and is protected by a Postgres row-level-security
policy (`packages/db/prisma/migrations/*_row_level_security`). Application code reaches the
database only through `withTenant()`, which opens a transaction as the unprivileged
`cpeople_app` role with `app.tenant_id` set, so the policies — not the query — decide what
is visible. `packages/db/test/rls.spec.ts` proves it, and fails if a new table with a
`tenant_id` ever ships without a policy.

## Layout

- `apps/web` — Next.js (App Router), Tailwind, ConSAP tokens from `packages/ui`
- `apps/api` — NestJS, one folder per module under `src/modules`
- `packages/db` — Prisma schema, migrations, RLS policies, seed (fake data only)
- `packages/ui` — ConSAP design tokens
- `e2e/` — Playwright tests, one per MVP feature, titled with its ID

Docs:
- `docs/product-brief.md`: product, brand and architecture brief (copy of the project's CLAUDE.md)
- `docs/mvp-scope.md`: requirement register, conflicts K1–K6, MVP features M01–M25
- `docs/decisions.md`: decisions log
