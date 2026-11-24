# CPeople by ConSAP – HR-02 build spec: leave and attendance

**For Claude Code** · v2, Mon 23 Nov 2026, 23:55 · Workshop HR-02 with Maison Samira Maatouk (SMG): **Tue 24 Nov 2026, 13:15 – 14:45**
**Cut line: 11:30 Tuesday.** Put this file at `docs/specs/HR-02-build-spec.md`.

This spec says **what** to build. **How** is fixed by the existing repo: pnpm + Turborepo, Next.js App Router (`apps/web`), NestJS API (`apps/api`), PostgreSQL + Prisma with row-level security (forced, fail closed), Keycloak sign-in and roles, BullMQ jobs on Redis, RustFS (S3) for files, Gotenberg for PDFs, Mailpit for mail, Playwright for e2e. Reuse the HR-01 patterns (capabilities checked in the API, audit log, import wizard, EN/FR, ConSAP tokens, shell). **Do not add a new framework, store, router or auth mechanism.** If something here seems to need one, stop and ask.

---

## 0. Ground rules

1. **Already built stays.** HR-02 steps 1–2 are merged (leave settings, requests, N+1/N+2 approvals, HR override, stored calculations, "To review", holiday-year switch, emails). Step 3 (balances, payroll service) is in progress. Where this spec and the existing code give the same result, keep the code. Only fill gaps.
2. **Invented data only.** Never load real SMG data (Law 09-08).
3. **Every legal value is a seed "to confirm".** Leave rights, overtime rates, holidays and article numbers below are defaults for the session, editable in Settings, and shown with a "to confirm" chip and a tooltip: *"Default to be validated by SMG and its payroll expert. Not legal advice."* Never present them as checked.
4. **Roles enforced in the API,** not only hidden in the UI. Every new table has `tenant_id` and an RLS policy, and gets an RLS guard test like the existing ones.
5. **Evidence is insert-only** (calculations, imported punches, manual corrections, adjustments, decisions history): revoke UPDATE/DELETE in the migration, as for the audit log.
6. **Layout:** keep the shell and the approved design. Any layout change not listed here: ask first.
7. **Never ship a button that does nothing.** Hide it, or show it as "Planned" with the reason.
8. Merge to `main` after each step in §9, only when lint, typecheck, unit, build and e2e are green. `main` must be demo-ready at all times.

---

## 1. Inputs from the HR-01 minutes (23 Nov 2026)

| Input | What to do |
|---|---|
| Decision 1: SAP SuccessFactors Employee Central is not used | Remove any Employee Central mention from the app, seed and docs. |
| Decision 2: the employee number is the biometric (attendance device) ID | Label the field **"Employee number (biometric ID)"** (FR: « Matricule (ID biométrique) »). It is the **matching key** for attendance imports. Unique per tenant. Format still open: a tenant setting with a regex, **warning only**, default `^\d{1,10}$`. |
| Decision 3: the HR manager has full access | No role change. |
| Open point 2 (decide at HR-02): may employees see their own base salary? | Tenant setting **"Employees can see their base salary"**, default **off**. When off, the API **does not return** salary fields to the Employee role (not just hidden in the UI). Toggle it live in the session. |
| Open point 4: biometric ID format and export | Shown on the attendance import mapping and matching screens so SMG can confirm it on screen. |
| Headcount in Morocco: **44 employees** | Reseed to 44 (§3.4). |

---

## 2. Goal for Tuesday (deck agenda)

| Time | Agenda | Must work live |
|---|---|---|
| 13:15 | Demo: leave requests and approvals | Employee requests leave → N+1 → N+2 → balance and calendar update; a rejection with comment; balances and rules visible |
| 13:45 | Attendance: devices, export or API, fallback | Import a device export → match on employee number → exceptions → fix → worked time and overtime computed. API shown as **Planned**. Manual and bulk entry as the fallback |
| 14:15 | Rules today: leave types, overtime, shifts | Edit leave types, approval rules, schedules and overtime rules live in Settings and see the effect |
| 14:35 | Decisions and next steps | Decisions board filled in during the session, exported to xlsx for the minutes (D04) |

