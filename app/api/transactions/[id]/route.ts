import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InvoiceStatus, Prisma, TransactionType } from "@prisma/client";
import { requireCurrentUser } from "@/lib/current-user";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

function shouldAffectAccountBalance(params: {
  accountId?: string | null;
  paymentMethod?: string | null;
}) {
  const { accountId, paymentMethod } = params;

  if (!accountId) return false;

  return paymentMethod !== "credit_card" && paymentMethod !== "voucher";
}

function normalizeIsFixed(value: unknown): boolean {
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

async function revertAccountBalanceChange(
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
        increment: type === TransactionType.INCOME ? -amount : amount,
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
        "Não é possível vincular a transação a uma fatura já paga."
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
    ignoredInvoiceIds?: string[];
  }
) {
  const { userId, cardId, purchaseAmount, ignoredInvoiceIds = [] } = params;

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
          NOT: ignoredInvoiceIds.length
            ? {
                id: {
                  in: ignoredInvoiceIds,
                },
              }
            : undefined,
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

export async function PATCH(
  req: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const body = await req.json();

    const {
      title,
      amount,
      type,
      category,
      paymentMethod,
      accountId,
      cardId,
      createdAt,
      date,
      isFixed,
    } = body;

    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        invoice: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transação não encontrada." },
        { status: 404 }
      );
    }

    if (transaction.invoice?.status === InvoiceStatus.PAID) {
      return NextResponse.json(
        {
          error:
            "Não é permitido editar transações vinculadas a uma fatura já paga.",
        },
        { status: 400 }
      );
    }

    if (transaction.purchaseGroupId) {
      return NextResponse.json(
        {
          error:
            "Edição de compra parcelada não está disponível por esta rota. Exclua a compra inteira e lance novamente.",
        },
        { status: 400 }
      );
    }

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

    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    }

    const parsedDate = safeParseDate(date || createdAt);
    const normalizedIsFixed = normalizeIsFixed(isFixed);
    const normalizedTitle = String(title).trim();
    const normalizedCategory = normalizeOptionalString(category);
    const normalizedPaymentMethod = normalizeOptionalString(paymentMethod);
    const normalizedAccountId = normalizeOptionalString(accountId);
    const normalizedCardId = normalizeOptionalString(cardId);
    const isExpense = normalizedType === TransactionType.EXPENSE;
    const isCreditCardPayment = normalizedPaymentMethod === "credit_card";

    if (isCreditCardPayment && !normalizedCardId) {
      return NextResponse.json(
        { error: "Selecione um cartão para compras no crédito." },
        { status: 400 }
      );
    }

    if (!isCreditCardPayment && normalizedPaymentMethod !== "voucher" && !normalizedAccountId) {
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

      let nextInvoiceId: string | null = null;

      if (isCreditCardPayment && isExpense && normalizedCardId) {
        const month = parsedDate.getMonth() + 1;
        const year = parsedDate.getFullYear();

        const invoice = await getOrCreateOpenInvoice(tx, {
          userId: user.id,
          cardId: normalizedCardId,
          month,
          year,
        });

        nextInvoiceId = invoice.id;

        await validateCardLimit(tx, {
          userId: user.id,
          cardId: normalizedCardId,
          purchaseAmount: numericAmount,
          ignoredInvoiceIds: [transaction.invoiceId].filter(
            (value): value is string => Boolean(value)
          ),
        });
      }

      const previousInvoiceId = transaction.invoiceId;
      const nextAccountId =
        isCreditCardPayment || normalizedPaymentMethod === "voucher"
          ? null
          : normalizedAccountId;

      const previousShouldAffectBalance = shouldAffectAccountBalance({
        accountId: transaction.accountId,
        paymentMethod: transaction.paymentMethod,
      });

      const nextShouldAffectBalance = shouldAffectAccountBalance({
        accountId: nextAccountId,
        paymentMethod: normalizedPaymentMethod,
      });

      if (previousShouldAffectBalance && transaction.accountId) {
        await revertAccountBalanceChange(tx, {
          accountId: transaction.accountId,
          type: transaction.type,
          amount: Number(transaction.amount || 0),
        });
      }

      const updatedTransaction = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          title: normalizedTitle,
          amount: numericAmount,
          type: normalizedType,
          category: normalizedCategory,
          paymentMethod: normalizedPaymentMethod,
          date: parsedDate,
          isFixed: normalizedIsFixed,
          accountId: nextAccountId,
          cardId: isCreditCardPayment ? normalizedCardId : null,
          invoiceId: nextInvoiceId,
        },
        include: {
          account: true,
          card: true,
          invoice: true,
        },
      });

      if (nextShouldAffectBalance && nextAccountId) {
        await applyAccountBalanceChange(tx, {
          accountId: nextAccountId,
          type: normalizedType,
          amount: numericAmount,
        });
      }

      const affectedInvoiceIds = Array.from(
        new Set(
          [previousInvoiceId, nextInvoiceId].filter(
            (value): value is string => Boolean(value)
          )
        )
      );

      for (const invoiceId of affectedInvoiceIds) {
        await recalculateInvoiceTotal(tx, invoiceId, user.id);
      }

      return {
        ...updatedTransaction,
        amount: Number(updatedTransaction.amount),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro ao editar transação:", error);

    const message =
      error instanceof Error ? error.message : "Erro ao editar transação";

    return NextResponse.json(
      {
        error: message,
        details: String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const { deleteGroup } = await req.json().catch(() => ({
      deleteGroup: false,
    }));

    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        invoice: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transação não encontrada." },
        { status: 404 }
      );
    }

    if (transaction.invoice?.status === InvoiceStatus.PAID) {
      return NextResponse.json(
        {
          error:
            "Não é permitido excluir transações vinculadas a uma fatura já paga.",
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      if (transaction.purchaseGroupId) {
        const groupTransactions = await tx.transaction.findMany({
          where: {
            purchaseGroupId: transaction.purchaseGroupId,
            userId: user.id,
          },
          include: {
            invoice: true,
          },
        });

        const hasPaidInvoice = groupTransactions.some(
          (item) => item.invoice?.status === InvoiceStatus.PAID
        );

        if (hasPaidInvoice) {
          throw new Error(
            "Não é permitido excluir esta compra parcelada porque existe parcela vinculada a uma fatura já paga."
          );
        }

        if (!deleteGroup) {
          return NextResponse.json(
            {
              requiresConfirmation: true,
              message:
                "Esta transação faz parte de uma compra parcelada. Deseja excluir a compra inteira?",
            },
            { status: 409 }
          );
        }

        const affectedInvoiceIds = Array.from(
          new Set(
            groupTransactions
              .map((item) => item.invoiceId)
              .filter((value): value is string => Boolean(value))
          )
        );

        for (const item of groupTransactions) {
          if (
            shouldAffectAccountBalance({
              accountId: item.accountId,
              paymentMethod: item.paymentMethod,
            }) &&
            item.accountId
          ) {
            await revertAccountBalanceChange(tx, {
              accountId: item.accountId,
              type: item.type,
              amount: Number(item.amount || 0),
            });
          }
        }

        await tx.transaction.deleteMany({
          where: {
            purchaseGroupId: transaction.purchaseGroupId,
            userId: user.id,
          },
        });

        for (const invoiceId of affectedInvoiceIds) {
          await recalculateInvoiceTotal(tx, invoiceId, user.id);
        }

        return NextResponse.json({
          success: true,
          deletedGroup: true,
        });
      }

      const affectedInvoiceId = transaction.invoiceId || null;

      if (
        shouldAffectAccountBalance({
          accountId: transaction.accountId,
          paymentMethod: transaction.paymentMethod,
        }) &&
        transaction.accountId
      ) {
        await revertAccountBalanceChange(tx, {
          accountId: transaction.accountId,
          type: transaction.type,
          amount: Number(transaction.amount || 0),
        });
      }

      await tx.transaction.delete({
        where: { id: transaction.id },
      });

      if (affectedInvoiceId) {
        await recalculateInvoiceTotal(tx, affectedInvoiceId, user.id);
      }

      return NextResponse.json({
        success: true,
        deletedGroup: false,
      });
    });

    return result;
  } catch (error) {
    console.error("Erro ao excluir transação:", error);

    const message =
      error instanceof Error ? error.message : "Erro ao excluir transação";

    return NextResponse.json(
      {
        error: message,
        details: String(error),
      },
      { status: 500 }
    );
  }
}
