# CPeople — Functional & Technical Specification (v0.1 draft)

Nov 25, 2026 · @Youssef EL MOKADDEM

## 1. Document control and how to read it

This is the build specification for CPeople. It turns the Kawadir v0.5 prototype, the SMG Morocco workshops and the configuration accelerators into rules a developer can code and test. It is written for Nouamane Lahlal (functional owner) and for Claude Code working in the `cpeople` repository.

| Item | Value |
| --- | --- |
| Product | CPeople by ConSAP (formerly Kawadir demo, v0.5) |
| Version | 0.1, draft for review |
| Owner | Youssef El Mokaddem, ConSAP (architect and programme manager) |
| Functional lead | Nouamane Lahlal, ConSAP (HR and payroll) |
| First customer | Maison Samira Maatouk (SMG), Morocco, alongside the SAP S/4HANA Cloud project |
| Code baseline | `cpeople` repository after PR #1 (foundation), #2 (sign-in), #5 (sign-in design), as of 21 Nov 2026 |

### Status words used on every rule

| Tag | Meaning | What the developer does |
| --- | --- | --- |
| **\[Decision\]** | Confirmed by SMG or ConSAP in writing (minutes, accelerators, tech guide) | Build as written |
| **\[Proposal\]** | ConSAP recommendation in this spec, not yet confirmed | Build as written, behind configuration, so it can change without code |
| **\[Assumption\]** | Needed to build, not confirmed by anyone | Build behind configuration and log it in section 20 |
| **\[Open\]** | Answer still needed | Do not hard-code; leave a configurable default and raise it |
| **\[To validate\]** | Legal value or rule taken from public sources or the prototype | Load as seed data only; a payroll expert signs off before production |

### Requirement IDs

Each rule has an ID `CP-<AREA>-<nnn>`. Areas: `ARC` architecture, `CFG` configuration, `PCK` country pack, `ORG` organisation, `EMP` employee, `CON` contracts, `LEA` leave, `TIM` time, `PAY` payroll, `OUT` outputs, `EXP` expenses, `PRF` performance, `SEC` security, `WFL` workflow, `AI` assistant, `INT` integration, `NFR` non-functional, `IMP` implementation, `TST` testing. Section 19 maps SMG accelerator lines (LV, LR, AT, OT, PE, CT, CO, PP) to these IDs.

### Golden rule for code

No statutory value (rate, ceiling, bracket, minimum wage, day count) is typed in code. It lives in a dated table of the country pack, loaded from a source file that names its legal reference and its validator. This repeats the rule already set in the CPeople tech guide.

## 2. Purpose, scope and design principles

CPeople is ConSAP's cloud HR and payroll product. It is sold to several clients, and each one can run in several countries. It ships preconfigured, like SAP S/4HANA Cloud Public Edition or SuccessFactors. ConSAP maintains a localisation per country with best-practice content. A client adopts the countries it needs, then adjusts its own policies within limits that ConSAP sets.

### Product vision

- **One product, many countries.** A shared core (people, organisation, contracts, leave, time, approvals, roles) plus one country pack per country (statutory rules, payroll, declarations, payslip, IDs, holidays).
- **Configured, not coded.** A new client is a configuration activity in weeks, not a development project. A new country is a new pack, not a rewrite.
- **ConSAP keeps the law, the client keeps its policy.** Statutory content is read-only for clients and updated by ConSAP with each finance law. Client policy (more favourable leave, bonuses, approval steps) is client-editable, versioned and dated.
- **Moroccan first.** Morocco is the first validated pack, built for SMG go-live. UAE and France exist only as templates or placeholders. Their payroll stays disabled until a validated pack exists.

### In scope (MVP for SMG go-live)

Core HR, organisation, contracts and onboarding, documents, leave, time and attendance (ZKTeco API, file and manual fallbacks), overtime, Morocco monthly and off-cycle payroll, payslips, bank file, CNSS and IR declaration data, payroll posting to SAP S/4HANA, expenses, roles and security, audit, tenant onboarding wizard and data migration.

### In scope after MVP

Performance (goals and reviews) for the next demo, because SMG asked for it \[Decision\]. Also the production AI assistant, Arabic and right-to-left, SSO with Microsoft or Google, mobile-optimised self-service and a second country pack.

### Out of scope

Recruitment portal and job multi-posting, learning management, benefits administration, workforce planning, statutory e-filing robots (CPeople prepares files; the client files them), and agency workers' pay (CO04).

### Design principles (apply to every module)

| # | Principle | Consequence in code |
| --- | --- | --- |
| P1 | Effective dating everywhere | Every master record and every rule has `validFrom` / `validTo`; reads are always "as of a date" |
| P2 | Rules in tables, not code | Rates, brackets, ceilings, day counts, leave entitlements are data rows in versioned tables |
| P3 | Layered configuration | Platform → country pack → tenant policy → transaction; a lower layer may only do what the layer above allows (section 4) |
| P4 | Never inherit a foreign formula | A country without a validated pack has payroll disabled, never a copy of Morocco |
| P5 | Server enforces everything | Tenant isolation (row-level security, fail closed), field permissions and segregation of duties are checked in the API and database, never only in the browser |
| P6 | Immutable results | A locked payroll period is never edited; corrections go through retro or off-cycle runs |
| P7 | Explainable payroll | Every payslip line keeps its formula, inputs, rule version and pack version |
| P8 | Audit by default | Every create, change, approval, view of sensitive data and configuration change is logged |
| P9 | Bilingual from day one | FR and EN in translation files; AR planned with start/end layout already in place |
| P10 | AI proposes, humans approve | The assistant never changes statutory rules or pay data directly (section 16) |

## 3. Inputs and decision register

This spec rests on five inputs. Decisions below are already confirmed and must not be reopened in code; everything else is a proposal.

| Input | Date | What it gives |
| --- | --- | --- |
| Kawadir HR & Payroll Cloud v0.5 (HTML demo) | 16 Nov 2026 | Functional patterns: effective-dated assignments, payroll checks and statuses, three rule layers, scripted assistant, 17-step onboarding wizard, Morocco prototype engine |
| CPeople tech stack guide | 21 Nov 2026 | Architecture: Next.js, NestJS modular monolith, PostgreSQL with row-level security, Prisma, Keycloak, Redis/BullMQ, S3 (RustFS), Gotenberg, monorepo with `payroll-engine` and `country-packs/ma` |
| SMG workshop minutes HR-01 | 23 Nov 2026 | Employee file, organisation, contracts |
| SMG workshop minutes HR-02 | 24 Nov 2026 | Leave, attendance, cut-off, overtime, approvals |
| HR configuration accelerators v0.2 | 24 Nov 2026 | 85 lines in 8 topics: 43 approved, 4 rejected, 38 open |

### Confirmed decisions

| ID | Decision | Source | Impact in CPeople |
| --- | --- | --- | --- |
| D01 | SMG does not use SuccessFactors Employee Central; HR runs on CPeople | HR-01 d1 | CPeople is the HR system of record for SMG |
| D02 | Employee number = biometric device ID | HR-01 d2 | `employeeNumber` is tenant-unique, imported from ZKTeco, used as the attendance key (CP-EMP-002) |
| D03 | Mr. Hassam Mahmood is SMG HR manager with full access | HR-01 d3 | Role `HR_MANAGER` with MFA |
| D04 | Every leave type: N+1 then HR final approval | HR-02 d1 | Default leave workflow = 2 steps (CP-WFL-010) |
| D05 | Payroll cut-off on the 25th; later attendance goes to next month | HR-02 d2 | Payroll calendar with a cut-off day (CP-PAY-020). Exact boundaries still open |
| D06 | Overtime and shifts follow the Labour Code (44 h a week), calculated by payroll | HR-02 d3 | Overtime evaluated from time data (CP-TIM-030) |
| D07 | Labour Code leave is the minimum; SMG adds its own more favourable rules | HR-02 d4 | Tenant policy may only add to the pack's legal floor (CP-CFG-030) |
| D08 | All sites use biometric devices; a few exempt employees entered by HR | HR-02 d5 | Per-employee `timeSource` attribute |
| D09 | Attendance by API, then file upload, then manual entry | HR-02 d6 | Three source adapters (CP-TIM-001) |
| D10 | A manager outside the Morocco payroll can approve with a user account; non-Morocco staff are kept out of the Morocco payroll | HR-02 d7 | User accounts are independent from employment; payroll scope by legal entity (CP-SEC-012) |
| D11 | Negative annual leave balance is allowed and not blocked | Accelerators LR06 (rejected) | `allowNegative = true` for SMG's annual leave (CP-LEA-040) |
| D12 | Leave reason is mandatory on request and approval, and visible to the employee | Accelerators LR10 (rejected) | Reason mandatory, visible to requester (CP-LEA-050). Sensitive types are still masked from peers |
| D13 | Rest days: operational staff 1 day a week on shift; back office 2 days (Saturday and Sunday); 44 h maximum a week | Accelerators LR01 comment | Two schedule families (CP-TIM-010) |
| D14 | CIMR not used by SMG Morocco today | Accelerators CT05 | CIMR stays in the pack, inactive for SMG |
| D15 | Mutuelle not used by SMG Morocco today | Accelerators CT06 | Deduction type exists, inactive for SMG |
| D16 | Maternity employer top-up on hold, Mr. Hassam to confirm | Accelerators LV10 | Top-up is a tenant policy switch, default off |
| D17 | Build modular and scalable, with client admin access and ConSAP-side customisation | Product owner | Sections 4 to 7 |
| D18 | Two hosting environments to reduce cost: Dev & Test, and Production | Product owner; tech guide 11 | Dev and Test share a server; Prod alone; daily backups in a second Moroccan site |
| D19 | Product renamed from Kawadir to CPeople | Product owner | All screens, packs and documents use CPeople |
| D20 | Performance module in the next demo version | Product owner, SMG request | Section 14 |
| D21 | Moroccan employee data stays in Morocco (law 09-08) | Tech guide 11 | Test and Prod hosted in Moroccan data centres; the provider is still open |

Accelerator lines still blank for SMG (attendance, overtime, pay elements, payroll and declarations: 38 lines) are treated as \[Proposal\] with configurable defaults.

## 4. Solution architecture and configuration layers

CPeople keeps the stack in the tech guide unchanged. It adds a configuration model of four layers, so one code base serves every client and country.

&#91;embedded content: configuration layers · 4 levels\]

The country pack is the layer that makes CPeople multi-country. Section 7 defines it.

### Runtime architecture (from the tech guide, kept as is)

| Component | Technology | Role |
| --- | --- | --- |
| Web app | Next.js, React, Tailwind, design tokens, i18n FR/EN | Screens only; never touches the database |
| API | NestJS modular monolith, REST + OpenAPI | All business rules and permission checks |
| Database | PostgreSQL + Prisma, row-level security per tenant, fail closed | System of record |
| Identity | Keycloak (one organisation per tenant), Keycloakify pages, openid-client | Sign-in, MFA, lockout, later SSO |
| Jobs | Redis + BullMQ | Payroll runs, payslip PDFs, imports, e-mail, SAP posting |
| Files | S3 API (RustFS locally) | Documents, payslips, imports, exports |
| PDF | Gotenberg | Payslips, contracts, certificates |
| SAP | Journal Entry – Post (SOAP, SAP\_COM\_0002); B1 Service Layer; CSV | Payroll posting |

### New packages to add to the monorepo

| Package | Content |
| --- | --- |
| `packages/config-core` | Configuration object registry, guardrail checks, resolution service, versioning (section 6) |
| `packages/rules-dsl` | Safe expression language and evaluator for payroll and time rules (section 11) |
| `packages/time-engine` | Time evaluation: punches to time types, overtime, anomalies (section 10) |
| `packages/leave-engine` | Accrual, entitlement, balance, counting (section 9) |
| `packages/payroll-engine` | Already planned: generic calculation runner on a schema of rules (section 11) |
| `packages/country-packs/<cc>` | One folder per country, with manifest, data and tests (section 7) |

### Architecture requirements

