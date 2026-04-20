"use server";

import { randomUUID } from "crypto";
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

  if (Number.isNaN(numberValue)) {
    throw new Error("Valor monetário inválido.");
  }

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

function parsePositiveInteger(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Número de parcelas inválido.");
  }

  return parsed;
}

function buildInstallmentTitle(baseTitle: string, current: number, total: number) {
  if (total <= 1) return baseTitle;
  return `${baseTitle} (${current}/${total})`;
}

function toInstallmentDate(baseDate: Date, installmentIndex: number) {
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + installmentIndex,
    baseDate.getDate(),
    baseDate.getHours(),
    baseDate.getMinutes(),
    baseDate.getSeconds(),
    baseDate.getMilliseconds()
  );
}

async function ensureAccountBelongsToUser(accountId: string | null, userId: string) {
  if (!accountId) return;

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

async function ensureCardBelongsToUser(cardId: string | null, userId: string) {
  if (!cardId) return;

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

async function ensureInvoiceIsEditable(invoiceId: string | null, userId: string) {
  if (!invoiceId) return null;

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      userId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!invoice) {
    throw new Error("Fatura não encontrada ou sem permissão.");
  }

  if (invoice.status === "PAID") {
    throw new Error("Não é possível alterar transações de fatura já paga.");
  }

  return invoice;
}

async function getOwnedTransactionOrThrow(id: string, userId: string) {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id,
      userId,
    },
    include: {
      invoice: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!transaction) {
    throw new Error("Transação não encontrada ou sem permissão.");
  }

  return transaction;
}

