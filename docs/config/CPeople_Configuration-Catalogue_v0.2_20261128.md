# CPeople – Configuration catalogue

| Item | Value |
|---|---|
| File | `docs/config/CPeople_Configuration-Catalogue_v0.2_20261128.md` (replaces v0.1) |
| Version | v0.2 |
| Date | 28 Nov 2026 |
| Author | ConSAP · CPeople product |
| Status | Draft for Youssef El Mokaddem (product scope) and ConSAP HR (values) |
| First tenant | Maison Samira Maatouk Holding Morocco (SMG) |
| Sources | SMG build spec HR-01–03 v0.1 (28 Nov 2026), `CLAUDE.md` §4, `claude/CPeople_MVP_scope_and_SoW_conflicts.md` v0.2 |
| Classification | Internal ConSAP. Holds no personal data |

| Version | Change |
|---|---|
| 0.1 | First catalogue from workshops HR-01–03 |
| 0.2 | Aligned with the built code (28 Nov 2026): percent storage note (§0.3), statutory seeds to move out of tenant tables (§0.2), daily maximum 10 h (CFG-TIME-01), period boundaries before the attendance close (CFG-PAY-03), approval chain check (CFG-WF-01), stronger payslip password default (CFG-OUT-03, NEW-07), recovery settings CFG-TIME-25..27 (HR-02 open points 18–20). Changes C8–C10 |

---

## 0. Purpose and rules

**Goal:** a new client is onboarded by configuration only. No code changes for a new client in a country that already has a pack.

This catalogue lists every setting the product exposes, who owns it, its default, and SMG's value. It is the contract between the product and every tenant. The code schema in `packages/config` mirrors it one for one: **a setting that is not in this catalogue does not exist, and a setting in this catalogue that is not in the schema is a bug.**

### 0.1 Layers

| Layer | Owner | Where it lives | How it changes |
|---|---|---|---|
| `CORE` | CPeople product | Code (features) + product defaults in `packages/config` | Product release. A new setting = a product change, reusable by every tenant |
| `PACK` | Country pack (here `ma`) | `packages/country-packs/<cc>/pack.json`, effective-dated, each value with `source` and `status` | Reviewed PR, released Dev → Test → Prod. Every value starts `unverified`; the engine refuses to run a production payroll if any value it uses is `unverified` |
| `TENANT` | The client company (HR / admin) | Effective-dated tenant tables in the database; exported/imported as a tenant config file (`tenants/<code>.config.json`) | Edited in the admin UI by an authorised user; audit-logged; never in code |

A pack may provide **defaults** for tenant settings (e.g. the Moroccan statutory leave types). The tenant can extend or restrict them but never go below a statutory minimum flagged `floor` in the pack.

### 0.2 Rules for Claude Code

1. No `if tenant == …` anywhere. Behaviour differences between clients come only from settings in this catalogue.
2. No statutory value in code or in tenant tables. Statutory values come from the pack. Tenant tables hold only the company's own values, validated against the pack floor (T-CFG-03). **Transition:** the leave accrual rules and overtime rates seeded today in tenant tables (`leave_rule`, `overtime_rule`) as "to confirm" demo values move to the pack keys `ma.leave.*` and `ma.overtime.min_premiums`; the tenant rows keep only values above the floor.
3. Every tenant setting is **effective-dated** (`valid_from`, `valid_to`) and **audit-logged** (who, when, old, new).
4. Feature flags are product settings (`CFG-FEAT-*`), switched per tenant. A flag never hides client-specific code.
5. When a request cannot be met by an existing setting: propose a new generic setting here first (PR to this file), then build it, then configure the tenant.
6. Status of SMG values follows the build spec: `DECIDED`, `PROPOSED` (configure, default as shown, easy to change) or `OPEN` (leave the default, mark `TODO(OPEN-xx)`; do not guess).

### 0.3 Value types used below

`bool`, `int`, `decimal` (MAD amounts: 2 decimals, decimal type, never float), `percent` (decimal, 0.25 = 25 % in the schema and in `ResolvedConfig`; a database column may store a percentage instead, e.g. `overtime_rule.rate_percent` = 25, and `resolveConfig` converts; **every screen types and shows a percentage with a % suffix**, never a fraction), `duration` (ISO 8601, e.g. `P30D`, `PT10M`), `time` (HH:MM), `enum{…}`, `list<…>`, `ref<entity>`, `formula` (see CFG-PAY-12), `template` (document template file + merge fields).

---

## 1. Tenant and organisation (`ORG`)

| ID | Setting | Layer | Type | Product default | SMG value | Status | Trace |
|---|---|---|---|---|---|---|---|
| CFG-ORG-01 | Tenant country pack | TENANT | enum{ma} | — | `ma` | DECIDED | Annex 1 D |
| CFG-ORG-02 | Legal entities (employing companies), each with country, statutory IDs per pack (MA: CNSS employer no, IF, ICE, RC, patente) | TENANT | list<legal_entity> | — | 1 entity `SMG-MA` (Maison Samira Maatouk Holding Morocco); **plus** the UAE company as a non-payroll entity for approvers | DECIDED (UAE `OPEN-12`) | REQ-ORG-01, REQ-EMP-04 |
| CFG-ORG-03 | Legal entity in CPeople payroll (`payroll_enabled`) | TENANT | bool per entity | true | `SMG-MA` = true; UAE entity = false | DECIDED / `OPEN-12` | REQ-EMP-04, HR-02 D7 |
| CFG-ORG-04 | Work locations (code ≤ 10, has attendance device, device ref) | TENANT | list<location> | — | 5 locations from the enterprise structure workbook, kitchen and pastry separate | DECIDED | REQ-ORG-02 |
| CFG-ORG-05 | Department hierarchy, head | TENANT | list<department> | — | From H03 | DECIDED | REQ-ORG-04 |
| CFG-ORG-06 | Cost centre assignment mode | CORE | enum{department, assignment_override, split} | `department` | `department` (one cost centre per department, no override) | PROPOSED (`OPEN-11`) | REQ-ORG-03 |
| CFG-ORG-07 | Department without cost centre is rejected | CORE | bool | true when ERP posting is on | true | PROPOSED | REQ-ORG-03 |
| CFG-ORG-08 | Positions, employee categories | TENANT | list<position>, list<category> | Pack default categories | Categories: Executive, Supervisor, Employee, Worker | DECIDED | H04 |
| CFG-ORG-09 | Currency of the legal entity | PACK default / TENANT | ISO 4217 | Pack: `MAD` | `MAD` | DECIDED | Spec §0.5 |
| CFG-ORG-10 | UI languages enabled | TENANT | list<enum{en,fr,ar}> | `en, fr` | `en, fr` (FR for HR users to confirm) | PROPOSED | MVP M23 |

