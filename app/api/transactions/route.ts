import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

function safeParseDate(value?: string) {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return new Date();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

function normalizeTransactionType(value?: string) {
  if (!value) return null;

  const normalized = value.toLowerCase();

  if (normalized === "income" || normalized === "entrada") {
    return "INCOME";
  }

  if (normalized === "expense" || normalized === "saida" || normalized === "saída") {
    return "EXPENSE";
  }

  return null;
}

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        account: true,
        card: true,
        invoice: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Erro ao buscar transações:", error);
    return NextResponse.json(
      { error: "Erro ao buscar transações" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      title,
      amount,
      type,
      category,
      paymentMethod,
      creditType,
      date,
      accountId,
      cardId,
      installments,
    } = body;

    if (!title || !amount || !type) {
      return NextResponse.json(
        { error: "Título, valor e tipo são obrigatórios." },
        { status: 400 }
      );
    }

    const normalizedType = normalizeTransactionType(type);

    if (!normalizedType) {
      return NextResponse.json(
        { error: "Tipo de transação inválido." },
        { status: 400 }
      );
    }

    const parsedDate = safeParseDate(date);

    const isCreditInstallmentPurchase =
      paymentMethod === "credit_card" &&
      creditType === "credit_installments" &&
      installments &&
      Number(installments) > 1;

    if (isCreditInstallmentPurchase) {
      const totalInstallments = Number(installments);
      const purchaseGroupId = randomUUID();
      const baseDate = parsedDate;

      const transactions = [];

      for (let i = 1; i <= totalInstallments; i++) {
        const installmentDate = new Date(baseDate);
        installmentDate.setMonth(baseDate.getMonth() + (i - 1));

        transactions.push({
          title: `${title} (${i}/${totalInstallments})`,
          amount: Number(amount),
          type: normalizedType,
          category,
          paymentMethod,
          date: installmentDate,
          accountId: null,
          cardId: cardId || null,
          installmentNumber: i,
          installmentTotal: totalInstallments,
          purchaseGroupId,
        });
      }

      await prisma.transaction.createMany({
        data: transactions,
      });

      return NextResponse.json({ success: true });
    }

    const transaction = await prisma.transaction.create({
      data: {
        title,
        amount: Number(amount),
        type: normalizedType,
        category,
        paymentMethod,
        date: parsedDate,
        accountId: accountId || null,
        cardId: cardId || null,
      },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Erro ao criar transação:", error);
    return NextResponse.json(
      { error: "Erro ao criar transação" },
      { status: 500 }
    );
  }
}