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
pnpm kc:local-dev                              # puts the fake users in their organisations
pnpm kc:theme                                  # builds the CPeople sign-in pages
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

Every tenant table carries `tenant_id`, has a Postgres row-level-security policy, and is
`FORCE ROW LEVEL SECURITY` so the policy applies to the table owner too.

Two independent things keep a request inside its own tenant:

1. **The runtime pool connects as `cpeople_app`**, which owns no table and holds only the
   grants it needs, so the policies apply to everything it runs. A query that skips
   `withTenant()` returns **zero rows**, not every tenant's rows. The owner role is used only
   by migrations and seeds, on its own connection (`MIGRATION_DATABASE_URL`).
2. **`withTenant()`** opens a transaction with `SET LOCAL ROLE cpeople_app` and
   `app.tenant_id` set, which is what makes the policies select the right rows. It is the only
   way to run a tenant-scoped query — `PrismaService` keeps its client private, and the API has
   no owner connection at all.

`packages/db/test/rls.spec.ts` proves all of it, and fails if a new tenant table ever ships
without row-level security, without `FORCE`, or without a policy.

## Sign-in

Email, then password, then a code for the roles that handle pay or platform settings. The
tenant travels in the token as a Keycloak organisation attribute, and the API trusts nothing
else for it.

The realm is imported in two parts: `infra/keycloak/import/` is the base — flows, roles,
policies, clients, organisations — which every environment uses and which holds no users and no
secrets; `infra/keycloak/import-local-dev/` holds the fake users and only the local stack loads
it. See `infra/keycloak/README.md`.

The web app is a plain OpenID Connect client built on `openid-client`: authorization code with
PKCE, an encrypted httpOnly session cookie, token refresh, and a sign-out that ends the Keycloak
session as well as this one.

## Layout

- `apps/web` — Next.js (App Router), Tailwind, ConSAP tokens from `packages/ui`
- `apps/api` — NestJS, one folder per module under `src/modules`
- `packages/db` — Prisma schema, migrations, RLS policies, seed (fake data only)
- `packages/ui` — ConSAP design tokens
- `packages/shared` — shared types and the EN/FR messages the UI renders from
- `infra/keycloak` — the sign-in realm, as code
- `e2e/` — Playwright tests, one per MVP feature, titled with its ID

Docs:
- `docs/product-brief.md`: product, brand and architecture brief (copy of the project's CLAUDE.md)
- `docs/mvp-scope.md`: requirement register, conflicts K1–K6, MVP features M01–M25
- `docs/decisions.md`: decisions log
