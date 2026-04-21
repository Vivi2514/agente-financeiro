"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Account = {
  id: string;
  name: string;
  balance: number;
};

type Card = {
  id: string;
  name: string;
  limit?: number | null;
  brand?: string | null;
};

type InvoiceTransaction = {
  id: string;
  title: string;
  amount: number;
  category?: string | null;
  date: string;
  isAdjustment?: boolean | null;
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
    brand?: string | null;
  } | null;
  transactions?: InvoiceTransaction[];
};

type CardSummary = {
  id: string;
  name: string;
  limit: number;
  openTotal: number;
  paidTotal: number;
  used: number;
  available: number;
  usagePercent: number | null;
  openInvoicesCount: number;
  latestOpenInvoice?: Invoice | null;
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

function getInvoiceLabel(month: number, year: number) {
  return `${getMonthName(month)} de ${year}`;
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
    case "Eletronico":
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

function getInvoiceTransactionCategoryLabel(transaction: InvoiceTransaction) {
  if (transaction.isAdjustment) {
    return "🛠️ Ajuste inicial do cartão";
  }

  return getCategoryLabel(transaction.category);
}

function getUsageStyles(usagePercent: number | null) {
  if (usagePercent === null) {
    return {
      badge: "app-badge-neutral",
      text: "Sem limite",
      bar: "bg-slate-300",
    };
  }

  if (usagePercent >= 90) {
    return {
      badge: "app-badge-danger",
      text: "Muito pressionado",
      bar: "bg-rose-500",
    };
  }

  if (usagePercent >= 70) {
    return {
      badge: "app-badge-warning",
      text: "Atenção",
      bar: "bg-amber-500",
    };
  }

  return {
    badge: "app-badge-success",
    text: "Saudável",
    bar: "bg-emerald-500",
  };
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>(
    {}
  );
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);

      const [invoicesResponse, accountsResponse, cardsResponse] = await Promise.all([
        fetch("/api/invoices", { cache: "no-store" }),
        fetch("/api/accounts", { cache: "no-store" }),
        fetch("/api/cards", { cache: "no-store" }),
      ]);

      if (!invoicesResponse.ok) {
        throw new Error("Erro ao buscar faturas");
      }

      const invoicesData = await invoicesResponse.json();
      const accountsData = accountsResponse.ok ? await accountsResponse.json() : [];
      const cardsData = cardsResponse.ok ? await cardsResponse.json() : [];

      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setCards(Array.isArray(cardsData) ? cardsData : []);
    } catch (error) {
      console.error("Erro ao carregar faturas:", error);
      setInvoices([]);
      setAccounts([]);
      setCards([]);
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

  const openInvoices = useMemo(() => {
    return invoices.filter((invoice) => invoice.status === "OPEN");
  }, [invoices]);

  const paidInvoices = useMemo(() => {
    return invoices.filter((invoice) => invoice.status === "PAID");
  }, [invoices]);

  const openInvoicesTotal = useMemo(() => {
    return openInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  }, [openInvoices]);

  const totalCardLimit = useMemo(() => {
    return cards.reduce((sum, card) => sum + Number(card.limit || 0), 0);
  }, [cards]);

  const totalUsedLimit = useMemo(() => {
    return openInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  }, [openInvoices]);

  const totalAvailableLimit = useMemo(() => {
    return Math.max(totalCardLimit - totalUsedLimit, 0);
  }, [totalCardLimit, totalUsedLimit]);

  const cardSummaries = useMemo<CardSummary[]>(() => {
    return cards.map((card) => {
      const cardInvoices = invoices.filter((invoice) => invoice.cardId === card.id);
      const openTotal = cardInvoices
        .filter((invoice) => invoice.status === "OPEN")
        .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

      const paidTotal = cardInvoices
        .filter((invoice) => invoice.status === "PAID")
        .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

      const latestOpenInvoice =
        cardInvoices
          .filter((invoice) => invoice.status === "OPEN")
          .sort((a, b) => {
            const aDate = new Date(a.year, a.month - 1, 1).getTime();
            const bDate = new Date(b.year, b.month - 1, 1).getTime();
            return bDate - aDate;
          })[0] || null;

      const limit = Number(card.limit || 0);
      const usagePercent = limit > 0 ? (openTotal / limit) * 100 : null;

      return {
        id: card.id,
        name: card.name,
        limit,
        openTotal,
        paidTotal,
        used: openTotal,
        available: limit > 0 ? Math.max(limit - openTotal, 0) : 0,
        usagePercent,
        openInvoicesCount: cardInvoices.filter((invoice) => invoice.status === "OPEN").length,
        latestOpenInvoice,
      };
    });
  }, [cards, invoices]);

  const invoicesOrdered = useMemo(() => {
    return [...invoices].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "OPEN" ? -1 : 1;
      }

      const aDate = new Date(a.year, a.month - 1, 1).getTime();
      const bDate = new Date(b.year, b.month - 1, 1).getTime();
      return bDate - aDate;
    });
  }, [invoices]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="app-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Cartão de crédito</p>
              <h1 className="app-title">
                Faturas e limites
              </h1>
              <p className="mt-1 app-subtitle">
                Veja faturas, limite usado, disponível e o peso de cada cartão no mês.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="app-button-primary"
              >
                Dashboard
              </Link>

              <Link
                href="/transactions"
                className="app-button-secondary"
              >
                Transações
              </Link>

              <Link
                href="/accounts"
                className="app-button-secondary"
              >
                Contas e cartões
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="app-card-soft">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Faturas em aberto
              </p>
              <p className="mt-2 text-2xl app-value-neutral">
                {formatCurrency(openInvoicesTotal)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {openInvoices.length} fatura(s) aberta(s).
              </p>
            </div>

            <div className="app-card-soft">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Limite total
              </p>
              <p className="mt-2 text-2xl app-value-neutral">
                {formatCurrency(totalCardLimit)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Soma dos limites cadastrados.
              </p>
            </div>

            <div className="app-card-soft">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Limite usado
              </p>
              <p className="mt-2 text-2xl app-value-negative">
                {formatCurrency(totalUsedLimit)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Valor atualmente comprometido.
              </p>
            </div>

            <div className="app-card-soft">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Disponível
              </p>
              <p className="mt-2 text-2xl app-value-positive">
                {formatCurrency(totalAvailableLimit)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Limite livre para novas compras.
              </p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-3xl bg-white p-6 text-slate-500 shadow-sm">
            Carregando cartões e faturas...
          </div>
        ) : (
          <>
            <section className="app-card">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-slate-900">
                  Leitura rápida por cartão
                </h2>
                <p className="text-sm text-slate-500">
                  Veja rapidamente qual cartão está saudável e qual já merece atenção.
                </p>
              </div>

              {cardSummaries.length === 0 ? (
                <div className="app-card-soft">
                  Nenhum cartão encontrado.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {cardSummaries.map((summary) => {
                    const styles = getUsageStyles(summary.usagePercent);
                    const progressWidth =
                      summary.usagePercent !== null
                        ? `${Math.min(summary.usagePercent, 100)}%`
                        : "0%";

                    return (
                      <div
                        key={summary.id}
                        className="rounded-3xl border border-slate-100 bg-slate-50 p-5"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-bold text-slate-900">
                                {summary.name}
                              </h3>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles.badge}`}
                              >
                                {styles.text}
                              </span>
                            </div>

                            <p className="mt-1 app-subtitle">
                              {summary.latestOpenInvoice
                                ? `Fatura atual: ${getInvoiceLabel(
                                    summary.latestOpenInvoice.month,
                                    summary.latestOpenInvoice.year
                                  )}`
                                : "Sem fatura aberta no momento."}
                            </p>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              Em aberto
                            </p>
                            <p className="text-2xl font-bold text-rose-600">
                              {formatCurrency(summary.openTotal)}
                            </p>
                          </div>
                        </div>

                        {summary.limit > 0 ? (
                          <>
                            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <div className="rounded-2xl bg-white p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                  Limite
                                </p>
                                <p className="mt-2 text-lg font-bold text-slate-900">
                                  {formatCurrency(summary.limit)}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-white p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                  Usado
                                </p>
                                <p className="mt-2 text-lg font-bold text-rose-600">
                                  {formatCurrency(summary.used)}
                                </p>
                              </div>

                              <div className="rounded-2xl bg-white p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                  Disponível
                                </p>
                                <p className="mt-2 text-lg font-bold text-emerald-600">
                                  {formatCurrency(summary.available)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4">
                              <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                                <span>Uso do limite</span>
                                <span>{summary.usagePercent?.toFixed(0)}%</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className={`h-full rounded-full transition-all ${styles.bar}`}
                                  style={{ width: progressWidth }}
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            Cadastre o limite deste cartão para acompanhar usado e disponível com mais precisão.
                          </div>
                        )}

                        <div className="mt-4 text-xs text-slate-500">
                          {summary.openInvoicesCount > 0
                            ? `${summary.openInvoicesCount} fatura(s) aberta(s) para este cartão.`
                            : "Nenhuma fatura aberta neste cartão."}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="app-card">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-slate-900">
                  Faturas dos cartões
                </h2>
                <p className="text-sm text-slate-500">
                  Visualize as compras lançadas no crédito e pague as faturas abertas.
                </p>
              </div>

              {invoicesOrdered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-slate-500">
                  Nenhuma fatura encontrada.
                </div>
              ) : (
                <div className="space-y-6">
                  {invoicesOrdered.map((invoice) => (
                    <section
                      key={invoice.id}
                      className="rounded-3xl border border-slate-100 p-6"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">
                            {invoice.card?.name ||
                              cards.find((card) => card.id === invoice.cardId)?.name ||
                              "Cartão"}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {getInvoiceLabel(invoice.month, invoice.year)}
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
                                ? "app-badge-success"
                                : "app-badge-warning"
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
                                className="app-input"
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
                              className="app-button-primary disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {payingInvoiceId === invoice.id
                                ? "Pagando..."
                                : "Pagar fatura"}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mt-6">
                        <h4 className="mb-3 text-sm font-semibold text-slate-700">
                          Compras da fatura
                        </h4>

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
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-slate-900">
                                    {transaction.title}
                                  </p>
                                  <p className="text-sm text-slate-500">
                                    {getInvoiceTransactionCategoryLabel(transaction)} •{" "}
                                    {new Date(transaction.date).toLocaleDateString("pt-BR")}
                                  </p>
                                </div>

                                <p className={`pl-3 font-bold ${transaction.isAdjustment ? "app-value-neutral" : "app-value-negative"}`}>
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
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="app-card">
                <h2 className="text-lg font-bold text-slate-900">Resumo do momento</h2>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-900">Faturas abertas:</span>{" "}
                    {openInvoices.length}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">Faturas pagas:</span>{" "}
                    {paidInvoices.length}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">Total em aberto:</span>{" "}
                    {formatCurrency(openInvoicesTotal)}
                  </p>
                </div>
              </div>

              <div className="app-card">
                <h2 className="text-lg font-bold text-slate-900">Leitura rápida</h2>
                <p className="mt-4 text-sm text-slate-600">
                  Use esta página para decidir qual cartão ainda tem folga e qual já está
                  pressionando seu mês. O ideal é acompanhar sempre:
                </p>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p>1. Limite disponível antes de novas compras.</p>
                  <p>2. Total das faturas abertas no mês.</p>
                  <p>3. Cartões com uso acima de 70% do limite.</p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}