# HR-02 — open points for the SMG HR workshop

**For the workshop on or before 2 December 2026.** Time & absence (M08, M09).

Every point below is a question we cannot answer for SMG. None of them blocks the
build: each one has a **configurable default** already in the system, entered as
data rather than written into the code, so settling a point is a change to a
setting and not a change to the software.

Nothing here is a legal opinion. Where a point touches Moroccan labour law or the
collective agreement, the answer has to come from SMG's HR and be confirmed by the
payroll expert before go-live (CLAUDE.md rule 11).

---

## How to read the "today" column

| | |
|---|---|
| **Default** | What the system does if nobody answers. Always a value in the database, never a constant in the code. |
| **Where it is set** | The screen an administrator changes it on, once SMG has decided. |
| **Marked** | Seeded values carry a note on the row — *"demo value, to be confirmed by the payroll expert"* — and a `confirmed` flag that stays `false` until somebody says otherwise. |

---

## 1. Leave rights and accrual

**Question.** How many days a year does each leave type give, how are they earned,
and what happens to what is left at the end of the year?

Specifically, per type:

- the annual entitlement, and whether seniority adds to it;
- whether days are earned month by month or granted in full at the start of the
  leave year;
- whether unused days carry over, and up to what limit;
- when the leave year starts — 1 January, the hire anniversary, or SMG's own
  financial year.

**Why it matters.** It decides every balance on every screen, and the days that
reach payroll. Getting it wrong is visible to all 148 people at once.

| | |
|---|---|
| **Default** | Annual leave 18 days a year, earned 1.5 days a month, up to 18 carried over; a leave year of 1 January – 31 December. Sick, maternity, paternity and exceptional leave have no annual entitlement and are not deducted from the annual balance. Unpaid leave has no balance at all. |
| **Where it is set** | Settings → Leave → **Rules**. Rows are effective-dated, so a change for 2027 does not rewrite 2026. |
| **Marked** | Yes — every seeded rule says *demo value, to be confirmed by the payroll expert*. |

> **These numbers are invented for the demo.** They are not the legal minimum and
> they are not SMG's agreement. Do not quote them to anybody.

---

## 2. Which leave types need a second approval (N+2)

**Question.** Which kinds of leave need the manager's manager as well as the
direct manager — and is the rule by type, by length, or by both?

**Why it matters.** The approval path is the part of the demo SMG asked for by
name. Each extra step is a day or two of waiting for the employee.

| | |
|---|---|
| **Default** | N+2 is **off** for every type except **unpaid leave** and **exceptional leave**. Everything else stops at the direct manager. |
| **Where it is set** | Settings → Leave → **Types**, one switch per type. |
| **Still open** | Whether length should also trigger it — for example, any absence over ten working days. The system does not look at length today; adding it is a rule, not a rebuild. |

> **Confirmed by ConSAP on 23 November 2026:** unpaid and exceptional leave need
> N+2. It stays a per-type switch all the same, so SMG can change it at the
> workshop without waiting for a release.

---

## 3. The working week, and weekend work

**Question.** Which days are working days, for whom? The outlets trade at the
weekend and the head office does not.

Also: when somebody works a Saturday, is that a working day for leave purposes,
or a rest day that earns something back?

**Why it matters.** It decides how many days a request actually costs. "Monday to
Sunday" is five days for the head office and seven for an outlet that trades
every day.

| | |
|---|---|
| **Default** | Monday to Friday for the head office, the central kitchen, the pastry workshop and the warehouse. **Monday to Saturday for the outlet.** Sunday is a rest day everywhere. |
| **Where it is set** | Settings → Leave → **Working week**, one row per site, effective-dated. |
| **Not built, on purpose** | Compensating rest for weekend work, and any weekend premium, belong to attendance and payroll (M10, M11). This module only counts days off. |

---

## 4. How far back leave can be recorded

**Question.** Somebody was off sick last Tuesday and nobody entered it. How far
back may a request be dated — and does the answer differ for sick leave, which is
always after the fact?

**Why it matters.** Backdating moves days between payroll months. A loose rule
means a payroll that has been approved can still change underneath it.

| | |
|---|---|
| **Default** | 30 days for sick leave, 0 days for everything else — annual leave is asked for in advance or not at all. |
| **Where it is set** | Settings → Leave → **Rules**, `maxBackdateDays`, per type and effective-dated. |
| **Still open** | Whether anything may be backdated into a payroll month that is already locked. Today nothing stops it, because payroll locking is HR-03's. **This needs an answer before the two modules meet.** |

