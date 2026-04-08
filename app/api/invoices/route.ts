import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        card: true,
        transactions: {
          orderBy: {
            date: "desc",
          },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    const formattedInvoices = [];

    for (const invoice of invoices) {
      const recalculatedTotal = invoice.transactions.reduce(
        (sum, transaction) => sum + Number(transaction.amount || 0),
        0
      );

      const hasTransactions = invoice.transactions.length > 0;

      // Corrige total salvo, se estiver diferente
      if (Number(invoice.total || 0) !== recalculatedTotal) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            total: recalculatedTotal,
          },
        });
      }

      // Apaga do banco fatura órfã e vazia
      if (!hasTransactions && recalculatedTotal === 0) {
        await prisma.invoice.delete({
          where: { id: invoice.id },
        });
        continue;
      }

      formattedInvoices.push({
        ...invoice,
        total: recalculatedTotal,
        transactions: invoice.transactions.map((transaction) => ({
          ...transaction,
          amount: Number(transaction.amount),
        })),
      });
    }

    return NextResponse.json(formattedInvoices);
  } catch (error) {
    console.error("Erro ao buscar faturas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar faturas" },
      { status: 500 }
    );
  }
}