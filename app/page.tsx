"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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
  date: string;
  account?: {
    id: string;
    name: string;
    balance?: number;
    type?: string;
  } | null;
  card?: {
    id: string;
    name: string;
    limit?: number;
  } | null;
};

type Account = {
  id: string;
  name: string;
  bank?: string | null;
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
    brand?: string | null;
  } | null;
};

type CategoryChartItem = {
  name: string;
  value: number;
  percentage: number;
};

type CategoryGoalMap = Record<string, number>;

type FutureInstallmentMonthGroup = {
  key: string;
  label: string;
  total: number;
  count: number;
  transactions: Transaction[];
  projectedBalance: number;
};

type SmartAlert = {
  id: string;
  title: string;
  message: string;
  tone: "danger" | "warning" | "info" | "success";
};

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
  "#14b8a6",
  "#f97316",
];

const GOAL_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Saúde",
  "Pet",
  "Casa",
  "Eletrônico",
  "Lazer",
  "Pessoal",
  "Vestuário",
  "SkinCare",
  "Reforma",
  "Outros",
];

function formatCurrency(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function formatInvoiceLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function getMonthInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonthInput(value: string) {
  const [year, month] = value.split("-").map(Number);

  return {
    year,
    month,
  };
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
    case "Salário":
      return "💼 Salário";
    case "Adiantamento":
      return "💰 Adiantamento";
    case "Vale alimentação":
      return "🥗 Vale alimentação";
    case "Extra":
      return "🎁 Extra";
    case "Outros":
      return "📦 Outros";
    default:
      return category || "📦 Outros";
  }
}

function getGoalsStorageKey(selectedMonth: string) {
  return `category-goals:${selectedMonth}`;
}

function isExpenseType(type?: string | null) {
  if (!type) return false;
  const normalized = type.toLowerCase();
  return (
    normalized === "expense" ||
    normalized === "saida" ||
    normalized === "saída"
  );
}

function isIncomeType(type?: string | null) {
  if (!type) return false;
  const normalized = type.toLowerCase();
  return normalized === "income" || normalized === "entrada";
}

function extractInstallmentInfo(title?: string | null) {
  if (!title) return null;
  const match = title.trim().match(/\((\d+)\s*\/\s*(\d+)\)$/);
  if (!match) return null;

  const current = Number(match[1]);
  const total = Number(match[2]);

  if (Number.isNaN(current) || Number.isNaN(total)) return null;

  return { current, total };
}

function isInstallmentTransaction(transaction: Transaction) {
  if (Number(transaction.installmentTotal || 0) > 1) return true;

  const parsed = extractInstallmentInfo(transaction.title);
  return !!parsed && parsed.total > 1;
}

