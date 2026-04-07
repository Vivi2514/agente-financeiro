"use client";

import { useEffect, useState } from "react";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);

  const [accountName, setAccountName] = useState("");
  const [accountBank, setAccountBank] = useState("");
  const [accountBalance, setAccountBalance] = useState("");

  const [cardName, setCardName] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");

  async function loadData() {
    const accRes = await fetch("/api/accounts", { cache: "no-store" });
    const accData = await accRes.json();
    setAccounts(Array.isArray(accData) ? accData : []);

    const cardRes = await fetch("/api/cards", { cache: "no-store" });
    const cardData = await cardRes.json();
    setCards(Array.isArray(cardData) ? cardData : []);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createAccount() {
    if (!accountName || !accountBank || !accountBalance) {
      alert("Preencha nome, banco e saldo.");
      return;
    }

    await fetch("/api/accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: accountName,
        bank: accountBank,
        balance: parseFloat(accountBalance.replace(",", ".")),
      }),
    });

    setAccountName("");
    setAccountBank("");
    setAccountBalance("");

    loadData();
  }

  async function createCard() {
    if (!cardName || !cardLimit || !closingDay || !dueDay) {
      alert("Preencha todos os campos do cartão.");
      return;
    }

    await fetch("/api/cards", {
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

    setCardName("");
    setCardLimit("");
    setClosingDay("");
    setDueDay("");

    loadData();
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Contas e Cartões</h1>

      <h2>Criar Conta</h2>
      <input
        placeholder="Nome"
        value={accountName}
        onChange={(e) => setAccountName(e.target.value)}
      />
      <input
        placeholder="Banco"
        value={accountBank}
        onChange={(e) => setAccountBank(e.target.value)}
      />
      <input
        placeholder="Saldo"
        value={accountBalance}
        onChange={(e) => setAccountBalance(e.target.value)}
      />
      <button onClick={createAccount}>Salvar conta</button>

      <h3>Contas</h3>
      {accounts.map((acc) => (
        <div key={acc.id}>
          {acc.name} - {formatCurrency(Number(acc.balance))}
        </div>
      ))}

      <hr />

      <h2>Criar Cartão</h2>
      <input
        placeholder="Nome do cartão"
        value={cardName}
        onChange={(e) => setCardName(e.target.value)}
      />
      <input
        placeholder="Limite"
        value={cardLimit}
        onChange={(e) => setCardLimit(e.target.value)}
      />
      <input
        placeholder="Dia fechamento (ex: 10)"
        value={closingDay}
        onChange={(e) => setClosingDay(e.target.value)}
      />
      <input
        placeholder="Dia vencimento (ex: 15)"
        value={dueDay}
        onChange={(e) => setDueDay(e.target.value)}
      />

      <button onClick={createCard}>Salvar cartão</button>

      <h3>Cartões</h3>
      {cards.map((card) => (
        <div key={card.id}>
          {card.name} - Limite: {formatCurrency(Number(card.limit))} | Fecha dia{" "}
          {card.closingDay} | Vence dia {card.dueDay}
        </div>
      ))}
    </div>
  );
}