## 2. Employee file (`EMP`)

| ID | Setting | Layer | Type | Product default | SMG value | Status | Trace |
|---|---|---|---|---|---|---|---|
| CFG-EMP-01 | Employee number scheme | CORE | enum{auto_sequence, manual} + format regex | `auto_sequence` | `manual`, value = biometric device ID, text, leading zeros kept; regex `TODO(OPEN-08)` | DECIDED / `OPEN-08` | REQ-EMP-01 |
| CFG-EMP-02 | Employee number immutable after creation | CORE | bool | true | true | DECIDED | REQ-EMP-01 |
| CFG-EMP-03 | External ID types (device ID, legacy payroll ID, ERP ID) and whether the device ID must equal the employee number | CORE | list<external_id_type>, bool | `device_id`, `legacy_payroll_id`; equal = false | `device_id` equal to employee number = **true**; `legacy_payroll_id` (provider) | PROPOSED | REQ-EMP-01, REQ-ATT-06 |
| CFG-EMP-04 | Mandatory employee fields (beyond pack mandatory fields) | TENANT | list<field> | Pack list | Spec §4.2 list | DECIDED | REQ-EMP-02 |
| CFG-EMP-05 | ID document types | PACK default / TENANT | list | MA: CIN, Residence card, Passport | Pack default | DECIDED | H06 |
| CFG-EMP-06 | Custom fields on the employee (name, type, required, visible to roles) | TENANT | list<custom_field> | none | none | — | Product |
| CFG-EMP-07 | Employee document types, each with `has_expiry`, `alert_lead` | TENANT | list<doc_type> | Pack default list, no alerts | Types: CIN, Residence permit, Work permit, Medical aptitude, Diploma, Signed contract, CNSS certificate, Photo, Other. Alerts: `TODO(OPEN-10)` | PROPOSED / `OPEN-10` | REQ-EMP-03 |
| CFG-EMP-08 | Default document expiry alert lead time | TENANT | duration | `P30D` | `P30D` | PROPOSED | REQ-EMP-03 |
| CFG-EMP-09 | Onboarding checklist items; `blocks_payroll` per item | TENANT | list<checklist_item> | none | Documents held, contract signed, CNSS affiliation, bank details — all `blocks_payroll = true` | DECIDED | REQ-EMP-02 |
| CFG-EMP-10 | Payment methods allowed | TENANT | list<enum{transfer, cheque, cash}> | `transfer` | `transfer, cheque, cash` | DECIDED | H08 |
| CFG-EMP-11 | Bank account format validation | PACK | regex | MA: RIB 24 digits | Pack | DECIDED | REQ-MIG-03 |

## 3. Contracts (`CON`)

| ID | Setting | Layer | Type | Product default | SMG value | Status | Trace |
|---|---|---|---|---|---|---|---|
| CFG-CON-01 | Contract types, each with `has_end_date`, `in_payroll`, `default` | PACK default / TENANT | list<contract_type> | MA pack: CDI, CDD, ANAPEC, Temporary agency | CDI (default, payroll), CDD (end date, payroll), ANAPEC (end date, payroll, pack exemptions), Temporary agency (**`in_payroll = false`**) | DECIDED | REQ-CON-01, REQ-CON-04 |
| CFG-CON-02 | Trial period is a period inside the contract (not a type); default length per category | CORE / TENANT | duration per category | none | `TODO(NEW-02)`: SMG lengths per category (pack gives legal maximums) | PROPOSED | REQ-CON-01 |
| CFG-CON-03 | Contract document template per type, merge fields | TENANT | template | none | 4 SMG templates `TODO(OPEN-09)` | DECIDED / `OPEN-09` | REQ-CON-02 |
| CFG-CON-04 | Contract alerts: rule, lead time, recipients | TENANT | list<alert_rule> | CDD end `P30D` | CDD end `P30D`; ANAPEC end `P30D`; trial end `P7D`; to role HR | DECIDED (lead times for ANAPEC and trial PROPOSED) | REQ-CON-03 |
| CFG-CON-05 | Fixed-term contract limits (max duration, renewals) and enforcement | PACK + CORE | duration, int, enum{warn, block} | MA pack value; `warn` | MA pack (new activity: 1 year, renewable once); `warn` | DECIDED (values to validate, `OPEN-26`) | REQ-CON-03 |

## 4. Leave (`LV`)

### 4.1 Leave type definition (every leave type is a record with these attributes)

| ID | Attribute | Layer | Type | Product default |
|---|---|---|---|---|
| CFG-LV-01 | `code`, `name` (EN/FR/AR), `category` ∈ {annual, family_event, maternity, paternity, sick, work_accident, unpaid, compensatory, other} | PACK default / TENANT | — | — |
| CFG-LV-02 | `entitlement` — fixed days per event, or accrual (see CFG-LV-10), or none | PACK floor / TENANT | rule | — |
| CFG-LV-03 | `unit` ∈ {working_day, calendar_day, hour} | TENANT | enum | `working_day` |
| CFG-LV-04 | `paid` ∈ {full, none, policy, insurer} + `policy` parameter (ref pay element / formula) | PACK / TENANT | enum + ref | — |
| CFG-LV-05 | `attachment_required` (doc type) and `blocks_submit` | TENANT | ref, bool | false |
| CFG-LV-06 | `min_notice` (calendar days) | TENANT | int | 0 |
| CFG-LV-07 | `half_day_allowed` | TENANT | bool | true |
| CFG-LV-08 | `approval_chain` (ref CFG-WF-01) | TENANT | ref | tenant default chain |
| CFG-LV-09 | `has_balance`, `negative_allowed`, `balance_pool` (own, or shared with another type) | TENANT | bool, bool, ref | true, false, own |
| CFG-LV-10 | Accrual rule: rate per period, period, start after service, seniority increments, annual cap | PACK floor / TENANT | rule | — |
| CFG-LV-11 | Carry-over: allowed, max years, expiry job, warning lead | PACK floor / TENANT | bool, int, duration | false |
| CFG-LV-12 | `reporting_only` (e.g. work accident: tracked, paid by insurer) | TENANT | bool | false |
| CFG-LV-13 | `schedule_adjustment` instead of a leave (e.g. breastfeeding hour) | CORE | bool | false |
| CFG-LV-14 | `active` | TENANT | bool | true |

