import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TransactionType } from "@prisma/client";

function getIdFromRequest(req: Request) {
  const { pathname } = new URL(req.url);
  const parts = pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
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

export async function PATCH(req: Request) {
  try {
    const id = getIdFromRequest(req);

    if (!id || id === "recurring") {
      return NextResponse.json(
        { error: "ID da recorrência não informado." },
        { status: 400 }
      );
    }

    const existing = await prisma.recurringTransaction.findUnique({
      where: { id },
      include: {
        account: true,
        card: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Recorrência não encontrada." },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const isToggleOnly =
      Object.keys(body).length === 1 && typeof body.active === "boolean";

    if (isToggleOnly) {
      const nextActive = body.active;

      if (nextActive) {
        const duplicateActive = await prisma.recurringTransaction.findFirst({
          where: {
            id: { not: id },
            title: existing.title,
            amount: existing.amount,
            type: existing.type,
            category: existing.category,
            paymentMethod: existing.paymentMethod,
            accountId: existing.accountId,
            cardId: existing.cardId,
            dayOfMonth: existing.dayOfMonth,
            active: true,
            isFixed: existing.isFixed, // 👈 IMPORTANTE
          },
        });

        if (duplicateActive) {
          return NextResponse.json(
            {
              error:
                "Já existe outra recorrência ativa com os mesmos dados. Exclua ou pause a duplicada antes de ativar esta.",
            },
            { status: 400 }
          );
        }
      }

      const updated = await prisma.recurringTransaction.update({
        where: { id },
        data: { active: nextActive },
        include: {
          account: true,
          card: true,
        },
      });

      return NextResponse.json({
        ...updated,
        amount: Number(updated.amount),
      });
    }

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
      !accountId
    ) {
      return NextResponse.json(
        { error: "Selecione uma conta para essa recorrência." },
        { status: 400 }
      );
    }

    const normalizedTitle = String(title).trim();
    const normalizedAccountId =
      paymentMethod === "credit_card" || paymentMethod === "voucher"
        ? null
        : accountId || null;
    const normalizedCardId =
      paymentMethod === "credit_card" ? cardId || null : null;
    const normalizedPaymentMethod = paymentMethod || null;

    if (existing.active) {
      const duplicateActive = await prisma.recurringTransaction.findFirst({
        where: {
          id: { not: id },
          title: normalizedTitle,
          amount: numericAmount,
          type: normalizedType,
          category: category || null,
          paymentMethod: normalizedPaymentMethod,
          accountId: normalizedAccountId,
          cardId: normalizedCardId,
          dayOfMonth: parsedDayOfMonth,
          active: true,
          isFixed: normalizedIsFixed, // 👈 IMPORTANTE
        },
      });

      if (duplicateActive) {
        return NextResponse.json(
          { error: "Já existe outra recorrência ativa com esses mesmos dados." },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.recurringTransaction.update({
      where: { id },
      data: {
        title: normalizedTitle,
        amount: numericAmount,
        type: normalizedType,
        category: category || null,
        paymentMethod: normalizedPaymentMethod,
        accountId: normalizedAccountId,
        cardId: normalizedCardId,
        dayOfMonth: parsedDayOfMonth,
        isFixed: normalizedIsFixed, // 👈 SALVA AQUI
      },
      include: {
        account: true,
        card: true,
      },
    });

    return NextResponse.json({
      ...updated,
      amount: Number(updated.amount),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao atualizar recorrência", details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const id = getIdFromRequest(req);

    if (!id || id === "recurring") {
      return NextResponse.json(
        { error: "ID da recorrência não informado." },
        { status: 400 }
      );
    }

    const existing = await prisma.recurringTransaction.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Recorrência não encontrada." },
        { status: 404 }
      );
    }

    await prisma.recurringTransaction.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao excluir recorrência", details: String(error) },
      { status: 500 }
    );
  }
}