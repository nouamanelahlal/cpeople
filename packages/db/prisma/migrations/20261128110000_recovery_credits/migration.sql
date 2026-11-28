-- Hours owed back, and the setting that says what an hour is worth in time off
-- (M10 / HR-04, HR-02 open point 18).
--
-- A worked public holiday or rest day can be paid as overtime **or** taken as
-- recovery, never both. Paying twice for the same hour is the mistake this
-- table exists to make visible.
ALTER TABLE "overtime_settings"
  ADD COLUMN "recovery_ratio" numeric(4, 2) NOT NULL DEFAULT 1
  CONSTRAINT "overtime_settings_recovery_ratio_is_sane" CHECK ("recovery_ratio" > 0 AND "recovery_ratio" <= 3);

-- What a day gave back, so that a day already settled in time is not also
-- settled in money. The overtime a conversion replaced is cleared on the day
-- itself; this is how much time went the other way.
ALTER TABLE "work_day"
  ADD COLUMN "recovery_min" integer NOT NULL DEFAULT 0;

-- Minutes, not days: four hours owed from a Sunday morning is not "half a day"
-- to somebody whose shift is twelve hours.
CREATE TABLE "leave_recovery_credit" (
  "id"           uuid PRIMARY KEY,
  "tenant_id"    uuid NOT NULL REFERENCES "tenant"("id") ON DELETE RESTRICT,
  "employee_id"  uuid NOT NULL REFERENCES "employee"("id") ON DELETE CASCADE,
  "work_day_id"  uuid NOT NULL REFERENCES "work_day"("id") ON DELETE CASCADE,
  "exception_id" uuid REFERENCES "attendance_exception"("id") ON DELETE SET NULL,
  -- Negative when a conversion is undone, so the rows sum to the balance.
  "minutes"      integer NOT NULL,
  "ratio"        numeric(4, 2) NOT NULL,
  "reason"       text NOT NULL,
  "created_at"   timestamptz(3) NOT NULL DEFAULT now(),
  "created_by"   text NOT NULL
);

CREATE INDEX "leave_recovery_credit_tenant_id_idx" ON "leave_recovery_credit" ("tenant_id");
CREATE INDEX "leave_recovery_credit_tenant_id_employee_id_idx" ON "leave_recovery_credit" ("tenant_id", "employee_id");
CREATE INDEX "leave_recovery_credit_tenant_id_work_day_id_idx" ON "leave_recovery_credit" ("tenant_id", "work_day_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON "leave_recovery_credit" TO cpeople_app;
ALTER TABLE "leave_recovery_credit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_recovery_credit" FORCE ROW LEVEL SECURITY;
CREATE POLICY "leave_recovery_credit_tenant_isolation"
  ON "leave_recovery_credit"
  FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

-- A balance worked out from movements, never edited. Undoing a conversion
-- writes a second row with the minutes negated and a reason of its own; it
-- never rewrites the first. Same rule as the audit log, the leave calculations
-- and the punches.
REVOKE UPDATE, DELETE ON "leave_recovery_credit" FROM cpeople_app;
