import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const body = await req.json();

    const { name, limit, closingDay, dueDay, brand } = body;

    const card = await prisma.cards.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!card) {
      return NextResponse.json(
        { error: "Cartão não encontrado." },
        { status: 404 }
      );
    }

    const updatedCard = await prisma.cards.update({
      where: { id: card.id },
      data: {
        name: name !== undefined ? String(name).trim() : card.name,
        limit: limit !== undefined ? Number(limit) : Number(card.limit ?? 0),
        closingDay:
          closingDay !== undefined
            ? Number(closingDay)
            : Number(card.closingDay ?? 0),
        dueDay:
          dueDay !== undefined ? Number(dueDay) : Number(card.dueDay ?? 0),
        brand: brand !== undefined ? String(brand).trim() : card.brand,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ...updatedCard,
      limit: Number(updatedCard.limit ?? 0),
    });
  } catch (error) {
    console.error("Erro ao atualizar cartão:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar cartão", details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;

    const card = await prisma.cards.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!card) {
      return NextResponse.json(
        { error: "Cartão não encontrado." },
        { status: 404 }
      );
    }

    const [transactionsCount, recurringsCount, invoicesCount] =
      await Promise.all([
        prisma.transaction.count({
          where: {
            cardId: id,
            userId: user.id,
          },
        }),
        prisma.recurringTransaction.count({
          where: {
            cardId: id,
            userId: user.id,
          },
        }),
        prisma.invoice.count({
          where: {
            cardId: id,
            userId: user.id,
          },
        }),
      ]);

    if (transactionsCount > 0 || recurringsCount > 0 || invoicesCount > 0) {
      return NextResponse.json(
        {
          error:
            "Não é possível excluir este cartão porque ele já está vinculado a transações, recorrências ou faturas.",
        },
        { status: 400 }
      );
    }

    await prisma.cards.delete({
      where: { id: card.id },
    });

    return NextResponse.json({
      success: true,
      message: "Cartão excluído com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao excluir cartão:", error);
    return NextResponse.json(
      { error: "Erro ao excluir cartão", details: String(error) },
      { status: 500 }
    );
  }
}