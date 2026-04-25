"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";

type Account = {
  id: string;
  name: string;
  balance: number;
};

type Card = {
  id: string;
  name: string;
  limit?: number | null;
  monthlyLimit?: number | null;
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

type FutureTransactionGroup = {
  id: string;
  title: string;
  category?: string | null;
  firstDate: string;
  totalAmount: number;
  installmentAmount: number;
  installmentCount: number;
  isInstallment: boolean;
  transactions: InvoiceTransaction[];
};


type FutureInvoiceProjectionItem = {
  id: string;
  cardId: string;
  cardName: string;
  month: number;
  year: number;
  label: string;
  total: number;
  transactionCount: number;
  groups: FutureTransactionGroup[];
};

type InvoiceDisplayDetails = {
  transactions: InvoiceTransaction[];
  futureTransactions: InvoiceTransaction[];
  futureTransactionGroups: FutureTransactionGroup[];
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

function isCreditCardExpenseTransaction(transaction: InvoiceTransaction) {
  const normalizedType = (transaction.type || "").toLowerCase();
  const normalizedPaymentMethod = (transaction.paymentMethod || "").toLowerCase();

  return (
    normalizedPaymentMethod === "credit_card" &&
    (normalizedType === "expense" || normalizedType === "saida" || normalizedType === "saída")
  );
}

function removeDuplicatedTransactions(transactions: InvoiceTransaction[]) {
  const seen = new Set<string>();

  return transactions.filter((transaction) => {
    if (seen.has(transaction.id)) return false;
    seen.add(transaction.id);
    return true;
  });
}

function getInstallmentInfoFromTitle(title?: string | null) {
  if (!title) return null;

  const match = title.trim().match(/\((\d+)\s*\/\s*(\d+)\)$/);
  if (!match) return null;

  const current = Number(match[1]);
  const total = Number(match[2]);

  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 1) {
    return null;
  }

  return { current, total };
}

function getBaseInstallmentTitle(title?: string | null) {
  if (!title) return "";
  return title.replace(/\s*\(\d+\s*\/\s*\d+\)$/, "").trim();
}

function getFutureTransactionGroups(transactions: InvoiceTransaction[]) {
  const grouped = new Map<string, FutureTransactionGroup>();

  transactions.forEach((transaction) => {
    const installmentInfo = getInstallmentInfoFromTitle(transaction.title);
    const baseTitle = installmentInfo
      ? getBaseInstallmentTitle(transaction.title)
      : transaction.title;
    const roundedAmount = Number(transaction.amount || 0).toFixed(2);
    const groupKey = installmentInfo
      ? [
          transaction.cardId || "sem-cartao",
          baseTitle.toLowerCase(),
          transaction.category || "sem-categoria",
          roundedAmount,
          installmentInfo.total,
        ].join("|")
      : transaction.id;

    const existing = grouped.get(groupKey);

    if (!existing) {
      grouped.set(groupKey, {
        id: groupKey,
        title: baseTitle,
        category: transaction.category,
        firstDate: transaction.date,
        totalAmount: Number(transaction.amount || 0),
        installmentAmount: Number(transaction.amount || 0),
        installmentCount: 1,
        isInstallment: Boolean(installmentInfo),
        transactions: [transaction],
      });
      return;
    }

    const transactionDate = parseLocalDate(transaction.date)?.getTime() || 0;
    const currentFirstDate = parseLocalDate(existing.firstDate)?.getTime() || 0;

    grouped.set(groupKey, {
      ...existing,
      firstDate:
        transactionDate > 0 && (currentFirstDate === 0 || transactionDate < currentFirstDate)
          ? transaction.date
          : existing.firstDate,
      totalAmount: existing.totalAmount + Number(transaction.amount || 0),
      installmentCount: existing.installmentCount + 1,
      transactions: [...existing.transactions, transaction],
    });
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const aDate = parseLocalDate(a.firstDate)?.getTime() || 0;
    const bDate = parseLocalDate(b.firstDate)?.getTime() || 0;

    if (aDate !== bDate) return aDate - bDate;
    return a.title.localeCompare(b.title, "pt-BR");
  });
}


function addMonthsToReference(month: number, year: number, amount: number) {
  const date = new Date(year, month - 1 + amount, 1);

  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

function getMonthDifference(from: Date, to: Date) {
  return (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
}

function getProjectionAnchorInvoice(cardId: string, invoices: Invoice[]) {
  return invoices
    .filter((invoice) => invoice.cardId === cardId && Boolean(invoice.closedAt))
    .sort((a, b) => {
      const aClosed = parseLocalDate(a.closedAt)?.getTime() || 0;
      const bClosed = parseLocalDate(b.closedAt)?.getTime() || 0;
      return bClosed - aClosed;
    })[0];
}

function getProjectedInvoiceReference(transaction: InvoiceTransaction, anchorInvoice: Invoice) {
  const transactionDate = parseLocalDate(transaction.date);
  const closureDate = parseLocalDate(anchorInvoice.closedAt);
  const dueDate = parseLocalDate(anchorInvoice.dueDate);

  if (!transactionDate || !closureDate) return null;

  const normalizedTransactionDate = startOfDay(transactionDate);
  const normalizedClosureDate = startOfDay(closureDate);

  if (normalizedTransactionDate.getTime() <= normalizedClosureDate.getTime()) {
    return null;
  }

  const monthDifference = Math.max(getMonthDifference(closureDate, transactionDate), 0);
  const crossedNextClosureDay = transactionDate.getDate() > closureDate.getDate() ? 1 : 0;
  const monthsAfterClosedInvoice = Math.max(monthDifference + crossedNextClosureDay, 1);

  const baseReference = dueDate
    ? { month: dueDate.getMonth() + 1, year: dueDate.getFullYear() }
    : { month: anchorInvoice.month, year: anchorInvoice.year };

  return addMonthsToReference(
    baseReference.month,
    baseReference.year,
    monthsAfterClosedInvoice,
  );
}

function getFutureInvoicesProjection(params: {
  transactions: InvoiceTransaction[];
  invoices: Invoice[];
  cards: Card[];
}) {
  const { transactions, invoices, cards } = params;
  const grouped = new Map<string, FutureInvoiceProjectionItem>();
  const uniqueTransactions = removeDuplicatedTransactions(transactions);

  uniqueTransactions.forEach((transaction) => {
    if (!transaction.cardId) return;
    if (transaction.isAdjustment) return;
    if (!isCreditCardExpenseTransaction(transaction)) return;

    const anchorInvoice = getProjectionAnchorInvoice(transaction.cardId, invoices);
    if (!anchorInvoice) return;

    const projectedReference = getProjectedInvoiceReference(transaction, anchorInvoice);
    if (!projectedReference) return;

    const cardName =
      anchorInvoice.card?.name ||
      cards.find((card) => card.id === transaction.cardId)?.name ||
      "Cartão";

    const key = `${transaction.cardId}-${projectedReference.year}-${projectedReference.month}`;
    const existing = grouped.get(key);
    const nextTransactions = existing
      ? [...existing.groups.flatMap((group) => group.transactions), transaction]
      : [transaction];
    const nextGroups = getFutureTransactionGroups(nextTransactions);
    const nextTotal = nextGroups.reduce((sum, group) => sum + Number(group.totalAmount || 0), 0);
    const nextTransactionCount = nextGroups.reduce(
      (sum, group) => sum + Number(group.transactions.length || 0),
      0,
    );

    grouped.set(key, {
      id: key,
      cardId: transaction.cardId,
      cardName,
      month: projectedReference.month,
      year: projectedReference.year,
      label: getInvoiceLabel(projectedReference.month, projectedReference.year),
      total: nextTotal,
      transactionCount: nextTransactionCount,
      groups: nextGroups,
    });
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const aDate = new Date(a.year, a.month - 1, 1).getTime();
    const bDate = new Date(b.year, b.month - 1, 1).getTime();

    if (aDate !== bDate) return aDate - bDate;
    return a.cardName.localeCompare(b.cardName, "pt-BR");
  });
}

function getInvoiceDisplayDetails(
  invoice: Invoice,
  allCreditTransactions: InvoiceTransaction[] = [],
): InvoiceDisplayDetails {
  const invoiceTransactions = invoice.transactions || [];
  const isClosed = invoice.status === "OPEN" && Boolean(invoice.closedAt);

  const currentInvoiceTransactions = isClosed
    ? invoiceTransactions.filter(
        (transaction) => !isAfterInvoiceClosure(transaction, invoice.closedAt),
      )
    : invoiceTransactions;

  const futureTransactions = isClosed
    ? removeDuplicatedTransactions(
        [...invoiceTransactions, ...allCreditTransactions]
          .filter((transaction) => {
            if (transaction.cardId !== invoice.cardId) return false;
            if (transaction.isAdjustment) return false;
            if (!isCreditCardExpenseTransaction(transaction)) return false;
            return isAfterInvoiceClosure(transaction, invoice.closedAt);
          })
          .sort((a, b) => {
            const aDate = parseLocalDate(a.date)?.getTime() || 0;
            const bDate = parseLocalDate(b.date)?.getTime() || 0;
            return aDate - bDate;
          }),
      )
    : [];

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

  const futureTransactionGroups = getFutureTransactionGroups(futureTransactions);

  return {
    transactions,
    futureTransactions,
    futureTransactionGroups,
    adjustmentTotal,
    displayTotal,
    isClosed,
    hiddenAfterClosureCount: futureTransactionGroups.length,
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
  const [transactions, setTransactions] = useState<InvoiceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState<
    Record<string, string>
  >({});
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedFutureProjectionIds, setExpandedFutureProjectionIds] = useState<
    Record<string, boolean>
  >({});

  function toggleFutureProjectionExpanded(projectionId: string) {
    setExpandedFutureProjectionIds((current) => ({
      ...current,
      [projectionId]: !current[projectionId],
    }));
  }

  function toggleInvoiceExpanded(invoiceId: string) {
    setExpandedInvoiceIds((current) => ({
      ...current,
      [invoiceId]: !current[invoiceId],
    }));
  }

  async function loadData() {
    try {
      setLoading(true);

      const [
        invoicesResponse,
        accountsResponse,
        cardsResponse,
        transactionsResponse,
      ] = await Promise.all([
        fetch("/api/invoices", { cache: "no-store" }),
        fetch("/api/accounts", { cache: "no-store" }),
        fetch("/api/cards", { cache: "no-store" }),
        fetch("/api/transactions", { cache: "no-store" }),
      ]);

      if (!invoicesResponse.ok) {
        throw new Error("Erro ao buscar faturas");
      }

      const invoicesData = await invoicesResponse.json();
      const accountsData = accountsResponse.ok
        ? await accountsResponse.json()
        : [];
      const cardsData = cardsResponse.ok ? await cardsResponse.json() : [];
      const transactionsData = transactionsResponse.ok
        ? await transactionsResponse.json()
        : [];

      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setCards(Array.isArray(cardsData) ? cardsData : []);
      setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
    } catch (error) {
      console.error("Erro ao carregar faturas:", error);
      setInvoices([]);
      setAccounts([]);
      setCards([]);
      setTransactions([]);
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
      const details = getInvoiceDisplayDetails(invoice, transactions);

      return {
        ...invoice,
        displayDetails: details,
        displayTotal: details.displayTotal,
        presentation: getInvoicePresentation(invoice, details),
      };
    });
  }, [invoices, transactions]);

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
    return cards.reduce((sum, card) => {
      const consciousLimit = Number(card.monthlyLimit || 0);
      const bankLimit = Number(card.limit || 0);

      return sum + (consciousLimit > 0 ? consciousLimit : bankLimit);
    }, 0);
  }, [cards]);

  const totalUsedLimit = useMemo(() => {
    return openInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.displayTotal || 0),
      0,
    );
  }, [openInvoices]);

  const totalAvailableLimit = useMemo(() => {
    return totalCardLimit - totalUsedLimit;
  }, [totalCardLimit, totalUsedLimit]);

  const futureInvoicesProjection = useMemo(() => {
    return getFutureInvoicesProjection({
      transactions,
      invoices,
      cards,
    });
  }, [transactions, invoices, cards]);

  const futureInvoicesTotal = useMemo(() => {
    return futureInvoicesProjection.reduce(
      (sum, item) => sum + Number(item.total || 0),
      0,
    );
  }, [futureInvoicesProjection]);

  const invoicesOrdered = useMemo(() => {
    function getInvoicePriority(invoice: DisplayInvoice) {
      if (invoice.presentation.isPaid) return 3;
      if (invoice.presentation.isClosed) return 1;
      return 2;
    }

    return [...displayInvoices].sort((a, b) => {
      const priorityA = getInvoicePriority(a);
      const priorityB = getInvoicePriority(b);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
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


  const futureInvoicesProjectionSection =
    futureInvoicesProjection.length > 0 ? (
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Planejamento do cartão
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">
                  Faturas futuras previstas
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Compras e parcelas que já estão comprometendo os próximos meses.
                </p>
              </div>

              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wide text-rose-500">
                  Total futuro
                </p>
                <p className="mt-1 text-lg font-bold text-rose-600">
                  {formatCurrency(futureInvoicesTotal)}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {futureInvoicesProjection.map((item) => {
                const isProjectionExpanded = Boolean(expandedFutureProjectionIds[item.id]);
                const visibleGroups = isProjectionExpanded ? item.groups : item.groups.slice(0, 3);
                const hiddenGroupsCount = Math.max(item.groups.length - visibleGroups.length, 0);

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          {item.label}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {item.cardName} · {item.groups.length} compra(s) · {item.transactionCount} lançamento(s)
                        </p>
                      </div>

                      <p className="shrink-0 text-base font-bold text-rose-600">
                        {formatCurrency(item.total)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFutureProjectionExpanded(item.id)}
                      className="mt-3 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:bg-slate-50"
                    >
                      <span>
                        <span className="block text-xs font-bold text-slate-800">
                          {isProjectionExpanded ? "Ocultar descrição" : "Ver descrição dos produtos"}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          {isProjectionExpanded
                            ? `${item.groups.length} compra(s) aberta(s)`
                            : hiddenGroupsCount > 0
                            ? `Mostrando 3 de ${item.groups.length} compra(s)`
                            : `${item.groups.length} compra(s) neste mês`}
                        </span>
                      </span>
                      <span className="ml-3 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {isProjectionExpanded ? "−" : "+"}
                      </span>
                    </button>

                    {isProjectionExpanded && (
                      <div className="mt-3 space-y-2">
                        {visibleGroups.map((group) => (
                          <div
                            key={group.id}
                            className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-slate-800">
                                {group.title}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {getCategoryLabel(group.category)} · {formatDateBR(group.firstDate)}
                                {group.isInstallment && group.installmentCount > 1
                                  ? ` · ${group.installmentCount}x de ${formatCurrency(group.installmentAmount)}`
                                  : ""}
                              </p>
                            </div>

                            <p className="shrink-0 text-xs font-bold text-rose-600">
                              {formatCurrency(group.totalAmount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
    ) : null;

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
                Disponível consciente
              </p>
              <p
                className={`mt-1 text-sm font-bold md:text-base ${
                  totalAvailableLimit >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
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
            {invoicesOrdered.map((invoice, invoiceIndex) => {
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
                <Fragment key={invoice.id}>
                <article
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
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                        Compras feitas após o fechamento já aparecem no planejamento das próximas faturas.
                      </div>
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
                {invoiceIndex === 0 && futureInvoicesProjectionSection}
                </Fragment>
              );
            })}
          </section>
        )}


      </div>
    </main>
  );
}
