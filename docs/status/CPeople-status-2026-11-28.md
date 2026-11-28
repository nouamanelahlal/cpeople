# CPeople — where the build stands

*28 November 2026 · for Youssef El Mokaddem · facts read from `main`, not from
memory · go-live 1 February 2027, fallback 1 March*

**Nine weeks to go-live.** The people half of the product is real and tested.
The pay half is not started. That sentence is the whole report; the rest is
evidence and consequences.

---

## 1. What is built

| | Module | Evidence on `main` |
|---|---|---|
| M01 | Tenant, company, sites, departments, cost centres | `organisation`, 694 lines + org chart |
| M02 | Users, roles, sign-in policy, MFA | Keycloak 26, our own sign-in theme, lockout tested |
| M03 | Employee record, dependents, salary history | `employees`, 2,568 lines API |
| M04 | Documents with expiry and reminders | covered end to end |
| M05 | Onboarding checklist | in the employee file, with the hire wizard |
| M06 | Organisation chart | read-only, from manager links |
| M07 | Contract templates and PDF generation | `contracts`, 1,067 lines, Gotenberg |
| M08 | Leave types, rules, holiday calendar | part of `time-absence`, 5,715 lines |
| M09 | Leave request, N+1 → HR approval, days to payroll | approval is a tenant setting |
| M21 | Tenant isolation, audit, insert-only evidence | 62 database tests |
| M23 | English and French | throughout, including e-mails |
| M24 | Country boundary | nothing Moroccan in the core |

**Part-built:**

- **M10 Attendance** — device format, sample export, provider specification,
  import, overtime, exceptions with seven fixes, recovery. **Timesheets and
  manual entry are next**; the monthly close is not built.
- **M12 Morocco pack** — a real pack with an engine, a validator and 45 tests.
  **All 20 statutory values are `unverified`**, and the engine refuses to
  calculate a production payroll while that is true.
- **M27 Country-pack format** — format, validator, lifecycle and import exist.
  No second country has used it.

**Not started — 14 of 29:** M11 pay elements · M13 payroll run · M14 off-cycle ·
M15 payslips · M16 Damancom · M17 IR data · M18 SAP posting · M19 migration ·
M20 parallel run · M22 Test/Prod, backups, monitoring · M25 expenses ·
M26 configuration framework · M28 bank file · M29 performance.

Those routes exist as placeholder screens. The API folders for `payroll`,
`payslips`, `declarations`, `accounting`, `migration` and `expenses` contain
**zero files**.

**Totals:** 18 pull requests merged · 24 migrations · 23 end-to-end files ·
**324 unit tests** (152 shared, 65 API, 62 database, 31 engine, 14 Morocco
golden payslips) · full suite green.

---

## 2. Named risks

### 2.1 Field-level encryption is not built

**M21 commits to encrypting salary, CIN and RIB at field level.** I searched:
there is no encryption anywhere in the codebase. Tenant isolation, the audit
log and the insert-only evidence tables are real and tested; this one is not.

It is in the fixed scope, and it is a data-protection commitment under Law
09-08 rather than a feature. Retrofitting encryption onto columns that are
already read by a dozen queries is more work than adding it now.

### 2.2 There is no Test or Prod environment, no backups, no monitoring

**M22 is CI only.** Lint, types, unit tests and the Playwright suite run on
every pull request. Everything else in M22 — three environments, backups, and
monitoring with a two-hour P1 response — does not exist.

Go-live needs all three, and the SoW commits to the response time. This is also
the gate on the country pack: the pack's lifecycle is **released Dev → Test →
Prod**, and two of those three do not exist yet.

### 2.3 Migration and parallel run are what make go-live safe

**M19 and M20 are not started.** The parallel run — CPeople beside the legacy
payroll, employee by employee, element by element — is usually the thing that
decides whether a go-live date holds, because it is the only evidence that the
new system agrees with the old one.

It cannot start until there is a payroll run to compare. The dependency chain
is M11 → M13 → M20, and none of the three exists.

### 2.4 Nobody qualified has checked a single Moroccan figure

All 20 statutory values are `unverified`. **15 of the 20 were read from
secondary sources** — consulting firms' articles and, for the 2026 minimum wage
and the income-tax scale, a jobs site. The articles of law are named and look
right; the numbers were not read from the law.

