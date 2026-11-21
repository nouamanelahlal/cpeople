# Keycloak realm (M02 / HR-08)

The realm is code, in two parts:

| Directory | What is in it | Who imports it |
|---|---|---|
| `import/` | The realm itself: flows, roles, password and lockout policy, clients, organisations | **Every environment** |
| `import-local-dev/` | Fake users, their passwords, the test authenticator secret | **A local checkout only** |

`import/` holds no users and no secrets, so the same file is what Dev, Test and Prod import.
The local Docker stack assembles its import directory from both, which is why the Keycloak
service in `infra/docker/docker-compose.yml` copies them in before starting.

Edit the file, then reload it:

```bash
docker compose -f infra/docker/docker-compose.yml up -d --force-recreate keycloak
```

The import strategy is "overwrite", so the file always wins. Anything changed by hand in the
admin console is lost on the next reload — which is the point. The realm import rejects
unknown fields, so the JSON carries no comments; this file is where the reasoning lives.

Admin console: http://localhost:8080 (`admin` / `admin_dev`, local only).

## The sign-in pages

The pages themselves are a Keycloakify theme in `packages/keycloak-theme`: React, built
into a Keycloak theme jar. Build it, then reload Keycloak:

```bash
pnpm kc:theme
docker compose -f infra/docker/docker-compose.yml up -d --force-recreate keycloak
```

The jar lands in `infra/keycloak/providers/`, which is mounted into the local container and is
**not** committed — it is a build artifact. Locally, a clone without it falls back to Keycloak's
own pages: unbranded, never broken.

**A deployed environment must not do that.** Keycloak falls back silently when a theme is
missing, so Dev, Test and Prod run `infra/keycloak/Dockerfile`, which bakes the jar in and
fails the image build if it is not there:

```bash
pnpm kc:image          # builds the theme, then the image
pnpm kc:verify-theme   # asks a running Keycloak whether it is really serving our pages
```

`verify-theme.mjs` is the deploy gate: point it at an environment's issuer and it exits
non-zero if that Keycloak has fallen back. CI runs the stack from this image and runs the gate
before the tests, so what the tests sign in against is what deploys.

`src/kc.gen.tsx` is generated, not committed: Keycloakify's Vite plugin writes it when the
theme is built, which a lint-and-types CI job never does. So `typecheck` runs
`keycloakify update-kc-gen` first — a clone that has never built the theme still typechecks.

Keycloakify packages the theme with Apache Maven. Nothing here needs a JDK installed:
`infra/keycloak/theme-builder/bin/mvn` runs the real Maven in a container, and the `.cmd`
beside it does the same on Windows, where Node looks for `mvn.cmd`.

`CPEOPLE_BOOK_A_DEMO_URL` on the Keycloak container is where the header's "Book a demo"
points; each environment sets its own.

The e-mails are a plain folder theme in `themes/cpeople/email`, with the same wording in
English and French as the pages. `html/template.ftl` holds the CPeople card every HTML e-mail
is built from, so a stock Keycloak e-mail we have not reworded still arrives looking like ours.

**A locked account e-mails its owner.** The realm adds Keycloak's `email` event listener, which
sends the account's owner our `event-user_disabled_by_temporary_lockout` message in their own
language — the person who meets the lock on screen is not always the person whose account it is.
That listener e-mails on every failed sign-in unless it is told otherwise, which would be a
mailbox full of mistyped passwords, so it is held to that one event by
`KC_SPI_EVENTS_LISTENER_EMAIL_INCLUDE_EVENTS` (set in `infra/keycloak/Dockerfile` for deployments
and in `infra/docker/docker-compose.yml` for the local stack). The realm locks temporarily and
never permanently; turning `permanentLockout` on would need its own wording, since Keycloak has
a separate event and template for it and only the stock English text would be there.

**Every sign-in error carries a way out.** Under the message the page shows one line — *Still
can't sign in? Reset your password or contact your HR administrator* — because the message
itself cannot say what went wrong without saying whether the account exists.

### Two steps, one submission: the pages never say who has an account

The sign-in page asks for an e-mail address, then for a password. Those two steps are the
page's own: the e-mail step sends nothing, and when the password is submitted both fields go up
together in one POST to `auth-username-password-form`.

It is built that way because the obvious alternative tells an attacker too much. An
identifier-first flow has to answer the first step somehow — a password prompt for one address
and an error for another, or just a slower reply — and whatever it answers is a yes/no on
whether that address has an account. With one submission there is nothing to answer: an unknown
address and a real one travel the same path and meet the same sentence, because Keycloak sees
the address at the moment it sees the password.

What this keeps:

- **Brute-force lockout.** Keycloak counts the failed submission as it always did. A locked
  account is refused even with the right password — in the same words as a wrong one, which is
  Keycloak's own behaviour for `auth-username-password-form` and the right answer here: "your
  account is locked" would confirm the address is real. The lock is in the refusal, not the
  wording.
- **The code step.** `conditional-user-role` still follows the password for the roles that need
  an authenticator code.

One thing moved with it: "Forgot password" now lands on the reset page with an empty field,
because the sign-in page never told Keycloak the address, and Keycloak forks back to the sign-in
page with the confirmation rather than showing its own "check your inbox" page. Both screens are
the theme's and both say the same non-revealing sentence; the `info.ftl` version still shows
when the reset page is opened without a sign-in already under way.

