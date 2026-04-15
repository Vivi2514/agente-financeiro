-- AlterTable
ALTER TABLE "recurring_transactions" ADD COLUMN     "isFixed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "isFixed" BOOLEAN NOT NULL DEFAULT false;