### 4.2 Leave settings (tenant-wide)

| ID | Setting | Layer | Type | Product default | SMG value | Status | Trace |
|---|---|---|---|---|---|---|---|
| CFG-LV-20 | Leave year | TENANT | enum{calendar, hire_anniversary, custom start} | `calendar` | `calendar` | DECIDED | REQ-LV-RULE-03 |
| CFG-LV-21 | Rest days and public holidays inside a leave are not deducted | CORE | bool | true | true | DECIDED | REQ-LV-RULE-01 |
| CFG-LV-22 | Minimum continuous annual-leave block and check | TENANT | int (working days), enum{off, warn, block} | 0, `off` | 12, `warn` (HR) | DECIDED | REQ-LV-RULE-04 |
| CFG-LV-23 | Show accrual (earned, taken, remaining) in self-service | TENANT | bool | true | true | DECIDED | REQ-LV-RULE-02 |
| CFG-LV-24 | Reason required on request / on approval / on rejection; visible to employee | TENANT | bool × 3, bool | false / false / true, true | **request = true** (`DIFF-01`, confirm with Mr. Hassam Mahmood) / approval = true / rejection = true; visible = true | DECIDED (request PROPOSED) | REQ-LV-RULE-10 |
| CFG-LV-25 | Annual leave plan by HR per department; team calendar for managers | CORE feature flag | bool | false | true | DECIDED (product G1) | REQ-LV-RULE-12 |
| CFG-LV-26 | Leave pay includes average of variable elements; reference period; elements included | TENANT (pack floor) | bool, int months, list<ref pay element> | true, 12, variable earnings | true, `TODO(OPEN-15)`, variable earnings | DECIDED / `OPEN-15` | REQ-LV-RULE-13 |
| CFG-LV-27 | At exit: pay unused balance, deduct negative balance | TENANT | bool, bool | true, false | true, **true** | DECIDED | REQ-LV-RULE-06, -14 |
| CFG-LV-28 | Cancel an approved leave: who, balance restored | TENANT | list<role> | HR | HR | DECIDED | §6 flow |

### 4.3 SMG leave types (values)

Statutory floors come from the MA pack (`OPEN-26` validates them). SMG may only raise them.

| Code | Type | Entitlement | Unit | Paid | Attachment / blocks submit | Notice | Balance / negative | Status |
|---|---|---|---|---|---|---|---|---|
| LV01 | Annual paid leave | Accrual 1.5 d/month (2 if under 18), opens after 6 months | working day | full + CFG-LV-26 | — | 14 | yes / **yes** | DECIDED |
| LV02 | Seniority increase | +1.5 d per 5 full years, total cap 30/yr; pool = LV01 | working day | full | — | 14 | pool LV01 | DECIDED |
| LV03 | Own marriage | 4 per event | working day | full | Certificate / yes | 0 | no | DECIDED |
| LV04 | Marriage of a child | 2 | working day | full | Certificate / yes | 0 | no | DECIDED |
| LV05 | Death: spouse, child, grandchild, ascendant | 3 | working day | full | Certificate / yes | 0 | no | DECIDED |
| LV06 | Death: brother or sister | 2 | working day | full | Certificate / yes | 0 | no | DECIDED |
| LV07 | Circumcision of a child | 2 | working day | full | Certificate / yes | 0 | no | DECIDED |
| LV08 | Surgery of spouse or dependent child | 2 | working day | full | Certificate / yes | 0 | no | DECIDED |
| LV09 | Birth leave (father) | 3, within the month of birth | working day | full | Certificate / yes | 0 | no | DECIDED (values `OPEN-26`) |
| LV10 | Maternity | 14 weeks | calendar day | policy: `maternity_topup` `TODO(OPEN-01)` | Medical certificate / yes | 0 | no | DECIDED / `OPEN-01` |
| LV11 | Breastfeeding time | 1 h/day for 12 months | hour | full | — | 0 | `schedule_adjustment = true` | DECIDED |
| LV12 | Unpaid leave to raise a child | up to 1 year | calendar day | none | — | 0 | no | DECIDED |
| LV13 | Sick leave | per certificate | calendar day | policy: first days `TODO(NEW-01)` (SMG policy param) | Medical certificate / yes | 0 | no | DECIDED (policy value to collect) |
| LV14 | Work accident / occupational illness | per certificate | calendar day | insurer; `reporting_only = true` | Yes / yes | 0 | no | DECIDED |
| LV15 | Unpaid leave | by agreement | working day | none (deducted) | — | 0 | no | DECIDED |
| LV16 | Compensatory rest | credited from overtime/holiday work (CFG-TIME-24) | hour or day | full | — | 0 | own balance, no negative | DECIDED (product G5) |
| LV17+ | Other exceptional leave | `TODO(OPEN-06)` | — | — | — | — | — | OPEN |

## 5. Workflows and approvals (`WF`)

| ID | Setting | Layer | Type | Product default | SMG value | Status | Trace |
|---|---|---|---|---|---|---|---|
| CFG-WF-01 | Approval chains: ordered steps, each step = `manager_level(n)` \| `role(x)` \| `named_user`; rejection at any step ends | CORE (engine) / TENANT (chains) | list<chain> | `default` = [manager_level(1)] | `leave` = [manager_level(1), role(HR)] for every leave type. **Build check:** PR #24's second-approval setting must resolve to role HR | DECIDED | REQ-LV-RULE-09 (register says N+1 → N+2: update register) |
| CFG-WF-02 | Skip a step when approver = requester, or approver missing | TENANT | enum{skip, escalate_next_level, to_role} | `escalate_next_level` | `escalate_next_level` | PROPOSED | Product |
| CFG-WF-03 | Reminder / escalation after N days without decision | TENANT | duration, enum | `P2D`, remind | `P2D`, remind | PROPOSED | Product |
| CFG-WF-04 | Users outside payroll entities can be approvers | CORE | bool | true | true | DECIDED | REQ-LV-RULE-16 |
| CFG-WF-05 | Chains also used for: overtime approval, attendance corrections, payroll run approval | TENANT | ref per object | — | overtime = [manager_level(1)]; attendance correction = [manager_level(1)]; payroll run = see CFG-PAY-31 | PROPOSED | REQ-OT-01, REQ-ATT-07 |

