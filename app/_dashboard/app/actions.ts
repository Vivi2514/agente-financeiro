"use server";

import { revalidatePath } from "next/cache";
import { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/current-user";

function parseCurrencyToDecimal(value: string | number) {
  if (typeof value === "number") {
    return new Prisma.Decimal(value.toFixed(2));
  }

  const normalized = value
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const numberValue = Number(normalized || 0);

  return new Prisma.Decimal(numberValue.toFixed(2));
}

function normalizeOptionalString(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeTransactionType(
  value: "income" | "expense"
): TransactionType {
  return value === "income"
    ? TransactionType.INCOME
    : TransactionType.EXPENSE;
}

type CreateAccountInput = {
  name: string;
  balance?: string;
};

export async function createAccount(data: CreateAccountInput) {
  const userId = await requireCurrentUserId();

  await prisma.accounts.create({
    data: {
      name: data.name.trim(),
      balance: parseCurrencyToDecimal(data.balance || "0"),
      userId,
    },
  });

  revalidatePath("/");
}

type CreateCardInput = {
  name: string;
  limit?: string;
  closingDay?: string;
  dueDay?: string;
};

export async function createCard(data: CreateCardInput) {
  const userId = await requireCurrentUserId();

  await prisma.cards.create({
    data: {
      name: data.name.trim(),
      limit: data.limit ? parseCurrencyToDecimal(data.limit) : null,
      closingDay: data.closingDay ? Number(data.closingDay) : null,
      dueDay: data.dueDay ? Number(data.dueDay) : null,
      userId,
    },
  });

  revalidatePath("/");
}

type CreateTransactionInput = {
  description: string;
  amount: string;
  type: "income" | "expense";
  category?: string;
  paymentMethod?: string;
  accountId?: string;
  cardId?: string;
  date: string;
  installments?: string;
};

export async function createTransaction(data: CreateTransactionInput) {
  const userId = await requireCurrentUserId();

  const paymentMethod = data.paymentMethod || "cash";
  const isCreditCard = paymentMethod === "credit_card";

  const accountId = isCreditCard ? null : normalizeOptionalString(data.accountId);
  const cardId = isCreditCard ? normalizeOptionalString(data.cardId) : null;

  if (accountId) {
    const account = await prisma.accounts.findFirst({
      where: {
        id: accountId,
        userId,
      },
      select: { id: true },
    });

    if (!account) {
      throw new Error("Conta não encontrada ou sem permissão.");
    }
  }

  if (cardId) {
    const card = await prisma.cards.findFirst({
      where: {
        id: cardId,
        userId,
      },
      select: { id: true },
    });

    if (!card) {
      throw new Error("Cartão não encontrado ou sem permissão.");
    }
  }

  await prisma.transaction.create({
    data: {
      title: data.description.trim(),
      amount: parseCurrencyToDecimal(data.amount),
      type: normalizeTransactionType(data.type),
      category: normalizeOptionalString(data.category),
      paymentMethod,
      accountId,
      cardId,
      date: new Date(data.date),
      userId,
    },
    include: {
      account: true,
      card: true,
    },
  });

  revalidatePath("/");
}

type UpdateTransactionInput = {
  id: string;
  description: string;
  amount: string;
  type: "income" | "expense";
  category?: string;
  paymentMethod?: string;
  accountId?: string;
  cardId?: string;
  date: string;
  installments?: string;
};

export async function updateTransaction(data: UpdateTransactionInput) {
  const userId = await requireCurrentUserId();

  const existingTransaction = await prisma.transaction.findFirst({
    where: {
      id: data.id,
      userId,
    },
    select: { id: true },
  });

  if (!existingTransaction) {
    throw new Error("Transação não encontrada ou sem permissão.");
  }

  const paymentMethod = data.paymentMethod || "cash";
  const isCreditCard = paymentMethod === "credit_card";

  const accountId = isCreditCard ? null : normalizeOptionalString(data.accountId);
  const cardId = isCreditCard ? normalizeOptionalString(data.cardId) : null;

  if (accountId) {
    const account = await prisma.accounts.findFirst({
      where: {
        id: accountId,
        userId,
      },
      select: { id: true },
    });

    if (!account) {
      throw new Error("Conta não encontrada ou sem permissão.");
    }
  }

  if (cardId) {
    const card = await prisma.cards.findFirst({
      where: {
        id: cardId,
        userId,
      },
      select: { id: true },
    });

    if (!card) {
      throw new Error("Cartão não encontrado ou sem permissão.");
    }
  }

  await prisma.transaction.update({
    where: { id: data.id },
    data: {
      title: data.description.trim(),
      amount: parseCurrencyToDecimal(data.amount),
      type: normalizeTransactionType(data.type),
      category: normalizeOptionalString(data.category),
      paymentMethod,
      accountId,
      cardId,
      date: new Date(data.date),
    },
  });

  revalidatePath("/");
}

export async function deleteTransaction(id: string) {
  const userId = await requireCurrentUserId();

  const transaction = await prisma.transaction.findFirst({
    where: {
      id,
      userId,
    },
    select: { id: true },
  });

  if (!transaction) {
    throw new Error("Transação não encontrada ou sem permissão.");
  }

  await prisma.transaction.delete({
    where: { id },
  });

  revalidatePath("/");
}

export async function getDashboardData() {
  const userId = await requireCurrentUserId();

  const [accounts, cards, transactions] = await Promise.all([
    prisma.accounts.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.cards.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: { userId },
      include: {
        account: true,
        card: true,
      },
      orderBy: { date: "desc" },
    }),
  ]);

  return {
    accounts,
    cards,
    transactions,
  };
}