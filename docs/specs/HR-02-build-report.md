# HR-02 build report

What was built against `docs/specs/HR-02-build-spec.md`, step by step, with the
decisions taken without asking and the things still owed. Newest step last.

Every figure that touches pay or leave is a **seeded demo value marked "to
confirm"** (CLAUDE.md rule 3). None of them is a legal value, and none was
written from memory. The questions they stand in for are in
`docs/specs/HR-02-open-points.md`.

---

## Steps 1–4 — the ground the rest stands on

### Step 1 — a company of forty-four, and a switch that is enforced

**PR #16.** The demo tenant was reseeded to the 44 people SMG described, across
five departments, with employee numbers starting at 1001 — the numbers the
attendance devices will send, which is why they are a setting and not a format
baked into code.

**Worth knowing:** "employees can see their base salary" is **enforced in the
API**, not hidden in the screen. The figure is absent from the answer when the
switch is off, rather than present and not drawn — the difference between a
setting and a decoration. It also forced a real fix: the employee pay tab had
been formatting a number that was no longer there and showing `MAD NaN`, so the
row is masked instead.

### Step 2 — leave requests that keep their evidence

**PR #17**, with the §10 smoke test following in **#18**.

Requests, the N+1 then N+2 then HR chain, the overlap block, the soft warnings,
the Mailpit e-mails and the audit trail. The decision that shaped everything
after it: **a request stores the arithmetic that produced it** — the day count,
the half-day markers, and the versions of the rules and holidays used — at
submission and again at approval.

**Worth knowing:** because the calculation is stored rather than recomputed, a
later change to a holiday or a work week cannot silently move an approved
request. Instead the affected requests appear on a **"To review"** list showing
the old and the new count, and HR accepts each one. Pending requests are
recalculated and the requester told; approved ones keep what was agreed until
somebody decides.

### Step 3 — the rota decides what a day costs

**PR #19.** Shift patterns, work schedules, and the weekly rest day, with the
leave day-count reading them.

**The defect worth remembering:** the seed wrote day counts from the *site's*
working week while the API counted them from the *person's rota*. Every outlet
and kitchen request disagreed with itself, and "To review" filled up on a fresh
demo. The seed now counts the way the application does, all **15 demo requests
agree**, and a test pins it: *"a fresh demo opens with nothing to review"*. A
seed and an application that compute the same thing differently is a class of
bug worth naming, because it looks like a data problem and is not.

### Step 4 — a specification the provider can answer

**PR #20.** Where punches come from, the column mapping as a **setting** rather
than a release, a generated sample export, and the file specification as a
four-sheet workbook to send to the device provider (P09, due 15 December).

**Worth knowing:** the sample is generated from the seeded company every time
rather than stored, so it cannot go stale when somebody reseeds — and it
carries, on purpose, every anomaly the import must find. The provider reading
the specification knows exactly what will be checked.

---

## Step 5 — the import wizard, and what a worked day is worth

**PR #21, merged.** Full suite 111 passed, 0 failed, 16 skipped.

The wizard takes the sample, tries the real file, then writes it. The trial
reads the file in full and writes nothing, so what the reader sees before the
button is what the button does. Overtime is a pure function: the first ordinary
hours of a day are ordinary whenever they happen, so a four-in-the-morning start
is not night-rate pay, and a week over its threshold never pays twice for an
hour a day already counted.

**Three defects found by making the screens prove their claims.** The sample
treated only 18 November as a holiday though November 2026 has two, so importing
it flagged 68 holiday days against the 30 it claimed. The two "duplicates" were
placed a fixed minute after the shift start while the real punch carried ten
minutes of noise, so they were often minutes apart and not duplicates at all.
And the commit took over a minute — four queries per day across seven hundred
days — now batched, with a test that fails if it ever needs thirty seconds.

**And one that was not attendance.** A reseed never restored the company
switches: the seed had never written `tenant_settings`, so anything flipped
during a demo survived every reset. Fixed, and worth knowing before the next
workshop — flipping salary visibility in front of SMG used to be permanent.

**Deviations, both recorded with triggers:** the import runs in the request
rather than a BullMQ job, and the file is kept in the database rather than
RustFS. Trigger for both: production, or ~200 employees in a tenant.

---

## Step 5a — a premium on hours that are not overtime

Added at the client's request between steps, as its own change.

`overtime_rule.applies_to` (`overtime` | `all_hours`, default `overtime`) lets a
night premium be **a row in a table rather than a change to the engine**, which
is what open point 17 needs if SMG says scheduled night hours are paid
differently. An `all_hours` band is paid for every minute in its window, on top
of any overtime band for the same minute, and the minutes are kept in their own
column because the same minute appears in both.

There is **no `all_hours` row in the seed**: the default answer is "no premium",
and seeding one would quietly decide a question nobody has asked.