## 6. Time, attendance and overtime (`TIME`)

| ID | Setting | Layer | Type | Product default | SMG value | Status | Trace |
|---|---|---|---|---|---|---|---|
| CFG-TIME-01 | Legal weekly hours, max hours per day | PACK | int, int | MA pack | 44 h/week, 10 h/day (pack). The daily-maximum warning seeded at 12 h in the build is aligned to the pack's 10 h | DECIDED | REQ-ATT-01 |
| CFG-TIME-02 | Work schedules (hours/week, working days, rest days, shift times, night work, rotating rest day) | TENANT | list<schedule> | — | Operations: 1 rotating rest day per shift plan; back office: Sat + Sun off, pattern `TODO(OPEN-03)` | DECIDED / `OPEN-03` | REQ-ATT-01, -02, REQ-LV-RULE-01 |
| CFG-TIME-03 | Temporary schedules with date range (e.g. Ramadan) | CORE | bool | true | true | PROPOSED | REQ-ATT-09 |
| CFG-TIME-04 | Minimum weekly rest (hours, consecutive) | PACK | int | MA pack | 24 (pack) | PROPOSED | REQ-ATT-02 |
| CFG-TIME-05 | Attendance sources enabled, priority | TENANT | list<enum{device_api, file_upload, manual}> | `manual` | `device_api` (when `OPEN-05` closes), `file_upload`, `manual` | DECIDED | REQ-ATT-03, -04 |
| CFG-TIME-06 | Device adapter and connection (adapter from the product library) | CORE (adapter) / TENANT (connection) | ref<adapter>, secret | — | `zkteco` adapter, SMG endpoint `TODO(OPEN-05)`, daily | DECIDED route / `OPEN-05` | REQ-ATT-03, G8 |
| CFG-TIME-07 | File import layout (column mapping, date format) | TENANT | mapping | — | SMG device export sample `TODO(OPEN-05)` | DECIDED / OPEN | REQ-ATT-04 |
| CFG-TIME-08 | Unknown device IDs go to an exception queue | CORE | always on | — | — | DECIDED | REQ-ATT-06 |
| CFG-TIME-09 | Employees exempt from punching (days entered by HR) | TENANT | flag per employee | false | Flag set per employee at import; list from HR-02 action 7 | DECIDED | REQ-ATT-05 |
| CFG-TIME-10 | Anomaly rules on: missing punch, odd punches, absence without leave; recipients; correction needs reason | TENANT | list<rule> | all on, HR + manager, reason required | all on, HR + manager, reason required; weekly summary to HR manager | PROPOSED | REQ-ATT-07 |
| CFG-TIME-11 | Lateness tolerance, deduction beyond tolerance | TENANT | duration, bool | `PT0M`, false | `PT10M`, no deduction within | PROPOSED | REQ-ATT-08 |
| CFG-TIME-12 | Night window | PACK default / TENANT | time, time | MA pack | 21:00–06:00 | PROPOSED | REQ-ATT-10 |
| CFG-TIME-13 | Attendance period close and lock | CORE | always on; late changes → next period | — | — | DECIDED | REQ-ATT-11 |
| CFG-TIME-20 | Overtime trigger | TENANT | enum{weekly_legal, contractual_schedule, both} | `both` | `both` | DECIDED | REQ-OT-01 |
| CFG-TIME-21 | Overtime needs approval before cut-off; unapproved not paid | TENANT | bool | true | true | PROPOSED (`OPEN-04`) | REQ-OT-01 |
| CFG-TIME-22 | Overtime premium bands: day type × time band → rate | PACK floor / TENANT | list<band> | MA pack minimums | Normal day: +25 % 06:00–21:00, +50 % 21:00–06:00; rest day: +50 % / +100 % | PROPOSED (`OPEN-04`, `OPEN-26`) | REQ-OT-02 |
| CFG-TIME-23 | Annual overtime quota, enforcement | TENANT (pack cap) | int, enum{warn, block} | none | 100 h, `warn` | PROPOSED (`OPEN-04`) | REQ-OT-04 |
| CFG-TIME-24 | Work on public holiday / rest day compensated by | TENANT | enum{pay, rest, employee_choice} + rest balance (ref leave type) | `pay` | `pay`; rest → LV16 if chosen `TODO(OPEN-04)` | OPEN | REQ-OT-05 |
| CFG-TIME-25 | Recovery conversion ratio (minutes of rest credited per minute worked on a holiday or rest day) | TENANT | decimal, 0–3 | 1.0 | 1.0 (1:1: the premium is paid as money, the time is given back as time) | PROPOSED (HR-02 open point 18) | REQ-OT-05, LV16 |
| CFG-TIME-26 | Undo a recovery conversion after part of the credit is taken | TENANT | enum{block, hr_override, allow} | `hr_override` (blocked by default; HR can override with a reason) | `hr_override`; a resulting negative recovery balance is shown on the employee and settled at the next conversion or at exit | PROPOSED (HR-02 open point 19) | REQ-OT-05, LV16 |
| CFG-TIME-27 | Which worked hours count as already settled when a partly used conversion is undone | TENANT | enum{proportional, highest_rate_first, lowest_rate_first} | `proportional` | `proportional` (neither side gains) | PROPOSED (HR-02 open point 20) | REQ-OT-05, LV16 |

## 7. Public holidays (`HOL`)

| ID | Setting | Layer | Type | Product default | SMG value | Status | Trace |
|---|---|---|---|---|---|---|---|
| CFG-HOL-01 | Holiday calendar per year (date, name, type, `confirmed`) | PACK default / TENANT | list | MA pack calendar; religious dates `confirmed = false` | Pack calendar | DECIDED | REQ-LV-RULE-15 |
| CFG-HOL-02 | Recompute approved leave when a religious date is confirmed or moves | CORE | always on; notify HR | — | — | DECIDED (product G2) | REQ-LV-RULE-15 |
| CFG-HOL-03 | Tenant extra holidays (company days) | TENANT | list | none | none | — | Product |

