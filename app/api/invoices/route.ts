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
      orderBy: [
        { year: "desc" },
        { month: "desc" },
      ],
    });

    const formattedInvoices = invoices.map((invoice) => ({
      ...invoice,
      total: Number(invoice.total),
      transactions: invoice.transactions.map((transaction) => ({
        ...transaction,
        amount: Number(transaction.amount),
      })),
    }));

    return NextResponse.json(formattedInvoices);
  } catch (error) {
    console.error("Erro ao buscar faturas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar faturas" },
      { status: 500 }
    );
  }
}