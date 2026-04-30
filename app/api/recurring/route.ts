import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TransactionType } from "@prisma/client";
import { requireCurrentUser } from "@/lib/current-user";

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

export async function GET(req: Request) {
  try {
    const user = await requireCurrentUser();
    const url = new URL(req.url);
    const monthParam = url.searchParams.get("month"); // formato YYYY-MM

    const data = await prisma.recurringTransaction.findMany({
      where: {
        userId: user.id,
      },
      include: {
        account: true,
        card: true,
      },
      orderBy: monthParam
        ? {
            dayOfMonth: "asc",
          }
        : {
            createdAt: "desc",
          },
    });

    if (!monthParam) {
      return NextResponse.json(
        data.map((item) => ({
          ...item,
          amount: Number(item.amount),
        }))
      );
    }

    const [year, month] = monthParam.split("-").map(Number);

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Mês inválido. Use o formato YYYY-MM." },
        { status: 400 }
      );
    }

    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const realTransactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        account: true,
        card: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    const normalizeText = (value?: string | null) =>
      (value || "").trim().toLowerCase();

    const normalizeAmount = (value: unknown) =>
      Math.round(Number(value || 0) * 100);

    const getPlannedDate = (dayOfMonth: number) => {
      const daysInMonth = new Date(year, month, 0).getDate();
      const safeDay = Math.min(Math.max(Number(dayOfMonth || 1), 1), daysInMonth);
      return new Date(year, month - 1, safeDay, 12, 0, 0, 0);
    };

    const result = data.map((item) => {
      const plannedDate = getPlannedDate(item.dayOfMonth);

      const paidTransaction = realTransactions.find((transaction) => {
        const transactionDate = new Date(transaction.date);
        const sameTitle = normalizeText(transaction.title) === normalizeText(item.title);
        const sameType = transaction.type === item.type;
        const sameCategory =
          normalizeText(transaction.category) === normalizeText(item.category);
        const samePaymentMethod =
          normalizeText(transaction.paymentMethod) === normalizeText(item.paymentMethod);
        const sameAccount = (transaction.accountId || null) === (item.accountId || null);
        const sameCard = (transaction.cardId || null) === (item.cardId || null);
        const sameDay = transactionDate.getDate() === plannedDate.getDate();

        return (
          sameTitle &&
          sameType &&
          sameCategory &&
          samePaymentMethod &&
          sameAccount &&
          sameCard &&
          sameDay
        );
      });

      if (paidTransaction) {
        return {
          ...item,
          amount: Number(paidTransaction.amount),
          plannedAmount: Number(item.amount),
          actualAmount: Number(paidTransaction.amount),
          plannedDate: plannedDate.toISOString(),
          actualDate: paidTransaction.date,
          monthlyStatus: "PAID",
          status: "PAID",
          isPaid: true,
          isIgnored: false,
          realTransactionId: paidTransaction.id,
          account: paidTransaction.account || item.account,
          card: paidTransaction.card || item.card,
        };
      }

      return {
        ...item,
        amount: Number(item.amount),
        plannedAmount: Number(item.amount),
        actualAmount: null,
        plannedDate: plannedDate.toISOString(),
        actualDate: null,
        monthlyStatus: "PLANNED",
        status: "PLANNED",
        isPaid: false,
        isIgnored: false,
        realTransactionId: null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao buscar recorrências", details: String(error) },
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
      accountId,
      cardId,
      dayOfMonth,
      isFixed,
    } = body;

    if (!title || amount === undefined || !type || !dayOfMonth) {
      return NextResponse.json(
        { error: "Título, valor, tipo e dia do mês são obrigatórios." },
        { status: 400 }
      );
    }

    const normalizedType = normalizeTransactionType(type);

    if (!normalizedType) {
      return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
    }

    const numericAmount = Number(amount);
    const normalizedIsFixed = normalizeBoolean(isFixed);

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    }

    const parsedDayOfMonth = Number(dayOfMonth);

    if (
      Number.isNaN(parsedDayOfMonth) ||
      parsedDayOfMonth < 1 ||
      parsedDayOfMonth > 31
    ) {
      return NextResponse.json(
        { error: "O dia do mês deve estar entre 1 e 31." },
        { status: 400 }
      );
    }

    if (paymentMethod === "credit_card" && !cardId) {
      return NextResponse.json(
        { error: "Selecione um cartão para recorrência no crédito." },
        { status: 400 }
      );
    }

    if (
      paymentMethod !== "credit_card" &&
      paymentMethod !== "voucher" &&
      (!accountId || accountId === "")
    ) {
      return NextResponse.json(
        { error: "Selecione uma conta para essa recorrência." },
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

    const normalizedTitle = String(title).trim();

    const exists = await prisma.recurringTransaction.findFirst({
      where: {
        userId: user.id,
        title: normalizedTitle,
        amount: numericAmount,
        type: normalizedType,
        category: category || null,
        paymentMethod: paymentMethod || null,
        accountId:
          paymentMethod === "credit_card" || paymentMethod === "voucher"
            ? null
            : accountId || null,
        cardId: paymentMethod === "credit_card" ? cardId || null : null,
        dayOfMonth: parsedDayOfMonth,
        active: true,
        isFixed: normalizedIsFixed, // 👈 IMPORTANTE
      },
    });

    if (exists) {
      return NextResponse.json(
        { error: "Essa recorrência já existe e está ativa." },
        { status: 400 }
      );
    }

    const recurring = await prisma.recurringTransaction.create({
      data: {
        title: normalizedTitle,
        amount: numericAmount,
        type: normalizedType,
        category: category || null,
        paymentMethod: paymentMethod || null,
        isFixed: normalizedIsFixed, // 👈 AQUI SALVA
        accountId:
          paymentMethod === "credit_card" || paymentMethod === "voucher"
            ? null
            : accountId || null,
        cardId: paymentMethod === "credit_card" ? cardId || null : null,
        dayOfMonth: parsedDayOfMonth,
        active: true,
        userId: user.id,
      },
      include: {
        account: true,
        card: true,
      },
    });

    return NextResponse.json(
      {
        ...recurring,
        amount: Number(recurring.amount),
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao criar recorrência", details: String(error) },
      { status: 500 }
    );
  }
}