## 8. Payroll (`PAY`)

### 8.1 Calendar and run

| ID | Setting | Layer | Type | Product default | SMG value | Status | Trace |
|---|---|---|---|---|---|---|---|
| CFG-PAY-01 | Pay frequency | TENANT | enum{monthly} | `monthly` | `monthly` | DECIDED | REQ-PAY-01 |
| CFG-PAY-02 | Variable-data cut-off day | TENANT | int 1–31 | last day | 25 | DECIDED | REQ-PAY-01 |
| CFG-PAY-03 | Attendance/variable period boundaries | TENANT | enum{calendar_month, cutoff_plus_1_to_cutoff} | `calendar_month` | `cutoff_plus_1_to_cutoff` (26th–25th) `TODO(OPEN-16)`. **Build note:** the period boundaries must be a setting before the attendance close and payroll variables (HR-02 step 10) are built; today the build uses calendar months | PROPOSED / `OPEN-16` | REQ-PAY-01 |
| CFG-PAY-04 | Pay date rule | TENANT | enum{last_working_day, fixed_day(n), …} | `last_working_day` | `last_working_day` `TODO(OPEN-16)` | PROPOSED | REQ-PAY-01 |
| CFG-PAY-05 | Proration method for entries, exits, unpaid days | PACK default / TENANT | enum{calendar_days, working_days, 26_days, 191_hours} | MA pack default | `TODO(NEW-03)` (ConSAP HR + accountant) | OPEN | Spec §8.4 step 2 |
| CFG-PAY-06 | Hourly divisor (monthly salary → hourly rate) | PACK default / TENANT | decimal | MA pack: 191 | 191 | PROPOSED | REQ-OT-03 |
| CFG-PAY-07 | Rounding rule (net pay, per line) | TENANT | enum{none, 0.01, 1.00, …}, method | 0.01 half-up | 0.01 half-up, to confirm (NEW-04) | PROPOSED | Spec §8.4 step 11 |
| CFG-PAY-08 | Run types enabled | CORE | list<enum{regular, off_cycle_exit, off_cycle_adjustment, off_cycle_bonus, retro}> | all | all | PROPOSED | REQ-PAY-03 |
| CFG-PAY-09 | Population rule: entity `payroll_enabled`, contract `in_payroll`, onboarding items with `blocks_payroll` complete | CORE | always on | — | — | DECIDED | REQ-PAY-04 |

### 8.2 Pay elements (each element is a record with these attributes)

| ID | Attribute | Layer | Type | Product default |
|---|---|---|---|---|
| CFG-PAY-10 | `code`, `name` (EN/FR/AR), `kind` ∈ {earning, deduction, employer_charge, information}, `fixed_or_variable` | PACK default / TENANT | — | — |
| CFG-PAY-11 | `calc_type` ∈ {fixed_amount, rate_x_quantity, percent_of, banded_percent, imported, leave_pay, balance_deduction, pack_rule, formula} + parameters | TENANT (pack for statutory elements) | rule | — |
| CFG-PAY-12 | `formula`: safe expression over element codes and employee attributes (no I/O, no loops, decimal arithmetic, tested on sample employees before activation). **Data model now; evaluator in release R2 (after go-live)** | CORE | formula | disabled until R2 |
| CFG-PAY-13 | Treatment: `subject_social` (pack: CNSS/AMO), `subject_tax` (pack: IR), `exemption_ref` (pack ceiling key) | TENANT, using pack keys | bool, bool, ref | — |
| CFG-PAY-14 | `applies_to`: all, categories, positions, departments, individual (recurring element) | TENANT | selector | individual |
| CFG-PAY-15 | `in_leave_pay_average` | TENANT | bool | true for variable earnings |
| CFG-PAY-16 | `posting`: G/L account, side, cost-centre required (ref CFG-POST-03) | TENANT | ref | — |
| CFG-PAY-17 | `payslip`: show, order, label, show base/rate | TENANT | — | show |
| CFG-PAY-18 | `source` for imported elements: file layout or connector (e.g. sales incentive file) | TENANT | ref | — |

### 8.3 SMG pay elements (values; final list `OPEN-17`)

| Code | Element | Kind | calc_type | Social / tax | Status |
|---|---|---|---|---|---|
| PE01 | Base salary | earning | fixed_amount (monthly) or rate_x_quantity (hourly); floor = pack SMIG | Y / Y | DECIDED |
| PE02 | Seniority bonus | earning | banded_percent of PE01 by service years (pack bands: 5 % ≥ 2, 10 % ≥ 5, 15 % ≥ 12, 20 % ≥ 20, 25 % ≥ 25); from `seniority_start` else `hire_date` | Y / Y | DECIDED (pack value, validate) |
| PE03 | Overtime | earning | rate_x_quantity: hours × hourly rate × (1 + band premium) | Y / Y | PROPOSED |
| PE04 | Transport allowance | earning | fixed_amount; exemption ref `ma.ir.exempt.transport` | per pack | PROPOSED |
| PE05 | Meal / basket allowance | earning | fixed_amount; exemption ref `ma.ir.exempt.meal` | per pack | PROPOSED |
| PE06 | Cashier allowance | earning | fixed_amount, applies_to = individual | Y / Y | PROPOSED (only if paid today) |
| PE07 | Sales incentive | earning | imported (file; POS feed is a change request); rule `TODO(OPEN-18)` | Y / Y | OPEN |
| PE08 | Bonuses (13th month, Eid, performance) | earning | fixed_amount or percent_of PE01; regular or off-cycle | Y / Y | PROPOSED |
| PE09 | Advances and loans | deduction (net) | fixed_amount until outstanding = 0 | — | DECIDED |
| PE10 | Exit pay (notice, legal severance, unused leave) | earning | pack rules (severance scale) + CFG-LV-27 | per pack | PROPOSED |
| PE11 | Leave pay | earning | CFG-LV-26 | Y / Y | DECIDED |
| PE12 | Unpaid absence | deduction (gross) | rate_x_quantity with CFG-PAY-05 | reduces base | DECIDED |

