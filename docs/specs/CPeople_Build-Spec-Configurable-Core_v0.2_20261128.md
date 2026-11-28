# CPeople – Build specification v0.2: configurable core, Morocco pack, SMG tenant

| Item | Value |
|---|---|
| File | `docs/specs/CPeople_Build-Spec-Configurable-Core_v0.2_20261128.md` |
| Replaces | SMG HR build spec HR-01–03 **v0.1** §0, §3, §4, §12, §13 (v0.1 stays the source of the requirement texts `REQ-…`, the leave table and the acceptance tests T-…) |
| Companion | `docs/config/CPeople_Configuration-Catalogue_v0.1_20261128.md` (settings `CFG-…`) and `packages/config` (schema code) |
| Version / date | v0.2 · 28 Nov 2026 |
| Author | ConSAP · CPeople product |
| Status | Draft. Product approach to be confirmed by Youssef El Mokaddem (OPEN-27) |
| Classification | Internal ConSAP |

| Version | Date | Change |
|---|---|---|
| 0.1 | 28 Nov 2026 | SMG build spec from workshops HR-01–03 |
| 0.2 | 28 Nov 2026 | Product name CPeople. Three layers (core / Morocco pack / tenant). Every requirement mapped to the setting that configures it. Spec changes C1–C7. Gaps G1–G9 built as product features. Starter config package |

---

## 0. Instructions for Claude Code

1. **Goal:** a new client in a country that has a pack is onboarded by configuration only. SMG is the first tenant configured on CPeople, not the client CPeople is coded for.
2. **Read in this order:** this file → configuration catalogue → `packages/config/src/*.ts` → SMG spec v0.1 for the requirement wording.
3. **The three layers** (catalogue §0.1):
   - `CORE` — features and their settings. Code lives in `apps/api/src/modules/*` and `packages/*`.
   - `PACK` — country law, `packages/country-packs/<cc>/pack.json` + pack code (declarations, payslip layout, validators). Values effective-dated, with `source` and `status`.
   - `TENANT` — company choices, effective-dated rows in the database, round-tripped as `tenants/<code>.config.json` and validated by `packages/config`.
4. **Hard rules**
   - No tenant code, name or ID in any `if`, `switch`, file name or migration. CI fails on the regex `(?i)\b(smg|samira|maatouk)\b` in `apps/` and `packages/` (except `packages/config/examples/` and tests).
   - No statutory number in code. The engine reads `PACK` keys; production calculation refuses if any key it touches is `unverified` (already enforced by `assertPackUsable` in `packages/config`).
   - Every behaviour difference between tenants comes from a `CFG-…` setting. Need a new one? Add it to the catalogue and the schema in the **same PR** as the feature.
   - Statuses from v0.1 still apply: `DECIDED` build; `PROPOSED` build with the setting, default as catalogue; `OPEN` build the setting, leave `TODO(OPEN-xx)`, do not guess values.
   - Test data anonymised (v0.1 §0.4). MAD amounts: decimal type, 2 decimals, never float.
5. **Contract guardrails** (v0.1 §1.1) still apply on the SAP side: released standard journal-entry API only, no custom code in S/4HANA, no middleware hosted by ConSAP.

---

## 1. Repository layout (target)

```
apps/
  api/                       NestJS modular monolith
    src/modules/
      organisation/  employees/  contracts/  leave/  workflow/
      time/  payroll/  payslips/  declarations/  posting/
      migration/  parallel-run/  admin/ (users, roles, audit, settings)
  web/                       Next.js admin + self-service
packages/
  config/                    ← delivered now: setting schemas (Zod), loader, validation, examples
  country-packs/
    ma/                      ← delivered now: pack.json skeleton (all values unverified)
  engine/                    payroll calculation (pure functions over config + inputs)
  adapters/
    devices/zkteco/          attendance device adapter (G8)
    banks/                   bank-file writers (G9)
    erp/s4hana-cloud-soap/   journal entry posting
docs/
  config/   specs/   design/
tenants/                     tenant config files (no personal data; not deployed with secrets)
```

---

## 2. How configuration works at run time

```
 pack.json (versioned, released)        tenant settings (DB, effective-dated, audited)
          │                                         │
          └────────────► resolveConfig(tenant, date) ◄┘
                                 │  merged, validated (packages/config)
                                 ▼
     modules read ResolvedConfig only — never the DB tables or pack file directly
```

