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

type Account = {
  id: string;
  name: string;
  bank?: string | null;
  balance?: number | null;
};

type Card = {
  id: string;
  name: string;
  brand?: string | null;
  limit?: number | null;
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
  isFixed?: boolean | null;
  status?: "PLANNED" | "PAID" | "IGNORED";
  isPaid?: boolean;
  realTransactionId?: string | null;
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

type FormState = {
  title: string;
  amount: string;
  type: "expense" | "income";
  category: string;
  paymentMethod: PaymentMethod;
  accountId: string;
  cardId: string;
  dayOfMonth: string;
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

const EMPTY_FORM: FormState = {
  title: "",
  amount: "",
  type: "expense",
  category: "Casa",
  paymentMethod: "pix",
  accountId: "",
  cardId: "",
  dayOfMonth: "5",
  isFixed: true,
};

function formatCurrency(value?: number | null) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseCurrencyInput(value: string) {
  const normalized = value
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  return Number(normalized || 0);
}

function formatAmountForInput(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeType(value?: string | null) {
  const normalized = (value || "").toLowerCase();
  if (normalized === "income" || normalized === "entrada") return "income";
  return "expense";
}

function getRecurringActionLabel(type?: string | null) {
  return normalizeType(type) === "income" ? "Receber" : "Pagar";
}

function getRecurringConfirmLabel(type?: string | null) {
  return normalizeType(type) === "income"
    ? "Confirmar recebimento"
    : "Confirmar pagamento";
}

function getRecurringDoneLabel(type?: string | null) {
  return normalizeType(type) === "income" ? "Recebido" : "Pago";
}

function getRecurringAmountQuestion(type?: string | null, title?: string | null) {
  return normalizeType(type) === "income"
    ? `Qual foi o valor recebido de ${title || "esta entrada"}?`
    : `Qual foi o valor pago de ${title || "esta saída"}?`;
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
      return "Vale alimentação";
    default:
      return "Não informado";
  }
}

function getMonthInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) return "Mês atual";

  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export default function RecorrentesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [recurrings, setRecurrings] = useState<RecurringTransaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    getMonthInputValue(new Date()),
  );
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const categoryOptions =
    form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const summary = useMemo(() => {
    const activeItems = recurrings.filter((item) => item.active);
    const planned = activeItems.filter(
      (item) => item.status !== "PAID" && item.status !== "IGNORED",
    );
    const paid = activeItems.filter((item) => item.status === "PAID" || item.isPaid);

    const plannedExpenses = planned
      .filter((item) => normalizeType(item.type) === "expense")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const plannedIncomes = planned
      .filter((item) => normalizeType(item.type) === "income")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const paidTotal = paid.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      activeCount: activeItems.length,
      plannedCount: planned.length,
      paidCount: paid.length,
      plannedExpenses,
      plannedIncomes,
      paidTotal,
      projectedBalance: plannedIncomes - plannedExpenses,
    };
  }, [recurrings]);

  function showFeedback(type: "success" | "error" | "info", message: string) {
    setFeedback({ type, message });
    window.setTimeout(() => setFeedback(null), 3500);
  }

  async function loadData() {
    try {
      setLoading(true);

      const [accountsRes, cardsRes, recurringsRes] = await Promise.all([
        fetch("/api/accounts", { cache: "no-store" }),
        fetch("/api/cards", { cache: "no-store" }),
        fetch(`/api/recurring?month=${selectedMonth}`, { cache: "no-store" }),
      ]);

      const accountsData = accountsRes.ok ? await accountsRes.json() : [];
      const cardsData = cardsRes.ok ? await cardsRes.json() : [];
      const recurringsData = recurringsRes.ok ? await recurringsRes.json() : [];

      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setCards(Array.isArray(cardsData) ? cardsData : []);
      setRecurrings(Array.isArray(recurringsData) ? recurringsData : []);
    } catch (error) {
      console.error("Erro ao carregar compromissos:", error);
      showFeedback("error", "Não foi possível carregar os compromissos.");
      setAccounts([]);
      setCards([]);
      setRecurrings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  useEffect(() => {
    if (form.type === "income") {
      setForm((current) => ({
        ...current,
        category: ["Salário", "Adiantamento", "Vale alimentação", "Extra", "Outros"].includes(
          current.category,
        )
          ? current.category
          : "Salário",
        paymentMethod: current.paymentMethod === "credit_card" ? "pix" : current.paymentMethod,
        cardId: "",
        isFixed: true,
      }));
    } else if (["Salário", "Adiantamento", "Vale alimentação", "Extra"].includes(form.category)) {
      setForm((current) => ({ ...current, category: "Casa" }));
    }
  }, [form.type]);

  useEffect(() => {
    if (form.paymentMethod === "credit_card") {
      setForm((current) => ({ ...current, accountId: "" }));
      return;
    }

    if (form.paymentMethod === "voucher") {
      setForm((current) => ({ ...current, accountId: "", cardId: "" }));
      return;
    }

    setForm((current) => ({ ...current, cardId: "" }));
  }, [form.paymentMethod]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEditing(item: RecurringTransaction) {
    const type = normalizeType(item.type) as "expense" | "income";

    setEditingId(item.id);
    setForm({
      title: item.title || "",
      amount: formatAmountForInput(Number(item.amount || 0)),
      type,
      category: item.category || (type === "income" ? "Salário" : "Casa"),
      paymentMethod: (item.paymentMethod || "pix") as PaymentMethod,
      accountId: item.accountId || "",
      cardId: item.cardId || "",
      dayOfMonth: String(item.dayOfMonth || 5),
      isFixed: item.isFixed !== false,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = parseCurrencyInput(form.amount);
    const dayOfMonth = Number(form.dayOfMonth);

    if (!form.title.trim()) {
      showFeedback("error", "Informe o nome do compromisso.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showFeedback("error", "Informe um valor válido.");
      return;
    }

    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      showFeedback("error", "Informe um dia entre 1 e 31.");
      return;
    }

    if (form.paymentMethod === "credit_card" && !form.cardId) {
      showFeedback("error", "Selecione o cartão desse compromisso.");
      return;
    }

    if (
      form.paymentMethod !== "credit_card" &&
      form.paymentMethod !== "voucher" &&
      !form.accountId
    ) {
      showFeedback("error", "Selecione a conta desse compromisso.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      amount,
      type: form.type,
      category: form.category || null,
      paymentMethod: form.paymentMethod || null,
      accountId:
        form.paymentMethod === "credit_card" || form.paymentMethod === "voucher"
          ? null
          : form.accountId || null,
      cardId: form.paymentMethod === "credit_card" ? form.cardId || null : null,
      dayOfMonth,
      isFixed: form.isFixed,
    };

    try {
      setSaving(true);

      const response = await fetch(
        editingId ? `/api/recurring/${editingId}` : "/api/recurring",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível salvar o compromisso.");
      }

      resetForm();
      await loadData();
      showFeedback(
        "success",
        editingId
          ? "Compromisso atualizado com sucesso."
          : "Compromisso cadastrado com sucesso.",
      );
    } catch (error) {
      showFeedback(
        "error",
        error instanceof Error ? error.message : "Erro ao salvar compromisso.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: RecurringTransaction) {
    try {
      setActionId(item.id);

      const response = await fetch(`/api/recurring/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível atualizar o compromisso.");
      }

      await loadData();
      showFeedback(
        "success",
        item.active ? "Compromisso pausado." : "Compromisso ativado.",
      );
    } catch (error) {
      showFeedback(
        "error",
        error instanceof Error ? error.message : "Erro ao atualizar compromisso.",
      );
    } finally {
      setActionId(null);
    }
  }

  async function deleteRecurring(item: RecurringTransaction) {
    const confirmed = window.confirm(
      `Deseja excluir o compromisso "${item.title}"? Essa ação não pode ser desfeita.`,
    );

    if (!confirmed) return;

    try {
      setActionId(item.id);

      const response = await fetch(`/api/recurring/${item.id}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível excluir o compromisso.");
      }

      if (editingId === item.id) resetForm();
      await loadData();
      showFeedback("success", "Compromisso excluído.");
    } catch (error) {
      showFeedback(
        "error",
        error instanceof Error ? error.message : "Erro ao excluir compromisso.",
      );
    } finally {
      setActionId(null);
    }
  }

  async function confirmRecurring(item: RecurringTransaction) {
    if (item.status === "PAID" || item.isPaid) {
      showFeedback("info", `Esse compromisso já está marcado como ${getRecurringDoneLabel(item.type).toLowerCase()} neste mês.`);
      return;
    }

    const suggestedAmount = formatAmountForInput(Number(item.amount || 0));
    const amountInput = window.prompt(
      getRecurringAmountQuestion(item.type, item.title),
      suggestedAmount,
    );

    if (amountInput === null) return;

    const paidAmount = parseCurrencyInput(amountInput);

    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      showFeedback("error", `Informe um valor ${normalizeType(item.type) === "income" ? "recebido" : "pago"} válido.`);
      return;
    }

    const [year, month] = selectedMonth.split("-").map(Number);
    const safeDay = Math.min(Math.max(Number(item.dayOfMonth || 1), 1), 31);
    const daysInMonth = new Date(year, month, 0).getDate();
    const paymentDay = Math.min(safeDay, daysInMonth);
    const paymentDate = `${year}-${String(month).padStart(2, "0")}-${String(
      paymentDay,
    ).padStart(2, "0")}`;

    const confirmed = window.confirm(
      `${getRecurringConfirmLabel(item.type)} de ${item.title} em ${paymentDate} no valor de ${formatCurrency(
        paidAmount,
      )}?`,
    );

    if (!confirmed) return;

    try {
      setActionId(item.id);

      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          amount: paidAmount,
          type: normalizeType(item.type),
          category: item.category || null,
          paymentMethod: item.paymentMethod || null,
          creditMode: "avista",
          installments: 1,
          accountId:
            item.paymentMethod === "credit_card" || item.paymentMethod === "voucher"
              ? null
              : item.accountId || null,
          cardId: item.paymentMethod === "credit_card" ? item.cardId || null : null,
          isFixed: true,
          isAdjustment: false,
          date: paymentDate,
          createdAt: paymentDate,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || `Não foi possível registrar ${normalizeType(item.type) === "income" ? "o recebimento" : "o pagamento"}.`);
      }

      await loadData();
      showFeedback(
        "success",
        `${getRecurringDoneLabel(item.type)}: ${item.title} registrado em ${formatCurrency(paidAmount)}.`,
      );
    } catch (error) {
      showFeedback(
        "error",
        error instanceof Error ? error.message : `Erro ao registrar ${normalizeType(item.type) === "income" ? "recebimento" : "pagamento"}.`,
      );
    } finally {
      setActionId(null);
    }
  }

  function changeSelectedMonth(direction: "prev" | "next") {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + (direction === "next" ? 1 : -1));
    setSelectedMonth(getMonthInputValue(date));
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                Compromissos mensais
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-4xl">
                Custos fixos e previsões
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Cadastre contas fixas, salário e vale alimentação uma vez. Depois confirme o valor real quando pagar ou receber.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Dashboard
              </Link>
              <Link
                href="/transactions"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Transações
              </Link>
              <Link
                href="/invoices"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Faturas
              </Link>
            </div>
          </div>
        </header>

        {feedback && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : feedback.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-sky-200 bg-sky-50 text-sky-800"
            }`}
          >
            {feedback.message}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Ativos
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {summary.activeCount}
            </p>
          </div>
          <div className="rounded-3xl border border-rose-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Saídas previstas
            </p>
            <p className="mt-2 text-2xl font-black text-rose-600">
              {formatCurrency(summary.plannedExpenses)}
            </p>
          </div>
          <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Entradas previstas
            </p>
            <p className="mt-2 text-2xl font-black text-emerald-600">
              {formatCurrency(summary.plannedIncomes)}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Saldo previsto
            </p>
            <p
              className={`mt-2 text-2xl font-black ${
                summary.projectedBalance >= 0 ? "text-slate-950" : "text-rose-600"
              }`}
            >
              {formatCurrency(summary.projectedBalance)}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <form
            onSubmit={handleSubmit}
            className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  {editingId ? "Editando" : "Novo compromisso"}
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  {editingId ? "Editar compromisso" : "Cadastrar fixo"}
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Use para saídas e entradas que se repetem mês a mês.
                </p>
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Nome
                </label>
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Ex: Luz, Wifi, Netflix"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Valor previsto
                  </label>
                  <input
                    value={form.amount}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, amount: event.target.value }))
                    }
                    placeholder="130,00"
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Dia do mês
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={form.dayOfMonth}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, dayOfMonth: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Tipo
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, type: "expense" }))}
                    className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                      form.type === "expense"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Saída
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, type: "income" }))}
                    className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                      form.type === "income"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Entrada
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Categoria
                </label>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, category: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  {categoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  {form.type === "income" ? "Forma de recebimento" : "Forma de pagamento"}
                </label>
                <select
                  value={form.paymentMethod}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      paymentMethod: event.target.value as PaymentMethod,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  {form.type === "expense" && (
                    <option value="credit_card">Cartão de crédito</option>
                  )}
                  <option value="pix">Pix</option>
                  <option value="debit_card">Cartão de débito</option>
                  <option value="cash">Dinheiro</option>
                  <option value="bank_transfer">Transferência</option>
                  <option value="boleto">Boleto</option>
                  <option value="voucher">Vale alimentação</option>
                </select>
              </div>

              {form.paymentMethod === "credit_card" ? (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Cartão
                  </label>
                  <select
                    value={form.cardId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, cardId: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  >
                    <option value="">Selecione um cartão</option>
                    {cards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : form.paymentMethod !== "voucher" ? (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    {form.type === "income" ? "Conta de recebimento" : "Conta"}
                  </label>
                  <select
                    value={form.accountId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, accountId: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
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
                  Vale alimentação não usa conta bancária.
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Salvando..."
                  : editingId
                  ? "Salvar alterações"
                  : "Cadastrar compromisso"}
              </button>
            </div>
          </form>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  Mês de referência
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  {formatMonthLabel(selectedMonth)}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Veja o que já está pago e o que ainda está previsto.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => changeSelectedMonth("prev")}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  ←
                </button>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 outline-none"
                />
                <button
                  type="button"
                  onClick={() => changeSelectedMonth("next")}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  →
                </button>
              </div>
            </div>

            {loading ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                Carregando compromissos...
              </div>
            ) : recurrings.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
                <p className="text-sm font-bold text-slate-700">
                  Nenhum compromisso cadastrado ainda.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Cadastre Luz, Wifi, Salário, Vale alimentação ou qualquer previsão recorrente no formulário ao lado.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {recurrings.map((item) => {
                  const type = normalizeType(item.type);
                  const isPaid = item.status === "PAID" || item.isPaid;
                  const isIgnored = item.status === "IGNORED";
                  const statusLabel = isPaid
                    ? getRecurringDoneLabel(type)
                    : isIgnored
                    ? "Ignorado"
                    : item.active
                    ? "Previsto"
                    : "Pausado";
                  const statusClass = isPaid
                    ? "bg-emerald-100 text-emerald-700"
                    : isIgnored
                    ? "bg-slate-100 text-slate-600"
                    : item.active
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-500";

                  return (
                    <article
                      key={item.id}
                      className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-black text-slate-950">
                              {item.title}
                            </h3>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}>
                              {statusLabel}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                type === "income"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {type === "income" ? "Entrada" : "Saída"}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-500">
                            Dia {item.dayOfMonth} · {item.category || "Sem categoria"} · {getPaymentMethodLabel(item.paymentMethod)}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {item.card?.name
                              ? `Cartão: ${item.card.name}`
                              : item.account?.name
                              ? `Conta: ${item.account.name}`
                              : "Sem conta vinculada"}
                            {item.realTransactionId ? " · Transação real vinculada" : ""}
                          </p>
                        </div>

                        <div className="flex flex-col gap-3 md:items-end">
                          <p
                            className={`text-xl font-black ${
                              type === "income" ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {type === "income" ? "+ " : "- "}
                            {formatCurrency(Number(item.amount || 0))}
                          </p>

                          <div className="flex flex-wrap gap-2 md:justify-end">
                            {!isPaid && item.active && (
                              <button
                                type="button"
                                disabled={actionId === item.id}
                                onClick={() => confirmRecurring(item)}
                                className="rounded-full bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                              >
                                {getRecurringActionLabel(type)}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startEditing(item)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={actionId === item.id}
                              onClick={() => toggleActive(item)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              {item.active ? "Pausar" : "Ativar"}
                            </button>
                            <button
                              type="button"
                              disabled={actionId === item.id}
                              onClick={() => deleteRecurring(item)}
                              className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
