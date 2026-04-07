"use client";

import { useRef, useState, useTransition } from "react";

type Account = {
  id: string;
  name: string;
  bank: string;
};

type Card = {
  id: string;
  name: string;
  brand: string;
};

type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  date: string;
  accountId: string | null;
  cardId: string | null;
};

type Props = {
  transaction: Transaction;
  accounts: Account[];
  cards: Card[];
  action: (formData: FormData) => Promise<void>;
};

export function EditTransactionForm({
  transaction,
  accounts,
  cards,
  action,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function openModal() {
    setMessage(null);
    dialogRef.current?.showModal();
  }

  function closeModal() {
    dialogRef.current?.close();
  }

  function handleSubmit(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      try {
        await action(formData);
        setMessage("Transação atualizada com sucesso ✅");

        setTimeout(() => {
          formRef.current?.reset();
          closeModal();
        }, 700);
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Erro ao atualizar transação ❌";
        setMessage(msg);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded bg-amber-500 px-2 py-1 text-xs text-white"
      >
        Editar
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-xl rounded-2xl p-0 backdrop:bg-black/40"
      >
        <div className="rounded-2xl bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Editar transação
            </h3>
            <button
              type="button"
              onClick={closeModal}
              className="rounded bg-slate-200 px-2 py-1 text-sm text-slate-700"
            >
              Fechar
            </button>
          </div>

          <form ref={formRef} action={handleSubmit} className="space-y-3">
            <input type="hidden" name="id" value={transaction.id} />

            <input
              name="title"
              defaultValue={transaction.title}
              placeholder="Descrição"
              required
              className="w-full rounded border p-2"
            />

            <input
              name="amount"
              type="number"
              step="0.01"
              defaultValue={transaction.amount}
              placeholder="Valor"
              required
              className="w-full rounded border p-2"
            />

            <select
              name="type"
              defaultValue={transaction.type}
              className="w-full rounded border p-2"
            >
              <option value="EXPENSE">Despesa</option>
              <option value="INCOME">Receita</option>
            </select>

            <input
              name="date"
              type="date"
              defaultValue={transaction.date}
              required
              className="w-full rounded border p-2"
            />

            <select
              name="accountId"
              defaultValue={transaction.accountId ?? ""}
              className="w-full rounded border p-2"
            >
              <option value="">Selecionar conta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {account.bank}
                </option>
              ))}
            </select>

            <select
              name="cardId"
              defaultValue={transaction.cardId ?? ""}
              className="w-full rounded border p-2"
            >
              <option value="">Selecionar cartão</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name} - {card.brand}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? "Salvando..." : "Salvar alterações"}
            </button>

            {message && (
              <p className="text-center text-sm text-slate-600">{message}</p>
            )}
          </form>
        </div>
      </dialog>
    </>
  );
}