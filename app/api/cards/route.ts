import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cards = await prisma.card.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(cards);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao buscar cartões" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { name, limit, closingDay, dueDay } = body;

    if (!name || !limit || !closingDay || !dueDay) {
      return NextResponse.json(
        { error: "Preencha todos os campos" },
        { status: 400 }
      );
    }

    const card = await prisma.card.create({
      data: {
        name,
        limit,
        closingDay,
        dueDay,
      },
    });

    return NextResponse.json(card);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar cartão" }, { status: 500 });
  }
}