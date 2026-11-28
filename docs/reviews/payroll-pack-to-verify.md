# Morocco pack — values to verify

*For the payroll expert. `packages/country-packs/ma/pack.json`, pack version
2026.1.0, status `prototype`. Prepared 27 November 2026.*

**None of these figures has been verified by anyone qualified.** Every one is
`status: "unverified"` and carries `TODO(verify-official-rate)`. The engine
**refuses to calculate in production** while that is true
(`packages/payroll-engine/src/engine.ts:258`), and a `prototype` pack runs only
outside production, watermarked `SPECIMEN` (`pack.ts:222-235`). So nothing here
can reach a real payslip until it is signed off — that is the point of the
exercise, not a reason to delay it.

**How to use this.** For each row: compare the value against the official
source named in the last column, then either correct it or mark it verified.
A verified row needs **who and when** recorded, and the validator enforces that
(`validate.spec.ts`: *"refuses a verified row without who and when"*).

**The headline.** 15 of the 20 rows were read from **secondary sources** —
consulting firms' articles and, in two cases, a jobs site. The articles of law
are named and look right; the *numbers* were not read from the law. Those rows
are flagged ⚠ below.

---

## 1. Social contributions — check against CNSS

Source to check against: **CNSS circulars and the rate schedule published by
CNSS** (cnss.ma), under Dahir 1-72-184 and AMO law 65-00. For the AMO solidarity
component, the finance law that introduced it.

| Key | Value in the pack | From | Cited source | Flag |
|---|---|---|---|---|
| `CNSS_CEILING` | `6000` | 2025-01-01 | upsilon-consulting.com article, read 25 Nov 2026 | ⚠ consulting blog |
| `CNSS_EE_RATE` | `0.0448` *(noted as short term 0.52% + long term 3.96%)* | 2025-01-01 | same article | ⚠ consulting blog |
| `CNSS_ER_RATE` | `0.0898` *(noted as short term 1.05% + long term 7.93%)* | 2025-01-01 | same article | ⚠ consulting blog |
| `AF_ER_RATE` | `0.0640` | 2025-01-01 | same article | ⚠ consulting blog |
| `AMO_EE_RATE` | `0.0226` | 2025-01-01 | same article | ⚠ consulting blog |
| `AMO_ER_RATE` | `0.0411` *(noted as including the 1.85% solidarity contribution)* | 2025-01-01 | same article | ⚠ consulting blog |
| `TFP_ER_RATE` | `0.0160` | 2025-01-01 | same article | ⚠ consulting blog |

Specific things to confirm, beyond the numbers:

- whether the **ceiling applies to CNSS only** and not to AMO. The pack applies
  it that way — a 10,000 salary gives CNSS on 6,000 and AMO on 10,000 — and the
  golden cases lock that in.
- whether the **TFP** belongs in payroll at this rate, and on which base.
- whether the **AMO employer rate should carry the solidarity contribution
  inside it**, or be two separate lines on the payslip.

---

## 2. Income tax — check against the CGI and the DGI

Source to check against: **Code Général des Impôts, articles 57, 59, 73 and
74**, as amended by the finance law in force, published by the **DGI**
(tax.gov.ma) and in the **Bulletin Officiel**.

### The scale, `IR_ANNUAL` (annual, with the quick-calculation deduction) ⚠

Cited source: *"CGI art. 73 scale applicable since 1 Jan 2025, unchanged by
finance law 2026"* — read from **upsilon-consulting.com and a dreamjob.ma worked
example**. The article is named; the figures came from a consulting blog and a
jobs site.

| Up to (annual) | Rate | Deduct |
|---|---|---|
| 40 000 | 0 | 0 |
| 60 000 | 0.10 | 4 000 |
| 80 000 | 0.20 | 10 000 |
| 100 000 | 0.30 | 18 000 |
| 180 000 | 0.34 | 22 000 |
| above | 0.37 | 27 400 |

Confirm both the **bands and the deductions**, and that the scale is **still the
one in force for the 2026 finance law**.

### And how the scale is applied, month by month ⚠

A question of **method**, not of figures, and it changes the last centime of
every payslip. The engine takes the annual scale, applies it to twelve times the
month, and divides by twelve. A monthly table whose deductions are rounded
first — 22,000 ÷ 12 = 1,833.33 — gives a different answer.

