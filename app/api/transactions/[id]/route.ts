import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const transactionId = params.id;

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transação não encontrada" },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const isCreditCard = transaction.paymentMethod === "credit_card";

      // 🔥 DEVOLVE O SALDO PARA A CONTA
      if (transaction.accountId && !isCreditCard) {
        const account = await tx.account.findUnique({
          where: { id: transaction.accountId },
        });

        if (!account) {
          throw new Error("Conta não encontrada");
        }

        const currentBalance = Number(account.balance);

        const newBalance =
          transaction.type === "income"
            ? currentBalance - Number(transaction.amount)
            : currentBalance + Number(transaction.amount);

        await tx.account.update({
          where: { id: transaction.accountId },
          data: {
            balance: newBalance,
          },
        });
      }

      // 🔥 DELETA A TRANSAÇÃO
      await tx.transaction.delete({
        where: { id: transactionId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar transação:", error);
    return NextResponse.json(
      { error: "Erro ao deletar transação" },
      { status: 500 }
    );
  }
}