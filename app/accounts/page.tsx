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

  const [accountName, setAccountName] = useState("");
  const [accountBank, setAccountBank] = useState("");
  const [accountBalance, setAccountBalance] = useState("");

  const [cardName, setCardName] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingCard, setSavingCard] = useState(false);

  async function loadData() {
    try {
      setLoading(true);

      const [accRes, cardRes, invoiceRes] = await Promise.all([
        fetch("/api/accounts", { cache: "no-store" }),
        fetch("/api/cards", { cache: "no-store" }),
        fetch("/api/invoices", { cache: "no-store" }),
      ]);

      const accData = accRes.ok ? await accRes.json() : [];
      const cardData = cardRes.ok ? await cardRes.json() : [];
      const invoiceData = invoiceRes.ok ? await invoiceRes.json() : [];

      setAccounts(Array.isArray(accData) ? accData : []);
      setCards(Array.isArray(cardData) ? cardData : []);
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
    } catch (error) {
      console.error("Erro ao carregar contas/cartões:", error);
      setAccounts([]);
      setCards([]);
      setInvoices([]);
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

  const cardSummaries = useMemo(() => {
    return cards.map((card) => {
      const openInvoices = invoices.filter(
        (invoice) => invoice.cardId === card.id && invoice.status === "OPEN"
      );

      const used = openInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.total || 0),
        0
      );

      const limit = Number(card.limit || 0);
      const available = limit - used;
      const usagePercent = limit > 0 ? (used / limit) * 100 : 0;

      return {
        ...card,
        used,
        available,
        usagePercent,
        openInvoicesCount: openInvoices.length,
      };
    });
  }, [cards, invoices]);

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
                placeholder="Limite"
                value={cardLimit}
                onChange={(e) => setCardLimit(e.target.value)}
                className="app-input"
              />
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