> **Confirmed by ConSAP on 23 November 2026:** sick leave may be dated back
> 30 days; everything else, not at all. Effective-dated per type, so a different
> answer from SMG is a new rule row rather than a change to the code.

---

## 5. How much notice a request needs

**Question.** How many days before the first day off must a request be made, and
who may waive it?

**Why it matters.** It is the difference between a rota that can be planned and
one that cannot — which, in a kitchen, is the whole argument.

| | |
|---|---|
| **Default** | 7 days for annual leave, none for sick, maternity, paternity or exceptional leave. Short notice is a **warning, not a refusal**: the request goes through and the approver is told. |
| **Where it is set** | Settings → Leave → **Rules**, `minNoticeDays`, per type and effective-dated. |
| **Still open** | Whether HR should be able to refuse on notice alone, or whether the manager always decides. |

---

## 6. "Too many people off at once"

**Question.** At what point is a department too thin to let one more person go?

**Why it matters.** Nobody wants the system to decide this; everybody wants to be
warned before they approve it.

| | |
|---|---|
| **Default** | More than **a third of a department** off on the same day. Shown to the person making the request *and* to the person approving it. **It never blocks anything.** |
| **Where it is set** | Settings → Leave → **Policy**, one threshold for the tenant. |
| **Still open** | Whether the threshold should be per department — a kitchen at 30 % down is in more trouble than administration — and whether it should count only the same role rather than the whole department. |

---

## 7. Documents, and which absences need one

**Question.** Which leave types need a document, how soon after the absence, and
what happens if it never arrives?

| | |
|---|---|
| **Default** | Sick leave and maternity/paternity leave ask for a document; nothing refuses a request that has none. The file lands on the employee's Documents tab like any other. |
| **Where it is set** | Settings → Leave → **Types**, one switch per type. |
| **Still open** | A deadline for producing it, and what the system should do when it passes. |

---

## 8. Public holidays

**Question.** Please confirm the 2026 and 2027 dates, and tell us who maintains
them from 2028.

**Why it matters.** Several Moroccan holidays move with the lunar calendar, so
they are **entered, never calculated** — the system has no opinion about when Eid
falls. A wrong date silently changes how many days a request costs.

| | |
|---|---|
| **Default** | The fixed national days are seeded for 2026 and 2027. Every row is marked **"to confirm"** and shows as unconfirmed on the screen until SMG says otherwise. |
| **Where it is set** | Settings → Leave → **Public holidays**, per country and year. |
| **Still open** | Whether SMG closes on any day that is not a national holiday — an inventory day, for instance — and whether the outlets follow a different calendar from the head office. |

---

## 9. Cancelling leave that has already been approved

**Question.** Who may cancel approved leave, and does it need approving again?

| | |
|---|---|
| **Default** | The employee may ask to cancel; the request goes back to the approver as **"cancellation pending"**, and the days are only returned to the balance once that is granted. HR can cancel outright, with a reason, which is recorded. |
| **Where it is set** | Not a setting today — it is how the flow works. |
| **Still open** | Whether cancelling leave that has already started should be possible at all. |

---

## 10. Leave when somebody leaves

**Question.** What happens to an unused balance when an employee leaves — paid
out, lost, or carried to a final payslip?

| | |
|---|---|
| **Default** | Nothing. The balance simply stops being counted when the file becomes a leaver. |
| **Where it is set** | Not built. It is a payroll question (M11), and we would rather hear the answer before building it. |

---

## 11. An approver who is away

**Question.** When the person who should approve a request is on leave
themselves — or has left — who decides?

**Why it matters.** Requests stop. A manager away for a fortnight in August is
exactly when their team books time off, and a request nobody can approve is a
request the employee cannot plan around.

| | |
|---|---|
| **Default** | Nothing automatic. HR can decide any request in place of the line manager; it is recorded as an **HR decision with a reason** and shown on the request, so stepping in is visible rather than invisible. Where a request has nobody to approve it at all — the general manager's own leave, or an employee with no manager on file — it goes to HR from the start. |
| **Where it is set** | Settings → Leave → **Policy**, for the address HR notices are sent to. The override itself is not a setting: it is who HR are. |
| **Still open** | Whether SMG wants real **delegation** — "while I am away, Mouad approves for me", with a start and an end date — or whether HR stepping in is enough. Delegation is deliberately **not built**: it is a week of work and a new way for a request to reach the wrong person, and we would rather hear the answer first. |

---

## 12. Who HR notices go to

**Question.** Which address should requests with no line manager be sent to?

