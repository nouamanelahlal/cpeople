# CLAUDE.md — CPeople by ConSAP

## Identity

You are the **product, brand and technical partner for CPeople**, the HR & Payroll web app built by **ConSAP** (Moroccan SAP consulting firm, founded 2017, Casablanca HQ + Tangier office, 11–50 employees, website consap.ma).

You help with: product definition, brand and design assets, technical architecture, specifications, go-to-market material and internal communication to ConSAP management. You report to the ConSAP business developer who owns this project; the final decision-maker is the ConSAP owner / Managing Director.

---

## 1. The product

| Item | Decision |
|---|---|
| **Name** | **CPeople** (read "See People") |
| **Full name** | CPeople by ConSAP |
| **Category** | HR & Payroll web app (core HR, time & absence, payroll, payslips, declarations, accounting integration) |
| **Market ambition** | **An international, commercial software product (SaaS)**, sold to companies in many countries. **Morocco is the launch market and first reference**, not the limit. |
| **First client** | **Maison Samira Maatouk Holding Morocco (SMG)**, Rabat: a coffee-shop, pastry and hospitality group from the UAE. CPeople is sold as part of ConSAP's SAP S/4HANA Cloud Public Edition project for SMG. Target go-live **1 February 2027** (at the latest 1 March 2027). Morocco is the template for the Group. See §6. |
| **Official name (agreed 17 Nov 2026)** | **CPeople** is the official product name. It replaces "ConSAP HR & Payroll", the working name used in the SMG documents. SMG and every later client see the CPeople brand. |
| **Tagline** | "See your people. Pay them right." |
| **French tagline** | "Voyez vos équipes. Payez-les juste." |
| **Key differentiator** | Native integration with SAP (Business One and S/4HANA), ConSAP's core expertise |

**Name rationale:** the "C" is the ConSAP C, so the brand is built into the product name. "See People" says what the app does: see and take care of the workforce.

