"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: string;
  category?: string | null;
  isAdjustment?: boolean | null;
  date: string;
};

type CategoryGoalMap = Record<string, number>;

type CategoryConfig = {
  name: string;
  icon: string;
};

const CATEGORY_CONFIG: CategoryConfig[] = [
  { name: "Alimentação", icon: "🍔" },
  { name: "Transporte", icon: "🚗" },
  { name: "Saúde", icon: "💊" },
  { name: "Pet", icon: "🐶" },
  { name: "Casa", icon: "🏠" },
  { name: "Eletronico", icon: "💻" },
  { name: "Lazer", icon: "🎉" },
  { name: "Pessoal", icon: "🧍" },
  { name: "Vestuário", icon: "👕" },
  { name: "SkinCare", icon: "🧴" },
  { name: "Reforma", icon: "🔨" },
  { name: "Outros", icon: "📦" },
];

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

function normalizeComparableText(value?: string | null) {
  return (value || "").trim().toLowerCase();
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

function getProgressTone(percentage: number) {
  if (percentage >= 90) {
    return {
      bar: "bg-rose-500",
      badge: "bg-rose-100 text-rose-700",
      label: "No limite",
    };
  }

  if (percentage >= 60) {
    return {
      bar: "bg-amber-500",
      badge: "bg-amber-100 text-amber-700",
      label: "Atenção",
    };
  }

  return {
    bar: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
    label: "Saudável",
  };
}

export default function GoalsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(
    getMonthInputValue(new Date())
  );

  const [goals, setGoals] = useState<CategoryGoalMap>({});
  const [goalInputs, setGoalInputs] = useState<Record<string, string>>({});
  const [savingCategory, setSavingCategory] = useState<string | null>(null);

  async function loadTransactions() {
    try {
      setLoading(true);

      const response = await fetch("/api/transactions", { cache: "no-store" });
      const data = response.ok ? await response.json() : [];

      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar transações:", error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(getGoalsStorageKey(selectedMonth));
    const parsed: CategoryGoalMap = saved ? JSON.parse(saved) : {};

    setGoals(parsed);

    const initialInputs: Record<string, string> = {};
    CATEGORY_CONFIG.forEach((category) => {
      initialInputs[category.name] =
        parsed[category.name] && parsed[category.name] > 0
          ? String(parsed[category.name])
          : "";
    });

    setGoalInputs(initialInputs);
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

  const analyticalExpenses = useMemo(() => {
    return filteredTransactions.filter(
      (transaction) =>
        isExpenseType(transaction.type) && !isAdjustmentTransaction(transaction)
    );
  }, [filteredTransactions]);

  const categorySpentMap = useMemo(() => {
    const result: Record<string, number> = {};

    analyticalExpenses.forEach((transaction) => {
      const rawCategory =
        transaction.category && transaction.category.trim() !== ""
          ? transaction.category
          : "Outros";

      const categoryName =
        rawCategory === "Eletrônico" ? "Eletronico" : rawCategory;

      result[categoryName] =
        (result[categoryName] || 0) + Number(transaction.amount || 0);
    });

    return result;
  }, [analyticalExpenses]);

  const categoriesSummary = useMemo(() => {
    return CATEGORY_CONFIG.map((category) => {
      const goal = Number(goals[category.name] || 0);
      const spent = Number(categorySpentMap[category.name] || 0);
      const remaining = Math.max(goal - spent, 0);
      const percentage = goal > 0 ? (spent / goal) * 100 : 0;

      return {
        ...category,
        goal,
        spent,
        remaining,
        percentage,
        exceeded: goal > 0 && spent > goal,
      };
    });
  }, [goals, categorySpentMap]);

  const summary = useMemo(() => {
    const totalPlanned = categoriesSummary.reduce(
      (sum, item) => sum + Number(item.goal || 0),
      0
    );

    const totalSpent = categoriesSummary.reduce(
      (sum, item) => sum + Number(item.spent || 0),
      0
    );

    const totalRemaining = Math.max(totalPlanned - totalSpent, 0);
    const usageAverage = totalPlanned > 0 ? (totalSpent / totalPlanned) * 100 : 0;

    return {
      totalPlanned,
      totalSpent,
      totalRemaining,
      usageAverage,
    };
  }, [categoriesSummary]);

  function saveGoal(categoryName: string) {
    setSavingCategory(categoryName);

    const parsedValue = Number(
      (goalInputs[categoryName] || "").replace(",", ".").trim()
    );

    const safeValue =
      Number.isNaN(parsedValue) || parsedValue < 0 ? 0 : parsedValue;

    const nextGoals = {
      ...goals,
      [categoryName]: safeValue,
    };

    setGoals(nextGoals);
    localStorage.setItem(
      getGoalsStorageKey(selectedMonth),
      JSON.stringify(nextGoals)
    );

    window.setTimeout(() => {
      setSavingCategory((current) => (current === categoryName ? null : current));
    }, 350);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Planejamento</p>
              <h1 className="text-3xl font-bold text-slate-900">
                Metas e categorias
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Defina limites e acompanhe quanto já foi gasto no mês.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/"
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Voltar para início
              </Link>

              <Link
                href="/transactions"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Lançar transação
              </Link>

              <Link
                href="/invoices"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cartão de crédito
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total planejado
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatCurrency(summary.totalPlanned)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Gasto atual
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatCurrency(summary.totalSpent)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Restante
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatCurrency(summary.totalRemaining)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Uso médio
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {summary.usageAverage.toFixed(0)}%
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Mês
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400"
              />
            </div>
          </div>
        </header>

        <section className="space-y-4">
          {loading ? (
            <div className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">
              Carregando metas e categorias...
            </div>
          ) : (
            categoriesSummary.map((category) => {
              const tone = getProgressTone(category.percentage);
              const progressWidth =
                category.goal > 0
                  ? `${Math.min(category.percentage, 100)}%`
                  : "0%";

              return (
                <div
                  key={category.name}
                  className="rounded-3xl bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{category.icon}</span>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {category.name}
                      </h2>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.badge}`}
                      >
                        {category.goal > 0 ? tone.label : "Sem meta"}
                      </span>
                    </div>

                    <div className="text-sm text-slate-500">
                      {formatCurrency(category.spent)} /{" "}
                      {formatCurrency(category.goal)}
                    </div>
                  </div>

                  <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${tone.bar}`}
                      style={{ width: progressWidth }}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Meta da categoria
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={goalInputs[category.name] || ""}
                          onChange={(e) =>
                            setGoalInputs((current) => ({
                              ...current,
                              [category.name]: e.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                          placeholder="Meta em R$"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => saveGoal(category.name)}
                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                      >
                        {savingCategory === category.name ? "Salvo" : "Salvar"}
                      </button>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Gasto no mês
                      </p>
                      <p className="mt-2 text-xl font-bold text-slate-900">
                        {formatCurrency(category.spent)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Restante
                      </p>
                      <p
                        className={`mt-2 text-xl font-bold ${
                          category.exceeded ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {category.exceeded
                          ? `-${formatCurrency(category.spent - category.goal)}`
                          : formatCurrency(category.remaining)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-slate-500">
                    {category.goal <= 0
                      ? "Defina uma meta para começar a acompanhar essa categoria."
                      : category.exceeded
                      ? "Essa categoria já passou do limite planejado neste mês."
                      : `Você usou ${category.percentage.toFixed(
                          0
                        )}% da meta desta categoria.`}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}