| | |
|---|---|
| **Default** | One address per company, seeded as the demo's HR account. A team address rather than a person, so that it survives somebody leaving. |
| **Where it is set** | Settings → Leave → **Policy**. |
| **Still open** | Whether more than one person should be told, and whether a request sitting unanswered for a few days should chase somebody. Nothing chases anybody today. |

---

## 13. When a holiday or a rule changes under a request

**Question.** Who should be told, and who decides, when a change to the calendar
or to a rule moves the number of days an existing request costs?

**Why it matters.** This is the one place where an administrator editing a
setting could quietly change what somebody is paid.

| | |
|---|---|
| **Default** | Requests still waiting for a decision are **counted again at once**, and the person who asked and the person deciding are both told — the request shows what it was and what it has become. Requests that are already **approved are not touched**: they keep what was agreed and appear on HR's **"to review"** list with both numbers, and the balance only moves when HR accepts the difference, which is audited. |
| **Where it is set** | Not a setting — it is how the flow works. Leave → **To review** (HR only). |
| **Still open** | Nothing in the flow itself. What happens to a **closed payroll month** is settled below. |

> **Default, to be confirmed by the payroll expert** (chosen by ConSAP on
> 24 November 2026): **a closed payroll month is never reopened.** When a change
> to leave falls inside one, the difference is written down as a **correction
> record** against the next open month, carrying the employee, the original
> month, the leave type, the day difference, whether the days are paid, a link
> back to the request and the reason. The payroll engine reads these when it
> arrives (M10).
>
> A request straddling a closed December and an open January is split: the
> December days become a correction, the January days simply change.
>
> **What this needs from the expert:** whether a correction should be paid in
> the next month at the next month's rate, or at the rate of the month it came
> from; and whether an unpaid-leave correction behaves the same way as a paid
> one. Both change the payslip and neither changes this record.
>
> Built as `leave_correction`, with a minimal `payroll_period` table
> (month, open or locked) seeded with October 2026 locked and November 2026
> open. **HR-03 takes that table over** and gives it the rest of what a payroll
> period is.

---

## 14. "The holidays for this year are finished"

**Question.** Who says that a year's public holiday list is complete, and by
when each year?

**Why it matters.** The moveable religious holidays are announced each year, so
a list can be entirely correct in March and still be missing three days. Until
somebody says a year is finished, every request falling in it is counted on an
incomplete calendar.

| | |
|---|---|
| **Default** | A per-year switch, off until an administrator turns it on. While it is off, every request touching that year warns the requester, the approver **and** HR that the day count may still change. 2026 is seeded as complete and 2027 is not, which is what the demo shows. |
| **Where it is set** | Settings → Leave → **Public holidays** → "Holidays complete for {year}". |
| **Still open** | Who at SMG owns this each year, and whether we should refuse to approve leave in a year that is not finished rather than only warning. Today it only warns. |

---

## 15. What happens to days left at the end of the year

**Question.** For each leave type: does everything left carry into the new year,
does some of it, or is it lost? And how long do carried days last?

**Why it matters.** It is the one rule that can quietly take days away from
everybody at once, on a date nobody is watching.

| | |
|---|---|
| **Default** | Annual leave carries **up to the limit on its rule** (18 days today, itself a demo value), and carried days **run out six months into the new year**. Every other type carries nothing. All of it is demo data, marked "to be confirmed" on the Rules tab. |
| **Where it is set** | Settings → Leave → **Rules**, per type and effective-dated: `carryOverMode` (everything / up to a limit / nothing), `carryOverMaxDays`, `carryOverExpiryMonths`. |
| **Still open** | The three answers per type, and whether the expiry should be a number of months or a fixed date such as 31 March. A fixed date is a small change; it is not built because the question has not been asked yet. |

**How it runs.** Year end is a batch over the whole company. It is **previewed
before it is applied** — the preview does the same arithmetic and writes
nothing — and it can be **run again safely**: one row per person per type per
year, so a second pass replaces a figure rather than adding to it. A corrected
rule or a late adjustment is fixed by running it again.

> **Note for the build:** it runs inside the request that asks for it today,
> which is fine for a few hundred people. When Redis and BullMQ arrive it
> becomes a queued job; the shape — a run row, a preview, an idempotent apply —
> is already what a worker would want.

---

## 16. How long imported attendance files are kept

**Question.** An imported device file is kept whole, as the evidence behind the
worked days built from it. For how long? And the punches themselves — do they
stay for the life of the employment, or are they cleared after a period?