**`calcVersion` is now a SHA-256** over the rules in force and the settings used,
so two different rule sets can never share a version. It previously counted rows
and took the newest timestamp, which would have missed a rate corrected on an
older row. Days also record `overtime_rule_ids`, as a leave calculation records
the rule and holidays it applied.

**Overtime rules are write-once in the database.** `UPDATE` is revoked except on
`effective_to`, `confirmed`, `note` and `updated_at`, so a rate cannot be edited
in place — a correction is a new effective-dated row. Nothing writes these rules
yet, which is exactly why it was done now: the screen that will edit them is
step 8.

---

## Step 6 — the exceptions, and the hours that are owed back

Build spec §5.4, plus the recovery design SMG asked for mid-step.

### Recovery: hours, not days

A worked public holiday or rest day can be settled in **money**, as overtime, or
in **time**, as recovery — and never both. `leave_recovery_credit` is
insert-only, like the punches and the leave calculations: the balance is the sum
of its movements and is never stored, so it cannot drift from the rows that
explain it.

**Minutes, not days.** Four hours owed from a Sunday morning is not "half a day"
to somebody whose shift is twelve hours, so the balance is kept in the unit it
was earned in and spent at the scheduled hours of the day it is taken.

**The ratio is taken from when the credit was earned, not from today's
setting.** At time-and-a-half, 720 minutes were credited for 480 worked, so an
hour of leave taken settles *forty* minutes of work rather than sixty. Using the
current setting would move the balance a little every time somebody changed
their mind after a rate change.

RECOVERY is seeded as an eighth leave type: paid, balance-tracked, with no
entitlement and no accrual — nothing is given, only given back.

### Undoing it, when the time is already spent

**Blocked by default**, with the screen saying how much has gone. HR can
override with a reason, and then the credit is cancelled **in full** — so the
balance goes below zero and the debt is visible rather than quietly absorbed —
while the pay comes back **only for the part not already taken**. Three hours
settled in time plus five hours paid is the eight that were worked.

**The restored bands add up exactly.** Scaling each band on its own and rounding
loses or invents a minute: three bands of a 7 h 23 min day scaled to 180 minutes
round to 179. The floors are handed out first and the remainder goes to the
largest fractional parts, ties breaking on the larger band and then the code so
the same day always gives the same answer. **A night premium earned by those
same hours is cut by the same proportion** and apportioned the same way, so it
adds up too. A property test covers every target from 1 to 443 minutes.

### The exception list and its seven answers

Grouped by kind, because the same question asked forty times has one answer and
forty rows. Map a number to a person, add the punch that never arrived, mark an
absence unpaid, confirm a worked holiday as overtime or convert it to recovery,
undo that, and confirm or ignore the rest with a comment. **The reason is always
required** and lands in the audit log under the name of whoever gave it; **a
fixed day becomes `mixed`**, so tomorrow's file does not undo an afternoon
somebody put right.

### Three defects the tests found

**An empty branch inside an `OR` matches nothing.** The list asked for "a day the
reader may see, **or** no day at all" as
`OR: [{ workDay: scope }, { workDayId: null }]`. For HR the scope is empty, the
branch dropped out, and HR saw only the three exceptions with no day while the
counts beside them said forty-four.

> **This corrects an earlier explanation**, in a commit message and in a code
> comment, which said Prisma reads `{ relation: {} }` on a *nullable* relation as
> matching nothing. It does not. Measured: `{ workDay: {} }` on its own returns
> every row — which is exactly what makes `employeeScope()` returning `{}`
> correct everywhere else it is used. It is only **inside an `OR`** that an empty
> branch turns into its opposite. The fix was right; the reason was not. Three db
> tests now pin the real behaviour.

**A manager could not reach their own team's exceptions.** The screen asked for
the sample export first, which needs `attendance.import` — an HR capability. So
the whole screen was gated behind a permission managers do not have, which is
precisely what `attendance.view` exists to avoid. The sample is now fetched only
for the tab that needs it.

**A manager's department filter offered every department**, including ones whose
days he cannot see — a filter that always returns nothing, which reads as a
fault. It now offers the departments of the people he manages.

### A new test that was born flaky, and why

The import-and-group test needed a retry in the full suite but never standalone.
It runs **first** alphabetically, so it inherited whatever the previous run left
behind — and it was the one data-touching file in the suite that reset only
*afterwards*. Three causes removed, none of them a longer timeout:

1. it resets before as well as after, like every other such file;
2. the import helper locates fields by id rather than by **translated label**, so
   it no longer depends on which language the screen settled into;
3. it asserts the form is present within thirty seconds with a plain message,
   instead of waiting out a four-minute timeout on a field that was never coming.

### Open points this step raised

