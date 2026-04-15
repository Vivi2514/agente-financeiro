import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";

export async function GET() {
  try {
    const user = await requireCurrentUser();

    const invoices = await prisma.invoice.findMany({
      where: {
        userId: user.id,
      },
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

    const formattedInvoices = invoices.map((invoice) => ({
      id: invoice.id,
      cardId: invoice.cardId,
      month: invoice.month,
      year: invoice.year,
      total: Number(invoice.total ?? 0),
      status: invoice.status,
      paidAt: invoice.paidAt,
      paidFromAccountId: invoice.paidFromAccountId,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      card: invoice.card
        ? {
            id: invoice.card.id,
            name: invoice.card.name,
            limit: Number(invoice.card.limit ?? 0),
            closingDay: invoice.card.closingDay,
            dueDay: invoice.card.dueDay,
            brand: invoice.card.brand,
            createdAt: invoice.card.createdAt,
            updatedAt: invoice.card.updatedAt,
          }
        : null,
      transactions: invoice.transactions.map((transaction) => ({
        id: transaction.id,
        title: transaction.title,
        amount: Number(transaction.amount ?? 0),
        type: transaction.type,
        category: transaction.category,
        paymentMethod: transaction.paymentMethod,
        accountId: transaction.accountId,
        cardId: transaction.cardId,
        invoiceId: transaction.invoiceId,
        installmentNumber: transaction.installmentNumber,
        installmentTotal: transaction.installmentTotal,
        purchaseGroupId: transaction.purchaseGroupId,
        date: transaction.date,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      })),
    }));

    return NextResponse.json(formattedInvoices);
  } catch (error) {
    console.error("Erro ao buscar faturas:", error);

    return NextResponse.json(
      {
        error: "Erro ao buscar faturas",
        details: String(error),
      },
      { status: 500 }
    );
  }
}