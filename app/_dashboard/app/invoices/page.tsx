"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Account = {
  id: string;
  name: string;
  balance: number;
};

type Invoice = {
  id: string;
  cardId: string;
  month: number;
  year: number;
  total: number;
  status: "OPEN" | "PAID";
  paidAt?: string | null;
  paidFromAccountId?: string | null;
  card?: {
    id: string;
    name: string;
  } | null;
  transactions?: {
    id: string;
    title: string;
    amount: number;
    category?: string | null;
    date: string;
  }[];
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getMonthName(month: number) {
  return new Date(2026, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
  });
}

function getCategoryLabel(category?: string | null) {
  switch (category) {
    case "Alimentação":
      return "🍔 Alimentação";
    case "Transporte":
      return "🚗 Transporte";
    case "Saúde":
      return "🏥 Saúde";
    case "Pet":
      return "🐶 Pet";
    case "Casa":
      return "🏠 Casa";
    case "Eletrônico":
      return "💻 Eletrônico";
    case "Lazer":
      return "🎉 Lazer";
    case "Pessoal":
      return "🧍 Pessoal";
    case "Vestuário":
      return "👕 Vestuário";
    case "SkinCare":
      return "🧴 SkinCare";
    case "Reforma":
      return "🔨 Reforma";
    case "Outros":
      return "📦 Outros";
    default:
      return category || "📦 Outros";
  }
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>(
    {}
  );
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);

      const [invoicesResponse, accountsResponse] = await Promise.all([
        fetch("/api/invoices", { cache: "no-store" }),
        fetch("/api/accounts", { cache: "no-store" }),
      ]);

      if (!invoicesResponse.ok) {
        throw new Error("Erro ao buscar faturas");
      }

      const invoicesData = await invoicesResponse.json();
      const accountsData = accountsResponse.ok ? await accountsResponse.json() : [];

      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
    } catch (error) {
      console.error("Erro ao carregar faturas:", error);
      setInvoices([]);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleAccountChange(invoiceId: string, accountId: string) {
    setSelectedAccounts((prev) => ({
      ...prev,
      [invoiceId]: accountId,
    }));
  }

  async function handlePayInvoice(invoiceId: string) {
    const accountId = selectedAccounts[invoiceId];

    if (!accountId) {
      alert("Selecione uma conta para pagar a fatura.");
      return;
    }

    try {
      setPayingInvoiceId(invoiceId);

      const response = await fetch("/api/pay-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoiceId,
          accountId,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Erro ao pagar fatura");
      }

      alert("Fatura paga com sucesso.");
      await loadData();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível pagar a fatura."
      );
    } finally {
      setPayingInvoiceId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Faturas</p>
            <h1 className="text-3xl font-bold text-slate-900">
              Faturas dos cartões
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Visualize as compras lançadas no crédito
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Dashboard
            </Link>

            <Link
              href="/transactions"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Transações
            </Link>

            <Link
              href="/accounts"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Contas e cartões
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="rounded-3xl bg-white p-6 shadow-sm text-slate-500">
            Carregando faturas...
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 shadow-sm text-slate-500">
            Nenhuma fatura encontrada.
          </div>
        ) : (
          <div className="space-y-6">
            {invoices.map((invoice) => (
              <section
                key={invoice.id}
                className="rounded-3xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {invoice.card?.name || "Cartão"}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {getMonthName(invoice.month)} de {invoice.year}
                    </p>
                  </div>

                  <div className="flex flex-col items-start md:items-end">
                    <p className="text-sm text-slate-500">Total da fatura</p>
                    <p className="text-2xl font-bold text-rose-600">
                      {formatCurrency(Number(invoice.total))}
                    </p>
                    <span
                      className={`mt-2 rounded-full px-3 py-1 text-xs font-semibold ${
                        invoice.status === "PAID"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {invoice.status === "PAID" ? "Paga" : "Aberta"}
                    </span>

                    {invoice.paidAt && (
                      <p className="mt-2 text-xs text-slate-500">
                        Paga em{" "}
                        {new Date(invoice.paidAt).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </div>

                {invoice.status === "OPEN" && (
                  <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Pagar com a conta
                        </label>
                        <select
                          value={selectedAccounts[invoice.id] || ""}
                          onChange={(e) =>
                            handleAccountChange(invoice.id, e.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                        >
                          <option value="">Selecione uma conta</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name} — {formatCurrency(Number(account.balance))}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePayInvoice(invoice.id)}
                        disabled={payingInvoiceId === invoice.id}
                        className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {payingInvoiceId === invoice.id
                          ? "Pagando..."
                          : "Pagar fatura"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">
                    Compras da fatura
                  </h3>

                  {!invoice.transactions || invoice.transactions.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Nenhuma compra vinculada.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {invoice.transactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between rounded-2xl border border-slate-100 p-4"
                        >
                          <div>
                            <p className="font-medium text-slate-900">
                              {transaction.title}
                            </p>
                            <p className="text-sm text-slate-500">
                              {getCategoryLabel(transaction.category)} •{" "}
                              {new Date(transaction.date).toLocaleDateString(
                                "pt-BR"
                              )}
                            </p>
                          </div>

                          <p className="font-bold text-rose-600">
                            {formatCurrency(Number(transaction.amount))}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}