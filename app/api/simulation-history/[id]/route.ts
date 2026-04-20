import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "ID da simulação não informado." },
        { status: 400 }
      );
    }

    const deleted = await prisma.simulationHistory.deleteMany({
      where: {
        id,
        userId: user.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Simulação não encontrada." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/simulation-history/[id] error:", error);
    return NextResponse.json(
      { error: "Não foi possível excluir a simulação." },
      { status: 500 }
    );
  }
}
