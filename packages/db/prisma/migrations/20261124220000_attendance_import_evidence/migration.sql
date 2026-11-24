-- The imported file is evidence (M10 / HR-04, build spec §5.3).
--
-- The trial stores the file and a SHA-256 of it; the confirmation hashes what
-- it is about to read and refuses if the two disagree. That check only means
-- something if the stored bytes cannot be rewritten afterwards, so they cannot.
--
-- The lock is per column rather than per table, which is the difference from
-- "punch". An import row's `status` has to keep moving — previewed, committed,
-- replaced — and its counts are written when it commits. What must never change
-- is the file and the hash of it.
--
-- Postgres will not let a column-level REVOKE cut into a table-level grant, so
-- the table grant goes and the columns that may legitimately change are granted
-- back by name. Anything not on this list — the file, its hash, who imported
-- it, when, and which tenant it belongs to — is write-once for the runtime
-- role. The owner role used by migrations is unaffected, as everywhere else.
ALTER TABLE "attendance_import" ADD COLUMN "content_sha256" text;

REVOKE UPDATE ON "attendance_import" FROM cpeople_app;

GRANT UPDATE (
  "source_id",
  "status",
  "file_key",
  "period_from",
  "period_to",
  "rows",
  "matched",
  "unknown",
  "duplicates",
  "days_built",
  "exceptions",
  "committed_at"
) ON "attendance_import" TO cpeople_app;
