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

export async function GET() {
  try {
    const user = await requireCurrentUser();

    const data = await prisma.recurringTransaction.findMany({
      where: {
        userId: user.id,
      },
      include: {
        account: true,
        card: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(
      data.map((item) => ({
        ...item,
        amount: Number(item.amount),
      }))
    );
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