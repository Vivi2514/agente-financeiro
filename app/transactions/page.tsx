"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type PaymentMethod =
  | ""
  | "cash"
  | "debit_card"
  | "credit_card"
  | "pix"
  | "bank_transfer"
  | "boleto"
  | "voucher";

type CreditMode = "avista" | "parcelado";
type SpecialTransactionType = "normal" | "card_adjustment";

type Account = {
  id: string;
  name: string;
  balance?: number;
};

type Card = {
  id: string;
  name: string;
  limit?: number;
  brand?: string | null;
};

type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: string;
  category?: string | null;
  paymentMethod?: PaymentMethod | string | null;
  accountId?: string | null;
  cardId?: string | null;
  invoiceId?: string | null;
  purchaseGroupId?: string | null;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  isFixed?: boolean | null;
  isAdjustment?: boolean | null;
  date?: string;
  createdAt?: string;
  account?: {
    id: string;
    name: string;
  } | null;
  card?: {
    id: string;
    name: string;
  } | null;
  invoice?: {
    id: string;
    status: "OPEN" | "PAID";
  } | null;
};

type EditFormState = {
  title: string;
  amountInput: string;
  type: "income" | "expense";
  category: string;
  paymentMethod: PaymentMethod;
  accountId: string;
  cardId: string;
  createdAt: string;
  isFixed: boolean;
};

const EXPENSE_CATEGORIES = [
  { label: "🍔 Alimentação", value: "Alimentação" },
  { label: "🚗 Transporte", value: "Transporte" },
  { label: "🏥 Saúde", value: "Saúde" },
  { label: "🐶 Pet", value: "Pet" },
  { label: "🏠 Casa", value: "Casa" },
  { label: "💻 Eletrônico", value: "Eletrônico" },
  { label: "🎉 Lazer", value: "Lazer" },
  { label: "🧍 Pessoal", value: "Pessoal" },
  { label: "👕 Vestuário", value: "Vestuário" },
  { label: "🧴 SkinCare", value: "SkinCare" },
  { label: "🔨 Reforma", value: "Reforma" },
  { label: "📦 Outros", value: "Outros" },
];

const INCOME_CATEGORIES = [
  { label: "💼 Salário", value: "Salário" },
  { label: "💰 Adiantamento", value: "Adiantamento" },
  { label: "🥗 Vale alimentação", value: "Vale alimentação" },
  { label: "🎁 Extra", value: "Extra" },
  { label: "📦 Outros", value: "Outros" },
];

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseCurrencyToNumber(value: string) {
  if (!value) return 0;
  const onlyNumbers = value.replace(/\D/g, "");
  return Number(onlyNumbers) / 100;
}

