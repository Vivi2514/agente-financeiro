"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Account = {
  id: string;
  name: string;
  type?: string | null;
  balance: number;
};

type Card = {
  id: string;
  name: string;
  limit: number;
  monthlyLimit?: number | null;
  closingDay: number;
  dueDay: number;
  brand?: string | null;
};

type Invoice = {
  id: string;
  cardId: string;
  month: number;
  year: number;
  total: number;
  status: "OPEN" | "PAID";
  closedAt?: string | null;
};

type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: string;
  paymentMethod?: string | null;
  cardId?: string | null;
  date?: string | null;
  createdAt?: string | null;
  isAdjustment?: boolean | null;
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [accountName, setAccountName] = useState("");
  const [accountBank, setAccountBank] = useState("");
  const [accountBalance, setAccountBalance] = useState("");

  const [cardName, setCardName] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [cardMonthlyLimit, setCardMonthlyLimit] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [savingMonthlyLimitCardId, setSavingMonthlyLimitCardId] = useState<string | null>(null);
  const [monthlyLimitInputs, setMonthlyLimitInputs] = useState<Record<string, string>>({});

  async function loadData() {
    try {
      setLoading(true);

      const [accRes, cardRes, invoiceRes, transactionRes] = await Promise.all([
        fetch("/api/accounts", { cache: "no-store" }),
        fetch("/api/cards", { cache: "no-store" }),
        fetch("/api/invoices", { cache: "no-store" }),
        fetch("/api/transactions", { cache: "no-store" }),
      ]);

      const accData = accRes.ok ? await accRes.json() : [];
      const cardData = cardRes.ok ? await cardRes.json() : [];
      const invoiceData = invoiceRes.ok ? await invoiceRes.json() : [];
      const transactionData = transactionRes.ok ? await transactionRes.json() : [];

      const safeCards = Array.isArray(cardData) ? cardData : [];

      setAccounts(Array.isArray(accData) ? accData : []);
      setCards(safeCards);
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      setTransactions(Array.isArray(transactionData) ? transactionData : []);

      const nextMonthlyLimitInputs: Record<string, string> = {};
      safeCards.forEach((card: Card) => {
        nextMonthlyLimitInputs[card.id] =
          Number(card.monthlyLimit || 0) > 0 ? String(Number(card.monthlyLimit)) : "";
      });
      setMonthlyLimitInputs(nextMonthlyLimitInputs);
    } catch (error) {
      console.error("Erro ao carregar contas/cartões:", error);
      setAccounts([]);
      setCards([]);
      setInvoices([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createAccount() {
    if (!accountName || !accountBank || !accountBalance) {
      alert("Preencha nome, banco e saldo.");
      return;
    }

    try {
      setSavingAccount(true);

      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: accountName,
          type: accountBank,
          balance: parseFloat(accountBalance.replace(",", ".")),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Erro ao criar conta");
      }

      setAccountName("");
      setAccountBank("");
      setAccountBalance("");

      await loadData();
      alert("Conta criada com sucesso.");
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a conta."
      );
    } finally {
      setSavingAccount(false);
    }
  }

  async function createCard() {
    if (!cardName || !cardLimit || !closingDay || !dueDay) {
      alert("Preencha todos os campos do cartão.");
      return;
    }

    try {
      setSavingCard(true);

      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cardName,
          limit: parseFloat(cardLimit.replace(",", ".")),
          monthlyLimit: cardMonthlyLimit.trim()
            ? parseFloat(cardMonthlyLimit.replace(",", "."))
            : null,
          closingDay: Number(closingDay),
          dueDay: Number(dueDay),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Erro ao criar cartão");
      }

      setCardName("");
      setCardLimit("");
      setCardMonthlyLimit("");
      setClosingDay("");
      setDueDay("");

      await loadData();
      alert("Cartão criado com sucesso.");
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o cartão."
      );
    } finally {
      setSavingCard(false);
    }
  }

  function getCardMonthlyLimitStatus(percentage: number | null) {
    if (percentage === null) {
      return {
        badge: "app-badge-neutral",
        label: "Sem limite mensal",
        progress: "app-progress-success",
        message: "Defina um limite mensal consciente para esse cartão.",
      };
    }

    if (percentage >= 100) {
      return {
        badge: "app-badge-danger",
        label: "Limite estourado",
        progress: "app-progress-danger",
        message: "Você já passou do limite mensal que decidiu usar neste cartão.",
      };
    }

    if (percentage >= 90) {
      return {
        badge: "app-badge-danger",
        label: "Quase no limite",
        progress: "app-progress-danger",
        message: "Pare de usar este cartão para não criar nova dívida.",
      };
    }

    if (percentage >= 70) {
      return {
        badge: "app-badge-warning",
        label: "Atenção",
        progress: "app-progress-warning",
        message: "Você já usou mais de 70% do seu limite mensal consciente.",
      };
    }

    return {
      badge: "app-badge-success",
      label: "Controlado",
      progress: "app-progress-success",
      message: "Uso dentro do limite mensal planejado.",
    };
  }

  function isCreditCardTransaction(transaction: Transaction) {
    return (transaction.paymentMethod || "").toLowerCase() === "credit_card";
  }

  function isExpenseTransaction(transaction: Transaction) {
    const normalized = (transaction.type || "").toLowerCase();
    return normalized === "expense" || normalized === "saida" || normalized === "saída";
  }

  function getTransactionDate(transaction: Transaction) {
    return transaction.date || transaction.createdAt || "";
  }

  async function saveMonthlyLimit(cardId: string) {
    const rawValue = monthlyLimitInputs[cardId] || "";
    const monthlyLimit = rawValue.trim()
      ? parseFloat(rawValue.replace(",", "."))
      : null;

    if (monthlyLimit !== null && (!Number.isFinite(monthlyLimit) || monthlyLimit < 0)) {
      alert("Informe um limite mensal válido.");
      return;
    }

    try {
      setSavingMonthlyLimitCardId(cardId);

      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          monthlyLimit,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Erro ao salvar limite mensal.");
      }

      await loadData();
      alert("Limite mensal salvo com sucesso.");
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o limite mensal."
      );
    } finally {
      setSavingMonthlyLimitCardId(null);
    }
  }

  const cardSummaries = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return cards.map((card) => {
      const openInvoices = invoices.filter(
        (invoice) => invoice.cardId === card.id && invoice.status === "OPEN"
      );

      const used = openInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.total || 0),
        0
      );

      const monthlyUsed = transactions
        .filter((transaction) => {
          if (transaction.cardId !== card.id) return false;
          if (!isCreditCardTransaction(transaction)) return false;
          if (!isExpenseTransaction(transaction)) return false;
          if (transaction.isAdjustment) return false;

          const transactionDate = new Date(getTransactionDate(transaction));
          if (Number.isNaN(transactionDate.getTime())) return false;

          return (
            transactionDate.getFullYear() === currentYear &&
            transactionDate.getMonth() === currentMonth
          );
        })
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

      const limit = Number(card.limit || 0);
      const monthlyLimit = Number(card.monthlyLimit || 0);
      const available = limit - used;
      const usagePercent = limit > 0 ? (used / limit) * 100 : 0;
      const monthlyAvailable = monthlyLimit > 0 ? monthlyLimit - monthlyUsed : 0;
      const monthlyUsagePercent =
        monthlyLimit > 0 ? (monthlyUsed / monthlyLimit) * 100 : null;

      return {
        ...card,
        used,
        available,
        usagePercent,
        monthlyUsed,
        monthlyLimit,
        monthlyAvailable,
        monthlyUsagePercent,
        openInvoicesCount: openInvoices.length,
      };
    });
  }, [cards, invoices, transactions]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="app-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="app-subtitle">Contas e cartões</p>
              <h1 className="app-title">Gerenciar contas e cartões</h1>
              <p className="mt-1 text-sm text-slate-500">
                Cadastre suas contas bancárias e cartões de crédito
              </p>
            </div>

            <Link href="/" className="app-button-secondary inline-flex items-center">
              ← Voltar para home
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="app-card">
            <h2 className="text-xl font-bold text-slate-900">Criar conta</h2>
            <p className="mt-1 text-sm text-slate-500">
              Adicione uma conta para movimentações e pagamento de faturas
            </p>

            <div className="mt-5 space-y-4">
              <input
                placeholder="Nome"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="app-input"
              />
              <input
                placeholder="Banco"
                value={accountBank}
                onChange={(e) => setAccountBank(e.target.value)}
                className="app-input"
              />
              <input
                placeholder="Saldo"
                value={accountBalance}
                onChange={(e) => setAccountBalance(e.target.value)}
                className="app-input"
              />

              <button
                onClick={createAccount}
                disabled={savingAccount}
                className="app-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingAccount ? "Salvando..." : "Salvar conta"}
              </button>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-slate-900">Contas</h3>

              {loading ? (
                <p className="mt-3 text-sm text-slate-500">Carregando...</p>
              ) : accounts.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  Nenhuma conta cadastrada.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {accounts.map((acc) => (
                    <div key={acc.id} className="app-card-soft border border-slate-100 p-4">
                      <p className="font-semibold text-slate-900">{acc.name}</p>
                      <p className="text-sm text-slate-500">
                        {acc.type || "Conta"} •{" "}
                        <span className="app-value-neutral">
                          {formatCurrency(Number(acc.balance))}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="app-card">
            <h2 className="text-xl font-bold text-slate-900">Criar cartão</h2>
            <p className="mt-1 text-sm text-slate-500">
              Cadastre o cartão para compras no crédito e geração de faturas
            </p>

            <div className="mt-5 space-y-4">
              <input
                placeholder="Nome do cartão"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="app-input"
              />
              <input
                placeholder="Limite total do banco"
                value={cardLimit}
                onChange={(e) => setCardLimit(e.target.value)}
                className="app-input"
              />
              <input
                placeholder="Limite mensal que eu quero usar (opcional)"
                value={cardMonthlyLimit}
                onChange={(e) => setCardMonthlyLimit(e.target.value)}
                className="app-input"
              />
              <p className="text-xs text-slate-500">
                Esse é seu limite consciente, não o limite do banco. Use para reduzir o uso do crédito.
              </p>
              <input
                placeholder="Dia fechamento (ex: 10)"
                value={closingDay}
                onChange={(e) => setClosingDay(e.target.value)}
                className="app-input"
              />
              <input
                placeholder="Dia vencimento (ex: 15)"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="app-input"
              />

              <button
                onClick={createCard}
                disabled={savingCard}
                className="app-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingCard ? "Salvando..." : "Salvar cartão"}
              </button>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-slate-900">Cartões</h3>

              {loading ? (
                <p className="mt-3 text-sm text-slate-500">Carregando...</p>
              ) : cardSummaries.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  Nenhum cartão cadastrado.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {cardSummaries.map((card) => {
                    const isDanger = card.usagePercent >= 90;
                    const isWarning =
                      card.usagePercent >= 70 && card.usagePercent < 90;
                    const monthlyStatus = getCardMonthlyLimitStatus(card.monthlyUsagePercent);
                    const monthlyProgressWidth =
                      card.monthlyUsagePercent === null
                        ? "0%"
                        : `${Math.min(card.monthlyUsagePercent, 100)}%`;

                    return (
                      <div
                        key={card.id}
                        className="app-card-soft border border-slate-100 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {card.name}
                            </p>
                            <p className="text-sm text-slate-500">
                              Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                            </p>
                          </div>

                          <span
                            className={
                              isDanger
                                ? "app-badge-danger"
                                : isWarning
                                ? "app-badge-warning"
                                : "app-badge-success"
                            }
                          >
                            {card.usagePercent.toFixed(0)}% usado
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div className="rounded-xl bg-white p-3 border border-slate-100">
                            <p className="text-xs text-slate-500">Limite total</p>
                            <p className="mt-1 font-bold text-slate-900">
                              {formatCurrency(card.limit)}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white p-3 border border-slate-100">
                            <p className="text-xs text-slate-500">Usado</p>
                            <p className="mt-1 app-value-negative">
                              {formatCurrency(card.used)}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white p-3 border border-slate-100">
                            <p className="text-xs text-slate-500">Disponível</p>
                            <p
                              className={
                                card.available >= 0
                                  ? "mt-1 app-value-positive"
                                  : "mt-1 app-value-negative"
                              }
                            >
                              {formatCurrency(card.available)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="app-progress-bg">
                            <div
                              className={
                                isDanger
                                  ? "app-progress-danger"
                                  : isWarning
                                  ? "app-progress-warning"
                                  : "app-progress-success"
                              }
                              style={{
                                width: `${Math.min(card.usagePercent, 100)}%`,
                              }}
                            />
                          </div>

                          <p className="mt-2 text-xs text-slate-500">
                            {card.openInvoicesCount} fatura(s) aberta(s) neste cartão
                          </p>
                        </div>

                        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                Limite mensal consciente
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Controle quanto você decidiu usar neste mês, independente do limite do banco.
                              </p>
                            </div>

                            <span className={monthlyStatus.badge}>
                              {monthlyStatus.label}
                            </span>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                              <p className="text-xs text-slate-500">Limite mensal</p>
                              <p className="mt-1 font-bold text-slate-900">
                                {card.monthlyLimit > 0
                                  ? formatCurrency(card.monthlyLimit)
                                  : "Não definido"}
                              </p>
                            </div>

                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                              <p className="text-xs text-slate-500">Usado no mês</p>
                              <p className="mt-1 app-value-negative">
                                {formatCurrency(card.monthlyUsed)}
                              </p>
                            </div>

                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                              <p className="text-xs text-slate-500">Sobra planejada</p>
                              <p
                                className={
                                  card.monthlyLimit <= 0
                                    ? "mt-1 app-value-neutral"
                                    : card.monthlyAvailable >= 0
                                    ? "mt-1 app-value-positive"
                                    : "mt-1 app-value-negative"
                                }
                              >
                                {card.monthlyLimit > 0
                                  ? formatCurrency(card.monthlyAvailable)
                                  : "-"}
                              </p>
                            </div>
                          </div>

                          {card.monthlyLimit > 0 && (
                            <div className="mt-4">
                              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                                <span>Uso do limite mensal</span>
                                <span>{card.monthlyUsagePercent?.toFixed(0)}%</span>
                              </div>
                              <div className="app-progress-bg">
                                <div
                                  className={monthlyStatus.progress}
                                  style={{ width: monthlyProgressWidth }}
                                />
                              </div>
                            </div>
                          )}

                          <p
                            className={`mt-3 text-sm ${
                              card.monthlyUsagePercent !== null && card.monthlyUsagePercent >= 90
                                ? "text-rose-700"
                                : card.monthlyUsagePercent !== null && card.monthlyUsagePercent >= 70
                                ? "text-amber-700"
                                : "text-slate-500"
                            }`}
                          >
                            {monthlyStatus.message}
                          </p>

                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Ajustar limite mensal
                              </label>
                              <input
                                placeholder="Ex: 800"
                                value={monthlyLimitInputs[card.id] || ""}
                                onChange={(e) =>
                                  setMonthlyLimitInputs((current) => ({
                                    ...current,
                                    [card.id]: e.target.value,
                                  }))
                                }
                                className="app-input"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => saveMonthlyLimit(card.id)}
                              disabled={savingMonthlyLimitCardId === card.id}
                              className="app-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingMonthlyLimitCardId === card.id
                                ? "Salvando..."
                                : "Salvar limite"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}