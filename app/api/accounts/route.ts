import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: "desc" },
    });

    const formattedAccounts = accounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: account.bank, // mantém compatibilidade com a tela
      balance: Number(account.balance),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }));

    return NextResponse.json(formattedAccounts);
  } catch (error) {
    console.error("Erro ao buscar contas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar contas" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const account = await prisma.account.create({
      data: {
        name: body.name,
        bank: body.type ?? "Conta",
        balance: body.balance ?? 0,
      },
    });

    const formattedAccount = {
      id: account.id,
      name: account.name,
      type: account.bank,
      balance: Number(account.balance),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };

    return NextResponse.json(formattedAccount, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar conta:", error);
    return NextResponse.json(
      { error: "Erro ao criar conta" },
      { status: 500 }
    );
  }
}