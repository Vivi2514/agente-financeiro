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
  type?: string | null;
  category?: string | null;
  paymentMethod?: string | null;
  cardId?: string | null;
  invoiceId?: string | null;
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
  dueDate?: string | null;
  paidAt?: string | null;
  closedAt?: string | null;
  paidFromAccountId?: string | null;
  card?: {
    id: string;
    name: string;
    brand?: string | null;
  } | null;
  transactions?: InvoiceTransaction[];
};

type InvoiceDisplayDetails = {
  transactions: InvoiceTransaction[];
  futureTransactions: InvoiceTransaction[];
  adjustmentTotal: number;
  displayTotal: number;
  isClosed: boolean;
  hiddenAfterClosureCount: number;
};

type DisplayInvoice = Invoice & {
  displayDetails: InvoiceDisplayDetails;
  displayTotal: number;
  presentation: {
    title: string;
    subtitle: string;
    dueDateLabel: string;
    statusLabel: string;
    statusClass: string;
    isClosed: boolean;
    isPaid: boolean;
  };
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseLocalDate(value?: string | null) {
  if (!value) return null;

  const onlyDate = value.slice(0, 10);
  const [year, month, day] = onlyDate.split("-").map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function formatDateBR(value?: string | null) {
  const date = parseLocalDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("pt-BR");
}

function getMonthName(month: number) {
  return new Date(2026, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
  });
}

function getInvoiceLabel(month: number, year: number) {
  return `${getMonthName(month)} de ${year}`;
}

function getDueMonthLabel(invoice: Invoice) {
  const dueDate = parseLocalDate(invoice.dueDate);

  if (!dueDate) {
    return getInvoiceLabel(invoice.month, invoice.year);
  }

  const month = dueDate.toLocaleDateString("pt-BR", { month: "long" });
  const year = dueDate.getFullYear();

  return `${month} de ${year}`;
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
  return getCategoryLabel(transaction.category);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isAfterInvoiceClosure(
  transaction: InvoiceTransaction,
  closedAt?: string | null,
) {
  if (!closedAt) return false;

  const transactionDate = parseLocalDate(transaction.date);
  const closureDate = parseLocalDate(closedAt);

  if (!transactionDate || !closureDate) return false;

  return (
    startOfDay(transactionDate).getTime() > startOfDay(closureDate).getTime()
  );
}

function getInvoiceDisplayDetails(invoice: Invoice): InvoiceDisplayDetails {
  const allTransactions = invoice.transactions || [];
  const isClosed = invoice.status === "OPEN" && Boolean(invoice.closedAt);

  const futureTransactions = isClosed
    ? allTransactions.filter(
        (transaction) =>
          !transaction.isAdjustment &&
          isAfterInvoiceClosure(transaction, invoice.closedAt),
      )
    : [];

  const currentInvoiceTransactions = isClosed
    ? allTransactions.filter(
        (transaction) => !isAfterInvoiceClosure(transaction, invoice.closedAt),
      )
    : allTransactions;

  const transactions = currentInvoiceTransactions.filter(
    (transaction) => !transaction.isAdjustment,
  );

  const adjustmentTotal = currentInvoiceTransactions
    .filter((transaction) => transaction.isAdjustment)
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

  const calculatedTotal = currentInvoiceTransactions.reduce(
    (sum, transaction) => sum + Number(transaction.amount || 0),
    0,
  );

  const displayTotal =
    currentInvoiceTransactions.length > 0
      ? calculatedTotal
      : Number(invoice.total || 0);

  return {
    transactions,
    futureTransactions,
    adjustmentTotal,
    displayTotal,
    isClosed,
    hiddenAfterClosureCount: futureTransactions.length,
  };
}

function getInvoicePresentation(
  invoice: Invoice,
  details: InvoiceDisplayDetails,
) {
  const isPaid = invoice.status === "PAID";
  const isClosed = details.isClosed;
  const dueDateLabel = invoice.dueDate
    ? formatDateBR(invoice.dueDate)
    : "vencimento não informado";

  if (isPaid) {
    return {
      title: `Fatura ${getDueMonthLabel(invoice)}`,
      subtitle: `Paga em ${formatDateBR(invoice.paidAt)}`,
      dueDateLabel,
      statusLabel: "Paga",
      statusClass: "bg-emerald-100 text-emerald-700",
      isClosed,
      isPaid,
    };
  }

  if (isClosed) {
    return {
      title: `Fatura ${getDueMonthLabel(invoice)}`,
      subtitle: `Fechada em ${formatDateBR(invoice.closedAt)} · Vence em ${dueDateLabel}`,
      dueDateLabel,
      statusLabel: "Fechada",
      statusClass: "bg-slate-950 text-white",
      isClosed,
      isPaid,
    };
  }

  return {
    title: `Fatura ${getDueMonthLabel(invoice)}`,
    subtitle: `Aberta · Vence em ${dueDateLabel}`,
    dueDateLabel,
    statusLabel: "Aberta",
    statusClass: "bg-amber-100 text-amber-700",
    isClosed,
    isPaid,
  };
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState<
    Record<string, string>
  >({});
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<
    Record<string, boolean>
  >({});

  function toggleInvoiceExpanded(invoiceId: string) {
    setExpandedInvoiceIds((current) => ({
      ...current,
      [invoiceId]: !current[invoiceId],
    }));
  }

  async function loadData() {
    try {
      setLoading(true);

      const [invoicesResponse, accountsResponse, cardsResponse] =
        await Promise.all([
          fetch("/api/invoices", { cache: "no-store" }),
          fetch("/api/accounts", { cache: "no-store" }),
          fetch("/api/cards", { cache: "no-store" }),
        ]);

      if (!invoicesResponse.ok) {
        throw new Error("Erro ao buscar faturas");
      }

      const invoicesData = await invoicesResponse.json();
      const accountsData = accountsResponse.ok
        ? await accountsResponse.json()
        : [];
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
          : "Não foi possível pagar a fatura.",
      );
    } finally {
      setPayingInvoiceId(null);
    }
  }

  const displayInvoices = useMemo<DisplayInvoice[]>(() => {
    return invoices.map((invoice) => {
      const details = getInvoiceDisplayDetails(invoice);

      return {
        ...invoice,
        displayDetails: details,
        displayTotal: details.displayTotal,
        presentation: getInvoicePresentation(invoice, details),
      };
    });
  }, [invoices]);

  const openInvoices = useMemo(() => {
    return displayInvoices.filter((invoice) => invoice.status === "OPEN");
  }, [displayInvoices]);

  const openInvoicesTotal = useMemo(() => {
    return openInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.displayTotal || 0),
      0,
    );
  }, [openInvoices]);

  const totalCardLimit = useMemo(() => {
    return cards.reduce((sum, card) => sum + Number(card.limit || 0), 0);
  }, [cards]);

  const totalUsedLimit = useMemo(() => {
    return openInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.displayTotal || 0),
      0,
    );
  }, [openInvoices]);

  const totalAvailableLimit = useMemo(() => {
    return Math.max(totalCardLimit - totalUsedLimit, 0);
  }, [totalCardLimit, totalUsedLimit]);

  const invoicesOrdered = useMemo(() => {
    return [...displayInvoices].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "OPEN" ? -1 : 1;
      }

      const aDue =
        parseLocalDate(a.dueDate)?.getTime() ??
        new Date(a.year, a.month - 1, 1).getTime();
      const bDue =
        parseLocalDate(b.dueDate)?.getTime() ??
        new Date(b.year, b.month - 1, 1).getTime();
      return aDue - bDue;
    });
  }, [displayInvoices]);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 md:px-8 md:py-8">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <header className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Cartão de crédito
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                Faturas
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Visualize cada fatura como ela será paga no vencimento.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center md:min-w-[360px]">
              <Link
                href="/"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Home
              </Link>
              <Link
                href="/transactions"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Transações
              </Link>
              <Link
                href="/accounts"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cartões
              </Link>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Em aberto
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 md:text-base">
                {formatCurrency(openInvoicesTotal)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Limite usado
              </p>
              <p className="mt-1 text-sm font-semibold text-rose-600 md:text-base">
                {formatCurrency(totalUsedLimit)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Disponível
              </p>
              <p className="mt-1 text-sm font-bold text-emerald-600 md:text-base">
                {formatCurrency(totalAvailableLimit)}
              </p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
            Carregando faturas...
          </div>
        ) : invoicesOrdered.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Nenhuma fatura encontrada.
          </div>
        ) : (
          <section className="space-y-4">
            {invoicesOrdered.map((invoice) => {
              const details = invoice.displayDetails;
              const presentation = invoice.presentation;
              const cardName =
                invoice.card?.name ||
                cards.find((card) => card.id === invoice.cardId)?.name ||
                "Cartão";
              const displayItemCount =
                details.transactions.length +
                (details.adjustmentTotal > 0 ? 1 : 0);
              const isExpanded = Boolean(expandedInvoiceIds[invoice.id]);

              return (
                <article
                  key={invoice.id}
                  className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="p-4 md:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-bold text-slate-950">
                            {cardName}
                          </h2>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${presentation.statusClass}`}
                          >
                            {presentation.statusLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {presentation.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {presentation.subtitle}
                        </p>
                        {details.hiddenAfterClosureCount > 0 && (
                          <p className="mt-1 text-xs text-slate-400">
                            {details.hiddenAfterClosureCount} lançamento(s) após
                            o fechamento aparecem nas próximas faturas.
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Total
                        </p>
                        <p className="mt-1 text-2xl font-bold text-rose-600">
                          {formatCurrency(Number(invoice.displayTotal))}
                        </p>
                      </div>
                    </div>
                  </div>

                  {invoice.status === "OPEN" && (
                    <div className="border-y border-slate-100 bg-slate-50/80 p-4 md:p-5">
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                        Pagar com a conta
                      </label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                        <select
                          value={selectedAccounts[invoice.id] || ""}
                          onChange={(e) =>
                            handleAccountChange(invoice.id, e.target.value)
                          }
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                        >
                          <option value="">Selecione uma conta</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name} —{" "}
                              {formatCurrency(Number(account.balance))}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handlePayInvoice(invoice.id)}
                          disabled={payingInvoiceId === invoice.id}
                          className="h-12 rounded-2xl bg-sky-700 px-5 text-sm font-bold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {payingInvoiceId === invoice.id
                            ? "Pagando..."
                            : "Pagar"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="p-4 md:p-5">
                    {presentation.isClosed ? (
                      <>
                        <div className="mb-3 flex items-center gap-3">
                          <h3 className="shrink-0 text-sm font-semibold text-slate-800">
                            Próximos lançamentos
                          </h3>
                          <div className="h-px flex-1 bg-slate-200" />
                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            {details.futureTransactions.length} item(ns)
                          </span>
                        </div>

                        {details.futureTransactions.length > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleInvoiceExpanded(invoice.id)}
                              className="mb-3 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
                            >
                              <span>
                                <span className="block text-sm font-semibold text-slate-900">
                                  {isExpanded
                                    ? "Ocultar próximos lançamentos"
                                    : "Ver próximos lançamentos"}
                                </span>
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  Compras feitas depois do fechamento desta
                                  fatura.
                                </span>
                              </span>
                              <span className="ml-3 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                                {isExpanded ? "−" : "+"}
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="space-y-2">
                                {details.futureTransactions.map(
                                  (transaction) => (
                                    <div
                                      key={transaction.id}
                                      className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-semibold text-slate-900">
                                            {transaction.title}
                                          </p>
                                          <p className="mt-0.5 text-xs text-amber-800">
                                            {getInvoiceTransactionCategoryLabel(
                                              transaction,
                                            )}{" "}
                                            · {formatDateBR(transaction.date)}
                                          </p>
                                        </div>
                                        <p className="shrink-0 text-sm font-semibold text-rose-600">
                                          {formatCurrency(
                                            Number(transaction.amount),
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">
                            Nenhum lançamento novo depois do fechamento.
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="mb-3 flex items-center gap-3">
                          <h3 className="shrink-0 text-sm font-semibold text-slate-800">
                            Lançamentos
                          </h3>
                          <div className="h-px flex-1 bg-slate-200" />
                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            {displayItemCount} item(ns)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleInvoiceExpanded(invoice.id)}
                          className="mb-3 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
                        >
                          <span>
                            <span className="block text-sm font-semibold text-slate-900">
                              {isExpanded
                                ? "Ocultar lançamentos"
                                : "Ver lançamentos da fatura"}
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {displayItemCount > 0
                                ? `${displayItemCount} item(ns) nesta fatura`
                                : "Nenhum lançamento nesta fatura"}
                            </span>
                          </span>
                          <span className="ml-3 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                            {isExpanded ? "−" : "+"}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="space-y-2">
                            {details.adjustmentTotal > 0 && (
                              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900">
                                      Saldo anterior / ajuste inicial
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      Valor considerado no total desta fatura.
                                    </p>
                                  </div>
                                  <p className="shrink-0 text-sm font-semibold text-slate-900">
                                    {formatCurrency(details.adjustmentTotal)}
                                  </p>
                                </div>
                              </div>
                            )}

                            {details.transactions.map((transaction) => (
                              <div
                                key={transaction.id}
                                className="rounded-xl border border-slate-100 px-3 py-2.5"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900">
                                      {transaction.title}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                      {getInvoiceTransactionCategoryLabel(
                                        transaction,
                                      )}{" "}
                                      · {formatDateBR(transaction.date)}
                                    </p>
                                  </div>
                                  <p className="shrink-0 text-sm font-semibold text-rose-600">
                                    {formatCurrency(Number(transaction.amount))}
                                  </p>
                                </div>
                              </div>
                            ))}

                            {details.transactions.length === 0 &&
                              details.adjustmentTotal === 0 && (
                                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">
                                  Nenhum lançamento nesta fatura.
                                </div>
                              )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
