import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const closedAtInput = typeof body?.closedAt === "string" ? body.closedAt.trim() : "";
    const closedAt = closedAtInput ? new Date(`${closedAtInput}T12:00:00`) : new Date();

    if (Number.isNaN(closedAt.getTime())) {
      return NextResponse.json(
        { error: "Data de fechamento inválida." },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Fatura não encontrada." },
        { status: 404 }
      );
    }

    if (invoice.status === "PAID") {
      return NextResponse.json(
        { error: "Não é possível fechar manualmente uma fatura já paga." },
        { status: 400 }
      );
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { closedAt },
    });

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error("Erro ao fechar fatura:", error);

    return NextResponse.json(
      {
        error: "Erro ao fechar fatura",
        details: String(error),
      },
      { status: 500 }
    );
  }
}
