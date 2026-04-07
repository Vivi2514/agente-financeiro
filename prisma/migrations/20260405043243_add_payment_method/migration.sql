-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'CASH', 'BANK_TRANSFER', 'BANK_SLIP');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "paymentMethod" "PaymentMethod";
