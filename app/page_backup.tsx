"use client";

import LogoutButton from "@/components/logout-button";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
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

type PaymentMethod =
  | ""
  | "cash"
  | "debit_card"
  | "credit_card"
  | "pix"
  | "bank_transfer"
  | "boleto"
  | "voucher";

type Account = {
  id: string;
  name: string;
  bank?: string | null;
  balance: number;
};

type Card = {
  id: string;
  name: string;
  limit?: number;
  brand?: string | null;
};

type RecurringTransaction = {
  id: string;
  title: string;
  amount: number;
  type: string;
  category?: string | null;
  paymentMethod?: PaymentMethod | string | null;
  accountId?: string | null;
  cardId?: string | null;
  dayOfMonth: number;
  active: boolean;
  account?: {
    id: string;
    name: string;
  } | null;
  card?: {
    id: string;
    name: string;
    brand?: string | null;
  } | null;
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
  "Eletronico",
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

function normalizeComparableText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}


function getPaymentMethodLabel(method?: string | null) {
  switch (method) {
    case "cash":
      return "Dinheiro";
    case "debit_card":
      return "Cartão de débito";
    case "credit_card":
      return "Cartão de crédito";
    case "pix":
      return "Pix";
    case "bank_transfer":
      return "Transferência";
    case "boleto":
      return "Boleto";
    case "voucher":
      return "Voucher / Vale alimentação";
    default:
      return "Não informado";
  }
}

