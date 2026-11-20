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
browser flow `cpeople-browser` runs three steps the person actually sees:

| Step | Authenticator | Notes |
|---|---|---|
| Email | `auth-username-form` | No password field on this page |
| Password | `auth-password-form` | Shows the address and a "forgot password" link |
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
