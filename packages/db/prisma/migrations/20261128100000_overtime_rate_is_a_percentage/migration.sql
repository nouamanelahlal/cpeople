-- An overtime rate is a percentage, and the database makes sure of it.
--
-- `overtime_rule.rate_percent` holds 25 for twenty-five per cent, while
-- `tenant_contribution_rate.rate` holds 0.0600 for six. Both are correctly
-- named and each is right on its own terms, but the pair is an invitation to
-- type one in the shape of the other — and `numeric(6,2)` takes either without
-- complaint.
--
-- Two mistakes, in opposite directions, and the range has to catch both:
--
--   * 2500 for "twenty-five per cent"  — a hundred times too much
--   * 0.25 for "twenty-five per cent"  — the fraction, a hundred times too little
--
-- An upper bound alone would miss the second, because 0.25 sits comfortably
-- inside any sane range. So the floor is one per cent: a premium of a quarter
-- of a per cent is not a policy anybody wrote, it is a fraction that escaped.
-- Zero stays allowed, because a band switched off is a real thing to want.
--
-- 300% is the ceiling: triple pay for an hour is already beyond anything in the
-- seeded demo data (the highest is 100%), and far enough above any plausible
-- rule that passing it means a mistake rather than a generous employer.
ALTER TABLE "overtime_rule"
  ADD CONSTRAINT "overtime_rule_rate_is_a_percentage"
  CHECK ("rate_percent" = 0 OR ("rate_percent" >= 1 AND "rate_percent" <= 300));
