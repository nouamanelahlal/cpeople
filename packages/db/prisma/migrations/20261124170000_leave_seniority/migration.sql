-- AlterTable
ALTER TABLE "leave_rule" ADD COLUMN     "cap_days" DECIMAL(5,2),
ADD COLUMN     "seniority_bonus_days" DECIMAL(5,2),
ADD COLUMN     "seniority_bonus_every_years" INTEGER,
ADD COLUMN     "usable_after_months" INTEGER;

