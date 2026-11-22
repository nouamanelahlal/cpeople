-- CreateEnum
CREATE TYPE "employee_status" AS ENUM ('onboarding', 'active', 'left');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('female', 'male', 'unspecified');

-- CreateEnum
CREATE TYPE "marital_status" AS ENUM ('single', 'married', 'divorced', 'widowed');

-- CreateEnum
CREATE TYPE "contract_status" AS ENUM ('draft', 'generated', 'signed', 'renewed', 'ended');

-- CreateEnum
CREATE TYPE "onboarding_task_status" AS ENUM ('todo', 'done');

-- CreateTable
CREATE TABLE "site" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centre" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sap_cost_centre" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cost_centre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "site_id" UUID,
    "cost_centre_id" UUID,
    "head_employee_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department_id" UUID NOT NULL,
    "reports_to_position_id" UUID,
    "planned_headcount" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_number" TEXT NOT NULL,
    "status" "employee_status" NOT NULL DEFAULT 'onboarding',
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "gender" "gender" NOT NULL DEFAULT 'unspecified',
    "birth_date" DATE NOT NULL,
    "nationality" CHAR(2) NOT NULL,
    "national_id" TEXT NOT NULL,
    "marital_status" "marital_status" NOT NULL DEFAULT 'single',
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "position_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "site_id" UUID,
    "cost_centre_id" UUID,
    "cost_centre_override" BOOLEAN NOT NULL DEFAULT false,
    "manager_id" UUID,
    "hire_date" DATE NOT NULL,
    "seniority_date" DATE NOT NULL,
    "left_on" DATE,
    "base_salary_minor" INTEGER NOT NULL,
    "salary_currency" CHAR(3) NOT NULL DEFAULT 'MAD',
    "social_security_number" TEXT,
    "pension_member" BOOLEAN NOT NULL DEFAULT false,
    "bank_name" TEXT,
    "bank_account" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dependent" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "relation" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dependent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_type" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requires_end_date" BOOLEAN NOT NULL DEFAULT false,
    "default_trial_days" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_template" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contract_type_id" UUID NOT NULL,
    "language" CHAR(2) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_clause" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_clause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "contract_type_id" UUID NOT NULL,
    "template_id" UUID,
    "status" "contract_status" NOT NULL DEFAULT 'draft',
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "trial_end_date" DATE,
    "position_id" UUID,
    "workplace_site_id" UUID,
    "salary_minor" INTEGER NOT NULL,
    "salary_currency" CHAR(3) NOT NULL DEFAULT 'MAD',
    "previous_contract_id" UUID,
    "end_reason" TEXT,
    "generated_at" TIMESTAMPTZ(3),
    "signed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_type" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requires_expiry" BOOLEAN NOT NULL DEFAULT false,
    "alert_days_before" INTEGER NOT NULL DEFAULT 30,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_document" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "document_type_id" UUID NOT NULL,
    "contract_id" UUID,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "storage_key" TEXT,
    "issue_date" DATE,
    "expiry_date" DATE,
    "uploaded_by" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_template" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "checklist_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_item_template" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "owner_role" TEXT NOT NULL,
    "due_offset_days" INTEGER NOT NULL,
    "requires_document_type_id" UUID,
    "department_codes" TEXT[],
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "checklist_item_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_task" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "template_id" UUID,
    "item_template_id" UUID,
    "title" TEXT NOT NULL,
    "owner_role" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "onboarding_task_status" NOT NULL DEFAULT 'todo',
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "done_at" TIMESTAMPTZ(3),
    "done_by" TEXT,
    "document_id" UUID,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "onboarding_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,
    "actor_name" TEXT,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" UUID,
    "summary" TEXT NOT NULL,
    "diff" JSONB,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_holiday" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_tenant_id_idx" ON "site"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "site_tenant_id_code_key" ON "site"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "cost_centre_tenant_id_idx" ON "cost_centre"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centre_tenant_id_code_key" ON "cost_centre"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "department_tenant_id_idx" ON "department"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_tenant_id_code_key" ON "department"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "position_tenant_id_idx" ON "position"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "position_tenant_id_code_key" ON "position"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "employee_tenant_id_idx" ON "employee"("tenant_id");

-- CreateIndex
CREATE INDEX "employee_tenant_id_last_name_idx" ON "employee"("tenant_id", "last_name");

-- CreateIndex
CREATE INDEX "employee_tenant_id_department_id_idx" ON "employee"("tenant_id", "department_id");

