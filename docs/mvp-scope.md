# CPeople — SoW conflicts and MVP scope

Version 0.3 · 26 November 2026 · Draft for the ConSAP business developer, Youssef and the ConSAP owner

**Decisions recorded (17 Nov 2026):**
1. **CPeople is the official product name.** It replaces "ConSAP HR & Payroll" in the SMG documents.
2. **Client requirements are fixed scope.** Everything stated as a client requirement stays in the MVP; nothing is cut. Later changes come through change requests, and the plan is adjusted then.

**Decisions recorded (26 Nov 2026), by the project owner:**
3. **The scope is aligned with the CPeople functional and technical specification v0.1** (`docs/specs/CPeople-functional-technical-spec.md`), which is built from the HR-01 and HR-02 workshop minutes and the HR configuration accelerators v0.2. Where this file and the spec disagree, this file wins for scope and the spec wins for the detailed rules.
4. **Leave approval follows HR-02 decision 1:** the line manager (N+1), then HR. The second approver is a setting (HR or N+2), so other clients keep N+2.
5. **CPeople is configured, not coded, per client and per country** (GRP-01): a layered configuration framework (M26) and country localisation templates that ConSAP can configure or import (M27).
6. **Moved into the MVP:** the salary transfer file (M28, accelerators PP05 and prerequisite P08) and the performance module for SMG's next demo (M29, SMG request). Whether SMG pays for them as change requests or they are absorbed is a commercial decision for the owner; the build does not wait for it.

**Sources:** `ConSAP_SMG_S4HANA_Project_Team_Pack_Internal.pdf` (v1.0, 16 Nov 2026), referred to here as **TP**; `ConSAP_SMG_Area_Guide_HR_Payroll.pdf` (**HRG**); `ConSAP_SMG_Area_Guide_Integration_Migration.pdf` (**IMG**); `ConSAP_SMG_Area_Guide_Finance_Controlling.pdf` (**FIG**); `CLAUDE.md` §4 (architecture).
**Caveat:** the signed SoW is not in the project. TP section A2 summarises it and is used as the source of truth until the SoW is added.

---

## 1. Requirement register

TP numbers its A1 and A2 lines but not its part C lines, so the HR, PAY, IMP and OPS IDs below are new labels. Adopt them, or replace them with the SoW's own numbering when the SoW arrives.

| ID | Requirement | Source |
|---|---|---|
| SOW-07 | Moroccan payroll integration: ConSAP HR & Payroll included | TP A2 #07 |
| SOW-08 | Payroll accounting: automated payroll posting in SAP S/4HANA by cost centre | TP A2 #08 |
| SOW-10 | Testing and approval: end-to-end tests, user acceptance, go / no-go | TP A2 #10 |
| REQ-14 | Moroccan payroll live at go-live, posted automatically in S/4HANA by cost centre | TP A1 #14 |
| HR-01 | Employee record (matricule, ID, CNSS number, job, department, cost centre, hire date, salary, dependents, bank details); onboarding checklist; documents with expiry tracking; organisation chart | TP C1 |
| HR-02 | Contracts generated from the template of each contract type (CDI, CDD, others) with default clauses, from an HR form | TP C1 |
| HR-03 | Worked days, overtime (and weekend days, HRG) received from time and attendance devices via API or export file | TP C1, HRG §01 |
| HR-04 | Leave rights under Moroccan law and the contract; leave types; N+1 then N+2 approval (changed by HR-02 decision 1 to N+1 then HR); approved days deducted from the payroll month; public holiday calendar | TP C1, HRG §01, HR-02 minutes |
| HR-05 | Moroccan payroll | TP C1 |
| HR-06 | CNSS declaration data for Damancom and IR data, each month | TP C1 |
| HR-07 | Payroll journal checked (debit = credit), then posted automatically in S/4HANA by cost centre through the standard journal entry API | TP C1 |
| HR-08 | Hosted by ConSAP; each client's data kept separate; web link access with personal credentials; roles administrator, HR, manager, employee; sign-in policy | TP C1, HRG §01 |
| PAY-01 | Salary, seniority bonus, overtime, allowances (travel, weekend work, leave pay); SMG pay elements (commission, weekend premium, transport, meal allowance) | TP C2, HRG §01 |
| PAY-02 | CNSS, AMO, CIMR, professional expenses and IR under the current finance law | TP C2 |
| PAY-03 | Off-cycle runs for exits, adjustments and bonuses; salary history | TP C2 |
| PAY-04 | HR approval, then PDF payslips sent automatically by e-mail | TP C2 |
| IMP-01 | Set-up for SMG: company, departments, cost centres, pay elements, leave rules, contract templates | TP C2 |
| IMP-02 | Migration of employee files and year-to-date payroll figures | TP C2 |
| IMP-03 | Connection to the time and attendance devices (one device type) and to S/4HANA | TP C2, TP E |
| IMP-04 | One parallel run on the last payroll before go-live, compared employee by employee with the current payroll | TP C2, HRG §02 |
| IMP-05 | Training of the HR team and managers | TP C2 |
| OPS-01 | Warranty to 30 Jun 2027: P1 "payroll blocked" response in 2 business hours, fix or workaround in 1 business day | TP 01 |
| GRP-01 | Designed to extend to the Group's other countries | TP C |
| EXP-01 | Expense claims: employee submits, manager approves, reimbursed through payroll | HRG §02, §07 |
| PERF-01 | Performance module (goals and annual review) in the next demo version | SMG request to the project owner, Nov 2026 |
| BANK-01 | Salary transfer file in the format of SMG's bank | HR accelerators v0.2 PP05, prerequisite P08 |
| DEMO | Everything shown in the 15 Nov demo is a commitment: employee file, leave N+1 / N+2, contracts from templates, biometric attendance, payslips by e-mail, CNSS and accounting posting | HRG §02 |
| NEW | Not in the requirements: CPeople product decision | n/a |