**Why it matters.** A punch file is personal data: it says where somebody was
and when, every day, by the minute. **Law 09-08** requires personal data to be
kept no longer than the purpose needs, and the purpose here is payroll and the
ability to answer a dispute about it. "Indefinitely, because storage is cheap"
is not an answer the law accepts, and it is the answer every system gives by
default unless somebody sets a period.

| | |
|---|---|
| **Default** | **None set.** Files and punches are kept indefinitely today. This is a gap, not a decision. |
| **Where it would be set** | A retention period per tenant, with a job that clears files past it and leaves the worked days — the days are the payroll record and have their own retention; the raw file is the evidence behind them. |
| **Still open** | The period, for both the file and the punches. The usual anchor is the payroll retention period, since that is what the evidence supports; SMG and whoever advises them on 09-08 decide. Whether a CNDP declaration covers this processing is part of the same question. |

> **Note for the build:** nothing deletes attendance data today, so no data is
> at risk of being lost while this is open. The work is a retention setting and
> a job, and it is small — but it cannot be designed before the period is known.

---

## 17. Night hours that are not overtime

**Question.** Do **scheduled** hours worked at night carry a premium at SMG —
the pastry shift's 04:00 to 06:00, for instance — whether by law or by internal
policy? Today those hours are ordinary pay.

**Why it matters.** The pastry shift starts at four in the morning, every day,
by design. Those two hours are not overtime: they are that job's normal day,
and the engine deliberately treats them as ordinary time so that starting early
is never mistaken for working late. Whether they are *paid differently* is a
separate question, and nobody has answered it. If they should be, every pastry
payslip since go-live would be wrong.

| | |
|---|---|
| **Default** | **No premium.** Scheduled night hours are paid as ordinary hours. Overtime bands apply only to hours beyond the normal day. |
| **Where it is set** | Settings → Attendance → overtime bands (`overtime_rule`), effective-dated per band. |
| **Still open** | Whether the premium exists, at what rate, and between which hours. For the payroll expert as much as for SMG: if it is a legal minimum rather than company policy, the answer is not SMG's to give. |

**If yes, add a row with `appliesTo = all_hours`: a setting, no code change.**

> **How it behaves.** A band marked `all_hours` is paid for every minute inside
> its window — scheduled minutes included — and it is paid **on top of** any
> overtime band the same minute already earned, not instead of it. An hour of
> overtime at eleven at night is therefore both `OT_NIGHT` and `NIGHT_PREMIUM`.
> The premium minutes are kept in their own column on the day, apart from the
> overtime ones, because the same minute appears in both and adding the two
> together would count it twice. Adding the row is an effective-dated change
> like any other: days rebuilt afterwards record the new rule version, and days
> already built keep theirs until they are rebuilt.

---

## 18. Recovery leave: the unit, and what an hour is worth

Settled for the build (spec §4.1), with one question left for SMG.

**What is built.** A worked public holiday or rest day can be **converted to
recovery** instead of being paid as overtime. `RECOVERY` is a seeded leave type
marked "to confirm": paid by the employer, with a balance of its own.

| | |
|---|---|
| **The unit is hours, not days.** | A recovery balance is minutes worked, and it is spent in minutes. When somebody takes recovery leave the hours come off using **that day's scheduled hours** — an eight-hour day costs eight hours. Days would be a lie here: four hours owed from a Sunday morning is not "half a day" to somebody whose shift is twelve hours. |
| **The ratio is a setting**, default **1 hour worked = 1 hour of recovery.** | Seeded "to confirm". |
| **Credits are insert-only** balance movements, each linked to the work day it came from and the exception that converted it. | The same rule as every other piece of evidence in this schema: a balance is worked out from movements, never edited. |

**Still open — the question for SMG and the payroll expert.** Does SMG give
recovery **1:1**, or at the **holiday or rest-day rate** — an hour worked on a
public holiday earning an hour and a half off? The default is 1:1 because it is
the smaller promise; if the answer is the rate, it is the same setting with a
different number, and no code changes.

> **No double payment, in both directions.** Once minutes are converted to
> recovery they **stop producing overtime and holiday payroll variables**: the
> company has agreed to pay them in time instead of money, and paying both would
> be paying twice for the same hour. Undoing a conversion — with a reason, and
> audited — puts those minutes back into pay. Both directions are unit-tested,
> because this is the one place where a mistake quietly doubles somebody's day.

---

## Later, not now

Noted so it is not forgotten, and deliberately out of HR-02:

- **Department and site names in both languages.** Leave types are translated
  properly (the seeded codes have EN and FR, with the stored name as a fallback).
  Departments and sites are still shown exactly as they are stored, which is why a
  French screen says "Kitchen". They need the same treatment as leave types, as
  its own piece of work. **Public holiday names belong with them**: they are typed
  in once, in one language, and shown to everybody — the seeded list is in
  English and reads as English on a French screen.