- **CP-ARC-001** Engines (payroll, time, leave, workflow) are country-agnostic. They read only resolved configuration and never branch on a country code.
- **CP-ARC-002** Every configurable value is resolved by one service, `resolve(objectType, key, context)`. The context holds tenant, legal entity, country, employee and date. The service returns the value plus its origin (pack version, tenant policy version, override) for explanation and audit.
- **CP-ARC-003** Resolution order: employee override (only if the object allows it), then tenant policy, then country pack default, then platform default. A value outside the guardrail is rejected when saved, not at run time.
- **CP-ARC-004** Guardrail types on each configurable item: `LOCKED` (statutory, no change), `FLOOR` (tenant may only raise, such as leave days), `CEILING` (tenant may only lower), `EXTEND` (tenant may add items, never delete pack items), `FREE` (pure tenant policy).
- **CP-ARC-005** Modules can be switched on or off per tenant (`hiring`, `time`, `leave`, `expenses`, `payroll`, `accounting`, `performance`). A disabled module is refused by the API, not only hidden.
- **CP-ARC-006** Long jobs run in the queue with progress, retry and an idempotency key. A payroll run for 1,000 employees must not block the web app.

## 5. Tenancy, enterprise structure and employee data model

One tenant is one client group. A tenant can hold several legal entities in different countries. The country of the legal entity decides which pack applies to an employment. A person is stored once; each employment and assignment is dated.

### Enterprise structure objects

| Object | Key fields | Notes |
| --- | --- | --- |
| Tenant | `tenantId`, name, default language, date format, number format, time zone, active modules, active countries | Keycloak organisation; row-level security key on every table |
| LegalEntity | code, name, `country`, currency, employer identifiers (defined by pack), address, ERP company code | MA identifiers: ICE, IF, RC, CNSS affiliation number, patente |
| Establishment | code, legal entity, employer social number if different, address | Optional; used when declarations are split per site |
| Location (site) | code, name, address, time zone, holiday calendar | SMG: Rabat, Casablanca |
| OrgUnit | code, name, parent, head position, cost centre, validFrom/To | Departments and subsections; tree |
| CostCenter | code, ERP code, legal entity, validFrom/To | Mapped to S/4HANA cost centres (open: FIN-04) |
| Job | code, title FR/EN, job family, category (e.g. cadre, employee, worker) | Category drives pack rules where needed |
| Position | id, job, org unit, location, FTE, reports-to position, validFrom/To | Manager chain comes from positions, with a fallback to direct `managerId` |
| PayrollArea | code, legal entity, frequency (monthly), calendar, cut-off day, pay day | SMG: one monthly area for MA01 |

### Employee data objects

| Object | Scope | Key fields |
| --- | --- | --- |
| Person | Global, once per human | Names (Latin and Arabic script), birth date, gender, nationality, marital status, contact, addresses, emergency contact |
| NationalId | Per person, typed by pack | Type (CIN, passport, residence card, Emirates ID…), number, issue and expiry dates, validator from pack |
| FamilyMember | Per person | Relation, name, birth date, `taxDependent` flag, `socialDependent` flag, valid dates |
| BankAccount | Per person, dated | IBAN/RIB, bank, holder, purpose (salary, expenses), split rule |
| Employment | Per person per legal entity | `employeeNumber`, hire date, seniority start date, contract (see 8), status, exit date and reason, `timeSource` (device, manual) |
| Assignment | Per employment, effective-dated | Position, org unit, location, job, manager, work schedule, payroll area, cost-centre split, FTE, employee group/category |
| Compensation | Per employment, effective-dated | Recurring pay components (wage type, amount or rate, currency, frequency); base salary is one component |
| PayrollProfile | Per employment, effective-dated, fields from pack | MA: CNSS number, CIMR affiliation and rate, mutuelle, IR exemption flags, ANAPEC scheme dates |
| Document | Per person or employment | Type, file in S3, expiry date, sensitivity, retention class |
| UserAccount | Per tenant | Keycloak identity, roles, optional link to a Person. Allows approvers outside the payroll (D10) |

### Requirements

- **CP-ORG-001** All structure objects are effective-dated. Reorganisations are entered with a future date and applied automatically on that date.
- **CP-ORG-002** A legal entity has exactly one country and one currency at a time. The country selects the pack (CP-PCK-001).
- **CP-EMP-001** A person may hold several employments (for example Morocco and UAE). Each employment is paid by the payroll area of its legal entity only (D10).
- **CP-EMP-002** `employeeNumber` is unique per tenant and equals the biometric device ID for SMG (D02). Format and length are set per tenant. \[Open: format confirmation, HR-01 open point 4\]
- **CP-EMP-003** Changes to assignment and compensation create a new dated record. Overlaps are not allowed. A change splits the current record at its effective date. Back-dated changes into a locked payroll period trigger retro calculation (CP-PAY-060).
- **CP-EMP-004** Two change modes: "new event" (keeps history, needs a reason code such as hire, transfer, promotion, salary review, manager change, schedule change, exit) and "correction" (fixes a typo in an existing record, logged, HR manager role only).
- **CP-EMP-005** A salary change is created in status `pending`. It applies only after approval by the configured approver (Kawadir v0.5 rule, kept).
- **CP-EMP-006** Country-specific fields are declared by the pack (name, type, validation pattern, mandatory flag, sensitivity) and shown only for employments of that country. Example MA: CIN pattern `^[A-Z]{1,2}\d{5,6}$` \[To validate\], CNSS number 9 digits \[To validate\].
- **CP-EMP-007** Mandatory fields at hire are configurable per tenant, above a pack minimum. The pack minimum for MA is name, birth date, CIN, hire date, legal entity, contract type, base salary and schedule.
- **CP-EMP-008** Sensitive fields (national ID, social number, bank, health-related documents) are masked by default. Revealing one is logged with the user and reason (Kawadir v0.5 pattern).
- **CP-EMP-009** Employee self-service can see and request changes to their own personal data, bank and family. Changes to bank details need HR approval. Whether employees see their own base salary is a tenant setting. \[Open: HR-01 open point 2\]

## 6. Configuration framework

Every configurable item is a registered configuration object. It has an owner layer, a guardrail, effective dating, versions and an approval rule. Two consoles edit it: the ConSAP Platform Console and the client's Admin Centre. This gives the SAP Public Cloud pattern: ConSAP ships best practice, the client adjusts within allowed limits, and every change is traceable.

### Configuration object registry

Each object type is declared once in `packages/config-core` with:

| Attribute | Meaning |
| --- | --- |
| `type` | e.g. `leave.type`, `payroll.wageType`, `time.schedule` |
| `schema` | JSON Schema of one record (validated on save, in the API) |
| `ownerLayer` | `platform`, `pack`, `tenant` |
| `guardrail` | `LOCKED`, `FLOOR`, `CEILING`, `EXTEND`, `FREE`, per field if needed |
| `dated` | true if records carry `validFrom` / `validTo` |
| `approval` | none, single, or four-eyes (requester ≠ approver) |
| `transport` | whether it moves from Dev & Test to Prod as part of a bundle |
| `impactSimulator` | optional function that shows who is affected before activation (Kawadir v0.5 pattern) |
| `labels` | FR, EN (AR later) |

### Configuration catalogue (MVP)

| Area | Object | Owner | Guardrail | Client can |
| --- | --- | --- | --- | --- |
| General | Tenant settings (language, formats, time zone, modules) | tenant | FREE | Edit |
| Organisation | Legal entities, establishments, locations, org units, cost centres, jobs, positions | tenant | FREE | Edit |
| Organisation | Employer identifier types | pack | LOCKED | View |
| People | Country-specific employee fields | pack | EXTEND | Add custom fields, never remove pack fields |
| People | Event reasons (hire, transfer, exit…) | pack | EXTEND | Add reasons |
| People | Document types and expiry alerts | pack | EXTEND | Add types, set alert days |
| Contracts | Contract types and legal limits | pack | LOCKED | View |
| Contracts | Contract templates and clauses | tenant | FREE | Edit (legal review advised) |
| Contracts | Trial period per type and category | pack | CEILING | Shorten only |
| Onboarding | Checklist templates and tasks | tenant | FREE | Edit |
| Time | Holiday calendar (official) | pack | LOCKED + yearly confirmation | Add company closing days |
| Time | Work schedules and rotation | tenant | FREE within pack limits (max hours per day and week) | Edit |
| Time | Time types, overtime windows and premiums | pack | FLOOR | Pay more, never less |
| Time | Lateness tolerance, anomaly rules, rounding | tenant | FREE | Edit |
| Leave | Statutory leave types and days | pack | FLOOR | Raise days, add conditions |
| Leave | Company leave types | tenant | FREE | Add |
| Leave | Accrual, carry-over, negative balance, half days, lead time | pack default, tenant | Mixed (section 9) | Edit within limits |
| Payroll | Statutory wage types, rate tables, brackets, ceilings | pack | LOCKED | View |
| Payroll | Company wage types (bonuses, allowances, deductions) | tenant | EXTEND, tax treatment chosen from pack treatment classes | Add |
| Payroll | Payroll calendar, cut-off, pay date | tenant | FREE | Edit |
| Payroll | GL account mapping | tenant | FREE | Edit |
| Workflow | Approval chains per process | pack default, tenant | FREE, minimum one approver | Edit |
| Security | Roles and permission sets | platform default, tenant | EXTEND, platform roles locked | Copy and adapt |
| Security | Sign-in policy (MFA, session, password) | platform | FLOOR | Make stricter |
| Integration | Attendance source, ERP target, bank format | tenant | FREE from supported list | Choose and map |

### Change lifecycle

1. **Draft.** An admin edits a configuration object in a change set (one or many records).
2. **Validate.** Schema, guardrail and cross-checks run on save. Example: a leave type below the pack floor is refused with the legal reference.
3. **Simulate.** The impact simulator lists affected employees and the before and after values (no pay data shown to non-HR roles).
4. **Approve.** If the object requires it, a second person approves (four-eyes).
5. **Activate.** Records get a version number and an effective date. Earlier versions stay readable.
6. **Roll back.** A rollback creates a new version restoring the previous values. History is never deleted.

### Environments and transport

- **CP-CFG-001** Configuration is built and tested in Dev & Test, then moved to Production as a signed bundle (JSON with a checksum, the source environment and the list of change sets). \[Proposal\]
- **CP-CFG-002** Import into Production shows a diff and requires an HR or admin approval. Tenant-only data (employees, payroll results) never travels in a bundle.
- **CP-CFG-003** Small policy changes (holiday, lateness tolerance) may be made directly in Production by the client admin, then logged. The object's `transport` flag decides which objects allow it.

### Consoles

- **CP-CFG-010 ConSAP Platform Console** (ConSAP staff only, MFA, IP allow-list \[Proposal\]): create tenants, assign country packs and versions, feature flags, release new pack versions, view configuration health. Support access to a tenant needs client consent, a time limit and a reason, and is logged (Kawadir v0.5 rule). No salary or identity data is visible by default.
- **CP-CFG-011 Client Admin Centre**: the catalogue above grouped by area, each item showing its owner, guardrail, current version, last change and pending change sets. Search by object or keyword.
- **CP-CFG-012 Implementation activities**: a guided list per area, ticked as done (like SAP Implementation activities). It drives the onboarding wizard in section 18.

### Best-practice starter content

- **CP-CFG-020** Each country pack ships a starter configuration: leave types, schedules, onboarding checklists, document types, wage types for common allowances, workflows, roles, GL mapping template, contract templates.
- **CP-CFG-021** On adoption, starter records are copied into the tenant layer with a reference to their pack origin (for example `MA-2026.1/best-practice`).
- **CP-CFG-022** When ConSAP updates starter content, the tenant sees "update available" with a diff and chooses whether to adopt it. Statutory `LOCKED` values are not optional: they apply automatically from their `validFrom`, and HR gets a notice.
- **CP-CFG-030** A tenant policy can never go below a pack `FLOOR` (D07). The check runs on save and again before each payroll run.

## 7. Country pack framework

A country pack is a versioned folder of data and rules, not code branches. The engines read it through the resolution service. Payroll for a country is enabled only when its pack reaches status `validated`. A missing country never borrows another country's formula (P4).

### Folder layout

