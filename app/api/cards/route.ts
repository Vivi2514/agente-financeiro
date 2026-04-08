import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cards = await prisma.card.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(cards);
  } catch (error) {
    console.error("Erro REAL ao buscar cartões:", error);

    return NextResponse.json(
      {
        error: "Erro ao buscar cartões",
        details: String(error),
      },
      { status: 500 }
    );
  }
}