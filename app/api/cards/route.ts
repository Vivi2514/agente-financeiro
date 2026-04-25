import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";

function parseNullableDecimal(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue =
    typeof value === "number"
      ? value
      : Number(String(value).replace(",", "."));

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return numberValue;
}

function parseNullableInt(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return numberValue;
}

function formatCard(card: any) {
  return {
    id: card.id,
    name: card.name,
    brand: card.brand,
    limit: Number(card.limit ?? 0),
    monthlyLimit: card.monthlyLimit === null ? null : Number(card.monthlyLimit ?? 0),
    closingDay: card.closingDay,
    dueDay: card.dueDay,
    userId: card.userId,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}

export async function GET() {
  try {
    const user = await requireCurrentUser();

    const cards = await prisma.cards.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(cards.map(formatCard));
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

    const name = String(body.name || "").trim();
    const limit = parseNullableDecimal(body.limit);
    const monthlyLimit = parseNullableDecimal(body.monthlyLimit);
    const closingDay = parseNullableInt(body.closingDay);
    const dueDay = parseNullableInt(body.dueDay);

    if (!name) {
      return NextResponse.json(
        { error: "Informe o nome do cartão." },
        { status: 400 }
      );
    }

    if (limit === null || limit <= 0) {
      return NextResponse.json(
        { error: "Informe um limite válido para o cartão." },
        { status: 400 }
      );
    }

    if (!closingDay || closingDay < 1 || closingDay > 31) {
      return NextResponse.json(
        { error: "Informe um dia de fechamento válido." },
        { status: 400 }
      );
    }

    if (!dueDay || dueDay < 1 || dueDay > 31) {
      return NextResponse.json(
        { error: "Informe um dia de vencimento válido." },
        { status: 400 }
      );
    }

    const card = await prisma.cards.create({
      data: {
        name,
        limit,
        monthlyLimit,
        closingDay,
        dueDay,
        userId: user.id,
      },
    });

    return NextResponse.json(formatCard(card), { status: 201 });
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
