// force deploy
"use client";

import LogoutButton from "@/components/logout-button";
import { createCardInitialBalance } from "@/app/actions";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  isFixed?: boolean | null;
  isAdjustment?: boolean | null;
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
  isFixed?: boolean | null;
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

type CategoryOutOfPaceItem = {
  category: string;
  goal: number;
  plannedCut: number;
  adjustedGoal: number;
  spent: number;
  remaining: number;
  adjustedRemaining: number;
  percentage: number;
  adjustedPercentage: number;
  exceeded: boolean;
  adjustedExceeded: boolean;
  elapsedDays: number;
  elapsedRatio: number;
  shouldHaveSpent: number;
  paceDifference: number;
  paceStatus: "controlled" | "attention" | "off_track" | "future";
  shortLabel: string;
  shortStatus: string;
  actionHint: string;
  recoveryHint: string;
};


type SmartAlert = {
  id: string;
  title: string;
  message: string;
  tone: "danger" | "warning" | "info" | "success";
};

type ActionCenterAlert = {
  id: string;
  title: string;
  message: string;
  action: string;
  tone: "danger" | "warning" | "info" | "success";
  priority: number;
  priorityLabel: "Urgente agora" | "Agir hoje" | "Acompanhar";
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

function formatCurrency(value?: number | null) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
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


function getFlowTypeLabel(isFixed?: boolean | null) {
  return isFixed ? "Fixa" : "Variável";
}

function getImmediateCategoryAction(category?: string | null) {
  const normalized = normalizeComparableText(category);

  if (normalized.includes("aliment")) {
    return "Evite gastos fora de casa hoje";
  }
  if (normalized.includes("transporte")) {
    return "Segure corridas e deslocamentos não essenciais hoje";
  }
  if (normalized.includes("lazer")) {
    return "Pause gastos de lazer até o ritmo normalizar";
  }
  if (normalized.includes("pessoal")) {
    return "Adie compras pessoais que não sejam prioridade";
  }
  if (normalized.includes("vest")) {
    return "Evite compras de roupa por agora";
  }
  if (normalized.includes("casa")) {
    return "Compre só o essencial para casa";
  }
  if (normalized.includes("pet")) {
    return "Mantenha apenas os gastos necessários do pet hoje";
  }
  if (normalized.includes("sa")) {
    return "Revise o que é realmente necessário nesta categoria";
  }
  if (normalized.includes("skin")) {
    return "Pause reposições e compras de skincare por enquanto";
  }
  if (normalized.includes("reforma")) {
    return "Segure itens de reforma que possam esperar";
  }
  if (normalized.includes("eletron")) {
    return "Evite compras de tecnologia neste momento";
  }

  return "Reduza gastos variáveis hoje";
}

function getPaceStatusLabel(status: "controlled" | "attention" | "off_track" | "future") {
  switch (status) {
    case "off_track":
      return "Fora do ritmo";
    case "attention":
      return "Pedindo atenção";
    case "future":
      return "Mês futuro";
    default:
      return "No ritmo";
  }
}

function getPaceRecoveryHint(
  paceDifference: number,
  daysRemaining: number,
  isCurrentSelectedMonth: boolean
) {
  if (paceDifference <= 0) return "Você está dentro do ritmo desta categoria.";

  if (!isCurrentSelectedMonth) {
    return `O desvio atual está em ${formatCurrency(paceDifference)}.`;
  }

  const safeDaysRemaining = Math.max(daysRemaining, 1);
  const suggestedDailyAdjustment = paceDifference / safeDaysRemaining;

  return `Se reduzir cerca de ${formatCurrency(
    suggestedDailyAdjustment
  )} por dia até o fim do mês, você volta para o ritmo.`;
}

function getGoalsStorageKey(selectedMonth: string) {
  return `category-goals:${selectedMonth}`;
}

function getCutPlanStorageKey(selectedMonth: string) {
  return `cut-plan:${selectedMonth}`;
}

function getDailyReviewStorageKey(selectedMonth: string) {
  return `daily-review:${selectedMonth}`;
}

function getAlertStateStorageKey(selectedMonth: string) {
  return `alert-states:${selectedMonth}`;
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


function getActionPriorityLabel(priority: number): ActionCenterAlert["priorityLabel"] {
  if (priority >= 95) return "Urgente agora";
  if (priority >= 60) return "Agir hoje";
  return "Acompanhar";
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

type AlertStateStatus = "resolved" | "later" | "ignored";

type AlertStateItem = {
  status: AlertStateStatus;
  updatedAt: string;
  snoozeUntil?: string;
  monthKey?: string;
};

type DailyReviewChecklist = {
  transactions: boolean;
  alerts: boolean;
  commitments: boolean;
  balance: boolean;
};

type DailyReviewEntry = {
  dateKey: string;
  completed: boolean;
  completedAt?: string;
  checklist: DailyReviewChecklist;
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
  const [simulatedCutCategory, setSimulatedCutCategory] = useState<string | null>(null);
  const [simulatedCutAmount, setSimulatedCutAmount] = useState(0);
  const [simulatedCutPercent, setSimulatedCutPercent] = useState<number | null>(null);
  const [customCutInput, setCustomCutInput] = useState<Record<string, string>>({});
  const [savedCutPlan, setSavedCutPlan] = useState<Record<string, number>>({});
  const [alertStates, setAlertStates] = useState<Record<string, AlertStateItem>>({});
  const [dailyReviewHistory, setDailyReviewHistory] = useState<Record<string, DailyReviewEntry>>({});
  const [resettingData, setResettingData] = useState(false);
  const [initialBalanceCardId, setInitialBalanceCardId] = useState("");
  const [initialBalanceAmount, setInitialBalanceAmount] = useState("");
  const [initialBalanceDate, setInitialBalanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [initialBalanceSubmitting, setInitialBalanceSubmitting] = useState(false);

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

  async function handleCreateCardInitialBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!initialBalanceCardId) {
      showToast("Selecione um cartão", "Escolha o cartão que já possui saldo em aberto.", "error");
      return;
    }

    if (!initialBalanceAmount.trim()) {
      showToast("Informe o valor", "Digite o saldo inicial da fatura para continuar.", "error");
      return;
    }

    try {
      setInitialBalanceSubmitting(true);

      await createCardInitialBalance({
        cardId: initialBalanceCardId,
        amount: initialBalanceAmount,
        date: initialBalanceDate,
      });

      const selectedCard = cards.find((card) => card.id === initialBalanceCardId);

      setInitialBalanceAmount("");
      setInitialBalanceCardId("");
      setInitialBalanceDate(new Date().toISOString().slice(0, 10));

      await loadDashboardData();

      showToast(
        "Saldo inicial lançado",
        `O valor foi salvo em ${selectedCard?.name || "seu cartão"} como ajuste inicial da fatura.`,
        "success"
      );
    } catch (error) {
      showToast(
        "Erro ao lançar ajuste",
        error instanceof Error ? error.message : "Tente novamente.",
        "error"
      );
    } finally {
      setInitialBalanceSubmitting(false);
    }
  }

  function handleGoToInitialBalanceSection() {
    const section = document.getElementById("initial-balance-card-adjustment");

    if (!section) {
      showToast(
        "Área de ajuste não encontrada",
        "Role a tela um pouco para baixo e procure por 'Ajuste inicial do cartão'.",
        "info"
      );
      return;
    }

    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleResetAllData() {
    const confirmed = window.confirm(
      "Isso vai apagar todas as suas transações, recorrências, faturas, cartões, contas e histórico de simulações. Deseja continuar?"
    );

    if (!confirmed) return;

    try {
      setResettingData(true);

      const response = await fetch("/api/reset-data", {
        method: "POST",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível resetar seus dados.");
      }

      setGoals({});
      setGoalInputs({});
      setSavedCutPlan({});
      setAlertStates({});
      setDailyReviewHistory({});
      setSimulationValue("");
      setInstallmentSimulationValue("");
      setInstallmentSimulationCount("3");
      setInstallmentSimulationCardId("");
      setSimulatedCutCategory(null);
      setSimulatedCutAmount(0);
      setSimulatedCutPercent(null);
      setCustomCutInput({});
      setDeleteConfirm({
        open: false,
        id: null,
        title: "",
      });
      setEditingRecurringId(null);

      localStorage.removeItem(getGoalsStorageKey(selectedMonth));
      localStorage.removeItem(getCutPlanStorageKey(selectedMonth));
      localStorage.removeItem(getAlertStateStorageKey(selectedMonth));
      localStorage.removeItem(getDailyReviewStorageKey(selectedMonth));

      await loadDashboardData();

      showToast(
        "Dados apagados",
        "Seu app foi resetado e já está pronto para começar do zero.",
        "success"
      );
    } catch (error) {
      showToast(
        "Erro ao resetar",
        error instanceof Error ? error.message : "Tente novamente.",
        "error"
      );
    } finally {
      setResettingData(false);
    }
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
    const savedPlan = localStorage.getItem(getCutPlanStorageKey(selectedMonth));
    const parsedPlan: Record<string, number> = savedPlan ? JSON.parse(savedPlan) : {};
    setSavedCutPlan(parsedPlan);
  }, [selectedMonth]);

  useEffect(() => {
    const savedStates = localStorage.getItem(getAlertStateStorageKey(selectedMonth));
    const parsedStates: Record<string, AlertStateItem> = savedStates ? JSON.parse(savedStates) : {};
    setAlertStates(parsedStates);
  }, [selectedMonth]);


  useEffect(() => {
    const savedDailyReview = localStorage.getItem(getDailyReviewStorageKey(selectedMonth));
    const parsedDailyReview: Record<string, DailyReviewEntry> = savedDailyReview ? JSON.parse(savedDailyReview) : {};
    setDailyReviewHistory(parsedDailyReview);
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

  const analyticalTransactions = useMemo(() => {
    return filteredTransactions.filter((transaction) => !isAdjustmentTransaction(transaction));
  }, [filteredTransactions]);

  const filteredExpenses = useMemo(() => {
    return analyticalTransactions.filter((transaction) =>
      isExpenseType(transaction.type)
    );
  }, [analyticalTransactions]);

  const filteredIncomes = useMemo(() => {
    return analyticalTransactions.filter((transaction) =>
      isIncomeType(transaction.type)
    );
  }, [analyticalTransactions]);

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

  const fixedExpensesTotal = useMemo(() => {
    return filteredExpenses
      .filter((transaction) => Boolean(transaction.isFixed))
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  }, [filteredExpenses]);

  const variableExpensesTotal = useMemo(() => {
    return filteredExpenses
      .filter((transaction) => !transaction.isFixed)
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  }, [filteredExpenses]);

  const fixedIncomesTotal = useMemo(() => {
    return filteredIncomes
      .filter((transaction) => Boolean(transaction.isFixed))
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  }, [filteredIncomes]);

  const variableIncomesTotal = useMemo(() => {
    return filteredIncomes
      .filter((transaction) => !transaction.isFixed)
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  }, [filteredIncomes]);


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
      const plannedCut = Number(savedCutPlan[category] || 0);
      const adjustedGoal = Math.max(goal - plannedCut, 0);
      const remaining = goal - spent;
      const adjustedRemaining = adjustedGoal - spent;
      const percentage = goal > 0 ? (spent / goal) * 100 : 0;
      const adjustedPercentage =
        adjustedGoal > 0 ? (spent / adjustedGoal) * 100 : 0;

      return {
        category,
        goal,
        plannedCut,
        adjustedGoal,
        spent,
        remaining,
        adjustedRemaining,
        percentage,
        adjustedPercentage,
        exceeded: goal > 0 && spent > goal,
        adjustedExceeded: adjustedGoal > 0 && spent > adjustedGoal,
      };
    }).filter((item) => item.goal > 0 || item.spent > 0 || item.plannedCut > 0);
  }, [goals, categorySpentMap, savedCutPlan]);

  const goalPaceSummary = useMemo(() => {
    const today = new Date();
    const selectedMonthDate = new Date(
      selectedMonthMeta.year,
      selectedMonthMeta.month - 1,
      1
    );

    const isCurrentMonth =
      today.getFullYear() === selectedMonthMeta.year &&
      today.getMonth() + 1 === selectedMonthMeta.month;

    const isPastMonth =
      selectedMonthDate.getFullYear() < today.getFullYear() ||
      (selectedMonthDate.getFullYear() === today.getFullYear() &&
        selectedMonthDate.getMonth() < today.getMonth());

    const elapsedDays = isPastMonth
      ? selectedMonthMeta.daysInMonth
      : isCurrentMonth
      ? Math.min(today.getDate(), selectedMonthMeta.daysInMonth)
      : 0;

    const elapsedRatio =
      selectedMonthMeta.daysInMonth > 0
        ? elapsedDays / selectedMonthMeta.daysInMonth
        : 0;

    return goalSummary.map((item) => {
      const shouldHaveSpent = item.adjustedGoal * elapsedRatio;
      const paceDifference = item.spent - shouldHaveSpent;

      let paceStatus: "controlled" | "attention" | "off_track" | "future" =
        "controlled";

      if (!isPastMonth && !isCurrentMonth) {
        paceStatus = "future";
      } else if (shouldHaveSpent <= 0) {
        paceStatus = item.spent > 0 ? "off_track" : "controlled";
      } else if (item.spent <= shouldHaveSpent * 1.05) {
        paceStatus = "controlled";
      } else if (item.spent <= shouldHaveSpent * 1.2) {
        paceStatus = "attention";
      } else {
        paceStatus = "off_track";
      }

      return {
        ...item,
        elapsedDays,
        elapsedRatio,
        shouldHaveSpent,
        paceDifference,
        paceStatus,
      };
    });
  }, [goalSummary, selectedMonthMeta.daysInMonth, selectedMonthMeta.month, selectedMonthMeta.year]);

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

    const fixedPendingIncomeItems = pendingIncomeItems.filter((item) => Boolean(item.isFixed));
    const variablePendingIncomeItems = pendingIncomeItems.filter((item) => !item.isFixed);
    const fixedPendingExpenseItems = pendingExpenseItems.filter((item) => Boolean(item.isFixed));
    const variablePendingExpenseItems = pendingExpenseItems.filter((item) => !item.isFixed);

    const incomesTotal = pendingIncomeItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const expensesTotal = pendingExpenseItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const fixedIncomesTotal = fixedPendingIncomeItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const variableIncomesTotal = variablePendingIncomeItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const fixedExpensesTotal = fixedPendingExpenseItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const variableExpensesTotal = variablePendingExpenseItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    return {
      pendingIncomeItems,
      pendingExpenseItems,
      fixedPendingIncomeItems,
      variablePendingIncomeItems,
      fixedPendingExpenseItems,
      variablePendingExpenseItems,
      incomesTotal,
      expensesTotal,
      fixedIncomesTotal,
      variableIncomesTotal,
      fixedExpensesTotal,
      variableExpensesTotal,
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

        return isInstallment && isFuture && isExpense && !isAdjustmentTransaction(transaction);
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



  const monthlyForecast = useMemo(() => {
    const activeRecurrings = recurrings.filter((item) => item.active);

    const monthlyRecurringIncome = activeRecurrings
      .filter((item) => isIncomeType(item.type))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const monthlyRecurringExpense = activeRecurrings
      .filter((item) => isExpenseType(item.type))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const months: {
      key: string;
      label: string;
      projectedBalance: number;
      recurringIncome: number;
      recurringExpense: number;
      installmentImpact: number;
      isCritical: boolean;
    }[] = [];

    let runningBalance = projectedBalanceAfterInvoices;

    for (let index = 0; index < 6; index += 1) {
      const forecastDate = new Date(
        selectedMonthMeta.year,
        selectedMonthMeta.month - 1 + index,
        1
      );

      const key = `${forecastDate.getFullYear()}-${String(
        forecastDate.getMonth() + 1
      ).padStart(2, "0")}`;

      const label = forecastDate.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });

      const installmentMonth = futureInstallmentsByMonth.find(
        (item) => item.key === key
      );

      const installmentImpact = Number(installmentMonth?.total || 0);

      runningBalance =
        runningBalance +
        monthlyRecurringIncome -
        monthlyRecurringExpense -
        installmentImpact;

      months.push({
        key,
        label,
        projectedBalance: runningBalance,
        recurringIncome: monthlyRecurringIncome,
        recurringExpense: monthlyRecurringExpense,
        installmentImpact,
        isCritical: runningBalance < 0,
      });
    }

    return months;
  }, [
    recurrings,
    projectedBalanceAfterInvoices,
    futureInstallmentsByMonth,
    selectedMonthMeta.year,
    selectedMonthMeta.month,
  ]);


  const financialInsight = useMemo(() => {
    if (!monthlyForecast.length) return null;

    const first = monthlyForecast[0].projectedBalance;
    const last = monthlyForecast[monthlyForecast.length - 1].projectedBalance;

    const diff = last - first;

    let trend: "up" | "down" | "stable" = "stable";

    if (diff > 50) trend = "up";
    if (diff < -50) trend = "down";

    const monthlyAdjustment = Math.abs(diff) / monthlyForecast.length;

    return {
      trend,
      diff,
      monthlyAdjustment,
    };
  }, [monthlyForecast]);


  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};

    transactions.forEach((transaction) => {
      if (!isExpenseType(transaction.type) || isAdjustmentTransaction(transaction)) return;

      const category =
        transaction.category && transaction.category.trim() !== ""
          ? transaction.category
          : "Outros";

      map[category] = (map[category] || 0) + Number(transaction.amount || 0);
    });

    return Object.entries(map)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  const categorySuggestion = useMemo(() => {
    if (!financialInsight) return null;
    if (financialInsight.trend !== "down") return null;
    if (!expenseByCategory.length) return null;

    const topCategories = expenseByCategory.slice(0, 2);

    return {
      categories: topCategories,
      suggestedCut: financialInsight.monthlyAdjustment,
    };
  }, [expenseByCategory, financialInsight]);

  const simulatedMonthlyForecast = useMemo(() => {
    if (!simulatedCutCategory || simulatedCutAmount <= 0) {
      return monthlyForecast;
    }

    return monthlyForecast.map((month, index) => ({
      ...month,
      projectedBalance: month.projectedBalance + simulatedCutAmount * (index + 1),
      isCritical: month.projectedBalance + simulatedCutAmount * (index + 1) < 0,
    }));
  }, [monthlyForecast, simulatedCutCategory, simulatedCutAmount]);

  const simulatedForecastSummary = useMemo(() => {
    if (!simulatedMonthlyForecast.length) {
      return {
        lowestMonth: null as null | (typeof simulatedMonthlyForecast)[number],
        negativeMonths: 0,
      };
    }

    const lowestMonth = simulatedMonthlyForecast.reduce((lowest, current) =>
      current.projectedBalance < lowest.projectedBalance ? current : lowest
    );

    const negativeMonths = simulatedMonthlyForecast.filter(
      (month) => month.projectedBalance < 0
    ).length;

    return {
      lowestMonth,
      negativeMonths,
    };
  }, [simulatedMonthlyForecast]);

  const monthlyForecastSummary = useMemo(() => {
    if (!monthlyForecast.length) {
      return {
        lowestMonth: null as null | (typeof monthlyForecast)[number],
        negativeMonths: 0,
      };
    }

    const lowestMonth = monthlyForecast.reduce((lowest, current) =>
      current.projectedBalance < lowest.projectedBalance ? current : lowest
    );

    const negativeMonths = monthlyForecast.filter(
      (month) => month.projectedBalance < 0
    ).length;

    return {
      lowestMonth,
      negativeMonths,
    };
  }, [monthlyForecast]);

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

  const savedCutPlanSummary = useMemo(() => {
    const entries = Object.entries(savedCutPlan).map(([category, amount]) => ({
      category,
      amount: Number(amount || 0),
    }));

    const total = entries.reduce((sum, item) => sum + item.amount, 0);

    return {
      entries,
      total,
    };
  }, [savedCutPlan]);


  const smartAlerts = useMemo<SmartAlert[]>(() => {
    const alerts: SmartAlert[] = [];
    const safeBalanceThreshold = 2000;

    if (projectedBalanceReal < 0) {
      alerts.push({
        id: "negative-projected-balance",
        title: "Saldo projetado negativo",
        message: `Sua projeção total está negativa em ${formatCurrency(
          Math.abs(projectedBalanceReal)
        )}. Vale revisar cartão, parcelas e principalmente o peso entre despesas fixas e variáveis.`,
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


  const actionCenterAlerts = useMemo<ActionCenterAlert[]>(() => {
    const alerts: ActionCenterAlert[] = [];

    const addDynamicAlert = (
      alert: Omit<ActionCenterAlert, "priorityLabel"> & { priority: number }
    ) => {
      alerts.push({
        ...alert,
        priorityLabel: getActionPriorityLabel(alert.priority),
      });
    };

    const currentDayInSelectedMonth = spendingCapacitySummary.referenceDay;
    const lowestDailyPoint = dailyProjectionSummary.lowestPoint;
    const daysUntilCriticalPoint = lowestDailyPoint
      ? Math.max(0, lowestDailyPoint.day - currentDayInSelectedMonth)
      : null;

    if (lowestDailyPoint && lowestDailyPoint.balance < 0) {
      const proximityBoost =
        daysUntilCriticalPoint === null
          ? 0
          : daysUntilCriticalPoint <= 3
          ? 25
          : daysUntilCriticalPoint <= 7
          ? 18
          : daysUntilCriticalPoint <= 15
          ? 10
          : 4;

      const severityBoost = Math.min(
        25,
        Math.round(Math.abs(lowestDailyPoint.balance) / 250)
      );

      addDynamicAlert({
        id: "daily-negative-balance",
        title:
          daysUntilCriticalPoint !== null && daysUntilCriticalPoint <= 7
            ? "Saldo negativo se aproxima"
            : "Risco de saldo negativo no mês",
        message: `Seu ponto mais crítico acontece em ${lowestDailyPoint.label}, com projeção de ${formatCurrency(
          lowestDailyPoint.balance
        )}.`,
        action:
          daysUntilCriticalPoint !== null && daysUntilCriticalPoint <= 7
            ? "Segure gastos hoje e revise saídas dos próximos dias."
            : "Reduza despesas variáveis e adie compras até recuperar margem.",
        tone: "danger",
        priority: 95 + proximityBoost + severityBoost,
      });
    } else if (
      lowestDailyPoint &&
      lowestDailyPoint.balance < 1000 &&
      spendingCapacitySummary.extraSafeSpend < 500
    ) {
      addDynamicAlert({
        id: "daily-low-balance",
        title: "Folga curta para os próximos dias",
        message: `A menor folga diária do mês fica em ${formatCurrency(
          lowestDailyPoint.balance
        )}.`,
        action: "Evite compras por impulso até ganhar mais margem no saldo.",
        tone: "warning",
        priority: 72 + Math.max(0, 12 - Math.floor((lowestDailyPoint.balance || 0) / 100)),
      });
    }

    const worstPaceItems = [...goalPaceSummary]
      .filter((item) => item.paceStatus === "off_track" || item.paceStatus === "attention")
      .sort((a, b) => Math.abs(b.paceDifference) - Math.abs(a.paceDifference));

    const topOffTrack = worstPaceItems[0];
    if (topOffTrack) {
      const pacePressure = Math.min(
        22,
        Math.round(Math.abs(topOffTrack.paceDifference) / 120)
      );

      addDynamicAlert({
        id: `pace-${topOffTrack.category}`,
        title: `${getCategoryLabel(topOffTrack.category)} fora do ritmo`,
        message:
          topOffTrack.paceStatus === "off_track"
            ? `Você já gastou ${formatCurrency(Math.abs(topOffTrack.paceDifference))} acima do ritmo recomendado nesta categoria.`
            : `Você está começando a se afastar do ritmo ideal em ${getCategoryLabel(topOffTrack.category)}.`,
        action: `Revise gastos desta categoria hoje e priorize cortes nela antes das outras.`,
        tone: topOffTrack.paceStatus === "off_track" ? "danger" : "warning",
        priority:
          (topOffTrack.paceStatus === "off_track" ? 78 : 58) + pacePressure,
      });
    }

    const topAdjustedExceeded = [...goalPaceSummary]
      .filter((item) => item.adjustedExceeded)
      .sort((a, b) => Math.abs(b.adjustedRemaining) - Math.abs(a.adjustedRemaining))[0];

    if (topAdjustedExceeded) {
      addDynamicAlert({
        id: `adjusted-${topAdjustedExceeded.category}`,
        title: `${getCategoryLabel(topAdjustedExceeded.category)} acima da meta ajustada`,
        message: `O estouro atual é de ${formatCurrency(Math.abs(topAdjustedExceeded.adjustedRemaining))} considerando seu plano de economia.`,
        action: `Segure novos gastos em ${getCategoryLabel(topAdjustedExceeded.category)} até voltar para perto da meta recomendada.`,
        tone: "danger",
        priority: 82 + Math.min(24, Math.round(Math.abs(topAdjustedExceeded.adjustedRemaining) / 100)),
      });
    }

    const firstNegativeMonthIndex = monthlyForecast.findIndex(
      (item) => item.projectedBalance < 0
    );

    if (monthlyForecastSummary.negativeMonths > 0 && monthlyForecastSummary.lowestMonth) {
      const nearTermBoost =
        firstNegativeMonthIndex === 0
          ? 24
          : firstNegativeMonthIndex === 1
          ? 16
          : firstNegativeMonthIndex === 2
          ? 10
          : 4;

      addDynamicAlert({
        id: "negative-months",
        title:
          firstNegativeMonthIndex <= 1
            ? "Mês negativo muito próximo"
            : "Há meses negativos na previsão",
        message: `${monthlyForecastSummary.negativeMonths} mês(es) podem fechar no vermelho. O ponto mais crítico é ${monthlyForecastSummary.lowestMonth.label}.`,
        action: "Adie compras parceladas e reforce o plano de corte nas categorias com maior peso.",
        tone: "danger",
        priority: 88 + nearTermBoost + Math.min(16, monthlyForecastSummary.negativeMonths * 5),
      });
    } else if (monthlyForecastSummary.lowestMonth && monthlyForecastSummary.lowestMonth.projectedBalance < 3000) {
      addDynamicAlert({
        id: "low-buffer",
        title: "Folga futura baixa",
        message: `Seu mês mais apertado é ${monthlyForecastSummary.lowestMonth.label}, com saldo projetado de ${formatCurrency(monthlyForecastSummary.lowestMonth.projectedBalance)}.`,
        action: "Mantenha o plano de economia ativo para aumentar a margem dos próximos meses.",
        tone: "warning",
        priority:
          54 +
          Math.max(
            0,
            Math.min(
              20,
              Math.round((3000 - monthlyForecastSummary.lowestMonth.projectedBalance) / 200)
            )
          ),
      });
    }

    if (financialInsight?.trend === "down") {
      addDynamicAlert({
        id: "trend-down",
        title: "Saldo em tendência de queda",
        message: `Sua projeção aponta variação de ${formatCurrency(financialInsight.diff)} em ${monthlyForecast.length} meses.`,
        action: `Reduza cerca de ${formatCurrency(financialInsight.monthlyAdjustment)} por mês para estabilizar a trajetória.`,
        tone: "warning",
        priority: 50 + Math.min(20, Math.round(Math.abs(financialInsight.diff) / 400)),
      });
    }

    if (purchaseRecommendation?.tone === "danger" && purchaseRecommendation.lowestMonthLabel) {
      addDynamicAlert({
        id: "purchase-risk",
        title: "Compra parcelada em zona de risco",
        message: `A melhor simulação ainda pressiona ${purchaseRecommendation.lowestMonthLabel}.`,
        action: "Evite parcelar agora e refaça a simulação quando a margem melhorar.",
        tone: "danger",
        priority: 76,
      });
    } else if (purchaseRecommendation?.tone === "warning" && purchaseRecommendation.lowestMonthLabel) {
      addDynamicAlert({
        id: "purchase-attention",
        title: "Compra parcelada pede cautela",
        message: `A simulação cabe, mas reduz a folga em ${purchaseRecommendation.lowestMonthLabel}.`,
        action: "Só parcele se essa compra for realmente prioridade agora.",
        tone: "warning",
        priority: 58,
      });
    }

    if (categorySuggestion?.categories?.length) {
      const names = categorySuggestion.categories.map((item) => getCategoryLabel(item.category)).join(" e ");
      addDynamicAlert({
        id: "cut-categories",
        title: "Categorias com maior potencial de ajuste",
        message: `${names} concentram boa parte da pressão atual do seu orçamento.`,
        action: `Comece por elas para capturar mais rápido o corte sugerido de ${formatCurrency(categorySuggestion.suggestedCut)} por mês.`,
        tone: "info",
        priority: 38 + Math.min(12, Math.round(categorySuggestion.suggestedCut / 150)),
      });
    }

    if (savedCutPlanSummary.total > 0) {
      addDynamicAlert({
        id: "saved-plan",
        title: "Plano de economia ativo",
        message: `Você já salvou ${formatCurrency(savedCutPlanSummary.total)} em metas de redução para este mês.`,
        action: "Use o ritmo do mês para acompanhar se essas metas estão sendo cumpridas no dia a dia.",
        tone: "success",
        priority: 22,
      });
    }

    if (!alerts.length) {
      addDynamicAlert({
        id: "everything-ok",
        title: "Nenhuma prioridade crítica agora",
        message: "Seu cenário atual está estável e sem sinais fortes de risco imediato.",
        action: "Continue acompanhando metas e previsão para manter a margem saudável.",
        tone: "success",
        priority: 10,
      });
    }

    return alerts
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);
  }, [
    categorySuggestion,
    dailyProjectionSummary.lowestPoint,
    financialInsight,
    goalPaceSummary,
    monthlyForecast,
    monthlyForecast.length,
    monthlyForecastSummary,
    purchaseRecommendation,
    savedCutPlanSummary.total,
    spendingCapacitySummary.extraSafeSpend,
    spendingCapacitySummary.referenceDay,
  ]);

  const visibleActionCenterAlerts = useMemo(() => {
    return actionCenterAlerts.filter((alert) => {
      const state = alertStates[alert.id];

      if (!state) return true;
      if (state.status === "resolved") return false;
      if (state.status === "ignored" && state.monthKey === selectedMonth) return false;
      if (state.status === "later" && state.snoozeUntil) {
        return new Date(state.snoozeUntil).getTime() <= Date.now();
      }

      return true;
    });
  }, [actionCenterAlerts, alertStates, selectedMonth]);

  const handledActionCenterAlerts = useMemo(() => {
    return actionCenterAlerts.filter((alert) => {
      const state = alertStates[alert.id];
      if (!state) return false;
      if (state.status === "resolved") return true;
      if (state.status === "ignored" && state.monthKey === selectedMonth) return true;
      if (state.status === "later" && state.snoozeUntil) {
        return new Date(state.snoozeUntil).getTime() > Date.now();
      }
      return false;
    });
  }, [actionCenterAlerts, alertStates, selectedMonth]);


  const dailyUsageSummary = useMemo(() => {
    const now = new Date();
    const isCurrentSelectedMonth =
      now.getFullYear() === selectedMonthMeta.year &&
      now.getMonth() + 1 === selectedMonthMeta.month;

    const todayTransactions = isCurrentSelectedMonth
      ? filteredTransactions.filter((transaction) => {
          const transactionDate = new Date(transaction.date);
          return transactionDate.getDate() === now.getDate() && !isAdjustmentTransaction(transaction);
        })
      : [];

    const todayExpenses = todayTransactions
      .filter((transaction) => isExpenseType(transaction.type))
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const todayIncomes = todayTransactions
      .filter((transaction) => isIncomeType(transaction.type))
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const visibleAlerts = visibleActionCenterAlerts.slice(0, 3);

    const upcomingRecurring = isCurrentSelectedMonth
      ? [
          ...monthlyRecurringProjection.pendingExpenseItems,
          ...monthlyRecurringProjection.pendingIncomeItems,
        ]
          .map((item) => ({
            id: item.id,
            kind: isIncomeType(item.type) ? ("income" as const) : ("expense" as const),
            title: item.title,
            amount: Number(item.amount || 0),
            day: Math.min(
              Math.max(Number(item.dayOfMonth || 1), now.getDate()),
              selectedMonthMeta.daysInMonth
            ),
          }))
          .filter((item) => item.day >= now.getDate())
          .sort((a, b) => a.day - b.day || a.amount - b.amount)
          .slice(0, 3)
      : [];

    const upcomingInvoices = openInvoices
      .filter((invoice) => {
        const invoiceDate = new Date(invoice.year, invoice.month - 1, 1);
        const selectedDate = new Date(selectedMonthMeta.year, selectedMonthMeta.month - 1, 1);
        return invoiceDate.getTime() >= selectedDate.getTime();
      })
      .slice(0, 2)
      .map((invoice) => ({
        id: invoice.id,
        label: formatInvoiceLabel(invoice.month, invoice.year),
        total: Number(invoice.total || 0),
        cardName: invoice.card?.name || "Cartão",
      }));

    const safeToSpendToday = Math.max(0, Number(spendingCapacitySummary.safeDailySpend || 0));
    const safeToSpendMonth = Math.max(0, Number(spendingCapacitySummary.extraSafeSpend || 0));

    return {
      isCurrentSelectedMonth,
      todayExpenses,
      todayIncomes,
      safeToSpendToday,
      safeToSpendMonth,
      visibleAlerts,
      upcomingRecurring,
      upcomingInvoices,
    };
  }, [
    filteredTransactions,
    monthlyRecurringProjection.pendingExpenseItems,
    monthlyRecurringProjection.pendingIncomeItems,
    openInvoices,
    selectedMonthMeta.daysInMonth,
    selectedMonthMeta.month,
    selectedMonthMeta.year,
    spendingCapacitySummary.extraSafeSpend,
    spendingCapacitySummary.safeDailySpend,
    visibleActionCenterAlerts,
  ]);





  const weeklyReviewSummary = useMemo(() => {
    const now = new Date();
    const startCurrentWeek = new Date(now);
    startCurrentWeek.setDate(now.getDate() - 6);
    startCurrentWeek.setHours(0, 0, 0, 0);

    const startPreviousWeek = new Date(startCurrentWeek);
    startPreviousWeek.setDate(startCurrentWeek.getDate() - 7);
    const endPreviousWeek = new Date(startCurrentWeek);
    endPreviousWeek.setMilliseconds(-1);

    const currentWeekExpenses = transactions.filter((transaction) => {
      if (!isExpenseType(transaction.type) || isAdjustmentTransaction(transaction)) return false;
      const date = new Date(transaction.date);
      return date >= startCurrentWeek && date <= now;
    });

    const previousWeekExpenses = transactions.filter((transaction) => {
      if (!isExpenseType(transaction.type) || isAdjustmentTransaction(transaction)) return false;
      const date = new Date(transaction.date);
      return date >= startPreviousWeek && date <= endPreviousWeek;
    });

    const currentWeekTotal = currentWeekExpenses.reduce(
      (sum, transaction) => sum + Number(transaction.amount || 0),
      0
    );

    const previousWeekTotal = previousWeekExpenses.reduce(
      (sum, transaction) => sum + Number(transaction.amount || 0),
      0
    );

    const groupedCategories = currentWeekExpenses.reduce<Record<string, number>>((acc, transaction) => {
      const category =
        transaction.category && transaction.category.trim() !== ""
          ? transaction.category
          : "Outros";

      acc[category] = (acc[category] || 0) + Number(transaction.amount || 0);
      return acc;
    }, {});

    const orderedCategories = Object.entries(groupedCategories)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    const topCategory = orderedCategories[0] || null;
    const topGoalsAtRisk = goalPaceSummary
      .filter((item) => item.paceStatus === "off_track" || item.paceStatus === "attention")
      .sort((a, b) => Math.abs(b.paceDifference) - Math.abs(a.paceDifference))
      .slice(0, 3);

    const variationFromPreviousWeek = currentWeekTotal - previousWeekTotal;
    let status: "controlada" | "atenção" | "fora do plano" = "controlada";

    if (topGoalsAtRisk.some((item) => item.paceStatus === "off_track") || currentWeekTotal >= 1200) {
      status = "fora do plano";
    } else if (topGoalsAtRisk.length > 0 || currentWeekTotal >= 700) {
      status = "atenção";
    }

    let recommendation = "Continue no ritmo atual e mantenha o fechamento diário em dia.";
    if (status === "fora do plano") {
      if (topCategory?.category) {
        recommendation = `Reduza ${topCategory.category.toLowerCase()} nesta semana e evite novos parcelamentos até recuperar folga.`;
      } else {
        recommendation = "Segure gastos variáveis nesta semana e revise as categorias mais pressionadas.";
      }
    } else if (status === "atenção") {
      if (topCategory?.category) {
        recommendation = `Acompanhe ${topCategory.category.toLowerCase()} de perto nos próximos dias para não estourar o ritmo do mês.`;
      } else {
        recommendation = "A semana pede atenção: revise alertas e compromissos antes de gastar.";
      }
    }

    return {
      currentWeekTotal,
      previousWeekTotal,
      variationFromPreviousWeek,
      status,
      topCategory,
      topGoalsAtRisk,
      recommendation,
      transactionsCount: currentWeekExpenses.length,
    };
  }, [goalPaceSummary, transactions]);

  const dailyReviewSummary = useMemo(() => {
    const now = new Date();
    const isCurrentSelectedMonth =
      now.getFullYear() === selectedMonthMeta.year &&
      now.getMonth() + 1 === selectedMonthMeta.month;

    const reviewDay = isCurrentSelectedMonth
      ? Math.min(now.getDate(), selectedMonthMeta.daysInMonth)
      : Math.min(
          Math.max(Number(spendingCapacitySummary.referenceDay || 1), 1),
          selectedMonthMeta.daysInMonth
        );

    const dateKey = `${selectedMonth}-${String(reviewDay).padStart(2, "0")}`;
    const reviewDate = new Date(
      selectedMonthMeta.year,
      selectedMonthMeta.month - 1,
      reviewDay
    );

    const emptyChecklist: DailyReviewChecklist = {
      transactions: false,
      alerts: false,
      commitments: false,
      balance: false,
    };

    const currentEntry = dailyReviewHistory[dateKey] || {
      dateKey,
      completed: false,
      checklist: emptyChecklist,
    };

    const checkedCount = Object.values(currentEntry.checklist).filter(Boolean).length;
    const totalItems = Object.keys(emptyChecklist).length;
    const pendingCount = Math.max(totalItems - checkedCount, 0);

    const completedEntries = Object.values(dailyReviewHistory)
      .filter((entry) => entry.completed)
      .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));

    const recentCompletedDays = completedEntries.slice(0, 5).map((entry) => {
      const [, year, month, day] = entry.dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
      const label =
        year && month && day
          ? new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })
          : entry.dateKey;

      return {
        ...entry,
        label,
      };
    });

    let suggestedFocus = "confirmar o saldo do dia";
    if (pendingCount > 0) {
      if (!currentEntry.checklist.transactions) suggestedFocus = "lançar o que entrou ou saiu hoje";
      else if (!currentEntry.checklist.alerts) suggestedFocus = "revisar alertas e prioridades";
      else if (!currentEntry.checklist.commitments) suggestedFocus = "checar próximos compromissos";
      else suggestedFocus = "confirmar o saldo do dia";
    } else if (visibleActionCenterAlerts.length > 0) {
      suggestedFocus = "agir no alerta mais urgente";
    }

    return {
      dateKey,
      currentEntry,
      reviewLabel: reviewDate.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
      }),
      isCurrentSelectedMonth,
      checkedCount,
      totalItems,
      pendingCount,
      completedDays: completedEntries.length,
      suggestedFocus,
      recentCompletedDays,
    };
  }, [
    dailyReviewHistory,
    selectedMonth,
    selectedMonthMeta.daysInMonth,
    selectedMonthMeta.month,
    selectedMonthMeta.year,
    spendingCapacitySummary.referenceDay,
    visibleActionCenterAlerts,
  ]);


