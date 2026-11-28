# Configurable core — what exists today, and how it joins up

*Mapping report. No integration code. Read against `main` at `5d05553` (HR-02
step 6 merged), the Build Specification v0.2 and the Configuration Catalogue
v0.2, both dated 28 November 2026.*

Everything below was checked against the repository rather than recalled. Where
a thing is marked **missing**, I looked for it and did not find it.

---

## 0. The short version

The catalogue describes **145 settings**. Counting generously, **38 exist today
as real settings** — a row somebody can change — and another **21 exist as
behaviour that is hard-coded but correct**. The remaining **86 are missing**,
and nearly all of them are in payroll, outputs, posting and migration, which is
the half of the product that has not been built.

Three things stand out, and none of them is about volume:

1. **The leave and attendance settings we already have are a different shape
   from the catalogue's.** They are columns on four tables, not entries in one
   resolvable configuration. Nothing is wrong with them; they simply do not yet
   answer `resolveConfig(tenant, asOf)`.
2. **The CI guard would fail on 134 lines today**, but only **15 of them are
   real** — and 10 of those 15 are user-facing sentences that say "SMG" out
   loud. Those are worth fixing whatever happens to the rest of this plan.
3. **The two pack formats are close enough to merge cleanly**, and the merge
   direction is obvious: the built format has the engine, the validator, the
   production guard and 45 tests behind it; the starter has a better key
   vocabulary. Keep the first, adopt the second's names.

---

## 1. Every `CFG-…` setting, and where it lives

**Legend.** **Setting** = a row or column somebody can change without a
release. **Code** = the behaviour is right but fixed. **Missing** = not built.

### 1.1 Organisation (`ORG`) — 2 of 10

| ID | Setting | Where it lives today | |
|---|---|---|---|
| CFG-ORG-01 | Tenant country pack | — the pack is loaded by import, not chosen per tenant | Missing |
| CFG-ORG-02 | Legal entities | `company` (one per tenant; no statutory-ID set) | Partial |
| CFG-ORG-03 | `payroll_enabled` per entity | — | Missing |
| CFG-ORG-04 | Work locations | `site` (code, name). Device link lives on `attendance_source`, not the site | Partial |
| CFG-ORG-05 | Department hierarchy, head | `department` (+ `head`) | **Setting** |
| CFG-ORG-06 | Cost-centre assignment mode | fixed: one cost centre per department | Code |
| CFG-ORG-07 | Reject department without cost centre | — | Missing |
| CFG-ORG-08 | Positions, employee categories | `position` exists; **categories do not** | Partial |
| CFG-ORG-09 | Currency of the legal entity | implicit MAD | Missing |
| CFG-ORG-10 | UI languages enabled | fixed `en, fr` in `packages/shared/src/messages` | Code |

### 1.2 Employee file (`EMP`) — 4 of 11

| ID | Setting | Where it lives today | |
|---|---|---|---|
| CFG-EMP-01 | Employee number scheme + format | `tenant_settings.employee_number_pattern` — **warning only, never blocks** | **Setting** |
| CFG-EMP-02 | Number immutable after creation | not enforced anywhere I could find | Missing |
| CFG-EMP-03 | External ID types; device ID = employee number | `employee_number_alias` maps a device number to a person | Partial |
| CFG-EMP-04 | Mandatory employee fields | fixed by the schema's `NOT NULL` columns | Code |
| CFG-EMP-05 | ID document types | `document_type` | **Setting** |
| CFG-EMP-06 | Custom fields | — | Missing |
| CFG-EMP-07 | Document types with expiry and alert lead | `document_type` (+ expiry) | **Setting** |
| CFG-EMP-08 | Default expiry alert lead | fixed in the Home "documents expiring" query | Code |
| CFG-EMP-09 | Onboarding checklist; `blocks_payroll` | `checklist_template` + `checklist_item_template`. **`blocks_payroll` missing** | Partial |
| CFG-EMP-10 | Payment methods allowed | — | Missing |
| CFG-EMP-11 | Bank account format | — | Missing |

### 1.3 Contracts (`CON`) — 2 of 5

