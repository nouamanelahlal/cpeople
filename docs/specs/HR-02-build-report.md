# HR-02 build report

What was built against `docs/specs/HR-02-build-spec.md`, step by step, with the
decisions taken without asking and the things still owed. Newest step last.

Every figure that touches pay or leave is a **seeded demo value marked "to
confirm"** (CLAUDE.md rule 3). None of them is a legal value, and none was
written from memory. The questions they stand in for are in
`docs/specs/HR-02-open-points.md`.

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
