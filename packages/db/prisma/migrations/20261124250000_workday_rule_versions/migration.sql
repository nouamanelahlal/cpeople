-- A worked day records which rules it was built from (HR-02 build spec §5.3).
--
-- `calc_version` already said *that* the rules had changed; this says *which*
-- rows were in force, the way a leave calculation keeps `leave_rule_id`,
-- `work_week_id` and `holiday_ids`. Between them a day can answer both
-- questions a payroll argument asks: has anything changed since, and what
-- exactly was applied.
ALTER TABLE "work_day"
  ADD COLUMN "overtime_rule_ids" uuid[] NOT NULL DEFAULT '{}';
