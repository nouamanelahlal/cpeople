-- A band may be paid on all hours, not only on overtime (HR-02 open point 17).
--
-- Whether SMG owes a premium on *scheduled* night hours — the pastry shift's
-- 04:00 to 06:00, which is that job's ordinary day and not overtime at all — is
-- an open question for SMG and the payroll expert. This is the column that lets
-- the answer be a row in a table rather than a change to the engine.
--
-- `overtime` is the default and is what every existing row already meant, so
-- nothing computed today changes. There is deliberately no `all_hours` row in
-- the seed: the default answer is "no premium", and seeding one would quietly
-- decide a question nobody has asked yet.
ALTER TABLE "overtime_rule"
  ADD COLUMN "applies_to" text NOT NULL DEFAULT 'overtime';

-- Premium minutes are kept apart from overtime minutes on the day they were
-- earned. The same minute can appear in both — an hour of overtime at eleven at
-- night is night overtime *and* premium hours — so adding the two maps together
-- would count it twice. They are two answers about one minute, not two minutes.
ALTER TABLE "work_day"
  ADD COLUMN "premium" jsonb;