function getAlertStyles(tone: SmartAlert["tone"]) {
  switch (tone) {
    case "danger":
      return {
        container: "border-rose-200 bg-rose-50",
        title: "text-rose-900",
        text: "text-rose-800",
        badge: "bg-rose-100 text-rose-700",
        label: "Atenção alta",
      };
    case "warning":
      return {
        container: "border-amber-200 bg-amber-50",
        title: "text-amber-900",
        text: "text-amber-800",
        badge: "bg-amber-100 text-amber-700",
        label: "Atenção",
      };
    case "success":
      return {
        container: "border-emerald-200 bg-emerald-50",
        title: "text-emerald-900",
        text: "text-emerald-800",
        badge: "bg-emerald-100 text-emerald-700",
        label: "Tudo bem",
      };
    default:
      return {
        container: "border-sky-200 bg-sky-50",
        title: "text-sky-900",
        text: "text-sky-800",
        badge: "bg-sky-100 text-sky-700",
        label: "Insight",
      };
  }
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(
    getMonthInputValue(new Date())
  );
  const [goals, setGoals] = useState<CategoryGoalMap>({});
  const [goalInputs, setGoalInputs] = useState<Record<string, string>>({});

  async function loadDashboardData() {
    try {
      setLoading(true);

      const [transactionsResult, accountsResult, invoicesResult] =
        await Promise.allSettled([
          fetch("/api/transactions", { cache: "no-store" }),
          fetch("/api/accounts", { cache: "no-store" }),
          fetch("/api/invoices", { cache: "no-store" }),
        ]);

      if (
        transactionsResult.status === "fulfilled" &&
        transactionsResult.value.ok
      ) {
        const data = await transactionsResult.value.json();
        setTransactions(Array.isArray(data) ? data : []);
      } else {
        setTransactions([]);
      }

      if (accountsResult.status === "fulfilled" && accountsResult.value.ok) {
        const data = await accountsResult.value.json();
        setAccounts(Array.isArray(data) ? data : []);
      } else {
        setAccounts([]);
      }

      if (invoicesResult.status === "fulfilled" && invoicesResult.value.ok) {
        const data = await invoicesResult.value.json();
        setInvoices(Array.isArray(data) ? data : []);
      } else {
        setInvoices([]);
      }
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      setTransactions([]);
      setAccounts([]);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(getGoalsStorageKey(selectedMonth));
    const parsed: CategoryGoalMap = saved ? JSON.parse(saved) : {};
    setGoals(parsed);

    const initialInputs: Record<string, string> = {};
    GOAL_CATEGORIES.forEach((category) => {
      initialInputs[category] =
        parsed[category] && parsed[category] > 0 ? String(parsed[category]) : "";
    });
    setGoalInputs(initialInputs);
  }, [selectedMonth]);

  const selectedDate = useMemo(() => {
    const { year, month } = parseMonthInput(selectedMonth);
    return new Date(year, month - 1, 1);
  }, [selectedMonth]);

  const filteredTransactions = useMemo(() => {
    const { year, month } = parseMonthInput(selectedMonth);

    return transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date);

      return (
        transactionDate.getFullYear() === year &&
        transactionDate.getMonth() + 1 === month
      );
    });
  }, [transactions, selectedMonth]);

  const filteredExpenses = useMemo(() => {
    return filteredTransactions.filter((transaction) =>
      isExpenseType(transaction.type)
    );
  }, [filteredTransactions]);

  const filteredIncomes = useMemo(() => {
    return filteredTransactions.filter((transaction) =>
      isIncomeType(transaction.type)
    );
  }, [filteredTransactions]);

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce(
      (sum, transaction) => sum + Number(transaction.amount || 0),
      0
    );
  }, [filteredExpenses]);

  const totalIncomes = useMemo(() => {
    return filteredIncomes.reduce(
      (sum, transaction) => sum + Number(transaction.amount || 0),
      0
    );
  }, [filteredIncomes]);

  const balanceMonth = useMemo(() => {
    return totalIncomes - totalExpenses;
  }, [totalIncomes, totalExpenses]);

  const categoryChartData = useMemo<CategoryChartItem[]>(() => {
    if (!filteredExpenses.length) return [];

    const grouped = filteredExpenses.reduce<Record<string, number>>(
      (acc, transaction) => {
        const category =
          transaction.category && transaction.category.trim() !== ""
            ? transaction.category
            : "Outros";

        acc[category] = (acc[category] || 0) + Number(transaction.amount || 0);
        return acc;
      },
      {}
    );

    return Object.entries(grouped)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalExpenses > 0 ? (value / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses, totalExpenses]);

  const biggestExpenseCategory = useMemo(() => {
    if (!categoryChartData.length) return null;
    return categoryChartData[0];
  }, [categoryChartData]);

  const foodAlert = useMemo(() => {
    if (!categoryChartData.length || totalExpenses <= 0) return null;

    const foodCategory = categoryChartData.find((item) => {
      const normalized = item.name.toLowerCase();
      return (
        normalized.includes("aliment") ||
        normalized.includes("mercado") ||
        normalized.includes("ifood") ||
        normalized.includes("restaurante") ||
        normalized.includes("comida")
      );
    });

    if (!foodCategory) return null;

    if (foodCategory.percentage >= 32) {
      return `Você gastou ${foodCategory.percentage.toFixed(
        0
      )}% em alimentação neste período.`;
    }

    return null;
  }, [categoryChartData, totalExpenses]);

  const lastTransactions = useMemo(() => {
    return [...filteredTransactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [filteredTransactions]);

  const categorySpentMap = useMemo(() => {
    const result: Record<string, number> = {};

    filteredExpenses.forEach((transaction) => {
      const category =
        transaction.category && transaction.category.trim() !== ""
          ? transaction.category
          : "Outros";

      result[category] =
        (result[category] || 0) + Number(transaction.amount || 0);
    });

    return result;
  }, [filteredExpenses]);

  const goalSummary = useMemo(() => {
    return GOAL_CATEGORIES.map((category) => {
      const goal = Number(goals[category] || 0);
      const spent = Number(categorySpentMap[category] || 0);
      const remaining = goal - spent;
      const percentage = goal > 0 ? (spent / goal) * 100 : 0;

      return {
        category,
        goal,
        spent,
        remaining,
        percentage,
        exceeded: goal > 0 && spent > goal,
      };
    }).filter((item) => item.goal > 0 || item.spent > 0);
  }, [goals, categorySpentMap]);

  const currentAccountsBalance = useMemo(() => {
    return accounts.reduce(
      (sum, account) => sum + Number(account.balance || 0),
      0
    );
  }, [accounts]);

  const openInvoices = useMemo(() => {
    return [...invoices]
      .filter((invoice) => invoice.status === "OPEN")
      .sort((a, b) => {
        const aDate = new Date(a.year, a.month - 1, 1).getTime();
        const bDate = new Date(b.year, b.month - 1, 1).getTime();
        return aDate - bDate;
      });
  }, [invoices]);

  const openInvoicesTotal = useMemo(() => {
    return openInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total || 0),
      0
    );
  }, [openInvoices]);

  const futureInstallments = useMemo(() => {
    const { year, month } = parseMonthInput(selectedMonth);
    const baseDate = new Date(year, month - 1, 1);

    return [...transactions]
      .filter((transaction) => {
        const transactionDate = new Date(transaction.date);
        const isInstallment = isInstallmentTransaction(transaction);
        const isFuture = transactionDate.getTime() > baseDate.getTime();
        const isExpense = isExpenseType(transaction.type);

        return isInstallment && isFuture && isExpense;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions, selectedMonth]);

  const futureInstallmentsTotal = useMemo(() => {
    return futureInstallments.reduce(
      (sum, transaction) => sum + Number(transaction.amount || 0),
      0
    );
  }, [futureInstallments]);

  const projectedBalanceAfterInvoices = useMemo(() => {
    return currentAccountsBalance - openInvoicesTotal;
  }, [currentAccountsBalance, openInvoicesTotal]);

  const projectedBalanceReal = useMemo(() => {
    return (
      currentAccountsBalance - openInvoicesTotal - futureInstallmentsTotal
    );
  }, [currentAccountsBalance, openInvoicesTotal, futureInstallmentsTotal]);

  const futureInstallmentsByMonth = useMemo<FutureInstallmentMonthGroup[]>(() => {
    const grouped = futureInstallments.reduce<
      Record<string, Omit<FutureInstallmentMonthGroup, "projectedBalance">>
    >((acc, transaction) => {
      const date = new Date(transaction.date);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });

      if (!acc[key]) {
        acc[key] = {
          key,
          label,
          total: 0,
          count: 0,
          transactions: [],
        };
      }

      acc[key].total += Number(transaction.amount || 0);
      acc[key].count += 1;
      acc[key].transactions.push(transaction);

      return acc;
    }, {});

    const ordered = Object.values(grouped).sort((a, b) => a.key.localeCompare(b.key));

    let runningBalance = projectedBalanceAfterInvoices;

    return ordered.map((group) => {
      runningBalance -= group.total;

      return {
        ...group,
        projectedBalance: runningBalance,
      };
    });
  }, [futureInstallments, projectedBalanceAfterInvoices]);

  const smartAlerts = useMemo<SmartAlert[]>(() => {
    const alerts: SmartAlert[] = [];
    const safeBalanceThreshold = 2000;

    if (projectedBalanceReal < 0) {
      alerts.push({
        id: "negative-projected-balance",
        title: "Saldo projetado negativo",
        message: `Sua projeção total está negativa em ${formatCurrency(
          Math.abs(projectedBalanceReal)
        )}. Vale revisar cartão, parcelas e despesas variáveis.`,
        tone: "danger",
      });
    } else if (projectedBalanceReal < safeBalanceThreshold) {
      alerts.push({
        id: "low-projected-balance",
        title: "Saldo projetado baixo",
        message: `Depois de considerar faturas e parcelas futuras, seu saldo projetado fica em ${formatCurrency(
          projectedBalanceReal
        )}. Esse valor já merece atenção.`,
        tone: "warning",
      });
    }

    if (futureInstallmentsByMonth.length >= 3) {
      alerts.push({
        id: "three-months-card-impact",
        title: "Impacto no cartão por vários meses",
        message: `Você tem impacto de parcelas em ${futureInstallmentsByMonth.length} meses seguidos. Isso reduz sua margem de manobra nos próximos períodos.`,
        tone: "info",
      });
    }

    const monthWithLowestBalance = futureInstallmentsByMonth.reduce<FutureInstallmentMonthGroup | null>(
      (lowest, current) => {
        if (!lowest) return current;
        return current.projectedBalance < lowest.projectedBalance ? current : lowest;
      },
      null
    );

    if (monthWithLowestBalance) {
      if (monthWithLowestBalance.projectedBalance < 0) {
        alerts.push({
          id: "lowest-month-negative",
          title: "Mês crítico na projeção",
          message: `${monthWithLowestBalance.label} termina com saldo projetado de ${formatCurrency(
            monthWithLowestBalance.projectedBalance
          )}. Esse é o ponto mais sensível da sua previsão.`,
          tone: "danger",
        });
      } else if (monthWithLowestBalance.projectedBalance < safeBalanceThreshold) {
        alerts.push({
          id: "lowest-month-low",
          title: "Mês mais apertado da previsão",
          message: `${monthWithLowestBalance.label} fica com saldo projetado de ${formatCurrency(
            monthWithLowestBalance.projectedBalance
          )}. É o mês com menor folga no seu planejamento.`,
          tone: "warning",
        });
      }
    }

    const exceededGoals = goalSummary.filter((item) => item.exceeded);
    if (exceededGoals.length > 0) {
      const firstExceeded = exceededGoals[0];
      alerts.push({
        id: "goal-exceeded",
        title: "Meta de categoria estourada",
        message: `${getCategoryLabel(firstExceeded.category)} ultrapassou a meta em ${formatCurrency(
          Math.abs(firstExceeded.remaining)
        )}.`,
        tone: "warning",
      });
    }

    if (foodAlert) {
      alerts.push({
        id: "food-alert",
        title: "Alimentação acima do normal",
        message: foodAlert,
        tone: "warning",
      });
    }

    if (
      alerts.length === 0 &&
      projectedBalanceReal >= safeBalanceThreshold &&
      openInvoicesTotal === 0 &&
      futureInstallmentsTotal === 0
    ) {
      alerts.push({
        id: "healthy-scenario",
        title: "Situação confortável",
        message:
          "No cenário atual, você não tem pressão de faturas abertas nem parcelas futuras relevantes no radar.",
        tone: "success",
      });
    }

    return alerts.slice(0, 5);
  }, [
    projectedBalanceReal,
    futureInstallmentsByMonth,
    goalSummary,
    foodAlert,
    openInvoicesTotal,
    futureInstallmentsTotal,
  ]);

  const futureBalanceAlert = useMemo(() => {
    if (openInvoices.length === 0 && futureInstallments.length === 0) {
      return "Você não possui faturas abertas nem parcelas futuras pendentes no momento.";
    }

    if (projectedBalanceReal < 0) {
      return `Atenção: considerando faturas abertas e parcelas futuras, seu saldo projetado fica negativo em ${formatCurrency(
        Math.abs(projectedBalanceReal)
      )}.`;
    }

    return `Seu saldo projetado real após faturas abertas e parcelas futuras é de ${formatCurrency(
      projectedBalanceReal
    )}.`;
  }, [openInvoices.length, futureInstallments.length, projectedBalanceReal]);

  function handleGoalInputChange(category: string, value: string) {
    setGoalInputs((prev) => ({
      ...prev,
      [category]: value,
    }));
  }

  function saveGoal(category: string) {
    const rawValue = goalInputs[category]?.trim() || "";
    const parsedValue = Number(rawValue.replace(",", "."));

    const nextGoals = {
      ...goals,
      [category]:
        rawValue === "" || Number.isNaN(parsedValue) || parsedValue <= 0
          ? 0
          : parsedValue,
    };

    if (nextGoals[category] === 0) {
      delete nextGoals[category];
    }

    setGoals(nextGoals);
    localStorage.setItem(
      getGoalsStorageKey(selectedMonth),
      JSON.stringify(nextGoals)
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Dashboard</p>
              <h1 className="text-3xl font-bold text-slate-900">
                Visão geral financeira
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Resumo de {formatMonthYear(selectedDate)}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/transactions"
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Ver transações
              </Link>

              <Link
                href="/accounts"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Ver contas
              </Link>

              <Link
                href="/invoices"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Ver faturas
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:max-w-xs">
            <label className="text-sm font-medium text-slate-700">
              Filtrar por mês
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
            />
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Entradas no período
            </p>
            <h2 className="mt-2 text-2xl font-bold text-emerald-600">
              {formatCurrency(totalIncomes)}
            </h2>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Saídas no período
            </p>
            <h2 className="mt-2 text-2xl font-bold text-rose-600">
              {formatCurrency(totalExpenses)}
            </h2>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Saldo do período
            </p>
            <h2
              className={`mt-2 text-2xl font-bold ${
                balanceMonth >= 0 ? "text-sky-600" : "text-rose-600"
              }`}
            >
              {formatCurrency(balanceMonth)}
            </h2>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Saldo atual em contas
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              {formatCurrency(currentAccountsBalance)}
            </h2>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Faturas abertas
            </p>
            <h2 className="mt-2 text-2xl font-bold text-amber-600">
              {formatCurrency(openInvoicesTotal)}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {openInvoices.length} fatura(s) pendente(s)
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Parcelas futuras
            </p>
            <h2 className="mt-2 text-2xl font-bold text-fuchsia-600">
              {formatCurrency(futureInstallmentsTotal)}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {futureInstallments.length} parcela(s) futura(s)
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Saldo após faturas
            </p>
            <h2
              className={`mt-2 text-2xl font-bold ${
                projectedBalanceAfterInvoices >= 0
                  ? "text-sky-600"
                  : "text-rose-600"
              }`}
            >
              {formatCurrency(projectedBalanceAfterInvoices)}
            </h2>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Saldo projetado real
            </p>
            <h2
              className={`mt-2 text-2xl font-bold ${
                projectedBalanceReal >= 0 ? "text-sky-600" : "text-rose-600"
              }`}
            >
              {formatCurrency(projectedBalanceReal)}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Contas - faturas - parcelas futuras
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">
            Leitura rápida do futuro
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {futureBalanceAlert}
          </p>
        </section>

        {smartAlerts.length > 0 && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Alertas inteligentes
              </h3>
              <p className="text-sm text-slate-500">
                Sinais importantes da sua situação atual e da sua previsão
              </p>
            </div>

            <div className="space-y-3">
              {smartAlerts.map((alert) => {
                const styles = getAlertStyles(alert.tone);

                return (
                  <div
                    key={alert.id}
                    className={`rounded-2xl border p-4 ${styles.container}`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className={`font-semibold ${styles.title}`}>
                          {alert.title}
                        </p>
                        <p className={`mt-1 text-sm leading-6 ${styles.text}`}>
                          {alert.message}
                        </p>
                      </div>

                      <span
                        className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}
                      >
                        {styles.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {futureInstallmentsByMonth.length > 0 && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Previsão mês a mês
              </h3>
              <p className="text-sm text-slate-500">
                Como as parcelas futuras impactam os próximos meses
              </p>
            </div>

            <div className="space-y-3">
              {futureInstallmentsByMonth.map((group) => (
                <div
                  key={group.key}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold capitalize text-slate-900">
                        {group.label}
                      </p>
                      <p className="text-sm text-slate-500">
                        {group.count} parcela(s) prevista(s)
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                        <p className="text-xs text-slate-500">Impacto no mês</p>
                        <p className="text-lg font-bold text-fuchsia-600">
                          {formatCurrency(group.total)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                        <p className="text-xs text-slate-500">
                          Saldo projetado
                        </p>
                        <p
                          className={`text-lg font-bold ${
                            group.projectedBalance >= 0
                              ? "text-sky-600"
                              : "text-rose-600"
                          }`}
                        >
                          {formatCurrency(group.projectedBalance)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {group.transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {transaction.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {transaction.card?.name || "Cartão"} •{" "}
                            {new Date(transaction.date).toLocaleDateString(
                              "pt-BR"
                            )}
                          </p>
                        </div>

                        <p className="ml-3 whitespace-nowrap text-sm font-bold text-fuchsia-600">
                          {formatCurrency(Number(transaction.amount))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {foodAlert && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-amber-900">
              Alerta automático
            </p>
            <p className="mt-1 text-base text-amber-800">{foodAlert}</p>
          </section>
        )}

        {futureInstallments.length > 0 && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Parcelas futuras
              </h3>
              <p className="text-sm text-slate-500">
                Compromissos futuros já assumidos no cartão
              </p>
            </div>

            <div className="space-y-3">
              {futureInstallments.slice(0, 8).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {transaction.title}
                    </p>
                    <p className="text-sm text-slate-500">
                      {transaction.card?.name || "Cartão"} •{" "}
                      {new Date(transaction.date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-slate-500">Valor</p>
                    <p className="text-lg font-bold text-fuchsia-600">
                      {formatCurrency(Number(transaction.amount))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {openInvoices.length > 0 && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Próximas faturas em aberto
              </h3>
              <p className="text-sm text-slate-500">
                Valores que já estão comprometendo seu saldo
              </p>
            </div>

            <div className="space-y-3">
              {openInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {invoice.card?.name || "Cartão"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatInvoiceLabel(invoice.month, invoice.year)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-slate-500">Total em aberto</p>
                    <p className="text-lg font-bold text-amber-600">
                      {formatCurrency(invoice.total)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-3xl bg-white p-6 shadow-sm xl:col-span-2">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Gastos por categoria
              </h3>
              <p className="text-sm text-slate-500">
                Distribuição das despesas do período selecionado
              </p>
            </div>

            {loading ? (
              <div className="flex h-[320px] items-center justify-center text-slate-500">
                Carregando gráfico...
              </div>
            ) : categoryChartData.length === 0 ? (
              <div className="flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-slate-500">
                Ainda não existem despesas neste período para gerar o gráfico.
              </div>
            ) : (
              <div className="h-[340px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={({ name, percentage }) =>
                        `${name}: ${percentage.toFixed(0)}%`
                      }
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend
                      formatter={(value) => getCategoryLabel(String(value))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">
                Maior gasto do período
              </h3>

              {biggestExpenseCategory ? (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-slate-500">Categoria</p>
                  <p className="text-xl font-bold text-slate-900">
                    {getCategoryLabel(biggestExpenseCategory.name)}
                  </p>
                  <p className="text-2xl font-bold text-rose-600">
                    {formatCurrency(biggestExpenseCategory.value)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {biggestExpenseCategory.percentage.toFixed(1)}% das despesas
                    do período
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Ainda não há despesas neste período.
                </p>
              )}
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">
                Últimas movimentações
              </h3>

              {loading ? (
                <p className="mt-4 text-sm text-slate-500">Carregando...</p>
              ) : lastTransactions.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Nenhuma transação encontrada neste período.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {lastTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {transaction.title}
                        </p>
                        <p className="text-sm text-slate-500">
                          {getCategoryLabel(transaction.category)} •{" "}
                          {new Date(transaction.date).toLocaleDateString(
                            "pt-BR"
                          )}
                        </p>
                      </div>

                      <p
                        className={`ml-3 whitespace-nowrap text-sm font-bold ${
                          isIncomeType(transaction.type)
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {isIncomeType(transaction.type) ? "+ " : "- "}
                        {formatCurrency(Number(transaction.amount))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-900">
              Metas por categoria
            </h3>
            <p className="text-sm text-slate-500">
              Defina um limite mensal e acompanhe quanto já foi gasto.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {GOAL_CATEGORIES.map((category) => (
              <div
                key={category}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <p className="font-medium text-slate-900">
                  {getCategoryLabel(category)}
                </p>

                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Meta em R$"
                    value={goalInputs[category] ?? ""}
                    onChange={(e) =>
                      handleGoalInputChange(category, e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none transition focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => saveGoal(category)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {goalSummary.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhuma meta cadastrada ainda para este período.
              </p>
            ) : (
              goalSummary.map((item) => (
                <div
                  key={item.category}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {getCategoryLabel(item.category)}
                      </p>
                      <p className="text-sm text-slate-500">
                        Meta: {formatCurrency(item.goal)} • Gasto:{" "}
                        {formatCurrency(item.spent)}
                      </p>
                    </div>

                    <div className="text-sm font-medium">
                      {item.exceeded ? (
                        <span className="text-rose-600">
                          Estourou em {formatCurrency(Math.abs(item.remaining))}
                        </span>
                      ) : (
                        <span className="text-emerald-600">
                          Restam {formatCurrency(item.remaining)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        item.exceeded ? "bg-rose-500" : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${Math.min(item.percentage, 100)}%`,
                      }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    {item.goal > 0
                      ? `${item.percentage.toFixed(1)}% da meta utilizada`
                      : "Sem meta definida"}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}