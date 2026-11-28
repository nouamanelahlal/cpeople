-- A contribution rate that belongs to the company, not to the country
-- (CLAUDE.md rule 3, decision of 27 November 2026).
--
-- CIMR is the first: the rate is agreed between an employer and the fund, so
-- two companies in Morocco pay different ones and neither figure is law. The
-- country pack holds one country's law and is shared by every tenant in it, so
-- a company's own rate there would be wrong for everybody else and invisible to
-- the company it belongs to. The pack already takes CIMR as an input; this is
-- where that input comes from.
CREATE TABLE "tenant_contribution_rate" (
  "id"             uuid PRIMARY KEY,
  "tenant_id"      uuid NOT NULL REFERENCES "tenant"("id") ON DELETE RESTRICT,
  "code"           text NOT NULL,
  -- A fraction, not a percentage: 0.0600 is six per cent. The name says so,
  -- and the constraint makes sure of it — somebody typing 6 for "six per cent"
  -- would otherwise get a 600% CIMR, which numeric(6,4) accepts without a
  -- murmur and which nothing downstream would question.
  "rate"           numeric(6, 4) NOT NULL CONSTRAINT "tenant_contribution_rate_is_a_fraction"
                   CHECK ("rate" >= 0 AND "rate" <= 1),
  "effective_from" date NOT NULL,
  "effective_to"   date,
  "note"           text,
  "confirmed"      boolean NOT NULL DEFAULT false,
  "created_at"     timestamptz(3) NOT NULL DEFAULT now(),
  "created_by"     text NOT NULL,
  "updated_at"     timestamptz(3) NOT NULL
);

CREATE INDEX "tenant_contribution_rate_tenant_id_idx"
  ON "tenant_contribution_rate" ("tenant_id");

CREATE INDEX "tenant_contribution_rate_tenant_id_code_effective_from_idx"
  ON "tenant_contribution_rate" ("tenant_id", "code", "effective_from");

-- Tenant isolation, the same way every other business table gets it.
GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_contribution_rate" TO cpeople_app;
ALTER TABLE "tenant_contribution_rate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_contribution_rate" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_contribution_rate_tenant_isolation"
  ON "tenant_contribution_rate"
  FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

-- A rate is never edited in place, exactly as with `overtime_rule`: a change is
-- a new row from a date, and the row it replaces is closed by setting
-- `effective_to`. That is what makes these rows their own insert-only history of
-- what the company was charged and when — editing one would rewrite what past
-- payslips were calculated from, and no audit entry would bring the old figure
-- back.
--
-- What a legitimate change touches stays updatable: closing a row, marking it
-- confirmed, its note, and the timestamp the ORM writes.
REVOKE UPDATE ON "tenant_contribution_rate" FROM cpeople_app;

GRANT UPDATE ("effective_to", "confirmed", "note", "updated_at")
  ON "tenant_contribution_rate" TO cpeople_app;