const dataHealthSummary = useMemo(() => {
    const duplicateTransactionMap = filteredTransactions.reduce<Record<string, number>>((acc, transaction) => {
      const transactionDate = new Date(transaction.date);
      const key = [
        normalizeComparableText(transaction.title),
        Math.round(Number(transaction.amount || 0) * 100),
        normalizeComparableText(transaction.type),
        transactionDate.toISOString().slice(0, 10),
        normalizeComparableText(transaction.category),
        normalizeComparableText(transaction.paymentMethod),
      ].join("|");

      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const duplicateTransactionsCount = Object.values(duplicateTransactionMap).filter((count) => count > 1).length;

    const orphanCreditCardTransactionsCount = filteredTransactions.filter((transaction) => {
      return (
        isExpenseType(transaction.type) &&
        !isAdjustmentTransaction(transaction) &&
        normalizeComparableText(transaction.paymentMethod) === "credit_card" &&
        (!transaction.cardId || !transaction.invoiceId)
      );
    }).length;

    const installmentWithoutGroupCount = transactions.filter((transaction) => {
      return isInstallmentTransaction(transaction) && !isAdjustmentTransaction(transaction) && !transaction.purchaseGroupId;
    }).length;

    const duplicateInstallmentByGroupCount = Object.values(
      transactions
        .filter((transaction) => isInstallmentTransaction(transaction) && !isAdjustmentTransaction(transaction) && transaction.purchaseGroupId)
        .reduce<Record<string, number>>((acc, transaction) => {
          const installmentInfo = extractInstallmentInfo(transaction.title);
          const installmentNumber =
            Number(transaction.installmentNumber || installmentInfo?.current || 0);
          const key = [
            transaction.purchaseGroupId,
            installmentNumber,
            Math.round(Number(transaction.amount || 0) * 100),
          ].join("|");

          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
    ).filter((count) => count > 1).length;

    const recurringDuplicateMatchesCount = recurrings
      .filter((recurring) => recurring.active)
      .filter((recurring) => {
        const recurringDay = Math.min(
          Math.max(Number(recurring.dayOfMonth || 1), 1),
          selectedMonthMeta.daysInMonth
        );

        const matches = filteredTransactions.filter((transaction) => {
          const transactionDate = new Date(transaction.date);
          const sameTitle =
            normalizeComparableText(transaction.title) === normalizeComparableText(recurring.title) ||
            normalizeComparableText(transaction.title).startsWith(`${normalizeComparableText(recurring.title)} (`);
          const sameAmount =
            Math.round(Number(transaction.amount || 0) * 100) ===
            Math.round(Number(recurring.amount || 0) * 100);
          const sameType =
            normalizeComparableText(transaction.type) === normalizeComparableText(recurring.type);
          const sameCategory =
            normalizeComparableText(transaction.category) === normalizeComparableText(recurring.category);
          const samePaymentMethod =
            normalizeComparableText(transaction.paymentMethod) === normalizeComparableText(recurring.paymentMethod);
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
        });

        return matches.length > 1;
      }).length;

    const paidAndOpenInvoiceGroupsCount = Object.values(
      invoices.reduce<Record<string, { hasPaid: boolean; hasOpen: boolean }>>((acc, invoice) => {
        const key = [invoice.cardId, invoice.month, invoice.year].join("|");
        if (!acc[key]) {
          acc[key] = { hasPaid: false, hasOpen: false };
        }

        if (invoice.status === "PAID") {
          acc[key].hasPaid = true;
        }

        if (invoice.status === "OPEN") {
          acc[key].hasOpen = true;
        }

        return acc;
      }, {})
    ).filter((item) => item.hasPaid && item.hasOpen).length;

    const paidInvoicesWithoutSourceAccountCount = invoices.filter((invoice) => {
      return invoice.status === "PAID" && !invoice.paidFromAccountId;
    }).length;

    const cardAttentionCount = orphanCreditCardTransactionsCount + paidAndOpenInvoiceGroupsCount;

    const criticalIssues = [
      duplicateTransactionsCount > 0 ? 1 : 0,
      duplicateInstallmentByGroupCount > 0 ? 1 : 0,
      orphanCreditCardTransactionsCount > 0 ? 1 : 0,
      recurringDuplicateMatchesCount > 0 ? 1 : 0,
      paidAndOpenInvoiceGroupsCount > 0 ? 1 : 0,
    ].reduce((sum, item) => sum + item, 0);

    const warningIssues = [
      installmentWithoutGroupCount > 0 ? 1 : 0,
      paidInvoicesWithoutSourceAccountCount > 0 ? 1 : 0,
      openInvoices.length > 0 && currentAccountsBalance < openInvoicesTotal ? 1 : 0,
      monthlyRecurringProjection.pendingExpenseItems.length + monthlyRecurringProjection.pendingIncomeItems.length > 8 ? 1 : 0,
    ].reduce((sum, item) => sum + item, 0);

    const checks = [
      {
        id: "paid-open-same-invoice",
        label: "Fatura paga ainda aparece como aberta",
        tone: paidAndOpenInvoiceGroupsCount > 0 ? ("danger" as const) : ("success" as const),
        value:
          paidAndOpenInvoiceGroupsCount > 0
            ? `${paidAndOpenInvoiceGroupsCount} fatura(s) com status pago + aberto`
            : "Nenhum conflito entre faturas pagas e abertas",
        help:
          paidAndOpenInvoiceGroupsCount > 0
            ? "Pode haver uma fatura já paga que continua pressionando a projeção."
            : "As faturas pagas não estão reaparecendo como abertas.",
      },
      {
        id: "recurring-generation",
        label: "Recorrência que parece já ter sido gerada",
        tone:
          recurringDuplicateMatchesCount > 0
            ? ("danger" as const)
            : monthlyRecurringProjection.pendingExpenseItems.length + monthlyRecurringProjection.pendingIncomeItems.length > 8
            ? ("warning" as const)
            : ("success" as const),
        value:
          recurringDuplicateMatchesCount > 0
            ? `${recurringDuplicateMatchesCount} recorrência(s) com sinal de duplicidade`
            : `${monthlyRecurringProjection.pendingExpenseItems.length + monthlyRecurringProjection.pendingIncomeItems.length} pendente(s) para gerar`,
        help:
          recurringDuplicateMatchesCount > 0
            ? "Há recorrência com cara de já ter sido lançada mais de uma vez neste mês."
            : "A fila de recorrências está sob controle no mês selecionado.",
      },
      {
        id: "credit-card-link",
        label: "Transação de cartão sem fatura associada",
        tone:
          orphanCreditCardTransactionsCount > 0 ? ("danger" as const) : ("success" as const),
        value:
          orphanCreditCardTransactionsCount > 0
            ? `${orphanCreditCardTransactionsCount} compra(s) no crédito sem vínculo`
            : "Compras no crédito vinculadas corretamente",
        help:
          orphanCreditCardTransactionsCount > 0
            ? "Revise compras no crédito sem cartão ou sem invoiceId."
            : "As compras no crédito estão ligadas ao cartão e à fatura.",
      },
      {
        id: "duplicate-installment-group",
        label: "Parcela duplicada no mesmo grupo",
        tone:
          duplicateInstallmentByGroupCount > 0 ? ("danger" as const) : ("success" as const),
        value:
          duplicateInstallmentByGroupCount > 0
            ? `${duplicateInstallmentByGroupCount} parcela(s) repetidas no grupo`
            : "Sem parcelas duplicadas por grupo",
        help:
          duplicateInstallmentByGroupCount > 0
            ? "Pode haver a mesma parcela registrada mais de uma vez na mesma compra."
            : "As parcelas agrupadas parecem consistentes.",
      },
      {
        id: "accounts-vs-invoices",
        label: "Contas x faturas abertas",
        tone:
          openInvoices.length > 0 && currentAccountsBalance < openInvoicesTotal
            ? ("warning" as const)
            : ("success" as const),
        value:
          openInvoices.length > 0
            ? `${formatCurrency(currentAccountsBalance)} vs ${formatCurrency(openInvoicesTotal)}`
            : "Sem pressão de faturas abertas",
        help:
          openInvoices.length > 0 && currentAccountsBalance < openInvoicesTotal
            ? "As contas atuais não cobrem todas as faturas abertas."
            : "A base de contas e faturas está coerente para a leitura do mês.",
      },
      {
        id: "duplicate-transactions",
        label: "Possíveis lançamentos duplicados",
        tone: duplicateTransactionsCount > 0 ? ("danger" as const) : ("success" as const),
        value:
          duplicateTransactionsCount > 0
            ? `${duplicateTransactionsCount} grupo(s) com duplicidade`
            : "Sem duplicidade aparente",
        help:
          duplicateTransactionsCount > 0
            ? "Revise transações iguais no mesmo dia, com mesmo valor e tipo."
            : "Nenhum lançamento repetido foi detectado no mês selecionado.",
      },
      {
        id: "installment-groups",
        label: "Parcelas sem grupo",
        tone:
          installmentWithoutGroupCount > 0 ? ("warning" as const) : ("success" as const),
        value:
          installmentWithoutGroupCount > 0
            ? `${installmentWithoutGroupCount} parcela(s) sem grupo`
            : "Parcelas agrupadas corretamente",
        help:
          installmentWithoutGroupCount > 0
            ? "Isso pode atrapalhar a leitura futura e o controle por compra."
            : "As compras parceladas estão estruturadas para projeção futura.",
      },
      {
        id: "paid-invoice-source-account",
        label: "Fatura paga sem conta de origem",
        tone:
          paidInvoicesWithoutSourceAccountCount > 0 ? ("warning" as const) : ("success" as const),
        value:
          paidInvoicesWithoutSourceAccountCount > 0
            ? `${paidInvoicesWithoutSourceAccountCount} fatura(s) pagas sem conta vinculada`
            : "Pagamentos de fatura com origem definida",
        help:
          paidInvoicesWithoutSourceAccountCount > 0
            ? "Vale revisar de qual conta saiu o pagamento da fatura."
            : "Os pagamentos de fatura têm rastreabilidade melhor.",
      },
    ];

    let diagnosisTone: "success" | "warning" | "danger" = "success";
    let diagnosisTitle = "Tudo certo";
    let diagnosisMessage = "Os dados principais parecem consistentes para uso diário.";

    if (duplicateTransactionsCount > 0 || duplicateInstallmentByGroupCount > 0) {
      diagnosisTone = "danger";
      diagnosisTitle = "Possível duplicidade";
      diagnosisMessage = "Há sinais de lançamentos ou parcelas repetidas que podem distorcer o mês.";
    } else if (cardAttentionCount > 0) {
      diagnosisTone = "warning";
      diagnosisTitle = "Atenção em cartões";
      diagnosisMessage = "Há compras no crédito ou faturas que merecem revisão antes de confiar totalmente na projeção.";
    } else if (criticalIssues > 0) {
      diagnosisTone = "danger";
      diagnosisTitle = "Revisão recomendada";
      diagnosisMessage = "Há pontos que podem distorcer saldo, cartão ou recorrência.";
    } else if (warningIssues > 0) {
      diagnosisTone = "warning";
      diagnosisTitle = "Projeção confiável";
      diagnosisMessage = "A base está boa, mas alguns detalhes ainda merecem conferência.";
    }

    return {
      diagnosisTone,
      diagnosisTitle,
      diagnosisMessage,
      criticalIssues,
      warningIssues,
      checks,
      stats: {
        duplicateTransactionsCount,
        orphanCreditCardTransactionsCount,
        installmentWithoutGroupCount,
        recurringDuplicateMatchesCount,
        duplicateInstallmentByGroupCount,
        paidAndOpenInvoiceGroupsCount,
        paidInvoicesWithoutSourceAccountCount,
      },
    };
  }, [
    currentAccountsBalance,
    filteredTransactions,
    invoices,
    monthlyRecurringProjection.pendingExpenseItems.length,
    monthlyRecurringProjection.pendingIncomeItems.length,
    openInvoices.length,
    openInvoicesTotal,
    recurrings,
    selectedMonthMeta.daysInMonth,
    transactions,
  ]);

  function handleGoalInputChange(category: string, value: string) {
    setGoalInputs((prev) => ({
      ...prev,
      [category]: value,
    }));
  }

  function runCutSimulation(category: string, amount: number, percent?: number | null) {
    setSimulatedCutCategory(category);
    setSimulatedCutAmount(Number(amount.toFixed(2)));
    setSimulatedCutPercent(percent ?? null);
  }

  function clearCutSimulation() {
    setSimulatedCutCategory(null);
    setSimulatedCutAmount(0);
    setSimulatedCutPercent(null);
  }

  function saveCurrentCutPlan() {
    if (!simulatedCutCategory || simulatedCutAmount <= 0) return;

    const nextPlan = {
      ...savedCutPlan,
      [simulatedCutCategory]: simulatedCutAmount,
    };

    setSavedCutPlan(nextPlan);
    localStorage.setItem(getCutPlanStorageKey(selectedMonth), JSON.stringify(nextPlan));
    showToast(
      "Meta de corte salva",
      `Plano mensal salvo para ${simulatedCutCategory}: ${formatCurrency(simulatedCutAmount)}.`,
      "success"
    );
  }

  function removeSavedCutPlan(category: string) {
    const nextPlan = { ...savedCutPlan };
    delete nextPlan[category];
    setSavedCutPlan(nextPlan);
    localStorage.setItem(getCutPlanStorageKey(selectedMonth), JSON.stringify(nextPlan));
  }

  function persistAlertState(nextStates: Record<string, AlertStateItem>) {
    setAlertStates(nextStates);
    localStorage.setItem(getAlertStateStorageKey(selectedMonth), JSON.stringify(nextStates));
  }

  function markAlertResolved(alertId: string) {
    const nextStates = {
      ...alertStates,
      [alertId]: {
        status: "resolved" as const,
        updatedAt: new Date().toISOString(),
        monthKey: selectedMonth,
      },
    };

    persistAlertState(nextStates);
    showToast("Alerta resolvido", "Ele foi movido para alertas tratados.", "success");
  }

  function remindAlertLater(alertId: string) {
    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + 3);

    const nextStates = {
      ...alertStates,
      [alertId]: {
        status: "later" as const,
        updatedAt: new Date().toISOString(),
        snoozeUntil: snoozeUntil.toISOString(),
        monthKey: selectedMonth,
      },
    };

    persistAlertState(nextStates);
    showToast("Alerta adiado", "Ele vai reaparecer em 3 dias.", "info");
  }

  function ignoreAlertThisMonth(alertId: string) {
    const nextStates = {
      ...alertStates,
      [alertId]: {
        status: "ignored" as const,
        updatedAt: new Date().toISOString(),
        monthKey: selectedMonth,
      },
    };

    persistAlertState(nextStates);
    showToast("Alerta ignorado", "Ele não volta neste mês.", "info");
  }

  function reactivateAlert(alertId: string) {
    const nextStates = { ...alertStates };
    delete nextStates[alertId];
    persistAlertState(nextStates);
    showToast("Alerta reativado", "Ele voltou para a lista principal.", "success");
  }

  function persistDailyReview(nextHistory: Record<string, DailyReviewEntry>) {
    setDailyReviewHistory(nextHistory);
    localStorage.setItem(
      getDailyReviewStorageKey(selectedMonth),
      JSON.stringify(nextHistory)
    );
  }

  function toggleDailyReviewItem(
    dateKey: string,
    item: keyof DailyReviewChecklist
  ) {
    const currentEntry = dailyReviewHistory[dateKey] || {
      dateKey,
      completed: false,
      checklist: {
        transactions: false,
        alerts: false,
        commitments: false,
        balance: false,
      },
    };

    const nextChecklist = {
      ...currentEntry.checklist,
      [item]: !currentEntry.checklist[item],
    };

    const allDone = Object.values(nextChecklist).every(Boolean);

    const nextHistory = {
      ...dailyReviewHistory,
      [dateKey]: {
        ...currentEntry,
        checklist: nextChecklist,
        completed: allDone,
        completedAt: allDone ? new Date().toISOString() : currentEntry.completedAt,
      },
    };

    persistDailyReview(nextHistory);
  }

  function markDailyReviewComplete(dateKey: string) {
    const currentEntry = dailyReviewHistory[dateKey] || {
      dateKey,
      completed: false,
      checklist: {
        transactions: false,
        alerts: false,
        commitments: false,
        balance: false,
      },
    };

    const nextHistory = {
      ...dailyReviewHistory,
      [dateKey]: {
        ...currentEntry,
        completed: true,
        completedAt: new Date().toISOString(),
        checklist: {
          transactions: true,
          alerts: true,
          commitments: true,
          balance: true,
        },
      },
    };

    persistDailyReview(nextHistory);
    showToast("Dia revisado", "Seu fechamento diário foi salvo.", "success");
  }

  function reopenDailyReview(dateKey: string) {
    const currentEntry = dailyReviewHistory[dateKey];
    if (!currentEntry) return;

    const nextHistory = {
      ...dailyReviewHistory,
      [dateKey]: {
        ...currentEntry,
        completed: false,
      },
    };

    persistDailyReview(nextHistory);
    showToast("Revisão reaberta", "Você pode ajustar o checklist deste dia.", "info");
  }

  function handleActionCenterAlertPrimaryAction(alert: ActionCenterAlert) {
    const title = alert.title.toLowerCase();
    const categoryMatch = GOAL_CATEGORIES.find((category) =>
      title.includes(category.toLowerCase())
    );

    if (categoryMatch) {
      const suggestionBase = Math.max(
        Number(categorySpentMap[categoryMatch] || 0) * 0.1,
        50
      );
      runCutSimulation(categoryMatch, suggestionBase);
      showToast(
        "Corte sugerido aplicado",
        `Simulação criada para ${categoryMatch} com corte de ${formatCurrency(suggestionBase)}.`,
        "success"
      );
      return;
    }

    if (title.includes("economia") || title.includes("folga") || title.includes("saldo")) {
      if (categorySuggestion?.categories?.[0]) {
        const firstCategory = categorySuggestion.categories[0].category;
        const amount = Math.max(Number(categorySuggestion.suggestedCut || 0), 50);
        runCutSimulation(firstCategory, amount);
        showToast(
          "Plano iniciado",
          `Simulação criada em ${firstCategory} com ajuste de ${formatCurrency(amount)}.`,
          "success"
        );
        return;
      }
    }

    if (title.includes("plano de economia")) {
      showToast("Plano ativo", "Seu plano já está salvo e segue valendo neste mês.", "info");
      return;
    }

    showToast("Ação registrada", alert.action, "info");
  }

  function getHandledAlertLabel(state?: AlertStateItem) {
    if (!state) return "Tratado";
    if (state.status === "resolved") return "Resolvido";
    if (state.status === "ignored") return "Ignorado no mês";
    if (state.status === "later") return "Lembrar depois";
    return "Tratado";
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


  const monthClaritySummary = useMemo(() => {
    if (projectedBalanceReal < 0) {
      return {
        tone: "danger" as const,
        title: "Mês em risco",
        summary: `A projeção está negativa em ${formatCurrency(Math.abs(projectedBalanceReal))}.`,
      };
    }

    if (spendingCapacitySummary.extraSafeSpend <= 0) {
      return {
        tone: "danger" as const,
        title: "Sem folga para gastar",
        summary: "Qualquer gasto novo pode apertar seu mês.",
      };
    }

    if (spendingCapacitySummary.extraSafeSpend < 300 || openInvoicesTotal > currentAccountsBalance) {
      return {
        tone: "warning" as const,
        title: "Mês apertado",
        summary: `Sua margem segura no mês está em ${formatCurrency(spendingCapacitySummary.extraSafeSpend)}.`,
      };
    }

    if (balanceMonth < 0) {
      return {
        tone: "warning" as const,
        title: "Resultado do mês negativo",
        summary: `O mês está fechando em ${formatCurrency(balanceMonth)} até agora.`,
      };
    }

    return {
      tone: "success" as const,
      title: "Mês sob controle",
      summary: `Você ainda tem ${formatCurrency(spendingCapacitySummary.extraSafeSpend)} de margem segura neste mês.`,
    };
  }, [
    balanceMonth,
    currentAccountsBalance,
    openInvoicesTotal,
    projectedBalanceReal,
    spendingCapacitySummary.extraSafeSpend,
  ]);

  const topCategoriesOutOfPace = useMemo<CategoryOutOfPaceItem[]>(() => {
    return goalPaceSummary
      .filter((item) => item.goal > 0)
      .filter(
        (item) => item.paceStatus === "off_track" || item.paceStatus === "attention"
      )
      .sort(
        (a, b) =>
          Math.abs(Number(b.paceDifference || 0)) -
          Math.abs(Number(a.paceDifference || 0))
      )
      .slice(0, 3)
      .map((item) => {
        const paceDifference = Math.abs(Number(item.paceDifference || 0));
        const adjustedPercentage = Number(item.adjustedPercentage || 0);

        return {
          ...item,
          paceDifference,
          adjustedPercentage,
          shortLabel: getCategoryLabel(item.category),
          shortStatus: getPaceStatusLabel(item.paceStatus),
          actionHint: getImmediateCategoryAction(item.category),
          recoveryHint: getPaceRecoveryHint(
            paceDifference,
            spendingCapacitySummary.daysRemaining,
            spendingCapacitySummary.isCurrentSelectedMonth
          ),
        } as CategoryOutOfPaceItem;
      });
  }, [
    goalPaceSummary,
    spendingCapacitySummary.daysRemaining,
    spendingCapacitySummary.isCurrentSelectedMonth,
  ]);

  const supportingCategoriesOutOfPace = useMemo<CategoryOutOfPaceItem[]>(() => {
    return topCategoriesOutOfPace.slice(1, 3);
  }, [topCategoriesOutOfPace]);

  const assistantSummary = useMemo(() => {
    const now = new Date();
    const selectedMonthStart = new Date(
      selectedMonthMeta.year,
      selectedMonthMeta.month - 1,
      1
    );
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthDifference =
      (selectedMonthStart.getFullYear() - currentMonthStart.getFullYear()) * 12 +
      (selectedMonthStart.getMonth() - currentMonthStart.getMonth());

    const isCurrentSelectedMonth = monthDifference === 0;
    const isPastSelectedMonth = monthDifference < 0;
    const isFutureSelectedMonth = monthDifference > 0;

    const todayKey = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    const todayTransactions = isCurrentSelectedMonth
      ? filteredTransactions.filter(
          (transaction) =>
            transaction.date?.slice(0, 10) === todayKey &&
            !isAdjustmentTransaction(transaction)
        )
      : [];

    const spentToday = todayTransactions
      .filter((transaction) => isExpenseType(transaction.type))
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const hasTransactionsToday = todayTransactions.length > 0;
    const hasNoBalance = currentAccountsBalance <= 0;
    const hasOpenInvoice = openInvoicesTotal > 0;
    const mainCategory: CategoryOutOfPaceItem | null = topCategoriesOutOfPace.length > 0 ? topCategoriesOutOfPace[0] : null;

    const focusLabel =
      isCurrentSelectedMonth && (monthClaritySummary.tone === "danger" || monthClaritySummary.tone === "warning")
        ? "Compromisso de hoje"
        : isCurrentSelectedMonth
        ? "Foco principal de hoje"
        : "Foco principal deste mês";

    const dailyLimitText =
      spendingCapacitySummary.safeDailySpend <= 0
        ? isCurrentSelectedMonth
          ? "Hoje, o ideal é não criar nenhum gasto novo."
          : "Neste cenário, o ideal é não abrir novos gastos variáveis."
        : isCurrentSelectedMonth
        ? `Você pode gastar até ${formatCurrency(
            spendingCapacitySummary.safeDailySpend
          )} hoje sem comprometer o mês.`
        : `Seu limite diário médio neste mês está em ${formatCurrency(
            spendingCapacitySummary.safeDailySpend
          )}.`;

    const dailyLimitSupport =
      spendingCapacitySummary.safeDailySpend <= 0
        ? "Seu mês está sem margem de segurança neste momento."
        : spendingCapacitySummary.isNegativeScenario
        ? "Mesmo com esse limite, siga com bastante cautela."
        : isFutureSelectedMonth
        ? `Essa leitura mostra a margem estimada para ${formatMonthYear(selectedDate)}.`
        : `Isso considera sua menor projeção até ${formatMonthYear(selectedDate)}.`;

    const quickContext = [
      openInvoicesTotal > 0 ? `${formatCurrency(openInvoicesTotal)} em faturas abertas` : null,
      isCurrentSelectedMonth && spentToday > 0 ? `${formatCurrency(spentToday)} gasto hoje` : null,
      mainCategory
        ? `${mainCategory.category} acima do ritmo em ${formatCurrency(mainCategory.paceDifference)}`
        : null,
      !isCurrentSelectedMonth && balanceMonth !== 0
        ? `Resultado parcial do mês em ${formatCurrency(balanceMonth)}`
        : null,
    ].filter(Boolean) as string[];

    if (isCurrentSelectedMonth && spentToday > 0 && hasNoBalance && hasOpenInvoice) {
      return {
        tone: "danger" as const,
        status: "Atenção máxima",
        alert: `Você já gastou ${formatCurrency(
          spentToday
        )} hoje, está sem saldo em conta e ainda tem faturas em aberto.`,
        focusLabel,
        action: "Evite usar o cartão hoje",
        actionDetail: "Priorize só o essencial até recuperar margem.",
        actionReason: "Essa é a ação com maior impacto imediato no seu caixa.",
        actionImpact: "Um dia mais contido já reduz a chance de empurrar mais pressão para a próxima fatura.",
        dailyLimit: dailyLimitText,
        dailyLimitSupport,
        secondaryAlert: quickContext[0] || null,
      };
    }

    if (isCurrentSelectedMonth && !hasTransactionsToday) {
      return {
        tone: "warning" as const,
        status: "Dia sem registros",
        alert: "Você ainda não registrou nada hoje.",
        focusLabel,
        action: "Lance o que entrou e saiu antes de decidir novos gastos",
        actionDetail: "Sem o dia registrado, o assistente perde precisão.",
        actionReason: "Hoje, clareza vem antes de qualquer outra decisão.",
        actionImpact: "Quando o dia está atualizado, o limite e a prioridade do assistente ficam mais confiáveis.",
        dailyLimit: dailyLimitText,
        dailyLimitSupport,
        secondaryAlert: quickContext[0] || null,
      };
    }

    if (monthClaritySummary.tone === "danger") {
      return {
        tone: "danger" as const,
        status: monthClaritySummary.title,
        alert: mainCategory
          ? `Você já está ${formatCurrency(mainCategory.paceDifference)} acima do ritmo em ${mainCategory.category}.`
          : monthClaritySummary.summary,
        focusLabel,
        action: mainCategory
          ? mainCategory.actionHint
          : isCurrentSelectedMonth
          ? "Segure gastos variáveis hoje"
          : "Reduza gastos variáveis neste mês",
        actionDetail: mainCategory
          ? mainCategory.recoveryHint
          : "O foco agora é preservar caixa até o mês ganhar folga.",
        actionReason: mainCategory
          ? "Essa categoria é a que mais aumenta a pressão do mês agora."
          : "Seu mês precisa de proteção imediata antes de qualquer outro movimento.",
        actionImpact: mainCategory
          ? `Se você segurar ${mainCategory.category.toLowerCase()} agora, a pressão do mês começa a ceder mais rápido.`
          : "Menos gasto variável agora significa mais margem para atravessar o mês sem apertar ainda mais o caixa.",
        dailyLimit: dailyLimitText,
        dailyLimitSupport,
        secondaryAlert: quickContext[0] || null,
      };
    }

    if (mainCategory) {
      const isOffTrack = mainCategory.paceStatus === "off_track";

      return {
        tone: isOffTrack ? ("warning" as const) : ("info" as const),
        status: isOffTrack ? "Categoria acelerou" : "Categoria pedindo atenção",
        alert: `Você já está ${formatCurrency(
          mainCategory.paceDifference
        )} acima do ritmo em ${mainCategory.category} neste mês.`,
        focusLabel,
        action: mainCategory.actionHint,
        actionDetail: mainCategory.recoveryHint,
        actionReason: "Focar só nessa frente agora já melhora seu mês sem espalhar atenção.",
        actionImpact: `Controlar ${mainCategory.category.toLowerCase()} primeiro tende a devolver margem mais rápido do que tentar mexer em várias frentes ao mesmo tempo.`,
        dailyLimit: dailyLimitText,
        dailyLimitSupport,
        secondaryAlert: quickContext[0] || null,
      };
    }

    if (monthClaritySummary.tone === "warning") {
      return {
        tone: "warning" as const,
        status: monthClaritySummary.title,
        alert: monthClaritySummary.summary,
        focusLabel,
        action: isCurrentSelectedMonth ? "Evite compras por impulso hoje" : "Reduza compras por impulso neste mês",
        actionDetail: "Seu mês ainda está controlado, mas com menos folga do que parece.",
        actionReason: "Um ajuste simples agora já ajuda a devolver margem para o restante do mês.",
        actionImpact: "Você não precisa cortar tudo; precisa só evitar o que não move sua vida financeira para frente.",
        dailyLimit: dailyLimitText,
        dailyLimitSupport,
        secondaryAlert: quickContext[0] || null,
      };
    }

    if (isPastSelectedMonth) {
      return {
        tone: "success" as const,
        status: "Mês encerrado",
        alert: "Use essa leitura para entender padrões e ajustar o próximo mês com mais precisão.",
        focusLabel: "Principal aprendizado",
        action: "Observe o que mais pressionou seu resultado",
        actionDetail: mainCategory
          ? `${mainCategory.category} foi a categoria que mais saiu do ritmo neste período.`
          : "Seu fechamento está estável e pode servir de referência para os próximos meses.",
        actionReason: "Quando você aprende com o mês fechado, decide melhor antes do problema aparecer de novo.",
        actionImpact: "Esse fechamento vira base para metas mais realistas e alertas mais úteis daqui para frente.",
        dailyLimit: dailyLimitText,
        dailyLimitSupport,
        secondaryAlert: quickContext[0] || null,
      };
    }

    return {
      tone: "success" as const,
      status: monthClaritySummary.title,
      alert: monthClaritySummary.summary,
      focusLabel,
      action: isFutureSelectedMonth ? "Mantenha essa estrutura ao longo do mês" : "Mantenha o ritmo atual",
      actionDetail: isFutureSelectedMonth
        ? "A projeção está saudável. O objetivo agora é proteger essa margem quando o mês começar."
        : "Seu cenário está saudável. O melhor movimento agora é constância.",
      actionReason: "Quando o mês já está sob controle, não vale criar regra nova sem necessidade.",
      actionImpact: "A melhor forma de manter folga é repetir o que já está funcionando, sem relaxar nos detalhes.",
      dailyLimit: dailyLimitText,
      dailyLimitSupport,
      secondaryAlert: quickContext[0] || null,
    };
  }, [
    balanceMonth,
    currentAccountsBalance,
    filteredTransactions,
    monthClaritySummary,
    openInvoicesTotal,
    selectedDate,
    selectedMonthMeta.month,
    selectedMonthMeta.year,
    spendingCapacitySummary.isNegativeScenario,
    spendingCapacitySummary.safeDailySpend,
    topCategoriesOutOfPace,
  ]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-2 sm:p-3 md:p-8">
      {toast.visible ? (
        <div className="pointer-events-none fixed inset-x-2 top-3 z-50 w-auto max-w-sm sm:right-4 sm:left-auto">
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
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmDeleteRecurring}
                disabled={recurringActionId === deleteConfirm.id}
                className="rounded-2xl bg-rose-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {recurringActionId === deleteConfirm.id ? "Excluindo..." : "Excluir recorrência"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl space-y-4 md:space-y-6">
        <header className="rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:rounded-[28px] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-slate-500">Início</p>
              <h1 className="mt-1 text-2xl leading-tight font-bold text-slate-900 md:text-3xl">
                Sua organização financeira, sem excesso
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Veja seu momento, entenda a próxima ação e entre nos detalhes só quando precisar.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 lg:max-w-xs">
              <label className="text-sm font-medium text-slate-700">
                Filtrar por mês
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3.5 text-base outline-none transition duration-200 placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-[22px] border border-slate-200/70 bg-slate-50 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Saldo hoje</p>
              <p className="mt-2 text-xl font-bold text-slate-900 md:text-2xl">{formatCurrency(currentAccountsBalance)}</p>
            </div>

            <div className="rounded-[22px] border border-slate-200/70 bg-slate-50 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Resultado do mês</p>
              <p className={`mt-2 text-xl font-bold md:text-2xl ${balanceMonth >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(balanceMonth)}</p>
            </div>

            <div className="rounded-[22px] border border-slate-200/70 bg-slate-50 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Faturas abertas</p>
              <p className="mt-2 text-xl font-bold text-slate-900 md:text-2xl">{formatCurrency(openInvoicesTotal)}</p>
            </div>

            <div className="rounded-[22px] border border-slate-200/70 bg-slate-50 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Gasto seguro</p>
              <p className={`mt-2 text-xl font-bold md:text-2xl ${spendingCapacitySummary.extraSafeSpend > 0 ? "text-sky-700" : "text-rose-600"}`}>{formatCurrency(spendingCapacitySummary.extraSafeSpend)}</p>
            </div>
          </div>
        </header>

        <section className="rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:rounded-[28px] md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Assistente financeiro</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Leitura simples do mês</h2>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                monthClaritySummary.tone === "danger"
                  ? "bg-rose-100 text-rose-700"
                  : monthClaritySummary.tone === "warning"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {monthClaritySummary.title}
            </span>
          </div>

          <div
            className={`mt-4 rounded-2xl border px-4 py-4 ${
              assistantSummary.tone === "danger"
                ? "border-rose-200 bg-rose-50"
                : assistantSummary.tone === "warning"
                ? "border-amber-200 bg-amber-50"
                : assistantSummary.tone === "info"
                ? "border-sky-200 bg-sky-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                assistantSummary.tone === "danger"
                  ? "text-rose-900"
                  : assistantSummary.tone === "warning"
                  ? "text-amber-900"
                  : assistantSummary.tone === "info"
                  ? "text-sky-900"
                  : "text-emerald-900"
              }`}
            >
              {assistantSummary.status}
            </p>
            <p className="mt-1 text-sm text-slate-700">{assistantSummary.alert}</p>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{assistantSummary.focusLabel}</p><span className="inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">Prioridade 1</span></div>
              <p className="mt-1 text-sm font-medium text-slate-700">{assistantSummary.action}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{assistantSummary.actionDetail}</p>
              <p className="mt-2 text-xs font-medium text-slate-700">{assistantSummary.actionReason}</p>
              <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Impacto esperado</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{assistantSummary.actionImpact}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">Limite de hoje</p>
              <p className="mt-1 text-sm font-medium text-slate-700">{assistantSummary.dailyLimit}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{assistantSummary.dailyLimitSupport}</p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">Depois da prioridade 1</p>
              <span className="text-xs text-slate-500">Só o que merece atenção depois</span>
            </div>

            {supportingCategoriesOutOfPace.length > 0 ? (
              <div className="mt-3 space-y-2">
                {supportingCategoriesOutOfPace.map((item) => (
                  <div
                    key={item.category}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{item.shortLabel}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.shortStatus}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.actionHint}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency(item.paceDifference)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.paceStatus === "off_track" ? "acima do ritmo" : "na zona de atenção"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Depois da prioridade principal, não existe outra frente crítica chamando mais atenção neste momento.</p>
            )}
          </div>

          {assistantSummary.secondaryAlert ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">Contexto rápido</p>
              <p className="mt-1 text-sm text-slate-600">{assistantSummary.secondaryAlert}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Esse ponto foi priorizado porque tem mais impacto imediato no seu mês.
              </p>
            </div>
          ) : null}

          <div className="mt-4">
            <Link
              href="/intelligence"
              className="flex w-full items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <span>Ver análise completa</span>
              <span>→</span>
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <Link
            href="/transactions"
            className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-slate-900">Lançar transação</p>
            <p className="mt-1 text-xs text-slate-500">Registrar entradas e saídas.</p>
          </Link>

          <Link
            href="/invoices"
            className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-slate-900">Cartão de crédito</p>
            <p className="mt-1 text-xs text-slate-500">Ver faturas e limite.</p>
          </Link>

          <Link
            href="/goals"
            className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-slate-900">Metas e categorias</p>
            <p className="mt-1 text-xs text-slate-500">Acompanhar metas do mês.</p>
          </Link>

          <Link
            href="/intelligence"
            className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-slate-900">Inteligência financeira</p>
            <p className="mt-1 text-xs text-slate-500">Ver alertas e recomendações.</p>
          </Link>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Link
            href="/accounts"
            className="rounded-[18px] border border-slate-200 bg-white px-4 py-3.5 text-center text-sm font-semibold text-slate-700 transition duration-200 hover:bg-slate-50"
          >
            Contas e cartões
          </Link>

          <button
            type="button"
            onClick={handleResetAllData}
            disabled={resettingData}
            className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-semibold text-rose-700 transition duration-200 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resettingData ? "Resetando..." : "Resetar dados"}
          </button>

          <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3.5 text-center">
            <LogoutButton />
          </div>
        </section>
      </div>
    </main>
  );
}
