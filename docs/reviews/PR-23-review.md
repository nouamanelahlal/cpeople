# PR #23 — country-neutral payroll engine, Morocco pack as data

*M12 / M13 / M24 / M27 · branch `feat/m12-m27-payroll-engine-country-packs`, head `b0f88a8` · read-only review, 27 November 2026*

Facts and file references. Nothing here was changed, and nothing is a rewrite.

**Scope of the branch:** 28 files, +3,692 / −0. Two new packages
(`packages/payroll-engine`, `packages/country-packs/ma`) and one line added to
the root `package.json`. It touches **no** existing source: no `apps/`, no
`schema.prisma`, no migration.

---

## 1. Where the legal values live

**All of them are in data, none in code.**

Every rate, ceiling, bracket and deduction sits in
`packages/country-packs/ma/pack.json` (1,369 lines) under `payroll.parameters`
— 20 entries. Each is a row of the shape:

```json
{ "key": "CNSS_EE_RATE", "type": "decimal", "value": "0.0448",
  "validFrom": "2025-01-01", "status": "unverified",
  "source": "… TODO(verify-official-rate)", "label": { "en": …, "fr": … } }
```

Values are **decimal strings, never floats** — `validate.ts:167` refuses a float
where a decimal string belongs, and `rational.ts` (139 lines) does the
arithmetic exactly.

**Searched for rate-like constants in TypeScript** across
`packages/payroll-engine/src/**` and `packages/country-packs/ma/src/**`
(`0.[0-9]{3,}` and `[0-9]{4,}`). Four matches, none of them a legal value:

| File | Line | What it is |
|---|---|---|
| `expression.ts` | 157 | formula length limit, 2,000 characters |
| `validate.ts` | 64, 66, 68 | ISO country / version / currency regexes |
| `validate.ts` | 167 | the string `"0.0448"` inside an error message |

`packages/country-packs/ma/src/index.ts` is 19 lines and only reads `pack.json`
through the same validator any imported country goes through.

**Effective dating is real, not decorative.** Two keys already carry two dated
rows, and `engine.spec.ts` has a test *"reads the parameter row in force on the
date"*:

| Key | Rows |
|---|---|
| `SMIG_HOURLY` | `17.10` from 2025-01-01, `17.92` from 2026-01-01 |
| `FAMILY_DEDUCTION_ANNUAL` | `500` from 2025-01-01, `600` from 2026-01-01 |

`validate.ts` refuses overlapping rows of the same parameter (test:
*"refuses overlapping rows of the same parameter"*).

**The one thing to weigh.** CLAUDE.md rule 3 says effective-dated parameter
**rows**. These are effective-dated rows **inside a versioned JSON file in the
repository**, not rows in a database table. There is no parameter table in
`schema.prisma` and this branch adds none, so a rate cannot be corrected in a
running environment without shipping a new pack. Whether that satisfies rule 3
or is a staging post towards it is a decision, not a fact — but it is the single
biggest structural question in this PR.

---

## 2. Is each value marked "to confirm", with its source?

**Yes, all 20, without exception.** Checked programmatically:

- missing `validFrom`: none
- `status` other than `"unverified"`: none
- missing `source`: none
- `source` without `TODO(verify-official-rate)`: none

The pack's own manifest says the same at the top level —
`"status": "prototype"`, and a note: *"Every value is unverified until SMG's
accountant or a payroll expert signs it off (spec open point O3)."* It also
lists what is **not** seeded yet: transport and meal exemption ceilings (O17),
work on public holidays, leave-pay average, exit pay.

`manifest.lawBasis` cites Labour Code 65-99, CNSS Dahir 1-72-184, AMO law 65-00,
CGI art. 57/59/73/74, finance law 2026, and decree 2.25.983.

**Worth a payroll expert's eye — the citations are not all primary.** The income
tax scale `IR_ANNUAL` cites, verbatim:

> "CGI art. 73 scale applicable since 1 Jan 2025, unchanged by finance law 2026
> (upsilon-consulting.com/ir-salarial-bareme-2026-maroc, dreamjob.ma worked
> example). TODO(verify-official-rate)"

