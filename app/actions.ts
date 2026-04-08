"use server";

import { prisma } from "@/lib/prisma";
import { TransactionType, Prisma } from "@prisma/client";

// Criar transação
export async function createTransaction(data: {
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  paymentMethod?: string;
  date: Date;
  accountId?: string | null;
  cardId?: string | null;
}) {
  try {
    const transaction = await prisma.transaction.create({
      data: {
        title: data.title,
        // Convertemos o número para Decimal para bater com o seu schema.prisma
        amount: new Prisma.Decimal(data.amount), 
        type: data.type,
        category: data.category,
        paymentMethod: data.paymentMethod,
        date: data.date,
        accountId: data.accountId,
        cardId: data.cardId,
      },
    });

    return { success: true, transaction };
  } catch (error) {
    console.error("Erro ao criar transação:", error);
    return { success: false, error: "Falha ao criar transação" };
  }
}

// Deletar transação
export async function deleteTransaction(id: string) {
  try {
    await prisma.transaction.delete({
      where: { id },
    });

    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar transação:", error);
    return { success: false, error: "Falha ao deletar transação" };
  }
}