```
packages/country-packs/ma/
  manifest.json            identity, version, status, owner, evidence
  fields/                  country-specific employee and employer fields + validators
  calendar/                fixed holidays, lunar holidays (estimated), confirmation log
  contracts/               contract types, legal limits, trial periods, alerts
  leave/                   statutory leave types, accrual and counting rules
  time/                    time types, overtime windows and premiums, legal limits
  payroll/
    wage-types.yaml        catalogue with treatment classes
    bases.yaml             cumulations (gross, social base, taxable base…)
    rate-tables/           dated rows: CNSS, AMO, AF, TFP, IR brackets, SMIG, prof. expenses
    schema.yaml            ordered calculation steps (rules DSL)
    checks.yaml            pre-run validations (block, warn, info)
  outputs/
    payslip/               template + mandatory mentions
    declarations/          CNSS (Damancom) and IR generators, specs and version
    bank/                  supported bank file formats
    gl/                    default GL mapping (CGNC accounts)
  best-practice/           starter tenant configuration (CP-CFG-020)
  tests/                   golden employee cases with expected payslips
  sources.md               legal references, links, validator sign-off per value
```

### Manifest

| Field | Example (MA) |
| --- | --- |
| `id`, `country`, `currency`, `defaultLanguage` | `MA`, `MA`, `MAD`, `fr` |
| `version` | `2026.1.0` (year of law . release . fix) |
| `status` | `placeholder`, `template`, `prototype`, `validated`, `released`, `retired` |
| `modules` | core, time, leave, expenses, payroll, declarations |
| `owner`, `validator` | ConSAP Morocco payroll lead (to appoint); external payroll expert or SMG accountant (P10) |
| `lawBasis` | Labour Code law 65-99, CNSS dahir 1-72-184, AMO law 65-00, CGI, finance law 2026 |
| `nextReview` | Date of the next finance law (each January) |
| `evidence` | Links to `sources.md` entries and the signed validation report |

### Status rules

| Status | Where it may run | Payroll |
| --- | --- | --- |
| placeholder | Any environment | Disabled; HR only (people, leave with manual days) |
| template | Dev & Test | Disabled; illustrative rules only |
| prototype | Dev & Test, demo tenants | Calculates with watermark "SPECIMEN" on payslips; no bank file, no declaration, no posting |
| validated | All | Enabled after the golden tests pass and the validator signs off |
| released | All | Validated and assigned to at least one production tenant |
| retired | Read only | Kept for past periods and retro |

### Rate table rows

Every statutory value is a dated row with its source:

```yaml
- key: CNSS_EMPLOYEE_LONG_TERM
  rate: 0.0396
  base: SOCIAL_BASE_CAPPED
  ceilingMonthly: 6000.00
  validFrom: 2026-01-01
  validTo: null
  source: "CNSS - dahir 1-72-184; rate notice"
  status: to_validate          # to_validate | validated
  validatedBy: null
  validatedOn: null
```

### Requirements

- **CP-PCK-001** The pack for an employment is the pack of its legal entity's country, at the version assigned to the tenant, using the rule rows valid on the calculation date.
- **CP-PCK-002** A pack version is immutable once released. Fixes ship as a new patch version. Past payroll results keep the version they used.
- **CP-PCK-003** Loading a pack runs its schema checks and its golden tests. A failing pack cannot be assigned to a tenant.
- **CP-PCK-004** A rate row in status `to_validate` blocks a production payroll run (block level check) but is allowed in Dev & Test.
- **CP-PCK-005** New finance law: ConSAP adds dated rows with the new `validFrom`, reruns golden tests, gets validator sign-off, releases a minor version, and notifies tenants. No tenant action is needed for `LOCKED` values.
- **CP-PCK-006** The Platform Console shows per pack: version, status, rows still `to_validate`, next review date, tenants using it.

### Adding a country (checklist)

1. Create the folder from the template pack, status `placeholder`: fields, IDs, calendar, contracts, leave. HR modules work at once.
2. Collect the legal sources with a local expert: social security, health, tax, minimum wage, working time, leave, exit pay, declarations, payslip mentions, bank format.
3. Model wage types, bases, rate tables and schema. Status `template`.
4. Write at least 20 golden cases (section 18) with the local expert. Status `prototype`.
5. Validator sign-off on every rate row and on the golden results. Status `validated`.
6. First production tenant. Status `released`.

UAE example of items to model (from Kawadir v0.5 notes, not validated): GPSSA pension for nationals, end-of-service gratuity, WPS salary file, no personal income tax. These stay out of scope until a UAE client needs payroll.

## 8. Core HR: employee file, contracts, onboarding, documents

The employee file is the single source for every other module. Hiring, changes and exits are events with a reason and a date. Each event can start a checklist, a document and a payroll consequence.

### Employee events

| Event | Creates | Payroll consequence |
| --- | --- | --- |
| Hire | Person (or reuse), employment, first assignment, compensation, contract, onboarding checklist | Joins payroll from hire date; prorated first month (CP-PAY-040) |
| Transfer, promotion, manager or schedule change | New assignment record | Cost centre and schedule from the effective date |
| Salary review | Pending compensation record, approval | Applies from effective date after approval; retro if back-dated |
| Contract renewal or conversion (CDD to CDI) | New contract record | None, unless pay changes |
| Leave of absence (unpaid, maternity, long sickness) | Status change with dates | Pay suspended or replaced per pack rules |
| Exit | Exit date, reason, offboarding checklist, final pay request | Off-cycle final pay (CP-PAY-070) |

### Contracts (accelerators CO01 to CO04, all approved)

| Type | Pack rule (MA) | Alerts | Payroll |
| --- | --- | --- | --- |
| CDI | Default type (Labour Code art. 16) | Trial period end | Yes |
| CDD | Only in Labour Code cases; new activity: max 1 year, renewable once (art. 16, 17) | 30 days before end \[Decision CO02\]; block a 3rd renewal | Yes |
| ANAPEC insertion | Scheme duration and exemptions \[To validate\] | Before scheme end; before exemption end | Yes, with exemption flags (CT10) |
| Temporary agency worker | Employed and paid by the agency (art. 495 and following) | Assignment end | No; attendance only if the tenant enables it |

- **CP-CON-001** Contract types, their legal limits and allowed renewals come from the pack (`LOCKED`). Templates and clauses are tenant content (`FREE`), supplied by SMG (HR-01 action 2).
- **CP-CON-002** Templates use placeholders (`{{company}}`, `{{ice}}`, `{{firstName}}`, `{{job}}`, `{{salary}}`, `{{startDate}}`, `{{trial}}`, `{{schedule}}`…). The PDF is made by Gotenberg, stored in S3 and linked to the contract record. The text carries a version number.
- **CP-CON-003** Trial periods are pack values per contract type and job category, renewable once. The tenant may only shorten them (`CEILING`). Seed values \[To validate\]: managers 3 months, employees 1.5 months, workers 15 days (Labour Code art. 14). \[Open: HR-01 open point 3\]
- **CP-CON-004** E-signature is out of MVP. A signed scan is uploaded as a document of type "Signed contract".

### Onboarding and offboarding

- **CP-EMP-020** Checklist templates are tenant configuration. Each task has an owner role (HR, manager, employee, IT), a due offset in days from the event date, an optional document type to collect and a blocking flag.
- **CP-EMP-021** Starter onboarding checklist (MA best practice, from Kawadir v0.5): signed contract (day 0), copy of CIN (day 0), bank details (day 3), CNSS registration (day 10), IT access and equipment (day 1), welcome and buddy (day 1), pre-employment medical (day 30), internal rules acknowledged (day 7).
- **CP-EMP-022** A blocking task (bank details, for example) raises a payroll check when it is still open at cut-off. Missing bank details block payment preparation, not the calculation (Kawadir v0.5 rule).
- **CP-EMP-023** Starter offboarding checklist: equipment returned, access revoked on the last day, final pay approved, work certificate issued, final settlement receipt signed \[To validate: Labour Code art. 72 and 73\].
- **CP-EMP-024** Candidate to employee: a candidate in stage "offer accepted" can be converted. The hire form is prefilled and the candidate is marked "hired". A full recruitment module is out of scope.

### Documents

- **CP-EMP-030** Document types come from the pack and the tenant (EXTEND). Each type has: owner (person or employment), sensitivity (normal, sensitive, health), expiry required, alert days before expiry, who may upload and view, retention class.
- **CP-EMP-031** Starter MA types: CIN, passport, residence permit, medical aptitude, diploma, signed contract, CNSS affiliation, photo, medical certificate (health, HR only), family-event certificate. \[Open: list and expiry alerts, HR-01 open point 5\]
- **CP-EMP-032** Files are stored in S3, encrypted, scanned for malware on upload, limited in size and type (PDF, JPG, PNG). Every view of a sensitive document is logged.
- **CP-EMP-033** Managers do not see contracts, payslips or health documents of their team (Kawadir v0.5 rule).

### Bulk import

- **CP-EMP-040** Import from an Excel or CSV template per object (employees, assignments, compensation, family, bank, balances). The template lists each column with its format (HR-01 action 3).
- **CP-EMP-041** Validation reports missing, duplicate and invalid values per line, plus unknown references (department, site, schedule, manager). Invalid lines are never imported silently. The user confirms the count of valid lines before loading (Kawadir v0.5 wizard rule).

## 9. Leave management

Leave is driven by leave-type records, never by code per type. The pack ships the statutory types with legal floors. The tenant adds days or types above them. Balances come from one engine: opening + accrued − taken ± adjustments.

### Leave type attributes (configuration schema)

| Attribute | Values | Example: MA annual leave |
| --- | --- | --- |
| `code`, labels FR/EN | text | `CP`, "Congé annuel payé" |
| `category` | annual, family event, maternity/paternity, sickness, work accident, unpaid, compensatory, other | annual |
| `unit` | days, half days, hours | half days |
| `countingBasis` | `PACK_LEGAL_DAYS`, `SCHEDULED_DAYS`, `CALENDAR_DAYS` | see counting rule below |
| `paid` / `payTreatment` | unpaid, full pay, average pay, social-security allowance with optional top-up | average pay (LR13) |
| `hasBalance`, `accrualRule` | none, monthly, yearly grant, per event | monthly 1.5 days |
| `entitlementDays` + `seniorityRule` + `cap` | number, rule ref, number | 18; +1.5 per 5 years; 30 |
| `eligibility` | min service, age, gender, contract types, category | 6 months of continuous service |
| `allowNegative` | bool + limit | true for SMG (D11) |
| `carryOver` | max years, max days, expiry date | 2 consecutive years (LR05) \[To validate\] |
| `minContinuousBlock` | days per year | 12 working days (LR04) \[To validate\] |
| `leadTimeDays` | number | 14 calendar days (LR08) |
| `attachment` | none, optional, mandatory + document type | none |
| `reasonRule` | optional, mandatory; visibility | mandatory, visible to employee and approvers (D12) |
| `sensitive` | bool (masks the type to peers and team calendar) | false |
| `workflow` | approval chain id | N+1 then HR (D04) |
| `perEventDays`, `takeWithin` | number, days | for family events |
| `guardrail` | FLOOR for statutory types | FLOOR |

### Morocco statutory leave content (accelerators LV01 to LV17, all approved by SMG)