`docs/reviews/payroll-pack-to-verify.md` is the checklist: each parameter, its
value, the source it actually came from, and the official source to check it
against. **The expert is booked for early December.** Until that sign-off,
nothing in M12–M17 can be trusted, and the engine will refuse to produce a
production payslip — by design.

It also carries one question of method, not of figures: the income-tax scale
applied annually gives **2,201.27** for a worked example, and a monthly table
with the deduction rounded gives **2,201.28**. One centime, every month, for
every employee. The DGI decides which, not us.

### 2.5 Twenty open points are waiting on SMG

Twenty questions in `docs/specs/HR-02-open-points.md`, several of which change
arithmetic rather than wording: carry-over at year end, the recovery ratio,
whether scheduled night hours carry a premium, and which hours count as settled
when a recovery conversion is undone.

Every one has a seeded default marked "to confirm", so the demo works and
nothing is blocked today. But each is a figure on somebody's payslip, and a
late answer means re-testing rather than re-configuring.

---

## 3. What nine weeks can hold

Pace so far: HR-01 and six steps of HR-02 in about a week of building. That is
a real rate, but it has been spent on screens and rules over a schema that was
already designed. The remaining modules are not more of the same:

- **M13, the payroll run** — open, collect, calculate, review, approve, lock,
  versioned and audited — is the single largest piece left, and everything
  downstream waits on it.
- **M18, SAP posting** — a SOAP journal entry, debit against credit, a posting
  log and a re-post path — is an integration with somebody else's system, and
  those are slow for reasons outside this repository.
- **M19/M20** cannot start before M13.
- **M26**, the configuration framework, is the plan's B0 and the least-built
  phase. Every later phase is defined in terms of it.

### What I would expect to hold by 1 February

**The people half, complete and demonstrable.** Organisation, employees,
documents, onboarding, contracts, the org chart, leave end to end, attendance
through timesheets and the monthly close, with settings, audit and both
languages. That is M01–M10 and M21/M23/M24, most of which is done.

**One payroll month, calculated and checked** — if the expert signs the values
off in early December and M11/M13 start immediately after. That is tight but
not unreasonable.

### What would have to move to 1 March

- **M18 SAP posting.** It depends on a communication arrangement in SMG's
  S/4HANA that does not exist yet, and on a G/L mapping that is still marked
  "not agreed".
- **M20 parallel run**, and realistically **M19 migration** with it. A parallel
  run needs two Decembers or a December and a January to compare; starting it
  in late January leaves no room to resolve differences.
- **M28 bank file** and **M29 performance**, both of which arrived in scope
  late and neither of which blocks paying anybody.
- **M25 expenses.**

### The dates that decide it

| When | What has to be true |
|---|---|
| **Early December** | The payroll expert signs off the 20 Moroccan values. Everything in M12–M17 waits on this. |
| **Mid-December** | M11 pay elements and M13 payroll run under way; Test environment exists. |
| **Early January** | One full month calculated in CPeople and compared against the legacy payroll by hand, even without M20. |
| **Mid-January** | Encryption, backups and monitoring done — they cannot be added after go-live. |

**My honest reading:** 1 February is achievable for payroll *calculation* and
payslips, and not achievable for posting, migration and a proper parallel run.
The fallback of 1 March exists for exactly this, and using it for the
integration half while going live on the people half in February is a better
shape than moving everything.

---

## 4. What is unusually solid

Worth saying, because a risk list reads worse than the repository is:

- **Tenant isolation is tested table by table**, and a new table without a
  policy fails the suite rather than leaking in production.
- **Evidence is insert-only** in the database, not by convention: punches,
  audit events, leave calculations and decisions, recovery credits. Rates on
  `overtime_rule` and `tenant_contribution_rate` are write-once, so a
  correction is a new effective-dated row and past payslips keep their basis.
- **No legal value is in code.** Every one is a pack row with a source, a date
  and a status, and production refuses the unverified ones.
- **Arithmetic that reaches pay is a pure function with tests** — leave days,
  balances, overtime bands, recovery — including the cases that only show up on
  a payslip, like an hour settled in time never also being paid in money.