### 8.4 Payroll approval

| ID | Setting | Layer | Type | Product default | SMG value | Status | Trace |
|---|---|---|---|---|---|---|---|
| CFG-PAY-30 | Run state machine `Draft → Simulated → Checked → Approved → Posted → Closed`; approved runs immutable | CORE | always on | — | — | PROPOSED | REQ-PAY-02 |
| CFG-PAY-31 | Who checks, who approves (role or named user); four-eyes (checker ≠ approver) | TENANT | ref, ref, bool | role HR officer, role HR manager, true | Checker: HR/payroll officer; approver: Mr. Hassam Mahmood (HR manager) | DECIDED | REQ-SEC-02 |

## 9. Statutory values (`STAT`, Morocco pack)

All `PACK`, effective-dated, `status = unverified` until signed off by SMG's accountant (P10) and ConSAP's payroll expert. **No value below is to be typed from memory**: seed from the official source and record it.

| Key | Meaning | Unit | Value in skeleton | Source to record | Trace |
|---|---|---|---|---|---|
| `ma.cnss.ee_rate`, `ma.cnss.er_rate` | CNSS social benefits, employee / employer | percent | `null` | CNSS official rates | CT01 |
| `ma.cnss.ceiling_monthly` | CNSS monthly ceiling | MAD | 6000.00 (`unverified`, from spec) | CNSS | CT01, T-PAY-01 |
| `ma.af.er_rate` | Family allowances, employer | percent | `null` | CNSS | CT02 |
| `ma.amo.ee_rate`, `ma.amo.er_rate` | AMO | percent | `null` | CNSS / ANAM | CT03 |
| `ma.tfp.er_rate` | Vocational training tax | percent | `null` | CNSS | CT04 |
| `ma.ir.brackets[]` | IR scale (from, to, rate, deduction) | MAD/year | `null` | Finance law 2027 (check January 2027) | CT07 |
| `ma.ir.prof_expenses_bands[]` | Professional expenses (rate, cap by band) | — | `null` | Finance law | CT08 |
| `ma.ir.family_deduction`, `ma.ir.family_max` | Family deduction per dependent, max dependents | MAD, int | `null`, 6 (`unverified`, from spec) | Finance law | CT09 |
| `ma.ir.exempt.transport`, `ma.ir.exempt.meal` | Exemption ceilings | MAD | `null` | CGI art. 57 / tax notes | PE04, PE05 |
| `ma.smig.hourly`, `ma.smig.monthly` | Minimum wage | MAD | `null` | Decree | PE01 |
| `ma.anapec.*` | ANAPEC exemptions | — | `null` | Law / ANAPEC | CT10 |
| `ma.seniority.bands[]` | Seniority bonus bands | percent | from spec, `unverified` | Labour Code art. 350 | PE02 |
| `ma.overtime.min_premiums[]` | Minimum overtime premiums | percent | from spec, `unverified` | Labour Code art. 201 | REQ-OT-02 |
| `ma.time.weekly_hours`, `ma.time.max_daily_hours` | Legal working time | h | 44, 10 (`unverified`, from spec) | Labour Code | REQ-ATT-01 |
| `ma.time.min_weekly_rest_hours` | Minimum weekly rest | h | 24 (`unverified`, from spec) | Labour Code | REQ-ATT-02 |
| `ma.time.hourly_divisor_default` | Default hourly divisor (tenant may override, CFG-PAY-06) | h/month | 191 (`unverified`, from spec) | Practice / Labour Code | REQ-OT-03 |
| `ma.overtime.night_window` | Night window | time range | 21:00–06:00 (`unverified`, from spec) | Labour Code | REQ-ATT-10 |
| `ma.leave.annual_per_month_under18` | Annual leave accrual, under 18 | days/month | 2 (`unverified`, from spec) | Labour Code art. 231 | LV01 |
| `ma.leave.*` | Statutory leave floors (LV01–LV14) | days | from spec, `unverified` | Labour Code arts. 231, 232, 269, 274, 152 … | §4.3 |
| `ma.cdd.max_duration`, `ma.cdd.max_renewals` | Fixed-term limits | — | P1Y, 1 (`unverified`, from spec) | Labour Code art. 16–17 | CFG-CON-05 |

Optional schemes (CIMR, mutuelle): code path in the pack, switched by tenant settings below; rates are company values, not statutory.

| ID | Setting | Layer | Type | Default | SMG value | Status | Trace |
|---|---|---|---|---|---|---|---|
| CFG-STAT-01 | CIMR affiliated; employer no; rates (tenant + per employee) | TENANT | bool, …, percent | false | false | DECIDED | CT05, DIFF-02 |
| CFG-STAT-02 | Mutuelle / health insurer deduction | TENANT | bool, rates | false | false `TODO(OPEN-19)` | DECIDED / OPEN | CT06 |
| CFG-STAT-03 | Voluntary pension deduction allowed | TENANT | bool | false | false | PROPOSED | §8.4 step 7 |

## 10. Outputs (`OUT`)

| ID | Setting | Layer | Type | Product default | SMG value | Status | Trace |
|---|---|---|---|---|---|---|---|
| CFG-OUT-01 | Payslip layout (pack mandatory mentions + tenant logo, element order, languages) | PACK + TENANT | template | MA pack layout (Labour Code art. 370) | Pack layout, SMG logo, EN/FR | PROPOSED | REQ-PAY-05 |
| CFG-OUT-02 | Payslip delivery channels | TENANT | list<enum{email_pdf, self_service, print}> | `self_service` | `email_pdf`, `self_service`; no-email employees `TODO(OPEN-13)` (G7) | PROPOSED / OPEN | REQ-PAY-05 |
| CFG-OUT-03 | Payslip PDF password-protected; password rule | TENANT | bool, enum{employee_set_password, self_service_only, id_last_digits_plus_birth_date} | true, `employee_set_password` (the employee sets the PDF password in self-service at first sign-in; HR can reset it). `id_last_digits_plus_birth_date` stays available but is **not recommended**: colleagues and anyone holding the CIN can guess it | true, `employee_set_password` `TODO(NEW-07)` | PROPOSED | Law 09-08 |
| CFG-OUT-04 | Statutory declarations enabled | PACK | list | MA: `cnss_damancom_monthly`, `ir_monthly`, `ir_annual` | all three | DECIDED (annual PROPOSED) | REQ-OUT-01..03 |
| CFG-OUT-05 | Declaration filer and deadline reminders | TENANT | enum{in_house, provider}, duration | `in_house`, `P5D` before deadline | `in_house` | DECIDED | REQ-OUT-01, -02 |
| CFG-OUT-06 | Bank transfer file: format (from the product library of bank writers), debit account, execution date rule | CORE (writer) / TENANT (choice) | ref<bank_format> | none | `attijariwafa_*` `TODO(OPEN-20)` | DECIDED (fit) / OPEN (format) — **scope to align: MVP doc v0.2 puts the bank file in change requests** | REQ-OUT-04, G9 |
| CFG-OUT-07 | Standard reports enabled | CORE | list | all | payroll journal, headcount, leave balances | PROPOSED | REQ-OUT-05 |