- `resolveConfig(tenantId, asOf)` returns one immutable, typed object for the date. Payroll runs **store the hash of the resolved config** they used, so a rerun is reproducible and the parallel-run report can explain differences.
- Pack floors: when a tenant value is below a pack floor (e.g. leave days), validation fails with the setting ID and the floor.
- Admin UI: one generic settings screen per catalogue area, generated from the Zod schema metadata (label, help, type), plus dedicated editors for lists (leave types, pay elements, chains, mapping). Every save = new effective-dated version + audit entry.
- Export / import: `GET/PUT /admin/config` with the tenant config file; used for tenant templates (catalogue §17). Secrets never exported.

---

## 3. Requirement → layer → setting

Requirement texts: SMG spec v0.1. "Feature" = what the core must do generically.

### 3.1 Organisation, employee, contracts, security (M1–M4)

| REQ | Layer | Feature (generic) | Settings |
|---|---|---|---|
| REQ-ORG-01 | TENANT | Legal entities | CFG-ORG-02 |
| REQ-ORG-02 | TENANT | Locations with device flag | CFG-ORG-04 |
| REQ-ORG-03 | CORE + TENANT | Cost-centre assignment modes; reject department without cost centre when posting is on | CFG-ORG-06, -07 |
| REQ-ORG-04 | CORE | Org chart, headcount | CFG-ORG-05 |
| REQ-EMP-01 | CORE + TENANT | Employee number scheme + external IDs (**change C1**) | CFG-EMP-01..03 |
| REQ-EMP-02 | CORE + TENANT | Mandatory fields, onboarding checklist that can block payroll | CFG-EMP-04, -09 |
| REQ-EMP-03 | CORE + TENANT | Document types with expiry and alert job | CFG-EMP-07, -08 |
| REQ-EMP-04 | CORE + TENANT | Entities with `payroll_enabled`; users of non-payroll entities can approve (**change C2**) | CFG-ORG-03, CFG-WF-04 |
| REQ-CON-01..04 | PACK + TENANT | Contract types with `in_payroll`, trial period inside contract, templates, alerts, CDD limits | CFG-CON-01..05 |
| REQ-SEC-01..06 | CORE + TENANT | Roles, scopes, sensitive field groups, MFA, sign-in methods, encryption | CFG-SEC-01..08 |

### 3.2 Leave (M5)

| REQ | Layer | Feature | Settings |
|---|---|---|---|
| LV01–LV17 | PACK floors + TENANT | Leave type records (catalogue §4.1); pack seeds the Moroccan types | CFG-LV-01..14, §4.3 |
| REQ-LV-RULE-01 | CORE | Day counting from schedule + holiday calendar | CFG-LV-03, -21, CFG-TIME-02, CFG-HOL-01 |
| REQ-LV-RULE-02, -03 | CORE + TENANT | Accrual engine, leave year | CFG-LV-10, -20, -23 |
| REQ-LV-RULE-04 | TENANT | Min continuous block check | CFG-LV-22 |
| REQ-LV-RULE-05 | CORE (G6) | Carry-over expiry job + warning | CFG-LV-11, CFG-FEAT-03 |
| REQ-LV-RULE-06, -14 | CORE (G4) | Negative balance, exit settlement | CFG-LV-09, -27, CFG-FEAT-02 |
| REQ-LV-RULE-07, -08, -11 | TENANT | Half days, notice, attachments | CFG-LV-05..07 |
| REQ-LV-RULE-09, -16, -17 | CORE | Generic approval engine with audit | CFG-WF-01..05 |
| REQ-LV-RULE-10 | CORE (G3) | Reason rules on request / approval / rejection | CFG-LV-24 |
| REQ-LV-RULE-12 | CORE (G1) | Leave plan + team calendar | CFG-LV-25, CFG-FEAT-01 |
| REQ-LV-RULE-13 | CORE + TENANT | Leave pay average of variable elements | CFG-LV-26, CFG-PAY-15 |
| REQ-LV-RULE-15 | CORE (G2) | Unconfirmed holidays, recompute | CFG-HOL-01, -02 |
| REQ-LV-RULE-18 | CORE | Leave → payroll period by cut-off | CFG-PAY-02, -03 |
| LV16 | CORE (G5) | Compensatory rest balance | CFG-LV-09, CFG-TIME-24 |

### 3.3 Attendance and overtime (M6)

| REQ | Layer | Feature | Settings |
|---|---|---|---|
| REQ-ATT-01, -02, -09 | PACK + TENANT | Schedules, temporary schedules, legal limits | CFG-TIME-01..04 |
| REQ-ATT-03 | CORE (G8) | Device adapter interface; `zkteco` first adapter | CFG-TIME-05, -06, CFG-FEAT-04 |
| REQ-ATT-04 | CORE | File upload with column mapping; manual entry; one `attendance_day` model with `source` | CFG-TIME-05, -07 |
| REQ-ATT-05, -06 | CORE + TENANT | Exempt employees; exception queue | CFG-TIME-08, -09 |
| REQ-ATT-07, -08, -10 | TENANT | Anomaly rules, tolerance, night window | CFG-TIME-10..12 |
| REQ-ATT-11 | CORE | Period close and lock | CFG-TIME-13 |
| REQ-OT-01..05 | PACK floors + TENANT | Overtime trigger, approval, premium bands, quota, holiday compensation | CFG-TIME-20..24 |

