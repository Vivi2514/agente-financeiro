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


function addMonthsToReference(year: number, month: number, monthsToAdd: number) {
  const reference = new Date(year, month - 1 + monthsToAdd, 1);

  return {
    month: reference.getMonth() + 1,
    year: reference.getFullYear(),
  };
}

async function getInvoiceStartOffsetForCreditPurchase(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    cardId: string;
    purchaseDate: Date;
  }
) {
  const { userId, cardId, purchaseDate } = params;
  const purchaseDay = startOfDay(purchaseDate);
  const purchaseMonth = purchaseDate.getMonth() + 1;
  const purchaseYear = purchaseDate.getFullYear();

  const currentInvoice = await tx.invoice.findFirst({
    where: {
      userId,
      cardId,
      month: purchaseMonth,
      year: purchaseYear,
    },
    select: {
      id: true,
      closedAt: true,
      status: true,
    },
  });

  if (!currentInvoice?.closedAt) {
    return 0;
  }

  if (currentInvoice.status === InvoiceStatus.PAID) {
    return 1;
  }

  const closedDay = startOfDay(currentInvoice.closedAt);

  if (purchaseDay.getTime() > closedDay.getTime()) {
    return 1;
  }

  return 0;
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

export async function GET(req: Request) {
  try {
    const user = await requireCurrentUser();
    const url = new URL(req.url);
    const monthParam = url.searchParams.get("month");

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

    if (!monthParam) {
      return NextResponse.json(transactions.map(serializeTransaction));
    }

    const [selectedYear, selectedMonth] = monthParam.split("-").map(Number);

    if (
      !selectedYear ||
      !selectedMonth ||
      selectedMonth < 1 ||
      selectedMonth > 12
    ) {
      return NextResponse.json(transactions.map(serializeTransaction));
    }

    const selectedMonthStart = new Date(selectedYear, selectedMonth - 1, 1);
    const daysInSelectedMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    const getTransactionDate = (transaction: Record<string, any>) => {
      return new Date(transaction.date || transaction.createdAt);
    };

    const buildFixedTemplateKey = (transaction: (typeof transactions)[number]) => {
      return [
        String(transaction.title || "").trim().toLowerCase(),
        String(transaction.type || "").trim().toLowerCase(),
        String(transaction.category || "").trim().toLowerCase(),
        String(transaction.paymentMethod || "").trim().toLowerCase(),
        transaction.accountId || "",
        transaction.cardId || "",
        Number(transaction.amount || 0).toFixed(2),
      ].join("|");
    };

    const realTransactionExistsForTemplateInSelectedMonth = (
      template: (typeof transactions)[number]
    ) => {
      const templateKey = buildFixedTemplateKey(template);

      return transactions.some((transaction) => {
        const transactionDate = getTransactionDate(transaction);

        if (Number.isNaN(transactionDate.getTime())) return false;
        if (transactionDate.getFullYear() !== selectedYear) return false;
        if (transactionDate.getMonth() + 1 !== selectedMonth) return false;
        if (transaction.isAdjustment) return false;

        return buildFixedTemplateKey(transaction) === templateKey;
      });
    };

    const fixedTemplates = new Map<string, (typeof transactions)[number]>();

    transactions.forEach((transaction) => {
      if (!transaction.isFixed) return;
      if (transaction.isAdjustment) return;

      const transactionDate = getTransactionDate(transaction);
      if (Number.isNaN(transactionDate.getTime())) return;

      const key = buildFixedTemplateKey(transaction);
      const currentTemplate = fixedTemplates.get(key);

      if (!currentTemplate) {
        fixedTemplates.set(key, transaction);
        return;
      }

      const currentTemplateDate = getTransactionDate(currentTemplate);

      if (transactionDate.getTime() < currentTemplateDate.getTime()) {
        fixedTemplates.set(key, transaction);
      }
    });

    const generatedFixedTransactions: Array<Record<string, any>> = Array.from(fixedTemplates.values())
      .filter((template) => {
        const templateDate = getTransactionDate(template);
        if (Number.isNaN(templateDate.getTime())) return false;

        const templateMonthStart = new Date(
          templateDate.getFullYear(),
          templateDate.getMonth(),
          1
        );

        if (selectedMonthStart.getTime() < templateMonthStart.getTime()) {
          return false;
        }

        return !realTransactionExistsForTemplateInSelectedMonth(template);
      })
      .map((template) => {
        const templateDate = getTransactionDate(template);
        const day = Math.min(
          Math.max(templateDate.getDate(), 1),
          daysInSelectedMonth
        );
        const projectedDate = new Date(selectedYear, selectedMonth - 1, day, 12);
        const amount = Number(template.amount || 0);

        return {
          ...template,
          id: `virtual-${template.id}-${monthParam}`,
          date: projectedDate,
          createdAt: projectedDate,
          updatedAt: projectedDate,
          status: TransactionStatus.PLANNED,
          expectedAmount: amount,
          actualAmount: null,
          expectedDate: projectedDate,
          actualDate: null,
          invoiceId: null,
          invoice: null,
          isVirtual: true,
        };
      });

    const result: Array<Record<string, any>> = [
      ...transactions,
      ...generatedFixedTransactions,
    ].sort((a, b) => {
      const dateA = getTransactionDate(a).getTime();
      const dateB = getTransactionDate(b).getTime();
      return dateB - dateA;
    });

    return NextResponse.json(result.map(serializeTransaction));
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

      const invoiceStartOffset =
        isCreditCardPayment && normalizedCardId && isExpense
          ? await getInvoiceStartOffsetForCreditPurchase(tx, {
              userId: user.id,
              cardId: normalizedCardId,
              purchaseDate: parsedDate,
            })
          : 0;

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

          const invoiceReference = addMonthsToReference(
            parsedDate.getFullYear(),
            parsedDate.getMonth() + 1,
            invoiceStartOffset + (i - 1)
          );

          const invoice = await getOrCreateOpenInvoice(tx, {
            userId: user.id,
            cardId: normalizedCardId,
            month: invoiceReference.month,
            year: invoiceReference.year,
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
        const invoiceReference = addMonthsToReference(
          parsedDate.getFullYear(),
          parsedDate.getMonth() + 1,
          invoiceStartOffset
        );

        const invoice = await getOrCreateOpenInvoice(tx, {
          userId: user.id,
          cardId: normalizedCardId,
          month: invoiceReference.month,
          year: invoiceReference.year,
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