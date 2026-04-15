import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";

export async function GET() {
  try {
    const user = await requireCurrentUser();

    const cards = await prisma.cards.findMany({
      where: { userId: user.id },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(
      cards.map((card) => ({
        ...card,
        limit: Number(card.limit ?? 0),
      }))
    );
  } catch (error) {
    console.error("Erro ao buscar cartões:", error);

    return NextResponse.json(
      {
        error: "Erro ao buscar cartões",
        details: String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await req.json();

    const { name, limit, closingDay, dueDay, brand } = body;

    if (!name || limit === undefined || !closingDay || !dueDay) {
      return NextResponse.json(
        { error: "Todos os campos do cartão são obrigatórios." },
        { status: 400 }
      );
    }

    const card = await prisma.cards.create({
      data: {
        id: crypto.randomUUID(),
        name: String(name).trim(),
        brand: brand ? String(brand).trim() : null,
        limit: Number(limit),
        closingDay: Number(closingDay),
        dueDay: Number(dueDay),
        userId: user.id,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        ...card,
        limit: Number(card.limit ?? 0),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar cartão:", error);

    return NextResponse.json(
      {
        error: "Erro ao criar cartão",
        details: String(error),
      },
      { status: 500 }
    );
  }
}