function getCategoryLabel(category?: string | null) {
  switch (category) {
    case "Alimentação":
      return "🍔 Alimentação";
    case "Transporte":
      return "🚗 Transporte";
    case "Saúde":
      return "💊 Saúde";
    case "Pet":
      return "🐶 Pet";
    case "Casa":
      return "🏠 Casa";
    case "Eletrônico":
      return "📱 Eletrônico";
    case "Lazer":
      return "🎮 Lazer";
    case "Pessoal":
      return "🧍 Pessoal";
    case "Vestuário":
      return "👕 Vestuário";
    case "SkinCare":
      return "🧴 SkinCare";
    case "Reforma":
      return "🔧 Reforma";
    case "Salário":
      return "💰 Salário";
    case "Adiantamento":
      return "💵 Adiantamento";
    case "Vale alimentação":
      return "🍽️ Vale alimentação";
    case "Extra":
      return "✨ Extra";
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

type ToastState = {
  visible: boolean;
  title: string;
  message: string;
  tone: "success" | "error" | "info";
};

type DeleteConfirmState = {
  open: boolean;
  id: string | null;
  title: string;
};

type SimulationHistoryItem = {
  id: string;
  title?: string | null;
  purchaseType: "cash" | "installment";
  totalAmount: number;
  installmentCount: number;
  installmentAmount: number;
  recommendedCardName?: string | null;
  recommendationStatus: "success" | "warning" | "danger";
  recommendationTitle: string;
  recommendationReason?: string | null;
  lowestProjectedMonthLabel?: string | null;
  lowestProjectedBalance?: number | null;
  limitUsagePercent?: number | null;
  remainingLimitAfterPurchase?: number | null;
  selectedMonth?: string | null;
  createdAt: string;
};

function getToastStyles(tone: ToastState["tone"]) {
  switch (tone) {
    case "success":
      return {
        container: "border-emerald-200 bg-emerald-50",
        title: "text-emerald-900",
        text: "text-emerald-800",
        button: "text-emerald-700 hover:bg-emerald-100",
      };
    case "error":
      return {
        container: "border-rose-200 bg-rose-50",
        title: "text-rose-900",
        text: "text-rose-800",
        button: "text-rose-700 hover:bg-rose-100",
      };
    default:
      return {
        container: "border-sky-200 bg-sky-50",
        title: "text-sky-900",
        text: "text-sky-800",
        button: "text-sky-700 hover:bg-sky-100",
      };
  }
}

function CustomDailyBalanceTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-slate-900">Dia {data.day}</p>
      <p className="mt-1 text-sm text-slate-600">
        Saldo projetado: <span className="font-semibold text-slate-900">{formatCurrency(Number(data.balance || 0))}</span>
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {Number(data.balance || 0) < 0
          ? "Atenção: saldo negativo neste dia."
          : data.isWorst
          ? "Este é o ponto mais crítico do mês."
          : "Situação prevista para este dia."}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [recurrings, setRecurrings] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(
    getMonthInputValue(new Date())
  );
  const [goals, setGoals] = useState<CategoryGoalMap>({});
  const [goalInputs, setGoalInputs] = useState<Record<string, string>>({});
  const [recurringSubmitting, setRecurringSubmitting] = useState(false);
  const [recurringGenerateLoading, setRecurringGenerateLoading] = useState(false);
  const [recurringActionId, setRecurringActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    title: "",
    message: "",
    tone: "info",
  });
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    open: false,
    id: null,
    title: "",
  });
  const [recurringTitle, setRecurringTitle] = useState("");
  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringType, setRecurringType] = useState<"income" | "expense">("expense");
  const [recurringCategory, setRecurringCategory] = useState("Alimentação");
  const [recurringPaymentMethod, setRecurringPaymentMethod] = useState<PaymentMethod>("pix");
  const [recurringAccountId, setRecurringAccountId] = useState("");
  const [recurringCardId, setRecurringCardId] = useState("");
  const [recurringDayOfMonth, setRecurringDayOfMonth] = useState("10");
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [simulationValue, setSimulationValue] = useState("");
  const [installmentSimulationValue, setInstallmentSimulationValue] = useState("");
  const [installmentSimulationCount, setInstallmentSimulationCount] = useState("3");
  const [installmentSimulationCardId, setInstallmentSimulationCardId] = useState("");
  const [simulationHistory, setSimulationHistory] = useState<SimulationHistoryItem[]>([]);
  const [simulationHistorySaving, setSimulationHistorySaving] = useState(false);
  const [simulationHistoryDeletingId, setSimulationHistoryDeletingId] = useState<string | null>(null);
  const [simulationHistoryApplyingId, setSimulationHistoryApplyingId] = useState<string | null>(null);

  function showToast(
    title: string,
    message: string,
    tone: ToastState["tone"] = "info"
  ) {
    setToast({
      visible: true,
      title,
      message,
      tone,
    });
  }

 useEffect(() => {
  if (!toast.visible) return;

  const timeout = window.setTimeout(() => {
    setToast((current) => ({
      ...current,
      visible: false,
    }));
  }, 3200);

  return () => window.clearTimeout(timeout);
}, [toast.visible, toast.title, toast.message, toast.tone]);

  async function loadDashboardData() {
    try {
      setLoading(true);

      const [
        transactionsResult,
        accountsResult,
        cardsResult,
        invoicesResult,
        recurringsResult,
        simulationHistoryResult,
      ] = await Promise.allSettled([
        fetch("/api/transactions", { cache: "no-store" }),
        fetch("/api/accounts", { cache: "no-store" }),
        fetch("/api/cards", { cache: "no-store" }),
        fetch("/api/invoices", { cache: "no-store" }),
        fetch("/api/recurring", { cache: "no-store" }),
        fetch("/api/simulation-history", { cache: "no-store" }),
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

      if (cardsResult.status === "fulfilled" && cardsResult.value.ok) {
        const data = await cardsResult.value.json();
        setCards(Array.isArray(data) ? data : []);
      } else {
        setCards([]);
      }

      if (invoicesResult.status === "fulfilled" && invoicesResult.value.ok) {
        const data = await invoicesResult.value.json();
        setInvoices(Array.isArray(data) ? data : []);
      } else {
        setInvoices([]);
      }

      if (recurringsResult.status === "fulfilled" && recurringsResult.value.ok) {
        const data = await recurringsResult.value.json();
        setRecurrings(Array.isArray(data) ? data : []);
      } else {
        setRecurrings([]);
      }

      if (simulationHistoryResult.status === "fulfilled" && simulationHistoryResult.value.ok) {
        const data = await simulationHistoryResult.value.json();
        setSimulationHistory(Array.isArray(data) ? data : []);
      } else {
        setSimulationHistory([]);
      }
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      setTransactions([]);
      setAccounts([]);
      setCards([]);
      setInvoices([]);
      setRecurrings([]);
      setSimulationHistory([]);
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

  useEffect(() => {
    if (recurringType === "income") {
      if (
        recurringCategory === "Alimentação" ||
        recurringCategory === "Transporte" ||
        recurringCategory === "Saúde" ||
        recurringCategory === "Pet" ||
        recurringCategory === "Casa" ||
        recurringCategory === "Eletrônico" ||
        recurringCategory === "Lazer" ||
        recurringCategory === "Pessoal" ||
        recurringCategory === "Vestuário" ||
        recurringCategory === "SkinCare" ||
        recurringCategory === "Reforma"
      ) {
        setRecurringCategory("Salário");
      }

      if (recurringPaymentMethod === "credit_card") {
        setRecurringPaymentMethod("pix");
        setRecurringCardId("");
      }
    } else if (
      recurringCategory === "Salário" ||
      recurringCategory === "Adiantamento" ||
      recurringCategory === "Vale alimentação" ||
      recurringCategory === "Extra"
    ) {
      setRecurringCategory("Alimentação");
    }
  }, [recurringType, recurringCategory, recurringPaymentMethod]);

  useEffect(() => {
    if (recurringPaymentMethod === "credit_card") {
      setRecurringAccountId("");
    } else {
      setRecurringCardId("");
    }

    if (recurringPaymentMethod === "voucher") {
      setRecurringAccountId("");
    }
  }, [recurringPaymentMethod]);

  const selectedDate = useMemo(() => {
    const { year, month } = parseMonthInput(selectedMonth);
    return new Date(year, month - 1, 1);
  }, [selectedMonth]);

  const selectedMonthMeta = useMemo(() => {
    const { year, month } = parseMonthInput(selectedMonth);
    const daysInMonth = new Date(year, month, 0).getDate();

    return {
      year,
      month,
      daysInMonth,
    };
  }, [selectedMonth]);

  const recurringCategoryOptions = useMemo(() => {
    return recurringType === "income"
      ? [
          { label: "💰 Salário", value: "Salário" },
          { label: "💵 Adiantamento", value: "Adiantamento" },
          { label: "🍽️ Vale alimentação", value: "Vale alimentação" },
          { label: "✨ Extra", value: "Extra" },
          { label: "📦 Outros", value: "Outros" },
        ]
      : GOAL_CATEGORIES.map((category) => ({
          label: getCategoryLabel(category),
          value: category,
        }));
  }, [recurringType]);

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

  const monthlyRecurringProjection = useMemo(() => {
    const sameRecurringAlreadyGenerated = (
      recurring: RecurringTransaction,
      transaction: Transaction
    ) => {
      const recurringDay = Math.min(
        Math.max(Number(recurring.dayOfMonth || 1), 1),
        selectedMonthMeta.daysInMonth
      );
      const transactionDate = new Date(transaction.date);
      const recurringTitle = normalizeComparableText(recurring.title);
      const transactionTitle = normalizeComparableText(transaction.title);
      const sameTitle =
        transactionTitle === recurringTitle ||
        transactionTitle.startsWith(`${recurringTitle} (`);
      const sameAmount =
        Math.round(Number(transaction.amount || 0) * 100) ===
        Math.round(Number(recurring.amount || 0) * 100);
      const sameType =
        (isIncomeType(transaction.type) && isIncomeType(recurring.type)) ||
        (isExpenseType(transaction.type) && isExpenseType(recurring.type));
      const sameCategory =
        normalizeComparableText(transaction.category) ===
        normalizeComparableText(recurring.category);
      const samePaymentMethod =
        normalizeComparableText(transaction.paymentMethod) ===
        normalizeComparableText(recurring.paymentMethod);
      const sameAccount = (transaction.accountId || "") === (recurring.accountId || "");
      const sameCard = (transaction.cardId || "") === (recurring.cardId || "");
      const sameDay = transactionDate.getDate() === recurringDay;

      return (
        sameTitle &&
        sameAmount &&
        sameType &&
        sameCategory &&
        samePaymentMethod &&
        sameAccount &&
        sameCard &&
        sameDay
      );
    };

    const activeRecurrings = recurrings.filter((item) => item.active);
    const pendingIncomeItems: RecurringTransaction[] = [];
    const pendingExpenseItems: RecurringTransaction[] = [];

    activeRecurrings.forEach((item) => {
      const alreadyGenerated = filteredTransactions.some((transaction) =>
        sameRecurringAlreadyGenerated(item, transaction)
      );

      if (alreadyGenerated) {
        return;
      }

      if (isIncomeType(item.type)) {
        pendingIncomeItems.push(item);
        return;
      }

      if (isExpenseType(item.type)) {
        pendingExpenseItems.push(item);
      }
    });

    const incomesTotal = pendingIncomeItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const expensesTotal = pendingExpenseItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    return {
      pendingIncomeItems,
      pendingExpenseItems,
      incomesTotal,
      expensesTotal,
    };
  }, [filteredTransactions, recurrings, selectedMonthMeta.daysInMonth]);

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

  const selectedMonthOpenInvoices = useMemo(() => {
    return openInvoices.filter(
      (invoice) =>
        invoice.year === selectedMonthMeta.year &&
        invoice.month === selectedMonthMeta.month
    );
  }, [openInvoices, selectedMonthMeta.month, selectedMonthMeta.year]);

  const selectedMonthOpenInvoicesTotal = useMemo(() => {
    return selectedMonthOpenInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total || 0),
      0
    );
  }, [selectedMonthOpenInvoices]);

  const monthlyProjectedBalance = useMemo(() => {
    return (
      currentAccountsBalance +
      monthlyRecurringProjection.incomesTotal -
      monthlyRecurringProjection.expensesTotal -
      selectedMonthOpenInvoicesTotal
    );
  }, [
    currentAccountsBalance,
    monthlyRecurringProjection.expensesTotal,
    monthlyRecurringProjection.incomesTotal,
    selectedMonthOpenInvoicesTotal,
  ]);

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

  const dailyBalanceProjection = useMemo(() => {
    let runningBalance = currentAccountsBalance;
    const dailyItems: {
      day: number;
      balance: number;
      label: string;
      isWorst?: boolean;
    }[] = [];

    for (let day = 1; day <= selectedMonthMeta.daysInMonth; day += 1) {
      if (day === 1 && selectedMonthOpenInvoicesTotal > 0) {
        runningBalance -= selectedMonthOpenInvoicesTotal;
      }

      const dayTransactions = filteredTransactions.filter((transaction) => {
        const transactionDate = new Date(transaction.date);
        return transactionDate.getDate() === day;
      });

      dayTransactions.forEach((transaction) => {
        if (isIncomeType(transaction.type)) {
          runningBalance += Number(transaction.amount || 0);
          return;
        }

        if (isExpenseType(transaction.type)) {
          runningBalance -= Number(transaction.amount || 0);
        }
      });

      const dayPendingRecurrings = [
        ...monthlyRecurringProjection.pendingIncomeItems,
       ...monthlyRecurringProjection.pendingExpenseItems,
      ].filter((item) => {
        const recurringDay = Math.min(
          Math.max(Number(item.dayOfMonth || 1), 1),
          selectedMonthMeta.daysInMonth
        );

        return recurringDay === day;
      });

      dayPendingRecurrings.forEach((item) => {
        if (isIncomeType(item.type)) {
          runningBalance += Number(item.amount || 0);
          return;
        }

        if (isExpenseType(item.type)) {
          runningBalance -= Number(item.amount || 0);
        }
      });

      dailyItems.push({
        day,
        balance: runningBalance,
        label: `${String(day).padStart(2, "0")}/${String(
          selectedMonthMeta.month
        ).padStart(2, "0")}`,
      });
    }

    if (dailyItems.length === 0) return dailyItems;

    const worstItem = dailyItems.reduce((lowest, current) =>
      current.balance < lowest.balance ? current : lowest
    );

    return dailyItems.map((item) => ({
      ...item,
      isWorst: item.day === worstItem.day,
    }));
  }, [
    currentAccountsBalance,
    filteredTransactions,
    monthlyRecurringProjection.pendingExpenseItems,
    monthlyRecurringProjection.pendingIncomeItems,
    selectedMonthMeta.daysInMonth,
    selectedMonthMeta.month,
    selectedMonthOpenInvoicesTotal,
  ]);

  const dailyProjectionSummary = useMemo(() => {
    if (dailyBalanceProjection.length === 0) {
      return {
        lowestPoint: null as null | { day: number; balance: number; label: string },
        highestPoint: null as null | { day: number; balance: number; label: string },
        negativeDays: 0,
      };
    }

    const lowestPoint = dailyBalanceProjection.reduce((lowest, current) =>
      current.balance < lowest.balance ? current : lowest
    );
    const highestPoint = dailyBalanceProjection.reduce((highest, current) =>
      current.balance > highest.balance ? current : highest
    );
    const negativeDays = dailyBalanceProjection.filter((item) => item.balance < 0).length;

    return {
      lowestPoint,
      highestPoint,
      negativeDays,
    };
  }, [dailyBalanceProjection]);

  const spendingCapacitySummary = useMemo(() => {
    const today = new Date();
    const isCurrentSelectedMonth =
      today.getFullYear() === selectedMonthMeta.year &&
      today.getMonth() + 1 === selectedMonthMeta.month;

    const referenceDay = isCurrentSelectedMonth
      ? Math.min(today.getDate(), selectedMonthMeta.daysInMonth)
      : 1;

    const projectionFromReference = dailyBalanceProjection.filter(
      (item) => item.day >= referenceDay
    );

    const lowestFutureBalance =
      projectionFromReference.length > 0
        ? projectionFromReference.reduce((lowest, current) =>
            current.balance < lowest.balance ? current : lowest
          )
        : dailyProjectionSummary.lowestPoint;

    const extraSafeSpend = Math.max(0, Number(lowestFutureBalance?.balance || 0));
    const daysRemaining = Math.max(
      1,
      selectedMonthMeta.daysInMonth - referenceDay + 1
    );
    const safeDailySpend = extraSafeSpend / daysRemaining;

    return {
      isCurrentSelectedMonth,
      referenceDay,
      daysRemaining,
      lowestFutureBalance,
      extraSafeSpend,
      safeDailySpend,
      isNegativeScenario: (lowestFutureBalance?.balance || 0) < 0,
    };
  }, [
    dailyBalanceProjection,
    dailyProjectionSummary.lowestPoint,
    selectedMonthMeta.daysInMonth,
    selectedMonthMeta.month,
    selectedMonthMeta.year,
  ]);


  const purchaseSimulation = useMemo(() => {
    const normalized = simulationValue.replace(/\./g, "").replace(",", ".").trim();

    if (!normalized) {
      return null;
    }

    const amount = Number(normalized);

    if (Number.isNaN(amount) || amount <= 0) {
      return {
        amount: 0,
        canSpend: false,
        breakDay: null as number | null,
        remainingMargin: 0,
        lowestSimulatedBalance: 0,
        message: "Digite um valor válido para simular a compra.",
      };
    }

    const simulatedProjection = dailyBalanceProjection.map((item) => ({
      ...item,
      simulatedBalance: item.balance - amount,
    }));

    const firstNegativeDay = simulatedProjection.find((item) => item.simulatedBalance < 0);
    const lowestSimulatedBalance = simulatedProjection.reduce((lowest, current) =>
      current.simulatedBalance < lowest.simulatedBalance ? current : lowest
    ).simulatedBalance;

    if (firstNegativeDay) {
      return {
        amount,
        canSpend: false,
        breakDay: firstNegativeDay.day,
        remainingMargin: 0,
        lowestSimulatedBalance,
        message: `Se você gastar ${formatCurrency(amount)}, o saldo projetado fica negativo no dia ${firstNegativeDay.day}.`,
      };
    }

    return {
      amount,
      canSpend: true,
      breakDay: null as number | null,
      remainingMargin: spendingCapacitySummary.extraSafeSpend - amount,
      lowestSimulatedBalance,
      message: `Você pode gastar ${formatCurrency(amount)} sem ficar negativa em ${formatMonthYear(selectedDate)}.`,
    };
  }, [dailyBalanceProjection, selectedDate, simulationValue, spendingCapacitySummary.extraSafeSpend]);

  const worstDay = useMemo(() => {
    if (!dailyBalanceProjection.length) return null;

    return dailyBalanceProjection.reduce((lowest, current) => {
      if (!lowest) return current;
      return current.balance < lowest.balance ? current : lowest;
    }, null as null | { day: number; balance: number; label: string });
  }, [dailyBalanceProjection]);


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


  const installmentPurchaseSimulation = useMemo(() => {
    const normalizedValue = installmentSimulationValue
      .replace(/\./g, "")
      .replace(",", ".")
      .trim();
    const amount = Number(normalizedValue);
    const installmentCount = Number(installmentSimulationCount);

    if (!normalizedValue) {
      return null;
    }

    if (Number.isNaN(amount) || amount <= 0) {
      return {
        valid: false,
        message: "Digite um valor válido para simular a compra parcelada.",
      };
    }

    if (Number.isNaN(installmentCount) || installmentCount < 2) {
      return {
        valid: false,
        message: "Escolha entre 2 e 24 parcelas para a simulação.",
      };
    }

    const selectedCard = cards.find((card) => card.id === installmentSimulationCardId) || null;
    const installmentValue = amount / installmentCount;
    const months: {
      key: string;
      label: string;
      existingImpact: number;
      newInstallmentImpact: number;
      totalImpact: number;
      projectedBalance: number;
      isCritical: boolean;
      isSelectedMonth: boolean;
    }[] = [];

    let runningBalance = projectedBalanceAfterInvoices;

    for (let index = 0; index < installmentCount; index += 1) {
      const simulatedDate = new Date(
        selectedMonthMeta.year,
        selectedMonthMeta.month - 1 + index,
        1
      );
      const key = `${simulatedDate.getFullYear()}-${String(
        simulatedDate.getMonth() + 1
      ).padStart(2, "0")}`;
      const label = simulatedDate.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });
      const existingMonth = futureInstallmentsByMonth.find((item) => item.key === key);
      const existingImpact = Number(existingMonth?.total || 0);
      const totalImpact = existingImpact + installmentValue;

      runningBalance -= totalImpact;

      months.push({
        key,
        label,
        existingImpact,
        newInstallmentImpact: installmentValue,
        totalImpact,
        projectedBalance: runningBalance,
        isCritical: runningBalance < 0,
        isSelectedMonth: index === 0,
      });
    }

    const firstCriticalMonth = months.find((item) => item.projectedBalance < 0) || null;
    const lowestMonth = months.reduce((lowest, current) =>
      current.projectedBalance < lowest.projectedBalance ? current : lowest
    );

    const limitUsagePercentage = selectedCard?.limit
      ? (amount / Number(selectedCard.limit || 0)) * 100
      : null;

    return {
      valid: true,
      amount,
      installmentCount,
      installmentValue,
      selectedCard,
      months,
      firstCriticalMonth,
      lowestMonth,
      limitUsagePercentage,
      message: firstCriticalMonth
        ? `Em ${firstCriticalMonth.label}, a projeção fica negativa com essa compra parcelada.`
        : `Essa compra parcelada cabe na sua projeção futura atual.`,
    };
  }, [
    cards,
    futureInstallmentsByMonth,
    installmentSimulationCardId,
    installmentSimulationCount,
    installmentSimulationValue,
    projectedBalanceAfterInvoices,
    selectedMonthMeta.month,
    selectedMonthMeta.year,
  ]);


  const bestCardComparison = useMemo(() => {
    const normalizedValue = installmentSimulationValue
      .replace(/\./g, "")
      .replace(",", ".")
      .trim();
    const amount = Number(normalizedValue);
    const installmentCount = Number(installmentSimulationCount);

    if (!normalizedValue || Number.isNaN(amount) || amount <= 0) {
      return null;
    }

    if (Number.isNaN(installmentCount) || installmentCount < 2) {
      return null;
    }

    const availableCards = cards.filter((card) => card.id);

    if (availableCards.length === 0) {
      return null;
    }

    const installmentValue = amount / installmentCount;

    const comparisons = availableCards.map((card) => {
      const months: {
        key: string;
        label: string;
        projectedBalance: number;
        totalImpact: number;
        newInstallmentImpact: number;
        isCritical: boolean;
      }[] = [];

      let runningBalance = projectedBalanceAfterInvoices;

      for (let index = 0; index < installmentCount; index += 1) {
        const simulatedDate = new Date(
          selectedMonthMeta.year,
          selectedMonthMeta.month - 1 + index,
          1
        );
        const key = `${simulatedDate.getFullYear()}-${String(
          simulatedDate.getMonth() + 1
        ).padStart(2, "0")}`;
        const label = simulatedDate.toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        });
        const existingMonth = futureInstallmentsByMonth.find((item) => item.key === key);
        const existingImpact = Number(existingMonth?.total || 0);
        const totalImpact = existingImpact + installmentValue;

        runningBalance -= totalImpact;

        months.push({
          key,
          label,
          projectedBalance: runningBalance,
          totalImpact,
          newInstallmentImpact: installmentValue,
          isCritical: runningBalance < 0,
        });
      }

      const lowestMonth = months.reduce((lowest, current) =>
        current.projectedBalance < lowest.projectedBalance ? current : lowest
      );

      const firstCriticalMonth = months.find((month) => month.isCritical) || null;
      const limitValue = Number(card.limit || 0);
      const limitUsagePercentage = limitValue > 0 ? (amount / limitValue) * 100 : null;
      const remainingLimit = limitValue > 0 ? limitValue - amount : null;

      let status: "best" | "attention" | "risk" = "best";
      let statusLabel = "Melhor opção";

      if (firstCriticalMonth || (limitUsagePercentage !== null && limitUsagePercentage > 100)) {
        status = "risk";
        statusLabel = "Risco";
      } else if (
        lowestMonth.projectedBalance < 2000 ||
        (limitUsagePercentage !== null && limitUsagePercentage >= 80)
      ) {
        status = "attention";
        statusLabel = "Atenção";
      }

      return {
        card,
        months,
        amount,
        installmentCount,
        installmentValue,
        lowestMonth,
        firstCriticalMonth,
        limitUsagePercentage,
        remainingLimit,
        status,
        statusLabel,
      };
    });

    const statusPriority = { best: 0, attention: 1, risk: 2 } as const;

    const ordered = [...comparisons].sort((a, b) => {
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }

      if (b.lowestMonth.projectedBalance !== a.lowestMonth.projectedBalance) {
        return b.lowestMonth.projectedBalance - a.lowestMonth.projectedBalance;
      }

      const aLimitUsage = a.limitUsagePercentage ?? Number.POSITIVE_INFINITY;
      const bLimitUsage = b.limitUsagePercentage ?? Number.POSITIVE_INFINITY;
      return aLimitUsage - bLimitUsage;
    });

    const bestOption = ordered[0] || null;

    return {
      amount,
      installmentCount,
      installmentValue,
      comparisons: ordered,
      bestOption,
    };
  }, [
    cards,
    futureInstallmentsByMonth,
    installmentSimulationCount,
    installmentSimulationValue,
    projectedBalanceAfterInvoices,
    selectedMonthMeta.month,
    selectedMonthMeta.year,
  ]);


  const purchaseRecommendation = useMemo(() => {
    if (!bestCardComparison || !bestCardComparison.bestOption) {
      return null;
    }

    const bestOption = bestCardComparison.bestOption;
    const installmentLabel = `${bestOption.installmentCount}x de ${formatCurrency(
      bestOption.installmentValue
    )}`;

    if (bestOption.status === "risk") {
      return {
        tone: "danger" as const,
        container: "border-rose-200 bg-rose-50",
        badge: "bg-rose-100 text-rose-700",
        title: "Compra não recomendada neste momento",
        summary: `Mesmo a melhor alternativa ainda pressiona demais sua projeção ou o limite do cartão.`,
        recommendation: `O cenário menos arriscado seria ${bestOption.card.name} em ${installmentLabel}, mas ele ainda merece cautela.`,
        bestCardName: bestOption.card.name,
        installmentLabel,
        lowestMonthLabel: bestOption.lowestMonth.label,
        lowestMonthBalance: bestOption.lowestMonth.projectedBalance,
        reason:
          bestOption.firstCriticalMonth
            ? `A projeção entra no negativo em ${bestOption.firstCriticalMonth.label}.`
            : bestOption.limitUsagePercentage !== null && bestOption.limitUsagePercentage > 100
            ? `O valor ultrapassa o limite informado do cartão.`
            : `O cenário ainda deixa pouca folga para os próximos meses.`,
      };
    }

    if (bestOption.status === "attention") {
      return {
        tone: "warning" as const,
        container: "border-amber-200 bg-amber-50",
        badge: "bg-amber-100 text-amber-700",
        title: "Compra possível, mas com atenção",
        summary: `A melhor combinação ainda reduz sua folga futura e merece acompanhamento.`,
        recommendation: `A opção mais equilibrada é ${bestOption.card.name} em ${installmentLabel}.`,
        bestCardName: bestOption.card.name,
        installmentLabel,
        lowestMonthLabel: bestOption.lowestMonth.label,
        lowestMonthBalance: bestOption.lowestMonth.projectedBalance,
        reason:
          bestOption.limitUsagePercentage !== null && bestOption.limitUsagePercentage >= 80
            ? `O uso do limite fica em ${bestOption.limitUsagePercentage.toFixed(1)}%.`
            : `O menor mês projetado fica em ${formatCurrency(bestOption.lowestMonth.projectedBalance)}.`,
      };
    }

    return {
      tone: "success" as const,
      container: "border-emerald-200 bg-emerald-50",
      badge: "bg-emerald-100 text-emerald-700",
      title: "Compra recomendada",
      summary: `Esse é o melhor cenário entre os cartões cadastrados para manter a projeção confortável.`,
      recommendation: `A melhor opção agora é ${bestOption.card.name} em ${installmentLabel}.`,
      bestCardName: bestOption.card.name,
      installmentLabel,
      lowestMonthLabel: bestOption.lowestMonth.label,
      lowestMonthBalance: bestOption.lowestMonth.projectedBalance,
      reason:
        bestOption.remainingLimit !== null
          ? `Depois da compra, ainda sobra ${formatCurrency(bestOption.remainingLimit)} no limite informado.`
          : `A menor projeção continua positiva em ${bestOption.lowestMonth.label}.`,
    };
  }, [bestCardComparison]);


  const purchaseRiskAlerts = useMemo(() => {
    if (!bestCardComparison?.bestOption || !purchaseRecommendation) {
      return [];
    }

    const bestOption = bestCardComparison.bestOption;
    const alerts: {
      id: string;
      tone: "danger" | "warning" | "success";
      title: string;
      message: string;
    }[] = [];

    if (bestOption.firstCriticalMonth) {
      alerts.push({
        id: "purchase-negative-month",
        tone: "danger",
        title: "Risco real detectado",
        message: `Essa compra pode deixar sua projeção negativa em ${bestOption.firstCriticalMonth.label}.`,
      });
    }

    if (
      bestOption.limitUsagePercentage !== null &&
      bestOption.limitUsagePercentage >= 90
    ) {
      alerts.push({
        id: "purchase-high-limit-usage",
        tone: "danger",
        title: "Limite do cartão muito pressionado",
        message: `O uso do limite ficará em ${bestOption.limitUsagePercentage.toFixed(
          1
        )}%, deixando pouca margem para imprevistos.`,
      });
    } else if (
      bestOption.limitUsagePercentage !== null &&
      bestOption.limitUsagePercentage >= 75
    ) {
      alerts.push({
        id: "purchase-attention-limit-usage",
        tone: "warning",
        title: "Atenção ao limite do cartão",
        message: `O uso do limite ficará em ${bestOption.limitUsagePercentage.toFixed(
          1
        )}%. Ainda cabe, mas já exige cuidado.`,
      });
    }

    if (
      bestOption.lowestMonth.projectedBalance >= 0 &&
      bestOption.lowestMonth.projectedBalance < 500
    ) {
      alerts.push({
        id: "purchase-low-buffer",
        tone: "warning",
        title: "Folga muito baixa",
        message: `Depois da compra, o menor mês projetado fica com apenas ${formatCurrency(
          bestOption.lowestMonth.projectedBalance
        )} de margem.`,
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        id: "purchase-safe",
        tone: "success",
        title: "Compra dentro da margem segura",
        message:
          purchaseRecommendation.reason ||
          "A compra continua dentro de uma faixa saudável para sua projeção atual.",
      });
    }

    return alerts.slice(0, 3);
  }, [bestCardComparison, purchaseRecommendation]);


  const economyModePlan = useMemo(() => {
    const lowestPoint = dailyProjectionSummary.lowestPoint;
    const projectedShortfall = lowestPoint && lowestPoint.balance < 0
      ? Math.abs(lowestPoint.balance)
      : 0;

    const categoriesOverGoal = goalSummary
      .filter((item) => item.exceeded)
      .sort((a, b) => Math.abs(b.remaining) - Math.abs(a.remaining));

    const topReductionCategories = categoriesOverGoal.slice(0, 3).map((item) => ({
      category: item.category,
      exceededBy: Math.abs(item.remaining),
      spent: item.spent,
      goal: item.goal,
    }));

    const totalSuggestedCategoryReduction = topReductionCategories.reduce(
      (sum, item) => sum + item.exceededBy,
      0
    );

    const daysRemaining = Math.max(1, spendingCapacitySummary.daysRemaining);
    const reductionNeededThisMonth = projectedShortfall > 0
      ? projectedShortfall
      : spendingCapacitySummary.extraSafeSpend < 500
      ? Math.max(0, 500 - spendingCapacitySummary.extraSafeSpend)
      : 0;

    const reductionPerDay = reductionNeededThisMonth / daysRemaining;

    const shouldActivate =
      projectedShortfall > 0 ||
      (spendingCapacitySummary.extraSafeSpend >= 0 &&
        spendingCapacitySummary.extraSafeSpend < 500) ||
      topReductionCategories.length > 0;

    const statusTone =
      projectedShortfall > 0
        ? "danger"
        : reductionNeededThisMonth > 0 || topReductionCategories.length > 0
        ? "warning"
        : "success";

    const headline =
      projectedShortfall > 0
        ? "Modo economia ativado"
        : reductionNeededThisMonth > 0
        ? "Plano de ajuste do mês"
        : "Mês sob controle";

    const summary =
      projectedShortfall > 0
        ? `Para evitar saldo negativo, você precisa reduzir aproximadamente ${formatCurrency(
            reductionNeededThisMonth
          )} ao longo deste mês.`
        : reductionNeededThisMonth > 0
        ? `Sua folga está baixa. Cortar cerca de ${formatCurrency(
            reductionNeededThisMonth
          )} no mês ajuda a manter uma margem mais segura.`
        : "No cenário atual, você não precisa entrar em modo economia. Sua projeção está saudável.";

    return {
      shouldActivate,
      statusTone,
      headline,
      summary,
      projectedShortfall,
      reductionNeededThisMonth,
      reductionPerDay,
      daysRemaining,
      topReductionCategories,
      totalSuggestedCategoryReduction,
    };
  }, [
    dailyProjectionSummary.lowestPoint,
    goalSummary,
    spendingCapacitySummary.daysRemaining,
    spendingCapacitySummary.extraSafeSpend,
  ]);

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
          )}. Ã‰ o mês com menor folga no seu planejamento.`,
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



  function clearRecurringForm() {
    setEditingRecurringId(null);
    setRecurringTitle("");
    setRecurringAmount("");
    setRecurringType("expense");
    setRecurringCategory("Alimentação");
    setRecurringPaymentMethod("pix");
    setRecurringAccountId("");
    setRecurringCardId("");
    setRecurringDayOfMonth("10");
  }

  function startEditingRecurring(item: RecurringTransaction) {
    setEditingRecurringId(item.id);
    setRecurringTitle(item.title || "");
    setRecurringAmount(String(Number(item.amount || 0)));
    setRecurringType(isIncomeType(item.type) ? "income" : "expense");
    setRecurringCategory(
      item.category ||
        (isIncomeType(item.type) ? "Salário" : "Alimentação")
    );
    setRecurringPaymentMethod((item.paymentMethod as PaymentMethod) || "pix");
    setRecurringAccountId(item.accountId || "");
    setRecurringCardId(item.cardId || "");
    setRecurringDayOfMonth(String(item.dayOfMonth || 10));
    showToast("Modo de edição", "Agora você pode alterar a recorrência selecionada.", "info");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }


  async function handleCreateRecurring() {
    try {
      setRecurringSubmitting(true);
      setToast((current) => ({ ...current, visible: false }));

      const numericAmount = Number(recurringAmount.replace(",", "."));

      if (!recurringTitle.trim()) {
        throw new Error("Informe um título para a recorrência.");
      }

      if (Number.isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error("Informe um valor válido para a recorrência.");
      }

      const dayOfMonth = Number(recurringDayOfMonth);

      if (Number.isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
        throw new Error("Informe um dia do mês entre 1 e 31.");
      }

      if (
        recurringPaymentMethod !== "credit_card" &&
        recurringPaymentMethod !== "voucher" &&
        !recurringAccountId
      ) {
        throw new Error("Selecione uma conta para a recorrência.");
      }

      if (recurringPaymentMethod === "credit_card" && !recurringCardId) {
        throw new Error("Selecione um cartão para a recorrência.");
      }

      const payload = {
        title: recurringTitle.trim(),
        amount: numericAmount,
        type: recurringType,
        category: recurringCategory || "Outros",
        paymentMethod: recurringPaymentMethod || null,
        accountId:
          recurringPaymentMethod === "credit_card" || recurringPaymentMethod === "voucher"
            ? null
            : recurringAccountId || null,
        cardId: recurringPaymentMethod === "credit_card" ? recurringCardId || null : null,
        dayOfMonth,
      };

      const response = await fetch(
        editingRecurringId ? `/api/recurring/${editingRecurringId}` : "/api/recurring",
        {
          method: editingRecurringId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Não foi possível ${editingRecurringId ? "editar" : "criar"} a recorrência.`
        );
      }

      clearRecurringForm();
      showToast(
        editingRecurringId ? "Recorrência atualizada" : "Recorrência criada",
        editingRecurringId
          ? "As alterações da recorrência foram salvas com sucesso."
          : "A nova recorrência foi cadastrada com sucesso.",
        "success"
      );

      await loadDashboardData();
    } catch (error) {
      showToast(
        "Erro ao salvar recorrência",
        error instanceof Error ? error.message : "Tente novamente.",
        "error"
      );
    } finally {
      setRecurringSubmitting(false);
    }
  }

  async function handleGenerateRecurring() {
    try {
      setRecurringGenerateLoading(true);
      setToast((current) => ({ ...current, visible: false }));

      const response = await fetch("/api/recurring/generate", {
        method: "POST",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível gerar as recorrências.");
      }

      const createdCount = Number(data?.created || 0);
      showToast(
        createdCount > 0 ? "Recorrências geradas" : "Nenhuma nova recorrência",
        createdCount > 0
          ? `Total criado: ${createdCount}.`
          : data?.message || "Não havia novas recorrências para gerar neste mês.",
        createdCount > 0 ? "success" : "info"
      );
      await loadDashboardData();
    } catch (error) {
      showToast(
        "Erro ao gerar recorrências",
        error instanceof Error ? error.message : "Tente novamente.",
        "error"
      );
    } finally {
      setRecurringGenerateLoading(false);
    }
  }


  async function handleToggleRecurring(id: string, nextActive: boolean) {
    try {
      setRecurringActionId(id);
      setToast((current) => ({ ...current, visible: false }));

      const response = await fetch(`/api/recurring/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          active: nextActive,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Não foi possível ${nextActive ? "ativar" : "pausar"} a recorrência.`
        );
      }

      showToast(
        nextActive ? "Recorrência ativada" : "Recorrência pausada",
        nextActive
          ? "A recorrência voltou a ficar ativa."
          : "A recorrência foi pausada com sucesso.",
        "success"
      );
      await loadDashboardData();
    } catch (error) {
      showToast(
        "Erro ao atualizar recorrência",
        error instanceof Error ? error.message : "Tente novamente.",
        "error"
      );
    } finally {
      setRecurringActionId(null);
    }
  }

  function handleDeleteRecurring(id: string, title: string) {
    setDeleteConfirm({
      open: true,
      id,
      title,
    });
  }

  function closeDeleteConfirm() {
    setDeleteConfirm({
      open: false,
      id: null,
      title: "",
    });
  }

  async function confirmDeleteRecurring() {
    if (!deleteConfirm.id) return;

    try {
      setRecurringActionId(deleteConfirm.id);
      setToast((current) => ({ ...current, visible: false }));

      const response = await fetch(`/api/recurring/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível excluir a recorrência.");
      }

      closeDeleteConfirm();
      showToast("Recorrência excluída", "A recorrência foi removida com sucesso.", "success");
      await loadDashboardData();
    } catch (error) {
      showToast(
        "Erro ao excluir recorrência",
        error instanceof Error ? error.message : "Tente novamente.",
        "error"
      );
    } finally {
      setRecurringActionId(null);
    }
  }

  async function handleSaveSimulationHistory() {
    if (!purchaseRecommendation || !bestCardComparison?.bestOption) {
      showToast(
        "Nada para salvar",
        "Faça uma simulação parcelada válida antes de salvar a decisão.",
        "info"
      );
      return;
    }

    try {
      setSimulationHistorySaving(true);

      const bestOption = bestCardComparison.bestOption;
      const payload = {
        title: `Compra simulada  . ${bestOption.installmentCount}x`,
        purchaseType: "installment",
        totalAmount: bestCardComparison.amount,
        installmentCount: bestOption.installmentCount,
        installmentAmount: bestOption.installmentValue,
        recommendedCardName: purchaseRecommendation.bestCardName,
        recommendationStatus:
          purchaseRecommendation.tone === "success"
            ? "success"
            : purchaseRecommendation.tone === "warning"
            ? "warning"
            : "danger",
        recommendationTitle: purchaseRecommendation.title,
        recommendationReason: purchaseRecommendation.reason,
        lowestProjectedMonthLabel: purchaseRecommendation.lowestMonthLabel,
        lowestProjectedBalance: purchaseRecommendation.lowestMonthBalance,
        limitUsagePercent: bestOption.limitUsagePercentage,
        remainingLimitAfterPurchase: bestOption.remainingLimit,
        selectedMonth,
      };

      const response = await fetch("/api/simulation-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível salvar a simulação.");
      }

      showToast(
        "Simulação salva",
        "A decisão foi adicionada ao histórico com sucesso.",
        "success"
      );
      await loadDashboardData();
    } catch (error) {
      showToast(
        "Erro ao salvar histórico",
        error instanceof Error ? error.message : "Tente novamente.",
        "error"
      );
    } finally {
      setSimulationHistorySaving(false);
    }
  }

  async function handleDeleteSimulationHistory(id: string) {
    try {
      setSimulationHistoryDeletingId(id);

      const response = await fetch(`/api/simulation-history/${id}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível excluir o histórico.");
      }

      showToast(
        "Histórico excluído",
        "A simulação foi removida com sucesso.",
        "success"
      );
      await loadDashboardData();
    } catch (error) {
      showToast(
        "Erro ao excluir histórico",
        error instanceof Error ? error.message : "Tente novamente.",
        "error"
      );
    } finally {
      setSimulationHistoryDeletingId(null);
    }
  }


  async function handleApplySimulationHistory(item: SimulationHistoryItem) {
    try {
      setSimulationHistoryApplyingId(item.id);

      const matchedCard = cards.find(
        (card) =>
          (card.name || "").trim().toLowerCase() ===
          (item.recommendedCardName || "").trim().toLowerCase()
      );

      if (!matchedCard?.id) {
        throw new Error("Não encontrei o cartão recomendado para transformar a simulação em compra real.");
      }

      const installmentCount = Math.max(Number(item.installmentCount || 1), 1);
      const installmentAmount =
        installmentCount > 1
          ? Number(item.installmentAmount || 0)
          : Number(item.totalAmount || 0);

      if (Number.isNaN(installmentAmount) || installmentAmount <= 0) {
        throw new Error("O valor da parcela da simulação está inválido.");
      }

      const baseMonthValue = item.selectedMonth || selectedMonth;
      const { year, month } = parseMonthInput(baseMonthValue);
      const purchaseGroupId = `simulation-${item.id}-${Date.now()}`;
      const baseTitle =
        item.title && item.title.trim() !== ""
          ? item.title.replace(/^Compra simulada\s* .\s*/i, "Compra parcelada ")
          : "Compra parcelada convertida";

      for (let index = 0; index < installmentCount; index += 1) {
        const installmentDate = new Date(year, month - 1 + index, 10, 12, 0, 0);
        const payload = {
          title:
            installmentCount > 1
              ? `${baseTitle} (${index + 1}/${installmentCount})`
              : baseTitle,
          amount: installmentAmount,
          type: "expense",
          category: "Outros",
          paymentMethod: "credit_card",
          cardId: matchedCard.id,
          date: installmentDate.toISOString(),
          installmentNumber: installmentCount > 1 ? index + 1 : 1,
          installmentTotal: installmentCount,
          purchaseGroupId,
        };

        const response = await fetch("/api/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.error ||
              `Não foi possível criar a parcela ${index + 1} da compra.`
          );
        }
      }

      await fetch(`/api/simulation-history/${item.id}`, {
        method: "DELETE",
      }).catch(() => null);

      showToast(
        "Compra criada",
        installmentCount > 1
          ? `A simulação foi transformada em ${installmentCount} parcela(s) reais no cartão ${matchedCard.name}.`
          : `A simulação foi transformada em uma compra real no cartão ${matchedCard.name}.`,
        "success"
      );

      await loadDashboardData();
    } catch (error) {
      showToast(
        "Erro ao transformar compra",
        error instanceof Error ? error.message : "Tente novamente.",
        "error"
      );
    } finally {
      setSimulationHistoryApplyingId(null);
    }
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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-3 md:p-8">
      {toast.visible ? (
        <div className="pointer-events-none fixed right-4 top-4 z-50 w-full max-w-sm">
          <div
            className={`pointer-events-auto rounded-[22px] border p-4 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur ${getToastStyles(toast.tone).container}`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold ${getToastStyles(toast.tone).title}`}>
                  {toast.title}
                </p>
                <p className={`mt-1 text-sm leading-6 ${getToastStyles(toast.tone).text}`}>
                  {toast.message}
                </p>
              </div>

              <button
  type="button"
  onClick={() => {
    setToast((current) => ({
      ...current,
      visible: false,
    }));
  }}
  className={`rounded-lg px-2 py-1 text-sm font-semibold transition ${getToastStyles(toast.tone).button}`}
>
  Fechar
</button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirm.open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-xl font-bold tracking-tight text-slate-900">Confirmar exclusão</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Deseja realmente excluir a recorrência <span className="font-semibold text-slate-900">{deleteConfirm.title}</span>? Essa ação não pode ser desfeita.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={recurringActionId === deleteConfirm.id}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmDeleteRecurring}
                disabled={recurringActionId === deleteConfirm.id}
                className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {recurringActionId === deleteConfirm.id ? "Excluindo..." : "Excluir recorrência"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl space-y-6 md:space-y-7">
        <header className="flex flex-col gap-4 rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
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
    className="rounded-[18px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:opacity-95 active:translate-y-0"
  >
    Ver transações
  </Link>

  <Link
    href="/accounts"
    className="rounded-[18px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md active:translate-y-0"
  >
    Ver contas
  </Link>

  <Link
    href="/invoices"
    className="rounded-[18px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md active:translate-y-0"
  >
    Ver faturas
  </Link>

  <LogoutButton />
</div>

          <div className="flex flex-col gap-2 md:max-w-xs">
            <label className="text-sm font-medium text-slate-700">
              Filtrar por mês
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
          </div>
        </div>
      </header>

        <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Recorrências
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Cadastre e gere recorrências sem esforço.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerateRecurring}
              disabled={recurringGenerateLoading}
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {recurringGenerateLoading ? "Gerando..." : "Gerar recorrências do mês"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
            <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/40 p-4 md:p-5">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">
                {editingRecurringId ? "Editar recorrência" : "Nova recorrência"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {editingRecurringId
                  ? "Atualize os dados da recorrência selecionada."
                  : "Exemplo: salário, aluguel, academia, internet ou assinatura."}
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Título
                  </label>
                  <input
                    type="text"
                    value={recurringTitle}
                    onChange={(e) => setRecurringTitle(e.target.value)}
                    placeholder="Ex: Academia, Aluguel, Salário"
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Valor
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={recurringAmount}
                    onChange={(e) => setRecurringAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Tipo
                    </label>
                    <select
                      value={recurringType}
                      onChange={(e) =>
                        setRecurringType(e.target.value as "income" | "expense")
                      }
                      className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    >
                      <option value="expense">Saída</option>
                      <option value="income">Entrada</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Dia do mês
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={recurringDayOfMonth}
                      onChange={(e) => setRecurringDayOfMonth(e.target.value)}
                      className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Categoria
                  </label>
                  <select
                    value={recurringCategory}
                    onChange={(e) => setRecurringCategory(e.target.value)}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  >
                    {recurringCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Forma de pagamento
                  </label>
                  <select
                    value={recurringPaymentMethod}
                    onChange={(e) =>
                      setRecurringPaymentMethod(e.target.value as PaymentMethod)
                    }
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  >
                    <option value="">Selecione</option>
                    {recurringType === "expense" ? (
                      <option value="credit_card">💳 Cartão de crédito</option>
                    ) : null}
                    <option value="pix">💸 Pix</option>
                    <option value="debit_card">💳 Cartão de débito</option>
                    <option value="cash">💵 Dinheiro</option>
                    <option value="bank_transfer">🏦 Transferência</option>
                    <option value="boleto">🧾 Boleto</option>
                    <option value="voucher">🍽️ Vale alimentação</option>
                  </select>
                </div>

                {recurringPaymentMethod === "credit_card" ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Cartão
                    </label>
                    <select
                      value={recurringCardId}
                      onChange={(e) => setRecurringCardId(e.target.value)}
                      className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    >
                      <option value="">Selecione um cartão</option>
                      {cards.map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : recurringPaymentMethod !== "voucher" ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Conta
                    </label>
                    <select
                      value={recurringAccountId}
                      onChange={(e) => setRecurringAccountId(e.target.value)}
                      className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    >
                      <option value="">Selecione uma conta</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Lançamentos com vale alimentação não usam conta bancária.
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCreateRecurring}
                    disabled={recurringSubmitting}
                    className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {recurringSubmitting
                      ? "Salvando..."
                      : editingRecurringId
                      ? "Salvar alterações"
                      : "Salvar recorrência"}
                  </button>

                  {editingRecurringId ? (
                    <button
                      type="button"
                      onClick={clearRecurringForm}
                      disabled={recurringSubmitting}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/40 p-4 md:p-5">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">
                Recorrências cadastradas
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Tudo que já está automatizado.
              </p>

              {recurrings.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                  Nenhuma recorrência cadastrada ainda.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {recurrings.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[22px] border border-slate-200/70 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate text-base font-bold text-slate-900">
                              {item.title}
                            </h4>

                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                isIncomeType(item.type)
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {isIncomeType(item.type) ? "Entrada" : "Saída"}
                            </span>

                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                item.active
                                  ? "bg-sky-100 text-sky-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {item.active ? "Ativa" : "Inativa"}
                            </span>
                          </div>

                          <div className="mt-2 space-y-1 text-sm text-slate-500">
                            <p>Categoria: {getCategoryLabel(item.category)}</p>
                            <p>
                              Pagamento: {getPaymentMethodLabel(item.paymentMethod)}
                            </p>
                            {item.account?.name ? <p>Conta: {item.account.name}</p> : null}
                            {item.card?.name ? <p>Cartão: {item.card.name}</p> : null}
                            <p>Dia do mês: {item.dayOfMonth}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-3 md:items-end">
                          <p
                            className={`text-lg font-bold ${
                              isIncomeType(item.type)
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {isIncomeType(item.type) ? "+ " : "- "}
                            {formatCurrency(Number(item.amount || 0))}
                          </p>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEditingRecurring(item)}
                              disabled={recurringActionId === item.id || recurringSubmitting}
                              className="rounded-xl border border-sky-200 px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleRecurring(item.id, !item.active)}
                              disabled={recurringActionId === item.id || editingRecurringId === item.id}
                              className={`rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                item.active
                                  ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              }`}
                            >
                              {recurringActionId === item.id
                                ? "Salvando..."
                                : item.active
                                ? "Pausar"
                                : "Ativar"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteRecurring(item.id, item.title)}
                              disabled={recurringActionId === item.id || editingRecurringId === item.id}
                              className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {recurringActionId === item.id ? "Processando..." : "Excluir"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Previsão de saldo mensal
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                {formatCurrency(monthlyProjectedBalance)}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Leitura rápida do cenário do mês filtrado.
              </p>
            </div>

            <div className="rounded-[20px] border border-slate-200/70 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-600 shadow-sm">
              <p>
                {monthlyRecurringProjection.pendingIncomeItems.length} entrada(s) recorrente(s) pendente(s)
              </p>
              <p>
                {monthlyRecurringProjection.pendingExpenseItems.length} saída(s) recorrente(s) pendente(s)
              </p>
              <p>
                {selectedMonthOpenInvoices.length} fatura(s) aberta(s) em {formatMonthYear(selectedDate)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-[22px] border border-slate-200/70 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
              <p className="text-sm font-medium text-slate-500">Saldo atual</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatCurrency(currentAccountsBalance)}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-700">
                Entradas recorrentes previstas
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                {formatCurrency(monthlyRecurringProjection.incomesTotal)}
              </p>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-medium text-rose-700">
                Saídas recorrentes previstas
              </p>
              <p className="mt-2 text-2xl font-bold text-rose-700">
                {formatCurrency(monthlyRecurringProjection.expensesTotal)}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-700">Faturas abertas do mês</p>
              <p className="mt-2 text-2xl font-bold text-amber-700">
                {formatCurrency(selectedMonthOpenInvoicesTotal)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4">
              <p className="text-sm font-medium text-slate-300">
                Saldo projetado do mês
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  monthlyProjectedBalance >= 0 ? "text-white" : "text-rose-300"
                }`}
              >
                {formatCurrency(monthlyProjectedBalance)}
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
            <p className="text-sm font-medium text-slate-500">
              Entradas no período
            </p>
            <h2 className="mt-2 text-2xl font-bold text-emerald-600">
              {formatCurrency(totalIncomes)}
            </h2>
          </div>

          <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
            <p className="text-sm font-medium text-slate-500">
              Saídas no período
            </p>
            <h2 className="mt-2 text-2xl font-bold text-rose-600">
              {formatCurrency(totalExpenses)}
            </h2>
          </div>

          <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
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

          <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
            <p className="text-sm font-medium text-slate-500">
              Saldo atual em contas
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              {formatCurrency(currentAccountsBalance)}
            </h2>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
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

          <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
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

          <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
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

          <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
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

        <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold text-slate-900">
            Leitura rápida do futuro
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {futureBalanceAlert}
          </p>
        </section>

        <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-900">
                Evolução diária do saldo
              </h3>
              <p className="text-sm text-slate-400">
                Leitura diária da sua projeção.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Menor saldo
                </p>
                <p
                  className={`mt-1 text-lg font-bold ${
                    (dailyProjectionSummary.lowestPoint?.balance ?? 0) >= 0
                      ? "text-sky-600"
                      : "text-rose-600"
                  }`}
                >
                  {formatCurrency(dailyProjectionSummary.lowestPoint?.balance ?? 0)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {dailyProjectionSummary.lowestPoint
                    ? `No dia ${dailyProjectionSummary.lowestPoint.day}`
                    : "Sem dados"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Maior saldo
                </p>
                <p className="mt-1 text-lg font-bold text-emerald-600">
                  {formatCurrency(dailyProjectionSummary.highestPoint?.balance ?? 0)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {dailyProjectionSummary.highestPoint
                    ? `No dia ${dailyProjectionSummary.highestPoint.day}`
                    : "Sem dados"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Dias negativos
                </p>
                <p
                  className={`mt-1 text-lg font-bold ${
                    dailyProjectionSummary.negativeDays > 0
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }`}
                >
                  {dailyProjectionSummary.negativeDays}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {dailyProjectionSummary.negativeDays > 0
                    ? "O mês exige atenção"
                    : "Sem saldo negativo"}
                </p>
              </div>
            </div>
          </div>

          <div className="h-[340px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyBalanceProjection} margin={{ top: 10, right: 12, left: 12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(value) =>
                    Number(value).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      maximumFractionDigits: 0,
                    })
                  }
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip content={<CustomDailyBalanceTooltip />} />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke={dailyBalanceProjection.some((item) => item.balance < 0) ? "#ef4444" : "#2563eb"}
                  strokeWidth={3}
                  dot={({ cx, cy, payload }: any) => {
                    if (payload?.isWorst) {
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill="#f59e0b"
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      );
                    }

                    return null;
                  }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            {dailyProjectionSummary.negativeDays > 0
              ? `Seu saldo fica negativo em ${dailyProjectionSummary.negativeDays} dia(s) do mês. O ponto mais baixo acontece no dia ${dailyProjectionSummary.lowestPoint?.day}, com ${formatCurrency(dailyProjectionSummary.lowestPoint?.balance ?? 0)}.`
              : `Sua projeção diária permanece positiva no mês inteiro. O menor saldo previsto acontece no dia ${dailyProjectionSummary.lowestPoint?.day}, com ${formatCurrency(dailyProjectionSummary.lowestPoint?.balance ?? 0)}.`}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                Quanto ainda pode gastar
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                {formatCurrency(spendingCapacitySummary.extraSafeSpend)}
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                {spendingCapacitySummary.isNegativeScenario
                  ? "Seu cenário já fica negativo em algum momento. O ideal é evitar novos gastos neste mês."
                  : `Esse é o valor máximo de gasto extra para você ainda terminar todos os dias projetados sem ficar negativo.`}
              </p>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-sky-700">
                Média segura por dia
              </p>
              <p className="mt-1 text-2xl font-bold text-sky-700">
                {formatCurrency(spendingCapacitySummary.safeDailySpend)}
              </p>
              <p className="mt-2 text-sm leading-6 text-sky-800">
                {spendingCapacitySummary.isCurrentSelectedMonth
                  ? `Considerando ${spendingCapacitySummary.daysRemaining} dia(s) restantes a partir de hoje.`
                  : `Considerando ${spendingCapacitySummary.daysRemaining} dia(s) do mês filtrado.`}
              </p>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                Folga mínima preservada
              </p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  spendingCapacitySummary.isNegativeScenario
                    ? "text-rose-600"
                    : "text-violet-700"
                }`}
              >
                {formatCurrency(
                  spendingCapacitySummary.lowestFutureBalance?.balance ?? 0
                )}
              </p>
              <p className="mt-2 text-sm leading-6 text-violet-800">
                {spendingCapacitySummary.lowestFutureBalance
                  ? `O menor saldo da projeção acontece no dia ${spendingCapacitySummary.lowestFutureBalance.day}.`
                  : "Sem dados suficientes para calcular a folga mínima."}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-600">
            {spendingCapacitySummary.isNegativeScenario
              ? `Hoje não existe margem segura para novos gastos extras em ${formatMonthYear(selectedDate)}. O ideal é reduzir despesas ou reforçar entradas para recuperar a folga do mês.`
              : `Pela sua projeção atual, você pode gastar até ${formatCurrency(
                  spendingCapacitySummary.extraSafeSpend
                )} a mais em ${formatMonthYear(selectedDate)} sem deixar o saldo diário ficar negativo. Isso equivale a uma média segura de ${formatCurrency(
                  spendingCapacitySummary.safeDailySpend
                )} por dia no período considerado.`}
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
            <div className="mb-4">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">Simular uma compra</h3>
              <p className="text-sm text-slate-400">
                Digite um valor e veja na hora se essa compra ainda cabe na sua projeção do mês.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-slate-700">Valor da compra</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={simulationValue}
                  onChange={(e) => setSimulationValue(e.target.value)}
                  placeholder="Ex: 300"
                  className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                />
              </div>

              <div className="md:w-[280px]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Margem segura atual</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {formatCurrency(spendingCapacitySummary.extraSafeSpend)}
                  </p>
                </div>
              </div>
            </div>

            {purchaseSimulation ? (
              <div
                className={`mt-4 rounded-2xl border px-4 py-4 ${
                  purchaseSimulation.canSpend
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-rose-200 bg-rose-50"
                }`}
              >
                <p
                  className={`text-sm font-semibold ${
                    purchaseSimulation.canSpend ? "text-emerald-900" : "text-rose-900"
                  }`}
                >
                  {purchaseSimulation.canSpend ? "Compra viável" : "Compra com risco"}
                </p>
                <p
                  className={`mt-1 text-sm leading-6 ${
                    purchaseSimulation.canSpend ? "text-emerald-800" : "text-rose-800"
                  }`}
                >
                  {purchaseSimulation.message}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white/80 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Menor saldo após a compra</p>
                    <p
                      className={`mt-1 text-lg font-bold ${
                        purchaseSimulation.lowestSimulatedBalance >= 0 ? "text-slate-900" : "text-rose-600"
                      }`}
                    >
                      {formatCurrency(purchaseSimulation.lowestSimulatedBalance)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/80 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Margem que sobra depois</p>
                    <p
                      className={`mt-1 text-lg font-bold ${
                        purchaseSimulation.remainingMargin >= 0 ? "text-slate-900" : "text-rose-600"
                      }`}
                    >
                      {formatCurrency(purchaseSimulation.remainingMargin)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Digite um valor para testar se a compra cabe no mês sem deixar o saldo diário ficar negativo.
              </div>
            )}
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
            <div className="mb-4">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">Simular compra parcelada</h3>
              <p className="text-sm text-slate-400">
                Simule parcelamento e veja o impacto futuro.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.9fr_0.9fr]">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Valor total da compra</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={installmentSimulationValue}
                  onChange={(e) => setInstallmentSimulationValue(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Parcelas</label>
                <select
                  value={installmentSimulationCount}
                  onChange={(e) => setInstallmentSimulationCount(e.target.value)}
                  className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                >
                  {Array.from({ length: 23 }, (_, index) => index + 2).map((value) => (
                    <option key={value} value={String(value)}>
                      {value}x
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Cartão</label>
                <select
                  value={installmentSimulationCardId}
                  onChange={(e) => setInstallmentSimulationCardId(e.target.value)}
                  className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 outline-none transition duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                >
                  <option value="">Selecione um cartão</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>


            {installmentPurchaseSimulation ? (
              <>
                {installmentPurchaseSimulation.valid ? (
                  <div
                    className={`mt-4 rounded-[28px] border p-4 shadow-sm ring-1 ring-white/60 ${
                      installmentPurchaseSimulation.firstCriticalMonth
                        ? "border-rose-200 bg-rose-50"
                        : "border-emerald-200 bg-emerald-50"
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p
                          className={`text-base font-bold ${
                            installmentPurchaseSimulation.firstCriticalMonth
                              ? "text-rose-700"
                              : "text-emerald-700"
                          }`}
                        >
                          {installmentPurchaseSimulation.firstCriticalMonth
                            ? "Compra parcelada com risco"
                            : "Compra parcelada viável"}
                        </p>
                        <p
                          className={`mt-1 text-sm leading-6 ${
                            installmentPurchaseSimulation.firstCriticalMonth
                              ? "text-rose-700"
                              : "text-emerald-700"
                          }`}
                        >
                          {installmentPurchaseSimulation.message}
                        </p>
                      </div>

                      <div className="rounded-[22px] bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
                        <p>
                          Parcela estimada:{" "}
                          <span className="font-bold text-slate-900">
                            {formatCurrency(installmentPurchaseSimulation.installmentValue)}
                          </span>
                        </p>
                        <p>
                          Total:{" "}
                          <span className="font-bold text-slate-900">
                            {formatCurrency(installmentPurchaseSimulation.amount)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-[22px] bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Menor mês projetado
                        </p>
                        <p
                          className={`mt-2 text-2xl font-bold ${
                            installmentPurchaseSimulation.lowestMonth.projectedBalance < 0
                              ? "text-rose-600"
                              : "text-slate-900"
                          }`}
                        >
                          {formatCurrency(
                            installmentPurchaseSimulation.lowestMonth.projectedBalance
                          )}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 capitalize">
                          {installmentPurchaseSimulation.lowestMonth.label}
                        </p>
                      </div>

                      <div className="rounded-[22px] bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Impacto por parcela
                        </p>
                        <p className="mt-2 text-2xl font-bold text-fuchsia-600">
                          {formatCurrency(installmentPurchaseSimulation.installmentValue)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {installmentPurchaseSimulation.installmentCount} mês(es) seguidos
                        </p>
                      </div>

                      <div className="rounded-[22px] bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Uso do limite informado
                        </p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">
                          {installmentPurchaseSimulation.limitUsagePercentage !== null
                            ? `${installmentPurchaseSimulation.limitUsagePercentage.toFixed(1)}%`
                            : "--"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {installmentPurchaseSimulation.selectedCard?.limit
                            ? `Com base no limite de ${formatCurrency(
                                Number(installmentPurchaseSimulation.selectedCard.limit || 0)
                              )}`
                            : installmentPurchaseSimulation.selectedCard
                            ? "Este cartão não tem limite informado"
                            : "Selecione um cartão para comparar"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <p className="text-sm text-slate-600">
                        Salve esta decisão para consultar depois no histórico de simulações.
                      </p>

                      <button
                        type="button"
                        onClick={handleSaveSimulationHistory}
                        disabled={simulationHistorySaving}
                        className="rounded-[20px] bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:opacity-95 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {simulationHistorySaving
                          ? "Salvando..."
                          : "Salvar decisão no histórico"}
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {installmentPurchaseSimulation.months.map((month) => (
                        <div
                          key={month.key}
                          className={`rounded-2xl border px-4 py-3 ${
                            month.isCritical
                              ? "border-rose-200 bg-white"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-semibold capitalize text-slate-900">
                                {month.label}
                              </p>
                              <p className="text-sm text-slate-400">
                                {month.isSelectedMonth
                                  ? "Primeira parcela no mês filtrado"
                                  : "Mês futuro impactado pela compra"}
                              </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="rounded-[18px] bg-slate-50 px-3 py-3 text-right shadow-sm">
                                <p className="text-xs text-slate-500">Parcela nova</p>
                                <p className="font-bold text-fuchsia-600">
                                  {formatCurrency(month.newInstallmentImpact)}
                                </p>
                              </div>

                              <div className="rounded-[18px] bg-slate-50 px-3 py-3 text-right shadow-sm">
                                <p className="text-xs text-slate-500">Impacto total</p>
                                <p className="font-bold text-slate-900">
                                  {formatCurrency(month.totalImpact)}
                                </p>
                              </div>

                              <div className="rounded-[18px] bg-slate-50 px-3 py-3 text-right shadow-sm">
                                <p className="text-xs text-slate-500">Saldo projetado</p>
                                <p
                                  className={`font-bold ${
                                    month.projectedBalance < 0
                                      ? "text-rose-600"
                                      : "text-sky-600"
                                  }`}
                                >
                                  {formatCurrency(month.projectedBalance)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {installmentPurchaseSimulation.message}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-600 shadow-sm">
                Preencha o valor, a quantidade de parcelas e, se quiser, o cartão para simular o impacto da compra.
              </div>
            )}

            {purchaseRecommendation ? (
              <div className={`mt-4 rounded-[28px] border p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] ring-1 ring-white/70 transition duration-200 hover:shadow-[0_22px_50px_rgba(15,23,42,0.10)] ${purchaseRecommendation.container}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold tracking-tight text-slate-900">
                        {purchaseRecommendation.title}
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${purchaseRecommendation.badge}`}
                      >
                        Decisão automática
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      {purchaseRecommendation.summary}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {purchaseRecommendation.recommendation}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {purchaseRecommendation.reason}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white/80 px-4 py-3 text-right">
                      <p className="text-xs text-slate-500">Melhor cartão</p>
                      <p className="text-xl font-bold tracking-tight text-slate-900">
                        {purchaseRecommendation.bestCardName}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/80 px-4 py-3 text-right">
                      <p className="text-xs text-slate-500">Melhor parcelamento</p>
                      <p className="text-xl font-bold tracking-tight text-slate-900">
                        {purchaseRecommendation.installmentLabel}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/80 px-4 py-3 text-right">
                      <p className="text-xs text-slate-500">Menor mês projetado</p>
                      <p className="text-xl font-bold tracking-tight text-slate-900">
                        {formatCurrency(purchaseRecommendation.lowestMonthBalance)}
                      </p>
                      <p className="text-xs capitalize text-slate-500">
                        {purchaseRecommendation.lowestMonthLabel}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

          {bestCardComparison ? (
            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-slate-900">Comparar melhor cartão</h3>
                  <p className="text-sm text-slate-400">
                    Comparação automática entre seus cartões.
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <p className="font-semibold">
                    Melhor opção: {bestCardComparison.bestOption?.card.name || "--"}
                  </p>
                  <p>
                    Parcela estimada: {formatCurrency(bestCardComparison.installmentValue)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {bestCardComparison.comparisons.map((option, index) => {
                  const toneStyles =
                    option.status === "risk"
                      ? {
                          container: "border-rose-200 bg-rose-50",
                          badge: "bg-rose-100 text-rose-700",
                          value: "text-rose-600",
                        }
                      : option.status === "attention"
                      ? {
                          container: "border-amber-200 bg-amber-50",
                          badge: "bg-amber-100 text-amber-700",
                          value: "text-amber-600",
                        }
                      : {
                          container: "border-emerald-200 bg-emerald-50",
                          badge: "bg-emerald-100 text-emerald-700",
                          value: "text-emerald-600",
                        };

                  return (
                    <div
                      key={option.card.id}
                      className={`rounded-2xl border p-4 ${toneStyles.container}`}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-bold text-slate-900">
                              {index === 0 ? "ðŸ† " : ""}{option.card.name}
                            </p>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneStyles.badge}`}>
                              {option.statusLabel}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-600">
                            {option.firstCriticalMonth
                              ? `A projeção fica negativa em ${option.firstCriticalMonth.label}.`
                              : `A menor projeção fica em ${option.lowestMonth.label}, com ${formatCurrency(option.lowestMonth.projectedBalance)}.`}
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl bg-white px-3 py-2 text-right">
                            <p className="text-xs text-slate-500">Menor mês</p>
                            <p className={`font-bold ${toneStyles.value}`}>
                              {formatCurrency(option.lowestMonth.projectedBalance)}
                            </p>
                            <p className="text-xs capitalize text-slate-500">{option.lowestMonth.label}</p>
                          </div>

                          <div className="rounded-xl bg-white px-3 py-2 text-right">
                            <p className="text-xs text-slate-500">Uso do limite</p>
                            <p className="font-bold text-slate-900">
                              {option.limitUsagePercentage !== null
                                ? `${option.limitUsagePercentage.toFixed(1)}%`
                                : "--"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {option.card.limit
                                ? `Limite ${formatCurrency(Number(option.card.limit || 0))}`
                                : "Sem limite informado"}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white px-3 py-2 text-right">
                            <p className="text-xs text-slate-500">Folga no limite</p>
                            <p className="font-bold text-slate-900">
                              {option.remainingLimit !== null
                                ? formatCurrency(option.remainingLimit)
                                : "--"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {bestCardComparison.installmentCount}x de {formatCurrency(bestCardComparison.installmentValue)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {worstDay ? (
            <div className="mt-4 text-sm text-slate-600">
              Pior momento do mês: dia <strong>{worstDay.day}</strong> com{" "}
              <span className={worstDay.balance < 0 ? "font-semibold text-rose-600" : "font-semibold text-slate-900"}>
                {formatCurrency(worstDay.balance)}
              </span>
            </div>
          ) : null}
        </div>
      </section>

        {purchaseRiskAlerts.length > 0 && (
          <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
            <div className="mb-4">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">Alertas de risco real</h3>
              <p className="text-sm text-slate-400">
                O app resume o risco da decisão.
              </p>
            </div>

            <div className="space-y-3">
              {purchaseRiskAlerts.map((alert) => {
                const styles =
                  alert.tone === "danger"
                    ? {
                        container: "border-rose-200 bg-rose-50",
                        badge: "bg-rose-100 text-rose-700",
                        title: "text-rose-900",
                        text: "text-rose-800",
                        label: "Risco real",
                      }
                    : alert.tone === "warning"
                    ? {
                        container: "border-amber-200 bg-amber-50",
                        badge: "bg-amber-100 text-amber-700",
                        title: "text-amber-900",
                        text: "text-amber-800",
                        label: "Atenção",
                      }
                    : {
                        container: "border-emerald-200 bg-emerald-50",
                        badge: "bg-emerald-100 text-emerald-700",
                        title: "text-emerald-900",
                        text: "text-emerald-800",
                        label: "Seguro",
                      };

                return (
                  <div
                    key={alert.id}
                    className={`rounded-2xl border p-4 ${styles.container}`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className={`font-semibold ${styles.title}`}>{alert.title}</p>
                        <p className={`mt-1 text-sm leading-6 ${styles.text}`}>
                          {alert.message}
                        </p>
                      </div>

                      <span
                        className={`inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${styles.badge}`}
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


        <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-900">Histórico de simulações</h3>
              <p className="text-sm text-slate-400">
                Simulações salvas para consulta rápida.
              </p>
            </div>

            <div className="rounded-[20px] border border-slate-200/70 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-600 shadow-sm">
              {simulationHistory.length} item(ns) salvo(s)
            </div>
          </div>

          {simulationHistory.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Nenhuma simulação salva ainda. Use o botão  €œSalvar decisão no histórico €.
            </div>
          ) : (
            <div className="space-y-3">
              {simulationHistory.map((item) => {
                const toneStyles =
                  item.recommendationStatus === "danger"
                    ? {
                        container: "border-rose-200 bg-rose-50",
                        badge: "bg-rose-100 text-rose-700",
                        value: "text-rose-600",
                      }
                    : item.recommendationStatus === "warning"
                    ? {
                        container: "border-amber-200 bg-amber-50",
                        badge: "bg-amber-100 text-amber-700",
                        value: "text-amber-600",
                      }
                    : {
                        container: "border-emerald-200 bg-emerald-50",
                        badge: "bg-emerald-100 text-emerald-700",
                        value: "text-emerald-600",
                      };

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 ${toneStyles.container}`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-bold text-slate-900">
                            {item.title || "Simulação salva"}
                          </p>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneStyles.badge}`}>
                            {item.recommendationTitle}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-slate-600">
                          {item.recommendedCardName
                            ? `Cartão recomendado: ${item.recommendedCardName}`
                            : "Sem cartão recomendado"}
                          {"  . "}
                          {item.installmentCount}x de {formatCurrency(item.installmentAmount)}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          {item.recommendationReason || "Sem observação adicional."}
                        </p>

                        <p className="mt-2 text-xs text-slate-500">
                          Salvo em {new Date(item.createdAt).toLocaleDateString("pt-BR")} Ã s {new Date(item.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 lg:items-end">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl bg-white px-3 py-2 text-right">
                            <p className="text-xs text-slate-500">Valor total</p>
                            <p className="font-bold text-slate-900">
                              {formatCurrency(item.totalAmount)}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white px-3 py-2 text-right">
                            <p className="text-xs text-slate-500">Menor mês</p>
                            <p className={`font-bold ${toneStyles.value}`}>
                              {item.lowestProjectedBalance !== null && item.lowestProjectedBalance !== undefined
                                ? formatCurrency(item.lowestProjectedBalance)
                                : "--"}
                            </p>
                            <p className="text-xs capitalize text-slate-500">
                              {item.lowestProjectedMonthLabel || "--"}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white px-3 py-2 text-right">
                            <p className="text-xs text-slate-500">Uso do limite</p>
                            <p className="font-bold text-slate-900">
                              {item.limitUsagePercent !== null && item.limitUsagePercent !== undefined
                                ? `${item.limitUsagePercent.toFixed(1)}%`
                                : "--"}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => handleApplySimulationHistory(item)}
                            disabled={
                              simulationHistoryApplyingId === item.id ||
                              simulationHistoryDeletingId === item.id
                            }
                            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {simulationHistoryApplyingId === item.id
                              ? "Transformando..."
                              : "Transformar em compra"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteSimulationHistory(item.id)}
                            disabled={
                              simulationHistoryDeletingId === item.id ||
                              simulationHistoryApplyingId === item.id
                            }
                            className="rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {simulationHistoryDeletingId === item.id ? "Excluindo..." : "Excluir histórico"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
          <div className="mb-4">
            <h3 className="text-xl font-bold tracking-tight text-slate-900">Modo economia</h3>
            <p className="text-sm text-slate-400">
              Plano prático para proteger sua margem no mês.
            </p>
          </div>

          <div
            className={`rounded-[28px] border p-5 shadow-[0_14px_36px_rgba(15,23,42,0.07)] ring-1 ring-white/60 ${
              economyModePlan.statusTone === "danger"
                ? "border-rose-200 bg-rose-50"
                : economyModePlan.statusTone === "warning"
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4
                    className={`text-lg font-bold ${
                      economyModePlan.statusTone === "danger"
                        ? "text-rose-900"
                        : economyModePlan.statusTone === "warning"
                        ? "text-amber-900"
                        : "text-emerald-900"
                    }`}
                  >
                    {economyModePlan.headline}
                  </h4>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      economyModePlan.statusTone === "danger"
                        ? "bg-rose-100 text-rose-700"
                        : economyModePlan.statusTone === "warning"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {economyModePlan.statusTone === "danger"
                      ? "Ação urgente"
                      : economyModePlan.statusTone === "warning"
                      ? "Ajuste recomendado"
                      : "Situação saudável"}
                  </span>
                </div>

                <p
                  className={`mt-2 text-sm leading-6 ${
                    economyModePlan.statusTone === "danger"
                      ? "text-rose-800"
                      : economyModePlan.statusTone === "warning"
                      ? "text-amber-800"
                      : "text-emerald-800"
                  }`}
                >
                  {economyModePlan.summary}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Redução no mês
                  </p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {formatCurrency(economyModePlan.reductionNeededThisMonth)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Meta por dia
                  </p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {formatCurrency(economyModePlan.reductionPerDay)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Dias restantes
                  </p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {economyModePlan.daysRemaining}
                  </p>
                </div>
              </div>
            </div>

            {economyModePlan.topReductionCategories.length > 0 ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-900">
                  Onde vale cortar primeiro
                </p>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {economyModePlan.topReductionCategories.map((item) => (
                    <div
                      key={item.category}
                      className="rounded-2xl border border-white/70 bg-white px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {getCategoryLabel(item.category)}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        Excesso sobre a meta:{" "}
                        <span className="font-bold text-rose-600">
                          {formatCurrency(item.exceededBy)}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Gasto atual {formatCurrency(item.spent)}  . Meta {formatCurrency(item.goal)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : economyModePlan.statusTone !== "success" ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-3 text-sm text-slate-600">
                Ainda não há categorias acima da meta. O ajuste sugerido depende mais de segurar gastos variáveis no restante do mês.
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-emerald-200 bg-white/80 px-4 py-3 text-sm text-emerald-700">
                Seu mês está com margem positiva. Continue acompanhando, mas sem necessidade de cortes extras agora.
              </div>
            )}
          </div>
        </section>


        {smartAlerts.length > 0 && (
          <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
            <div className="mb-4">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">
                Alertas inteligentes
              </h3>
              <p className="text-sm text-slate-400">
                O que mais merece sua atenção agora
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
                        className={`inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${styles.badge}`}
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
          <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
            <div className="mb-4">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">
                Previsão mês a mês
              </h3>
              <p className="text-sm text-slate-400">
                Como as parcelas futuras impactam os próximos meses
              </p>
            </div>

            <div className="space-y-3">
              {futureInstallmentsByMonth.map((group) => (
                <div
                  key={group.key}
                  className="rounded-[22px] border border-slate-200/70 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold capitalize text-slate-900">
                        {group.label}
                      </p>
                      <p className="text-sm text-slate-400">
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
                            {transaction.card?.name || "Cartão"}  .{" "}
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
          <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
            <div className="mb-4">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">
                Parcelas futuras
              </h3>
              <p className="text-sm text-slate-400">
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
                    <p className="text-sm text-slate-400">
                      {transaction.card?.name || "Cartão"}  .{" "}
                      {new Date(transaction.date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-slate-400">Valor</p>
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
          <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
            <div className="mb-4">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">
                Próximas faturas em aberto
              </h3>
              <p className="text-sm text-slate-400">
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
                    <p className="text-sm text-slate-400">
                      {formatInvoiceLabel(invoice.month, invoice.year)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-slate-400">Total em aberto</p>
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
              <h3 className="text-xl font-bold tracking-tight text-slate-900">
                Gastos por categoria
              </h3>
              <p className="text-sm text-slate-400">
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
                      label={({ name, percent }) =>
                        `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
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
                      formatter={(value) => formatCurrency(Number(value ?? 0))}
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
            <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">
                Maior gasto do período
              </h3>

              {biggestExpenseCategory ? (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-slate-400">Categoria</p>
                  <p className="text-xl font-bold text-slate-900">
                    {getCategoryLabel(biggestExpenseCategory.name)}
                  </p>
                  <p className="text-2xl font-bold text-rose-600">
                    {formatCurrency(biggestExpenseCategory.value)}
                  </p>
                  <p className="text-sm text-slate-400">
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

            <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">
                Ãšltimas movimentações
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
                        <p className="text-sm text-slate-400">
                          {getCategoryLabel(transaction.category)}  .{" "}
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

        <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-6">
          <div className="mb-4">
            <h3 className="text-xl font-bold tracking-tight text-slate-900">
              Metas por categoria
            </h3>
            <p className="text-sm text-slate-400">
              Defina um limite mensal e acompanhe quanto já foi gasto.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {GOAL_CATEGORIES.map((category) => (
              <div
                key={category}
                className="rounded-[22px] border border-slate-200/70 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
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
              <p className="text-sm text-slate-400">
                Nenhuma meta cadastrada ainda para este período.
              </p>
            ) : (
              goalSummary.map((item) => (
                <div
                  key={item.category}
                  className="rounded-[22px] border border-slate-200/70 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {getCategoryLabel(item.category)}
                      </p>
                      <p className="text-sm text-slate-400">
                        Meta: {formatCurrency(item.goal)}   • Gasto:{" "}
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
