# CLAUDE.md — CPeople (code repository)

CPeople by ConSAP is a multi-tenant, multi-country HR & Payroll SaaS. Morocco is the first country pack. The first client is SMG (Maison Samira Maatouk Morocco), with go-live on **1 February 2027** (fallback 1 March 2027).

Product, brand and scope decisions live in `docs/`. Read `docs/mvp-scope.md` before building any feature.

## Stack
- **Frontend:** `apps/web`, Next.js (App Router) + TypeScript + Tailwind with the ConSAP design tokens from `packages/ui`. i18n EN + FR for the MVP; AR with RTL later, so never hard-code left/right (use logical CSS properties).
- **API:** `apps/api`, NestJS + TypeScript, REST + OpenAPI.
- **Database:** PostgreSQL + Prisma (`packages/db`). Row-level security on `tenant_id`.
- **Identity:** Keycloak (email + password, MFA for admin and payroll roles).
- **Jobs:** Redis + BullMQ. **Files:** S3-compatible (MinIO locally). **PDF:** Gotenberg. **E-mail (local):** Mailpit.
- **Package manager:** pnpm workspaces + Turborepo.

## Repository layout
```
apps/web                 Next.js front end
apps/api                 NestJS API (modular monolith, one folder per module)
packages/db              Prisma schema, migrations, RLS policies, seed (fake data only)
packages/payroll-engine  Country-neutral calculation core (pure functions, no rates)
packages/country-packs/ma  Morocco pack: rules, parameter seeds, declarations, payslip layout, public holidays
packages/ui              ConSAP design tokens + shared React components
packages/shared          Shared types, validation schemas, i18n messages
e2e/                     Playwright end-to-end tests
.claude/skills           Design skills for Claude Code
infra/docker             Local stack (Postgres, Redis, Keycloak, MinIO, Gotenberg, Mailpit)
.vscode                  Recommended extensions and editor settings
.claude/settings.json    Claude Code permissions (pnpm and docker allowed; .env files blocked)
.mcp.json                Playwright browser for Claude Code
docs/                    Scope, decisions (ADRs), specs
```

## API modules (`apps/api/src/modules`)
organisation · employees · time-absence · payroll · payslips · declarations · accounting (SAP) · expenses · integrations (attendance import) · migration (employee + YTD import, parallel-run report) · administration (users, roles, audit)

## Non-negotiable rules
1. **Tenant isolation.** Every business table has `tenant_id`, protected by a Postgres RLS policy. Never query without the tenant context set. Add a test for each new table.
2. **Country boundary.** Nothing Moroccan (CNSS, AMO, CIMR, IR, CIN, Damancom, Moroccan holidays) goes in the core or in `payroll-engine`. It goes in `packages/country-packs/ma`.
3. **No hard-coded legal values.** Rates, ceilings, tax brackets and deductions are effective-dated parameter rows. **Never write a rate from memory**; leave a `TODO(verify-official-rate)` and a placeholder seed marked as unverified.
4. **Money.** Use integer minor units (or a decimal library), never floats. Store the currency with every amount.
5. **Payroll runs are versioned and audited.** A recalculation creates a new version; a locked period is never edited.
6. **Sensitive data.** Salary, CIN and RIB are encrypted at field level. No real personal data in the repo, seeds, tests, logs or fixtures. Dev uses fake data only.
7. **SAP S/4HANA Cloud posting** uses the standard SOAP API *Journal Entry – Post* (communication scenario SAP_COM_0002). No custom SAP APIs.
8. **Traceability.** Every feature, PR and commit message references a requirement or feature ID from `docs/mvp-scope.md` (e.g. `M09 / HR-04`), or says `NEW`.
9. **Fixed scope.** Everything in `docs/mvp-scope.md` §3.1 is committed to the client. Don't add features outside it without a change request.
10. **Brand.** ConSAP tokens only (navy `#0F1937`, cyan `#3FB3D7`, blue `#0E7BB0`, Montserrat). Airy, premium, no clutter.
11. **Legal and tax.** You are not a payroll lawyer. Flag legal and tax logic for expert validation in the PR description.

## Environments
Dev (dev.cpeople.ma), Test (test.cpeople.ma), Prod (app.cpeople.ma). Each has its own database, Keycloak realm, secrets and storage. The same build moves Dev → Test → Prod and is never rebuilt in between.

## Commands
Once, on a new machine:
- `corepack enable` · `pnpm install` · `pnpm exec playwright install chromium`
- `docker compose -f infra/docker/docker-compose.yml up -d`
- `pnpm db:migrate` (creates the schema and the row-level-security policies) · `pnpm db:seed` (fake tenants)

Day to day:
- `pnpm dev` — web on :3000, API on :3100 (`/api/docs` for OpenAPI)
- `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm build`
- `pnpm e2e` · `pnpm e2e:ui` · `pnpm e2e:report`
- `pnpm db:deploy` (apply migrations) · `pnpm db:reset` (drop and rebuild, dev only)

