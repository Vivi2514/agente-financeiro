import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { TransactionType } from "@prisma/client";

function shouldAffectAccountBalance(params: {
  accountId?: string | null;
  paymentMethod?: string | null;
}) {
  const { accountId, paymentMethod } = params;

  if (!accountId) return false;

  return paymentMethod !== "credit_card" && paymentMethod !== "voucher";
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

export async function POST() {
  try {
    const user = await requireCurrentUser();

    const today = new Date();
    const month = today.getMonth();
    const year = today.getFullYear();

    const recurringList = await prisma.recurringTransaction.findMany({
      where: {
        active: true,
        userId: user.id,
      },
      orderBy: { createdAt: "asc" },
    });

    const created = [];

    for (const item of recurringList) {
      const date = new Date(year, month, item.dayOfMonth, 12, 0, 0);

      const normalizedAccountId =
        item.paymentMethod === "credit_card" || item.paymentMethod === "voucher"
          ? null
          : item.accountId;

      const normalizedCardId =
        item.paymentMethod === "credit_card" ? item.cardId : null;

      const exists = await prisma.transaction.findFirst({
        where: {
          userId: user.id,
          title: item.title,
          date,
          amount: item.amount,
          type: item.type,
          category: item.category,
          paymentMethod: item.paymentMethod,
          accountId: normalizedAccountId,
          cardId: normalizedCardId,
          isFixed: item.isFixed,
        },
      });

      if (exists) continue;

      let invoiceId: string | null = null;

      if (
        item.paymentMethod === "credit_card" &&
        item.cardId &&
        item.type === "EXPENSE"
      ) {
        const invoiceMonth = date.getMonth() + 1;
        const invoiceYear = date.getFullYear();

        let invoice = await prisma.invoice.findFirst({
          where: {
            userId: user.id,
            cardId: item.cardId,
            month: invoiceMonth,
            year: invoiceYear,
          },
        });

        if (!invoice) {
          invoice = await prisma.invoice.create({
            data: {
              id: crypto.randomUUID(),
              userId: user.id,
              cardId: item.cardId,
              month: invoiceMonth,
              year: invoiceYear,
              total: 0,
              status: "OPEN",
            },
          });
        }

        invoiceId = invoice.id;
      }

      const transaction = await prisma.transaction.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          title: item.title,
          amount: item.amount,
          type: item.type,
          category: item.category,
          paymentMethod: item.paymentMethod,
          isFixed: item.isFixed,
          accountId: normalizedAccountId,
          cardId: normalizedCardId,
          invoiceId,
          date,
        },
      });

      if (invoiceId) {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            total: {
              increment: Number(item.amount),
            },
          },
        });
      }

      if (
        shouldAffectAccountBalance({
          accountId: normalizedAccountId,
          paymentMethod: item.paymentMethod,
        }) &&
        normalizedAccountId
      ) {
        await applyAccountBalanceChange({
          accountId: normalizedAccountId,
          type: item.type,
          amount: Number(item.amount),
        });
      }

      created.push(transaction);
    }

    if (created.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        message: "Nenhuma nova recorrência para gerar neste mês.",
      });
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      message: `Recorrências geradas com sucesso. Total criado: ${created.length}.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao gerar recorrências", details: String(error) },
      { status: 500 }
    );
  }
}