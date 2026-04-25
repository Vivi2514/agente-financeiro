import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;

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
        { error: "Não é possível reabrir uma fatura já paga." },
        { status: 400 }
      );
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { closedAt: null },
    });

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error("Erro ao reabrir fatura:", error);

    return NextResponse.json(
      {
        error: "Erro ao reabrir fatura",
        details: String(error),
      },
      { status: 500 }
    );
  }
}