function assertTransactionEditable(transaction: Awaited<ReturnType<typeof getOwnedTransactionOrThrow>>) {
  if (transaction.invoice?.status === "PAID") {
    throw new Error("Não é possível alterar transações de fatura já paga.");
  }
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

type CreateCardInitialBalanceInput = {
  cardId: string;
  amount: string;
  date: string;
};

export async function createCardInitialBalance(data: CreateCardInitialBalanceInput) {
  const userId = await requireCurrentUserId();

  const cardId = normalizeOptionalString(data.cardId);

  if (!cardId) {
    throw new Error("Selecione um cartão para lançar o ajuste inicial.");
  }

  await ensureCardBelongsToUser(cardId, userId);

  await prisma.transaction.create({
    data: {
      title: "Saldo inicial da fatura",
      amount: parseCurrencyToDecimal(data.amount),
      type: TransactionType.EXPENSE,
      paymentMethod: "credit_card",
      cardId,
      date: new Date(data.date),
      isAdjustment: true,
      userId,
    },
  });

  revalidatePath("/");
}

type CreateTransactionInput = {
  description?: string;
  title?: string;
  amount: string;
  type: "income" | "expense";
  category?: string;
  paymentMethod?: string;
  accountId?: string;
  cardId?: string;
  date: string;
  installments?: string | number;
  installmentNumber?: string | number;
  installmentTotal?: string | number;
  purchaseGroupId?: string;
  invoiceId?: string;
  isAdjustment?: boolean;
};

export async function createTransaction(data: CreateTransactionInput) {
  const userId = await requireCurrentUserId();

  const title = (data.description || data.title || "").trim();
  if (!title) {
    throw new Error("Informe a descrição da transação.");
  }

  const paymentMethod = data.paymentMethod || "cash";
  const isCreditCard = paymentMethod === "credit_card";
  const accountId = isCreditCard ? null : normalizeOptionalString(data.accountId);
  const cardId = isCreditCard ? normalizeOptionalString(data.cardId) : null;
  const baseDate = new Date(data.date);

  if (Number.isNaN(baseDate.getTime())) {
    throw new Error("Data da transação inválida.");
  }

  await ensureAccountBelongsToUser(accountId, userId);
  await ensureCardBelongsToUser(cardId, userId);
  await ensureInvoiceIsEditable(normalizeOptionalString(data.invoiceId), userId);

  const explicitInstallmentNumber = parsePositiveInteger(data.installmentNumber);
  const explicitInstallmentTotal = parsePositiveInteger(data.installmentTotal);
  const requestedInstallments = parsePositiveInteger(data.installments) ?? 1;

  if (requestedInstallments > 1 && !isCreditCard) {
    throw new Error("Parcelamento só pode ser usado com cartão de crédito.");
  }

  const amount = parseCurrencyToDecimal(data.amount);
  const normalizedCategory = normalizeOptionalString(data.category);
  const normalizedInvoiceId = normalizeOptionalString(data.invoiceId);
  const normalizedPurchaseGroupId = normalizeOptionalString(data.purchaseGroupId);
  const normalizedType = normalizeTransactionType(data.type);
  const isAdjustment = Boolean(data.isAdjustment);

  if (explicitInstallmentTotal && explicitInstallmentTotal > 1) {
    const installmentNumber = explicitInstallmentNumber ?? 1;

    if (installmentNumber > explicitInstallmentTotal) {
      throw new Error("Parcela informada maior que o total de parcelas.");
    }

    await prisma.transaction.create({
      data: {
        title,
        amount,
        type: normalizedType,
        category: normalizedCategory,
        paymentMethod,
        accountId,
        cardId,
        invoiceId: normalizedInvoiceId,
        date: baseDate,
        installmentNumber,
        installmentTotal: explicitInstallmentTotal,
        purchaseGroupId: normalizedPurchaseGroupId,
        isAdjustment,
        userId,
      },
      include: {
        account: true,
        card: true,
      },
    });

    revalidatePath("/");
    return;
  }

  if (requestedInstallments <= 1) {
    await prisma.transaction.create({
      data: {
        title,
        amount,
        type: normalizedType,
        category: normalizedCategory,
        paymentMethod,
        accountId,
        cardId,
        invoiceId: normalizedInvoiceId,
        date: baseDate,
        installmentNumber: 1,
        installmentTotal: 1,
        purchaseGroupId: null,
        isAdjustment,
        userId,
      },
      include: {
        account: true,
        card: true,
      },
    });

    revalidatePath("/");
    return;
  }

  const purchaseGroupId = normalizedPurchaseGroupId || randomUUID();

  await prisma.$transaction(
    Array.from({ length: requestedInstallments }, (_, index) => {
      const installmentNumber = index + 1;

      return prisma.transaction.create({
        data: {
          title: buildInstallmentTitle(title, installmentNumber, requestedInstallments),
          amount,
          type: normalizedType,
          category: normalizedCategory,
          paymentMethod,
          accountId,
          cardId,
          date: toInstallmentDate(baseDate, index),
          installmentNumber,
          installmentTotal: requestedInstallments,
          purchaseGroupId,
          isAdjustment,
          userId,
        },
      });
    })
  );

  revalidatePath("/");
}

type UpdateTransactionInput = {
  id: string;
  description?: string;
  title?: string;
  amount: string;
  type: "income" | "expense";
  category?: string;
  paymentMethod?: string;
  accountId?: string;
  cardId?: string;
  date: string;
  installments?: string | number;
  isAdjustment?: boolean;
};

export async function updateTransaction(data: UpdateTransactionInput) {
  const userId = await requireCurrentUserId();
  const existingTransaction = await getOwnedTransactionOrThrow(data.id, userId);
  assertTransactionEditable(existingTransaction);

  const title = (data.description || data.title || "").trim();
  if (!title) {
    throw new Error("Informe a descrição da transação.");
  }

  const paymentMethod = data.paymentMethod || "cash";
  const isCreditCard = paymentMethod === "credit_card";
  const accountId = isCreditCard ? null : normalizeOptionalString(data.accountId);
  const cardId = isCreditCard ? normalizeOptionalString(data.cardId) : null;
  const baseDate = new Date(data.date);

  if (Number.isNaN(baseDate.getTime())) {
    throw new Error("Data da transação inválida.");
  }

  await ensureAccountBelongsToUser(accountId, userId);
  await ensureCardBelongsToUser(cardId, userId);

  const amount = parseCurrencyToDecimal(data.amount);
  const normalizedType = normalizeTransactionType(data.type);
  const normalizedCategory = normalizeOptionalString(data.category);
  const isAdjustment = Boolean(data.isAdjustment);
  const existingTotalInstallments = Number(existingTransaction.installmentTotal || 1);
  const requestedInstallments = parsePositiveInteger(data.installments) ?? existingTotalInstallments;

  if (requestedInstallments !== existingTotalInstallments) {
    throw new Error("Para mudar a quantidade de parcelas, exclua a compra parcelada e crie novamente.");
  }

  const shouldUpdateGroup =
    Boolean(existingTransaction.purchaseGroupId) && existingTotalInstallments > 1;

  if (!shouldUpdateGroup) {
    await prisma.transaction.update({
      where: { id: data.id },
      data: {
        title,
        amount,
        type: normalizedType,
        category: normalizedCategory,
        paymentMethod,
        accountId,
        cardId,
        date: baseDate,
        isAdjustment,
      },
    });

    revalidatePath("/");
    return;
  }

  const purchaseGroupId = existingTransaction.purchaseGroupId!;
  const groupTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      purchaseGroupId,
    },
    include: {
      invoice: {
        select: {
          id: true,
          status: true,
        },
      },
    },
    orderBy: [
      { installmentNumber: "asc" },
      { date: "asc" },
      { createdAt: "asc" },
    ],
  });

  if (groupTransactions.length === 0) {
    throw new Error("Grupo de parcelas não encontrado.");
  }

  const lockedInstallment = groupTransactions.find(
    (transaction) => transaction.invoice?.status === "PAID"
  );

  if (lockedInstallment) {
    throw new Error("Não é possível alterar uma compra parcelada que já tenha parcela em fatura paga.");
  }

  await prisma.$transaction(
    groupTransactions.map((transaction, index) =>
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          title: buildInstallmentTitle(title, index + 1, groupTransactions.length),
          amount,
          type: normalizedType,
          category: normalizedCategory,
          paymentMethod,
          accountId,
          cardId,
          date: toInstallmentDate(baseDate, index),
          installmentNumber: index + 1,
          installmentTotal: groupTransactions.length,
          isAdjustment,
        },
      })
    )
  );

  revalidatePath("/");
}

export async function deleteTransaction(id: string) {
  const userId = await requireCurrentUserId();
  const transaction = await getOwnedTransactionOrThrow(id, userId);
  assertTransactionEditable(transaction);

  const shouldDeleteGroup =
    Boolean(transaction.purchaseGroupId) && Number(transaction.installmentTotal || 1) > 1;

  if (!shouldDeleteGroup) {
    await prisma.transaction.delete({
      where: { id },
    });

    revalidatePath("/");
    return;
  }

  const groupedTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      purchaseGroupId: transaction.purchaseGroupId,
    },
    include: {
      invoice: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  const lockedInstallment = groupedTransactions.find(
    (item) => item.invoice?.status === "PAID"
  );

  if (lockedInstallment) {
    throw new Error("Não é possível excluir uma compra parcelada que já tenha parcela em fatura paga.");
  }

  await prisma.transaction.deleteMany({
    where: {
      userId,
      purchaseGroupId: transaction.purchaseGroupId,
    },
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
        invoice: true,
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