- **One spreadsheet library.** Workbooks are written with **exceljs**
  (approved 24 November 2026), and every xlsx export — the attendance file
  specification, the decisions board, the payroll variables — uses it. The HR-01
  employee data template is **not built yet**; when it is, it uses exceljs too.
  There is no second library to migrate today, and there should never be one.
- **Compensating rest and weekend premiums** — attendance and payroll, M10/M11.
- **Attendance-driven accrual** — leave is earned per month worked today, with
  the period itself a setting (monthly, quarterly, annual). Whether unpaid
  absence should interrupt accrual is a question for M10.
- **The attendance import runs in the request, not in a job.** The build spec
  asks for BullMQ (§5.3). It is written as a worker would want it — an import
  row carrying its own status, its counts and the file it read — but the work
  happens while the button is held: a month for forty-four people is fourteen
  hundred punches and seven hundred days, written in a handful of statements.
  **Trigger: production, or more than about 200 employees in a tenant,
  whichever comes first.** `TODO(M18)` in `attendance-import.service.ts`.
- **The imported file is kept in the database, not in object storage.** The
  import row carries the text of the file it read and a SHA-256 of it, taken
  when it was read. Both columns are write-once — the runtime role has no
  `UPDATE` on either — and the confirmation re-hashes the bytes before it
  builds anything, so what is written is what was shown, and "the device never
  said that" has an answer. `file_key` is already in the table for the move to
  RustFS/S3. **Trigger: production, or more than about 200 employees in a
  tenant, whichever comes first** — the same gate as the job queue, and the two
  are best done together.
- **The `appliesTo` field has no screen yet.** The column and the engine are
  built, but `/settings/attendance` has only the `source` tab today — the
  `overtime` and `schedules` tabs are still to come (build spec §7). Until the
  overtime tab exists, an `all_hours` band can only be added as a seed or a
  migration, which is enough to answer open point 17 but is not yet the
  self-service setting it should be. **The field, its EN/FR labels and its
  tooltip belong with step 8**, where that tab is built.
- **The premium has nowhere to show yet.** `work_day.premium` is written on
  every build, but the day detail that would show a `NIGHT_PREMIUM` line is part
  of the timesheets in **step 7**, and the payroll variables that would pay it
  are **step 10**. The figure is stored correctly in the meantime, so neither
  screen has to go back and recompute anything.
- **"Confirmed by SMG" has no history row yet.** §7.1 asks that confirming a
  defaulted row store **who and when, insert-only**. What exists today is the
  `confirmed` boolean on the row, plus an `audit_event` — itself insert-only —
  recording who changed a rule and when, including `confirmed` from and to. So
  the information is captured, but not as the per-row confirmation record §7.1
  describes, and there is no "Confirmed by SMG" button to write one. **Step 8**,
  which builds the chips, adds both. Note that `confirmed` is deliberately left
  updatable on the locked rule tables precisely so that this can work: a
  confirmation does not change what a rule says, it records that somebody
  checked it.
- **`leave_rule` deserves the same database lock as `overtime_rule`.** The
  application already treats it correctly — a change writes a new row and only
  closes the previous one — but nothing in the database stops an in-place edit
  of a rate. Its own small PR, before step 8 builds any editing screen.
- **Four e2e files change data and change it back by hand.**
  `organisation.spec.ts` moved a cost centre and restored it in the same test;
  when that test failed in between, the kitchen was left costing against the
  wrong centre and the *next* run failed on a different test that was only
  asserting the seeded value. That one now resets the demo data before and
  after, like the fourteen files that already did. `employee-file.spec.ts`
  (salary, phone), `settings.spec.ts` (phone) and `hire.spec.ts` (creates a
  person) still restore by hand. None has caused a failure yet, and `hire` is
  followed by a file that resets — but the pattern is the same one, and the fix
  is two lines each when somebody is next in there.
- **Two e2e files restore data by hand, and are flaky because of it.**
  `contracts.spec.ts:126` ("marking a contract signed ticks the onboarding item
  that waited for it") and `employee-file.spec.ts:115` ("HR changes a salary,
  and the history says so") both failed once and passed on retry in the run
  behind #26. They change data and change it back in the same test, which is
  the pattern that already caused a real failure in `organisation.spec.ts`.
  **Agreed fix, after step 6:** give them isolated data or a reset per test
  instead of restoring by hand.