**Do not claim** a live device connection, real-time sync, or features not built (e.g. field encryption). The device provider supplies the export or API (P09, due 15 Dec 2026); ConSAP configures and tests the CPeople side.

---

## 3. Data (Prisma)

Names are indicative: match the existing naming. All models: `tenantId`, RLS, `createdAt/By`, audit on change.

### 3.1 Existing (keep, extend only where marked)
- `LeaveType`, `LeaveRule` (effective-dated), `SiteWorkWeek`, `LeaveSettings`, `PublicHoliday` (`confirmed`, note, unique tenant+country+date), `LeaveRequest`, `LeaveCalculation` (insert-only), `PayrollPeriod`, leave correction records, balances (step 3).
- **Extend `LeaveType`** if missing: `category` (annual, family_event, maternity, paternity, sick, unpaid, recovery, other), `paidBy` (employer, cnss, none), `deductsBalance`, `fixedDaysPerEvent?`, `minNoticeDays?`, `toConfirm`, `legalRef?`.
- **Extend `PublicHoliday`**: `movable: boolean`.
- **Extend `Employee`**: `preferredLocale` (exists), employee number label/validation per §1.

### 3.2 Schedules (new)
- `ShiftPattern { code, name, start, end, breakMinutes, crossesMidnight }`
- `WorkSchedule { code, name, weeklyHours, days[Mon..Sun] → { working, shiftPatternIds[] } }`
- `EmployeeSchedule { employeeId, scheduleId, weeklyRestDay (0–6), validFrom, validTo? }` (effective-dated; replaces the per-site week **only where set**, otherwise `SiteWorkWeek` applies)
- `ShiftAssignment { employeeId, date, shiftPatternId }` (optional day override, P1)

The existing day-count function (`leave-days.ts`) must take the employee's schedule and weekly rest day into account when one is set. Add unit tests.

### 3.3 Attendance (new)
- `AttendanceSource { name, type: file|api, status: active|planned, mapping (JSON), timezone "Africa/Casablanca", duplicateWindowSeconds (default 120) }`
- `AttendanceImport { fileKey (S3), fileName, sourceId, periodFrom, periodTo, rows, matched, unknown, duplicates, status: previewed|committed|replaced }`
- `Punch { importId?, employeeNumber, employeeId?, at, direction: in|out|unknown, deviceId?, source: device|manual, reason? }` – insert-only. A manual correction is a new row, never an edit.
- `EmployeeNumberAlias { alias, employeeId }` (e.g. `0107` → employee 107)
- `WorkDay { employeeId, date, scheduledMin, workedMin, breakMin, lateMin, earlyLeaveMin, overtime (JSON by band code), status: ok|exception|fixed|approved, exceptions[], leaveRequestId?, source: device|manual|mixed, calcVersion }` – rebuilt from punches; keep the rule versions used, as `LeaveCalculation` does.
- `AttendanceException { workDayId?, punchId?, code, status: open|fixed|ignored, resolution?, resolvedBy/At, comment }`
  Codes: `UNKNOWN_EMPLOYEE, MISSING_IN, MISSING_OUT, DUPLICATE, NO_SCHEDULE, ABSENT_NO_LEAVE, WORKED_ON_LEAVE, WORKED_REST_DAY, WORKED_HOLIDAY, OVER_DAILY_MAX, OVER_WEEKLY_MAX`
- `OvertimeRule` (effective-dated table rows): `{ bandCode, dayType: working|rest|holiday, timeFrom, timeTo, ratePercent, toConfirm }` plus `OvertimeSettings { thresholdMode: daily|weekly|both, roundingMinutes, roundingDirection, latenessToleranceMin, dailyMaxHours }`
- `PayrollVariable { employeeId, periodId, code, quantity, unit: day|hour|minute, source: leave|attendance|manual }` (P1, §6)

