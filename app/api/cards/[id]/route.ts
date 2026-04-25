import { NextRequest, NextResponse } from "next/server";
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
    return undefined;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return undefined;
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

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const body = await req.json();

    const existingCard = await prisma.cards.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingCard) {
      return NextResponse.json(
        { error: "Cartão não encontrado." },
        { status: 404 }
      );
    }

    const data: {
      name?: string;
      limit?: number | null;
      monthlyLimit?: number | null;
      closingDay?: number | null;
      dueDay?: number | null;
      brand?: string | null;
    } = {};

    if ("name" in body) {
      const name = String(body.name || "").trim();
      if (!name) {
        return NextResponse.json(
          { error: "Informe o nome do cartão." },
          { status: 400 }
        );
      }
      data.name = name;
    }

    if ("limit" in body) {
      const limit = parseNullableDecimal(body.limit);
      if (limit === null || limit <= 0) {
        return NextResponse.json(
          { error: "Informe um limite válido para o cartão." },
          { status: 400 }
        );
      }
      data.limit = limit;
    }

    if ("monthlyLimit" in body) {
      data.monthlyLimit = parseNullableDecimal(body.monthlyLimit);
    }

    if ("closingDay" in body) {
      const closingDay = parseNullableInt(body.closingDay);
      if (!closingDay || closingDay < 1 || closingDay > 31) {
        return NextResponse.json(
          { error: "Informe um dia de fechamento válido." },
          { status: 400 }
        );
      }
      data.closingDay = closingDay;
    }

    if ("dueDay" in body) {
      const dueDay = parseNullableInt(body.dueDay);
      if (!dueDay || dueDay < 1 || dueDay > 31) {
        return NextResponse.json(
          { error: "Informe um dia de vencimento válido." },
          { status: 400 }
        );
      }
      data.dueDay = dueDay;
    }

    if ("brand" in body) {
      data.brand = body.brand ? String(body.brand).trim() : null;
    }

    const updatedCard = await prisma.cards.update({
      where: {
        id,
      },
      data,
    });

    return NextResponse.json(formatCard(updatedCard));
  } catch (error) {
    console.error("Erro ao atualizar cartão:", error);

    return NextResponse.json(
      {
        error: "Erro ao atualizar cartão",
        details: String(error),
      },
      { status: 500 }
    );
  }
}
