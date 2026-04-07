/*
  Warnings:

  - The `paymentMethod` column on the `transactions` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "accounts" ALTER COLUMN "balance" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "cards" ALTER COLUMN "limit" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "description" TEXT,
ADD COLUMN     "invoiceId" TEXT,
DROP COLUMN "paymentMethod",
ADD COLUMN     "paymentMethod" TEXT;

-- DropEnum
DROP TYPE "PaymentMethod";

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cardId" TEXT NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_cardId_month_year_key" ON "invoices"("cardId", "month", "year");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
