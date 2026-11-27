# Decisions log

| Date | Decision | By |
|---|---|---|
| 17 Nov 2026 | CPeople is the official product name (replaces "ConSAP HR & Payroll") | Project owner |
| 17 Nov 2026 | Client requirements are fixed scope; changes only through change requests | Project owner |
| 17 Nov 2026 | Stack: Next.js + NestJS + PostgreSQL/Prisma + Keycloak, modular monolith, multi-tenant with RLS | CLAUDE.md §4 |
| 17 Nov 2026 | First SAP target is S/4HANA Cloud Public Edition (SOAP Journal Entry – Post, SAP_COM_0002); Business One after the MVP | CLAUDE.md §4 |
| 18 Nov 2026 | App theme: option B, brand blue `#0E7BB0` key panel with white text, sky-blue accents, navy for text only; collapsible icon sidebar | Project owner |
| 17 Nov 2026 | No SAP BTP for the MVP (owner to confirm) | Proposed |
| 26 Nov 2026 | MVP scope aligned with the CPeople functional and technical specification v0.1 (`docs/specs/CPeople-functional-technical-spec.md`); scope file v0.3 | Project owner |
| 26 Nov 2026 | Leave approval: N+1 then HR for SMG (HR-02 decision 1); the second approver is a tenant setting | SMG (Mr. Hassam Mahmood), HR-02 |
| 26 Nov 2026 | Configuration framework (M26) and country localisation templates with import (M27) are MVP platform work | Project owner |
| 26 Nov 2026 | Salary transfer file (M28) and performance module (M29) moved into the MVP; commercial treatment open | Project owner |
| 26 Nov 2026 | Money in the payroll engine: integer minor units (bigint) with exact decimal rates, half-up rounding per line | NEW (CLAUDE.md rule 4) |

## Open
- GitHub or GitLab
- Hosting provider in Morocco and budget; CNDP declaration
- Damancom and IR file formats (payroll expert)
- Password policy and lockout thresholds, to confirm with SMG's IT in the fit-to-standard
  workshop (what the realm ships is in `infra/keycloak/README.md`)
- K1–K6 in `mvp-scope.md` §2
- Open points O1–O22 in `docs/specs/CPeople-functional-technical-spec.md` §20, including every 2026 rate row still to validate (O3)