| Ref | Type | Pack value \[To validate where marked in accelerators\] | Pay | Proof |
| --- | --- | --- | --- | --- |
| LV01 | Annual leave | 1.5 days per month of service (18 a year); 2 days per month under 18 years old; right opens after 6 months | Leave pay (LR13) | – |
| LV02 | Seniority increase | +1.5 days per full 5 years of service, max 30 days a year | Leave pay | – |
| LV03 | Employee's wedding | 4 days | Paid | Certificate |
| LV04 | Wedding of a child (employee or spouse) | 2 days | Paid | Certificate |
| LV05 | Death of spouse, child, grandchild, ascendant | 3 days | Paid | Certificate |
| LV06 | Death of brother or sister | 2 days | Paid | Certificate |
| LV07 | Circumcision of a child | 2 days | Paid | Certificate |
| LV08 | Surgery of spouse or dependent child | 2 days | Paid | Certificate |
| LV09 | Birth leave (father) | 3 days within the month of birth \[To validate\] | Paid | Birth certificate |
| LV10 | Maternity | 14 weeks; CNSS daily allowance; employer top-up only by policy (on hold, D16) | Social-security allowance | Medical |
| LV11 | Breastfeeding time | 1 paid hour a day for 12 months; a schedule adjustment, not leave | Paid time | – |
| LV12 | Unpaid child-raising leave | Up to 1 year after maternity, by agreement | Unpaid | Request |
| LV13 | Sickness | Notice within 48 h + medical certificate; CNSS allowance per its rules; employer pay for first days per policy | Policy | Medical, sensitive |
| LV14 | Work accident or occupational illness | Separate type; insurer compensates (law 18-12) | Insurer | Report, sensitive |
| LV15 | Unpaid leave | By agreement; days deducted | Unpaid | – |
| LV16 | Compensatory rest | For rest-day or holiday work if the tenant uses it (OT07) | Paid | – |
| LV17 | Other exceptional leave | From SMG's leave manual only \[Open: open point 1\] | Per manual | Per manual |

The developer must check family-event days against the Labour Code text before release. The accelerators record SMG's approval, not a legal validation.

### Accrual and entitlement algorithm

For employee E, year Y (leave year = calendar year, LR03), at month end M:

1. `eligible` = continuous service at M ≥ eligibility months (6). Before that, accrual is computed and held but not available. \[Proposal: show it as "accrued, available from \<date>"\]
2. `monthRate` = 2.0 if age at M < 18, else 1.5 (pack values).
3. `serviceMonthFactor` = 1 if the month is a month of effective service, else prorated by effective days / legal days. Paid leave, maternity, work accident and other pack-listed situations count as service. Unpaid leave and unjustified absence do not. \[To validate: list of assimilated periods\]
4. `seniorityExtra` = 1.5 × floor(service years at 1 Jan Y / 5), added in 12 equal monthly parts.
5. `accrued(M)` = Σ (monthRate × factor) + seniority parts, rounded to 0.5 day (pack rounding rule).
6. `entitlement(Y)` = min(cap 30, statutory + seniority) + tenant policy days (FLOOR check: tenant days ≥ 0).
7. `available` = opening (carried over) + accrued − taken − scheduled future approved + adjustments. `afterPending` = available − pending.
8. At year end, the unused balance moves to carry-over buckets tagged by year of origin. A bucket older than the carry-over limit expires, unless HR extends it with a reason.

Tenant policies (Kawadir v0.5 "extra days" policy) add rows such as "+2 days for staff in Casablanca with ≥ 5 years from 1 Jan 2027". They go through the change lifecycle in section 6.

### Counting rule

- **CP-LEA-010** Days requested = days in the range that are working days of the employee's schedule on each date, minus public holidays of the employee's location (LR01). Weekly rest days and holidays inside a leave period are not deducted.
- **CP-LEA-011** \[Open, needs legal check\] The Labour Code counts annual leave in "jours ouvrables" (a 6-day week). For back-office staff on a 5-day week (D13), counting only scheduled days is more favourable to the employee. The pack exposes `countingBasis` with default `PACK_LEGAL_DAYS` (6-day week); a tenant may choose `SCHEDULED_DAYS`. SMG must confirm which one it applies today.
- **CP-LEA-012** Half days: morning or afternoon, for annual and unpaid leave (LR07). Hours for breastfeeding time (LV11) are a schedule rule, not leave.

### Requests and approvals

- **CP-LEA-020** Employee self-service request: type, from, to, half-day flags, reason, attachment. The form shows days counted and the balance after pending requests, live.
- **CP-LEA-021** Annual leave requested less than 14 calendar days ahead gets a warning to approvers, not a block (LR08). Family events and sickness are recorded when they happen.
- **CP-LEA-022** Workflow N+1 then HR (D04). Without a manager, HR alone. HR may override with a logged reason. An approver outside the Morocco payroll uses a user account (D10, LR16).
- **CP-LEA-030** A mandatory attachment blocks submission without the file (LR11). Medical documents are sensitive: HR only.
- **CP-LEA-040** Negative annual balance is allowed for SMG (D11). The approver sees the negative figure in red. A tenant limit (for example −5 days) is optional.
- **CP-LEA-050** Reason is mandatory on request and on approval or rejection, and visible to the employee (D12). For sensitive types, peers and the team calendar show only "Absent".
- **CP-LEA-060** Cancellation: before the start, by the employee; after approval, it goes back through the approver; after payroll lock, it creates a correction for the next period.

### Plan, calendar and payroll links

- **CP-LEA-070** Annual leave plan: HR enters planned periods per department; managers see plan and actual in the team calendar (LR12). \[Open: product function to confirm, HR-02 action 10\]
- **CP-LEA-071** Team calendar shows approved, pending, holidays and non-working days per each person's schedule (Kawadir v0.5).
- **CP-LEA-080** Approved leave reaches payroll by period: paid days, unpaid days, leave-pay days, social-security-allowance days. Leave approved after cut-off goes to the next period (D05).
- **CP-LEA-081** Leave pay (LR13) = usual salary including the average of variable pay. Seed rule: average of variable wage types flagged `inLeaveAverage` over the previous 12 months, per day of leave \[To validate: Labour Code art. 245 and following\]. The pack defines the average period.
- **CP-LEA-082** At exit, the remaining balance (all buckets, at the leave-pay daily rate) is paid in the final pay (LR14). A negative balance at exit creates a deduction proposal that HR must confirm.
- **CP-LEA-090** Migration: opening balances per bucket at the go-live date (balance at 31 Jan 2027 per the data template H13).

## 10. Time, attendance and overtime

Punches come from the biometric devices, a file or HR entry. A daily time evaluation turns them into time types against the employee's schedule. Only approved results before cut-off go to payroll. For SMG all 7 attendance lines and 7 overtime lines in the accelerators are still open, so everything below is \[Proposal\] unless a decision is quoted.

### Sources (D08, D09)

| Priority | Source | Behaviour |
| --- | --- | --- |
| 1 | ZKTeco device API (AT03) | Pull every night, optionally every 15 minutes; device user ID = `employeeNumber` (D02) |
| 2 | Device export upload (AT04) | Excel or CSV in the format of SMG's sample; column mapping saved per tenant |
| 3 | Manual entry by HR (AT05) | Per employee with `timeSource = manual`: worked days and overtime hours per period |

- **CP-TIM-001** Each source is an adapter with one interface: `fetch(from, to) → PunchEvent[]` where a punch event is `{deviceUserId, timestamp, deviceId, direction?, raw}`. Adding a device brand means adding an adapter, not changing the engine.
- **CP-TIM-002** Imports are idempotent: a punch is identified by device, user and timestamp. Reloading a day never doubles hours.
- **CP-TIM-003** Unknown device user IDs go to an error queue for HR, never silently dropped.
- **CP-TIM-004** Device time is converted with the location time zone (`Africa/Casablanca`). \[Assumption: the devices send local time\]

### Schedules

- **CP-TIM-010** A schedule has daily patterns (start, end, unpaid breaks, planned hours) and a weekly or rotating cycle with a start date. Two starter families for SMG (D13): back office Monday to Friday, rest Saturday and Sunday; operational staff one rest day a week on shift, 44 hours maximum.
- **CP-TIM-011** Pack limits, checked on save: 44 hours a week (2,288 hours a year), 10 hours a day maximum (AT01), weekly rest of at least 24 consecutive hours (AT02) \[To validate: art. 184, 205\].
- **CP-TIM-012** Temporary schedules override the normal one for a date range: Ramadan hours (AT10), breastfeeding hour (LV11).
- **CP-TIM-013** Shift plans for outlets and kitchen: a manager assigns shifts per day in a roster view. \[Proposal: weekly roster, copied from the previous week\]

### Daily time evaluation

For each employee and day, the time engine:

1. Pairs punches into worked intervals (first in, last out, with pairing rules for breaks). An odd number of punches is an anomaly.
2. Deducts unpaid breaks from the schedule.
3. Compares worked time to planned time and applies the lateness tolerance (AT08, tenant value, for example 10 minutes). Lateness within tolerance is ignored.
4. Splits worked time into time windows: day hours 06:00–21:00, night hours 21:00–06:00 (AT11), with flags for weekly rest day and public holiday.
5. Produces time types: `NORMAL`, `ABSENCE_UNJUSTIFIED`, `LATE`, `OT_CANDIDATE_DAY`, `OT_CANDIDATE_NIGHT`, `REST_DAY_WORK`, `HOLIDAY_WORK`, `NIGHT_WORK`.
6. Raises anomalies: missing punch, single punch, work on a non-scheduled day, absence without approved leave, more than 10 hours, rest under 24 hours.

- **CP-TIM-020** HR and managers get a daily anomaly list. The manager corrects with a reason before cut-off (AT07). Corrections keep the original punches and log who changed what.
- **CP-TIM-021** A weekly summary per team goes to HR (asked by Mr. Hassam in HR-02).
- **CP-TIM-022** An approved leave on a day removes the absence anomaly and counts as leave, not absence.

### Overtime (OT01 to OT07)

- **CP-TIM-030** Overtime = hours worked beyond 44 hours in the week, or beyond the contractual schedule if lower, when requested or approved by the manager (OT01, D06). The week is the ISO week. \[Assumption: hours are allocated to the payroll period that contains the day the threshold is crossed\]
- **CP-TIM-031** Premiums (OT02) \[To validate: art. 201\]: +25% between 06:00 and 21:00; +50% between 21:00 and 06:00. On the weekly rest day: +50% by day, +100% by night. These are pack rows with guardrail FLOOR.
- **CP-TIM-032** Hourly rate = monthly reference pay ÷ 191 (OT03). The reference pay is a pack base (`OT_BASE`), seeded as base salary plus seniority bonus \[To validate: which elements belong to the overtime base\]. The Kawadir prototype used base salary only.
- **CP-TIM-033** Annual quota 100 hours per employee (OT04) \[To validate: decree\]. Warning at 80%, block beyond 100 unless HR records an allowed case.
- **CP-TIM-034** Only approved overtime is paid. The manager approves before cut-off (OT05). Unapproved candidates stay visible and expire after the period.
- **CP-TIM-035** Work on a public holiday is paid per pack rules (OT06) \[To validate: art. 217 and the decree on paid holidays\]. It is a separate time type with its own wage type.
- **CP-TIM-036** Payment or compensatory rest (OT07): tenant setting, default pay. With compensatory rest, hours credit a time-off balance (LV16) instead of a wage type. \[Open: HR-02 open point 6\]

### Period close and hand-over to payroll

- **CP-TIM-040** The payroll period follows the payroll area calendar. Cut-off on the 25th (D05). Proposed period: 26th of the previous month to 25th. \[Open: open point 3, 26–25 or 25–24\]
- **CP-TIM-041** At cut-off the time period is closed per employee: approved quantities become payroll inputs (worked days, unpaid absence days, overtime hours per premium, night hours, holiday hours). Later changes go to the next period as corrections.
- **CP-TIM-042** Days paid use the pack basis of 26 days a month and 191 hours \[To validate\]. A month with full attendance pays the full monthly salary, whatever its number of calendar days.
- **CP-TIM-043** Without time data for an employee who should have it, payroll assumes a full month minus unpaid leave and raises a warning (Kawadir v0.5 rule).

## 11. Payroll engine

The engine is a generic calculator. It runs the ordered steps of a country schema over wage types, bases and dated rate tables. It knows no country rule itself. Every result line records the rule, its inputs and the pack version, so any payslip figure can be explained.

### Wage types

