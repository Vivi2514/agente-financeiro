
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  monthlyLimit?: number | null;
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
  dueDate?: string | null;
  card?: {
    id: string;
    name: string;
    brand?: string | null;
  } | null;
};

type SmartAlert = {
  id: string;
  title: string;
  message: string;
  tone: "danger" | "warning" | "info" | "success";
};

type ForecastMonth = {
  key: string;
  label: string;
  projectedBalance: number;
  recurringIncome: number;
  recurringExpense: number;
  installmentImpact: number;
  isCritical: boolean;
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

function parseDateOnly(dateValue?: string | null) {
  if (!dateValue) return null;

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function isInvoiceInMonth(invoice: Invoice, year: number, month: number) {
  const dueDate = parseDateOnly(invoice.dueDate);

  if (dueDate) {
    return dueDate.getFullYear() === year && dueDate.getMonth() + 1 === month;
  }

  return invoice.year === year && invoice.month === month;
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function normalizeComparableText(value?: string | null) {
  return (value || "").trim().toLowerCase();
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

export default function IntelligencePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [recurrings, setRecurrings] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(
    getMonthInputValue(new Date())
  );

  async function loadData() {
    try {
      setLoading(true);

      const [
        transactionsResult,
        accountsResult,
        cardsResult,
        invoicesResult,
        recurringsResult,
      ] = await Promise.allSettled([
        fetch("/api/transactions", { cache: "no-store" }),
        fetch("/api/accounts", { cache: "no-store" }),
        fetch("/api/cards", { cache: "no-store" }),
        fetch("/api/invoices", { cache: "no-store" }),
        fetch("/api/recurring", { cache: "no-store" }),
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
    } catch (error) {
      console.error("Erro ao carregar inteligência financeira:", error);
      setTransactions([]);
      setAccounts([]);
      setCards([]);
      setInvoices([]);
      setRecurrings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedMonthMeta = useMemo(() => {
    const { year, month } = parseMonthInput(selectedMonth);
    const daysInMonth = new Date(year, month, 0).getDate();

    return {
      year,
      month,
      daysInMonth,
    };
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

  const analyticalTransactions = useMemo(() => {
    return filteredTransactions.filter(
      (transaction) => !isAdjustmentTransaction(transaction)
    );
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

  const currentAccountsBalance = useMemo(() => {
    return accounts.reduce(
      (sum, account) => sum + Number(account.balance || 0),
      0
    );
  }, [accounts]);

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
    return openInvoices.filter((invoice) =>
      isInvoiceInMonth(invoice, selectedMonthMeta.year, selectedMonthMeta.month)
    );
  }, [openInvoices, selectedMonthMeta.month, selectedMonthMeta.year]);

  const selectedMonthOpenInvoicesTotal = useMemo(() => {
    return selectedMonthOpenInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total || 0),
      0
    );
  }, [selectedMonthOpenInvoices]);

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

      if (alreadyGenerated) return;

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

  const futureInstallments = useMemo(() => {
    const { year, month } = parseMonthInput(selectedMonth);
    const baseDate = new Date(year, month - 1, 1);

    return [...transactions]
      .filter((transaction) => {
        const transactionDate = new Date(transaction.date);
        const isInstallment = isInstallmentTransaction(transaction);
        const isFuture = transactionDate.getTime() > baseDate.getTime();
        const isExpense = isExpenseType(transaction.type);

        return (
          isInstallment &&
          isFuture &&
          isExpense &&
          !isAdjustmentTransaction(transaction)
        );
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
    return currentAccountsBalance - selectedMonthOpenInvoicesTotal;
  }, [currentAccountsBalance, selectedMonthOpenInvoicesTotal]);

  const projectedBalanceReal = useMemo(() => {
    return currentAccountsBalance - selectedMonthOpenInvoicesTotal - futureInstallmentsTotal;
  }, [currentAccountsBalance, selectedMonthOpenInvoicesTotal, futureInstallmentsTotal]);

  const futureInstallmentsByMonth = useMemo(() => {
    const grouped = futureInstallments.reduce<
      Record<
        string,
        {
          key: string;
          label: string;
          total: number;
          count: number;
          transactions: Transaction[];
          projectedBalance: number;
        }
      >
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
          projectedBalance: 0,
        };
      }

      acc[key].total += Number(transaction.amount || 0);
      acc[key].count += 1;
      acc[key].transactions.push(transaction);

      return acc;
    }, {});

    const ordered = Object.values(grouped).sort((a, b) =>
      a.key.localeCompare(b.key)
    );

    let runningBalance = projectedBalanceAfterInvoices;

    return ordered.map((group) => {
      runningBalance -= group.total;

      return {
        ...group,
        projectedBalance: runningBalance,
      };
    });
  }, [futureInstallments, projectedBalanceAfterInvoices]);

  const monthlyForecast = useMemo<ForecastMonth[]>(() => {
    const activeRecurrings = recurrings.filter((item) => item.active);

    const monthlyRecurringIncome = activeRecurrings
      .filter((item) => isIncomeType(item.type))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const monthlyRecurringExpense = activeRecurrings
      .filter((item) => isExpenseType(item.type))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const months: ForecastMonth[] = [];
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
        return (
          transactionDate.getDate() === day &&
          !isAdjustmentTransaction(transaction)
        );
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
    const negativeDays = dailyBalanceProjection.filter(
      (item) => item.balance < 0
    ).length;

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

    const extraSafeSpend = Math.max(
      0,
      Number(lowestFutureBalance?.balance || 0)
    );
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

  const smartAlerts = useMemo<SmartAlert[]>(() => {
    const alerts: SmartAlert[] = [];
    const safeBalanceThreshold = 2000;

    if (projectedBalanceReal < 0) {
      alerts.push({
        id: "negative-projected-balance",
        title: "Saldo projetado negativo",
        message: `Sua projeção total está negativa em ${formatCurrency(
          Math.abs(projectedBalanceReal)
        )}. Vale revisar cartão, parcelas e principalmente o peso das despesas futuras.`,
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
        message: `Você tem parcelas impactando ${futureInstallmentsByMonth.length} meses seguidos.`,
        tone: "info",
      });
    }

    if (dailyProjectionSummary.negativeDays > 0 && dailyProjectionSummary.lowestPoint) {
      alerts.push({
        id: "negative-days-ahead",
        title: "Saldo negativo se aproxima",
        message: `Seu ponto mais crítico acontece em ${dailyProjectionSummary.lowestPoint.label}, com projeção de ${formatCurrency(
          dailyProjectionSummary.lowestPoint.balance
        )}.`,
        tone: "danger",
      });
    }

    if (spendingCapacitySummary.extraSafeSpend < 500 && projectedBalanceReal >= 0) {
      alerts.push({
        id: "low-safe-margin",
        title: "Folga pequena no mês",
        message: `Sua margem segura para novos gastos está em ${formatCurrency(
          spendingCapacitySummary.extraSafeSpend
        )}.`,
        tone: "warning",
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        id: "healthy-month",
        title: "Mês sob controle",
        message: "Sua leitura atual está saudável. Continue acompanhando as faturas e o ritmo do mês.",
        tone: "success",
      });
    }

    return alerts.slice(0, 4);
  }, [
    dailyProjectionSummary.lowestPoint,
    dailyProjectionSummary.negativeDays,
    futureInstallmentsByMonth.length,
    projectedBalanceReal,
    spendingCapacitySummary.extraSafeSpend,
  ]);

  const primaryStatus = useMemo(() => {
    if (projectedBalanceReal < 0 || dailyProjectionSummary.negativeDays > 0) {
      return {
        tone: "danger" as const,
        title: "Situação: Atenção máxima",
        message: `Sua projeção financeira está negativa em ${formatCurrency(
          Math.abs(projectedBalanceReal)
        )}. O ideal agora é revisar faturas, compras futuras e prioridades do mês.`,
      };
    }

    if (spendingCapacitySummary.extraSafeSpend < 500) {
      return {
        tone: "warning" as const,
        title: "Situação: Atenção",
        message: `Sua folga está curta. Hoje a margem segura está em ${formatCurrency(
          spendingCapacitySummary.extraSafeSpend
        )}.`,
      };
    }

    return {
      tone: "success" as const,
      title: "Situação: Saudável",
      message: "Seu momento está equilibrado. O foco agora é manter o ritmo e evitar excessos desnecessários.",
    };
  }, [
    dailyProjectionSummary.negativeDays,
    projectedBalanceReal,
    spendingCapacitySummary.extraSafeSpend,
  ]);

  const nextAction = useMemo(() => {
    if (selectedMonthOpenInvoicesTotal > 0) {
      return `Olhe primeiro suas faturas em aberto. Hoje elas somam ${formatCurrency(
        selectedMonthOpenInvoicesTotal
      )}.`;
    }

    if (futureInstallmentsTotal > 0) {
      return `Cheque suas compras parceladas futuras. Elas já comprometem ${formatCurrency(
        futureInstallmentsTotal
      )} dos próximos meses.`;
    }

    if (monthlyRecurringProjection.expensesTotal > monthlyRecurringProjection.incomesTotal) {
      return "Revise suas recorrências: suas saídas pendentes do mês estão maiores que as entradas previstas.";
    }

    return "Seu cenário está estável. Use esta página para acompanhar riscos e decidir o próximo passo com mais segurança.";
  }, [
    futureInstallmentsTotal,
    monthlyRecurringProjection.expensesTotal,
    monthlyRecurringProjection.incomesTotal,
    selectedMonthOpenInvoicesTotal,
  ]);


  const assistantSummary = useMemo(() => {
    if (selectedMonthOpenInvoicesTotal > 0) {
      return {
        tone: "danger" as const,
        eyebrow: "Seu próximo passo",
        title: "Revise suas faturas abertas hoje",
        action: `Hoje elas somam ${formatCurrency(selectedMonthOpenInvoicesTotal)}.`,
        impact: "Evitar novas compras no crédito agora ajuda a preservar sua folga do mês.",
      };
    }

    if (futureInstallmentsTotal > 0) {
      return {
        tone: "warning" as const,
        eyebrow: "Seu próximo passo",
        title: "Segure novas compras parceladas",
        action: `${formatCurrency(futureInstallmentsTotal)} já estão comprometidos nos próximos meses.`,
        impact: "Priorize compras à vista só se couberem na sua margem segura diária.",
      };
    }

    if (spendingCapacitySummary.extraSafeSpend <= 0) {
      return {
        tone: "danger" as const,
        eyebrow: "Seu próximo passo",
        title: "Evite novos gastos hoje",
        action: "Sua margem segura está zerada para o mês filtrado.",
        impact: "Concentrar-se em registrar entradas e revisar saídas reduz o risco de fechar no vermelho.",
      };
    }

    if (spendingCapacitySummary.extraSafeSpend < 500) {
      return {
        tone: "warning" as const,
        eyebrow: "Seu próximo passo",
        title: "Use o modo econômico hoje",
        action: `Sua folga segura total é de ${formatCurrency(spendingCapacitySummary.extraSafeSpend)}.`,
        impact: `Tente manter seus gastos diários abaixo de ${formatCurrency(spendingCapacitySummary.safeDailySpend)}.`,
      };
    }

    return {
      tone: "success" as const,
      eyebrow: "Seu próximo passo",
      title: "Mantenha o ritmo atual",
      action: "Seu cenário está estável neste momento.",
      impact: "Continue registrando o dia e acompanhe a página para agir cedo se algo mudar.",
    };
  }, [
    futureInstallmentsTotal,
    selectedMonthOpenInvoicesTotal,
    spendingCapacitySummary.extraSafeSpend,
    spendingCapacitySummary.safeDailySpend,
  ]);

  const assistantChecklist = useMemo(() => {
    return [
      {
        id: "launch-today",
        label: "Lançar o que entrou ou saiu hoje",
        done: totalIncomes > 0 || totalExpenses > 0,
      },
      {
        id: "review-invoices",
        label: "Revisar faturas abertas",
        done: openInvoicesTotal <= 0,
      },
      {
        id: "check-safe-limit",
        label: "Conferir se ainda está dentro do gasto seguro",
        done: spendingCapacitySummary.extraSafeSpend > 0,
      },
    ];
  }, [openInvoicesTotal, spendingCapacitySummary.extraSafeSpend, totalExpenses, totalIncomes]);

  const quickReading = useMemo(() => {
    return {
      accountsBalance: currentAccountsBalance,
      monthResult: totalIncomes - totalExpenses,
      openInvoicesTotal,
      futureInstallmentsTotal,
      recurringIncome: monthlyRecurringProjection.incomesTotal,
      recurringExpense: monthlyRecurringProjection.expensesTotal,
    };
  }, [
    currentAccountsBalance,
    futureInstallmentsTotal,
    monthlyRecurringProjection.expensesTotal,
    monthlyRecurringProjection.incomesTotal,
    openInvoicesTotal,
    totalExpenses,
    totalIncomes,
  ]);

  const monthlyConsciousLimitSummary = useMemo(() => {
    const totalMonthlyLimit = cards.reduce(
      (sum, card) => sum + Math.max(0, Number(card.monthlyLimit || 0)),
      0
    );

    const usedInSelectedMonth = analyticalTransactions
      .filter((transaction) => {
        if (!transaction.cardId) return false;
        if (transaction.paymentMethod !== "credit_card") return false;
        if (!isExpenseType(transaction.type)) return false;
        if (isAdjustmentTransaction(transaction)) return false;

        const card = cards.find((item) => item.id === transaction.cardId);
        return Number(card?.monthlyLimit || 0) > 0;
      })
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const available = totalMonthlyLimit - usedInSelectedMonth;
    const usagePercent =
      totalMonthlyLimit > 0 ? (usedInSelectedMonth / totalMonthlyLimit) * 100 : 0;

    return {
      totalMonthlyLimit,
      usedInSelectedMonth,
      available,
      usagePercent,
      hasMonthlyLimit: totalMonthlyLimit > 0,
    };
  }, [analyticalTransactions, cards]);

  const monthlyDecisionAvailable = monthlyConsciousLimitSummary.available;
  const monthlyDecisionUsagePercent = monthlyConsciousLimitSummary.usagePercent;

  const selectedMonthInvoicesPressure =
    selectedMonthOpenInvoicesTotal > 0 &&
    selectedMonthOpenInvoicesTotal >= Math.max(currentAccountsBalance, 0);

  const hasOpenInvoicesInSelectedMonth = selectedMonthOpenInvoicesTotal > 0;

  const canBuyTone = !monthlyConsciousLimitSummary.hasMonthlyLimit
    ? selectedMonthInvoicesPressure || projectedBalanceReal < 0
      ? "danger"
      : hasOpenInvoicesInSelectedMonth
      ? "warning"
      : "success"
    : monthlyDecisionAvailable <= 0 ||
      monthlyDecisionUsagePercent >= 100 ||
      selectedMonthInvoicesPressure
    ? "danger"
    : monthlyDecisionUsagePercent >= 85 || hasOpenInvoicesInSelectedMonth
    ? "warning"
    : "success";

  const canBuyTitle =
    canBuyTone === "danger"
      ? "Melhor segurar o crédito agora."
      : canBuyTone === "warning"
      ? "Atenção antes de comprar."
      : "Você ainda tem margem para decidir.";

  const canBuySubtitle = !monthlyConsciousLimitSummary.hasMonthlyLimit
    ? "Você ainda não definiu limite mensal consciente para os cartões. A leitura considera faturas e saldo, mas fica mais precisa com esse limite."
    : selectedMonthInvoicesPressure
    ? "Mesmo com margem consciente, este mês tem faturas abertas pesando no seu saldo. Antes de comprar, revise o pagamento dessas faturas."
    : hasOpenInvoicesInSelectedMonth
    ? "Você ainda tem margem consciente, mas existem faturas abertas neste mês. O ideal é simular antes de confirmar qualquer compra."
    : canBuyTone === "danger"
    ? "Seu limite mensal consciente já está estourado ou praticamente sem folga. Antes de comprar, revise cartões e faturas."
    : canBuyTone === "warning"
    ? "Você ainda tem alguma margem consciente, mas ela está curta. Vale simular antes de confirmar qualquer compra."
    : "Pelo limite mensal consciente, ainda existe espaço. Mesmo assim, compras maiores devem passar pela simulação.";

  const decisionReasons = [
    {
      id: "monthly-conscious-limit",
      label: "Margem consciente",
      value: monthlyConsciousLimitSummary.hasMonthlyLimit
        ? formatCurrency(monthlyDecisionAvailable)
        : "Não definida",
      danger:
        monthlyConsciousLimitSummary.hasMonthlyLimit &&
        monthlyDecisionAvailable <= 0,
      helper: monthlyConsciousLimitSummary.hasMonthlyLimit
        ? `Você já usou ${Math.round(monthlyDecisionUsagePercent)}% do limite mensal planejado.`
        : "Defina limite mensal nos cartões para esta leitura ficar mais fiel.",
    },
    {
      id: "open-invoices",
      label: "Faturas do mês",
      value: formatCurrency(selectedMonthOpenInvoicesTotal),
      danger: selectedMonthInvoicesPressure,
      helper:
        selectedMonthOpenInvoicesTotal > 0
          ? "Elas pesam no mês selecionado e precisam ser prioridade antes de novas compras."
          : "Sem faturas abertas neste mês.",
    },
    {
      id: "current-balance",
      label: "Contas agora",
      value: formatCurrency(currentAccountsBalance),
      danger: currentAccountsBalance <= 0,
      helper:
        currentAccountsBalance <= 0
          ? "Saldo disponível está apertado."
          : "Saldo atual considerado.",
    },
  ];

  const decisionSummary =
    !monthlyConsciousLimitSummary.hasMonthlyLimit
      ? "A decisão mais segura é definir um limite mensal consciente nos cartões e simular compras antes de usar crédito."
      : selectedMonthInvoicesPressure
      ? "A decisão mais segura é pagar ou revisar as faturas do mês antes de assumir novas compras no crédito."
      : hasOpenInvoicesInSelectedMonth
      ? "A decisão mais segura é simular antes de comprar, porque este mês ainda tem faturas abertas."
      : canBuyTone === "danger"
      ? "A decisão mais segura é não assumir novas compras no crédito até recuperar margem consciente."
      : canBuyTone === "warning"
      ? "A decisão mais segura é simular a compra antes de confirmar e evitar parcelamento novo."
      : "A decisão mais segura é manter o controle, comprar só o necessário e seguir registrando os gastos.";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-xl flex-col gap-4">
        <header className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-slate-950/40">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                Inteligência financeira
              </p>
              <h1 className="mt-2 text-2xl font-black leading-tight text-white">
                Posso comprar no crédito agora?
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Uma resposta direta baseada no seu limite mensal consciente.
              </p>
            </div>

            <Link
              href="/"
              className="shrink-0 rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10"
            >
              Voltar
            </Link>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-sky-400"
            />
          </div>
        </header>

        {loading ? (
          <section className="flex flex-1 items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.04] p-10 text-center text-slate-400">
            Carregando sua leitura financeira...
          </section>
        ) : (
          <>
            <section
              className={`rounded-[2.25rem] border p-6 shadow-2xl shadow-slate-950/40 ${
                canBuyTone === "danger"
                  ? "border-rose-400/30 bg-rose-500/10"
                  : canBuyTone === "warning"
                  ? "border-amber-400/30 bg-amber-500/10"
                  : "border-emerald-400/30 bg-emerald-500/10"
              }`}
            >
              <p
                className={`text-xs font-black uppercase tracking-[0.22em] ${
                  canBuyTone === "danger"
                    ? "text-rose-300"
                    : canBuyTone === "warning"
                    ? "text-amber-300"
                    : "text-emerald-300"
                }`}
              >
                Leitura do crédito
              </p>

              <h2 className="mt-3 text-4xl font-black leading-tight text-white">
                {canBuyTitle}
              </h2>

              <p className="mt-4 text-base leading-relaxed text-slate-200">
                {canBuySubtitle}
              </p>

              <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Decisão mais segura
                </p>
                <p className="mt-2 text-sm font-bold leading-relaxed text-white">
                  {decisionSummary}
                </p>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-slate-950/30">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Por quê?
              </p>

              <div className="mt-4 space-y-3">
                {decisionReasons.map((reason) => (
                  <div
                    key={reason.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-white">
                          {reason.label}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">
                          {reason.helper}
                        </p>
                      </div>

                      <p
                        className={`shrink-0 text-sm font-black ${
                          reason.danger ? "text-rose-300" : "text-emerald-300"
                        }`}
                      >
                        {reason.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                href="/invoices"
                className="rounded-[1.5rem] bg-white px-5 py-4 text-center text-sm font-black text-slate-950 transition hover:bg-slate-100"
              >
                Ver faturas
              </Link>

              <Link
                href="/simular-compra"
                className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-5 py-4 text-center text-sm font-black text-white transition hover:bg-white/10"
              >
                Simular compra
              </Link>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-slate-950/30">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Resumo rápido
              </p>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Limite mensal planejado</span>
                  <span className="font-black text-white">
                    {monthlyConsciousLimitSummary.hasMonthlyLimit
                      ? formatCurrency(monthlyConsciousLimitSummary.totalMonthlyLimit)
                      : "Não definido"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Usado no mês</span>
                  <span className="font-black text-white">
                    {formatCurrency(monthlyConsciousLimitSummary.usedInSelectedMonth)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Parcelas futuras já lançadas</span>
                  <span className="font-black text-white">
                    {formatCurrency(futureInstallmentsTotal)}
                  </span>
                </div>
              </div>

              <details className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <summary className="cursor-pointer text-sm font-black text-slate-200">
                  Ver detalhe técnico
                </summary>

                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <p>Entradas do mês: {formatCurrency(totalIncomes)}</p>
                  <p>Saídas do mês: {formatCurrency(totalExpenses)}</p>
                  <p>
                    Recorrências pendentes:{" "}
                    {formatCurrency(
                      monthlyRecurringProjection.expensesTotal -
                        monthlyRecurringProjection.incomesTotal
                    )}
                  </p>
                  {dailyProjectionSummary.lowestPoint && (
                    <p>
                      Momento mais apertado:{" "}
                      {dailyProjectionSummary.lowestPoint.label} com{" "}
                      {formatCurrency(dailyProjectionSummary.lowestPoint.balance)}.
                    </p>
                  )}
                </div>
              </details>
            </section>
          </>
        )}
      </div>
    </main>
  );

}
