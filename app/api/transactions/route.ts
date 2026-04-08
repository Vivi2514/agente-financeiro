import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { TransactionType } from "@prisma/client";

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

function normalizeTransactionType(value?: string): TransactionType | null {
  if (!value) return null;

  const normalized = value.toLowerCase();

  if (normalized === "income" || normalized === "entrada") {
    return TransactionType.INCOME;
  }

  if (
    normalized === "expense" ||
    normalized === "saida" ||
    normalized === "saída"
  ) {
    return TransactionType.EXPENSE;
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
      creditMode,
      date,
      createdAt,
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

    const parsedDate = safeParseDate(date || createdAt);

    const isCreditInstallmentPurchase =
      paymentMethod === "credit_card" &&
      creditMode === "parcelado" &&
      installments &&
      Number(installments) > 1;

    if (isCreditInstallmentPurchase) {
      if (!cardId) {
        return NextResponse.json(
          { error: "Cartão é obrigatório para compra parcelada no crédito." },
          { status: 400 }
        );
      }

      const totalInstallments = Number(installments);
      const purchaseGroupId = randomUUID();
      const baseDate = parsedDate;

      const transactionsData: {
        title: string;
        amount: number;
        type: TransactionType;
        category?: string | null;
        paymentMethod?: string | null;
        date: Date;
        accountId: string | null;
        cardId: string | null;
        invoiceId: string | null;
        installmentNumber: number;
        installmentTotal: number;
        purchaseGroupId: string;
      }[] = [];

      for (let i = 1; i <= totalInstallments; i++) {
        const installmentDate = new Date(baseDate);
        installmentDate.setMonth(baseDate.getMonth() + (i - 1));

        const month = installmentDate.getMonth() + 1;
        const year = installmentDate.getFullYear();

        let invoice = await prisma.invoice.findFirst({
          where: {
            cardId,
            month,
            year,
          },
        });

        if (!invoice) {
          invoice = await prisma.invoice.create({
            data: {
              cardId,
              month,
              year,
              total: 0,
              status: "OPEN",
            },
          });
        }

        transactionsData.push({
          title: `${title} (${i}/${totalInstallments})`,
          amount: Number(amount),
          type: normalizedType,
          category: category || null,
          paymentMethod: paymentMethod || null,
          date: installmentDate,
          accountId: null,
          cardId,
          invoiceId: invoice.id,
          installmentNumber: i,
          installmentTotal: totalInstallments,
          purchaseGroupId,
        });
      }

      await prisma.transaction.createMany({
        data: transactionsData,
      });

      for (const transaction of transactionsData) {
        if (!transaction.invoiceId) continue;

        await prisma.invoice.update({
          where: { id: transaction.invoiceId },
          data: {
            total: {
              increment: transaction.amount,
            },
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    let invoiceId: string | null = null;

    const isCreditCardPurchase =
      paymentMethod === "credit_card" && normalizedType === TransactionType.EXPENSE;

    if (isCreditCardPurchase) {
      if (!cardId) {
        return NextResponse.json(
          { error: "Cartão é obrigatório para compra no crédito." },
          { status: 400 }
        );
      }

      const month = parsedDate.getMonth() + 1;
      const year = parsedDate.getFullYear();

      let invoice = await prisma.invoice.findFirst({
        where: {
          cardId,
          month,
          year,
        },
      });

      if (!invoice) {
        invoice = await prisma.invoice.create({
          data: {
            cardId,
            month,
            year,
            total: 0,
            status: "OPEN",
          },
        });
      }

      invoiceId = invoice.id;
    }

    const transaction = await prisma.transaction.create({
      data: {
        title,
        amount: Number(amount),
        type: normalizedType,
        category: category || null,
        paymentMethod: paymentMethod || null,
        date: parsedDate,
        accountId:
          paymentMethod === "credit_card" || paymentMethod === "voucher"
            ? null
            : accountId || null,
        cardId: paymentMethod === "credit_card" ? cardId || null : null,
        invoiceId,
      },
      include: {
        account: true,
        card: true,
        invoice: true,
      },
    });

    if (invoiceId && normalizedType === TransactionType.EXPENSE) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          total: {
            increment: Number(amount),
          },
        },
      });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Erro ao criar transação:", error);
    return NextResponse.json(
      { error: "Erro ao criar transação" },
      { status: 500 }
    );
  }
}