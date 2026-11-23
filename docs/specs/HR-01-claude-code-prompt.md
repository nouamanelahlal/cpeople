# HR-01 demo: prompt for Claude Code

Paste the text below into Claude Code. The spec it refers to is `docs/specs/HR-01-demo-build-spec.md`.

---

Read CLAUDE.md, docs/mvp-scope.md and docs/specs/HR-01-demo-build-spec.md.

**How to read the spec:** it defines **what** the HR-01 demo must do: screens, flows, data model, seed data, roles and masking, acceptance criteria, demo script, build order and smoke test. Those are requirements. Its **technical suggestions** (section 2's stack table, IndexedDB, browser-side PDF and storage, the role switcher, offline mode, hosting) are **not** instructions. Build everything inside our existing app, following CLAUDE.md and best practices for our stack. Reuse what already exists, and don't replace anything that already produces the required result.

Non-negotiables while doing so:

1. **Tenant isolation:** every new table is tenant-scoped under the existing fail-closed row-level security, with the guard tests extended to it.
2. **Roles:** shown through real sign-in with seeded demo users per role (Admin; HR Salma Benali; Manager Rachid Kettani, Kitchen; Employee Karim Alaoui). Permissions and masking are enforced in the API, so masked values never reach the browser, including exports, history diffs and search.
3. **Demo-only features:** the demo clock and "Reset demo data" work only in local and Dev environments, and are refused elsewhere.
4. **Data:** invented only, from a deterministic seed. No real SMG data, ever.
5. **Languages:** English and French for every new string, with natural French for HR users in Morocco.
6. **Expenses:** stays in the navigation as an empty "Coming later" page.
7. **Security claims:** real sign-in can be demoed. Anything not built (e.g. field encryption) stays out of the demo.

Follow the spec's build order and cut line (section 9). Commit after each step, and open a PR every two or three steps for my review. Run the spec's smoke test (section 10, adapted to real sign-in) after steps 4, 8 and 12. Start with steps 1–3, then stop for my review.