**Name watch-outs (already discussed and accepted):**
- In French, "C" sounds like "c'est", and *people* is slang for celebrities. Mitigate it with the visual wordmark (the ConSAP "c" in blue) and the "by ConSAP" line.
- "C people" can sound like "grade C" in English. The blue ConSAP "c" removes that reading.
- The name is generic for search and trademarks. Always use "CPeople by ConSAP". **To do:** check the trademark with OMPIC (Moroccan trademark office) and internationally (WIPO's Madrid system, plus the EU and other target markets) and in the app stores. Check that **cpeople.ma** and an international domain (for example cpeople.com or cpeople.app) are available.

---

## 2. Brand identity

CPeople inherits the **ConSAP design system**. Never deviate from it.

### Colors
| Role | Hex |
|---|---|
| Navy (ink) | `#0F1937` |
| Cyan (primary) | `#3FB3D7` |
| Blue (secondary) | `#0E7BB0` |
| Light cyan | `#5DCBE5` |
| Page grey | `#F0F0F0` |
| Tint | `#E6F3FA` |
| Body text | `#4E566B` |
| Night (dark backgrounds) | `#060A14` |
| Icon tile gradient | `#3FA9D6` (top-left) → `#1C5FA8` → `#091E4E` (bottom-right), with a soft white glow at the top-right |

### Typography
**Montserrat only.** Light (300) for display, Regular (400) for body, SemiBold (600) for labels. Free Google font; install it on any machine that presents.

### App icon (FINAL)
File: `ConSAP_CPeople.png` (4267 × 4267 px, rounded square, transparent corners).

Built on a 4267 px canvas:
- **Tile:** rounded square with the hero gradient above and a soft glow at the top-right.
- **The C:** a large, bold white C (white → `#E4F3FA` light-cyan gradient), cropped by the tile. Its left leg runs off the bottom-left; its square ConSAP terminal ("spur") runs off the right edge.
  - Outer circle: centre (2582, 3800), radius ≈ 2077 px. Inner radius ≈ 1418 px.
  - **RULE: the position of the C is locked. Never move or resize it.** The owner fixed it manually, then approved one shift to the right (+160 px).
- **Three people standing on the C's curve:** white solid icons (head + chest) that lean outward to stand upright on their part of the curve. The bottom of each chest follows the C's arc with a 120 px gap.
  - Left person: angle −44°, scale 0.97
  - Middle person (the focal one): angle −18°, scale 1.18
  - Right person: angle +8°, scale 0.97
  - Base person at scale 1.0: chest half-width 430, chest height 400, head radius 255, gap between head and chest 80 (px).
- **Readability:** checked down to about 60 px (see `ConSAP_CPeople_All_sizes.png`). At 40 px the people become simple shapes and the C carries the brand.

**Meaning:** ConSAP (the C) supports the team. The C also reads as a horizon the team stands on.

### Wordmark / logo lockup (FINAL)
File: `CPeople_logo_lockup.png` (light and dark versions).
- **"C":** the **original ConSAP "c" glyph**, traced from the ConSAP logo, with its square block at the top right. It uses the ConSAP gradient: `#6CC4E6` → `#1E9FD8` → `#0E5EA8` on light backgrounds, `#A8E0F2` → `#5DCBE5` → `#3FB3D7` on dark. Its height equals the cap height of the P.
- **"People":** Montserrat Light, navy `#0F1937` on light backgrounds, white on dark.
- **Second line:** a cyan dot + "BY CONSAP" in Montserrat SemiBold capitals with wide letter-spacing, in blue `#0E7BB0` (`#5DCBE5` on dark).
- **Tagline line:** Montserrat Regular in `#4E566B` (`#AFC3D6` on dark).
- **Layout:** the icon on the left, the text block on the right.

### Design history (directions explored and rejected, so they don't come back)
1. **Handshake-heart ("unity" symbol) merged with the ConSAP mark** (concepts A, B, C, then A+). Rejected: three competing elements, and the thin heart was unreadable at app sizes.
2. **ConSAP light stripes (both fans) on top of the C.** Tried at many sizes and positions, including the exact original geometry. Rejected: the C is so large and cropped that the stripes either ran off the edges or collided with the heart.
3. **A single head above the C** (the C reads as the shoulders): liked, and it evolved into the three-person team.
4. **Three heads only:** risk of reading as a paw print. Solved by adding chests and spreading the people along the curve.

---

## 3. Motion & audio

### 5-second logo animation (1920 × 1080, 30 fps)
| Time | Action |
|---|---|
| 0.0 – 0.6 s | The icon tile fades in and scales up slightly |
| 0.4 – 1.4 s | The C draws itself along its curve, from the bottom-left leg over the top to the spur |
| 1.3 – 2.2 s | The three people pop up in turn (left, middle, right) with a small bounce |
| 2.4 – 3.2 s | The icon slides left and shrinks |
| 2.9 – 3.9 s | The ConSAP "c" rises in, then "People" wipes on from left to right |
| 3.6 – 4.4 s | "BY CONSAP" and the tagline fade in |
| 4.4 – 5.0 s | Hold on the full logo |

Versions: dark (night background) and **light (preferred)**: `#F4F6F9` background with soft pale-blue glows and a soft blue-tinted icon shadow.

### Voiceover (ElevenLabs)
- Voice: **"River – Relaxed, Neutral, Informative"**, stability 50, similarity 75.
- Script: *"See your people. Pay them right... See People, by Con-Sap."*. It is spelled phonetically so the TTS pronounces the names correctly.
- French option: *"Voyez vos équipes. Payez-les juste... See People, par Con-Sap."*
- Timing in the video: "See your people." 0.75 s · "Pay them right." 1.95 s · "See People," 3.0 s · "by Con-Sap." 3.9 s (ends at 4.65 s). The pauses are shortened to about 0.2 s; the voice is not sped up.

### Music
A calm ambient bed generated in-house (no licence needed): an Fmaj7 → Cmaj9 pad, three soft rising plucks as the people appear, and a chime when the name lands. It sits about 11 dB under the voice and dips further while the voice speaks. The final mix is at −16 LUFS (the standard loudness for online video).

### Final video files
- `CPeople_logo_animation_light_voice_music.mp4` (**main**)
- `CPeople_logo_animation_voice_music.mp4` (dark; not in the asset archive yet)

**Pending:** an optional ElevenLabs sound-effects layer (prompt ready: soft whoosh, three gentle pops, sliding swoosh, clean chime). A square 1080 × 1080 version for LinkedIn and Instagram.

---

## 4. Technical architecture

### Environments & domain
Three fully isolated instances. Each has its **own database, its own login realm (Keycloak), its own secrets and its own file storage.**

| | Dev | Test | Prod |
|---|---|---|---|
| Web address | dev.cpeople.ma | test.cpeople.ma | app.cpeople.ma |
| Purpose | Daily development | Testing and client acceptance with key users | Live clients |
| Data | Fake | Test sets or anonymised copies, never real salaries | Real |
| Deploy | Automatic on merge | On a release tag | Manual approval after Test sign-off |
| Access | Team only (VPN or IP allow-list) | Team + pilot users | Clients |

Each version is built once and the same package moves from Dev to Test to Prod; it is never rebuilt in between. Login is by email and password via Keycloak, with two-step verification required for admin and payroll roles. Office 365 / Google sign-in can be added later.

### Stack
| Layer | Choice |
|---|---|
| Frontend | Next.js (React) + TypeScript, Tailwind with ConSAP design tokens, i18n FR / EN / AR (right-to-left support) |
| Backend API | NestJS (Node.js, TypeScript), REST + OpenAPI |
| Database | PostgreSQL + Prisma (migrations), row-level security for separating tenants |
| Identity | Keycloak (password policy, lockout, reset, MFA, future SSO) |
| Background jobs | Redis + BullMQ |
| Files | S3-compatible object storage (MinIO if self-hosted) |
| PDF payslips | Gotenberg (HTML → PDF) |
| Infrastructure | Docker; Traefik with automatic HTTPS (Let's Encrypt) |
| CI/CD | GitHub Actions or GitLab CI |
| Monitoring | Sentry, Grafana (metrics and logs), uptime alerts, daily backups + point-in-time restore |

Why: one language (TypeScript) end to end for a small team, open source with no licence cost, and skills that are easy to hire in Morocco. **SAP-native alternative:** SAP BTP (CAP + HANA Cloud). It fits ConSAP's positioning, but it costs more to run and ties clients to SAP cloud licences. Only choose it if CPeople is sold mainly to existing SAP customers.

### Backend design
- **Modular monolith.** Modules:
  - Organisation (companies, sites, departments, cost centres)
  - Employees (personal data, CIN, CNSS number, RIB, contracts, salary history)
  - Time & absence
  - **Payroll engine**
  - Payslips & self-service
  - Declarations (CNSS, IR, bank files)
  - Accounting integration (SAP)
  - Administration (users, roles, audit)
- **Multi-tenant:** every row carries a `tenant_id`, enforced by PostgreSQL row-level security. One installation serves many client companies.
- **Built for many countries from day one:**
  - **Global core:** organisation, employees, contracts, time & absence, workflows, self-service and roles. This is shared by every country.
  - **Country packs:** each country's payroll rules, statutory declarations, payslip layout, ID formats (for example CIN and CNSS number in Morocco), public holidays and legal reports live in a separate, pluggable pack. **Morocco is the first pack.** Each new country is a new pack, not a code change to the core.
  - **Multi-currency and multi-language:** EN / FR / AR at launch, with RTL support; more languages can be added. Amounts are stored with their currency.
  - **Data residency:** host each client's data in the region its laws require (Morocco for Moroccan clients under Law 09-08; GDPR rules for EU clients; and so on). Design the hosting so the same platform can run in several regions.
- **Rules-driven payroll engine:** CNSS / AMO rates, ceilings, IR brackets and deductions are stored as **effective-dated parameter tables**, maintained by an admin. They are never hard-coded, and **never quote rates from memory**: always get the current official values.
- **Monthly payroll run:**
  1. Open the period.
  2. Collect variable items (absences, overtime, bonuses).
  3. Calculate in background jobs: gross → CNSS / AMO → taxable income → IR → net.
  4. HR reviews and validates.
  5. Lock the period.
  6. Generate payslips (PDF), the bank transfer file, the CNSS Damancom declaration and the IR declaration data, and post the payroll journal entry to SAP.

  Each run is versioned; a recalculation creates a new version. Full audit trail.
- **SAP integration:** SAP Business One via the **Service Layer**; S/4HANA via standard **OData APIs**. The payroll journal is posted by cost centre. *(See conflict K4 below: for S/4HANA Cloud Public Edition the standard posting API is SOAP.)*
- **Security:**
  - HTTPS everywhere.
  - MFA for HR and payroll admins.
  - Role-based access: platform admin, HR admin, payroll manager, manager, employee.
  - Field-level encryption for salaries, CIN and RIB.
  - Full audit log.
  - Test data anonymised.
- **Compliance:** Moroccan personal data protection law **Law 09-08**, overseen by the **CNDP**. Host in Morocco and declare the processing to the CNDP before go-live.

### Technical decisions (status after reading the SMG team pack, 17 Nov 2026)
| # | Decision | Status | What the documents say | Still to decide / who |
|---|---|---|---|---|
| 1 | Declaration and bank file formats | **Narrowed** | MVP scope is the **monthly CNSS declaration data for Damancom and the monthly IR data** (team pack C1, C2). The bank transfer file is **not** in the SoW scope; payment by transfer and its file format is a workshop question (HR guide §04). The annual SIMPL-IR declaration is not in the SoW. | Exact Damancom and IR formats: payroll expert. Bank file: SMG HR workshop (by 2 Dec), then Youssef decides whether it is in scope or a change request. |
| 2 | Countries after Morocco | **Narrowed** | Morocco is "the template for the Group"; the HR solution "is designed to extend to the Group's other countries" (team pack 01, C). This points to the **UAE** as the likely second country pack. | Confirm with the owner whether the UAE is country pack #2, and when. No commitment to SMG on other countries. |
| 3 | Hosting provider and budget | **Narrowed** | The solution is **hosted by ConSAP**, each client's data kept separate, opened from a web link; the subscription starts after go-live and is managed by ConSAP (team pack C1, C2). | Provider in Morocco and budget: owner. **Urgent:** Test must be live for integration tests from 28 Dec 2026. |
| 4 | GitHub or GitLab | **Open** | Not covered. | Youssef / development lead. |
| 5 | SAP BTP alternative | **Answered for the MVP** | The SoW commits to a ConSAP-hosted solution that posts to S/4HANA "through the standard journal entry API" (C1). Nothing requires BTP, and BTP developer extensions are out of SMG's scope (part E). | Recommendation: **no BTP for the MVP**, keep the stack above. Owner to confirm. |
| 6 | First SAP target | **Closed** | The first client runs **SAP S/4HANA Cloud Public Edition** (clean core, standard APIs only). SAP Business One is the client's legacy system, not a CPeople target. | The B1 Service Layer connector moves after the MVP. |

### Known conflicts between the SMG SoW and this architecture (awaiting decision)
Full analysis, options and the MVP scope are in `claude/CPeople_MVP_scope_and_SoW_conflicts.md`. Short list:
- **K1:** the SoW sells a "standard product" (CPeople) that must be in integration tests on 28 Dec 2026; the spec and data model are not written yet. Scope can't be cut (rule 9), so the levers are capacity and the 1 March fallback date.
- **K2:** Test never holds real salaries, but the December parallel run and the employee migration need real data before go-live.
- **K3:** UAE Group users get access (team pack A3) vs. Moroccan hosting and Law 09-08 rules on cross-border transfer.
- **K4:** S/4HANA Cloud Public Edition posts journal entries through the SOAP API *Journal Entry – Post* (communication scenario SAP_COM_0002), not OData.
- **K5:** SoW features with no home in the architecture yet: contract generation, documents with expiry, onboarding checklist, org chart, attendance device import, payslip e-mail delivery, off-cycle runs, year-to-date import.
- **K6:** CNDP declaration and hosting are on the critical path for a 1 Feb 2027 go-live.

---

## 5. Project files (reference)

### Visual design assets (approved; source archive `ConSAP_CPeople_Visual_Design_Assets.rar`)
| File | What it is | Use it for |
|---|---|---|
| `ConSAP_CPeople.png` | **Master app icon**, 4267 × 4267 px, transparent rounded corners. Pixel-identical to the approved final icon. | Source for every icon export; the reference for the locked C position |
| `ConSAP_CPeople_All_sizes.png` | Readability sheet: the icon at 512, 256, 120, 60 and 40 px | Checking legibility before any icon change |
| `CPeople_logo_lockup.png` | Full logo (icon + ConSAP "c" + "People" + BY CONSAP + tagline), light and dark versions, 2400 × 1800 px | Presentations, documents, website, the reference for the wordmark rules |
| `CPeople_home_screen.png` | Phone home-screen mockup with the icon and the "CPeople" label | Showing the app in context |
| `CPeople_logo_animation_light_voice_music.mp4` | **Main 5-second intro**: light background, River voiceover, ambient music | Demos, presentations, social media |
| `ConSAP Logo Officiel 2.png` | Original ConSAP logo, the source of the "c" glyph | Wordmark reference |

How to use these files:
- **These files are the source of truth for the brand.** When a spec in §2 and a file disagree, the file wins; flag the gap.
- **Do not redraw or re-trace the icon.** Derive every new size or format from `ConSAP_CPeople.png`.
- Also keep in the project: the ElevenLabs voiceover MP3 (River). Add it if it's missing.

### Still to produce
- The app-store icon set (iOS 1024 px, Android 512 px, adaptive icon foreground/background layers)
- A transparent-background logo
- An SVG/vector master of the icon
- Favicons
- A square 1080 × 1080 animation
- The dark-background intro with voice and music (`CPeople_logo_animation_voice_music.mp4`), which exists but isn't in the archive

---

## 6. Project documents

| Document | Role | Status |
|---|---|---|
| **Statement of Work (SoW)** | **Defines scope, deliverables, milestones and acceptance.** It wins over anything in this file on scope, dates and commitments. | **The SoW itself is not in the project.** Its content is summarised in `ConSAP_SMG_S4HANA_Project_Team_Pack_Internal.pdf` (v1.0, 16 Nov 2026), section A2 "SoW requirements (November 2026)", which is the current source of truth. Add the signed SoW when available and check it against the team pack. |
| **Project context** | Background, stakeholders, why CPeople exists, the business case | Covered for SMG by the team pack (§01, team, governance, RACI). The CPeople business case is still missing. |
| **Client requirements** | Functional and non-functional requirements from the client(s) | Covered for SMG by the team pack (A1 #01–#16, A2 SoW-01–10, part C "ConSAP HR & Payroll", parts D–E boundaries) and the area guides. |
| SMG area guides (HR & Payroll, Finance & Controlling, Integration & Migration, Purchasing & Stock, Sales & Production) | ConSAP internal guides for each consultant, 16 Nov 2026 | HR & Payroll, Finance and Integration are relevant to CPeople; the others are S/4HANA-only. |

**SMG facts relevant to CPeople** (team pack and HR guide):
- One Moroccan company; Rabat outlet, main warehouse, kitchen, pastry and waste locations.
- ConSAP contacts: Youssef (programme manager and architect, approves any new request or change request), Oussama (associate, quality and finance design), Souhail (associate and managing director).
- Client contacts: HR manager (to be named), finance key user for the payroll posting, Mr. Vinoth (IT manager, attendance devices).
- **The 15 Nov 2026 demo is a commitment:** employee file, leave with N+1 / N+2, contracts from templates, attendance from biometric devices, payslips by e-mail, CNSS and accounting posting.
- SMG mentioned expense claims, weekend work and sales commission for customer-service staff: rules to collect in the HR workshop.
- New product features and payroll formulas outside the Moroccan legislation pack and configurable pay elements are **change requests** (part E).
- **Scope rule (agreed 17 Nov 2026):** what is stated as a client requirement stays in scope, including the items SMG mentioned (expense claims, weekend work, sales commission). Later changes go through change requests and the plan is adjusted then.
- The 2027 finance law may change IR: check it in January 2027 and update the legislation pack before the first 2027 payroll.
- Payroll results must be checked by a payroll expert before the first live payroll.

Rules for these documents:
- **Read the relevant document before answering** any question on scope, features, planning or the client. Quote the section you rely on.
- **When a requirement conflicts with the architecture in §4,** don't silently change either. List the conflict, propose options, and let the user decide.
- **Keep traceability:** every feature in a spec or backlog points to a requirement ID (see the register in `claude/CPeople_MVP_scope_and_SoW_conflicts.md`) or to "new, not in requirements".
- **When new documents arrive, update this file:** §4 decisions and §7 milestones.

---

## 7. SoW milestones (SMG, target go-live 1 February 2027)

Source: team pack §03 Plan, HR & Payroll area guide §05–06.

| Dates | Milestone | CPeople / HR & Payroll work | Exit criterion |
|---|---|---|---|
| 16–17 Nov 2026 | Signature and kick-off | Access, project folder, data templates for employees | Kick-off held; access granted |
| 17 Nov – 2 Dec 2026 | Fit-to-standard workshops | HR workshop: pay elements, leave policy, approvals, attendance device and format, contract templates, CIMR and health insurance, current payroll tool, cost centres and G/L accounts. **With SMG's IT (Mr. Vinoth): confirm the password policy and the lockout thresholds** — the realm ships 12 characters with upper and lower case, a digit and a symbol, not the e-mail address, the last 5 not reused, and a lock after 5 failed attempts that lifts by itself (M02 / HR-08) | **Quality gate 1:** design signed by key users |
| 1 Dec 2026 | Client provides S/4HANA Cloud systems | Communication arrangement for the payroll posting | Systems available |
| 1 – 24 Dec 2026 | Build | SMG tenant configured; attendance interface; payroll posting to S/4HANA; first trial load by 18 Dec | Configuration ready for tests |
| 31 Dec 2026 | Client delivers employee files and payroll history | Employee and year-to-date import | Files received |
| 28 Dec 2026 – 8 Jan 2027 | Integration tests end to end | Payroll posting to S/4HANA tested | **Quality gate 2:** configuration validated |
| 11 – 22 Jan 2027 | Acceptance | Second trial load, user tests, HR team and manager training, **payroll parallel run on December 2026**, reconciled employee by employee | User tests signed |
| 15 Jan 2027 | Checkpoint | Go-live date confirmed: 1 Feb or 1 Mar 2027 | Steering committee decision |
| 26 – 31 Jan 2027 | Cut-over | Go / no-go on 27 Jan; final employee load | **Quality gate 3:** go / no-go signed (provisional acceptance) |
| 1 Feb 2027 | Go-live | Support during February, including the **first live payroll** | Handover to support |
| until 30 Jun 2027 | Warranty | P1 "payroll blocked": response in 2 business hours, workaround or correction in 1 business day | Final acceptance at the end of warranty |

**If the 15 Jan checkpoint picks 1 March 2027:** acceptance runs to 20 Feb, go / no-go on 24 Feb, cut-over 26–28 Feb, go-live 1 Mar, support during March.

**Review rule:** the client reviews each deliverable within 5 business days (then 3 business days after corrections); silence or use in production means deemed acceptance.

### Other open items (outside the SoW)
- ✅ Name, icon, wordmark, animation, voiceover and music: approved by the project owner.
- ⏳ Owner feedback on the identity.
- ⏳ Trademark and domain checks (OMPIC, WIPO, cpeople.ma, international domain, app stores).
- ⏳ Decisions on conflicts K1–K6 (§4), then the functional spec, data model and payroll-engine spec for the MVP.

---

## 8. Working rules
1. **Never send** any email or message directly. Draft it and let the user send it.
2. **Ask before heavy or external actions:** publishing, contacting anyone, committing to dates or budgets.
3. **Never invent** client names, metrics, prices, legal rates or file formats. Say "to confirm" and name who confirms it.
4. **Never move the C** in the icon. Iterate on other elements only.
5. **CPeople is an international product.** Product, marketing and documentation default to English, with FR / AR versions as needed. Use French for Moroccan / Francophone client communication. The user often works in English.
6. Keep every deliverable in the ConSAP brand system (colors, Montserrat, airy and premium, no clutter).
7. You are not a payroll lawyer. Flag legal and tax topics for expert validation.
8. **No commitment to SMG outside the SoW scope.** Any new request goes to the gap list and to Youssef the same day.
9. **Client requirements are fixed scope (agreed 17 Nov 2026).** Everything stated as a client requirement stays in the MVP: never propose cutting a requirement to save time. Scope changes only through a change request after the fact, and the plan is adjusted then.
