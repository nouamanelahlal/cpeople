-- Overtime rules are effective-dated, and a rate is never edited in place
-- (CLAUDE.md rule 3; HR-02 build spec §5.6).
--
-- Leave rules already work this way in the application: changing one writes a
-- new row from a date and closes the old one by setting `effective_to`. Nothing
-- writes overtime rules yet except the seed — which is exactly why this belongs
-- here now, before the settings screen that edits them is built. A screen that
-- updated a rate in place would silently rewrite what every past payslip was
-- calculated from, and no audit entry would bring the old figure back.
--
-- So the runtime role keeps UPDATE only on what a legitimate change touches:
--
--   effective_to  closing a row when its successor starts
--   confirmed     "Confirmed by SMG" — the values do not change, somebody
--                 validated them (the history of who and when is its own row,
--                 build spec §7.1)
--   note          what the row is for, in words
--   updated_at    written by the ORM on any of the above
--
-- Everything that decides what a day is worth — the band, the day type, the
-- window, the rate, whether it applies to all hours, and the date it starts —
-- is write-once. A correction is a new row, like every other parameter in this
-- schema.
REVOKE UPDATE ON "overtime_rule" FROM cpeople_app;

GRANT UPDATE ("effective_to", "confirmed", "note", "updated_at")
  ON "overtime_rule" TO cpeople_app;
