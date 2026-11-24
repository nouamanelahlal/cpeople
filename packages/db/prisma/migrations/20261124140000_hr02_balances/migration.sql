-- CreateEnum
CREATE TYPE "payroll_period_status" AS ENUM ('open', 'locked');

-- CreateEnum
CREATE TYPE "carry_over_mode" AS ENUM ('all', 'limited', 'none');

-- CreateEnum
CREATE TYPE "carry_over_run_status" AS ENUM ('preview', 'applied');

-- AlterTable
ALTER TABLE "leave_rule" ADD COLUMN     "carry_over_expiry_months" INTEGER,
ADD COLUMN     "carry_over_mode" "carry_over_mode" NOT NULL DEFAULT 'limited';

-- CreateTable
CREATE TABLE "payroll_period" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "status" "payroll_period_status" NOT NULL DEFAULT 'open',
    "locked_at" TIMESTAMPTZ(3),
    "locked_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payroll_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_correction" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "original_month" TEXT NOT NULL,
    "applied_period_id" UUID NOT NULL,
    "day_difference" DECIMAL(5,2) NOT NULL,
    "paid" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "created_role" TEXT NOT NULL,

    CONSTRAINT "leave_correction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_opening_balance" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "days" DECIMAL(6,2) NOT NULL,
    "balance_at" DATE NOT NULL,
    "import_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "created_role" TEXT NOT NULL,

    CONSTRAINT "leave_opening_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balance_adjustment" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "days" DECIMAL(6,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "effective_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "created_role" TEXT NOT NULL,

    CONSTRAINT "leave_balance_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_carry_over" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "from_year" INTEGER NOT NULL,
    "to_year" INTEGER NOT NULL,
    "left_over" DECIMAL(6,2) NOT NULL,
    "days" DECIMAL(6,2) NOT NULL,
    "expires_on" DATE,
    "run_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leave_carry_over_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_carry_over_run" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "from_year" INTEGER NOT NULL,
    "status" "carry_over_run_status" NOT NULL DEFAULT 'preview',
    "employees" INTEGER NOT NULL DEFAULT 0,
    "carried" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "by_name" TEXT NOT NULL,
    "by_role" TEXT NOT NULL,

    CONSTRAINT "leave_carry_over_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_period_tenant_id_idx" ON "payroll_period"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_period_tenant_id_month_key" ON "payroll_period"("tenant_id", "month");

-- CreateIndex
CREATE INDEX "leave_correction_tenant_id_idx" ON "leave_correction"("tenant_id");

-- CreateIndex
CREATE INDEX "leave_correction_tenant_id_applied_period_id_idx" ON "leave_correction"("tenant_id", "applied_period_id");

-- CreateIndex
CREATE INDEX "leave_correction_tenant_id_employee_id_idx" ON "leave_correction"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "leave_opening_balance_tenant_id_idx" ON "leave_opening_balance"("tenant_id");

-- CreateIndex
CREATE INDEX "leave_opening_balance_tenant_id_employee_id_idx" ON "leave_opening_balance"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_opening_balance_tenant_id_employee_id_leave_type_id_b_key" ON "leave_opening_balance"("tenant_id", "employee_id", "leave_type_id", "balance_at");

-- CreateIndex
CREATE INDEX "leave_balance_adjustment_tenant_id_idx" ON "leave_balance_adjustment"("tenant_id");

-- CreateIndex
CREATE INDEX "leave_balance_adjustment_tenant_id_employee_id_idx" ON "leave_balance_adjustment"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "leave_carry_over_tenant_id_idx" ON "leave_carry_over"("tenant_id");

-- CreateIndex
CREATE INDEX "leave_carry_over_tenant_id_to_year_idx" ON "leave_carry_over"("tenant_id", "to_year");

-- CreateIndex
CREATE UNIQUE INDEX "leave_carry_over_tenant_id_employee_id_leave_type_id_from_y_key" ON "leave_carry_over"("tenant_id", "employee_id", "leave_type_id", "from_year");

-- CreateIndex
CREATE INDEX "leave_carry_over_run_tenant_id_idx" ON "leave_carry_over_run"("tenant_id");

-- CreateIndex
CREATE INDEX "leave_carry_over_run_tenant_id_from_year_idx" ON "leave_carry_over_run"("tenant_id", "from_year");

-- AddForeignKey
ALTER TABLE "payroll_period" ADD CONSTRAINT "payroll_period_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_correction" ADD CONSTRAINT "leave_correction_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_correction" ADD CONSTRAINT "leave_correction_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_correction" ADD CONSTRAINT "leave_correction_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "leave_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_correction" ADD CONSTRAINT "leave_correction_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_correction" ADD CONSTRAINT "leave_correction_applied_period_id_fkey" FOREIGN KEY ("applied_period_id") REFERENCES "payroll_period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_opening_balance" ADD CONSTRAINT "leave_opening_balance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_opening_balance" ADD CONSTRAINT "leave_opening_balance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_opening_balance" ADD CONSTRAINT "leave_opening_balance_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_adjustment" ADD CONSTRAINT "leave_balance_adjustment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_adjustment" ADD CONSTRAINT "leave_balance_adjustment_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_adjustment" ADD CONSTRAINT "leave_balance_adjustment_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_carry_over" ADD CONSTRAINT "leave_carry_over_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_carry_over" ADD CONSTRAINT "leave_carry_over_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_carry_over" ADD CONSTRAINT "leave_carry_over_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_carry_over" ADD CONSTRAINT "leave_carry_over_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "leave_carry_over_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_carry_over_run" ADD CONSTRAINT "leave_carry_over_run_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rule 1, for the six tables this migration adds: the runtime role is granted
-- what it needs, row-level security is enabled *and* forced, and each table
-- carries a policy that confines every row to its own tenant.
--
-- test/rls.spec.ts walks every table carrying tenant_id and fails if one of these
-- is missing, so a table added later cannot quietly skip it.
DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'payroll_period',
    'leave_correction',
    'leave_opening_balance',
    'leave_balance_adjustment',
    'leave_carry_over',
    'leave_carry_over_run'
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

-- An adjustment that could be edited away is not a record of anything, and a
-- correction carried into an open payroll month is evidence of what payroll is
-- about to be told. Both are insert-only, like the audit log: putting one right
-- is another row in the other direction, and both stay in the history.
REVOKE UPDATE, DELETE ON "leave_balance_adjustment" FROM cpeople_app;
REVOKE UPDATE, DELETE ON "leave_correction" FROM cpeople_app;