function formatCurrencyInput(value: string) {
  const numberValue = parseCurrencyToNumber(value);

  return numberValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getMonthInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`
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
  if (!category) return "📦 Outros";

  const allCategories = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  const found = allCategories.find((item) => item.value === category);
  return found ? found.label : category;
}

function toDateInputValue(date?: string) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  const offset = parsed.getTimezoneOffset();
  const localDate = new Date(parsed.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

function normalizeTransactionType(
  value?: string | null
): "income" | "expense" | "" {
  if (!value) return "";
  const normalized = value.toLowerCase();

  if (normalized === "income" || normalized === "entrada") return "income";
  if (
    normalized === "expense" ||
    normalized === "saida" ||
    normalized === "saída"
  )
    return "expense";

  return "";
}

function getTodayString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

function addDaysToToday(days: number) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

function getFirstDayOfCurrentMonth() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const offset = firstDay.getTimezoneOffset();
  const localDate = new Date(firstDay.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

function normalizeDateOnly(dateValue?: string | null) {
  if (!dateValue) return null;

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function parseFilterDate(dateValue?: string) {
  if (!dateValue) return null;

  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function formatMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) return "Mês atual";

  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

function getFrequencyLabel(isFixed?: boolean | null) {
  return isFixed ? "Fixa" : "Variável";
}

function isAdjustmentTransaction(transaction?: Transaction | null) {
  if (!transaction) return false;
  if (transaction.isAdjustment) return true;

  const normalizedTitle = (transaction.title || "").trim().toLowerCase();
  return (
    normalizedTitle === "saldo anterior" ||
    normalizedTitle === "saldo inicial da fatura" ||
    normalizedTitle === "ajuste inicial do cartao" ||
    normalizedTitle === "ajuste inicial do cartão"
  );
}

function getBaseInstallmentTitle(title?: string | null) {
  if (!title) return "";
  return title.replace(/\s*\(\d+\s*\/\s*\d+\)$/, "").trim();
}


export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);

  const [title, setTitle] = useState("");
  const [amountInput, setAmountInput] = useState("R$ 0,00");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("Alimentação");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [creditMode, setCreditMode] = useState<CreditMode>("avista");
  const [installments, setInstallments] = useState("2");
  const [accountId, setAccountId] = useState("");
  const [cardId, setCardId] = useState("");
  const [specialType, setSpecialType] = useState<SpecialTransactionType>("normal");
  const [isFixed, setIsFixed] = useState(false);
  const [createdAt, setCreatedAt] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - offset * 60 * 1000);
    return localDate.toISOString().slice(0, 10);
  });
  const [selectedMonthValue, setSelectedMonthValue] = useState(() =>
    getMonthInputValue(new Date())
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"" | "income" | "expense">("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("");
  const [filterAccountId, setFilterAccountId] = useState("");
  const [filterCardId, setFilterCardId] = useState("");
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState<
    "" | "open" | "paid"
  >("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [sortBy, setSortBy] = useState<"date" | "amount" | "title">("date");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const categoryOptions =
    type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const allCategoryOptions = useMemo(() => {
    const merged = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
    const unique = merged.filter(
      (item, index, self) =>
        index === self.findIndex((other) => other.value === item.value)
    );
    return unique;
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [transactionsRes, accountsRes, cardsRes] = await Promise.all([
        fetch("/api/transactions", { cache: "no-store" }),
        fetch("/api/accounts", { cache: "no-store" }),
        fetch("/api/cards", { cache: "no-store" }),
      ]);

      const transactionsData = transactionsRes.ok
        ? await transactionsRes.json()
        : [];
      const accountsData = accountsRes.ok ? await accountsRes.json() : [];
      const cardsData = cardsRes.ok ? await cardsRes.json() : [];

      setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setCards(Array.isArray(cardsData) ? cardsData : []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setTransactions([]);
      setAccounts([]);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (specialType !== "card_adjustment") return;

    setType("expense");
    setCategory("Outros");
    setPaymentMethod("credit_card");
    setCreditMode("avista");
    setInstallments("2");
    setAccountId("");
    setIsFixed(false);

    const normalizedTitle = title.trim().toLowerCase();
    if (
      !normalizedTitle ||
      normalizedTitle === "saldo anterior" ||
      normalizedTitle === "saldo inicial da fatura"
    ) {
      setTitle("Ajuste inicial do cartão");
    }
  }, [specialType, title]);

  useEffect(() => {
    if (specialType === "card_adjustment") {
      return;
    }

    if (type === "income") {
      setCardId("");
      setIsFixed(false);

      if (paymentMethod === "credit_card") {
        setPaymentMethod("pix");
      }

      if (
        category === "Alimentação" ||
        category === "Transporte" ||
        category === "Saúde" ||
        category === "Pet" ||
        category === "Casa" ||
        category === "Eletrônico" ||
        category === "Lazer" ||
        category === "Pessoal" ||
        category === "Vestuário" ||
        category === "SkinCare" ||
        category === "Reforma"
      ) {
        setCategory("Salário");
      }
    } else {
      if (
        category === "Salário" ||
        category === "Adiantamento" ||
        category === "Vale alimentação" ||
        category === "Extra"
      ) {
        setCategory("Alimentação");
      }
    }
  }, [type, paymentMethod, category, specialType]);

  useEffect(() => {
    if (specialType === "card_adjustment") {
      setPaymentMethod("credit_card");
      setAccountId("");
      return;
    }

    if (paymentMethod === "credit_card") {
      setAccountId("");
    } else {
      setCardId("");
      setCreditMode("avista");
      setInstallments("2");
    }

    if (paymentMethod === "voucher") {
      setAccountId("");
    }
  }, [paymentMethod, specialType]);

  const monthTransactions = useMemo(() => {
    if (!selectedMonthValue) return transactions;

    const [selectedYear, selectedMonth] = selectedMonthValue
      .split("-")
      .map(Number);

    return transactions.filter((transaction) => {
      const transactionDateRaw = transaction.date || transaction.createdAt || "";
      const transactionDateOnly = normalizeDateOnly(transactionDateRaw);

      if (!transactionDateOnly) return false;

      return (
        transactionDateOnly.getFullYear() === selectedYear &&
        transactionDateOnly.getMonth() + 1 === selectedMonth
      );
    });
  }, [transactions, selectedMonthValue]);

  const totalIncome = useMemo(() => {
    return monthTransactions
      .filter(
        (transaction) =>
          normalizeTransactionType(transaction.type) === "income" &&
          !isAdjustmentTransaction(transaction)
      )
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  }, [monthTransactions]);

  const totalExpense = useMemo(() => {
    return monthTransactions
      .filter(
        (transaction) =>
          normalizeTransactionType(transaction.type) === "expense" &&
          !isAdjustmentTransaction(transaction)
      )
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  }, [monthTransactions]);

  const balance = useMemo(() => {
    return totalIncome - totalExpense;
  }, [totalIncome, totalExpense]);

  const filteredTransactions = useMemo(() => {
    return [...transactions]
      .filter((transaction) => {
        const transactionDateRaw = transaction.date || transaction.createdAt || "";
        const transactionDateOnly = normalizeDateOnly(transactionDateRaw);

        const normalizedTitle = transaction.title.toLowerCase();
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const normalizedType = normalizeTransactionType(transaction.type);

        const accountName =
          transaction.account?.name ||
          accounts.find((account) => account.id === transaction.accountId)?.name ||
          "";

        const cardName =
          transaction.card?.name ||
          cards.find((card) => card.id === transaction.cardId)?.name ||
          "";

        const invoiceStatus = transaction.invoice?.status;
        const isPaidInvoice = invoiceStatus === "PAID";
        const isOpenInvoice = invoiceStatus === "OPEN" || !invoiceStatus;

        if (normalizedSearch) {
          const matchesSearch =
            normalizedTitle.includes(normalizedSearch) ||
            (transaction.category || "")
              .toLowerCase()
              .includes(normalizedSearch) ||
            accountName.toLowerCase().includes(normalizedSearch) ||
            cardName.toLowerCase().includes(normalizedSearch);

          if (!matchesSearch) return false;
        }

        if (filterType && normalizedType !== filterType) return false;
        if (filterCategory && (transaction.category || "") !== filterCategory)
          return false;
        if (
          filterPaymentMethod &&
          (transaction.paymentMethod || "") !== filterPaymentMethod
        )
          return false;
        if (filterAccountId && (transaction.accountId || "") !== filterAccountId)
          return false;
        if (filterCardId && (transaction.cardId || "") !== filterCardId)
          return false;

        if (filterInvoiceStatus === "paid" && !isPaidInvoice) return false;
        if (filterInvoiceStatus === "open" && !isOpenInvoice) return false;

        if (selectedMonthValue) {
          const [selectedYear, selectedMonth] = selectedMonthValue
            .split("-")
            .map(Number);

          if (
            !transactionDateOnly ||
            transactionDateOnly.getFullYear() != selectedYear ||
            transactionDateOnly.getMonth() + 1 != selectedMonth
          ) {
            return false;
          }
        }

        if (filterDateFrom) {
          const fromDate = parseFilterDate(filterDateFrom);
          if (!transactionDateOnly || !fromDate || transactionDateOnly < fromDate) {
            return false;
          }
        }

        if (filterDateTo) {
          const toDate = parseFilterDate(filterDateTo);
          if (!transactionDateOnly || !toDate || transactionDateOnly > toDate) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "date") {
          const dateA = new Date(a.date || a.createdAt || 0).getTime();
          const dateB = new Date(b.date || b.createdAt || 0).getTime();

          return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
        }

        if (sortBy === "amount") {
          const valueA = Number(a.amount || 0);
          const valueB = Number(b.amount || 0);

          return sortOrder === "desc" ? valueB - valueA : valueA - valueB;
        }

        if (sortBy === "title") {
          const titleA = a.title.toLowerCase();
          const titleB = b.title.toLowerCase();

          if (titleA < titleB) return sortOrder === "asc" ? -1 : 1;
          if (titleA > titleB) return sortOrder === "asc" ? 1 : -1;
          return 0;
        }

        return 0;
      });
  }, [
    transactions,
    accounts,
    cards,
    searchTerm,
    selectedMonthValue,
    filterType,
    filterCategory,
    filterPaymentMethod,
    filterAccountId,
    filterCardId,
    filterInvoiceStatus,
    filterDateFrom,
    filterDateTo,
    sortBy,
    sortOrder,
  ]);

  const hasActiveAdvancedFilters = useMemo(() => {
    return Boolean(
      filterType ||
        filterCategory ||
        filterPaymentMethod ||
        filterAccountId ||
        filterCardId ||
        filterInvoiceStatus ||
        filterDateFrom ||
        filterDateTo
    );
  }, [
    filterType,
    filterCategory,
    filterPaymentMethod,
    filterAccountId,
    filterCardId,
    filterInvoiceStatus,
    filterDateFrom,
    filterDateTo,
  ]);

  const purchaseGroupSummaries = useMemo(() => {
    const grouped = new Map<
      string,
      {
        purchaseGroupId: string;
        transactions: Transaction[];
        firstTransaction: Transaction;
        totalAmount: number;
        installmentTotal: number;
        installmentValue: number;
        baseTitle: string;
      }
    >();

    const sortedTransactions = [...transactions].sort((a, b) => {
      const installmentA = Number(a.installmentNumber || 0);
      const installmentB = Number(b.installmentNumber || 0);

      if (installmentA !== installmentB) {
        return installmentA - installmentB;
      }

      const dateA = new Date(a.date || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.createdAt || 0).getTime();
      return dateA - dateB;
    });

    sortedTransactions.forEach((transaction) => {
      if (!transaction.purchaseGroupId) return;

      const existing = grouped.get(transaction.purchaseGroupId);

      if (!existing) {
        grouped.set(transaction.purchaseGroupId, {
          purchaseGroupId: transaction.purchaseGroupId,
          transactions: [transaction],
          firstTransaction: transaction,
          totalAmount: Number(transaction.amount || 0),
          installmentTotal: Number(transaction.installmentTotal || 1),
          installmentValue: Number(transaction.amount || 0),
          baseTitle: getBaseInstallmentTitle(transaction.title),
        });
        return;
      }

      existing.transactions.push(transaction);
      existing.totalAmount += Number(transaction.amount || 0);

      const currentInstallmentNumber = Number(transaction.installmentNumber || 0);
      const firstInstallmentNumber = Number(
        existing.firstTransaction.installmentNumber || 0
      );
      const currentDate = new Date(transaction.date || transaction.createdAt || 0).getTime();
      const firstDate = new Date(
        existing.firstTransaction.date || existing.firstTransaction.createdAt || 0
      ).getTime();

      if (
        currentInstallmentNumber < firstInstallmentNumber ||
        (currentInstallmentNumber === firstInstallmentNumber && currentDate < firstDate)
      ) {
        existing.firstTransaction = transaction;
      }

      if (Number(transaction.installmentTotal || 0) > existing.installmentTotal) {
        existing.installmentTotal = Number(transaction.installmentTotal || 1);
      }
    });

    return grouped;
  }, [transactions]);

  const displayedTransactions = useMemo(() => {
    const filteredIds = new Set(filteredTransactions.map((transaction) => transaction.id));

    return filteredTransactions.reduce<
      Array<{
        transaction: Transaction;
        groupedPurchase:
          | {
              totalAmount: number;
              installmentTotal: number;
              installmentValue: number;
              baseTitle: string;
            }
          | null;
      }>
    >((acc, transaction) => {
      if (!transaction.purchaseGroupId) {
        acc.push({ transaction, groupedPurchase: null });
        return acc;
      }

      const summary = purchaseGroupSummaries.get(transaction.purchaseGroupId);

      if (!summary) {
        acc.push({ transaction, groupedPurchase: null });
        return acc;
      }

      const firstTransactionIsVisible = filteredIds.has(summary.firstTransaction.id);

      if (!firstTransactionIsVisible) {
        acc.push({ transaction, groupedPurchase: null });
        return acc;
      }

      if (transaction.id !== summary.firstTransaction.id) {
        return acc;
      }

      acc.push({
        transaction,
        groupedPurchase: {
          totalAmount: summary.totalAmount,
          installmentTotal: summary.installmentTotal,
          installmentValue: summary.installmentValue,
          baseTitle: summary.baseTitle,
        },
      });

      return acc;
    }, []);
  }, [filteredTransactions, purchaseGroupSummaries]);

  function clearFilters() {
    setSearchTerm("");
    setSelectedMonthValue(getMonthInputValue(new Date()));
    setFilterType("");
    setFilterCategory("");
    setFilterPaymentMethod("");
    setFilterAccountId("");
    setFilterCardId("");
    setFilterInvoiceStatus("");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  function changeSelectedMonth(direction: "prev" | "next") {
    const [year, month] = selectedMonthValue.split("-").map(Number);
    const baseDate = new Date(year, month - 1, 1);

    if (direction === "prev") {
      baseDate.setMonth(baseDate.getMonth() - 1);
    } else {
      baseDate.setMonth(baseDate.getMonth() + 1);
    }

    setSelectedMonthValue(getMonthInputValue(baseDate));
  }

  function goToCurrentMonth() {
    setSelectedMonthValue(getMonthInputValue(new Date()));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const amount = parseCurrencyToNumber(amountInput);
    const isCardAdjustment = specialType === "card_adjustment";

    if (!title.trim()) {
      alert("Preencha o título da transação.");
      return;
    }

    if (amount <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    if (!isCardAdjustment && !paymentMethod) {
      alert("Selecione uma forma de pagamento.");
      return;
    }

    if ((isCardAdjustment || paymentMethod === "credit_card") && !cardId) {
      alert("Selecione um cartão para pagamento no crédito.");
      return;
    }

    if (
      !isCardAdjustment &&
      paymentMethod === "credit_card" &&
      creditMode === "parcelado"
    ) {
      const parsedInstallments = Number(installments);

      if (
        Number.isNaN(parsedInstallments) ||
        parsedInstallments < 2 ||
        parsedInstallments > 24
      ) {
        alert("Informe uma quantidade de parcelas entre 2 e 24.");
        return;
      }
    }

    if (
      !isCardAdjustment &&
      paymentMethod !== "credit_card" &&
      paymentMethod !== "voucher" &&
      !accountId
    ) {
      alert("Selecione uma conta.");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        title: title.trim(),
        amount,
        type: isCardAdjustment ? "expense" : type,
        category: isCardAdjustment ? null : category || "Outros",
        paymentMethod: isCardAdjustment ? "credit_card" : paymentMethod,
        creditMode:
          !isCardAdjustment && paymentMethod === "credit_card" ? creditMode : null,
        installments:
          !isCardAdjustment &&
          paymentMethod === "credit_card" &&
          creditMode === "parcelado"
            ? Number(installments)
            : 1,
        accountId:
          isCardAdjustment ||
          paymentMethod === "credit_card" ||
          paymentMethod === "voucher"
            ? null
            : accountId || null,
        cardId:
          isCardAdjustment || paymentMethod === "credit_card"
            ? cardId || null
            : null,
        isFixed: isCardAdjustment ? false : type === "expense" ? isFixed : false,
        isAdjustment: isCardAdjustment,
        createdAt: createdAt
          ? new Date(`${createdAt}T12:00:00`).toISOString()
          : new Date().toISOString(),
      };

      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Erro ao criar transação");
      }

      setTitle("");
      setAmountInput("R$ 0,00");
      setType("expense");
      setCategory("Alimentação");
      setPaymentMethod("pix");
      setCreditMode("avista");
      setInstallments("2");
      setAccountId("");
      setCardId("");
      setSpecialType("normal");
      setIsFixed(false);

      await loadData();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a transação."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startEditing(transaction: Transaction) {
    const safePaymentMethod = (
      transaction.paymentMethod || "pix"
    ) as PaymentMethod;

    const normalizedType = normalizeTransactionType(transaction.type) || "expense";

    setEditingId(transaction.id);
    setEditForm({
      title: transaction.title,
      amountInput: formatCurrencyInput(
        String(Number(transaction.amount || 0) * 100)
      ),
      type: normalizedType,
      category:
        transaction.category ||
        (normalizedType === "income" ? "Salário" : "Alimentação"),
      paymentMethod: safePaymentMethod,
      accountId: transaction.accountId || "",
      cardId: transaction.cardId || "",
      createdAt: toDateInputValue(transaction.date || transaction.createdAt),
      isFixed: normalizedType === "expense" ? Boolean(transaction.isFixed) : false,
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(transactionId: string) {
    if (!editForm) return;

    const amount = parseCurrencyToNumber(editForm.amountInput);

    if (!editForm.title.trim()) {
      alert("Preencha o título da transação.");
      return;
    }

    if (amount <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    if (!editForm.paymentMethod) {
      alert("Selecione uma forma de pagamento.");
      return;
    }

    if (editForm.paymentMethod === "credit_card" && !editForm.cardId) {
      alert("Selecione um cartão.");
      return;
    }

    if (
      editForm.paymentMethod !== "credit_card" &&
      editForm.paymentMethod !== "voucher" &&
      !editForm.accountId
    ) {
      alert("Selecione uma conta.");
      return;
    }

    try {
      setSavingEdit(true);

      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editForm.title.trim(),
          amount,
          type: editForm.type,
          category: editForm.category,
          paymentMethod: editForm.paymentMethod,
          accountId:
            editForm.paymentMethod === "credit_card" ||
            editForm.paymentMethod === "voucher"
              ? null
              : editForm.accountId || null,
          cardId:
            editForm.paymentMethod === "credit_card"
              ? editForm.cardId || null
              : null,
          isFixed: editForm.type === "expense" ? editForm.isFixed : false,
          createdAt: editForm.createdAt
            ? new Date(`${editForm.createdAt}T12:00:00`).toISOString()
            : new Date().toISOString(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Erro ao editar transação");
      }

      setEditingId(null);
      setEditForm(null);
      await loadData();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível editar a transação."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(id: string, isPaidInvoice: boolean) {
    if (isPaidInvoice) {
      alert("Não é permitido excluir transações de uma fatura já paga.");
      return;
    }

    const confirmed = window.confirm(
      "Tem certeza que deseja excluir esta transação?"
    );

    if (!confirmed) return;

    try {
      setDeletingId(id);

      let response = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deleteGroup: false,
        }),
      });

      let data = await response.json().catch(() => null);

      if (response.status === 409 && data?.requiresConfirmation) {
        const confirmGroupDelete = window.confirm(data.message);

        if (!confirmGroupDelete) {
          setDeletingId(null);
          return;
        }

        response = await fetch(`/api/transactions/${id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deleteGroup: true,
          }),
        });

        data = await response.json().catch(() => null);
      }

      if (!response.ok) {
        throw new Error(data?.error || "Erro ao excluir transação");
      }

      await loadData();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a transação."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 app-card md:flex-row md:items-center md:justify-between">
          <div>
            <p className="app-subtitle">Transações</p>
            <h1 className="app-title">
              Lançamentos financeiros
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Cadastre entradas e saídas do seu app financeiro
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="app-button-primary"
            >
              Ir para dashboard
            </Link>

            <Link
              href="/accounts"
              className="app-button-secondary"
            >
              Contas e cartões
            </Link>

            <Link
              href="/invoices"
              className="app-button-secondary"
            >
              Faturas
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="app-card">
            <p className="text-sm font-medium text-slate-500">Entradas</p>
            <h2 className="mt-2 text-2xl font-bold text-emerald-600">
              {formatCurrency(totalIncome)}
            </h2>
          </div>

          <div className="app-card">
            <p className="text-sm font-medium text-slate-500">Saídas</p>
            <h2 className="mt-2 text-2xl font-bold text-rose-600">
              {formatCurrency(totalExpense)}
            </h2>
          </div>

          <div className="app-card">
            <p className="text-sm font-medium text-slate-500">Saldo</p>
            <h2
              className={`mt-2 text-2xl font-bold ${
                balance >= 0 ? "text-sky-600" : "text-rose-600"
              }`}
            >
              {formatCurrency(balance)}
            </h2>
          </div>
        </section>

        <section className="app-card">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Filtros e busca
              </h2>
              <p className="text-sm text-slate-500">
                Primeiro escolha o mês e use a busca. Os filtros mais detalhados ficam escondidos até você precisar.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((current) => !current)}
                className="app-button-secondary"
              >
                {showAdvancedFilters ? "Ocultar filtros avançados" : "Filtros avançados"}
              </button>

              <button
                type="button"
                onClick={() => {
                  clearFilters();
                  setShowAdvancedFilters(false);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Limpar tudo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título, categoria, conta ou cartão"
              className="app-input"
            />

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "date" | "amount" | "title")
              }
              className="app-input"
            >
              <option value="date">Ordenar por data</option>
              <option value="amount">Ordenar por valor</option>
              <option value="title">Ordenar por título</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              className="app-input"
            >
              <option value="desc">Mais recentes primeiro</option>
              <option value="asc">Mais antigas primeiro</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-600">Mês</span>

            <button
              type="button"
              onClick={() => changeSelectedMonth("prev")}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              ←
            </button>

            <input
              type="month"
              value={selectedMonthValue}
              onChange={(e) => setSelectedMonthValue(e.target.value)}
              className="app-input max-w-[180px]"
            />
            <button
              type="button"
              onClick={() => changeSelectedMonth("next")}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              →
            </button>

            <button
              type="button"
              onClick={goToCurrentMonth}
              className="app-button-secondary"
            >
              Mês atual
            </button>
          </div>

          {showAdvancedFilters && (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <select
                value={filterType}
                onChange={(e) =>
                  setFilterType(e.target.value as "" | "income" | "expense")
                }
                className="app-input"
              >
                <option value="">Todos os tipos</option>
                <option value="income">Entrada</option>
                <option value="expense">Saída</option>
              </select>

              <select
                value={filterInvoiceStatus}
                onChange={(e) =>
                  setFilterInvoiceStatus(e.target.value as "" | "open" | "paid")
                }
                className="app-input"
              >
                <option value="">Todos os status</option>
                <option value="open">Abertas</option>
                <option value="paid">Protegidas / Fatura paga</option>
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="app-input"
              >
                <option value="">Todas as categorias</option>
                {allCategoryOptions.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>

              <select
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="app-input"
              >
                <option value="">Todas as formas</option>
                <option value="credit_card">Cartão de crédito</option>
                <option value="debit_card">Cartão de débito</option>
                <option value="pix">Pix</option>
                <option value="cash">Dinheiro</option>
                <option value="bank_transfer">Transferência</option>
                <option value="boleto">Boleto</option>
                <option value="voucher">Voucher / Vale alimentação</option>
              </select>

              <select
                value={filterAccountId}
                onChange={(e) => setFilterAccountId(e.target.value)}
                className="app-input"
              >
                <option value="">Todas as contas</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>

              <select
                value={filterCardId}
                onChange={(e) => setFilterCardId(e.target.value)}
                className="app-input"
              >
                <option value="">Todos os cartões</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </select>

            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {displayedTransactions.length} transação(ões) encontrada(s)
            </span>
            {hasActiveAdvancedFilters && (
              <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">
                Filtros ativos
              </span>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
          <div className="app-card">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900">
                Nova transação
              </h2>
              <p className="text-sm text-slate-500">
                Preencha os dados para registrar uma movimentação
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Natureza do lançamento
                </label>
                <select
                  value={specialType}
                  onChange={(e) =>
                    setSpecialType(e.target.value as SpecialTransactionType)
                  }
                  className="w-full app-input"
                >
                  <option value="normal">Transação normal</option>
                  <option value="card_adjustment">Ajuste inicial do cartão</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Use ajuste inicial do cartão para registrar saldo já existente na fatura sem bagunçar suas categorias e metas.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Título
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    specialType === "card_adjustment"
                      ? "Ex: Ajuste inicial do cartão"
                      : "Ex: Mercado, Salário, Aluguel"
                  }
                  className="w-full app-input"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Valor
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountInput}
                  onChange={(e) =>
                    setAmountInput(formatCurrencyInput(e.target.value))
                  }
                  placeholder="R$ 0,00"
                  className="w-full app-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tipo
                  </label>
                  <select
                    value={specialType === "card_adjustment" ? "expense" : type}
                    onChange={(e) =>
                      setType(e.target.value as "income" | "expense")
                    }
                    disabled={specialType === "card_adjustment"}
                    className="w-full app-input disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="expense">Saída</option>
                    <option value="income">Entrada</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Data
                  </label>
                  <input
                    type="date"
                    value={createdAt}
                    onChange={(e) => setCreatedAt(e.target.value)}
                    className="w-full app-input"
                  />
                </div>
              </div>

              {specialType === "normal" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Categoria
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full app-input"
                  >
                    {categoryOptions.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Este lançamento será salvo como ajuste inicial do cartão e não entrará nas suas categorias e metas do mês.
                </div>
              )}

              {specialType === "normal" && type === "expense" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tipo de lançamento
                  </label>
                  <select
                    value={isFixed ? "fixed" : "variable"}
                    onChange={(e) => setIsFixed(e.target.value === "fixed")}
                    className="w-full app-input"
                  >
                    <option value="variable">Variável</option>
                    <option value="fixed">Fixa</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    Use fixa para gastos recorrentes, como aluguel, academia ou assinaturas.
                  </p>
                </div>
              )}

              {specialType === "normal" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Forma de pagamento
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as PaymentMethod)
                    }
                    className="w-full app-input"
                  >
                    <option value="">Selecione</option>
                    {type === "expense" && (
                      <option value="credit_card">💳 Cartão de crédito</option>
                    )}
                    <option value="pix">💸 Pix</option>
                    <option value="debit_card">💳 Cartão de débito</option>
                    <option value="cash">💵 Dinheiro</option>
                    <option value="bank_transfer">🏦 Transferência</option>
                    <option value="boleto">🧾 Boleto</option>
                    <option value="voucher">🎫 Vale alimentação</option>
                  </select>
                </div>
              ) : (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                  O ajuste inicial sempre usa <strong>cartão de crédito</strong> e fica fora das categorias de gasto.
                </div>
              )}

              {specialType === "normal" && paymentMethod === "credit_card" && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Tipo de compra no crédito
                    </label>
                    <select
                      value={creditMode}
                      onChange={(e) =>
                        setCreditMode(e.target.value as CreditMode)
                      }
                      className="w-full app-input"
                    >
                      <option value="avista">Crédito à vista</option>
                      <option value="parcelado">Crédito parcelado</option>
                    </select>
                  </div>

                  {creditMode === "parcelado" && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Quantidade de parcelas
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={24}
                        value={installments}
                        onChange={(e) => setInstallments(e.target.value)}
                        className="w-full app-input"
                      />
                    </div>
                  )}
                </>
              )}

              {specialType === "card_adjustment" || paymentMethod === "credit_card" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Cartão
                  </label>
                  <select
                    value={cardId}
                    onChange={(e) => setCardId(e.target.value)}
                    className="w-full app-input"
                  >
                    <option value="">Selecione um cartão</option>
                    {cards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : paymentMethod !== "voucher" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Conta
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full app-input"
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

              <button
                type="submit"
                disabled={submitting}
                className="app-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Salvando..." : "Salvar transação"}
              </button>
            </form>
          </div>

          <div className="app-card">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Histórico de transações
                </h2>
                <p className="text-sm text-slate-500">
                  Visualize todas as movimentações cadastradas
                </p>
              </div>
            </div>

            {loading ? (
              <div className="py-10 text-center text-slate-500">
                Carregando transações...
              </div>
            ) : displayedTransactions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-slate-500">
                Nenhuma transação encontrada com os filtros atuais.
              </div>
            ) : (
              <div className="space-y-3">
                {displayedTransactions.map(({ transaction, groupedPurchase }) => {
                  const accountName =
                    transaction.account?.name ||
                    accounts.find((account) => account.id === transaction.accountId)
                      ?.name ||
                    null;

                  const cardName =
                    transaction.card?.name ||
                    cards.find((card) => card.id === transaction.cardId)?.name ||
                    null;

                  const transactionDate = transaction.date || transaction.createdAt;
                  const normalizedType = normalizeTransactionType(transaction.type);
                  const isPaidInvoice = transaction.invoice?.status === "PAID";
                  const isInstallment = Boolean(transaction.purchaseGroupId);
                  const isAdjustment = isAdjustmentTransaction(transaction);
                  const isEditing = editingId === transaction.id;
                  const isGroupedPurchase = Boolean(groupedPurchase);
                  const editCategoryOptions =
                    editForm?.type === "income"
                      ? INCOME_CATEGORIES
                      : EXPENSE_CATEGORIES;

                  return (
                    <div
                      key={transaction.id}
                      className="rounded-2xl border border-slate-100 p-4"
                    >
                      {isEditing && editForm ? (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              Editando
                            </span>
                            {isInstallment && (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                Compra parcelada não pode ser editada
                              </span>
                            )}
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">
                              Título
                            </label>
                            <input
                              type="text"
                              value={editForm.title}
                              onChange={(e) =>
                                setEditForm((prev) =>
                                  prev ? { ...prev, title: e.target.value } : prev
                                )
                              }
                              className="w-full app-input"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">
                              Valor
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={editForm.amountInput}
                              onChange={(e) =>
                                setEditForm((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        amountInput: formatCurrencyInput(
                                          e.target.value
                                        ),
                                      }
                                    : prev
                                )
                              }
                              className="w-full app-input"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-700">
                                Tipo
                              </label>
                              <select
                                value={editForm.type}
                                onChange={(e) =>
                                  setEditForm((prev) => {
                                    if (!prev) return prev;

                                    const nextType = e.target.value as "income" | "expense";

                                    return {
                                      ...prev,
                                      type: nextType,
                                      category:
                                        nextType === "income"
                                          ? "Salário"
                                          : "Alimentação",
                                      paymentMethod:
                                        nextType === "income" &&
                                        prev.paymentMethod === "credit_card"
                                          ? "pix"
                                          : prev.paymentMethod,
                                      cardId: nextType === "income" ? "" : prev.cardId,
                                      isFixed: nextType === "expense" ? prev.isFixed : false,
                                    };
                                  })
                                }
                                className="w-full app-input"
                              >
                                <option value="expense">Saída</option>
                                <option value="income">Entrada</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-700">
                                Data
                              </label>
                              <input
                                type="date"
                                value={editForm.createdAt}
                                onChange={(e) =>
                                  setEditForm((prev) =>
                                    prev
                                      ? { ...prev, createdAt: e.target.value }
                                      : prev
                                  )
                                }
                                className="w-full app-input"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">
                              Categoria
                            </label>
                            <select
                              value={editForm.category}
                              onChange={(e) =>
                                setEditForm((prev) =>
                                  prev
                                    ? { ...prev, category: e.target.value }
                                    : prev
                                )
                              }
                              className="w-full app-input"
                            >
                              {editCategoryOptions.map((cat) => (
                                <option key={cat.value} value={cat.value}>
                                  {cat.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {editForm.type === "expense" && (
                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-700">
                                Tipo de lançamento
                              </label>
                              <select
                                value={editForm.isFixed ? "fixed" : "variable"}
                                onChange={(e) =>
                                  setEditForm((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          isFixed: e.target.value === "fixed",
                                        }
                                      : prev
                                  )
                                }
                                className="w-full app-input"
                              >
                                <option value="variable">Variável</option>
                                <option value="fixed">Fixa</option>
                              </select>
                            </div>
                          )}

                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">
                              Forma de pagamento
                            </label>
                            <select
                              value={editForm.paymentMethod}
                              onChange={(e) =>
                                setEditForm((prev) => {
                                  if (!prev) return prev;
                                  const nextPaymentMethod = e.target
                                    .value as PaymentMethod;

                                  return {
                                    ...prev,
                                    paymentMethod: nextPaymentMethod,
                                    accountId:
                                      nextPaymentMethod === "credit_card" ||
                                      nextPaymentMethod === "voucher"
                                        ? ""
                                        : prev.accountId,
                                    cardId:
                                      nextPaymentMethod === "credit_card"
                                        ? prev.cardId
                                        : "",
                                  };
                                })
                              }
                              className="w-full app-input"
                            >
                              <option value="">Selecione</option>
                              {editForm.type === "expense" && (
                                <option value="credit_card">
                                  💳 Cartão de crédito
                                </option>
                              )}
                              <option value="pix">💸 Pix</option>
                              <option value="debit_card">💳 Cartão de débito</option>
                              <option value="cash">💵 Dinheiro</option>
                              <option value="bank_transfer">🏦 Transferência</option>
                              <option value="boleto">🧾 Boleto</option>
                              <option value="voucher">🎫 Vale alimentação</option>
                            </select>
                          </div>

                          {editForm.paymentMethod === "credit_card" ? (
                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-700">
                                Cartão
                              </label>
                              <select
                                value={editForm.cardId}
                                onChange={(e) =>
                                  setEditForm((prev) =>
                                    prev ? { ...prev, cardId: e.target.value } : prev
                                  )
                                }
                                className="w-full app-input"
                              >
                                <option value="">Selecione um cartão</option>
                                {cards.map((card) => (
                                  <option key={card.id} value={card.id}>
                                    {card.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : editForm.paymentMethod !== "voucher" ? (
                            <div>
                              <label className="mb-1 block text-sm font-medium text-slate-700">
                                Conta
                              </label>
                              <select
                                value={editForm.accountId}
                                onChange={(e) =>
                                  setEditForm((prev) =>
                                    prev
                                      ? { ...prev, accountId: e.target.value }
                                      : prev
                                  )
                                }
                                className="w-full app-input"
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

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => saveEdit(transaction.id)}
                              disabled={savingEdit}
                              className="app-button-primary disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingEdit ? "Salvando..." : "Salvar"}
                            </button>

                            <button
                              type="button"
                              onClick={cancelEditing}
                              disabled={savingEdit}
                              className="app-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-bold text-slate-900">
                                {isGroupedPurchase ? groupedPurchase?.baseTitle || transaction.title : transaction.title}
                              </h3>

                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  normalizedType === "income"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                {normalizedType === "income" ? "Entrada" : "Saída"}
                              </span>

                              {isAdjustment ? (
                                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                                  Ajuste
                                </span>
                              ) : normalizedType === "expense" ? (
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    transaction.isFixed
                                      ? "bg-sky-100 text-sky-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {getFrequencyLabel(transaction.isFixed)}
                                </span>
                              ) : null}

                              {isPaidInvoice && (
                                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
                                  Fatura paga
                                </span>
                              )}

                              {isInstallment && (
                                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                                  {isGroupedPurchase
                                    ? `Parcelado em ${groupedPurchase?.installmentTotal || transaction.installmentTotal || 1}x`
                                    : "Parcelado"}
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex flex-col gap-1 text-sm text-slate-500">
                              <p>
                                Categoria:{" "}
                                {isAdjustment
                                  ? "Ajuste inicial do cartão"
                                  : getCategoryLabel(transaction.category)}
                              </p>
                              {normalizedType === "expense" && !isAdjustment && (
                                <p>
                                  Tipo de lançamento: {getFrequencyLabel(transaction.isFixed)}
                                </p>
                              )}
                              <p>
                                Forma de pagamento:{" "}
                                {getPaymentMethodLabel(transaction.paymentMethod)}
                              </p>

                              {accountName && <p>Conta: {accountName}</p>}
                              {cardName && <p>Cartão: {cardName}</p>}

                              {isGroupedPurchase && groupedPurchase && (
                                <p>
                                  Compra parcelada em {groupedPurchase.installmentTotal}x de{" "}
                                  {formatCurrency(groupedPurchase.installmentValue)}. As próximas parcelas aparecem quando você navegar para os meses seguintes.
                                </p>
                              )}

                              <p>
                                Data:{" "}
                                {transactionDate
                                  ? new Date(transactionDate).toLocaleDateString(
                                      "pt-BR"
                                    )
                                  : "-"}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-3">
                            <p
                              className={`text-lg font-bold ${
                                normalizedType === "income"
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                              }`}
                            >
                              {normalizedType === "income" ? "+ " : "- "}
                              {formatCurrency(isGroupedPurchase && groupedPurchase ? groupedPurchase.totalAmount : Number(transaction.amount))}
                            </p>

                            <div className="flex flex-wrap justify-end gap-2">
                              {isPaidInvoice ? (
                                <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500">
                                  Transação protegida
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEditing(transaction)}
                                    disabled={isInstallment || isGroupedPurchase}
                                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                      isInstallment
                                        ? "border-slate-200 text-slate-400"
                                        : "border-sky-200 text-sky-700 hover:bg-sky-50"
                                    }`}
                                  >
                                    {isGroupedPurchase ? "Compra parcelada" : isInstallment ? "Parcelado" : "Editar"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDelete(transaction.id, false)
                                    }
                                    disabled={deletingId === transaction.id}
                                    className="app-button-danger disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {deletingId === transaction.id
                                      ? "Excluindo..."
                                      : "Excluir"}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
