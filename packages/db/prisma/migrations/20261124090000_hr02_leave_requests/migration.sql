-- CreateEnum
CREATE TYPE "leave_request_status" AS ENUM ('pending_n1', 'pending_n2', 'pending_hr', 'approved', 'rejected', 'withdrawn', 'cancellation_pending', 'cancelled');

-- CreateEnum
CREATE TYPE "leave_day_part" AS ENUM ('full', 'morning', 'afternoon');

-- CreateEnum
CREATE TYPE "leave_calculation_kind" AS ENUM ('submitted', 'approved', 'recalculated', 'accepted');

-- CreateEnum
CREATE TYPE "leave_decision_kind" AS ENUM ('submitted', 'approved_n1', 'approved_n2', 'rejected', 'withdrawn', 'cancellation_requested', 'cancellation_approved', 'cancellation_rejected', 'hr_override', 'recalculated', 'change_accepted');

-- CreateTable
CREATE TABLE "leave_request" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "status" "leave_request_status" NOT NULL DEFAULT 'pending_n1',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "start_part" "leave_day_part" NOT NULL DEFAULT 'full',
    "end_part" "leave_day_part" NOT NULL DEFAULT 'full',
    "reason" TEXT,
    "day_count" DECIMAL(5,2) NOT NULL,
    "n1_id" UUID,
    "n2_id" UUID,
    "to_hr" BOOLEAN NOT NULL DEFAULT false,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(3),
    "recalculated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leave_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_calculation" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "kind" "leave_calculation_kind" NOT NULL,
    "day_count" DECIMAL(5,2) NOT NULL,
    "days" JSONB NOT NULL,
    "leave_rule_id" UUID,
    "work_week_id" UUID,
    "holiday_ids" UUID[],
    "working_days" INTEGER[],
    "day_basis" "leave_day_basis" NOT NULL,
    "holidays_complete" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_calculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_decision" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "kind" "leave_decision_kind" NOT NULL,
    "by_employee_id" UUID,
    "by_name" TEXT NOT NULL,
    "by_role" TEXT NOT NULL,
    "reason" TEXT,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_holiday_year" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "year" INTEGER NOT NULL,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ(3),
    "completed_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "public_holiday_year_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_request_tenant_id_idx" ON "leave_request"("tenant_id");

-- CreateIndex
CREATE INDEX "leave_request_tenant_id_employee_id_idx" ON "leave_request"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "leave_request_tenant_id_status_idx" ON "leave_request"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "leave_request_tenant_id_start_date_idx" ON "leave_request"("tenant_id", "start_date");

-- CreateIndex
CREATE INDEX "leave_calculation_tenant_id_idx" ON "leave_calculation"("tenant_id");

-- CreateIndex
CREATE INDEX "leave_calculation_tenant_id_request_id_idx" ON "leave_calculation"("tenant_id", "request_id");

-- CreateIndex
CREATE INDEX "leave_decision_tenant_id_idx" ON "leave_decision"("tenant_id");

-- CreateIndex
CREATE INDEX "leave_decision_tenant_id_request_id_idx" ON "leave_decision"("tenant_id", "request_id");

-- CreateIndex
CREATE INDEX "public_holiday_year_tenant_id_idx" ON "public_holiday_year"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "public_holiday_year_tenant_id_country_code_year_key" ON "public_holiday_year"("tenant_id", "country_code", "year");

-- AddForeignKey
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_calculation" ADD CONSTRAINT "leave_calculation_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_calculation" ADD CONSTRAINT "leave_calculation_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "leave_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_decision" ADD CONSTRAINT "leave_decision_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_decision" ADD CONSTRAINT "leave_decision_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "leave_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_holiday_year" ADD CONSTRAINT "public_holiday_year_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rule 1, for the four tables this migration adds: the runtime role is granted
-- what it needs, row-level security is enabled *and* forced — without FORCE the
-- policies would not apply to the table's owner — and each table carries a policy
-- that confines every row to its own tenant.
--
-- test/rls.spec.ts walks every table carrying tenant_id and fails if one of these
-- is missing, so a table added later cannot quietly skip it.
DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'leave_request',
    'leave_calculation',
    'leave_decision',
    'public_holiday_year'
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

-- A calculation is the evidence for what a request cost, so it is insert-only
-- like the audit log: a new answer is a new row, and an old one is never edited
-- away. Decisions are the same — somebody approved a request on a day, and that
-- stays true afterwards.
REVOKE UPDATE, DELETE ON "leave_calculation" FROM cpeople_app;
REVOKE UPDATE, DELETE ON "leave_decision" FROM cpeople_app;
