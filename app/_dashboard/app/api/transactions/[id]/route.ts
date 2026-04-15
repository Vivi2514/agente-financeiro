import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InvoiceStatus, TransactionType } from "@prisma/client";
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

async function revertAccountBalanceChange(params: {
  accountId: string;
  type: TransactionType;
  amount: number;
}) {
  const { accountId, type, amount } = params;

  await prisma.accounts.update({
    where: { id: accountId },
    data: {
      balance: {
        increment: type === TransactionType.INCOME ? -amount : amount,
      },
    },
  });
}

async function recalculateInvoiceTotal(invoiceId: string, userId: string) {
  const transactions = await prisma.transaction.findMany({
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
    await prisma.invoice.deleteMany({
      where: {
        id: invoiceId,
        userId,
        status: InvoiceStatus.OPEN,
      },
    });
    return;
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      total,
    },
  });
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
            "Edição de compra parcelada ainda não está disponível. Exclua a compra e lance novamente.",
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
    const isExpense = normalizedType === TransactionType.EXPENSE;
    const isCreditCardPayment = paymentMethod === "credit_card";

    if (isCreditCardPayment && !cardId) {
      return NextResponse.json(
        { error: "Selecione um cartão para compras no crédito." },
        { status: 400 }
      );
    }

    if (!isCreditCardPayment && paymentMethod !== "voucher" && !accountId) {
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

    let nextInvoiceId: string | null = null;

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
            status: InvoiceStatus.OPEN,
            userId: user.id,
          },
        });
      }

      nextInvoiceId = invoice.id;
    }

    const previousInvoiceId = transaction.invoiceId;
    const nextAccountId =
      isCreditCardPayment || paymentMethod === "voucher"
        ? null
        : accountId || null;

    const previousShouldAffectBalance = shouldAffectAccountBalance({
      accountId: transaction.accountId,
      paymentMethod: transaction.paymentMethod,
    });

    const nextShouldAffectBalance = shouldAffectAccountBalance({
      accountId: nextAccountId,
      paymentMethod: paymentMethod || null,
    });

    const updatedTransaction = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        title: String(title).trim(),
        amount: numericAmount,
        type: normalizedType,
        category: category || null,
        paymentMethod: paymentMethod || null,
        date: parsedDate,
        isFixed: normalizedIsFixed,
        accountId: nextAccountId,
        cardId: isCreditCardPayment ? cardId || null : null,
        invoiceId: nextInvoiceId,
      },
      include: {
        account: true,
        card: true,
        invoice: true,
      },
    });

    const affectedInvoiceIds = Array.from(
      new Set(
        [previousInvoiceId, nextInvoiceId].filter(
          (value): value is string => Boolean(value)
        )
      )
    );

    for (const invoiceId of affectedInvoiceIds) {
      await recalculateInvoiceTotal(invoiceId, user.id);
    }

    if (previousShouldAffectBalance && transaction.accountId) {
      await revertAccountBalanceChange({
        accountId: transaction.accountId,
        type: transaction.type,
        amount: Number(transaction.amount || 0),
      });
    }

    if (nextShouldAffectBalance && nextAccountId) {
      await applyAccountBalanceChange({
        accountId: nextAccountId,
        type: normalizedType,
        amount: numericAmount,
      });
    }

    return NextResponse.json({
      ...updatedTransaction,
      amount: Number(updatedTransaction.amount),
    });
  } catch (error) {
    console.error("Erro ao editar transação:", error);

    return NextResponse.json(
      {
        error: "Erro ao editar transação",
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

    if (transaction.purchaseGroupId) {
      const groupTransactions = await prisma.transaction.findMany({
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
        return NextResponse.json(
          {
            error:
              "Não é permitido excluir esta compra parcelada porque existe parcela vinculada a uma fatura já paga.",
          },
          { status: 400 }
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
          await revertAccountBalanceChange({
            accountId: item.accountId,
            type: item.type,
            amount: Number(item.amount || 0),
          });
        }
      }

      await prisma.transaction.deleteMany({
        where: {
          purchaseGroupId: transaction.purchaseGroupId,
          userId: user.id,
        },
      });

      for (const invoiceId of affectedInvoiceIds) {
        await recalculateInvoiceTotal(invoiceId, user.id);
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
      await revertAccountBalanceChange({
        accountId: transaction.accountId,
        type: transaction.type,
        amount: Number(transaction.amount || 0),
      });
    }

    await prisma.transaction.delete({
      where: { id: transaction.id },
    });

    if (affectedInvoiceId) {
      await recalculateInvoiceTotal(affectedInvoiceId, user.id);
    }

    return NextResponse.json({
      success: true,
      deletedGroup: false,
    });
  } catch (error) {
    console.error("Erro ao excluir transação:", error);

    return NextResponse.json(
      {
        error: "Erro ao excluir transação",
        details: String(error),
      },
      { status: 500 }
    );
  }
}