# Country packs (M24, M27)

A country is **data, not code**: one `pack.json` in the format `cpeople-country-pack/1`, read by the
country-neutral engine in `packages/payroll-engine`. Nothing country-specific goes in the core
(CLAUDE.md rule 2). Spec: `docs/specs/CPeople-functional-technical-spec.md` §7, §11, §12.

| Pack | Status | Payroll |
|---|---|---|
| `ma/` Morocco | `prototype` | Calculates in Dev & Test with a SPECIMEN mark; refused in production until every value is verified (open point O3) |

## What a pack holds

- `manifest` — country, version (`YYYY.release.fix`), status, currency and minor units, law basis, owner, validator.
- `fields` — country identifiers (national ID, social number, employer IDs) with validation patterns.
- `holidays` — fixed holidays as `MM-DD`. Religious holidays that follow the lunar calendar are entered per year, never calculated.
- `leaveTypes` — statutory leave with its legal days; a tenant may only raise them.
- `payroll` — inputs, effective-dated **parameters** (each with `status` and `source`), wage types and the bases they feed,
  treatment classes for company elements, the ordered **schema** of formulas, and pre-run **checks**.

Formulas use a small, safe language (`packages/payroll-engine/src/expression.ts`):
`input('KEY')`, `param('KEY')`, `base('NAME')`, `wt('CODE')`, `band('TABLE', x)`, `bracket('TABLE', x)`,
`min`, `max`, `abs`, `if`, `round`, `floor`, arithmetic and comparisons. No loops, no I/O.

## Statuses (spec §7)

`placeholder` (HR only) → `template` → `prototype` (Dev & Test, specimen payslips) → `validated` (a named validator, every
value `verified`) → `released` (in production for a tenant) → `retired` (read-only, for past periods and retro).

## Adding or importing a country

1. Copy `packages/payroll-engine/templates/country-pack.template.json` to `packages/country-packs/<cc>/pack.json`
   (or receive a pack file from a local partner).
2. Run `pnpm pack:validate packages/country-packs/<cc>/pack.json`. Every error names the JSON path to fix.
3. Fill fields, holidays and leave first: HR works with a `placeholder`.
4. Add the payroll section with a local expert. Every legal value is a parameter row with `status: "unverified"`, its
   `source` and `TODO(verify-official-rate)` — never a value typed from memory (CLAUDE.md rule 3).
5. Write golden payslips in `<cc>/test/` and move to `prototype`.
6. The expert verifies each row (`verifiedBy`, `verifiedOn`) and signs the pack (`validator`, `validatedOn`): `validated`.

Importing a pack into a tenant from the admin screens (upload, diff, approval) is the next step of M27; the validator
here is the gate it will use.
