"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

type CreateAccountInput = {
  name: string;
  type?: string;
  balance?: string;
};

export async function createAccount(data: CreateAccountInput) {
  await prisma.account.create({
    data: {
      name: data.name,
      type: normalizeOptionalString(data.type),
      balance: parseCurrencyToDecimal(data.balance || "0"),
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
  await prisma.creditCard.create({
    data: {
      name: data.name,
      limit: data.limit ? parseCurrencyToDecimal(data.limit) : null,
      closingDay: data.closingDay ? Number(data.closingDay) : null,
      dueDay: data.dueDay ? Number(data.dueDay) : null,
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
  const paymentMethod = data.paymentMethod || "cash";
  const isCreditCard = paymentMethod === "credit_card";

  const accountId = isCreditCard ? null : normalizeOptionalString(data.accountId);
  const cardId = isCreditCard ? normalizeOptionalString(data.cardId) : null;

  await prisma.transaction.create({
    data: {
      description: data.description,
      amount: parseCurrencyToDecimal(data.amount),
      type: data.type,
      category: normalizeOptionalString(data.category),
      paymentMethod,
      accountId,
      cardId,
      installments: data.installments ? Number(data.installments) : null,
      date: new Date(data.date),
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
  const paymentMethod = data.paymentMethod || "cash";
  const isCreditCard = paymentMethod === "credit_card";

  const accountId = isCreditCard ? null : normalizeOptionalString(data.accountId);
  const cardId = isCreditCard ? normalizeOptionalString(data.cardId) : null;

  await prisma.transaction.update({
    where: { id: data.id },
    data: {
      description: data.description,
      amount: parseCurrencyToDecimal(data.amount),
      type: data.type,
      category: normalizeOptionalString(data.category),
      paymentMethod,
      accountId,
      cardId,
      installments: data.installments ? Number(data.installments) : null,
      date: new Date(data.date),
    },
  });

  revalidatePath("/");
}

export async function deleteTransaction(id: string) {
  await prisma.transaction.delete({
    where: { id },
  });

  revalidatePath("/");
}

export async function getDashboardData() {
  const [accounts, cards, transactions] = await Promise.all([
    prisma.account.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.creditCard.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.findMany({
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