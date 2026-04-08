import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transação não encontrada" },
        { status: 404 }
      );
    }

    const { invoiceId, purchaseGroupId } = transaction;

    if (purchaseGroupId) {
      const groupTransactions = await prisma.transaction.findMany({
        where: { purchaseGroupId },
      });

      for (const t of groupTransactions) {
        if (t.invoiceId) {
          const invoice = await prisma.invoice.findUnique({
            where: { id: t.invoiceId },
          });

          if (invoice) {
            const nextTotal = Math.max(0, Number(invoice.total) - Number(t.amount));

            await prisma.invoice.update({
              where: { id: t.invoiceId },
              data: {
                total: nextTotal,
              },
            });
          }
        }
      }

      await prisma.transaction.deleteMany({
        where: { purchaseGroupId },
      });

      return NextResponse.json({ success: true });
    }

    if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (invoice) {
        const nextTotal = Math.max(0, Number(invoice.total) - Number(transaction.amount));

        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            total: nextTotal,
          },
        });
      }
    }

    await prisma.transaction.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir transação:", error);

    return NextResponse.json(
      { error: "Erro ao excluir transação" },
      { status: 500 }
    );
  }
}