### 3.4 Payroll, outputs, posting (M7–M10)

| REQ | Layer | Feature | Settings |
|---|---|---|---|
| REQ-PAY-01 | TENANT | Payroll calendar | CFG-PAY-01..04 |
| REQ-PAY-02 | CORE + TENANT | Run state machine, four-eyes | CFG-PAY-30, -31 |
| REQ-PAY-03 | CORE | Run types | CFG-PAY-08 |
| REQ-PAY-04 | CORE | Population rule from entity / contract / checklist | CFG-PAY-09 |
| §8.2 PE01–PE12 | CORE + TENANT | Pay element records with `calc_type` (**change C7**) | CFG-PAY-10..18, §8.3 |
| §8.3 CT01–CT10 | PACK (+ TENANT for CIMR/mutuelle) | Statutory keys (**change C3**) | catalogue §9, CFG-STAT-01..03 |
| §8.4 calc order | CORE (engine) + PACK | Engine pipeline; country-specific steps provided by the pack (`ma` implements steps 4–8) | CFG-PAY-05..07 |
| REQ-PAY-05, REQ-OUT-01..05 | PACK + TENANT | Payslip layout, delivery, declarations, bank writers (G9) | CFG-OUT-01..07 |
| REQ-POST-01..07 | CORE + TENANT | ERP adapter interface; `s4hana-cloud-soap` first adapter; mapping, granularity, pre-check, idempotency | CFG-POST-01..08 |

### 3.5 Migration and parallel run (M11–M12)

| REQ | Layer | Feature | Settings |
|---|---|---|---|
| REQ-MIG-01..06 | CORE + PACK | Import framework (template per sheet, dry run, validation report, all-or-nothing) | CFG-MIG-01..05 |
| REQ-PR-01..05 | CORE + TENANT | Legacy import mapping, comparison, tolerance, cause codes | CFG-PR-01..05 |

---

## 4. Generic engines to build (the core of "no code for the next client")

| # | Engine | Contract (what it must accept) | First user |
|---|---|---|---|
| E1 | **Settings service** | Effective-dated, audited key/records per tenant; `resolveConfig(tenant, asOf)`; schema-driven validation from `packages/config`; export/import | All modules |
| E2 | **Approval engine** | Chains of steps `manager_level(n) \| role(x) \| user(id)`; reason rules; skip/escalate; reminders; any object type (leave, overtime, attendance correction, payroll run) | Leave |
| E3 | **Leave engine** | Any leave type record (catalogue §4.1): accrual, unit, counting with schedule + holidays, balance pools, negative, carry-over expiry | LV01–LV16 |
| E4 | **Time engine** | Schedules incl. rotating rest and temporary ranges; punches → days; anomaly rules; overtime bands by day type × time window | Attendance |
| E5 | **Payroll engine** | Pipeline of steps; pay element records with `calc_type`; country steps from the pack; result lines `(run_id, employee_no, element_code, base, rate, amount)`; stores config hash | Monthly + off-cycle |
| E6 | **Adapter registry** | Interfaces `DeviceAdapter`, `BankFileWriter`, `ErpPostingAdapter`, `DeclarationWriter`; adapters register by key; tenant picks a key in config | zkteco, attijariwafa, s4hana-cloud-soap, cnss-damancom |
| E7 | **Import framework** | Sheet templates, column maps, validators (core + pack), dry run, report, commit | H01–H18, H16 |
| E8 | **Document templating** | Templates with merge fields from employee/contract/config; PDF via Gotenberg | Contracts, payslips |

Formula evaluator (CFG-PAY-12) is E5's R2 extension: keep `calc_type = formula` in the schema now; evaluator after go-live.

---

## 5. Build order (dates from v0.1 §12.1, to confirm by the ConSAP project lead)

| Step | Scope | Needed by |
|---|---|---|
| B0 | `packages/config` (delivered as starter), E1 settings service + generic admin screens, MA pack skeleton, CI guard for tenant names | 2 Dec 2026 |
| B1 | Organisation, security (M1, M4), E7 import for set-up sheets, SMG config loaded from `packages/config/examples/tenants/smg.config.json` (moves to `tenants/` with the settings service) | 2 Dec 2026 |
| B2 | E2 approvals, E3 leave, employees and contracts (M2, M3), E8 contract templates, employee import | 15 Dec 2026 |
| B3 | E4 time (file + manual; zkteco adapter when OPEN-05 closes), E5 regular run, payslip | 24 Dec 2026 |
| B4 | E6 adapters: S/4HANA posting, CNSS Damancom, IR, bank writer (scope to align); off-cycle | 8 Jan 2027 |
| B5 | Parallel run module, December then January | 22 Jan 2027 |

