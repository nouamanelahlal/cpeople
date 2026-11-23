-- CreateEnum
CREATE TYPE "leave_day_basis" AS ENUM ('working', 'calendar');

-- DropIndex
DROP INDEX "public_holiday_tenant_id_date_key";

-- AlterTable
--
-- `updated_at` is NOT NULL and the table already has rows, so it arrives with a
-- default and loses it immediately: existing holidays are stamped with now(), and
-- from here on the application sets the value like it does on every other table.
ALTER TABLE "public_holiday" ADD COLUMN     "confirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "public_holiday" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "leave_type" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "requires_document" BOOLEAN NOT NULL DEFAULT false,
    "day_basis" "leave_day_basis" NOT NULL DEFAULT 'working',
    "allows_half_days" BOOLEAN NOT NULL DEFAULT true,
    "requires_second_approval" BOOLEAN NOT NULL DEFAULT false,
    "tracks_balance" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leave_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_rule" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "entitlement_days" DECIMAL(5,2),
    "accrual_per_month" DECIMAL(5,2),
    "carry_over_max_days" DECIMAL(5,2),
    "min_notice_days" INTEGER NOT NULL DEFAULT 0,
    "max_backdate_days" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leave_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_work_week" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "working_days" INTEGER[],
    "effective_from" DATE NOT NULL,
    "note" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_work_week_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "team_off_warning_percent" INTEGER NOT NULL DEFAULT 33,
    "leave_year_start" TEXT NOT NULL DEFAULT '01-01',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leave_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_type_tenant_id_idx" ON "leave_type"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_type_tenant_id_code_key" ON "leave_type"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "leave_rule_tenant_id_idx" ON "leave_rule"("tenant_id");

-- CreateIndex
CREATE INDEX "leave_rule_tenant_id_leave_type_id_effective_from_idx" ON "leave_rule"("tenant_id", "leave_type_id", "effective_from");

-- CreateIndex
CREATE INDEX "site_work_week_tenant_id_idx" ON "site_work_week"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "site_work_week_tenant_id_site_id_effective_from_key" ON "site_work_week"("tenant_id", "site_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "leave_settings_tenant_id_key" ON "leave_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "leave_settings_tenant_id_idx" ON "leave_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "public_holiday_tenant_id_date_idx" ON "public_holiday"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "public_holiday_tenant_id_country_code_date_key" ON "public_holiday"("tenant_id", "country_code", "date");

-- AddForeignKey
ALTER TABLE "leave_type" ADD CONSTRAINT "leave_type_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_rule" ADD CONSTRAINT "leave_rule_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_rule" ADD CONSTRAINT "leave_rule_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_work_week" ADD CONSTRAINT "site_work_week_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_work_week" ADD CONSTRAINT "site_work_week_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_settings" ADD CONSTRAINT "leave_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rule 1, for the four tables this migration adds: the runtime role is granted
-- what it needs, row-level security is enabled *and* forced — without FORCE the
-- policies would not apply to the table's owner — and each table carries a policy
-- that confines every row to its own tenant.
--
-- test/rls.spec.ts walks every table carrying tenant_id and fails if one of these
-- is missing, so a table added later cannot quietly skip it.
DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'leave_type',
    'leave_rule',
    'site_work_week',
    'leave_settings'
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
