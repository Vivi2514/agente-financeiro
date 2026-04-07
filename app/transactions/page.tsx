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
  type: "income" | "expense";
  category?: string | null;
  paymentMethod?: PaymentMethod | string | null;
  accountId?: string | null;
  cardId?: string | null;
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

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [amountInput, setAmountInput] = useState("R$ 0,00");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("Alimentação");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [creditMode, setCreditMode] = useState<CreditMode>("avista");
  const [installments, setInstallments] = useState("2");
  const [accountId, setAccountId] = useState("");
  const [cardId, setCardId] = useState("");
  const [createdAt, setCreatedAt] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - offset * 60 * 1000);
    return localDate.toISOString().slice(0, 10);
  });

  const categoryOptions =
    type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

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
    if (type === "income") {
      setCardId("");

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
  }, [type, paymentMethod, category]);

  useEffect(() => {
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
  }, [paymentMethod]);

  const totalIncome = useMemo(() => {
    return transactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  }, [transactions]);

  const totalExpense = useMemo(() => {
    return transactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  }, [transactions]);

  const balance = useMemo(() => {
    return totalIncome - totalExpense;
  }, [totalIncome, totalExpense]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const amount = parseCurrencyToNumber(amountInput);

    if (!title.trim()) {
      alert("Preencha o título da transação.");
      return;
    }

    if (amount <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    if (!paymentMethod) {
      alert("Selecione uma forma de pagamento.");
      return;
    }

    if (paymentMethod === "credit_card" && !cardId) {
      alert("Selecione um cartão para pagamento no crédito.");
      return;
    }

    if (paymentMethod === "credit_card" && creditMode === "parcelado") {
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

    if (paymentMethod !== "credit_card" && paymentMethod !== "voucher" && !accountId) {
      alert("Selecione uma conta.");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        title: title.trim(),
        amount,
        type,
        category: category || "Outros",
        paymentMethod,
        creditMode: paymentMethod === "credit_card" ? creditMode : null,
        installments:
          paymentMethod === "credit_card" && creditMode === "parcelado"
            ? Number(installments)
            : 1,
        accountId:
          paymentMethod === "credit_card" || paymentMethod === "voucher"
            ? null
            : accountId || null,
        cardId: paymentMethod === "credit_card" ? cardId || null : null,
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
        console.error("Erro da API:", errorData);
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

      await loadData();
    } catch (error) {
      console.error(error);
      alert("Não foi possível criar a transação.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      "Tem certeza que deseja excluir esta transação?"
    );

    if (!confirmed) return;

    try {
      setDeletingId(id);

      const response = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Erro ao excluir transação");
      }

      await loadData();
    } catch (error) {
      console.error(error);
      alert("Não foi possível excluir a transação.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Transações</p>
            <h1 className="text-3xl font-bold text-slate-900">
              Lançamentos financeiros
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Cadastre entradas e saídas do seu app financeiro
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Ir para dashboard
            </Link>

            <Link
              href="/accounts"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Contas e cartões
            </Link>

            <Link
              href="/invoices"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Faturas
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Entradas</p>
            <h2 className="mt-2 text-2xl font-bold text-emerald-600">
              {formatCurrency(totalIncome)}
            </h2>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Saídas</p>
            <h2 className="mt-2 text-2xl font-bold text-rose-600">
              {formatCurrency(totalExpense)}
            </h2>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
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

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
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
                  Título
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Mercado, Salário, Aluguel"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
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
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tipo
                  </label>
                  <select
                    value={type}
                    onChange={(e) =>
                      setType(e.target.value as "income" | "expense")
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
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
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Forma de pagamento
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
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

              {paymentMethod === "credit_card" && (
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
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
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
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                      />
                    </div>
                  )}
                </>
              )}

              {paymentMethod === "credit_card" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Cartão
                  </label>
                  <select
                    value={cardId}
                    onChange={(e) => setCardId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
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
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
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
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Salvando..." : "Salvar transação"}
              </button>
            </form>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
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
            ) : transactions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-slate-500">
                Nenhuma transação cadastrada ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {[...transactions]
                  .sort((a, b) => {
                    const dateA = new Date(b.date || b.createdAt || 0).getTime();
                    const dateB = new Date(a.date || a.createdAt || 0).getTime();
                    return dateA - dateB;
                  })
                  .map((transaction) => {
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

                    return (
                      <div
                        key={transaction.id}
                        className="rounded-2xl border border-slate-100 p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-bold text-slate-900">
                                {transaction.title}
                              </h3>

                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  transaction.type === "income"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                {transaction.type === "income" ? "Entrada" : "Saída"}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-col gap-1 text-sm text-slate-500">
                              <p>
                                Categoria: {getCategoryLabel(transaction.category)}
                              </p>
                              <p>
                                Forma de pagamento:{" "}
                                {getPaymentMethodLabel(transaction.paymentMethod)}
                              </p>

                              {accountName && <p>Conta: {accountName}</p>}
                              {cardName && <p>Cartão: {cardName}</p>}

                              <p>
                                Data:{" "}
                                {transactionDate
                                  ? new Date(transactionDate).toLocaleDateString("pt-BR")
                                  : "-"}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-start gap-3 md:items-end">
                            <p
                              className={`text-lg font-bold ${
                                transaction.type === "income"
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                              }`}
                            >
                              {transaction.type === "income" ? "+ " : "- "}
                              {formatCurrency(Number(transaction.amount))}
                            </p>

                            <button
                              type="button"
                              onClick={() => handleDelete(transaction.id)}
                              disabled={deletingId === transaction.id}
                              className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingId === transaction.id
                                ? "Excluindo..."
                                : "Excluir"}
                            </button>
                          </div>
                        </div>
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