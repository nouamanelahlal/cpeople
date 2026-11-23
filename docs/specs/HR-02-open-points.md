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
| **Still open** | Whether an approved request from a **closed payroll month** should ever be corrected, or whether the difference belongs in the following month instead. That is a payroll question (M10/M11) and the answer changes what "accept" should do. |

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

## Later, not now

Noted so it is not forgotten, and deliberately out of HR-02:

- **Department and site names in both languages.** Leave types are translated
  properly (the seeded codes have EN and FR, with the stored name as a fallback).
  Departments and sites are still shown exactly as they are stored, which is why a
  French screen says "Kitchen". They need the same treatment as leave types, as
  its own piece of work. **Public holiday names belong with them**: they are typed
  in once, in one language, and shown to everybody — the seeded list is in
  English and reads as English on a French screen.
- **Compensating rest and weekend premiums** — attendance and payroll, M10/M11.
- **Carry-over expiry dates** — the rules hold a carry-over limit but not a date
  by which carried days must be used.
