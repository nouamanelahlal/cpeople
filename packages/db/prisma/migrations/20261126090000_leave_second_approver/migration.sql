-- M09 / HR-04: who approves after the line manager (HR-02 decision 1).
-- CreateEnum
CREATE TYPE "leave_second_approver" AS ENUM ('manager_of_manager', 'hr');

-- AlterEnum
ALTER TYPE "leave_decision_kind" ADD VALUE 'approved_hr';

-- AlterTable
ALTER TABLE "leave_settings" ADD COLUMN     "second_approver" "leave_second_approver" NOT NULL DEFAULT 'manager_of_manager';
