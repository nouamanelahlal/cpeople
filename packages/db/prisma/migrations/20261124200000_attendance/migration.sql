-- CreateEnum
CREATE TYPE "punch_direction" AS ENUM ('in', 'out', 'unknown');

-- CreateEnum
CREATE TYPE "punch_source" AS ENUM ('device', 'manual');

-- CreateEnum
CREATE TYPE "attendance_import_status" AS ENUM ('previewed', 'committed', 'replaced');

-- CreateEnum
CREATE TYPE "work_day_status" AS ENUM ('ok', 'exception', 'fixed', 'approved');

-- CreateEnum
CREATE TYPE "work_day_source" AS ENUM ('device', 'manual', 'mixed');

-- CreateEnum
CREATE TYPE "attendance_exception_status" AS ENUM ('open', 'fixed', 'ignored');

-- CreateTable
CREATE TABLE "attendance_import" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_id" UUID,
    "status" "attendance_import_status" NOT NULL DEFAULT 'previewed',
    "file_key" TEXT,
    "file_name" TEXT NOT NULL,
    "period_from" DATE,
    "period_to" DATE,
    "rows" INTEGER NOT NULL DEFAULT 0,
    "matched" INTEGER NOT NULL DEFAULT 0,
    "unknown" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "days_built" INTEGER NOT NULL DEFAULT 0,
    "exceptions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committed_at" TIMESTAMPTZ(3),
    "created_by" TEXT NOT NULL,
    "created_role" TEXT NOT NULL,

    CONSTRAINT "attendance_import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punch" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "import_id" UUID,
    "employee_number" TEXT NOT NULL,
    "employee_id" UUID,
    "at" TIMESTAMPTZ(3) NOT NULL,
    "direction" "punch_direction" NOT NULL DEFAULT 'unknown',
    "device_id" TEXT,
    "source" "punch_source" NOT NULL DEFAULT 'device',
    "reason" TEXT,
    "duplicate" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "punch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_number_alias" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "alias" TEXT NOT NULL,
    "employee_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "employee_number_alias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_day" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "scheduled_min" INTEGER NOT NULL DEFAULT 0,
    "worked_min" INTEGER NOT NULL DEFAULT 0,
    "break_min" INTEGER NOT NULL DEFAULT 0,
    "late_min" INTEGER NOT NULL DEFAULT 0,
    "early_leave_min" INTEGER NOT NULL DEFAULT 0,
    "overtime" JSONB NOT NULL,
    "status" "work_day_status" NOT NULL DEFAULT 'ok',
    "source" "work_day_source" NOT NULL DEFAULT 'device',
    "leave_request_id" UUID,
    "calc_version" TEXT NOT NULL,
    "built_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "work_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_exception" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "work_day_id" UUID,
    "punch_id" UUID,
    "code" TEXT NOT NULL,
    "status" "attendance_exception_status" NOT NULL DEFAULT 'open',
    "detail" TEXT,
    "resolution" TEXT,
    "comment" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_exception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_rule" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "band_code" TEXT NOT NULL,
    "day_type" TEXT NOT NULL,
    "time_from" TEXT NOT NULL,
    "time_to" TEXT NOT NULL,
    "rate_percent" DECIMAL(6,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "note" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "overtime_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "threshold_mode" TEXT NOT NULL DEFAULT 'both',
    "normal_weekly_hours" DECIMAL(5,2) NOT NULL DEFAULT 44,
    "normal_daily_hours" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "rounding_minutes" INTEGER NOT NULL DEFAULT 15,
    "rounding_direction" TEXT NOT NULL DEFAULT 'up',
    "lateness_tolerance_min" INTEGER NOT NULL DEFAULT 10,
    "daily_max_hours" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "note" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "overtime_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_import_tenant_id_idx" ON "attendance_import"("tenant_id");

-- CreateIndex
CREATE INDEX "attendance_import_tenant_id_status_idx" ON "attendance_import"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "punch_tenant_id_idx" ON "punch"("tenant_id");

-- CreateIndex
CREATE INDEX "punch_tenant_id_employee_id_at_idx" ON "punch"("tenant_id", "employee_id", "at");

-- CreateIndex
CREATE INDEX "punch_tenant_id_import_id_idx" ON "punch"("tenant_id", "import_id");

-- CreateIndex
CREATE INDEX "employee_number_alias_tenant_id_idx" ON "employee_number_alias"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_number_alias_tenant_id_alias_key" ON "employee_number_alias"("tenant_id", "alias");

-- CreateIndex
CREATE INDEX "work_day_tenant_id_idx" ON "work_day"("tenant_id");

-- CreateIndex
CREATE INDEX "work_day_tenant_id_date_idx" ON "work_day"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "work_day_tenant_id_status_idx" ON "work_day"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "work_day_tenant_id_employee_id_date_key" ON "work_day"("tenant_id", "employee_id", "date");

-- CreateIndex
CREATE INDEX "attendance_exception_tenant_id_idx" ON "attendance_exception"("tenant_id");

-- CreateIndex
CREATE INDEX "attendance_exception_tenant_id_status_code_idx" ON "attendance_exception"("tenant_id", "status", "code");

-- CreateIndex
CREATE INDEX "overtime_rule_tenant_id_idx" ON "overtime_rule"("tenant_id");

-- CreateIndex
CREATE INDEX "overtime_rule_tenant_id_effective_from_idx" ON "overtime_rule"("tenant_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_settings_tenant_id_key" ON "overtime_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "overtime_settings_tenant_id_idx" ON "overtime_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "attendance_import" ADD CONSTRAINT "attendance_import_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_import" ADD CONSTRAINT "attendance_import_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "attendance_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch" ADD CONSTRAINT "punch_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch" ADD CONSTRAINT "punch_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "attendance_import"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch" ADD CONSTRAINT "punch_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_number_alias" ADD CONSTRAINT "employee_number_alias_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_number_alias" ADD CONSTRAINT "employee_number_alias_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_day" ADD CONSTRAINT "work_day_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_day" ADD CONSTRAINT "work_day_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exception" ADD CONSTRAINT "attendance_exception_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exception" ADD CONSTRAINT "attendance_exception_work_day_id_fkey" FOREIGN KEY ("work_day_id") REFERENCES "work_day"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_rule" ADD CONSTRAINT "overtime_rule_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_settings" ADD CONSTRAINT "overtime_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Rule 1, for the seven tables this migration adds.
DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'attendance_import',
    'punch',
    'employee_number_alias',
    'work_day',
    'attendance_exception',
    'overtime_rule',
    'overtime_settings'
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

-- A punch is evidence of somebody being at a door at a time. It is never
-- edited: a correction is another punch, with a reason and a name on it. Same
-- rule as the audit log and the leave calculations.
REVOKE UPDATE, DELETE ON "punch" FROM cpeople_app;