### 3.4 Seed (reset demo data rebuilds all of this; demo clock 24 Nov 2026)
- **44 employees:** Outlet 14, Kitchen 12, Pastry 8, Administration 6, Warehouse 4 (in a seed config file, easy to change). Contracts: 38 CDI, 4 CDD, 2 ANAPEC. Employee numbers `1001`–`1044`.
- Keep the named characters and their demo accounts: Salma Benali (HR), Rachid Kettani (Kitchen head, Manager), Karim Alaoui (Employee), Omar Chraibi (CDD ending 30 Nov), Leila Fassi, Mehdi Idrissi, Sara Amrani, Yassine Tazi, Nadia Berrada. Update all HR-01 tests and texts that relied on the old counts (e.g. "46 Kitchen employees").
- Manager tree: General manager → 5 department heads → supervisors (Outlet, Kitchen) → staff. Everyone has an N+1; most have an N+2.
- Hire dates over 0–9 years: at least 3 over 5 years, 1 over 10 years, 2 under 6 months. No employee under 18.
- Leave: opening balances at 1 Nov 2026, leave taken in 2026, **6 pending requests (2 at N+2)**, **4 people away 24–28 Nov**, one rejected request, one sick leave with a document.
- Schedules (to confirm): Office 44 h Mon–Fri + Sat morning; Outlet rota 44 h, rest day varies; Kitchen rota 44 h; Pastry early 44 h. Shifts: Morning 07:00–15:00, Evening 15:00–23:00, Split 10:00–14:00 + 18:00–22:00, Pastry 04:00–12:00.
- Punches 2–23 Nov 2026 for device sites, generated from schedules with ±10 min noise, plus the anomalies in §5.2.

---

## 4. Leave (fill the gaps only)

### 4.1 Leave types and policy (seeds, all "to confirm")
| Code | Name (EN / FR) | Category | Paid by | Deducts balance | Days | Document |
|---|---|---|---|---|---|---|
| ANNUAL | Annual paid leave / Congé annuel payé | annual | employer | yes | per policy | – |
| MARRIAGE | Own marriage / Mariage du salarié | family_event | employer | no | 4 | certificate |
| CHILD_MARRIAGE | Marriage of a child / Mariage d'un enfant | family_event | employer | no | 2 | certificate |
| BIRTH | Birth of a child / Naissance | paternity | employer | no | 3 | birth certificate |
| DEATH_CLOSE | Death of spouse, child, parent / Décès conjoint, enfant, parent | family_event | employer | no | 3 | death certificate |
| DEATH_SIBLING | Death of sibling or in-law / Décès frère, sœur, beaux-parents | family_event | employer | no | 2 | death certificate |
| CIRCUMCISION | Circumcision of a child / Circoncision | family_event | employer | no | 2 | certificate |
| SURGERY | Surgery of spouse or child / Intervention chirurgicale | family_event | employer | no | 2 | medical certificate |
| MATERNITY | Maternity leave / Congé de maternité | maternity | cnss | no | 98 calendar days | medical certificate |
| SICK | Sick leave / Congé maladie | sick | cnss (after waiting days, to confirm) | no | – | medical certificate |
| UNPAID | Unpaid leave / Congé sans solde | unpaid | none | no | – | – |
| RECOVERY | Compensatory rest / Repos compensateur | recovery | employer | own balance | – | – |

Annual policy seed (as `LeaveRule` rows): 1.5 working days per month of service; usable after 6 months; +1.5 days per completed 5 years of seniority; cap 30 days; rest days and holidays not counted; carry-over setting per type (step 3). Tooltips may cite Labour Code articles (231–232, 269, 274) **marked "to confirm"**.

Map onto the existing types and rules. Don't create duplicates of types already seeded in step 1.