---

## 2. Conflicts between the requirements and the planned architecture

Each conflict comes with options. None is resolved here.

### K1 · "Standard product" vs. a product still to be specified (critical)
- **Requirement:** TP part E sells the "standard ConSAP HR & Payroll product, configured" and makes "new product features" a change request; the demo on 15 Nov is a commitment (DEMO). Integration tests start **28 Dec 2026**, and the parallel run happens 11–22 Jan 2027.
- **Architecture:** CLAUDE.md §7 still lists the functional spec, data model and payroll-engine spec as to-do.
- **Why it matters:** about 5 weeks of build (1–24 Dec plus slack) for a full HR and payroll product, including the payroll engine and S/4HANA posting. The SoW leaves no room to call missing features change requests, because they are in scope.
- **Options (scope is fixed, so only time and capacity can move):** (a) confirm what the 15 Nov demo ran on and how much of it is production code, then plan the gap; (b) prepare now to use the 15 Jan checkpoint to move go-live to **1 March 2027** with the full scope (the SoW allows it); (c) add developers now. These can be combined. **Decision:** owner and Youssef, this week.

### K2 · Test holds no real salaries vs. the parallel run and migration need real data
- **Requirement:** IMP-02 (real employee files and YTD figures, two trial loads), IMP-04 (December 2026 payroll recalculated and reconciled employee by employee, before go-live).
- **Architecture:** Test is "test sets or anonymised copies, never real salaries"; only Prod holds real data.
- **Options:** (a) **run the parallel run and the trial loads in a Prod tenant for SMG that is not yet live** (only ConSAP and the SMG HR team have access; reset before the final load) *(recommended: no rule changes, and Prod controls apply)*; (b) classify Test as a real-data environment with Prod-level controls (encryption, MFA, audit, Moroccan hosting, CNDP declaration); (c) anonymise and compare totals only, which does not meet "employee by employee".

### K3 · UAE Group users vs. Moroccan hosting and Law 09-08
- **Requirement:** TP A3 grants access to "the Moroccan team and the Group users in the UAE, with role-based authorizations". It is unclear whether this applies to HR & Payroll or only to S/4HANA.
- **Architecture:** host in Morocco; Law 09-08; CNDP declaration.
- **Why it matters:** UAE users viewing Moroccan employee or salary data is a transfer of personal data abroad, which needs the CNDP's attention (legal point, to be confirmed by a data-protection adviser).
- **Options (the requirement stays):** (a) ask Youssef whether A3 was meant for S/4HANA only; if so, nothing changes for CPeople; (b) if it covers CPeople, deliver UAE access compliantly: include the transfer in the CNDP declaration and get legal validation; (c) use role design to show UAE users only what they need, aggregated where possible.

### K4 · S/4HANA posting API: OData assumed, SOAP is the standard
- **Requirement:** HR-07, SOW-08: post through "the standard journal entry API"; clean core, no custom APIs (TP E).
- **Architecture:** "S/4HANA via standard OData APIs".
- **Fact:** in S/4HANA Cloud Public Edition, journal entries are posted with the SOAP APIs *Journal Entry – Post* (synchronous or asynchronous) under the communication scenario *Finance – Posting Integration* (SAP_COM_0002). An SAP note also says that creating **parked** journal entries through the API is not supported. That matters if SMG finance wants to review the payroll entry in S/4HANA before it posts.
- **Options:** (a) build the S/4HANA Cloud connector on the SOAP service, synchronous for clear errors, with CPeople's own pre-posting check (debit = credit, valid accounts and cost centres) and a posting log; (b) asynchronous plus monitoring in S/4HANA (AIF). Agree the posting granularity and accounts with the finance consultant before build (FIG §08). **Decision:** Youssef.