`e2e/m02-sign-in.spec.ts` holds both halves of the promise to the tests: the e-mail step makes
no request to Keycloak, and an unknown address and a real one are indistinguishable on screen
until the password error, which is the same error for both.

**Domain-based SSO routing is out of scope with this design.** Sending `@client.com` straight to
that client's identity provider needs the first step to be answered by the server, which this
flow deliberately does not do. If a client needs it later, revisit it with Organizations
identity-first: that reveals only whether a *domain* uses SSO, not whether an account exists.

### Organisation membership is not in the import

Realm import reads the organisations before it reads the user file, so a `members` list in
`import/` would point at users that do not exist yet — the import fails outright. Membership is
environment data anyway, so for a local checkout it is applied afterwards:

```bash
pnpm kc:local-dev
```

It joins each fake user to the organisation whose domain matches their e-mail domain, is
idempotent, and refuses to run without `CPEOPLE_LOCAL_DEV=true`. The end-to-end suite runs it
itself, so tests never meet a user whose token carries no tenant.

## What the realm sets up

**Email-first sign-in.** `registrationEmailAsUsername` makes the address the username. The
browser flow `cpeople-browser` has two authenticators; the person sees three steps, because the
page splits the first one (above):

| Step | Authenticator | Notes |
|---|---|---|
| Email | — | The page's own step. Reveals the password field, sends nothing |
| Password | `auth-username-password-form` | Both fields in one submission, with the address shown and a "forgot password" link |
| Code | `auth-otp-form` | Conditional — see below |

**The code step is conditional on a role.** `conditional-user-role` matches one role, not a
list, so the realm defines `mfa-required` as a marker role and composes it into
`payroll-manager`, `hr-admin` and `platform-admin`. A new role that should require a code
gets `mfa-required` added to it, and the flow needs no change. A holder who has not set up an
authenticator yet is made to enrol before they can continue.

**Organisations are tenants.** Each organisation carries a `tenantId` attribute holding the
tenant's id in Postgres. The `cpeople-web` client maps it into the token:

```json
"organization": ["smg-demo", { "smg-demo": { "tenantId": ["0193c0de-…-000000000001"] } }]
```

The API reads the tenant from there and from nowhere else. **The ids must match the tenant
rows seeded by `packages/db`** (`DEMO_TENANT_IDS` in `packages/db/src/seed.ts`); change one and
you must change the other.

**Clients.** `cpeople-web` is public and uses the authorization code flow with PKCE (`S256`,
enforced), because a browser app has nowhere to keep a secret. `cpeople-api` is bearer-only:
it exists so tokens can carry an audience the API can insist on, and it enables no flow of its
own. **No client secret appears in this repository.** Where an environment makes `cpeople-web`
confidential instead, the secret is provisioned with that environment and reaches the app as
`KEYCLOAK_CLIENT_SECRET`; the app then authenticates with `client_secret_post` rather than as a
public client.

**Security.** Brute-force protection locks an account for a doubling wait after 5 failures;
the lock is applied at the email step, before a password is asked for. The password policy is
12 characters with upper, lower, digit and symbol, not the username or email, and not one of
the last 5. Password reset is on, and local mail goes to Mailpit (http://localhost:8025).

**Languages.** Internationalisation is on with English and French (M23). The app sends
`ui_locales`; once Keycloak knows who the user is it switches to that user's own language, and
returns it in the `locale` claim, which the app then uses.

## Test users

Fake data only (CLAUDE.md rule 6). Every one of them uses the password `CPeople-Test-2027!`,
which is fine for a throwaway local realm and is used nowhere else.

| User | Role | Code step |
|---|---|---|
| `admin@smg-demo.test` | platform-admin | yes |
| `hr@smg-demo.test` | hr-admin | yes |
| `payroll@smg-demo.test` | payroll-manager | yes |
| `manager@smg-demo.test` | manager | no |
| `employee@smg-demo.test` | employee | no |
| `employee@atlas-demo.test` | employee, second tenant | no |
| `wrong-password-test@smg-demo.test` | employee | no |
| `lockout-test@smg-demo.test` | employee | no |

The last two exist so the end-to-end tests can fail a password on purpose: failed-attempt
counts are server-side and shared, so a user whose password gets deliberately mistyped must
not be one another test needs to sign in with.

`payroll@smg-demo.test` has a **known** authenticator secret so tests can generate codes:

- as Keycloak stores it: `cpeople-test-payroll-secret`
- as an authenticator app wants it (Base32): `MNYGK33QNRSS25DFON2C24DBPFZG63DMFVZWKY3SMV2A`

`e2e/support/sign-in.ts` turns the first into a six-digit code the same way an app would.

## Deploying this realm

Dev, Test and Prod import `import/` and nothing else — the fake users are not theirs to have —
then override what is environment-specific:

- `smtpServer` — a real provider, not Mailpit.
- The `cpeople-web` redirect URIs and web origins — the environment's own host, over https.
- Credentials: the realm creates no passwords and holds no client secret. Each environment
  provisions its own and passes them in as `KEYCLOAK_ISSUER` (https), `SESSION_SECRET`,
  `APP_URL` and, where the client is confidential, `KEYCLOAK_CLIENT_SECRET`.
- Organisation membership for real people, which replaces what `pnpm kc:local-dev` does here.

TODO(M02): confirm the password policy and the lockout thresholds with SMG's IT before
go-live. The values here are a sensible default, not a client decision.
