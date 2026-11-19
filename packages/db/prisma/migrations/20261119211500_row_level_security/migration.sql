-- Tenant isolation through Postgres row-level security (M21 / HR-08, CLAUDE.md rule 1).
--
-- Two database roles:
--   * the owner (the user in DATABASE_URL) runs migrations, provisions tenants and
--     seeds fake data;
--   * cpeople_app is unprivileged and is what the application acts as. withTenant()
--     in packages/db issues `SET LOCAL ROLE cpeople_app` and sets app.tenant_id for
--     the transaction, so the policies below decide what the request can see.
--
-- Adding a business table? It needs, in the same migration: tenant_id, the grants,
-- ENABLE + FORCE ROW LEVEL SECURITY, a policy, and a case in test/rls.spec.ts.
-- Without the grants the application gets a permission error, which is the point:
-- a forgotten table fails closed instead of leaking across tenants.

-- 1. The role the application runs as. NOLOGIN: it is reached with SET ROLE, or
--    granted to a login user per environment (that user's password is never here).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cpeople_app') THEN
    CREATE ROLE cpeople_app NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO cpeople_app;

-- 2. The tenant of the current transaction. NULL when nothing is set, so an
--    unscoped query matches no rows; a malformed value raises, never widens.
CREATE OR REPLACE FUNCTION app_current_tenant_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  PARALLEL SAFE
  SET search_path = pg_catalog
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;

COMMENT ON FUNCTION app_current_tenant_id() IS
  'Tenant of the current transaction, set by withTenant() from the verified session.';

-- 3. tenant: a tenant may read and update only its own row. No INSERT or DELETE for
--    the application — provisioning a tenant is an owner operation. RLS is enabled
--    but not forced, so the owner can still create tenants.
ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON "tenant" TO cpeople_app;

CREATE POLICY tenant_self_select ON "tenant"
  FOR SELECT
  USING (id = app_current_tenant_id());

CREATE POLICY tenant_self_update ON "tenant"
  FOR UPDATE
  USING (id = app_current_tenant_id())
  WITH CHECK (id = app_current_tenant_id());

-- 4. company: full CRUD inside the tenant, nothing outside it. FORCE RLS so the
--    policy applies to the table owner too, and an unscoped query returns nothing
--    instead of every tenant's rows.
ALTER TABLE "company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company" FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON "company" TO cpeople_app;

-- USING filters the rows that can be read, updated or deleted; WITH CHECK rejects
-- writing a row that belongs to another tenant.
CREATE POLICY company_tenant_isolation ON "company"
  FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());
