-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "currentInstallment" INTEGER,
ADD COLUMN     "installmentGroup" TEXT,
ADD COLUMN     "installments" INTEGER;
