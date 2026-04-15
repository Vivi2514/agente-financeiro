import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { TransactionType } from "@prisma/client";
import { requireCurrentUser } from "@/lib/current-user";

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

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
}

function shouldAffectAccountBalance(params: {
  accountId?: string | null;
  paymentMethod?: string | null;
}) {
  const { accountId, paymentMethod } = params;

  if (!accountId) return false;

  return paymentMethod !== "credit_card" && paymentMethod !== "voucher";
}

async function applyAccountBalanceChange(params: {
  accountId: string;
  type: TransactionType;
  amount: number;
}) {
  const { accountId, type, amount } = params;

  await prisma.accounts.update({
    where: { id: accountId },
    data: {
      balance: {
        increment: type === TransactionType.INCOME ? amount : -amount,
      },
    },
  });
}

export async function GET() {
  try {
    const user = await requireCurrentUser();

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
      },
      include: {
        account: true,
        card: true,
        invoice: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    return NextResponse.json(
      transactions.map((transaction) => ({
        ...transaction,
        amount: Number(transaction.amount),
      }))
    );
  } catch (error) {
    console.error("Erro ao buscar transações:", error);
    return NextResponse.json(
      { error: "Erro ao buscar transações", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
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
      isFixed,
    } = body;

    if (!title || amount === undefined || !type) {
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
    const numericAmount = Number(amount);
    const normalizedIsFixed = normalizeBoolean(isFixed);

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { error: "Valor inválido." },
        { status: 400 }
      );
    }

    const isExpense = normalizedType === TransactionType.EXPENSE;
    const isCreditCardPayment = paymentMethod === "credit_card";
    const totalInstallments = Number(installments || 1);

    const isInstallmentPurchase =
      isCreditCardPayment &&
      creditMode === "parcelado" &&
      totalInstallments > 1 &&
      isExpense;

    if (isCreditCardPayment && !cardId) {
      return NextResponse.json(
        { error: "Selecione um cartão para compras no crédito." },
        { status: 400 }
      );
    }

    if (
      !isCreditCardPayment &&
      paymentMethod !== "voucher" &&
      (!accountId || accountId === "")
    ) {
      return NextResponse.json(
        { error: "Selecione uma conta." },
        { status: 400 }
      );
    }

    if (accountId) {
      const account = await prisma.accounts.findFirst({
        where: {
          id: accountId,
          userId: user.id,
        },
        select: { id: true },
      });

      if (!account) {
        return NextResponse.json(
          { error: "Conta não encontrada ou sem permissão." },
          { status: 404 }
        );
      }
    }

    if (cardId) {
      const card = await prisma.cards.findFirst({
        where: {
          id: cardId,
          userId: user.id,
        },
        select: { id: true },
      });

      if (!card) {
        return NextResponse.json(
          { error: "Cartão não encontrado ou sem permissão." },
          { status: 404 }
        );
      }
    }

    if (isInstallmentPurchase) {
      const purchaseGroupId = randomUUID();
      const baseInstallmentAmount = Number(
        (numericAmount / totalInstallments).toFixed(2)
      );

      const createdTransactions = [];

      for (let i = 1; i <= totalInstallments; i++) {
        const installmentDate = new Date(parsedDate);
        installmentDate.setMonth(parsedDate.getMonth() + (i - 1));

        const month = installmentDate.getMonth() + 1;
        const year = installmentDate.getFullYear();

        let invoice = await prisma.invoice.findFirst({
          where: {
            cardId,
            month,
            year,
            userId: user.id,
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
              userId: user.id,
            },
          });
        }

        const installmentAmount =
          i < totalInstallments
            ? baseInstallmentAmount
            : Number(
                (
                  numericAmount -
                  baseInstallmentAmount * (totalInstallments - 1)
                ).toFixed(2)
              );

        const transaction = await prisma.transaction.create({
          data: {
            title: `${String(title).trim()} (${i}/${totalInstallments})`,
            amount: installmentAmount,
            type: normalizedType,
            category: category || null,
            paymentMethod,
            isFixed: normalizedIsFixed,
            date: installmentDate,
            accountId: null,
            cardId,
            invoiceId: invoice.id,
            installmentNumber: i,
            installmentTotal: totalInstallments,
            purchaseGroupId,
            userId: user.id,
          },
          include: {
            account: true,
            card: true,
            invoice: true,
          },
        });

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            total: {
              increment: installmentAmount,
            },
          },
        });

        createdTransactions.push({
          ...transaction,
          amount: Number(transaction.amount),
        });
      }

      return NextResponse.json(
        { success: true, transactions: createdTransactions },
        { status: 201 }
      );
    }

    let invoiceId: string | null = null;

    if (isCreditCardPayment && isExpense) {
      const month = parsedDate.getMonth() + 1;
      const year = parsedDate.getFullYear();

      let invoice = await prisma.invoice.findFirst({
        where: {
          cardId,
          month,
          year,
          userId: user.id,
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
            userId: user.id,
          },
        });
      }

      invoiceId = invoice.id;
    }

    const nextAccountId =
      isCreditCardPayment || paymentMethod === "voucher"
        ? null
        : accountId || null;

    const transaction = await prisma.transaction.create({
      data: {
        title: String(title).trim(),
        amount: numericAmount,
        type: normalizedType,
        category: category || null,
        paymentMethod: paymentMethod || null,
        isFixed: normalizedIsFixed,
        date: parsedDate,
        accountId: nextAccountId,
        cardId: isCreditCardPayment ? cardId || null : null,
        invoiceId,
        installmentNumber: null,
        installmentTotal: null,
        purchaseGroupId: null,
        userId: user.id,
      },
      include: {
        account: true,
        card: true,
        invoice: true,
      },
    });

    if (invoiceId && isExpense) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          total: {
            increment: numericAmount,
          },
        },
      });
    }

    if (
      shouldAffectAccountBalance({
        accountId: nextAccountId,
        paymentMethod: paymentMethod || null,
      }) &&
      nextAccountId
    ) {
      await applyAccountBalanceChange({
        accountId: nextAccountId,
        type: normalizedType,
        amount: numericAmount,
      });
    }

    return NextResponse.json(
      {
        ...transaction,
        amount: Number(transaction.amount),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar transação:", error);
    return NextResponse.json(
      { error: "Erro ao criar transação", details: String(error) },
      { status: 500 }
    );
  }
}