Golden case **G03** (14,000 base, 7 years' service, 2 dependents) is where the
two part company:

| Method | Monthly income tax |
|---|---|
| Annual scale on 12 × the month, ÷ 12 — **what the engine does** | **2,201.27** |
| Monthly table with the deduction rounded to 1,833.33 | 2,201.28 |

One centime, every month, for every employee — and the one that is right is
whichever the DGI expects on the declaration. Please confirm **which method**,
and whether the monthly deduction is rounded and to how many decimals. Noted in
the test file itself (`golden.spec.ts`, G03) and in spec §12.

### Professional expenses, CGI art. 59 ⚠

| Key | Value | Cited source |
|---|---|---|
| `PROF_EXP_THRESHOLD_ANNUAL` | `78000` | "secondary sources, 25 Nov 2026" |
| `PROF_EXP_RATE_LOW` | `0.35` | same |
| `PROF_EXP_RATE_HIGH` | `0.25` | same |
| `PROF_EXP_CAP_ANNUAL` | `35000` | same |

The pack's own note records this as **spec open point O15: the base and cap of
the 35% band**. Confirm which income the 35% applies to, and whether the cap is
annual and per employee.

### Family deduction, CGI art. 74

| Key | Value | From | Cited source | Flag |
|---|---|---|---|---|
| `FAMILY_DEDUCTION_ANNUAL` | `500` | 2025-01-01 | "secondary sources" | ⚠ unnamed |
| `FAMILY_DEDUCTION_ANNUAL` | `600` | 2026-01-01 | upsilon-consulting.com + an Ecovis note | ⚠ consulting firms |
| `FAMILY_MAX_DEPENDENTS` | `6` | 2025-01-01 | "accelerators CT09" | ⚠ internal document |

Confirm the 2026 amount, **the date it takes effect**, and that the maximum
number of dependents is six.

---

## 3. Minimum wage — check against the decree

Source to check against: **Decree 2.25.983 of 29 December 2025, Bulletin
Officiel 7469**, and the decree behind the 2025 rate.

| Key | Value | From | Cited source | Flag |
|---|---|---|---|---|
| `SMIG_HOURLY` | `17.10` | 2025-01-01 | "Decree on the minimum wage, 2025 rate (secondary sources)" — no decree number | ⚠ unnamed, no reference |
| `SMIG_HOURLY` | `17.92` | 2026-01-01 | Decree 2.25.983 named, but **read on dreamjob.ma** | ⚠ jobs site |

The 2026 row names the right instrument; the number still came from a jobs site.
The 2025 row does not name a decree at all.

Also confirm whether the figure is the **non-agricultural SMIG**, and whether
SMAG (agricultural) is needed for any SMG employee.

---

## 4. Working time and seniority — check against the Labour Code

Source to check against: **Labour Code, law 65-99**, and the Bulletin Officiel.

| Key | Value | Cited source | Flag |
|---|---|---|---|
| `PAYROLL_DAYS` | `26` | "Moroccan payroll practice … accelerators OT03" | ⚠ practice, not law |
| `PAYROLL_HOURS` | `191` | "2,288 h a year ÷ 12 … accelerators OT03" | ⚠ practice, not law |
| `SENIORITY_RATES` | bands below | "Labour Code art. 350; accelerators PE02" | ⚠ article named, figures internal |

Seniority bands in the pack:

| From (full years) | Rate |
|---|---|
| 2 | 0.05 |
| 5 | 0.10 |
| 12 | 0.15 |
| 20 | 0.20 |
| 25 | 0.25 |

Confirm the **thresholds and the rates**, and — this one changes every overtime
line — whether the hourly rate is properly **(salary + seniority) ÷ 191**, which
is what the pack does and what golden case G06 locks in.

`PAYROLL_DAYS = 26` and `PAYROLL_HOURS = 191` are described as practice rather
than law. Confirm they are right for SMG's contracts, since every proration and
every overtime hour is calculated from them.

---

## 5. Not in the pack, and deliberately so

**CIMR is not here.** It is a rate agreed between one employer and the fund, so
it is a **per-company** value and lives in `tenant_contribution_rate` in the
database, effective-dated per tenant (decision of 27 November 2026, CLAUDE.md
rule 3). The pack takes `CIMR_EE_RATE` and `CIMR_ER_RATE` as inputs. Both are
stored as **fractions** — 0.06 is six per cent — and the database refuses
anything outside 0 to 1, so six per cent cannot be entered as `6`. SMG is
seeded at zero, which switches both lines off rather than guessing — the spec
records that SMG does not run CIMR today (CT05).

Still to confirm for CIMR when a company does run it: **the base it is
calculated on, and whether the employee's share is deductible for income tax.**
The pack's own note says both are unvalidated.

## 6. Named in the pack as not seeded yet

From the manifest note, so the expert knows what is absent rather than wrong:

- transport and meal **exemption ceilings** (spec open point O17)
- **work on public holidays**
- the **leave-pay average**
- **exit pay**

Religious holidays are entered per year and never calculated, by design.

---

## What "verified" will mean

A row stops being a risk when its `status` is `verified` and it records **who
signed it off and when**. At that point the production guard stops refusing it,
so sign-off is the switch that lets CPeople calculate real Moroccan payroll —
please treat it as that, and not as a formality.

The golden payslips in `packages/country-packs/ma/test/golden.spec.ts` will all
need re-checking against corrected values; the file says so at the top. They
currently prove the **engine applies the pack as written**, not that the pack is
right.
