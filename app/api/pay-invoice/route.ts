import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const invoiceId =
      typeof body.invoiceId === "string" ? body.invoiceId.trim() : "";
    const accountId =
      typeof body.accountId === "string" ? body.accountId.trim() : "";

    if (!invoiceId || !accountId) {
      return NextResponse.json(
        { error: "Fatura e conta são obrigatórias" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new Error("Fatura não encontrada");
      }

      if (invoice.status === "PAID") {
        throw new Error("Essa fatura já foi paga");
      }

      const account = await tx.account.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new Error("Conta não encontrada");
      }

      const invoiceTotal = Number(invoice.total);
      const accountBalance = Number(account.balance);

      if (accountBalance < invoiceTotal) {
        throw new Error("Saldo insuficiente para pagar a fatura");
      }

      const updatedAccount = await tx.account.update({
        where: { id: accountId },
        data: {
          balance: accountBalance - invoiceTotal,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paidFromAccountId: accountId,
        },
      });

      return {
        account: updatedAccount,
        invoice: updatedInvoice,
      };
    });

    return NextResponse.json({
      message: "Fatura paga com sucesso",
      account: {
        ...result.account,
        balance: Number(result.account.balance),
      },
      invoice: {
        ...result.invoice,
        total: Number(result.invoice.total),
      },
    });
  } catch (error) {
    console.error("Erro ao pagar fatura:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao pagar fatura",
      },
      { status: 500 }
    );
  }
}