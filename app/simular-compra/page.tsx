"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Card = {
  id: string;
  name: string;
  limit?: number | null;
  brand?: string | null;
};

type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: string;
  category?: string | null;
  paymentMethod?: string | null;
  accountId?: string | null;
  cardId?: string | null;
  invoiceId?: string | null;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  purchaseGroupId?: string | null;
  isAdjustment?: boolean | null;
  date: string;
};

type Invoice = {
  id: string;
  cardId: string;
  month: number;
  year: number;
  total: number;
  status: "OPEN" | "PAID";
  card?: {
    id: string;
    name: string;
    brand?: string | null;
    limit?: number | null;
  } | null;
};

type RecurringTransaction = {
  id: string;
  title: string;
  amount: number;
  type: string;
  paymentMethod?: string | null;
  accountId?: string | null;
  cardId?: string | null;
  dayOfMonth: number;
  active: boolean;
};

type RecommendationTone = "success" | "warning" | "danger";

type ToastState = {
  tone: RecommendationTone;
  message: string;
};

type SimulationHistoryItem = {
  id: string;
  title?: string | null;
  totalAmount?: number | null;
  installmentCount?: number | null;
  installmentAmount?: number | null;
  recommendedCardName?: string | null;
  recommendationStatus?: RecommendationTone | string | null;
  recommendationTitle?: string | null;
  recommendationReason?: string | null;
  lowestProjectedMonthLabel?: string | null;
  lowestProjectedBalance?: number | null;
  limitUsagePercent?: number | null;
  remainingLimitAfterPurchase?: number | null;
  selectedMonth?: string | null;
  createdAt?: string;
};

type ComparisonResult = {
  card: Card;
  lowestProjectedBalance: number;
  lowestProjectedMonthLabel: string;
  firstCriticalMonthLabel: string | null;
  limitUsagePercentage: number | null;
  remainingLimit: number | null;
  status: "best" | "attention" | "risk";
};

type RecommendationSummary = {
  tone: RecommendationTone;
  title: string;
  reason: string;
  reasonList: string[];
  actionLabel: string;
  installmentValue: number;
  cardName: string;
  duplicateKey: string;
};

function formatCurrency(value?: number | null) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getMonthInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonthInput(value: string) {
  const [year, month] = value.split("-").map(Number);
  return { year, month };
}

function normalizeComparableText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function isIncomeType(type?: string | null) {
  if (!type) return false;
  const normalized = type.toLowerCase();
  return normalized === "income" || normalized === "entrada";
}

function isExpenseType(type?: string | null) {
  if (!type) return false;
  const normalized = type.toLowerCase();
  return normalized === "expense" || normalized === "saida" || normalized === "saída";
}

function isAdjustmentTransaction(transaction?: Transaction | null) {
  if (!transaction) return false;
  if (transaction.isAdjustment) return true;

  const normalizedTitle = normalizeComparableText(transaction.title);
  return (
    normalizedTitle === "saldo anterior" ||
    normalizedTitle === "saldo inicial da fatura" ||
    normalizedTitle === "ajuste inicial do cartao" ||
    normalizedTitle === "ajuste inicial do cartão"
  );
}

function sortHistoryItems(items: SimulationHistoryItem[]) {
  return [...items].sort((a, b) => {
    const aDate = new Date(a.createdAt || 0).getTime();
    const bDate = new Date(b.createdAt || 0).getTime();
    return bDate - aDate;
  });
}