-- CreateIndex
CREATE INDEX "employee_tenant_id_manager_id_idx" ON "employee"("tenant_id", "manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_tenant_id_employee_number_key" ON "employee"("tenant_id", "employee_number");

-- CreateIndex
CREATE UNIQUE INDEX "employee_tenant_id_national_id_key" ON "employee"("tenant_id", "national_id");

-- CreateIndex
CREATE INDEX "dependent_tenant_id_idx" ON "dependent"("tenant_id");

-- CreateIndex
CREATE INDEX "dependent_tenant_id_employee_id_idx" ON "dependent"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "contract_type_tenant_id_idx" ON "contract_type"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_type_tenant_id_code_key" ON "contract_type"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "contract_template_tenant_id_idx" ON "contract_template"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_template_tenant_id_contract_type_id_language_versi_key" ON "contract_template"("tenant_id", "contract_type_id", "language", "version");

-- CreateIndex
CREATE INDEX "contract_clause_tenant_id_idx" ON "contract_clause"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_clause_tenant_id_template_id_key_key" ON "contract_clause"("tenant_id", "template_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "contract_previous_contract_id_key" ON "contract"("previous_contract_id");

-- CreateIndex
CREATE INDEX "contract_tenant_id_idx" ON "contract"("tenant_id");

-- CreateIndex
CREATE INDEX "contract_tenant_id_employee_id_idx" ON "contract"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "contract_tenant_id_end_date_idx" ON "contract"("tenant_id", "end_date");

-- CreateIndex
CREATE INDEX "document_type_tenant_id_idx" ON "document_type"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_type_tenant_id_code_key" ON "document_type"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "employee_document_tenant_id_idx" ON "employee_document"("tenant_id");

-- CreateIndex
CREATE INDEX "employee_document_tenant_id_employee_id_idx" ON "employee_document"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_document_tenant_id_expiry_date_idx" ON "employee_document"("tenant_id", "expiry_date");

-- CreateIndex
CREATE INDEX "checklist_template_tenant_id_idx" ON "checklist_template"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_template_tenant_id_code_key" ON "checklist_template"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "checklist_item_template_tenant_id_idx" ON "checklist_item_template"("tenant_id");

-- CreateIndex
CREATE INDEX "onboarding_task_tenant_id_idx" ON "onboarding_task"("tenant_id");

-- CreateIndex
CREATE INDEX "onboarding_task_tenant_id_employee_id_idx" ON "onboarding_task"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "audit_event_tenant_id_idx" ON "audit_event"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_event_tenant_id_at_idx" ON "audit_event"("tenant_id", "at");

-- CreateIndex
CREATE INDEX "audit_event_tenant_id_entity_entity_id_idx" ON "audit_event"("tenant_id", "entity", "entity_id");

-- CreateIndex
CREATE INDEX "public_holiday_tenant_id_idx" ON "public_holiday"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "public_holiday_tenant_id_date_key" ON "public_holiday"("tenant_id", "date");

-- AddForeignKey
ALTER TABLE "site" ADD CONSTRAINT "site_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site" ADD CONSTRAINT "site_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centre" ADD CONSTRAINT "cost_centre_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centre" ADD CONSTRAINT "cost_centre_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_cost_centre_id_fkey" FOREIGN KEY ("cost_centre_id") REFERENCES "cost_centre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_head_employee_id_fkey" FOREIGN KEY ("head_employee_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position" ADD CONSTRAINT "position_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position" ADD CONSTRAINT "position_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position" ADD CONSTRAINT "position_reports_to_position_id_fkey" FOREIGN KEY ("reports_to_position_id") REFERENCES "position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_cost_centre_id_fkey" FOREIGN KEY ("cost_centre_id") REFERENCES "cost_centre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependent" ADD CONSTRAINT "dependent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependent" ADD CONSTRAINT "dependent_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_type" ADD CONSTRAINT "contract_type_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_template" ADD CONSTRAINT "contract_template_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_template" ADD CONSTRAINT "contract_template_contract_type_id_fkey" FOREIGN KEY ("contract_type_id") REFERENCES "contract_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_clause" ADD CONSTRAINT "contract_clause_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_clause" ADD CONSTRAINT "contract_clause_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "contract_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_contract_type_id_fkey" FOREIGN KEY ("contract_type_id") REFERENCES "contract_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "contract_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_workplace_site_id_fkey" FOREIGN KEY ("workplace_site_id") REFERENCES "site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_previous_contract_id_fkey" FOREIGN KEY ("previous_contract_id") REFERENCES "contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_type" ADD CONSTRAINT "document_type_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_document" ADD CONSTRAINT "employee_document_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_document" ADD CONSTRAINT "employee_document_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_document" ADD CONSTRAINT "employee_document_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_document" ADD CONSTRAINT "employee_document_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template" ADD CONSTRAINT "checklist_template_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_item_template" ADD CONSTRAINT "checklist_item_template_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_item_template" ADD CONSTRAINT "checklist_item_template_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_task" ADD CONSTRAINT "onboarding_task_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_task" ADD CONSTRAINT "onboarding_task_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_task" ADD CONSTRAINT "onboarding_task_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_task" ADD CONSTRAINT "onboarding_task_item_template_id_fkey" FOREIGN KEY ("item_template_id") REFERENCES "checklist_item_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_holiday" ADD CONSTRAINT "public_holiday_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Tenant isolation for the employee file (M21 / HR-08, CLAUDE.md rule 1).
--
-- Same shape as the first two tables, for every table added above: the grants
-- the application needs, row-level security ENABLEd and FORCEd so the policy
-- applies to the owner too, and one policy that both filters what can be read
-- (USING) and refuses a write that belongs to another tenant (WITH CHECK).
--
-- Without the grants the application gets a permission error instead of data,
-- which is the point: a table someone forgot fails closed. test/rls.spec.ts
-- walks every table carrying tenant_id and fails if one of these is missing.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'site',
    'cost_centre',
    'department',
    'position',
    'employee',
    'dependent',
    'contract_type',
    'contract_template',
    'contract_clause',
    'contract',
    'document_type',
    'employee_document',
    'checklist_template',
    'checklist_item_template',
    'onboarding_task',
    'audit_event',
    'public_holiday'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO cpeople_app', target);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (tenant_id = app_current_tenant_id()) WITH CHECK (tenant_id = app_current_tenant_id())',
      target || '_tenant_isolation',
      target
    );
  END LOOP;
END
$$;

-- An audit entry is written once and never edited: that is what makes it an
-- audit trail. The application may add rows and read them back, nothing more.
REVOKE UPDATE, DELETE ON "audit_event" FROM cpeople_app;