| ID | Setting | Where it lives today | |
|---|---|---|---|
| CFG-CON-01 | Contract types with `has_end_date`, `in_payroll` | `contract_type`. **`in_payroll` missing** | Partial |
| CFG-CON-02 | Trial period per category | — | Missing |
| CFG-CON-03 | Template per type, merge fields | `contract_template` + `contract_clause` | **Setting** |
| CFG-CON-04 | Contract alerts: rule, lead, recipients | Home shows fixed-terms ending within a fixed window | Code |
| CFG-CON-05 | Fixed-term limits and enforcement | screen says the limits are SMG's to confirm; nothing enforced | Missing |

### 1.4 Leave (`LV`) — 14 of 28, the best-covered area

| ID | Attribute | Where it lives today | |
|---|---|---|---|
| CFG-LV-01 | code, name, **category** | `leave_type.code`, `.name`. **Category missing** | Partial |
| CFG-LV-02 | Entitlement | `leave_rule.entitlement_days` | **Setting** |
| CFG-LV-03 | Unit {working_day, calendar_day, **hour**} | `leave_type.day_basis` — working/calendar only. **`hour` missing**, which LV11 and LV16 need | Partial |
| CFG-LV-04 | Paid {full, none, **policy, insurer**} | `leave_type.paid` is a boolean | Partial |
| CFG-LV-05 | Attachment required; `blocks_submit` | `leave_type.requires_document`. **`blocks_submit` missing** | Partial |
| CFG-LV-06 | Minimum notice | `leave_rule.min_notice_days` | **Setting** |
| CFG-LV-07 | Half-day allowed | `leave_type.allows_half_days` | **Setting** |
| CFG-LV-08 | Approval chain | `leave_type.requires_second_approval` + `leave_settings.second_approver` — **two booleans, not a chain** | Partial |
| CFG-LV-09 | has_balance, negative_allowed, pool | `leave_type.tracks_balance`. **Negative and pool missing** | Partial |
| CFG-LV-10 | Accrual rule | `leave_rule.accrual_per_month`, `usable_after_months`, `seniority_bonus_days`, `seniority_bonus_every_years`, `cap_days` | **Setting** |
| CFG-LV-11 | Carry-over | `leave_rule.carry_over_mode`, `carry_over_max_days`, `carry_over_expiry_months` | **Setting** |
| CFG-LV-12 | `reporting_only` | — | Missing |
| CFG-LV-13 | `schedule_adjustment` | — | Missing |
| CFG-LV-14 | Active | `leave_type.active` | **Setting** |
| CFG-LV-20 | Leave year | `leave_settings.leave_year_start` | **Setting** |
| CFG-LV-21 | Holidays inside a leave not deducted | `packages/shared/src/leave-days.ts`, always on | Code |
| CFG-LV-22 | Minimum continuous block | — | Missing |
| CFG-LV-23 | Show accrual in self-service | the balances tab shows it; not switchable | Code |
| CFG-LV-24 | Reason required on request / approval / rejection | reason is optional on request, required on an HR override and a rejection | Partial |
| CFG-LV-25 | Annual plan and team calendar | calendar built; no flag | Code |
| CFG-LV-26 | Leave pay average | — | Missing |
| CFG-LV-27 | At exit: pay unused, deduct negative | — | Missing |
| CFG-LV-28 | Cancel an approved leave | built (cancellation request → HR); not a setting | Code |

Also: **`leave_settings.team_off_warning_percent`** (33) and
**`accrual_period`** exist in the database and are **not in the catalogue**.
Both are real settings. Under §0.2's rule — *a setting not in the catalogue does
not exist* — they are bugs, and the honest fix is to add them to the catalogue
rather than to delete them.

### 1.5 Time and overtime (`TIME`) — 11 of 24