## 11. Accounting posting (`POST`)

| ID | Setting | Layer | Type | Product default | SMG value | Status | Trace |
|---|---|---|---|---|---|---|---|
| CFG-POST-01 | ERP connector (from the product library) | CORE (adapter) / TENANT (choice) | enum{none, s4hana_cloud_soap, sap_b1_service_layer, file_export} | `file_export` | `s4hana_cloud_soap` (Journal Entry – Post, SAP_COM_0002; verify on SAP Business Accelerator Hub) | PROPOSED | REQ-POST-01, K4 |
| CFG-POST-02 | Connection: host, communication user, certificate, company code | TENANT (secrets) | secret | — | `TODO(NEW-06)` (set up in SMG tenant by ConSAP) | DECIDED | REQ-POST-07 |
| CFG-POST-03 | Mapping `pay_element × (cost centre \| none) → G/L account, side` | TENANT | table | — | Draft D05 accounts (6171, 6174, 4432, 4441, 4443, 4445, 4452) **not agreed** `TODO(OPEN-21)` | OPEN | REQ-POST-04, -05 |
| CFG-POST-04 | Posting granularity | TENANT | enum{one_per_run_by_cost_centre, one_per_run_total, one_per_employee} | `one_per_run_by_cost_centre` | `one_per_run_by_cost_centre` | PROPOSED (Digital Access: never per employee) | REQ-POST-01, -06 |
| CFG-POST-05 | Document type, reference pattern, header text pattern, posting date rule | TENANT | string patterns | `PAY-{yyyy}-{mm}-{runType}` | `documentType` `TODO(OPEN-21)`; reference `PAY-{yyyy}-{mm}-{runType}` | OPEN | §9 payload |
| CFG-POST-06 | Pre-check (debit = credit, valid accounts and cost centres) blocks posting | CORE | always on | — | — | PROPOSED | REQ-POST-02 |
| CFG-POST-07 | Idempotency: one posting per run; re-post only after reversal recorded | CORE | always on | — | — | PROPOSED | REQ-POST-03 |
| CFG-POST-08 | Posting trigger | TENANT | enum{on_approval, manual} | `manual` | `on_approval` | PROPOSED | REQ-POST-01 |

## 12. Security and access (`SEC`)

| ID | Setting | Layer | Type | Product default | SMG value | Status | Trace |
|---|---|---|---|---|---|---|---|
| CFG-SEC-01 | Roles (product roles; tenant may add custom roles from permission sets) | CORE / TENANT | list<role> | Administrator, HR manager, HR/payroll officer, Manager, Employee | product roles | DECIDED | REQ-SEC-01 |
| CFG-SEC-02 | Role scope: all, departments, locations, own team, self | TENANT | selector per user | role default | per H18 | PROPOSED (`OPEN-07`) | REQ-SEC-03 |
| CFG-SEC-03 | Sensitive field groups (salary, national ID, social security no, bank account) and who sees them | CORE groups / TENANT grants | permission | HR manager, payroll officer | HR manager; others `TODO(OPEN-07)` | PROPOSED | REQ-SEC-03, -06 |
| CFG-SEC-04 | Employee sees own base salary in self-service | TENANT | bool | false | false `TODO(OPEN-02)` | OPEN | REQ-SEC-04 |
| CFG-SEC-05 | MFA required for roles | TENANT (product floor: admin, payroll) | list<role> | Administrator, HR manager, HR/payroll officer | product default | PROPOSED | REQ-SEC-05 |
| CFG-SEC-06 | Sign-in methods | TENANT | list<enum{email_password, sso_microsoft, sso_google, employee_code_pin}> | `email_password` | `email_password`; no-email employees `TODO(OPEN-13)` | PROPOSED / OPEN | REQ-SEC-05, G7 |
| CFG-SEC-07 | Password policy, lockout, session timeout | TENANT (product floor) | policy | product floor | product floor | PROPOSED | HR-08 |
| CFG-SEC-08 | Encryption at rest, masking, no sensitive data in logs | CORE | always on | — | — | DECIDED | REQ-SEC-06 |

## 13. Notifications (`NOT`)

| ID | Setting | Layer | Type | Product default | SMG value | Status |
|---|---|---|---|---|---|---|
| CFG-NOT-01 | Event → channel (email, in-app) → recipients, per event type (leave step, expiry, contract end, anomaly, payroll ready) | TENANT | table | in-app + email to the actor | product default; weekly attendance summary to HR manager | PROPOSED |
| CFG-NOT-02 | Notification templates (language, text) | TENANT | template | product templates EN/FR | product | PROPOSED |
| CFG-NOT-03 | Sender address / SMTP | TENANT | config | product sender | `TODO(NEW-05)` | OPEN |

## 14. Data import and migration (`MIG`)

| ID | Setting | Layer | Type | Product default | SMG value | Status | Trace |
|---|---|---|---|---|---|---|---|
| CFG-MIG-01 | Import templates H01–H18 (product templates; pack adds country columns) | CORE + PACK | template | v0.1 layout | v0.1 layout | DECIDED | REQ-MIG-01 |
| CFG-MIG-02 | Header row, example row ignored, first data row | CORE | int | example row 2, data from row 3 | same | DECIDED | REQ-MIG-01 |
| CFG-MIG-03 | Date format | TENANT | enum | `DD/MM/YYYY` | `DD/MM/YYYY` | DECIDED | REQ-MIG-03 |
| CFG-MIG-04 | Dry run mandatory before commit; all-or-nothing per sheet | CORE | always on | — | — | PROPOSED | REQ-MIG-03 |
| CFG-MIG-05 | History depth | TENANT | enum{ytd_only, ytd_plus_previous_year} | `ytd_only` | `TODO(OPEN-23)` | OPEN | REQ-MIG-05 |

