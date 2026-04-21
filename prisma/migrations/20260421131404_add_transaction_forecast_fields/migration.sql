-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PLANNED', 'COMPLETED');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "actualAmount" DECIMAL(10,2),
ADD COLUMN     "actualDate" TIMESTAMP(3),
ADD COLUMN     "expectedAmount" DECIMAL(10,2),
ADD COLUMN     "expectedDate" TIMESTAMP(3),
ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED';

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_userId_status_idx" ON "transactions"("userId", "status");

-- CreateIndex
CREATE INDEX "transactions_expectedDate_idx" ON "transactions"("expectedDate");

-- CreateIndex
CREATE INDEX "transactions_actualDate_idx" ON "transactions"("actualDate");
