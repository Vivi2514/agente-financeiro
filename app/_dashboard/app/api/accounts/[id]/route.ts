import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// ========================
// ATUALIZAR CONTA (PATCH)
// ========================
export async function PATCH(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const body = await req.json();

    const { name, bank, balance } = body;

    const account = await prisma.accounts.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    const updatedAccount = await prisma.accounts.update({
      where: { id },
      data: {
        name: name !== undefined ? String(name).trim() : account.name,
        bank: bank !== undefined ? String(bank).trim() : account.bank,
        balance: balance !== undefined ? Number(balance) : account.balance,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ...updatedAccount,
      balance: Number(updatedAccount.balance),
    });
  } catch (error) {
    console.error("Erro ao atualizar conta:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar conta", details: String(error) },
      { status: 500 }
    );
  }
}

// ========================
// EXCLUIR CONTA (DELETE)
// ========================
export async function DELETE(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;

    const account = await prisma.accounts.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    const hasTransactions = await prisma.transaction.findFirst({
      where: {
        accountId: id,
      },
    });

    if (hasTransactions) {
      return NextResponse.json(
        {
          error: "Não é possível excluir conta com transações vinculadas",
        },
        { status: 400 }
      );
    }

    await prisma.accounts.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir conta:", error);
    return NextResponse.json(
      { error: "Erro ao excluir conta", details: String(error) },
      { status: 500 }
    );
  }
}