| Attribute | Values |
| --- | --- |
| `code`, labels FR/EN | e.g. `1000` Base salary, `1100` Seniority bonus, `5100` CNSS employee |
| `owner` | pack (statutory, LOCKED) or tenant (company element, EXTEND) |
| `class` | earning, deduction, employer contribution, base (technical), information, net payment |
| `inputMode` | fixed amount, quantity × rate, % of a base, formula, imported |
| `recurrence` | recurring (from compensation), one-time (period input), derived (computed) |
| `proration` | none, payroll days (÷ 26), hours (÷ 191), calendar days |
| `cumulations` | membership in bases: `GROSS`, `SOCIAL_BASE`, `TAXABLE_GROSS`, `OT_BASE`, `SENIORITY_BASE`, `LEAVE_AVG`, `NET` |
| `treatmentClass` | pack-defined tax and social treatment, e.g. `MA.TAXABLE`, `MA.EXEMPT_CAPPED(TRANSPORT)`, `MA.EXEMPT_CAPPED(MEAL)`, `MA.NON_TAXABLE_REIMBURSEMENT`. A tenant wage type must pick one; it cannot invent a treatment |
| `retro` | relevant for retro differences or not |
| `payslip` | section, order, print when zero, label override |
| `glKey` | key resolved by the tenant GL mapping (section 13) |

### Schema and rules language

- **CP-PAY-001** A schema is an ordered list of steps in `payroll/schema.yaml`. Each step has an id, an optional condition and one operation: `copy` (input to line), `prorate`, `lookup` (rate table), `percentOf` (base), `bracket` (progressive table), `min`, `max`, `cap`, `round`, `cumulate`, `formula`.
- **CP-PAY-002** Formulas use a small safe expression language (`packages/rules-dsl`): arithmetic, comparisons, `min`, `max`, `round(x, n, mode)`, `rt('TABLE', key)` for the row valid on the period date, `base('NAME')`, `wt('CODE')`, `emp.field`, `period.field`. No loops, no I/O, no dates from the clock.
- **CP-PAY-003** All money uses decimal arithmetic (Prisma `Decimal`, decimal.js), never binary floats. The Kawadir prototype used floats with `Math.round`; that is not acceptable for production.
- **CP-PAY-004** Rounding is a pack rule per wage type (default: half up to 2 decimals per line). Totals are sums of rounded lines.
- **CP-PAY-005** The engine is deterministic: the same inputs, pack version and tenant configuration version give the same result to the cent. A hash of the inputs is stored with each result (Kawadir v0.5 `inputHash`).

### Run lifecycle

&#91;embedded content: payroll run lifecycle · 5 states, 3 outputs\]

| Object | Key fields |
| --- | --- |
| PayrollPeriod | payroll area, period id (YYYY-MM), start, end, cut-off, pay date, status (`open`, `calculated`, `approved`, `locked`) |
| PayrollRun | period, type (`regular`, `offcycle`, `retro`, `simulation`), version, status, calculated by and at, approved by and at, pack version, configuration version, input hash |
| PayrollResult | run, employment, lines (wage type, quantity, rate, base, amount, rule ref), totals, year-to-date cumulations, warnings |
| PaymentBatch | run, status (`none`, `prepared`, `sent`, `confirmed`), bank file reference |
| PostingDocument | run, status (`none`, `ready`, `posted`, `failed`), ERP document number, error log |

- **CP-PAY-010** Each calculation creates a new run version. Earlier versions stay readable for comparison ("what changed since version 2").
- **CP-PAY-011** Approval is refused if the inputs changed since the last calculation (hash mismatch), or if the approver is the person who calculated. A single-user tenant gets a warning instead, logged. \[Proposal\]
- **CP-PAY-012** Lock is final. After lock, payslips, payment, declaration data and posting are produced. Payment and posting have their own statuses: approving payroll never marks money as paid (Kawadir v0.5 rule).
- **CP-PAY-013** Reopen is allowed only before lock, with a mandatory reason, and cancels prepared payment and posting.

### Pre-run checks (from Kawadir v0.5, extended)

| Check | Level | Blocks |
| --- | --- | --- |
| Country pack status below `validated` in Production | block | calculate |
| Rate row `to_validate` used in Production | block | calculate |
| Base salary below the minimum wage of the period | block | calculate |
| Mandatory pack field missing (MA: CIN) | block | calculate |
| Social number missing (MA: CNSS number) | warn | – |
| Bank details missing | block | payment |
| Salary change pending approval in the period | warn | – |
| Leave or overtime pending approval in the period | warn | – |
| Expense claims pending | info | – |
| No attendance data for a device employee | warn | – |
| Inputs changed since calculation | block | approve |
| Same person calculates and approves | block (warn for single-user tenants) | approve |
| Overtime above annual quota | warn | – |
| Tenant policy below a pack floor | block | calculate |

An employee can be excluded from a run only with a reason, logged and shown on the checks list.

### Proration, retro and off-cycle

- **CP-PAY-040** Mid-month hire and exit are supported (the prototype blocked them). Proration rule is a pack parameter: MA seed = monthly salary × days paid ÷ 26, where days paid = scheduled days in employment in the period, minus unpaid absence \[To validate\].
- **CP-PAY-050** Unpaid absence deduction = monthly salary ÷ 26 × unpaid days (or ÷ 191 × hours for hourly absences) \[To validate\].
- **CP-PAY-060** Retro: a change dated inside a locked period triggers recalculation of each affected period in retro mode. The engine compares new and old results per wage type and pays or recovers the difference in the current period (line "Rappel"). Statutory treatment of arrears follows a pack rule \[To validate: IR on arrears\].
- **CP-PAY-070** Off-cycle runs: exit pay, bonuses (13th month, Eid, performance), corrections. They follow the same lifecycle. Contributions and tax are computed on the month's cumulated bases, so the regular run and the off-cycle runs of one month together give the right monthly totals.
- **CP-PAY-071** Exit pay components (PE10): salary to the last day, notice indemnity if notice is not worked, legal severance, unused leave (LR14), pro-rata bonuses. Severance scale is a pack table by service band \[To validate: Labour Code art. 52 to 53\]. Final pay produces the work certificate and the settlement receipt.
- **CP-PAY-080** Year-to-date cumulations per employee (gross, taxable, social bases, IR, days) are kept for the annual salary declaration (PP08) and for migration of opening YTD values (data template H15).

## 12. Morocco payroll calculation (pack MA, version 2026.1)

The MA schema runs 16 steps, from base salary to employer cost. Every value below is seed data for the 2026 rate tables, cross-checked on 25 Nov 2026 against public secondary sources and the Kawadir prototype. All values stay `to_validate` until the payroll expert or SMG's accountant signs them off against the official texts (accelerators open point 2).

### Calculation steps

| # | Step | Rule (monthly) | Bases fed |
| --- | --- | --- | --- |
| 1 | Base salary | Monthly salary × days paid ÷ 26 (CP-PAY-040) | GROSS, SOCIAL\_BASE, TAXABLE\_GROSS, SENIORITY\_BASE, OT\_BASE |
| 2 | Seniority bonus (PE02) | SENIORITY\_BASE × rate by full years of service at period end: 2 y 5%, 5 y 10%, 12 y 15%, 20 y 20%, 25 y 25% | GROSS, SOCIAL\_BASE, TAXABLE\_GROSS, OT\_BASE |
| 3 | Overtime (PE03) | OT\_BASE ÷ 191 × (1 + premium) × approved hours, per premium band (CP-TIM-031) | GROSS, SOCIAL\_BASE, TAXABLE\_GROSS |
| 4 | Holiday and night work | Per time type and pack rule (CP-TIM-035) | GROSS, SOCIAL\_BASE, TAXABLE\_GROSS |
| 5 | Company earnings | Tenant wage types; exempt part up to the treatment-class ceiling, the excess is taxable (PE04 to PE08) | GROSS; SOCIAL\_BASE and TAXABLE\_GROSS per treatment class |
| 6 | Leave pay and unpaid deduction | CP-LEA-081, CP-PAY-050 | as base salary |
| 7 | Gross (salaire brut global) | Sum of earnings | – |
| 8 | Taxable gross (SBI) | Gross minus exempt parts | – |
| 9 | CNSS employee | 4.48% × min(SOCIAL\_BASE, 6,000) (short term 0.52% + long term 3.96%) | deduction from TAXABLE\_GROSS for step 12 |
| 10 | AMO employee | 2.26% × SOCIAL\_BASE, no ceiling | same |
| 11 | CIMR and mutuelle employee | Only if the employee is affiliated (inactive for SMG, D14, D15) | same, if deductible \[To validate\] |
| 12 | Professional expenses | If SBI × 12 ≤ 78,000: 35% of SBI. Else 25% of SBI, capped at 35,000 a year (2,916.67 a month) | – |
| 13 | Net taxable income (SNI) | SBI − professional expenses − CNSS − AMO − CIMR employee | – |
| 14 | IR before family deduction | SNI × rate − amount to deduct, from the monthly bracket table | – |
| 15 | IR | IR before deduction − min(that IR, 50 × tax dependents, dependents capped at 6) | – |
| 16 | Net pay | Gross − CNSS − AMO − CIMR − mutuelle − IR − other deductions (advances, loans, PE09) + non-taxable reimbursements (expenses) | – |
| 17 | Employer contributions | CNSS 8.98% capped; family allowances 6.40%; AMO 4.11%; TFP 1.60%; CIMR employer if any | Employer cost = gross + reimbursements + employer contributions |

The prototype applied the professional-expenses rule on gross × 12 and capped the 35% band at 2,500 a month. The seed above uses SBI and no cap on the 35% band; the expert must confirm both points.

### Rate table seed values (2026)

| Key | Seed value | Valid from | Basis | Status |
| --- | --- | --- | --- | --- |
| SMIG hourly (non-agricultural) | 17.92 MAD/h; 3,422.72 MAD/month at 191 h | 2026-01-01 | Decree 2.25.983 | to\_validate |
| CNSS ceiling | 6,000 MAD/month | – | CNSS | to\_validate |
| CNSS employee (short + long term) | 0.52% + 3.96% = 4.48%, capped | – | CNSS | to\_validate |
| CNSS employer (short + long term) | 1.05% + 7.93% = 8.98%, capped | – | CNSS | to\_validate |
| Family allowances, employer | 6.40%, no ceiling | – | CNSS | to\_validate |
| AMO employee / employer | 2.26% / 4.11% (incl. 1.85% solidarity), no ceiling | – | Law 65-00, CNSS | to\_validate |
| TFP, employer | 1.60%, no ceiling | – | CNSS | to\_validate |
| Professional expenses | 35% if SBI ≤ 78,000 a year; else 25% capped at 35,000 a year | 2025-01-01 | CGI art. 59 | to\_validate |
| Family deduction | 600 MAD a year per dependent (50 a month), max 6 (3,600 a year) | 2026-01-01 | Finance law 2026, CGI art. 74 | to\_validate |
| Seniority bonus bands | 5 / 10 / 15 / 20 / 25% after 2 / 5 / 12 / 20 / 25 years | – | Labour Code art. 350 | to\_validate |
| Payroll divisors | 26 days, 191 hours | – | Practice (OT03) | to\_validate |
| Transport and meal exemption ceilings | Not seeded | – | CGI art. 57 | open |

### IR monthly brackets (2025 scale, unchanged for 2026)

| Net taxable income per month (MAD) | Rate | Amount to deduct (MAD) |
| --- | --- | --- |
| 0 to 3,333.33 | 0% | 0 |
| 3,333.34 to 5,000.00 | 10% | 333.33 |
| 5,000.01 to 6,666.67 | 20% | 833.33 |
| 6,666.68 to 8,333.33 | 30% | 1,500.00 |
| 8,333.34 to 15,000.00 | 34% | 1,833.33 |
| Above 15,000.00 | 37% | 2,283.33 |

The annual scale (0 to 40,000 at 0% up to 37% above 180,000) is stored, and the monthly table is derived from it by ÷ 12. Storing both invites drift.

### Golden cases (first four of the test set)

Computed with the steps above and decimal rounding half up per line. G01 matches a published 2026 worked example. They become automated tests in `tests/`, and the expert confirms them before release.

| Case | Inputs | Gross | CNSS | AMO | Prof. exp. | SNI | IR | Net | Employer contrib. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G01 | 10,000 base, no seniority, 3 dependents, full month | 10,000.00 | 268.80 | 226.00 | 2,500.00 | 7,005.20 | 451.56 | 9,053.64 | 1,749.80 |
| G02 | 4,200 base, 3 years (5%), 0 dependents | 4,410.00 | 197.57 | 99.67 | 1,543.50 | 2,569.26 | 0.00 | 4,112.76 | 930.07 |
| G03 | 14,000 base, 7 years (10%), 2 dependents | 15,400.00 | 268.80 | 348.04 | 2,916.67 | 11,866.49 | 2,101.28 | 12,681.88 | 2,403.74 |
| G04 | SMIG 3,422.72, no seniority, 0 dependents | 3,422.72 | 153.34 | 77.35 | 1,197.95 | 1,994.08 | 0.00 | 3,192.03 | 721.84 |