## 15. Parallel run (`PR`)

| ID | Setting | Layer | Type | Product default | SMG value | Status | Trace |
|---|---|---|---|---|---|---|---|
| CFG-PR-01 | Legacy result import layout (H16 columns, mapping to CPeople elements) | CORE (H16) / TENANT (mapping) | mapping | H16 | H16; provider `TODO(OPEN-24)` | DECIDED | REQ-PR-02 |
| CFG-PR-02 | Compared measures | CORE | list | H16 columns | H16 columns + totals per element and cost centre | DECIDED | REQ-PR-03 |
| CFG-PR-03 | Tolerance per line | TENANT | decimal | 0.01 | 0.01 | PROPOSED | REQ-PR-04 |
| CFG-PR-04 | Difference cause codes | TENANT | list | input data, rule/config, provider error, rounding, timing | product default | PROPOSED | REQ-PR-04 |
| CFG-PR-05 | Periods to compare; validator | TENANT | list<period>, ref user | — | 2026-12 and 2027-01; validator `TODO(OPEN-25)` | DECIDED / OPEN | REQ-PR-01, -05 |

## 16. Feature flags (`FEAT`)

| ID | Flag | Default | SMG | Note |
|---|---|---|---|---|
| CFG-FEAT-01 | `leave.annual_plan_and_team_calendar` | off | on | G1 |
| CFG-FEAT-02 | `leave.negative_balance` (per type via CFG-LV-09) | off | on | G4 |
| CFG-FEAT-03 | `leave.carry_over_expiry` | off | on | G6 |
| CFG-FEAT-04 | `time.device_api` | off | on when `OPEN-05` closes | G8 |
| CFG-FEAT-05 | `payroll.formula_elements` | off | off until R2 | CFG-PAY-12 |
| CFG-FEAT-06 | `out.bank_file` | off | `TODO(OPEN-20)` (scope) | G9 |
| CFG-FEAT-07 | `post.erp` | off | on | REQ-POST-01 |
| CFG-FEAT-08 | `self_service.no_email_sign_in` | off | `TODO(OPEN-13)` | G7 |

---

## 17. Onboarding a new client (the target process)

1. Create the tenant; choose the country pack (CFG-ORG-01).
2. Apply a **tenant template**: a full tenant config file exported from a reference tenant with personal and company identifiers removed (first template: `ma-hospitality`, from SMG).
3. Adjust settings in the admin UI with the client's HR (workshop checklist = this catalogue).
4. Import H01–H18 (dry run, then commit).
5. Parallel run against the legacy payroll (CFG-PR-*).
6. Go-live.

No developer is involved unless the client needs a new country pack, a new connector (device, bank, ERP) or a new generic feature. Each of those is built once for the product and added to this catalogue.

## 18. Open points added by this catalogue

`OPEN-xx` points come from the SMG build spec v0.1 §15. These `NEW-xx` points were found while building the catalogue. Both kinds are written `{ "todo": "…" }` in a tenant config and listed by `npm run validate:tenant`.

| # | Item | Owner (proposed) | Setting |
|---|---|---|---|
| NEW-01 | Sick leave: salary for the first days (SMG policy) | Mr. Hassam Mahmood | LV13 policy |
| NEW-02 | Trial period length per employee category | Mr. Hassam Mahmood | CFG-CON-02 |
| NEW-03 | Proration method for entries, exits and unpaid days | ConSAP HR with SMG's accountant (P10) | CFG-PAY-05 |
| NEW-04 | Rounding rule for net pay (proposal 0.01 half-up) | ConSAP HR with SMG's accountant | CFG-PAY-07 |
| NEW-05 | Sender address and SMTP provider for payslip e-mails | ConSAP (product) | CFG-NOT-03 |
| NEW-06 | S/4HANA communication arrangement (SAP_COM_0002) in SMG's tenant | ConSAP, after systems on 1 Dec 2026 | CFG-POST-02 |
| NEW-07 | Payslip PDF password rule: employee-set password (proposed) instead of ID digits + birth date | Youssef El Mokaddem, then Mr. Hassam Mahmood | CFG-OUT-03 |

## 19. Changes this catalogue makes to the SMG build spec v0.1

| # | Spec v0.1 | Catalogue | Why |
|---|---|---|---|
| C1 | Employee number = biometric ID (REQ-EMP-01) | Own employee number + external IDs; SMG sets device ID = employee number (CFG-EMP-01, -03) | Not tied to one device vendor |
| C2 | `paid_by_morocco` Y/N (REQ-EMP-04) | Legal entities with `payroll_enabled` (CFG-ORG-02, -03) | Works for the UAE pack later |
| C3 | One `legislation_param` table (§4.1) | Statutory values in the pack; company values in tenant tables (§9) | Decision of 27 Nov 2026 in CLAUDE.md |
| C4 | One cost centre per department (REQ-ORG-03) | Assignment mode setting, SMG = `department` (CFG-ORG-06) | Other clients split or override |
| C5 | Section 13 gaps as possible change requests | Built as generic product features with flags (§16) | Fixed-scope rule of 17 Nov 2026; reusable |
| C6 | Leave approval N+1 → HR | Approval chain setting (CFG-WF-01) | Register says N+1 → N+2: update the register |
| C7 | Calculation rules as code | `calc_type` set + formula type in R2 (CFG-PAY-11, -12) | New elements without code |
| C8 | — | Percent is a fraction in the schema; storage may be a percentage; screens always show % (§0.3) | Matches the built `overtime_rule` and `tenant_contribution_rate` columns and their database guards |
| C9 | — | Statutory floors move from tenant tables to the pack; tenant keeps values above the floor (§0.2) | Applies decision C3 to the rules already seeded |
| C10 | — | Payslip password default `employee_set_password` (CFG-OUT-03, NEW-07) | ID digits + birth date is guessable; Law 09-08 |