### K5 · SoW features with no home in the architecture yet
| Feature | Requirement | Proposed home |
|---|---|---|
| Contract generation from templates | HR-02, DEMO | Employees module + document templating (reuse Gotenberg) |
| Documents with expiry tracking, onboarding checklist, org chart | HR-01 | Employees module; a reminder job in BullMQ |
| Attendance device import (API or file, one device type) | HR-03, IMP-03 | New **Integrations / Import** component feeding Time & absence; format still to come from Mr. Vinoth |
| Payslip e-mail delivery | PAY-04, DEMO | E-mail service (transactional SMTP provider to choose); password-protected PDF recommended (personal data, Law 09-08) |
| Off-cycle runs | PAY-03 | Payroll engine: a run type besides the monthly run |
| Year-to-date import | IMP-02 | Migration tool; needed for correct annual IR and the 2027 annual declaration |
| Parallel-run comparison report | IMP-04 | Payroll module: employee-by-employee difference report against an imported legacy file |

These do not contradict the architecture, but they add work to K1. **Decision:** accept them into the MVP (they are committed).

### K6 · CNDP and hosting are on the critical path
- **Requirement:** go-live 1 Feb 2027; real employee data from the trial loads (first by 18 Dec 2026).
- **Architecture:** host in Morocco; declare to the CNDP before go-live; the hosting provider is not yet chosen.
- **Options:** choose the Moroccan hosting provider and file the CNDP declaration **in November**. Have SMG's role (data controller) and ConSAP's role (processor) written into a data-processing clause. To confirm with a data-protection adviser.

### Scope boundaries (applying the fixed-scope rule)
- **Expense claims:** SMG mentioned them and "Expenses" is in the HRG app list → **in the MVP (M25)**. Exact rules to collect in the HR workshop.
- **Weekend work and sales commission:** SMG mentioned both → in the MVP (M10, M11). Commission is entered manually or by file. An automatic feed from the POS or S/4HANA was not requested and would be a new interface (TP E), so it would come only through a change request.
- **Bank transfer file:** not stated as a client requirement (TP C), only listed as a workshop question (HRG §04) → outside the MVP. If SMG asks for it, it comes through a change request.
- **CIMR and private health insurance:** covered as configurable pay elements; rates come from SMG (HRG §04).
- **Product name:** decided. The SMG tenant shows the CPeople brand.
- **Tenant separation:** "each client's data kept separate" is met by row-level security; confirm SMG does not expect a separate database.

---

## 3. Proposed MVP scope (go-live SMG, 1 Feb 2027)

**Principle:** the MVP is everything SMG signed, saw in the demo or stated as a requirement, built on the global core plus the Morocco country pack. Nothing is cut from it, and nothing else goes in before go-live except through a change request.

