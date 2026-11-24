-- CreateTable
CREATE TABLE "shift_pattern" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "crosses_midnight" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shift_pattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedule" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekly_hours" DECIMAL(5,2) NOT NULL,
    "note" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "work_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedule_day" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "working" BOOLEAN NOT NULL DEFAULT true,
    "shift_pattern_id" UUID,

    CONSTRAINT "work_schedule_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_schedule" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "weekly_rest_day" INTEGER,
    "default_shift_pattern_id" UUID,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignment" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "shift_pattern_id" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "shift_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_pattern_tenant_id_idx" ON "shift_pattern"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_pattern_tenant_id_code_key" ON "shift_pattern"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "work_schedule_tenant_id_idx" ON "work_schedule"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedule_tenant_id_code_key" ON "work_schedule"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "work_schedule_day_tenant_id_idx" ON "work_schedule_day"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedule_day_tenant_id_schedule_id_weekday_key" ON "work_schedule_day"("tenant_id", "schedule_id", "weekday");

-- CreateIndex
CREATE INDEX "employee_schedule_tenant_id_idx" ON "employee_schedule"("tenant_id");

-- CreateIndex
CREATE INDEX "employee_schedule_tenant_id_employee_id_idx" ON "employee_schedule"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_schedule_tenant_id_employee_id_valid_from_key" ON "employee_schedule"("tenant_id", "employee_id", "valid_from");

-- CreateIndex
CREATE INDEX "shift_assignment_tenant_id_idx" ON "shift_assignment"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignment_tenant_id_employee_id_date_key" ON "shift_assignment"("tenant_id", "employee_id", "date");

-- AddForeignKey
ALTER TABLE "shift_pattern" ADD CONSTRAINT "shift_pattern_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule" ADD CONSTRAINT "work_schedule_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_day" ADD CONSTRAINT "work_schedule_day_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_day" ADD CONSTRAINT "work_schedule_day_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "work_schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_day" ADD CONSTRAINT "work_schedule_day_shift_pattern_id_fkey" FOREIGN KEY ("shift_pattern_id") REFERENCES "shift_pattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedule" ADD CONSTRAINT "employee_schedule_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedule" ADD CONSTRAINT "employee_schedule_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedule" ADD CONSTRAINT "employee_schedule_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "work_schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedule" ADD CONSTRAINT "employee_schedule_default_shift_pattern_id_fkey" FOREIGN KEY ("default_shift_pattern_id") REFERENCES "shift_pattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_shift_pattern_id_fkey" FOREIGN KEY ("shift_pattern_id") REFERENCES "shift_pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Rule 1, for the five tables this migration adds.
DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'shift_pattern',
    'work_schedule',
    'work_schedule_day',
    'employee_schedule',
    'shift_assignment'
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
