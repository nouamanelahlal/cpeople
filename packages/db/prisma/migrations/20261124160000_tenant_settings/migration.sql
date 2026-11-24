-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_number_pattern" TEXT NOT NULL DEFAULT '^\d{1,10}$',
    "employees_see_salary" BOOLEAN NOT NULL DEFAULT false,
    "show_leave_type_to_colleagues" BOOLEAN NOT NULL DEFAULT false,
    "employees_edit_contact" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenant_id_key" ON "tenant_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_settings_tenant_id_idx" ON "tenant_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Rule 1: the runtime role is granted what it needs, row-level security is
-- enabled and forced, and the table carries a policy confining every row to its
-- own tenant. test/rls.spec.ts walks every table with tenant_id and fails if one
-- of these is missing.
GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_settings" TO cpeople_app;
ALTER TABLE "tenant_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_settings_tenant_isolation" ON "tenant_settings"
  FOR ALL USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());
