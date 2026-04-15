import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";

export async function POST(): Promise<Response> {
  try {
    const user = await requireCurrentUser();

    const result = await prisma.$transaction(async (tx) => {
      const deletedSimulationHistory = await tx.simulationHistory.deleteMany({
        where: { userId: user.id },
      });

      const deletedTransactions = await tx.transaction.deleteMany({
        where: { userId: user.id },
      });

      const deletedRecurringTransactions =
        await tx.recurringTransaction.deleteMany({
          where: { userId: user.id },
        });

      const deletedInvoices = await tx.invoice.deleteMany({
        where: { userId: user.id },
      });

      const deletedCards = await tx.cards.deleteMany({
        where: { userId: user.id },
      });

      const deletedAccounts = await tx.accounts.deleteMany({
        where: { userId: user.id },
      });

      return {
        simulationHistory: deletedSimulationHistory.count,
        transactions: deletedTransactions.count,
        recurringTransactions: deletedRecurringTransactions.count,
        invoices: deletedInvoices.count,
        cards: deletedCards.count,
        accounts: deletedAccounts.count,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Dados apagados com sucesso.",
      deleted: result,
    });
  } catch (error: unknown) {
    console.error("Erro ao resetar dados do usuário:", error);

    const message =
      error instanceof Error ? error.message : "Erro desconhecido ao resetar dados.";

    return NextResponse.json(
      {
        error: "Não foi possível resetar seus dados.",
        details: message,
      },
      { status: 500 }
    );
  }
}