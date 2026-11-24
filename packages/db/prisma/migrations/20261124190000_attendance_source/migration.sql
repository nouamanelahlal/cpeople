-- CreateEnum
CREATE TYPE "attendance_source_type" AS ENUM ('file', 'api');

-- CreateEnum
CREATE TYPE "attendance_source_status" AS ENUM ('active', 'planned');

-- CreateTable
CREATE TABLE "attendance_source" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "attendance_source_type" NOT NULL,
    "status" "attendance_source_status" NOT NULL DEFAULT 'active',
    "mapping" JSONB NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Casablanca',
    "duplicate_window_seconds" INTEGER NOT NULL DEFAULT 120,
    "endpoint" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendance_source_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_source_tenant_id_idx" ON "attendance_source"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_source_tenant_id_name_key" ON "attendance_source"("tenant_id", "name");

-- AddForeignKey
ALTER TABLE "attendance_source" ADD CONSTRAINT "attendance_source_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Rule 1: the one table this migration adds.
GRANT SELECT, INSERT, UPDATE, DELETE ON "attendance_source" TO cpeople_app;
ALTER TABLE "attendance_source" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_source" FORCE ROW LEVEL SECURITY;
CREATE POLICY "attendance_source_tenant_isolation" ON "attendance_source"
  FOR ALL USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());
