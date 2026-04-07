"use server";

import {
  PaymentMethod,
  Prisma,
  TransactionType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

type CreateAccountInput = {
  name: string;
  bank: string;
  balance: number;
};

type CreateCardInput = {
  name: string;
  brand: string;
  limit: number;
  closingDay: number;
  dueDay: number;
};

type CreateTransactionInput = {
  title: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  paymentMethod?: keyof typeof PaymentMethod | null;
  date: string;
  accountId?: string | null;
  cardId?: string | null;
};

type UpdateTransactionInput = {
  id: string;
  title: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  paymentMethod?: keyof typeof PaymentMethod | null;
  date: string;
  accountId?: string | null;
  cardId?: string | null;
};

export async function createAccount(data: CreateAccountInput) {
  const name = data.name.trim();
  const bank = data.bank.trim();
  const balance = Number(data.balance);

  if (!name) {
    throw new Error("O nome da conta é obrigatório.");
  }

  if (!bank) {
    throw new Error("O banco é obrigatório.");
  }

  if (Number.isNaN(balance)) {
    throw new Error("Saldo inválido.");
  }

  await prisma.account.create({
    data: {
      name,
      bank,
      balance: new Prisma.Decimal(balance),
    },
  });

  revalidatePath("/");
}

export async function createCard(data: CreateCardInput) {
  const name = data.name.trim();
  const brand = data.brand.trim();
  const limit = Number(data.limit);
  const closingDay = Number(data.closingDay);
  const dueDay = Number(data.dueDay);

  if (!name) {
    throw new Error("O nome do cartão é obrigatório.");
  }

  if (!brand) {
    throw new Error("A bandeira é obrigatória.");
  }

  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error("Limite inválido.");
  }

  if (Number.isNaN(closingDay) || closingDay < 1 || closingDay > 31) {
    throw new Error("Dia de fechamento inválido.");
  }

  if (Number.isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new Error("Dia de vencimento inválido.");
  }

  await prisma.card.create({
    data: {
      name,
      brand,
      limit: new Prisma.Decimal(limit),
      closingDay,
      dueDay,
    },
  });

  revalidatePath("/");
}

export async function createTransaction(data: CreateTransactionInput) {
  const title = data.title.trim();
  const amount = Number(data.amount);

  if (!title) {
    throw new Error("O título da transação é obrigatório.");
  }

  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error("Valor inválido.");
  }

  if (!data.date) {
    throw new Error("A data é obrigatória.");
  }

  const parsedDate = new Date(`${data.date}T12:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Data inválida.");
  }

  const type =
    data.type === "INCOME" ? TransactionType.INCOME : TransactionType.EXPENSE;

  const paymentMethod = data.paymentMethod
    ? PaymentMethod[data.paymentMethod]
    : null;

  if (data.accountId) {
    const accountExists = await prisma.account.findUnique({
      where: { id: data.accountId },
      select: { id: true },
    });

    if (!accountExists) {
      throw new Error("Conta selecionada não encontrada.");
    }
  }

  if (data.cardId) {
    const cardExists = await prisma.card.findUnique({
      where: { id: data.cardId },
      select: { id: true },
    });

    if (!cardExists) {
      throw new Error("Cartão selecionado não encontrado.");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.create({
      data: {
        title,
        amount: new Prisma.Decimal(amount),
        type,
        paymentMethod,
        date: parsedDate,
        accountId: data.accountId || null,
        cardId: data.cardId || null,
      },
    });

    if (data.accountId) {
      await tx.account.update({
        where: { id: data.accountId },
        data: {
          balance:
            type === TransactionType.INCOME
              ? { increment: new Prisma.Decimal(amount) }
              : { decrement: new Prisma.Decimal(amount) },
        },
      });
    }
  });

  revalidatePath("/");
}

export async function updateTransaction(data: UpdateTransactionInput) {
  const id = data.id;
  const title = data.title.trim();
  const amount = Number(data.amount);

  if (!id) {
    throw new Error("Transação inválida.");
  }

  if (!title) {
    throw new Error("O título da transação é obrigatório.");
  }

  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error("Valor inválido.");
  }

  if (!data.date) {
    throw new Error("A data é obrigatória.");
  }

  const parsedDate = new Date(`${data.date}T12:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Data inválida.");
  }

  const newType =
    data.type === "INCOME" ? TransactionType.INCOME : TransactionType.EXPENSE;

  const paymentMethod = data.paymentMethod
    ? PaymentMethod[data.paymentMethod]
    : null;

  if (data.accountId) {
    const accountExists = await prisma.account.findUnique({
      where: { id: data.accountId },
      select: { id: true },
    });

    if (!accountExists) {
      throw new Error("Conta selecionada não encontrada.");
    }
  }

  if (data.cardId) {
    const cardExists = await prisma.card.findUnique({
      where: { id: data.cardId },
      select: { id: true },
    });

    if (!cardExists) {
      throw new Error("Cartão selecionado não encontrado.");
    }
  }

  await prisma.$transaction(async (tx) => {
    const oldTransaction = await tx.transaction.findUnique({
      where: { id },
      select: {
        id: true,
        amount: true,
        type: true,
        accountId: true,
      },
    });

    if (!oldTransaction) {
      throw new Error("Transação não encontrada.");
    }

    if (oldTransaction.accountId) {
      await tx.account.update({
        where: { id: oldTransaction.accountId },
        data: {
          balance:
            oldTransaction.type === TransactionType.INCOME
              ? { decrement: oldTransaction.amount }
              : { increment: oldTransaction.amount },
        },
      });
    }

    await tx.transaction.update({
      where: { id },
      data: {
        title,
        amount: new Prisma.Decimal(amount),
        type: newType,
        paymentMethod,
        date: parsedDate,
        accountId: data.accountId || null,
        cardId: data.cardId || null,
      },
    });

    if (data.accountId) {
      await tx.account.update({
        where: { id: data.accountId },
        data: {
          balance:
            newType === TransactionType.INCOME
              ? { increment: new Prisma.Decimal(amount) }
              : { decrement: new Prisma.Decimal(amount) },
        },
      });
    }
  });

  revalidatePath("/");
}

export async function deleteTransaction(transactionId: string) {
  if (!transactionId) {
    throw new Error("Transação inválida.");
  }

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        amount: true,
        type: true,
        accountId: true,
      },
    });

    if (!transaction) {
      throw new Error("Transação não encontrada.");
    }

    if (transaction.accountId) {
      await tx.account.update({
        where: { id: transaction.accountId },
        data: {
          balance:
            transaction.type === TransactionType.INCOME
              ? { decrement: transaction.amount }
              : { increment: transaction.amount },
        },
      });
    }

    await tx.transaction.delete({
      where: { id: transactionId },
    });
  });

  revalidatePath("/");
}