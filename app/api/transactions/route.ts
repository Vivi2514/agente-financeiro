import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import {
  InvoiceStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
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

function normalizeOptionalString(value?: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildTransactionForecastFields(date: Date, amount: number) {
  const today = startOfDay(new Date());
  const transactionDay = startOfDay(date);
  const isPlanned = transactionDay.getTime() > today.getTime();

  if (isPlanned) {
    return {
      status: TransactionStatus.PLANNED,
      expectedAmount: amount,
      actualAmount: null,
      expectedDate: date,
      actualDate: null,
    };
  }

  return {
    status: TransactionStatus.COMPLETED,
    expectedAmount: amount,
    actualAmount: amount,
    expectedDate: date,
    actualDate: date,
  };
}

function shouldAffectAccountBalance(params: {
  accountId?: string | null;
  paymentMethod?: string | null;
  status: TransactionStatus;
}) {
  const { accountId, paymentMethod, status } = params;

  if (!accountId) return false;
  if (status !== TransactionStatus.COMPLETED) return false;

  return paymentMethod !== "credit_card" && paymentMethod !== "voucher";
}

async function applyAccountBalanceChange(
  tx: Prisma.TransactionClient,
  params: {
    accountId: string;
    type: TransactionType;
    amount: number;
  }
) {
  const { accountId, type, amount } = params;

  await tx.accounts.update({
    where: { id: accountId },
    data: {
      balance: {
        increment: type === TransactionType.INCOME ? amount : -amount,
      },
    },
  });
}

async function recalculateInvoiceTotal(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  userId: string
) {
  const transactions = await tx.transaction.findMany({
    where: {
      invoiceId,
      userId,
    },
    select: { amount: true },
  });

  const total = transactions.reduce(
    (sum, transaction) => sum + Number(transaction.amount || 0),
    0
  );

  if (transactions.length === 0) {
    await tx.invoice.deleteMany({
      where: {
        id: invoiceId,
        userId,
        status: InvoiceStatus.OPEN,
      },
    });
    return;
  }

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      total,
    },
  });
}

async function getOrCreateOpenInvoice(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    cardId: string;
    month: number;
    year: number;
  }
) {
  const { userId, cardId, month, year } = params;

  const existing = await tx.invoice.findFirst({
    where: {
      userId,
      cardId,
      month,
      year,
    },
  });

  if (existing) {
    if (existing.status === InvoiceStatus.PAID) {
      throw new Error(
        "Não é possível lançar compra em uma fatura já paga para este mês."
      );
    }

    return existing;
  }

  return tx.invoice.create({
    data: {
      cardId,
      month,
      year,
      total: 0,
      status: InvoiceStatus.OPEN,
      userId,
    },
  });
}

async function validateCardLimit(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    cardId: string;
    purchaseAmount: number;
  }
) {
  const { userId, cardId, purchaseAmount } = params;

  const card = await tx.cards.findFirst({
    where: {
      id: cardId,
      userId,
    },
    select: {
      id: true,
      name: true,
      limit: true,
      invoices: {
        where: {
          userId,
          status: InvoiceStatus.OPEN,
        },
        select: {
          total: true,
        },
      },
    },
  });

  if (!card) {
    throw new Error("Cartão não encontrado ou sem permissão.");
  }

  const limitValue = Number(card.limit ?? 0);

  if (limitValue <= 0) {
    return;
  }

  const openInvoiceTotal = card.invoices.reduce(
    (sum, invoice) => sum + Number(invoice.total ?? 0),
    0
  );

  const availableLimit = limitValue - openInvoiceTotal;

  if (purchaseAmount > availableLimit) {
    throw new Error(
      `Limite insuficiente no cartão ${card.name}. Disponível: ${availableLimit.toLocaleString(
        "pt-BR",
        {
          style: "currency",
          currency: "BRL",
        }
      )}.`
    );
  }
}