`pnpm test` and `pnpm db:*` need the local Postgres up.

## Two database connections, never interchangeable
- `DATABASE_URL` — the **runtime** pool. Connects as `cpeople_app`, which owns no table and has
  only the grants it needs, so the row-level-security policies apply to every query it runs: a
  query that skips `withTenant()` returns nothing instead of every tenant's rows. The API has
  only this one.
- `MIGRATION_DATABASE_URL` — the **owner**. Migrations, seeds and tenant provisioning, on the
  command line. Never used to serve a request. In a deployed environment this role needs
  `BYPASSRLS` to provision tenants, because every tenant table is `FORCE ROW LEVEL SECURITY`.

The migrations create `cpeople_app` with no password; each environment gives it credentials when
the database is provisioned. Locally `pnpm db:migrate` does it on the throwaway Docker database.

## Sign-in (M02 / HR-08)
Keycloak. See `infra/keycloak/README.md`; in short:
- Email, then password, then a 6-digit authenticator code for holders of `mfa-required`, which
  `payroll-manager`, `hr-admin` and `platform-admin` are composed of.
- **The realm import is in two parts.** `infra/keycloak/import/` is the base realm — flows,
  roles, policies, clients, organisations — and every environment imports it. It holds no users
  and no secrets. `infra/keycloak/import-local-dev/` holds the fake users, their passwords and
  the test authenticator secret, and only the local Docker stack loads it.
- One Keycloak organisation per tenant, carrying the tenant's Postgres id as a `tenantId`
  attribute. **The API takes the tenant from that claim and from nowhere else.** The ids must
  match `DEMO_TENANT_IDS` in `packages/db/src/seed.ts`.
- Membership of the local fake users is applied by `pnpm kc:local-dev`, because realm import
  reads the organisations before the user file. The end-to-end suite runs it itself.
- The sign-in pages are ours: a Keycloakify (React) theme in `packages/keycloak-theme`,
  following `docs/design/login*.dc.html`. Build it with `pnpm kc:theme`; the jar is a build
  artifact and is not committed.
- The web app is a plain OpenID Connect client (`openid-client`): authorization code with PKCE,
  an encrypted httpOnly session cookie, refresh through `/api/auth/refresh`, and sign-out that
  ends the Keycloak session too. Every page is protected unless it is listed in `PUBLIC_PATHS`
  in `apps/web/proxy.ts`.
- `KEYCLOAK_ISSUER` and `SESSION_SECRET` (plus `APP_URL`, and `KEYCLOAK_CLIENT_SECRET` where the
  client is confidential) must be set in every deployed environment; only a local checkout falls
  back to the Docker realm.

## Settings that must never be set in a deployed environment
Both default to off, and the API refuses to start if the combination is wrong.
- `CPEOPLE_LOCAL_DEV=true` — marks a developer's checkout (and the CI database, which is the
  same throwaway stack). The repository's own scripts set it; no deployment does. It is what
  allows the local Docker credentials to stand in for the two URLs above, and what lets
  `local-dev-role` give `cpeople_app` a development password. Without it, a missing
  `DATABASE_URL` is a startup failure.
- `TENANT_HEADER_ALLOWED=true` — lets an `x-tenant-id` request header choose the tenant for a
  request with no token, which is useful for poking at the API locally. A client choosing its own
  tenant would reach every other tenant's payroll, so it is honoured only together with
  `CPEOPLE_LOCAL_DEV`; set in Dev, Test or Prod, it stops the API at boot. Signed-in requests do
  not use it: they carry the tenant in the token.

Dev, Test and Prod set `DATABASE_URL` (and `MIGRATION_DATABASE_URL` for the migration job) and
neither flag.

## Browser automation
Playwright only (tests in `e2e/`, live browser via `.mcp.json`). Do not add Puppeteer: it duplicates Playwright. Payslip and contract PDFs come from Gotenberg, not a headless browser in the app.

## Front-end work
- For any UI work, use the **cpeople-design** skill (`.claude/skills/cpeople-design`). It wins over the general **frontend-design** skill wherever they differ, because the brand is fixed.
- Check every screen with the Playwright MCP browser (`.mcp.json`): screenshots at 1440 px and 375 px, in EN and FR.
- Every MVP feature gets an end-to-end test in `e2e/`, titled with its ID (e.g. `M09 leave approval`).
- Brand files are in `docs/brand/`: use them as they are, never redraw. Favicons: `docs/brand/favicon/` (see its README for where each file goes in Next.js).
- Hover states: soft transitions (0.2 s ease) on background, border and shadow; a 1 px lift on buttons and 2 px on cards only when `prefers-reduced-motion` is not set. Reference: `docs/design/home-dashboard.dc.html`.

## Open decisions that affect code
GitHub or GitLab (CI), the hosting provider in Morocco, Damancom and IR file formats (payroll expert), UAE user access (K3). See `docs/decisions.md`.