A consulting firm's blog and a jobs site. The article of law is named, which is
the part that matters, but the figures were taken from secondary sources. The
same applies to the seniority bands (`SENIORITY_RATES`, art. 350, "accelerators
PE02"). This is exactly the class of value CLAUDE.md rule 11 asks to be
validated by an expert before it is trusted.

**There is a hard guard behind the flag, which is the strongest thing in this
PR.** `engine.ts:258` refuses to calculate at all when any parameter used is
unverified and the mode is production:

```
Unverified legal values cannot be used in production: …
```

and `pack.ts:222-235` allows a `prototype` pack to run **only outside prod**,
returning `specimen: true` so the output is watermarked. Both are tested
(*"refuses unverified legal values in production (CP-PCK-004)"*,
*"lets a prototype run outside production only, as a specimen"*). So today's
unverified Morocco pack **cannot** silently produce a real payslip.

---

## 3. Does it fit our stack and patterns?

It is a **pure library**, and that is the whole answer to most of this.

```
grep -rln "prisma|@cpeople/db|@nestjs|tenantId"  packages/payroll-engine/src
                                                 packages/country-packs/ma/src
→ no matches
```

`payroll-engine` has no runtime dependencies; `country-packs/ma` depends only on
`@cpeople/payroll-engine`.

| Pattern | Status in this PR |
|---|---|
| **RLS / `tenant_id`** | Not applicable — no table, no query. Rule 1 is untouched. |
| **Insert-only evidence** | Not applicable — writes nothing. |
| **Versioned, audited runs** | Not here. The engine is deterministic and *fingerprints its inputs* (`engine.spec.ts`: *"is deterministic and fingerprints its inputs (CP-PAY-005)"*), which is the raw material a versioned run needs, but no run, version or audit row exists yet. |
| **Audit** | Not here, for the same reason. |
| **Country boundary (rule 2)** | **Respected, and the clearest thing in the PR.** Nothing Moroccan is in the engine; Morocco is `pack.json`, loaded through the generic importer so it "gets no special treatment and no shortcut" (`ma/src/index.ts`). |
| **Money (rule 4)** | Respected. Decimal strings and exact rational arithmetic; `rational.spec.ts` keeps `0.1 + 0.2` exact and carries thirds exactly, rounding only when asked. `minorUnits: 2` is declared in the manifest. |

One structural note: the engine evaluates **formulas from the pack** through its
own expression language (`expression.ts`, 389 lines, with its own parser). A
pack can therefore change calculation behaviour without a code change — which is
the point of M27 — and it means the expression evaluator is security-relevant
surface. It is sandboxed by construction: *"reads the world through named
functions"*, *"refuses what it does not know"*, and `validate.ts` refuses a
formula that reads something undefined or a line before it exists.

---

## 4. Tests: what exists, what is missing

**471 lines across 6 files, all unit tests.** No e2e, which follows from there
being no screen and no API.

| File | Lines | Covers |
|---|---|---|
| `test/engine.spec.ts` | 101 | schema order, exact bases, proration and short-month warning, block checks, parameter in force on the date, production refusal of unverified values, exempt allowance split at its ceiling, explanation of every line, determinism + input fingerprint, refusal of undeclared inputs, prototype-as-specimen |
| `test/expression.spec.ts` | 62 | precedence, comparison and boolean, lazy branch evaluation, named world functions, refusal of the unknown, dependency listing |
| `test/rational.spec.ts` | 41 | exact decimal parsing, `0.1 + 0.2`, thirds, half-away-from-zero, floor/compare, division by zero |
| `test/validate.spec.ts` | 72 | blank template, well-formed pack, non-JSON, overlapping parameter rows, float where decimal belongs, undefined reads, validated pack still holding unverified values, verified row without who and when, manifest basics |
| `ma/test/golden.spec.ts` | 135 | **12 golden payslip cases, G01–G09+** |
| `test/fixture.ts` | 60 | shared fixture |

The golden cases are the substantive ones: G01 10,000 base with 3 dependents;
G02 seniority at 5%; G03 ceilings on both CNSS and professional expenses; G04
minimum wage; G05 mid-month hire (13 of 26 days); G06 overtime hourly =
(salary + seniority) ÷ 191 with the premium from the tenant rule; G07 commission,
advance and expense reimbursement; G08 seven dependents counted as six; G09 the
2025 family deduction applied to a 2025 period.

**What is missing, in order of how much it matters:**

1. **No expected figure in this repository has been checked by anyone qualified.**
   The golden cases assert what this engine computes from unverified parameters.
   They lock in behaviour — which is valuable — but they are not evidence that a
   payslip is correct under Moroccan law. Rule 11.
2. **CIMR is an input, not a parameter.** `CIMR_EE_RATE` and `CIMR_ER_RATE`
   arrive per employee/company, so no pack row carries them and nothing tests a
   CIMR scenario end to end.
3. **Nothing about declarations.** `manifest.modules` lists `declarations`, and
   the pack has no declarations section. Damancom and the IR file are untouched.
4. **No payslip layout**, which `packages/country-packs/ma` is the documented
   home for in CLAUDE.md.
5. **The self-declared gaps** in the manifest note: transport and meal exemption
   ceilings, work on public holidays, leave-pay average, exit pay.
6. **No test of a pack whose `validFrom` rows straddle the period boundary**
   beyond G09 (one case, one key).

---

## 5. Does it read the step 3 payroll service and the attendance variables, or duplicate them?

**Neither. It declares what it expects to be given, and nothing is wired up yet.**

```
grep -rn "absences-for-payroll|getAbsencesForPeriod|workDay|work_day"
      packages/payroll-engine/src  packages/country-packs/ma/src
→ no matches
```

`payroll.inputs` declares 14 inputs the caller must supply. Four pairs of them
are plainly shaped for our attendance output, and the labels say so — *"from the
tenant's overtime rules"*:

| Input | Our side |
|---|---|
| `OT_DAY_HOURS` / `OT_DAY_PREMIUM` | `overtime_rule` band `OT_DAY` |
| `OT_NIGHT_HOURS` / `OT_NIGHT_PREMIUM` | band `OT_NIGHT` |
| `OT_REST_DAY_HOURS` / `OT_REST_DAY_PREMIUM` | band `OT_REST_DAY` |
| `OT_REST_NIGHT_HOURS` / `OT_REST_NIGHT_PREMIUM` | band `OT_REST_NIGHT` |
| `DAYS_PAID` ("Days paid (of 26)") | what `absences-for-payroll.service.ts` is built to answer |

So the band codes line up with the ones seeded in `hr02-schedules.ts`, and
`DAYS_PAID` is the figure our step 3 payroll service already computes. **No
duplication** — but also **no integration**: nothing calls
`getAbsencesForPeriod`, and nothing feeds a `WorkDay` into the engine. The
joining-up is still to be built, and it is where the two halves will first be
tested against each other.

One consequence worth stating plainly: `OT_*_PREMIUM` is passed in as a number
per band. The premium work merged in #26 adds `applies_to: all_hours` bands,
whose minutes are deliberately kept **apart** from overtime minutes
(`work_day.premium`). When these are wired together, a `NIGHT_PREMIUM` band has
no input slot in the pack as it stands — it is neither `OT_*_HOURS` nor
`OT_*_PREMIUM`. That is a gap to close in the wiring, not a fault in either PR.

---

## 6. Mechanical notes

- **Conflicts with `main`.** `git pr update-branch` refuses. The cause is one
  line: #23 adds `"pack:validate"` immediately after `"db:seed"` in the root
  `package.json`, and #25 (merged) rewrote the `"db:seed"` line. Adjacent-line
  conflict, resolvable without judgement.
- **CI before the rebase:** lint/types/unit passed; the Playwright job failed for
  the reason every PR's did at that time — `db:seed` had no built `dist`, fixed
  by #25. It has not been re-run since, so #23 has no honest e2e result yet.
- **New root script:** `pack:validate` builds the engine and runs
  `dist/cli/validate-pack.js`. It is not wired into the `checks` CI job, so a
  malformed pack would not fail CI today.