---

## 6. Acceptance

All tests T-… from v0.1 §12.2 stay, **driven by configuration fixtures**, plus:

| Test | Given | Expect |
|---|---|---|
| T-CFG-01 | `packages/config/examples/tenants/smg.config.json` | Validates against the schema; resolved config hash stable |
| T-CFG-02 | A second fictitious tenant `DEMO-B` with N+1 → N+2 approval, no negative leave, calendar-month period | Same code base; leave and payroll behave per its settings; no code change |
| T-CFG-03 | Tenant leave entitlement below a pack floor | Validation error naming setting and floor |
| T-CFG-04 | Production payroll with an `unverified` pack value | Run refused, list of keys |
| T-CFG-05 | Change a setting effective next month | Current month results unchanged; next month uses new value; audit entry written |
| T-CFG-06 | Export SMG config, import into a new tenant as template | Same resolved config except identifiers and secrets |
| T-CFG-07 | Grep for tenant names in `apps/` and `packages/` | No matches outside examples and tests |

---

## 7. Product gaps G1–G9 (v0.1 §13): new treatment

All nine are generic features, built once, switched by flags (catalogue §16): G1 → CFG-FEAT-01, G2 → CFG-HOL-02, G3 → CFG-LV-24, G4 → CFG-FEAT-02, G5 → LV16 / CFG-TIME-24, G6 → CFG-FEAT-03, G7 → CFG-FEAT-08 / CFG-SEC-06, G8 → E6 `zkteco`, G9 → E6 bank writer. They are **product backlog, not SMG change requests** (fixed-scope rule of 17 Nov 2026). OPEN-27 now asks Youssef to confirm this treatment, not to classify each item.

---

## 8. Points for Youssef El Mokaddem (added by v0.2)

| # | Point | Proposal |
|---|---|---|
| Y1 | Product approach: SMG built as configuration of CPeople | Confirm (OPEN-27) |
| Y2 | Bank transfer file: v0.1 marks it DECIDED; MVP scope doc v0.2 lists it as a change request | Decide; the writer is generic anyway (G9) |
| Y3 | Leave approval: workshops say N+1 → HR; requirement register says N+1 → N+2 | Update the register to the workshop decision; both are settings |
| Y4 | Formula pay elements in R2 (after go-live) | Confirm; SMG list fits the standard calc types (to recheck when OPEN-17 arrives) |
| Y5 | Product name in SMG documents: CPeople replaces "ConSAP HR & Payroll" | Apply in v0.2 onward |
| Y6 | Six new open points NEW-01…NEW-06 (catalogue §18) | Add to the SMG open-points list with owners |

---

## 9. Starter code delivered with v0.2 (`packages/config`, `packages/country-packs/ma`)

| Item | What it does |
|---|---|
| `src/tenant.ts` | Zod schema of the whole tenant config + cross-reference rules (chains, pools, elements, document types, feature flags, MFA floor, Digital Access constraint, four-eyes) and `listTodos` |
| `src/pack.ts` | Pack schema, `getPackVersion`, `assertPackUsable` (production refuses unverified / unseeded values) |
| `src/resolve.ts` | `resolveConfig(pack, tenant, asOf)`: validation, statutory floors, frozen result, `configHash` (canonical JSON, SHA-256) |
| `src/settingsIndex.ts` | CFG ID → schema path; a test fails if it drifts from the catalogue |
| `examples/tenants/smg.config.json` | SMG's settings (no personal data), every open point as `{ "todo": "OPEN-xx" }` |
| `country-packs/ma/pack.json` | Morocco pack skeleton: 36 keys, all `unverified`; rates, IR scale, SMIG and ceilings deliberately `null` until seeded from official sources |
| `scripts/validate-tenant.ts` | `npm run validate:tenant -- <tenant> <pack> [asOf] [--production]`: readiness report, exit 1 when not ready |
| `scripts/check-no-tenant-names.mjs` | CI guard for T-CFG-07 |
| Tests | 22 tests: T-CFG-01 to -04, the config-hash part of T-CFG-05, floors, references, decimals, flags, catalogue ↔ index. T-CFG-05 (effective dating, audit), -06 and the code side of -07 come with the settings service |

Next for Claude Code (B0): the settings service (E1) storing these objects as effective-dated, audited rows, `GET/PUT /admin/config`, and admin screens generated from the schema.