### 4.2 Gaps to close in the existing leave flow
- Family-event types: the form shows their fixed number of days.
- Insufficient balance: **block** for annual leave unless "allow negative balance" is on (setting).
- **Short-request rule:** setting "N+1 only when under X days" (off by default), shown in the session as an option. Per department if the existing approval model allows; otherwise tenant-wide, and add an open point.
- **Approver per department:** at least a way to say "outlet staff are approved by …" (deck question). If the current model only uses the org tree, add an optional per-department override for level 1 and level 2 (manager, manager's manager, HR, or a named user). **Two levels maximum.**
- HR can **reassign** a pending step (P1).
- Approve/reject screen shows "N others from <department> away these days".
- **Acceptance:** a request Sat–Mon for an employee whose rest day is Sunday counts 2 working days.

### 4.3 Calendar
On `/leave` (new tab `calendar`, or in the existing tabs if one fits): month view, rows = employees, filter by department; cells show the leave type **with a letter, not colour only**; holidays and rest days shaded; pending requests hatched. Manager sees his team, HR sees everyone; the employee sees his own requests plus team absences **without the leave type**. Home "Away this week" reads the same data.

### 4.4 Balances
Finish step 3 as already specified. The HR table also shows: seniority bonus, "usable from" (before 6 months of service). **Acceptance:** for an employee hired 3 Mar 2019 the seniority line and total match the rules; changing the accrual rule (new effective-dated row) changes the result.

---

## 5. Attendance (new module)

API: a NestJS `attendance` module. Web: `/attendance` with tabs `overview`, `import`, `exceptions`, `timesheets` (each with its own URL, `?tab=…`), and `/settings/attendance` with tabs `source`, `schedules`, `overtime`. New capabilities: `attendance.view` (HR all, Manager own team), `attendance.import`, `attendance.correct`, `attendance.settings.manage` (Admin + HR). Employee sees only his own days (on `/me`).

### 5.1 File format (default mapping, editable)
```
employee_number;timestamp;direction;device_id
1007;2026-11-23 06:58:41;IN;KITCHEN-01
1007;2026-11-23 15:04:12;OUT;KITCHEN-01
```
- CSV (`;`, header) or XLSX. Timestamps `YYYY-MM-DD HH:mm:ss` or `DD/MM/YYYY HH:mm`, timezone Africa/Casablanca.
- `direction` may be missing ("punch" only): pair by order within the day, use the schedule to resolve odd counts. Night shifts crossing midnight belong to the day the shift started.
- **"Download the attendance file specification"** (xlsx: Read me, columns, example rows, rules). SMG sends this to the device provider for P09.

### 5.2 Sample export (downloadable from the import tab)
`Sample_Attendance_Export_2026-11.csv`, generated from the seed, with exactly:
- 3 **unknown numbers**: `9001`, `9002`, `0107` (leading-zero variant of an existing number, to discuss the format)
- 4 **missing OUT**; 2 **duplicates** within 1 minute
- **30 employees working on 18 Nov** (public holiday) across Outlet, Kitchen, Pastry
- night work on the Pastry early shift (04:00–06:00)
- 2 people punching on a day of **approved annual leave**
- 1 person absent 2 days with no leave request

### 5.3 Import wizard (reuse the HR-01 import pattern)
1. Upload (stored in S3) → **column mapping** (pre-filled from the saved mapping, first 10 rows previewed, "Save mapping").
2. Match on employee number (and aliases). Unknown numbers: map to an employee (creates an alias, audited) or ignore.
3. Remove duplicates within the window.
4. Build `WorkDay`s in a **BullMQ job**: pair punches, apply schedule, breaks, rounding, lateness, overtime bands (§5.6); raise exceptions.
5. **Preview** (rows read, matched, unknown, duplicates, days built, exceptions by code) → **Commit**. Re-importing a period replaces device punches but **keeps manual corrections**, with a warning first.
- One audit event per import with counts.
- **Acceptance:** importing the sample shows exactly the §5.2 anomalies.

### 5.4 Exceptions
Grouped by code, filter by department and date. Fixes (reason required, audited; the day's source becomes `mixed`):
- UNKNOWN_EMPLOYEE → map (alias) or ignore
- MISSING_IN / MISSING_OUT → add a manual punch → day rebuilt
- ABSENT_NO_LEAVE → open the leave form pre-filled ("HR on behalf"), or mark as unpaid absence
- WORKED_ON_LEAVE → open the leave request for HR to adjust, or ignore with comment
- WORKED_HOLIDAY / WORKED_REST_DAY → confirm as overtime at that rate, or convert to recovery (credits the RECOVERY balance)
- OVER_DAILY_MAX / OVER_WEEKLY_MAX → confirm with comment

### 5.5 Timesheets and manual entry (the go-live fallback, P09)
- Grid: employees × days of a week; each cell shows worked hours, a status icon and the leave letter; click → day detail (punches, schedule, overtime by band, history of corrections).
- **Manual entry:** HR enters in/out times or "present as scheduled" per day.
- **Bulk:** "All present as scheduled" for a department and a week, then fix the exceptions. Source `manual`.
- **Acceptance:** with no import at all, HR fills one Kitchen week in under 2 minutes and overtime is still computed.

### 5.6 Overtime (rules as data, seeds "to confirm")
| Band | Day type | Time | Rate |
|---|---|---|---|
| OT_DAY | working day | 06:00–21:00 | +25 % |
| OT_NIGHT | working day | 21:00–06:00 | +50 % |
| OT_REST_DAY | rest day or holiday | 06:00–21:00 | +50 % |
| OT_REST_NIGHT | rest day or holiday | 21:00–06:00 | +100 % |

Settings: normal duration 44 h/week, 8 h/day; threshold mode (default "both, no double count"); rounding 15 min in the employee's favour; lateness tolerance 10 min; daily maximum 12 h (warning). Tooltip may cite Labour Code Art. 201 **marked "to confirm"**.
Calculation is a pure function in a shared package with unit tests, including: 19:00–23:00 of overtime on a working day = 2 h OT_DAY + 2 h OT_NIGHT; the Pastry 04:00 start; a holiday; the weekly threshold without double counting. Changing a rule (new effective-dated row) and rebuilding shows the new result; past days keep the version used until rebuilt.

### 5.7 API route (shown as planned)
On `/settings/attendance?tab=source`: a second source "Device API", status **Planned**, its fields (endpoint, authentication, schedule, last sync) disabled, text: *"Activated when the device provider confirms the API (P09, 15 Dec 2026). Until then, the daily file is used."* No simulated connection.

### 5.8 Today (P1)
`/attendance?tab=overview`: today's scheduled, present, late, absent with or without leave, by department; this feeds the Home card "Present today" (otherwise "No import yet today").

---

## 6. Monthly close → payroll variables (P1, preview for HR-03 on 25 Nov)
On `/attendance?tab=close` (or a step in `overview`): checklist (no open exceptions, all leave in the month decided, manual entries reviewed) → **Close period** (HR) → `PayrollVariable`s per employee: `WORKED_DAYS, UNPAID_ABSENCE_DAYS, SICK_DAYS_CNSS, MATERNITY_DAYS, ANNUAL_LEAVE_DAYS, FAMILY_EVENT_DAYS, OT_DAY_H, OT_NIGHT_H, OT_REST_DAY_H, OT_REST_NIGHT_H, LATE_MINUTES`, plus the leave correction records from step 3. Table + xlsx export ("Payroll variables – November 2026 – preview"). Closing sets the existing `PayrollPeriod` to locked; reopening needs a reason (audited). Reuse the step 3 payroll service for the leave part. Label: *"These variables feed the payroll calculation – workshop HR-03."*

---

## 7. Settings, "to confirm" chips, decisions board

### 7.1 Settings edited live
Existing `/settings/leave` tabs, plus the new `/settings/attendance` tabs, plus `/settings/self-service` (salary visibility; show leave type to colleagues; employee may edit contact fields). Each change is audited and highlighted "changed today".

Every row that carries a legal default shows a **"To confirm"** chip until someone with the settings capability clicks **"Confirmed by SMG"** (stores who and when; insert-only history).

### 7.2 Decisions board `/decisions`
New capability `decisions.manage` (Admin, HR; read for ConSAP users). An editable list: decision, options, chosen option, decided by (free text), date, status (Open / Decided / To confirm), notes; history kept. **Export xlsx** for the minutes (D04). Pre-filled:
1. Leave types used at SMG beyond the legal ones, and their rules
2. Approval flow per department; who approves outlet staff; N+1 only for short requests?
3. Attendance route: daily file or API; device make and provider contact; due 15 Dec (P09)
4. Fallback if the export is late: manual entry at go-live, accepted?
5. Employee number = biometric ID: format, leading zeros, uniqueness (HR-01 open point 4)
6. Sites without devices and how their attendance is captured
7. Overtime: threshold, rounding, holiday work paid as overtime or recovery
8. Shifts and weekly rest days per department
9. Employees see their base salary: yes / no (HR-01 open point 2)
10. Public holidays 2026–2027 confirmed
Also link the items from `docs/specs/HR-02-open-points.md` (don't duplicate them: show them as a second section or import them as items).

---

## 8. Home, self-service, notifications

- **Home cards (approved design):** Headcount, **Present today**, **Leave requests**, Documents expiring. Same card style. **Attendance exceptions** and **fixed-term ending** go under "Waiting for you" (with approvals for the current user, missing documents on leave, the month close when due). Ask before any other change.
- "Away this week" and the holiday line under the greeting are live.
- The "Attendance devices" connection card: last import time, open exceptions, source = file, API = Planned.
- Notifications (bell and email in the recipient's language, link only, no reason text or medical details): submitted, approved, rejected, import done, exceptions found.
- **`/me`** (Employee): my balances, request leave, my requests and approval trail, my attendance this month (worked days, late, overtime), my documents, my file (read-only except contact fields if the setting allows). Usable at phone width (375 px), as is the leave form.

---

## 9. Build order (merge each step when green)

1. Reseed to 44 + employee number label/format setting + salary visibility setting (API-enforced) + remove Employee Central. HR-01 e2e updated and green.
2. Finish step 3 (balances, payroll service) + calendar + Home "Away this week" and "Leave requests" live.
3. Schedules, shifts, weekly rest day; day count uses them (unit tests).
4. Attendance source + mapping + sample file + file specification download.
5. Import wizard + WorkDay build job + overtime bands (unit tests).
6. Exceptions with all fixes.
7. Timesheets + manual and bulk entry.
8. Settings additions + "To confirm" chips + decisions board + export.
9. `/me` self-service + Home "Present today" + "Waiting for you" items.
—— **Cut line: 11:30 Tuesday.** ——
10. Monthly close + payroll variables + export. (P1)
11. Today view, reassign approver, cancellation after approval if not already built. (P1)
12. Rota drag and drop, simulated file drop. (P2)

If time runs short, the order of what to keep for the demo is: leave flow (1–2) → import + exceptions (4–6) → decisions board (8) → manual/bulk entry (7) → the rest.

---

## 10. Smoke test (Playwright where possible; run after steps 2, 6 and 9)

1. Reset → Home: 44 employees, demo date 24 Nov 2026, Away this week = 4, leave requests pending = 6.
2. Karim requests 3 days annual → days and balance correct → submitted; Karim's API response has no salary (setting off) → HR turns it on → Karim sees it.
3. Rachid approves (N+1) → N+2 approves → balance updated, calendar shows it, Home count −1, email in Mailpit (no reason text).
4. Reject with comment → pending released, comment visible to the employee.
5. Request across a holiday and a rest day → both excluded.
6. Import the sample → 3 unknown, 4 missing OUT, 2 duplicates removed, 30 holiday work days on 18 Nov, 2 worked-on-leave, 1 absent without leave (2 days).
7. Map `0107` → alias → re-match → exception gone; alias in the audit log.
8. Add a missing OUT with a reason → day rebuilt, bands shown.
9. Bulk entry for Kitchen, one week → WorkDays with source `manual`.
10. Change the night rate (new rule row) → rebuild → new rate applied; chip shows "changed today".
11. Decisions board: mark 3 decided → xlsx export has them.
12. RLS: a second demo tenant sees none of this tenant's punches, work days or decisions.
13. Manager can't see another department's attendance; Employee can't open `/attendance`.
14. (P1) Close November → payroll variables → export.
15. All HR-01 flows still pass.

---

## 11. Not for Tuesday
Payroll calculation, payslips, CNSS / IR declarations, SAP posting (HR-03). Any live device or API connection. Expense claims (stays the "Coming later" page). Employee Central. Real SMG data.

---

## 12. Deliver at the end
- Reset the demo data and run §10.
- `docs/demo/HR-02-presenter-guide.md` + PDF, same format as HR-01: demo accounts with passwords (local dev only), a script following §2, for each step the SMG question from the decisions board, and fallbacks.
- A short report: which steps passed, which to skip in the demo.