function formatHistoryDate(value?: string) {
  if (!value) return "Data não informada";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getToastStyles(tone: RecommendationTone) {
  if (tone === "danger") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function getRecommendationBoxStyles(tone: RecommendationTone) {
  if (tone === "danger") {
    return "border-rose-200 bg-rose-50";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50";
  }

  return "border-emerald-200 bg-emerald-50";
}

export default function SimularCompraPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [recurrings, setRecurrings] = useState<RecurringTransaction[]>([]);
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getMonthInputValue(new Date()));
  const [purchaseTitle, setPurchaseTitle] = useState("");
  const [totalAmountInput, setTotalAmountInput] = useState("");
  const [installmentCountInput, setInstallmentCountInput] = useState("3");
  const [preferredCardId, setPreferredCardId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        const [
          cardsResponse,
          transactionsResponse,
          invoicesResponse,
          recurringsResponse,
          historyResponse,
        ] = await Promise.all([
          fetch("/api/cards", { cache: "no-store" }),
          fetch("/api/transactions", { cache: "no-store" }),
          fetch("/api/invoices", { cache: "no-store" }),
          fetch("/api/recurring", { cache: "no-store" }),
          fetch("/api/simulation-history", { cache: "no-store" }),
        ]);

        const [
          cardsData,
          transactionsData,
          invoicesData,
          recurringsData,
          historyData,
        ] = await Promise.all([
          cardsResponse.json(),
          transactionsResponse.json(),
          invoicesResponse.json(),
          recurringsResponse.json(),
          historyResponse.json(),
        ]);

        setCards(Array.isArray(cardsData) ? cardsData : []);
        setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
        setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
        setRecurrings(Array.isArray(recurringsData) ? recurringsData : []);
        setHistory(sortHistoryItems(Array.isArray(historyData) ? historyData : []));
      } catch (error) {
        console.error(error);
        setToast({
          tone: "danger",
          message: "Não foi possível carregar os dados do simulador.",
        });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const parsedAmount = useMemo(() => {
    const normalized = totalAmountInput.replace(/\./g, "").replace(",", ".").trim();
    const value = Number(normalized);
    return Number.isFinite(value) ? value : 0;
  }, [totalAmountInput]);

  const parsedInstallments = useMemo(() => {
    const value = Number(installmentCountInput || 1);
    if (!Number.isFinite(value)) return 1;
    return Math.min(Math.max(Math.round(value), 1), 12);
  }, [installmentCountInput]);

  const currentAccountsBalance = useMemo(() => {
    const accountBalances = new Map<string, number>();

    transactions.forEach((transaction) => {
      if (!transaction.accountId || isAdjustmentTransaction(transaction)) return;

      const currentValue = accountBalances.get(transaction.accountId) || 0;
      let nextValue = currentValue;

      if (isIncomeType(transaction.type)) {
        nextValue += Number(transaction.amount || 0);
      } else if (
        isExpenseType(transaction.type) &&
        transaction.paymentMethod !== "credit_card" &&
        transaction.paymentMethod !== "voucher"
      ) {
        nextValue -= Number(transaction.amount || 0);
      }

      accountBalances.set(transaction.accountId, nextValue);
    });

    const initialAdjustments = transactions.filter((transaction) =>
      isAdjustmentTransaction(transaction)
    );
    const adjustmentTotal = initialAdjustments.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const invoiceOpenTotal = invoices
      .filter((invoice) => invoice.status === "OPEN")
      .reduce((sum, item) => sum + Number(item.total || 0), 0);

    return (
      Array.from(accountBalances.values()).reduce((sum, value) => sum + value, 0) -
      adjustmentTotal -
      invoiceOpenTotal
    );
  }, [invoices, transactions]);

  const futureInstallmentsByMonth = useMemo(() => {
    const { year, month } = parseMonthInput(selectedMonth);
    const baseDate = new Date(year, month - 1, 1);
    const grouped = new Map<string, number>();

    transactions
      .filter((transaction) => {
        const transactionDate = new Date(transaction.date);
        const isFuture = transactionDate.getTime() >= baseDate.getTime();
        const isInstallment = Number(transaction.installmentTotal || 0) > 1;

        return (
          isFuture &&
          isInstallment &&
          isExpenseType(transaction.type) &&
          !isAdjustmentTransaction(transaction)
        );
      })
      .forEach((transaction) => {
        const transactionDate = new Date(transaction.date);
        const key = `${transactionDate.getFullYear()}-${String(
          transactionDate.getMonth() + 1
        ).padStart(2, "0")}`;

        grouped.set(key, (grouped.get(key) || 0) + Number(transaction.amount || 0));
      });

    return grouped;
  }, [selectedMonth, transactions]);

  const monthlyRecurring = useMemo(() => {
    const activeRecurrings = recurrings.filter((item) => item.active);

    const income = activeRecurrings
      .filter((item) => isIncomeType(item.type))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const expense = activeRecurrings
      .filter((item) => isExpenseType(item.type))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return { income, expense };
  }, [recurrings]);

  const validationSummary = useMemo(() => {
    const messages: string[] = [];

    if (cards.length === 0) {
      messages.push("Cadastre pelo menos um cartão para usar o simulador.");
    }

    if (!totalAmountInput.trim()) {
      messages.push("Informe o valor total da compra.");
    } else if (parsedAmount <= 0) {
      messages.push("Digite um valor maior que zero.");
    }

    if (!Number.isFinite(parsedInstallments) || parsedInstallments < 1) {
      messages.push("Escolha uma quantidade de parcelas válida.");
    }

    if (preferredCardId && !cards.some((card) => card.id === preferredCardId)) {
      messages.push("O cartão escolhido não foi encontrado.");
    }

    return {
      isValid: messages.length === 0,
      messages,
    };
  }, [cards, parsedAmount, parsedInstallments, preferredCardId, totalAmountInput]);

  const comparisonResults = useMemo<ComparisonResult[]>(() => {
    if (!validationSummary.isValid || parsedAmount <= 0 || cards.length === 0) return [];

    const { year, month } = parseMonthInput(selectedMonth);

    return cards
      .map((card) => {
        const installmentValue = parsedAmount / parsedInstallments;
        let runningBalance = currentAccountsBalance;
        let lowestProjectedBalance = Number.POSITIVE_INFINITY;
        let lowestProjectedMonthLabel = "";
        let firstCriticalMonthLabel: string | null = null;

        for (let index = 0; index < parsedInstallments; index += 1) {
          const date = new Date(year, month - 1 + index, 1);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          const label = date.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          });

          const existingInstallmentImpact = futureInstallmentsByMonth.get(key) || 0;

          runningBalance =
            runningBalance +
            monthlyRecurring.income -
            monthlyRecurring.expense -
            existingInstallmentImpact -
            installmentValue;

          if (runningBalance < lowestProjectedBalance) {
            lowestProjectedBalance = runningBalance;
            lowestProjectedMonthLabel = label;
          }

          if (runningBalance < 0 && !firstCriticalMonthLabel) {
            firstCriticalMonthLabel = label;
          }
        }

        const limitValue = Number(card.limit || 0);
        const limitUsagePercentage =
          limitValue > 0 ? (parsedAmount / limitValue) * 100 : null;
        const remainingLimit = limitValue > 0 ? limitValue - parsedAmount : null;

        let status: "best" | "attention" | "risk" = "best";

        if (
          firstCriticalMonthLabel ||
          (limitUsagePercentage !== null && limitUsagePercentage > 100)
        ) {
          status = "risk";
        } else if (
          lowestProjectedBalance < 2000 ||
          (limitUsagePercentage !== null && limitUsagePercentage >= 80)
        ) {
          status = "attention";
        }

        return {
          card,
          lowestProjectedBalance,
          lowestProjectedMonthLabel,
          firstCriticalMonthLabel,
          limitUsagePercentage,
          remainingLimit,
          status,
        };
      })
      .sort((a, b) => {
        const weight = { best: 0, attention: 1, risk: 2 };
        if (weight[a.status] !== weight[b.status]) {
          return weight[a.status] - weight[b.status];
        }

        return b.lowestProjectedBalance - a.lowestProjectedBalance;
      });
  }, [
    cards,
    currentAccountsBalance,
    futureInstallmentsByMonth,
    monthlyRecurring.expense,
    monthlyRecurring.income,
    parsedAmount,
    parsedInstallments,
    selectedMonth,
    validationSummary.isValid,
  ]);

  const bestOption = useMemo(() => {
    if (comparisonResults.length === 0) return null;

    if (preferredCardId) {
      return (
        comparisonResults.find((item) => item.card.id === preferredCardId) ||
        comparisonResults[0]
      );
    }

    return comparisonResults[0];
  }, [comparisonResults, preferredCardId]);

  const recommendation = useMemo<RecommendationSummary | null>(() => {
    if (!bestOption || parsedAmount <= 0) return null;

    const installmentValue = parsedAmount / parsedInstallments;
    const duplicateKey = [
      normalizeComparableText(purchaseTitle || `Compra simulada • ${parsedInstallments}x`),
      parsedAmount.toFixed(2),
      String(parsedInstallments),
      bestOption.card.name,
      selectedMonth,
    ].join("|");

    const reasonList: string[] = [
      `A parcela fica em ${formatCurrency(installmentValue)}.`,
      `O melhor cartão para este cenário é ${bestOption.card.name}.`,
      `O mês mais apertado será ${bestOption.lowestProjectedMonthLabel}, com projeção de ${formatCurrency(
        bestOption.lowestProjectedBalance
      )}.`,
    ];

    if (bestOption.limitUsagePercentage !== null) {
      reasonList.push(
        `O uso estimado do limite fica em ${bestOption.limitUsagePercentage.toFixed(1)}%.`
      );
    }

    if (bestOption.remainingLimit !== null) {
      reasonList.push(
        `Depois da compra, ainda restariam ${formatCurrency(bestOption.remainingLimit)} de limite.`
      );
    }

    if (bestOption.status === "risk") {
      return {
        tone: "danger",
        title: "Compra não recomendada",
        reason: bestOption.firstCriticalMonthLabel
          ? `Essa compra pode deixar sua projeção negativa em ${bestOption.firstCriticalMonthLabel}.`
          : "Essa compra ultrapassa o limite informado do cartão.",
        reasonList,
        actionLabel: "Segure essa compra ou reduza valor/parcelas antes de decidir.",
        installmentValue,
        cardName: bestOption.card.name,
        duplicateKey,
      };
    }

    if (bestOption.status === "attention") {
      return {
        tone: "warning",
        title: "Compra possível com atenção",
        reason: `O melhor cenário continua sendo ${bestOption.card.name}, mas com folga menor do que o ideal.`,
        reasonList,
        actionLabel: "Se for seguir, acompanhe esse cartão e evite novas parcelas agora.",
        installmentValue,
        cardName: bestOption.card.name,
        duplicateKey,
      };
    }

    return {
      tone: "success",
      title: "Compra recomendada",
      reason: `A melhor escolha agora é ${bestOption.card.name}, com o menor impacto futuro entre os cartões cadastrados.`,
      reasonList,
      actionLabel: "Você pode seguir com essa compra mantendo a disciplina nas próximas semanas.",
      installmentValue,
      cardName: bestOption.card.name,
      duplicateKey,
    };
  }, [bestOption, parsedAmount, parsedInstallments, purchaseTitle, selectedMonth]);

  const historySorted = useMemo(() => sortHistoryItems(history), [history]);

  const hasDuplicateSimulation = useMemo(() => {
    if (!recommendation) return false;

    return historySorted.some((item) => {
      const itemKey = [
        normalizeComparableText(item.title || ""),
        Number(item.totalAmount || 0).toFixed(2),
        String(item.installmentCount || 1),
        item.recommendedCardName || "",
        item.selectedMonth || "",
      ].join("|");

      return itemKey === recommendation.duplicateKey;
    });
  }, [historySorted, recommendation]);

  async function handleSaveSimulation() {
    if (!validationSummary.isValid) {
      setToast({
        tone: "danger",
        message: validationSummary.messages[0] || "Revise os dados da compra antes de salvar.",
      });
      return;
    }

    if (!bestOption || !recommendation || parsedAmount <= 0) {
      setToast({
        tone: "danger",
        message: "Preencha a compra e gere uma recomendação válida primeiro.",
      });
      return;
    }

    if (hasDuplicateSimulation) {
      setToast({
        tone: "warning",
        message: "Essa simulação já está no histórico. Ajuste o valor, parcelas ou cartão antes de salvar de novo.",
      });
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/simulation-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: purchaseTitle.trim() || `Compra simulada • ${parsedInstallments}x`,
          purchaseType: parsedInstallments > 1 ? "installment" : "cash",
          totalAmount: parsedAmount,
          installmentCount: parsedInstallments,
          installmentAmount: recommendation.installmentValue,
          recommendedCardName: bestOption.card.name,
          recommendationStatus: recommendation.tone,
          recommendationTitle: recommendation.title,
          recommendationReason: recommendation.reason,
          lowestProjectedMonthLabel: bestOption.lowestProjectedMonthLabel,
          lowestProjectedBalance: bestOption.lowestProjectedBalance,
          limitUsagePercent: bestOption.limitUsagePercentage,
          remainingLimitAfterPurchase: bestOption.remainingLimit,
          selectedMonth,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível salvar a simulação.");
      }

      setHistory((prev) => sortHistoryItems([data, ...prev]));
      setToast({
        tone: "success",
        message: "Simulação salva com sucesso. Ela já apareceu no histórico abaixo.",
      });
    } catch (error) {
      console.error(error);
      setToast({
        tone: "danger",
        message:
          error instanceof Error ? error.message : "Não foi possível salvar a simulação.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteHistoryItem(id: string) {
    const confirmed = window.confirm("Deseja excluir esta simulação?");
    if (!confirmed) return;

    try {
      setDeletingHistoryId(id);

      const response = await fetch(`/api/simulation-history/${id}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível excluir a simulação.");
      }

      setHistory((prev) => prev.filter((item) => item.id !== id));
      setToast({
        tone: "success",
        message: "Simulação excluída com sucesso.",
      });
    } catch (error) {
      console.error(error);
      setToast({
        tone: "danger",
        message:
          error instanceof Error ? error.message : "Não foi possível excluir a simulação.",
      });
    } finally {
      setDeletingHistoryId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-500">Carregando simulador...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Simulação profissional
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Simular compra
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Compare cartões, impacto nas próximas parcelas e o risco real antes de transformar a compra em decisão.
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/intelligence"
                className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Voltar
              </Link>
            </div>
          </div>
        </section>

        {toast ? (
          <section className={`rounded-3xl border px-4 py-4 text-sm font-medium shadow-sm ${getToastStyles(toast.tone)}`}>
            {toast.message}
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Dados da compra</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Nome da compra</span>
                <input
                  value={purchaseTitle}
                  onChange={(e) => setPurchaseTitle(e.target.value)}
                  placeholder="Ex: iPhone, viagem, notebook"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Mês de referência</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Valor total</span>
                <input
                  value={totalAmountInput}
                  onChange={(e) => setTotalAmountInput(e.target.value)}
                  placeholder="Ex: 2500"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Parcelas</span>
                <select
                  value={installmentCountInput}
                  onChange={(e) => setInstallmentCountInput(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                >
                  {Array.from({ length: 12 }).map((_, index) => {
                    const value = String(index + 1);
                    return (
                      <option key={value} value={value}>
                        {value}x
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Forçar um cartão específico (opcional)
                </span>
                <select
                  value={preferredCardId}
                  onChange={(e) => setPreferredCardId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                >
                  <option value="">Deixar o simulador escolher o melhor cartão</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                      {card.brand ? ` • ${card.brand}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {!validationSummary.isValid ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
                <p className="text-sm font-semibold text-rose-900">Antes de salvar, ajuste estes pontos:</p>
                <ul className="mt-2 space-y-1 text-sm text-rose-800">
                  {validationSummary.messages.map((message) => (
                    <li key={message}>• {message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {hasDuplicateSimulation ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                Essa simulação já existe no histórico. Para salvar outra, altere valor, parcelas, cartão ou mês.
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveSimulation}
                disabled={saving || !recommendation || !validationSummary.isValid || hasDuplicateSimulation}
                className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar simulação"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Decisão recomendada</h2>

            {!recommendation || !bestOption ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                Preencha valor e parcelas para ver a recomendação.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className={`rounded-2xl border px-4 py-4 ${getRecommendationBoxStyles(recommendation.tone)}`}>
                  <p className="text-sm font-semibold text-slate-900">{recommendation.title}</p>
                  <p className="mt-1 text-sm text-slate-700">{recommendation.reason}</p>
                  <p className="mt-2 text-sm font-medium text-slate-800">{recommendation.actionLabel}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">Por que essa é a melhor decisão</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {recommendation.reasonList.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-0.5 text-slate-400">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Melhor cartão agora</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{bestOption.card.name}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Valor da parcela</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {formatCurrency(recommendation.installmentValue)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Mês mais apertado</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {bestOption.lowestProjectedMonthLabel}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatCurrency(bestOption.lowestProjectedBalance)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Uso do limite</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {bestOption.limitUsagePercentage !== null
                        ? `${bestOption.limitUsagePercentage.toFixed(1)}%`
                        : "Sem limite informado"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Comparação entre cartões</h2>
              <p className="mt-1 text-sm text-slate-500">
                A primeira opção é a melhor escolha para este cenário.
              </p>
            </div>
          </div>

          {comparisonResults.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              Preencha os dados da compra para comparar os cartões.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {comparisonResults.map((item, index) => (
                <div
                  key={item.card.id}
                  className={
                    item.status === "risk"
                      ? "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4"
                      : item.status === "attention"
                      ? "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4"
                      : "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4"
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{item.card.name}</p>
                    <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-medium text-slate-700">
                      {index === 0
                        ? "Melhor opção"
                        : item.status === "risk"
                        ? "Risco"
                        : item.status === "attention"
                        ? "Atenção"
                        : "Seguro"}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-slate-700">
                    <p>
                      Menor projeção:{" "}
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(item.lowestProjectedBalance)}
                      </span>
                    </p>
                    <p>
                      Mês mais apertado:{" "}
                      <span className="font-semibold text-slate-900">
                        {item.lowestProjectedMonthLabel}
                      </span>
                    </p>
                    <p>
                      Uso do limite:{" "}
                      <span className="font-semibold text-slate-900">
                        {item.limitUsagePercentage !== null
                          ? `${item.limitUsagePercentage.toFixed(1)}%`
                          : "Sem limite informado"}
                      </span>
                    </p>
                    <p>
                      Limite restante:{" "}
                      <span className="font-semibold text-slate-900">
                        {item.remainingLimit !== null
                          ? formatCurrency(item.remainingLimit)
                          : "Sem limite informado"}
                      </span>
                    </p>
                    {item.firstCriticalMonthLabel ? (
                      <p className="font-medium text-rose-700">
                        Fica crítica em {item.firstCriticalMonthLabel}.
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Histórico de simulações</h2>
              <p className="mt-1 text-sm text-slate-500">
                Suas simulações salvas ficam aqui, já ordenadas da mais recente para a mais antiga.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {historySorted.length} item(ns)
            </span>
          </div>

          {historySorted.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              Nenhuma simulação salva ainda. Preencha os dados da compra, gere a recomendação e clique em{" "}
              <span className="font-semibold text-slate-700">Salvar simulação</span>.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {historySorted.map((item) => {
                const tone =
                  item.recommendationStatus === "danger"
                    ? "border-rose-200 bg-rose-50"
                    : item.recommendationStatus === "warning"
                    ? "border-amber-200 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50";

                return (
                  <div key={item.id} className={`rounded-2xl border px-4 py-4 ${tone}`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {item.title || "Simulação salva"}
                          </p>

                          {item.selectedMonth ? (
                            <span className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-600">
                              {item.selectedMonth}
                            </span>
                          ) : null}

                          <span className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-500">
                            {formatHistoryDate(item.createdAt)}
                          </span>
                        </div>

                        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-xl bg-white/70 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Valor total</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {formatCurrency(item.totalAmount)}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white/70 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Parcelas</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {item.installmentCount || 1}x de {formatCurrency(item.installmentAmount)}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white/70 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Cartão recomendado</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {item.recommendedCardName || "Não informado"}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white/70 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Mês mais apertado</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {item.lowestProjectedMonthLabel || "—"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl bg-white/70 px-3 py-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {item.recommendationTitle || "Recomendação"}
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            {item.recommendationReason || "Sem detalhes adicionais."}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-start">
                        <button
                          type="button"
                          onClick={() => handleDeleteHistoryItem(item.id)}
                          disabled={deletingHistoryId === item.id}
                          className="inline-flex items-center rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingHistoryId === item.id ? "Excluindo..." : "Excluir"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