The full set needs at least 20 cases: mid-month hire and exit, unpaid leave, overtime in each band, rest-day and holiday work, exempt allowance above its ceiling, CIMR affiliated, 7 dependents (cap), negative balance at exit, retro salary increase, off-cycle bonus in the same month, severance.

### Declarations content fed by the run

- **CNSS monthly (PP06):** per employee: CNSS number, name, days declared, actual salary, capped salary, allowances; per employer: totals by branch. File format: current Damancom specification \[Open: format from the payroll expert\].
- **IR monthly (PP07):** total IR withheld, taxable base; payment the month after payroll \[To validate: CGI art. 174\].
- **Annual salary declaration (PP08):** per employee year totals from YTD cumulations, filed by the employer before 1 March (CGI art. 79).

Sources consulted for the seed values (secondary, official texts still to be attached in `sources.md`): [Upsilon Consulting, CNSS 2026 rates](https://upsilon-consulting.com/cotisations-cnss-maroc-2026/), [Upsilon Consulting, IR 2026](https://www.upsilon-consulting.com/ir-salarial-bareme-2026-maroc/), [Upsilon Consulting, finance law 2026](https://upsilon-consulting.com/loi-de-finances-2026-au-maroc/), [Ecovis, finance law 2026 note](https://www.ecovis.com/morocco/fr/wp-content/uploads/sites/2/2026/02/Maroc-Loi-de-Finances-2026.pdf), [Dreamjob, IR 2026 worked example](https://www.dreamjob.ma/coaching-emploi/calcul-impot-revenu-ir-maroc/), [Dreamjob, SMIG 2026](https://www.dreamjob.ma/droit-du-travail/smig-maroc/).

## 13. Outputs: payslip, bank file, declarations, SAP posting

Outputs are produced only from a locked run. Each has its own status and log, so "approved", "paid", "declared" and "posted" are never confused.

### Payslip

- **CP-OUT-001** Template per pack (mandatory content) with tenant branding (logo, colours, address). Rendered as HTML, then PDF by Gotenberg, stored in S3 with the run version in the file name.
- **CP-OUT-002** MA mandatory mentions (PP03) \[To validate: Labour Code art. 370\]: employer name, address and CNSS affiliation; employee name, job, employee number, CNSS number; period and pay date; days or hours paid; base salary; each earning with base, rate and amount; gross; each deduction with base and rate; net pay; employer contributions (HR copy only).
- **CP-OUT-003** Delivery (PP02): in self-service for every employee; plus e-mail per tenant setting. \[Proposal: e-mail carries a notification and a link by default; PDF attachment only if the tenant accepts the risk.\] \[Open: employees without a professional e-mail, HR-02 open point 2\]
- **CP-OUT-004** A payslip is never regenerated with different numbers. A correction appears on the next payslip as a retro line.
- **CP-OUT-005** Prototype or template packs print the watermark "SPECIMEN — NOT VALID" (Kawadir v0.5 rule).

### Bank transfer file (PP05)

- **CP-OUT-010** A bank format is an adapter selected per tenant and paying account: fixed-width or CSV layout, encoding, header and trailer, control totals. First format: SMG's bank (prerequisite P08). \[Open: bank and format\]
- **CP-OUT-011** Pre-checks: every employee has a valid bank account (MA RIB of 24 digits with its key check \[To validate\]), net > 0, total equals the run's net payable.
- **CP-OUT-012** Payment status: `prepared` (file generated), `sent` (downloaded or transmitted, user logged), `confirmed` (HR confirms the bank statement). Expense reimbursements in the run become "paid" only at `confirmed`.

### Declaration files (PP06 to PP08)

- **CP-OUT-020** Generators live in the pack (`outputs/declarations`) and carry the version of the official specification they implement. A file is produced with control totals and a validation report.
- **CP-OUT-021** CPeople prepares files; the client files and pays (CNSS before the 10th of the next month, IR the month after payroll, annual declaration before 1 March).
- **CP-OUT-022** Each declaration has a status (`draft`, `generated`, `filed` with reference, `paid`) entered by HR, and a reminder before its legal date.

### Payroll posting to SAP (PP09)

One journal entry per locked run and legal entity, split by cost centre, balanced, through the standard API.

| Line | Debit/credit | Default account (CGNC, Kawadir v0.5) | Split |
| --- | --- | --- | --- |
| Salaries and allowances | Debit | 61711000 | Cost centre |
| Employer social charges | Debit | 61741000 | Cost centre |
| Expense reimbursements | Debit | 61430000 | Cost centre |
| Net salaries payable | Credit | 44320000 | – |
| CNSS, AMO, family allowances, TFP payable | Credit | 44410000 | – |
| IR withheld payable | Credit | 44525000 | – |
| CIMR payable | Credit | 44430000 | – |

- **CP-OUT-030** GL mapping is tenant configuration: wage type `glKey` → account, with optional split by employee category. The real accounts come from the finance design (FIN-04). \[Open\]
- **CP-OUT-031** S/4HANA Cloud: `JournalEntryBulkCreateRequest` over SOAP, communication scenario SAP\_COM\_0002. Company code, document type, posting date = period end, reference = `PAIE <period>`, cost centre per line. Field names and mandatory fields must be checked against the customer's release before go-live.
- **CP-OUT-032** SAP Business One: Service Layer `POST /JournalEntries`. Other ERP: CSV export with the same lines.
- **CP-OUT-033** Controls: debit = credit to the cent before sending; message ID = run ID + version (idempotency, no double posting); the ERP document number is stored; errors go to a queue with retry; a posted run can be reversed by a reversal message, never deleted.
- **CP-OUT-034** Credentials for SAP live in the server secret store per tenant and environment, never in code or configuration bundles.

## 14. Expenses and performance

Expenses reach payroll as non-taxable reimbursements. Performance is a new module for the next demo (D20). Its scope below is a proposal for Nouamane to confirm with SMG.

### Expenses

- **CP-EXP-001** Claim: date, category, amount, currency, description, receipt file. Categories are tenant configuration (starter: transport, meals, lodging, supplies, other), each with an optional per-claim limit and a "receipt mandatory above" amount.
- **CP-EXP-002** Workflow: N+1 then HR, or N+1 only (tenant setting). Rejection needs a reason.
- **CP-EXP-003** Approved claims dated before the cut-off go into the next regular run as a non-taxable reimbursement wage type. A claim is linked to the run that includes it. It becomes "paid" only when the payment batch is confirmed (Kawadir v0.5 rule).
- **CP-EXP-004** Foreign currency claims are converted at the rate of the claim date, from a tenant rate table. \[Proposal\]
- **CP-EXP-005** Expenses post to the expense GL line by cost centre (section 13).

### Performance (next demo version) \[Proposal\]

| Object | Content |
| --- | --- |
| Review cycle | Name, period (annual by default, optional mid-year), population (legal entity, org unit, category), phases with dates: goal setting, mid-year check-in, self-review, manager review, HR calibration, sign-off |
| Goal plan | Goals per employee: title, description, measure, target, weight (total 100%), due date, status; optional link to a parent goal of the org unit |
| Competency catalogue | Competencies per job family with behaviour descriptions FR/EN; tenant configuration with a starter set |
| Rating scale | Tenant-defined, 1 to 5 by default, with labels |
| Review form | Sections: goals (rating + comment), competencies (rating + comment), overall rating, development actions, employee comment, signatures |

- **CP-PRF-001** The cycle follows the workflow engine: employee self-review, then manager review, then HR, with dates and reminders.
- **CP-PRF-002** Visibility: employees see their own form after manager sign-off; managers see their direct and indirect reports; HR sees all. Calibration notes are HR only.
- **CP-PRF-003** Overall rating can feed a performance bonus as a payroll input (wage type quantity or amount per rating), exported to an off-cycle or regular run after HR approval. No automatic pay change without approval.
- **CP-PRF-004** Results are kept per cycle and shown in the employee file history. Reports: completion rate per phase, rating distribution per org unit (groups under 3 people hidden).
- **CP-PRF-005** The demo scope is goal setting plus the annual review for SMG. Calibration and the link to bonuses follow after SMG confirms the process.

## 15. Security, roles, workflow and audit

Access is role-based with a target population and field groups, enforced in the API and the database. Approvals run on one generic workflow engine. Every action lands in an append-only audit log.

### Roles (starter set)

| Role | Population | Field groups | Key rights |
| --- | --- | --- | --- |
| Platform admin (ConSAP) | Tenants, packs | None of tenant data | Create tenants, release packs, feature flags |
| ConSAP consultant | Assigned tenants, Dev & Test; Prod only with consent | Configuration | Edit configuration, run imports in Dev & Test |
| ConSAP support | Tenant by consent, time-boxed | Configuration, audit without data | Read only (Kawadir v0.5 support rule) |
| Tenant admin | Whole tenant | Directory only, no pay, no IDs | Users, roles, configuration, modules |
| HR manager | Assigned legal entities | All, including health | Approve payroll, salary changes, final leave approval, reveal sensitive data (D03) |
| HR officer | Assigned legal entities | All except health (configurable) | Maintain files, run payroll simulation and calculation, prepare declarations (PP02) |
| Manager | Direct and indirect reports | Job, org, leave, time; no pay, no IDs | Approve leave, overtime, expenses; correct anomalies |
| Employee | Self | Own data; own base salary per tenant setting (CP-EMP-009) | Requests, own documents and payslips |
| Finance viewer | Assigned legal entities | Payroll totals, posting | View journal entries and totals by cost centre |
| Auditor | Assigned scope | Read only | Audit log and reports |

- **CP-SEC-001** A permission = action × object × population × field group. Roles are bundles of permissions. Platform roles are locked; tenants copy and adapt them (EXTEND).
- **CP-SEC-002** Field groups: identity, personal, sensitive IDs (national ID, social number, bank), family, compensation, payroll results, health, performance. The API removes fields the caller may not see; the browser never receives them.
- **CP-SEC-003** Tenant isolation: tenant ID taken only from the Keycloak token; PostgreSQL row-level security on every table, app user without bypass rights, fail closed, proved by tests (already built, PR #1 and #2).
- **CP-SEC-004** Sign-in by Keycloak: e-mail, password, lockout after 5 failures, reset by e-mail. MFA (authenticator app) is mandatory for HR, payroll, tenant admin and ConSAP roles (PP10). Password rules and lockout thresholds: \[Open: SMG IT, Mr. Vinoth\].
- **CP-SEC-005** Employees without a professional e-mail \[Open: HR-02 open point 2\]. Options to decide: (a) personal e-mail with verification, (b) username = employee number plus SMS or authenticator code, (c) no self-service, payslips via HR. Option (b) needs an SMS provider.
- **CP-SEC-006** Session timeout after inactivity (tenant setting, default 30 minutes, Kawadir v0.5). SSO with Microsoft Entra ID or Google comes after MVP.
- **CP-SEC-010** Segregation of duties: the person who calculates payroll cannot approve it; the requester of a salary change or configuration change cannot approve it.
- **CP-SEC-011** Delegation: a user can delegate approvals for dates to another user with the same or a higher role; both names are recorded on each approval.
- **CP-SEC-012** A user account need not be an employee of the payroll's legal entity (D10). Approval rights come from the workflow resolver, not from payroll membership.

### Workflow engine

- **CP-WFL-001** One engine for all processes: leave, overtime, expense, salary change, personal data change, contract, configuration change set, payroll approval, performance phases.
- **CP-WFL-002** A process definition is an ordered list of steps. Each step has a resolver (`N+1`, `N+2`, `ROLE_IN_SCOPE(HR_MANAGER)`, `USER(id)`, `GROUP(id)`), an optional condition (for example amount > X, leave > Y days), a due time, a reminder and an escalation target.
- **CP-WFL-003** If a resolver finds nobody (no manager), the step goes to the fallback (HR by default) and the history says why.
- **CP-WFL-010** SMG default for every leave type: N+1, then HR final approval (D04). Expenses: N+1, then HR. Salary change: HR manager. Payroll: HR officer calculates, HR manager approves (PP02).
- **CP-WFL-011** Every decision stores user, role, time, decision, reason, and the delegate if any. Rejection always needs a reason; for leave, approval also needs one (D12).
- **CP-WFL-012** Notifications in-app and by e-mail for pending items, reminders, decisions and approaching deadlines. Templates per language.

### Audit and data protection

- **CP-SEC-020** Audit log is append-only: who, role, tenant, time, action, object, before and after values (sensitive values masked), source IP, request ID. Each entry stores the hash of the previous one (tamper-evident chain). No update or delete rights exist on the table.
- **CP-SEC-021** Logged reads: reveal of a sensitive field, view of a payslip, health document or salary of another person, every support session.
- **CP-SEC-022** Retention classes per object (for example payroll records and payslips kept for the legal period, applicant data deleted after a set time). \[Open: retention periods by the data-protection adviser\]
- **CP-SEC-023** Law 09-08: CNDP declaration (and authorisation where required) before production use, filed by the client as controller with ConSAP as processor. \[Open: tech guide decision list\]
- **CP-SEC-024** Data subject rights: an employee can download their personal data; HR can anonymise a former employee after the retention period, keeping payroll totals.

## 16. AI assistant

The assistant answers questions within the user's own permissions and drafts configuration proposals. It never applies a change, never touches statutory rules or pay data, and never decides compliance. This keeps the Kawadir v0.5 flow: request, structured draft, issues, impact, separate approval, versioned apply, rollback.

### Capabilities

| Mode | Example | Who | Result |
| --- | --- | --- | --- |
| Ask | "How many leave days do I have?", "What is waiting for my approval?", "Is November payroll ready?" | Everyone, within their own scope | Answer built only from API calls made with the user's token |
| Explain | "Why is my IR higher this month?" | Employee for self; HR | Reads the payslip lines and rule references (CP-PAY-005) and explains them; no new calculation |
| Propose configuration | "From 1 Jan 2027, give 2 extra leave days to Casablanca staff after 5 years" | HR, tenant admin | A configuration change set in Draft, with issues and an impact simulation |
| Help | "How do I add a contract template?" | Everyone | Answer from the product guide |

### Guardrails

- **CP-AI-001** Tools only: the model calls a fixed list of API functions (read tools, plus one tool `draftChangeSet`). It has no database access and no free HTTP access.
- **CP-AI-002** Every tool call runs with the end user's token. The assistant can never see more than the user can.
- **CP-AI-003** Allow-list for proposals (v1): company leave days above the floor, company holidays, onboarding tasks, lateness tolerance, expense categories, notification texts. Anything else is answered "not allowed from the assistant" with the reason.
- **CP-AI-004** Always refused: statutory values (rates, brackets, minimum wage, overtime premiums), pay or bank data changes, approvals, other tenants' data, requests to skip approval (Kawadir v0.5 rejection cases).
- **CP-AI-005** Ambiguous requests are deferred with the list of missing items (population, date, days, condition), never guessed.
- **CP-AI-006** A proposal goes through the normal change lifecycle (section 6). It is validated again by code before activation; the approver must be a different person.
- **CP-AI-007** Prompt-injection defence: text from documents, comments or imported files is passed as data, never as instructions; tool outputs are schema-checked.
- **CP-AI-008** Logging: question, tools called and decision are logged; payroll amounts and IDs are masked in AI logs.

### Data residency

- **CP-AI-010** Personal data must not leave Morocco without a lawful basis under law 09-08 (D21). Options: (a) a model hosted in a Moroccan region, (b) a foreign model API with pseudonymised context and a CNDP transfer authorisation, (c) Ask and Help only on non-personal data. \[Open: model provider choice, together with the hosting decision\]
- **CP-AI-011** The assistant can be switched off per tenant. It is off by default until the tenant admin enables it and accepts the data terms.
- **CP-AI-012** Evaluation: a test set of at least 50 questions and 20 configuration requests (allowed, refused, ambiguous) runs on every model or prompt change, with expected decisions.

## 17. Integrations, APIs, non-functional requirements and hosting

All screens use the same REST API that integrations use. Outbound links (devices, SAP, bank, e-mail) are adapters behind the job queue. Production runs in Morocco on two servers.

### API conventions

- **CP-INT-001** REST under `/api/v1`, described by OpenAPI generated from the NestJS modules. Resource groups: organisation, employees, contracts, documents, time, leave, expenses, payroll, payslips, declarations, accounting, performance, workflow, configuration, packs (read), admin, audit.
- **CP-INT-002** Every write accepts an `Idempotency-Key` header. Lists are paginated with cursors. Dates are ISO 8601; money is a decimal string with its currency.
- **CP-INT-003** Domain events are written to an outbox table and published to the queue: `employee.hired`, `employee.changed`, `employee.exited`, `leave.approved`, `time.periodClosed`, `payroll.locked`, `payment.confirmed`, `posting.done`, `config.activated`. Webhooks to client systems come after MVP.
- **CP-INT-004** Client API access (after MVP): OAuth client credentials per tenant, scoped to permissions like a user role.

### Integration catalogue

| System | Direction | Method | MVP | Status |
| --- | --- | --- | --- | --- |
| ZKTeco biometric devices | In | Device or platform API, nightly or near real time | Yes | \[Open: model, API docs, existing platform, HR-02 actions 3 to 6\] |
| Device export file | In | Excel or CSV upload with saved mapping | Yes | \[Open: SMG sample\] |
| SAP S/4HANA Cloud | Out | Journal Entry – Post, SOAP, SAP\_COM\_0002 | Yes | Communication arrangement to set with finance |
| SAP Business One | Out | Service Layer | For B1 clients | – |
| Bank | Out | Salary transfer file | Yes | \[Open: bank and format, P08\] |
| CNSS / DGI | Out | Declaration files for manual upload | Yes | \[Open: official formats\] |
| E-mail | Out | Transactional provider (Mailpit locally) | Yes | \[Open: provider\] |
| Keycloak | In/Out | OIDC | Yes | Built |
| Microsoft Entra ID / Google | In | SSO through Keycloak | After MVP | – |

### Non-functional requirements \[Proposal unless stated\]

| ID | Area | Target |
| --- | --- | --- |
| CP-NFR-001 | Screen response | 95% of page loads under 2 s for 500 employees |
| CP-NFR-002 | Payroll run | 200 employees calculated in under 2 min; 2,000 in under 15 min, in the background |
| CP-NFR-003 | Availability | 99.5% monthly in business hours (Morocco time); maintenance announced 48 h ahead |
| CP-NFR-004 | Backup | Daily database and file backups kept in a second Moroccan site (tech guide); restore tested every quarter |
| CP-NFR-005 | Recovery | Recovery point ≤ 24 h, recovery time ≤ 8 h; to tighten with point-in-time recovery once the provider is chosen |
| CP-NFR-006 | Encryption | TLS 1.2+ in transit; disk and backup encryption at rest; documents encrypted in S3 |
| CP-NFR-007 | Secrets | Per environment, in a secret store on the server, never in Git (tech guide) |
| CP-NFR-008 | Observability | Structured logs without personal data, metrics, alerts on job failures, posting errors and backup failures |
| CP-NFR-009 | Security testing | Dependency scanning in CI; external penetration test before SMG go-live |
| CP-NFR-010 | Accessibility | WCAG 2.1 AA for self-service screens |
| CP-NFR-011 | Languages | FR and EN at go-live; AR with right-to-left after MVP (layout already uses start/end) |
| CP-NFR-012 | Devices | Latest two versions of Chrome, Edge, Safari, Firefox; responsive down to phone width for self-service |
| CP-NFR-013 | Scale | Designed for 50 tenants and 20,000 employees on the modular monolith before any service split |

### Environments and hosting (D18, D21)

| Environment | Address | Data | Server |
| --- | --- | --- | --- |
| Local | localhost:3000 | Fake | Developer PC (Docker Compose) |
| Dev | dev.cpeople.ma | Fake | Server 1 (shared with Test) |
| Test | test.cpeople.ma | Anonymised or synthetic test data | Server 1 |
| Prod | app.cpeople.ma | Real | Server 2, alone |

- **CP-NFR-020** Test and Prod are hosted in Moroccan data centres. \[Open: provider and budget. Options on the table: Moroccan VPS (tech guide proposal) or the Oracle Cloud Casablanca region\]
- **CP-NFR-021** No real employee data in Dev or Test. SMG's sample for unit tests is anonymised (HR-01 open point 7).
- **CP-NFR-022** Code reaches Dev after each merge, Test when a release is tagged, Prod after SMG signs off on Test (tech guide). Database migrations run through Prisma, forward only, tested on a copy of Prod structure.

## 18. Tenant implementation, migration and testing

A new client goes live through a guided wizard, a validated data load, a parallel payroll and a signed cutover. Nothing reaches Production without passing the golden payroll tests and the client's acceptance.

### Onboarding wizard (from Kawadir v0.5, 17 steps in 5 phases)

| Phase | Steps | Exit criterion |
| --- | --- | --- |
| Preparation | 1 Company and legal entity · 2 Country, currency, language, time zone | Tenant created in Dev & Test with its country packs |
| Setup and migration | 3 Organisation · 4 Schedules · 5 Modules · 6 Roles and users · 7 Country pack status acknowledged · 8 Import templates · 9 Import preview · 10 Missing, duplicate, invalid lines · 11 Leave and approvals · 12 ERP and mapping checklist | All import lines valid or explained; configuration change sets approved |
| Testing | 13 Connection tests (devices, SAP, e-mail) · 14 Test data and reconciliation | Parallel payroll differences explained; key users trained |
| Cutover | 15 Client owner sign-off · 16 Cutover checklist | Final import done, balances loaded, access reviewed, rollback plan ready |
| Support handover | 17 Knowledge transfer, service levels, contacts, hypercare | Hypercare dates fixed |

- **CP-IMP-001** The wizard state is saved per tenant and maps to the implementation activities (CP-CFG-012). Steps can be done in any order, but sign-off needs steps 7, 10, 13 and 14 complete (Kawadir v0.5 rule).
- **CP-IMP-002** A "weeks" target for go-live is a goal to measure, not a promise. It depends on scope, data quality and client availability (Kawadir v0.5 wording, kept).

### Migration objects (SMG HR data collection template)

| Object | Template ref | Notes |
| --- | --- | --- |
| Organisation, departments, cost centres | HR-01 action 1 | Before employees |
| Employees, assignments, compensation | H-series, D02 employee number | Anonymised sample first, real data through the restricted folder |
| Seniority start date | H07 | Drives seniority bonus and leave increase |
| Dependents | H10 | IR family deduction |
| Company pay elements | H12 | Become tenant wage types with a treatment class |
| Leave balances at go-live | H13 (31 Jan 2027) | One bucket per year of origin |
| Salary advances and loans | H14 | Remaining balance and monthly instalment |
| Year-to-date payroll figures 2027 | H15 | Opening YTD cumulations |

- **CP-IMP-010** Each object loads through the import engine (CP-EMP-040) with a control report: rows read, loaded, rejected, and control totals (headcount, sum of base salaries, sum of balances).
- **CP-IMP-011** Parallel payroll: at least one month calculated in CPeople and compared with the client's current payroll per employee and per wage type. Every net difference above 1 MAD is explained and signed off. \[Proposal\]

### Test levels

| Level | What | Tool | Gate |
| --- | --- | --- | --- |
| Unit | Rules DSL, leave accrual, time evaluation, guardrails, resolution service | Vitest/Jest | CI on every pull request |
| Tenant isolation | Row-level security fail-closed tests on every new table | Existing test suite (PR #1) | CI, blocking |
| Golden payroll | At least 20 cases per pack with expected lines to the cent (section 12) | Pack `tests/` folder | CI; pack load refused if red |
| Integration | ZKTeco adapter with recorded samples; SAP posting against a sandbox; bank file against the bank's validator | Test doubles + Test environment | Before release tag |
| End-to-end | Hire to payslip, leave request to payroll, overtime to payroll, exit to final pay, in FR and EN, desktop and phone | Playwright | Before release tag |
| Performance | CP-NFR-001 and 002 on 2,000 synthetic employees | Load script | Before first Prod release |
| Acceptance | One script per SMG accelerator line (section 19), run by SMG key users in Test | Test scripts | SMG sign-off before Prod |

- **CP-TST-001** A requirement is done when code, tests, FR/EN labels, permissions, audit entries and the OpenAPI description exist, and its acceptance script passes.

## 19. Traceability: SMG accelerator lines to CPeople requirements

All 85 lines of the HR configuration accelerators v0.2 are covered. 43 are approved, 4 were rejected and changed by SMG, and 38 are still open with SMG. Each line also needs an acceptance script (CP-TST-001).

| Ref | Item | SMG status (24 Nov 2026) | Where in this spec |
| --- | --- | --- | --- |
| LV01 | Annual paid leave | Approved | §9 content table, accrual algorithm |
| LV02 | Seniority increase of leave | Approved | §9 accrual step 4 |
| LV03 to LV09 | Family-event and birth leave | Approved | §9 content table |
| LV10 | Maternity | Approved; employer top-up on hold | §9, D16 |
| LV11 | Breastfeeding time | Approved | CP-TIM-012 |
| LV12 | Unpaid child-raising leave | Approved | §9 content table |
| LV13 | Sick leave | Approved | CP-LEA-030, CP-LEA-050 |
| LV14 | Work accident | Approved | §9 content table |
| LV15 | Unpaid leave | Approved | CP-PAY-050 |
| LV16 | Compensatory rest | Approved | CP-TIM-036 |
| LV17 | Other exceptional leave | Approved; days from SMG manual | §9, open point O1 |
| LR01 | Unit of count | Approved, with rest-day comment | CP-LEA-010, CP-LEA-011, CP-TIM-010 (D13) |
| LR02 | Monthly accrual | Approved | §9 accrual step 5 |
| LR03 | Leave year | Approved | §9 accrual |
| LR04 | Splitting | Approved | `minContinuousBlock` (§9) |
| LR05 | Carry-over | Approved | §9 accrual step 8 |
| LR06 | Negative balance | **Rejected: allowed, not blocked** | CP-LEA-040 (D11) |
| LR07 | Half days | Approved | CP-LEA-012 |
| LR08 | Request lead time | Approved | CP-LEA-021 |
| LR09 | Approval flow | Approved | CP-LEA-022, CP-WFL-010 (D04) |
| LR10 | Reasons | **Rejected: mandatory, visible to employee** | CP-LEA-050 (D12) |
| LR11 | Supporting documents | Approved | CP-LEA-030 |
| LR12 | Annual leave plan | Approved; product function to confirm | CP-LEA-070 |
| LR13 | Leave pay | Approved | CP-LEA-081 |
| LR14 | Unused leave at exit | Approved | CP-LEA-082, CP-PAY-071 |
| LR15 | Public holiday calendar | Approved | §6 catalogue, §7 calendar |
| LR16 | Approvers outside Morocco payroll | Approved | CP-SEC-012 (D10) |
| AT01 | Legal working time | Open | CP-TIM-011 |
| AT02 | Weekly rest | Open | CP-TIM-011 |
| AT03 | ZKTeco API | Open (decided in HR-02) | CP-TIM-001 (D09) |
| AT04 | Fallback file and manual | Open (decided in HR-02) | CP-TIM-001 (D09) |
| AT05 | Employees without biometric | Open (decided in HR-02) | §10 sources (D08) |
| AT06 | Employee number | Open (decided in HR-01) | CP-EMP-002 (D02) |
| AT07 | Anomalies | Open | CP-TIM-020, CP-TIM-021 |
| AT08 | Lateness tolerance | Open | §10 evaluation step 3 |
| AT09 | Payroll cut-off | Open (25th decided) | CP-TIM-040 (D05) |
| AT10 | Ramadan hours | Open | CP-TIM-012 |
| AT11 | Night work | Open | §10 evaluation step 4 |
| OT01 | Overtime definition | Open | CP-TIM-030 (D06) |
| OT02 | Premiums | Open | CP-TIM-031 |
| OT03 | Hourly rate | Open | CP-TIM-032 |
| OT04 | Annual quota | Open | CP-TIM-033 |
| OT05 | Approval | Open | CP-TIM-034 |
| OT06 | Public holiday work | Open | CP-TIM-035 |
| OT07 | Pay or compensatory rest | Open | CP-TIM-036 |
| PE01 | Base salary and minimum wage | Open | §11 checks, §12 step 1 |
| PE02 | Seniority bonus | Open | §12 step 2 |
| PE03 | Overtime | Open | §12 step 3 |
| PE04 | Transport allowance | Open | §12 step 5, ceiling open |
| PE05 | Meal allowance | Open | §12 step 5, ceiling open |
| PE06 | Cashier allowance | Open | Tenant wage type (§11) |
| PE07 | Sales incentive | Open | Tenant wage type, imported input |
| PE08 | Bonuses | Open | CP-PAY-070 |
| PE09 | Advances and loans | Open | §12 step 16, H14 |
| PE10 | Exit pay | Open | CP-PAY-071 |
| CT01 | CNSS | Approved | §12 steps 9 and 17 |
| CT02 | Family allowances | Approved | §12 step 17 |
| CT03 | AMO | Approved | §12 steps 10 and 17 |
| CT04 | TFP | Approved | §12 step 17 |
| CT05 | CIMR | **Rejected: not used now** | Inactive for SMG (D14) |
| CT06 | Mutuelle | **Rejected: not used now** | Inactive for SMG (D15) |
| CT07 | IR | Approved | §12 steps 14 and 15 |
| CT08 | Professional expenses | Approved | §12 step 12 |
| CT09 | Family deductions | Approved | §12 step 15 |
| CT10 | ANAPEC | Approved | §8 contracts |
| CO01 to CO04 | Contract types | Approved | §8 contracts, CP-CON-001 to 004 |
| PP01 | Payroll calendar | Open | CP-TIM-040, PayrollArea (§5) |
| PP02 | Run and approval | Open | CP-WFL-010, CP-OUT-003 |
| PP03 | Payslip content | Open | CP-OUT-002 |
| PP04 | Off-cycle runs | Open | CP-PAY-070 |
| PP05 | Bank file | Open | CP-OUT-010 to 012 |
| PP06 | CNSS declaration | Open | CP-OUT-020, §12 declarations |
| PP07 | IR withheld | Open | CP-OUT-020, §12 declarations |
| PP08 | Annual declaration | Open | CP-PAY-080 |
| PP09 | Posting to S/4HANA | Open | CP-OUT-030 to 034 |
| PP10 | Access security | Open | CP-SEC-004, CP-SEC-005 |

## 20. Open points and build sequence

22 points are still open. Eight of them (O1 to O3, O6, O11, O12, O13, O17) block the MA pack or the SMG configuration. The rest can be built around with configurable defaults. O14, O15 and O16 were raised by this spec, not by the workshops.

| # | Open point | Owner | Due | Blocks | Status |
| --- | --- | --- | --- | --- | --- |
| O1 | SMG leave manual: types and days above the legal minimum | Mr. Hassam Mahmood | 26 Nov 2026 | LV17, tenant leave policy | Open |
| O2 | Cut-off boundaries (26–25 or 25–24) and pay date | Mr. Hassam Mahmood | 26 Nov 2026 | Payroll calendar | Open |
| O3 | Legal lines marked "to validate" and every 2026 rate row in §12 | Mr. Otmane with SMG's accountant | 2 Dec 2026 | Production payroll | Open |
| O4 | Overtime and holiday work: pay or compensatory rest | Mr. Hassam Mahmood | HR-03 | CP-TIM-036 | Open |
| O5 | Approvers paid outside the Morocco company | Mr. Otmane, Mr. Hassam Mahmood | FIN-04 | CP-SEC-012 | Open |
| O6 | Product functions: annual leave plan, yearly holiday load, leave reason visibility, sign-in without professional e-mail | Nouamane Lahlal | 26 Nov 2026 | CP-LEA-070, CP-SEC-005 | Open |
| O7 | Employees' visibility of their own base salary | Mr. Hassam Mahmood | HR-02 follow-up | CP-EMP-009 | Open |
| O8 | Employee number format and uniqueness from the devices | Mr. Hassam Mahmood, Mr. Saleem | HR-02 follow-up | CP-EMP-002 | Open |
| O9 | Document types and expiry alerts | Mr. Hassam Mahmood | 25 Nov 2026 | CP-EMP-031 | Open |
| O10 | Contract templates (CDI, CDD, ANAPEC, temporary) and trial periods | Mr. Hassam Mahmood, Mr. Otmane | 25 Nov 2026 | CP-CON-002, CP-CON-003 | Open |
| O11 | Department to cost centre mapping and payroll GL accounts | Mr. Otmane | FIN-04 / HR-03 | CP-OUT-030 | Open |
| O12 | ZKTeco model, API documentation, export sample, exempt employees | Mr. Vinoth, Mr. Saleem, Mr. Hassam Mahmood | 26 Nov 2026 | CP-TIM-001 | Open |
| O13 | Bank and salary file format | SMG finance | P08 | CP-OUT-010 | Open |
| O14 | Leave counting basis: 6-day legal week or scheduled days for 5-day staff | Mr. Hassam Mahmood with SMG's accountant | HR-03 | CP-LEA-011 | Open |
| O15 | Professional expenses: base (SBI or gross) and no cap on the 35% band | Payroll expert | Before MA pack validation | §12 step 12 | Open |
| O16 | Elements in the overtime and seniority bases | Payroll expert | Before MA pack validation | CP-TIM-032, §12 step 2 | Open |
| O17 | Transport and meal exemption ceilings; Damancom and IR file formats | Payroll expert | Before MA pack validation | PE04, PE05, CP-OUT-020 | Open |
| O18 | Hosting provider in Morocco and budget | ConSAP owner | Before Test environment | CP-NFR-020 | Open |
| O19 | CNDP declaration before go-live | ConSAP with a data-protection adviser; SMG as controller | Before Prod | CP-SEC-023 | Open |
| O20 | Password rules and lockout thresholds | Mr. Vinoth | Next IT workshop | CP-SEC-004 | Open |
| O21 | AI model provider and data residency | ConSAP owner | Before enabling the assistant | CP-AI-010 | Open |
| O22 | Transactional e-mail provider | ConSAP owner | Before Test environment | CP-OUT-003 | Open |

### Build sequence \[Proposal\]

The order follows dependencies: configuration before modules, time and leave before payroll, golden tests before outputs. It continues from the tech guide's "Next" list (home page, tenant creation).

1. **Configuration core:** object registry, guardrails, resolution service, change sets, audit chain; tenant creation command assigning the MA pack (section 6).
2. **Country pack loader:** manifest, status rules, rate tables with sources, MA fields, calendar and contracts; Platform Console pack page (section 7).
3. **Organisation and employee file:** effective-dated objects, events, field groups, documents, import engine with SMG templates (sections 5 and 8).
4. **Workflow engine and leave:** process definitions, resolvers, delegation; leave types, accrual, balances, requests, team calendar (sections 9 and 15).
5. **Time:** file and manual adapters first, ZKTeco adapter when O12 is answered; schedules, evaluation, anomalies, overtime approval, period close (section 10).
6. **Payroll engine and MA schema:** rules DSL with decimals, wage types, bases, run lifecycle, checks, proration, golden tests G01 to G20 (sections 11 and 12).
7. **Outputs:** payslip PDF, self-service delivery, bank file, declaration files, S/4HANA posting (section 13).
8. **Retro, off-cycle and exit pay** (CP-PAY-060 to 071).
9. **Client Admin Centre and onboarding wizard**, then expenses (sections 6, 14, 18).
10. **Performance demo scope**, then the AI assistant behind its tenant switch (sections 14 and 16).
11. **Go-live readiness:** hosting, CI/CD to Dev, Test and Prod, penetration test, SMG migration, parallel payroll, acceptance scripts, cutover (sections 17 and 18).