function serializeTransaction<T extends Record<string, any>>(transaction: T) {
  return {
    ...transaction,
    amount: Number(transaction.amount),
    expectedAmount:
      transaction.expectedAmount === null || transaction.expectedAmount === undefined
        ? null
        : Number(transaction.expectedAmount),
    actualAmount:
      transaction.actualAmount === null || transaction.actualAmount === undefined
        ? null
        : Number(transaction.actualAmount),
  };
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
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(transactions.map(serializeTransaction));
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
      isAdjustment,
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
    const normalizedIsAdjustment = normalizeBoolean(isAdjustment);
    const normalizedTitle = String(title).trim();
    const normalizedCategory = normalizeOptionalString(category);
    const normalizedPaymentMethod = normalizeOptionalString(paymentMethod);
    const normalizedAccountId = normalizeOptionalString(accountId);
    const normalizedCardId = normalizeOptionalString(cardId);

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    }

    const isExpense = normalizedType === TransactionType.EXPENSE;
    const isCreditCardPayment = normalizedPaymentMethod === "credit_card";
    const totalInstallments = Number(installments || 1);

    if (
      !Number.isInteger(totalInstallments) ||
      totalInstallments < 1 ||
      totalInstallments > 24
    ) {
      return NextResponse.json(
        { error: "O número de parcelas deve estar entre 1 e 24." },
        { status: 400 }
      );
    }

    const isInstallmentPurchase =
      isCreditCardPayment &&
      creditMode === "parcelado" &&
      totalInstallments > 1 &&
      isExpense;

    if (isCreditCardPayment && !normalizedCardId) {
      return NextResponse.json(
        { error: "Selecione um cartão para compras no crédito." },
        { status: 400 }
      );
    }

    if (
      !isCreditCardPayment &&
      normalizedPaymentMethod !== "voucher" &&
      !normalizedAccountId
    ) {
      return NextResponse.json(
        { error: "Selecione uma conta." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      if (normalizedAccountId) {
        const account = await tx.accounts.findFirst({
          where: {
            id: normalizedAccountId,
            userId: user.id,
          },
          select: { id: true },
        });

        if (!account) {
          throw new Error("Conta não encontrada ou sem permissão.");
        }
      }

      if (normalizedCardId) {
        const card = await tx.cards.findFirst({
          where: {
            id: normalizedCardId,
            userId: user.id,
          },
          select: { id: true },
        });

        if (!card) {
          throw new Error("Cartão não encontrado ou sem permissão.");
        }
      }

      if (
        isCreditCardPayment &&
        normalizedCardId &&
        isExpense &&
        !normalizedIsAdjustment
      ) {
        await validateCardLimit(tx, {
          userId: user.id,
          cardId: normalizedCardId,
          purchaseAmount: numericAmount,
        });
      }

      if (isInstallmentPurchase && normalizedCardId) {
        const purchaseGroupId = randomUUID();
        const baseInstallmentAmount = Number(
          (numericAmount / totalInstallments).toFixed(2)
        );

        const createdTransactions = [];
        const affectedInvoiceIds = new Set<string>();

        for (let i = 1; i <= totalInstallments; i++) {
          const installmentDate = new Date(parsedDate);
          installmentDate.setMonth(parsedDate.getMonth() + (i - 1));

          const month = installmentDate.getMonth() + 1;
          const year = installmentDate.getFullYear();

          const invoice = await getOrCreateOpenInvoice(tx, {
            userId: user.id,
            cardId: normalizedCardId,
            month,
            year,
          });

          const installmentAmount =
            i < totalInstallments
              ? baseInstallmentAmount
              : Number(
                  (
                    numericAmount -
                    baseInstallmentAmount * (totalInstallments - 1)
                  ).toFixed(2)
                );

          const forecastFields = buildTransactionForecastFields(
            installmentDate,
            installmentAmount
          );

          const transaction = await tx.transaction.create({
            data: {
              title: `${normalizedTitle} (${i}/${totalInstallments})`,
              amount: installmentAmount,
              type: normalizedType,
              category: normalizedCategory,
              paymentMethod: normalizedPaymentMethod,
              isFixed: normalizedIsFixed,
              isAdjustment: normalizedIsAdjustment,
              date: installmentDate,
              status: forecastFields.status,
              expectedAmount: forecastFields.expectedAmount,
              actualAmount: forecastFields.actualAmount,
              expectedDate: forecastFields.expectedDate,
              actualDate: forecastFields.actualDate,
              accountId: null,
              cardId: normalizedCardId,
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

          affectedInvoiceIds.add(invoice.id);
          createdTransactions.push(serializeTransaction(transaction));
        }

        for (const invoiceId of affectedInvoiceIds) {
          await recalculateInvoiceTotal(tx, invoiceId, user.id);
        }

        return {
          success: true,
          transactions: createdTransactions,
        };
      }

      let invoiceId: string | null = null;

      if (isCreditCardPayment && isExpense && normalizedCardId) {
        const month = parsedDate.getMonth() + 1;
        const year = parsedDate.getFullYear();

        const invoice = await getOrCreateOpenInvoice(tx, {
          userId: user.id,
          cardId: normalizedCardId,
          month,
          year,
        });

        invoiceId = invoice.id;
      }

      const nextAccountId =
        isCreditCardPayment || normalizedPaymentMethod === "voucher"
          ? null
          : normalizedAccountId;

      const forecastFields = buildTransactionForecastFields(
        parsedDate,
        numericAmount
      );

      const transaction = await tx.transaction.create({
        data: {
          title: normalizedTitle,
          amount: numericAmount,
          type: normalizedType,
          category: normalizedCategory,
          paymentMethod: normalizedPaymentMethod,
          isFixed: normalizedIsFixed,
          isAdjustment: normalizedIsAdjustment,
          date: parsedDate,
          status: forecastFields.status,
          expectedAmount: forecastFields.expectedAmount,
          actualAmount: forecastFields.actualAmount,
          expectedDate: forecastFields.expectedDate,
          actualDate: forecastFields.actualDate,
          accountId: nextAccountId,
          cardId: isCreditCardPayment ? normalizedCardId : null,
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

      if (invoiceId) {
        await recalculateInvoiceTotal(tx, invoiceId, user.id);
      }

      if (
        shouldAffectAccountBalance({
          accountId: nextAccountId,
          paymentMethod: normalizedPaymentMethod,
          status: forecastFields.status,
        }) &&
        nextAccountId
      ) {
        await applyAccountBalanceChange(tx, {
          accountId: nextAccountId,
          type: normalizedType,
          amount: numericAmount,
        });
      }

      return serializeTransaction(transaction);
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar transação:", error);

    const message =
      error instanceof Error ? error.message : "Erro ao criar transação";

    return NextResponse.json(
      { error: message, details: String(error) },
      { status: 500 }
    );
  }
}