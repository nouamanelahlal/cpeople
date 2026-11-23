-- The runtime pool now connects as cpeople_app itself, instead of connecting as the
-- owner and dropping to that role per transaction (M21 / HR-08).
--
-- Why it matters: the owner is not subject to its own policies unless the table
-- forces it, so a query that forgot withTenant() would have returned every tenant's
-- rows. As cpeople_app, the same mistake returns nothing — the isolation fails
-- closed. withTenant() still issues SET LOCAL ROLE, so it is equally safe on an
-- owner connection.
--
-- The role is still NOLOGIN here: a password in a migration would be a committed
-- secret. Each environment gives it one (or grants it to a login user of its own)
-- when the database is provisioned. Locally, scripts/local-dev-role.mjs does it
-- against the throwaway Docker database.

-- FORCE so the policies apply to the table owner too, not just to other roles.
-- Every tenant-scoped table carries this, and test/rls.spec.ts fails if one does not.
--
-- Provisioning a tenant is therefore an operation for a role that bypasses RLS: the
-- superuser locally, and a migration role with BYPASSRLS in a deployed environment.
ALTER TABLE "tenant" FORCE ROW LEVEL SECURITY;

-- Unchanged, restated so this migration reads as the whole picture of what the
-- runtime role may do:
--   tenant   SELECT, UPDATE        (its own row only; it may not create or delete tenants)
--   company  SELECT, INSERT, UPDATE, DELETE   (inside its own tenant only)