- **18 — recovery leave: the unit, and what an hour is worth.** Hours not days;
  the ratio a setting defaulting to 1:1. Open: does SMG give 1:1, or the holiday
  rate?
- **19 — undoing a conversion after the time has been taken.** Open: should HR be
  able to override at all; is a negative balance acceptable, or should the
  shortfall be settled another way; is the employee told?
- **20 — which hours count as already settled.** Proportionally by default;
  dearest-first and cheapest-first are the alternatives. A setting candidate for
  the payroll expert, not a fork in the code.

---

## Infrastructure — a false green, and what stopped it happening again

A full-suite run was reported here as green when one test had in fact failed
twice. The run had been piped through `tail`, which truncated the summary and
replaced Playwright's exit status with `tail`'s own. Nothing was merged on that
run, and the run behind the step 5 merge was checked afterwards and accounted
for all 127 tests.

The failure itself was a session expiring mid-run: sessions were signed in once
at the start and never refreshed, so after about thirty minutes Keycloak had
forgotten them and whichever test came next failed while waiting for a language
button. Three fixes:

- `openAs` refreshes a stored session before using it, and signs in again if the
  page turns out to be Keycloak's. No realm setting was changed.
- CI keeps the Playwright report **always**, not only on failure — a flaky run
  passes, so the one artifact that showed flakiness was the one never kept — and
  `scripts/e2e-summary.mjs` writes failures *and* retries into the job summary.
- Suite runs are no longer piped through anything that can hide an exit status.

---

## Notes for step 8 — before any rate gets an input box

Step 8 builds the settings screens, and it is the first time anybody will
**type** a rate rather than read one. Two things have to be true before that
happens, decided 28 November 2026.

### Every rate is typed and shown as a percentage

**One shared input component**, used by every rate on every settings screen,
with a **`%` suffix**. Somebody entering twenty-five per cent types `25`,
everywhere, with no exceptions and nothing to remember.

**The API converts to whatever the column stores** — a fraction or a percentage,
depending on which one it is. That conversion lives on the server, once per
field, and never in a screen.

**The user never sees a fraction.** `0.06` is not shown, not typed, and not
explained; it is six per cent on the way in and six per cent on the way out.

### Why, and what is already underneath

Two columns hold rates, in two shapes, and both are correctly named:

| Column | Holds | 25% is stored as |
|---|---|---|
| `overtime_rule.rate_percent` | a **percentage** | `25.00` |
| `tenant_contribution_rate.rate` | a **fraction** | `0.2500` |

They are not being aligned — the storage is right as it stands and changing it
would rewrite history for no gain. What was wrong was leaving the difference
where a person could meet it. So the database now refuses both directions of the
mistake, and a screen that forgets the rule above fails a test rather than a
payslip:

- `tenant_contribution_rate_is_a_fraction` — between 0 and 1, so six per cent
  cannot be entered as `6`
- `overtime_rule_rate_is_a_percentage` — zero, or between 1 and 300, so
  twenty-five per cent can be neither `0.25` nor `2500`

Note the asymmetry in the second one: a ceiling alone would not have caught
`0.25`, because it sits comfortably inside any sane range. The floor is what
catches the fraction, and zero stays allowed because a band switched off is a
real thing to want.

Both are covered in `packages/db/test/rls.spec.ts`.

---

## Notes for step 10 — closing a month

Decided 28 November 2026, before the close is built.

### An open exception blocks the close. All of them.

The checklist that closes a month treats **any open attendance exception as
blocking** — not a warning, not a count on a dashboard. That includes the two
that look harmless:

- **`OVER_DAILY_MAX`** — somebody worked longer than a day is allowed to be. It
  is open precisely because nobody has said whether that is right.
- **`WORKED_HOLIDAY`** and **`WORKED_REST_DAY`** — the day is worth overtime at
  a holiday rate, or it is owed back as time, and until somebody chooses it is
  worth neither. Closing the month with it open picks one of those answers by
  accident.

**No overtime reaches payroll without a recorded decision.** That is the rule,
and it is the reason every fix in §5.4 requires a reason: the decision and the
person who made it are what a payslip is defended with three months later.

### What the test has to prove

When step 10 is built, the test is not "the close warns about exceptions". It
is:

1. a month with one open exception of **each** code **cannot** be closed;
2. answering it — including with `confirm`, which changes no figures — lets the
   close proceed;
3. the payroll variables for that month contain **no** overtime minutes from a
   day whose exception is still open.

The third is the one worth writing first. The first two are about a button; the
third is about what reaches somebody's pay.

### Where this bites

`absences-for-payroll.service.ts` already answers "what did this month cost in
absence". The overtime equivalent will read `work_day`, and the natural
implementation reads every day in the period. It must not: it reads every day
whose exceptions are all answered, and the close refuses while any remain.
