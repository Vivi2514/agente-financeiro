import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";

export async function GET() {
  try {
    const user = await requireCurrentUser();

    const accounts = await prisma.accounts.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      accounts.map((account) => ({
        id: account.id,
        name: account.name,
        bank: account.bank,
        balance: Number(account.balance),
        userId: account.userId,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }))
    );
  } catch (error) {
    console.error("Erro ao buscar contas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar contas", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await req.json();

    const { name, type, bank, balance } = body;

    if (!name || balance === undefined) {
      return NextResponse.json(
        { error: "Nome e saldo são obrigatórios." },
        { status: 400 }
      );
    }

    const account = await prisma.accounts.create({
      data: {
        id: crypto.randomUUID(),
        name: String(name).trim(),
        bank: bank
          ? String(bank).trim()
          : type
          ? String(type).trim()
          : null,
        balance: Number(balance),
        userId: user.id,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        id: account.id,
        name: account.name,
        bank: account.bank,
        balance: Number(account.balance),
        userId: account.userId,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar conta:", error);
    return NextResponse.json(
      { error: "Erro ao criar conta", details: String(error) },
      { status: 500 }
    );
  }
}