### 3.1 In the MVP
| # | Feature | Module | Requirement |
|---|---|---|---|
| M01 | Tenant, company, sites, departments, cost centres | Organisation | HR-08, IMP-01 |
| M02 | Users and roles (administrator, HR, payroll manager, manager, employee), sign-in policy, MFA for admin and payroll roles | Administration | HR-08 |
| M03 | Employee record with Moroccan identifiers (CIN, CNSS), dependents, RIB, job, manager, cost centre; salary history | Employees | HR-01, PAY-03, DEMO |
| M04 | Employee documents with expiry dates and reminders | Employees | HR-01 |
| M05 | Onboarding checklist | Employees | HR-01 |
| M06 | Organisation chart (read-only, from manager links) | Employees | HR-01 |
| M07 | Contract templates (CDI, CDD, others) and contract generation (PDF) from an HR form | Employees | HR-02, DEMO |
| M08 | Leave types, Moroccan legal entitlement plus contract rules, public holiday calendar (Morocco pack) | Time & absence | HR-04 |
| M09 | Leave request by the employee, N+1 then a configurable second approver — HR for SMG (HR-02 decision 1), N+2 available for other clients (web); approved days passed to the payroll month | Time & absence | HR-04, DEMO |
| M10 | Attendance import from one device type (API or file): worked days, overtime, weekend days; error report | Time & absence | HR-03, IMP-03, DEMO |
| M11 | Configurable pay elements (earnings and deductions, tax and CNSS treatment, formula): SMG set incl. commission (manual or file input), weekend premium, transport, meal, CIMR, health insurance | Payroll engine | PAY-01, IMP-01 |
| M12 | Morocco legislation pack: CNSS, AMO, CIMR, professional expenses, IR, seniority, overtime, leave pay; effective-dated parameter tables, updated for the 2027 finance law | Payroll engine (MA pack) | PAY-02, HR-05 |
| M13 | Monthly payroll run: open, collect, calculate, review, HR approval, lock; versioned; audit trail | Payroll engine | HR-05, PAY-04 |
| M14 | Off-cycle runs: exit (final settlement), adjustment, bonus | Payroll engine | PAY-03 |
| M15 | PDF payslip (Morocco layout) and automatic e-mail after HR approval | Payslips | PAY-04, DEMO |
| M16 | Monthly CNSS declaration data for Damancom | Declarations (MA pack) | HR-06, SOW-07, DEMO |
| M17 | Monthly IR data | Declarations (MA pack) | HR-06 |
| M18 | Payroll journal: G/L and cost-centre mapping, debit = credit check, posting to S/4HANA Cloud (SOAP, SAP_COM_0002), posting log and re-post | Accounting integration | HR-07, SOW-08, REQ-14, DEMO |
| M19 | Import of employees and year-to-date figures with validation and reconciliation report | Migration | IMP-02 |
| M20 | Parallel-run report: CPeople vs. legacy payroll, employee by employee, per pay element | Payroll engine | IMP-04, SOW-10 |
| M21 | Security: tenant isolation (row-level security), field-level encryption (salary, CIN, RIB), audit log, Moroccan hosting | Platform | HR-08 (+ Law 09-08: NEW) |
| M22 | Dev / Test / Prod, backups, monitoring and alerting for a 2-hour P1 response | Platform | OPS-01, SOW-10 |
| M23 | UI in English and French | Platform | NEW (SMG deliverables are in English; French for HR users to confirm) |
| M24 | Country-pack structure: everything Moroccan in the MA pack, nothing in the core | Platform | GRP-01 |
| M25 | Expense claims: employee submits, manager approves, reimbursed through payroll; rules from the HR workshop | Payroll / self-service | EXP-01 |
| M26 | Configuration framework: platform → country pack → tenant policy layers; guardrails (locked, floor, ceiling, extend, free); effective-dated, versioned change sets with approval and impact preview; transport from Dev & Test to Prod; ConSAP console and client admin centre | Platform | GRP-01, IMP-01, NEW (spec §4, §6) |
| M27 | Country localisation templates: a versioned pack format (manifest, fields, holidays, leave, time, wage types, parameter tables, schema, outputs, golden tests); validation and import of a pack or template; status lifecycle (placeholder → template → prototype → validated → released); payroll disabled until a pack is validated; a blank template to start a new country | Platform / country packs | GRP-01, M24, NEW (spec §7) |
| M28 | Salary transfer file in the bank's format, with control totals and payment status (prepared, sent, confirmed) | Payroll | BANK-01 (spec §13) |
| M29 | Performance: review cycle, goals, competencies, rating scale, self and manager review (demo scope: goal setting and annual review) | Performance | PERF-01 (spec §14) |

Add to the register: **EXP-01**, expense claims mentioned by SMG; "Expenses" in the HR & Payroll app list (HRG §02, §07).

### 3.2 Only through a change request (not stated as client requirements)
| Feature | Why it is outside | Owner |
|---|---|---|
| Commission fed automatically from POS or S/4HANA data | New interface, excluded by TP E | Youssef, if SMG asks |

### 3.3 After the MVP (not in the SMG requirements)
| Feature | Requirement |
|---|---|
| Annual IR declaration (SIMPL-IR); needed before the first annual filing for 2027 | NEW (Moroccan compliance) |
| SAP Business One connector (Service Layer) | NEW (product roadmap) |
| Arabic UI with RTL | NEW |
| Office 365 / Google sign-in | NEW |
| Employee self-service portal beyond leave (payslip archive, profile updates) | NEW |
| Second validated country pack (UAE candidate); M27 already lets ConSAP start one from the template | GRP-01 |
| Mobile app and app-store icons | NEW |

---

## 4. Decisions needed this week
1. **K1:** what the 15 Nov demo ran on, how much capacity to add, and whether to prepare the 1 Mar 2027 fallback now (full scope either way). *Owner + Youssef.*
2. **K2:** where the parallel run and the trial loads run (recommended: Prod tenant not yet live). *Youssef.*
3. **K3:** does A3's UAE access apply to HR & Payroll? *Youssef; data-protection adviser if yes.*
4. **K6:** hosting provider in Morocco and the CNDP filing. *Owner.*
5. **K4:** SOAP synchronous posting and the posting granularity with the finance consultant. *Youssef.*
