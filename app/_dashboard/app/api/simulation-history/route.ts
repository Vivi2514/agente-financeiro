import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireCurrentUser } from "@/lib/current-user";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function GET() {
  try {
    const user = await requireCurrentUser();

    const items = await prisma.simulationHistory.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/simulation-history error:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar o histórico." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await request.json();

    if (
      !body?.title ||
      !body?.purchaseType ||
      !body?.recommendationStatus ||
      !body?.recommendationTitle ||
      !body?.recommendationReason
    ) {
      return NextResponse.json(
        { error: "Dados obrigatórios não informados para salvar a simulação." },
        { status: 400 }
      );
    }

    const created = await prisma.simulationHistory.create({
      data: {
        title: String(body.title),
        purchaseType: String(body.purchaseType),
        totalAmount: Number(body.totalAmount || 0),
        installmentCount:
          body.installmentCount !== undefined && body.installmentCount !== null
            ? Number(body.installmentCount)
            : null,
        installmentAmount:
          body.installmentAmount !== undefined && body.installmentAmount !== null
            ? Number(body.installmentAmount)
            : null,
        recommendedCardName: body.recommendedCardName
          ? String(body.recommendedCardName)
          : null,
        recommendationStatus: String(body.recommendationStatus),
        recommendationTitle: String(body.recommendationTitle),
        recommendationReason: String(body.recommendationReason),
        lowestProjectedMonthLabel: body.lowestProjectedMonthLabel
          ? String(body.lowestProjectedMonthLabel)
          : null,
        lowestProjectedBalance:
          body.lowestProjectedBalance !== undefined &&
          body.lowestProjectedBalance !== null
            ? Number(body.lowestProjectedBalance)
            : null,
        limitUsagePercent:
          body.limitUsagePercent !== undefined &&
          body.limitUsagePercent !== null
            ? Number(body.limitUsagePercent)
            : null,
        remainingLimitAfterPurchase:
          body.remainingLimitAfterPurchase !== undefined &&
          body.remainingLimitAfterPurchase !== null
            ? Number(body.remainingLimitAfterPurchase)
            : null,
        selectedMonth: body.selectedMonth ? String(body.selectedMonth) : null,
        userId: user.id,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/simulation-history error:", error);
    return NextResponse.json(
      { error: "Não foi possível salvar a simulação." },
      { status: 500 }
    );
  }
}