| ID | Setting | Where it lives today | |
|---|---|---|---|
| CFG-TIME-01 | Legal weekly hours, max per day | `overtime_settings.normal_weekly_hours` (44), `daily_max_hours` (**12, not the pack's 10**) — and they sit in a **tenant** table where the catalogue puts them in the **pack** | Partial, misplaced |
| CFG-TIME-02 | Work schedules | `shift_pattern`, `work_schedule`, `work_schedule_day`, `employee_schedule` (+ `weekly_rest_day`) | **Setting** |
| CFG-TIME-03 | Temporary schedules (Ramadan) | — | Missing |
| CFG-TIME-04 | Minimum weekly rest | — | Missing |
| CFG-TIME-05 | Attendance sources and priority | `attendance_source` | **Setting** |
| CFG-TIME-06 | Device adapter and connection | `attendance_source.type` / `.endpoint`, shown as **Planned** | Partial |
| CFG-TIME-07 | File import layout | `attendance_source.mapping` (+ timezone, duplicate window) | **Setting** |
| CFG-TIME-08 | Unknown device IDs to a queue | `UNKNOWN_EMPLOYEE` exceptions, always on | Code |
| CFG-TIME-09 | Employees exempt from punching | — | Missing |
| CFG-TIME-10 | Anomaly rules, recipients, reason required | eleven fixed codes; **reason always required**; no recipients | Partial |
| CFG-TIME-11 | Lateness tolerance; deduction | `overtime_settings.lateness_tolerance_min` (10). **Deduction missing** | Partial |
| CFG-TIME-12 | Night window | the bands' own `time_from`/`time_to` (21:00–06:00) | **Setting** |
| CFG-TIME-13 | Period close and lock | `payroll_period` exists (open/locked); **the close is not built** | Partial |
| CFG-TIME-20 | Overtime trigger | `overtime_settings.threshold_mode` (`both`) | **Setting** |
| CFG-TIME-21 | Overtime approved before cut-off | — | Missing |
| CFG-TIME-22 | Premium bands | `overtime_rule` (band, day type, window, rate, **`applies_to`**), effective-dated, write-once | **Setting** |
| CFG-TIME-23 | Annual quota | — | Missing |
| CFG-TIME-24 | Holiday work compensated by {pay, rest, choice} | the **exception** offers both per day; no tenant default | Partial |
| **CFG-TIME-25** | **Recovery ratio** | **`overtime_settings.recovery_ratio`, default `1.0`, CHECK 0–3** | **Setting ✓** |
| **CFG-TIME-26** | **Undo after part is used** | behaviour is exactly `hr_override`, **hard-coded**. Not a setting; `block` and `allow` cannot be chosen | **Code** |
| **CFG-TIME-27** | **Which hours count as settled** | exactly `proportional`, **hard-coded** in `apportion()`. The other two cannot be chosen | **Code** |

**On CFG-TIME-25/26/27 specifically**, since you asked me to check names and
defaults:

- **Names and defaults match** what was built for open points 18–20. The ratio
  is a real setting; the other two are the catalogue's defaults, implemented but
  not yet selectable.
- **One difference to settle:** the catalogue says the ratio range is `0–3`; the
  database says `> 0 AND <= 3`. Zero is excluded deliberately — a ratio of zero
  credits no time at all, which is "do not offer recovery" rather than a ratio.
  If the catalogue means to allow it as an off switch, CFG-TIME-24 is the better
  place and the constraint should stay as it is.
- **"Settled at the next conversion or at exit" is not built.** Nothing consumes
  a negative recovery balance. The balance can go below zero and is visible in
  the credit rows, but there is no employee-facing recovery balance screen, and
  no exit calculation to settle it against. **Noted for the payslip/exit step**
  — it belongs with PE10 (exit pay) and CFG-LV-27, which are both missing too.

### 1.6 Holidays (`HOL`) — 3 of 3

| ID | Setting | Where it lives today | |
|---|---|---|---|
| CFG-HOL-01 | Calendar per year, `confirmed` | `public_holiday` + `public_holiday_year` ("holidays complete for this year") | **Setting** |
| CFG-HOL-02 | Recompute approved leave when a date moves | built: affected requests appear on **"To review"** with old and new counts | Code |
| CFG-HOL-03 | Tenant extra holidays | same table; anybody may add a row | **Setting** |

### 1.7 Payroll (`PAY`) — 0 of 29

`payroll_period` (month, open/locked) is the only row that exists, seeded by
HR-02 so leave corrections have a month to land in. **Everything else is
missing**: the calendar, the cut-off, proration, the hourly divisor, rounding,
run types, the population rule, every pay-element attribute, the element list,
and the approval states.

The Morocco pack **does** carry `PAYROLL_DAYS`, `PAYROLL_HOURS` and the wage
types — so some of CFG-PAY-05/06 exists as pack data with nothing reading it.

### 1.8 Statutory (`STAT`) — the one area that is ahead

| Key | Where it lives today | |
|---|---|---|
| `ma.cnss.*`, `ma.amo.*`, `ma.af.*`, `ma.tfp.*`, `ma.ir.*`, `ma.smig.*`, `ma.seniority.bands[]` | `packages/country-packs/ma/pack.json`, effective-dated, **all 20 `unverified`** with a source | **Pack ✓** |
| `ma.time.weekly_hours`, `max_daily_hours`, `hourly_divisor_default` | `PAYROLL_HOURS` is in the pack; **weekly and daily maximums are in `overtime_settings`**, a tenant table | Misplaced |
| `ma.leave.*` floors, `ma.overtime.min_premiums[]`, `ma.cdd.*` | **in tenant tables** (`leave_rule`, `overtime_rule`) as "to confirm" demo values | Misplaced — this is §0.2's transition |
| CFG-STAT-01 CIMR | `tenant_contribution_rate` (`CIMR_EE`, `CIMR_ER`, both 0), effective-dated, write-once | **Setting ✓** |
| CFG-STAT-02 Mutuelle | the same table would hold it; no rows | Partial |
| CFG-STAT-03 Voluntary pension | — | Missing |

### 1.9 The rest — 2 of 48

| Area | Where it lives today |
|---|---|
| **Outputs** (`OUT`, 7) | **All missing.** No payslip, no declarations, no bank file |
| **Posting** (`POST`, 8) | **All missing.** `apps/api/src/modules/accounting` is an empty folder |
| **Security** (`SEC`, 8) | CFG-SEC-01 roles: `packages/shared/src/access.ts` (**Code**, product roles). CFG-SEC-04 salary visibility: `tenant_settings.employees_see_salary`, API-enforced (**Setting ✓**). CFG-SEC-05 MFA: the Keycloak realm (**Code**). CFG-SEC-02/03/06/07 partial or missing. **CFG-SEC-08 encryption at rest: missing** |
| **Notifications** (`NOT`, 3) | A mail service exists and sends leave e-mails in the recipient's language. No settings, no templates table |
| **Migration** (`MIG`, 5) | **All missing.** `apps/api/src/modules/migration` is empty |
| **Parallel run** (`PR`, 5) | **All missing** |
| **Feature flags** (`FEAT`, 8) | **No flag mechanism exists at all** |

Two more settings exist in `tenant_settings` and are **not in the catalogue**:
`show_leave_type_to_colleagues` and `employees_edit_contact`. Same treatment as
the two leave ones above — add them.

---

## 2. The two pack formats, side by side

| | **Built** (`main`) | **Starter** (`incoming/`) |
|---|---|---|
| Top-level | `format`, `manifest`, `fields`, `holidays`, `leaveTypes`, `payroll` | `meta`, `params`, `leave`, `time`, `payroll` |
| Parameters | 20 rows, each `key`/`type`/`value`/`validFrom`/`status`/`source`/`label` | keyed object, `ma.cnss.ee_rate` style, mostly `null` |
| Values | **Decimal strings**, never floats | numbers and nulls |
| Effective dating | `validFrom` per row; overlaps refused by the validator | a `valid_from` field, no overlap check |
| Status | `unverified` → `verified`; **production refuses unverified** | `status` present, no engine behind it |
| Lifecycle | `placeholder → template → prototype → validated → released → retired`, enforced | named in the spec, not in the file |
| Formulas | own expression language, sandboxed, 62 tests | — |
| Tests | 45 (31 engine + 14 golden payslips) | — |
| Key naming | `CNSS_EE_RATE` | **`ma.cnss.ee_rate`** — better: namespaced, matches the catalogue |

### Merge plan — keep the built format, adopt the starter's names

**Every value and every source in #28 survives.** That is the constraint, and it
is met by renaming keys rather than rewriting rows.

1. **Add a `key` alias map to the pack format.** Each parameter row gains the
   dotted key (`CNSS_EE_RATE` → `ma.cnss.ee_rate`). One mechanical pass over 20
   rows; `value`, `validFrom`, `status`, `source` and `label` are untouched.
2. **Make the dotted key the one the engine reads**, with the old name kept as
   an alias for one release so `golden.spec.ts` keeps passing unchanged. The
   golden figures are the regression test for the whole merge: if any of the 14
   moves, the merge is wrong.
3. **Adopt the starter's missing keys as `null` rows** — `ma.ir.exempt.transport`,
   `ma.ir.exempt.meal`, `ma.anapec.*`, `ma.time.min_weekly_rest_hours`. A `null`
   with a source and `unverified` is better than an absent key: the validator
   can then say what is still owed.
4. **Do not adopt the starter's structure** (`meta`/`params`/`leave`/`time`).
   The built `manifest`/`fields`/`holidays`/`leaveTypes`/`payroll` shape is what
   the validator, the lifecycle guard and `assertPackUsable` already enforce.
5. **Move the misplaced statutory values** — §0.2's transition — as a second,
   separate change: `ma.leave.*` floors and `ma.overtime.min_premiums[]` out of
   `leave_rule` and `overtime_rule` and into the pack, with the tenant rows
   keeping only what is above the floor. This is the biggest piece of work in
   the whole integration and it touches live demo data, so it should not ride
   along with a rename.

**Risk worth naming:** step 5 changes where leave entitlements come from, and
`leave_rule` is read by the balance arithmetic, the carry-over job and the
day-count. The golden payslips do not cover leave. Before that move, the leave
balance tests are the only safety net, and they should be read as such.

---

## 3. What the CI guard would flag today

`node scripts/check-no-tenant-names.mjs` → **134 lines**, exit 1.

| Count | What it is | Verdict |
|---|---|---|
| 42 | **Demo seed data** (`packages/db/src/demo/**`) | Move to fixtures the guard skips, as planned |
| 27 | **Doc comments** explaining why a decision was made ("a question for SMG") | Keep; widen the guard |
| 18 | **Generated Prisma client** (`packages/db/src/generated/**`) | Not hand-written. The guard must skip `generated` |
| 15 | **OpenAPI examples** (`example: 'SMG-0042'`) | Change to a neutral example — they appear in published API docs |
| 14 | **Schema and migration comments** | Keep; widen the guard |
| 3 | **Morocco pack notes** | Keep; the pack is allowed to name the client whose accountant must sign it off |
| **15** | **Real references in product code** | **Fix — see below** |

### The fifteen that matter

Ten are **user-facing sentences** in `packages/shared/src/messages/{en,fr}.ts`:

- `proposed: 'Proposed — to confirm with SMG'`
- `'Nothing here is a legal value. … waiting for SMG and the payroll expert'`
- `'Each of these is SMG's decision, and each one is enforced by the server …'`
- `numberWarning: 'This does not match the format SMG expects ({pattern})'`
- and their French twins.

These are the real violation: **the next tenant's HR administrator would read
another company's name on their own settings screen.** The fix is a message
parameter — the tenant's name, or simply "your company" — not a deletion.

The other five:

- `contracts.service.ts` — `FOOTER_NOTE = 'Modèle de démonstration CPeople — texte à valider par SMG.'`, printed into a generated contract PDF
- `leave-import.service.ts` — `'SMG-0001'` as a fallback employee number in the import template
- a comment in `apps/web/app/settings/attendance/page.tsx`
- two more OpenAPI examples

**Recommendation:** turn the guard on **after** fixing those fifteen and
widening `SKIP_DIRS` to include `generated`, with the seed moved to fixtures.
Flagging 134 lines on day one would train everybody to ignore it.

---

## 4. B0–B5 against what is built

| Phase | Due | What it asks for | Where we are |
|---|---|---|---|
| **B0** | 2 Dec | `packages/config`, settings service, generic admin screens, MA pack skeleton, CI guard | **Pack: ahead** — a real pack with an engine, a validator, a lifecycle and 45 tests, beyond a skeleton. **`packages/config`: not integrated** (starter only). **Settings service: missing.** **Generic admin screens: missing** — ours are hand-written per area. **Guard: ready, would fail** |
| **B1** | 2 Dec | Organisation, security, import for set-up sheets, SMG config loaded from a file | **Organisation and security: built** (M01, M02, M03, M06, RLS, audit, roles). **Config-from-file: missing** — settings are rows, entered by hand |
| **B2** | 15 Dec | Approvals engine, leave, employees, contracts, templates, employee import | **Leave, employees, contracts: built and tested.** **The approvals *engine* is missing** — we have two booleans (`requires_second_approval`, `second_approver`), not configurable chains. **Employee import: missing** |
| **B3** | 24 Dec | Time (file + manual), regular payroll run, payslip | **Time: built** through step 6 — import, overtime, exceptions, recovery. **Manual entry: step 7, not built.** **Payroll run: missing.** **Payslip: missing** |
| **B4** | 8 Jan | SAP posting, Damancom, IR, bank writer, off-cycle | **Nothing built.** Four empty module folders |
| **B5** | 22 Jan | Parallel run, December then January | **Nothing built** |

**The honest reading:** B1 is largely done and B2 is two-thirds done, but B0 —
the thing everything else is defined in terms of — is the least done. We built
the features first and the configuration layer not at all. That is not wasted
work: the features are real and tested. But every B-phase after B0 assumes
settings resolve through one place, and today they resolve through four tables
and a lot of columns.

**The date that worries me is B3, 24 December**: a payroll run and a payslip, in
three weeks, on top of a payroll engine that currently has no run around it and
whose 20 parameters are all unverified until the expert signs them off in early
December.

---

## 5. Where the spec conflicts with the repo, and what I would change

### 5.1 Settled — v0.2 already fixed it

**Percent storage (§0.3, C8).** v0.1 defined `percent` as a fraction, which
collided head-on with `overtime_rule.rate_percent` holding `25`. v0.2 resolves
it exactly as the code does: fraction in the schema and `ResolvedConfig`, the
database may store a percentage, `resolveConfig` converts, and **every screen
types and shows a percentage with a `%` suffix**. That matches the step 8 note
in `HR-02-build-report.md` and both database guards. Nothing to change.

### 5.2 CFG-TIME-01: the daily maximum, 10 h or 12 h

The catalogue says the pack's 10 h governs and the build's 12 h "is aligned to"
it. **I would not simply change the number.** `daily_max_hours` drives the
`OVER_DAILY_MAX` exception, so lowering it to 10 turns every 10–12 hour day in
the demo into an open exception — and from step 10 an open exception blocks the
month. That is probably *correct*, but it is a visible change to the demo and it
should be made deliberately, with the seed and the smoke test adjusted together.

### 5.3 The statutory transition (§0.2) is bigger than one line

Moving `ma.leave.*` and `ma.overtime.min_premiums[]` out of tenant tables into
the pack changes where the leave balance, the carry-over job and the day-count
read their numbers. I would do it **as its own phase after B0**, not inside it,
and I would write the leave-balance golden cases *first* — there is no payroll
golden test covering leave, so the move would otherwise be unguarded.

### 5.4 Two things I would add to the catalogue

Four settings exist in the database and not in the catalogue
(`team_off_warning_percent`, `accrual_period`, `show_leave_type_to_colleagues`,
`employees_edit_contact`). §0.2 rule 5 says the catalogue is the place to
propose a setting before building it; these were built first. The fix is to add
them, not to remove them — all four are real, used, and the kind of thing the
next tenant will also want.

### 5.5 One structural disagreement

**The catalogue puts `CFG-WF-01` approval chains in `CORE` as an engine, and I
think that is right — but it means replacing what step 2 built**, not extending
it. `requires_second_approval` plus `second_approver` cannot express
`[manager_level(1), role(HR)]` for one leave type and something else for
another. PR #24 made the second approver a setting, which the catalogue
explicitly checks for; the chain engine supersedes it. Worth saying out loud
because it is the one place where the configurable core **deletes** working
code rather than wrapping it.

### 5.6 What I would not change

The pack format, the production guard on unverified values, the write-once
columns on `overtime_rule` and `tenant_contribution_rate`, and the insert-only
evidence tables. All four are stricter than the catalogue requires, and the
catalogue's C8 and C9 entries suggest it is converging on them rather than the
other way round.

---

## 6. What I would do first

Not a plan — you asked for a mapping — but the order the facts suggest:

1. **Fix the fifteen real guard hits** and widen `SKIP_DIRS`. Small, and it
   stops a screen telling the next client about SMG.
2. **Add the four missing settings to the catalogue**, so it is true.
3. **`packages/config` into the workspace** with its tests, which is the only
   B0 item that is cheap and unblocks the rest.
4. **Merge the pack formats by renaming keys**, with the 14 golden payslips as
   the regression test.
5. **`resolveConfig(tenant, asOf)` over the existing tables** — no migration, no
   behaviour change, just one place to ask. Payroll becomes its first reader.

Steps 4 and 5 are where the value is. Steps 1 to 3 are a morning.
