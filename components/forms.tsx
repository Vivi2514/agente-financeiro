"use client";

import { useRef, useState, useTransition } from "react";

type Props = {
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
  buttonLabel: string;
};

export function FormWrapper({ action, children, buttonLabel }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleAction(formData: FormData) {
    setMessage(null);

    startTransition(async () => {
      try {
        await action(formData);
        formRef.current?.reset();
        setMessage("Salvo com sucesso ✅");
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Erro ao salvar ❌";
        setMessage(msg);
      }
    });
  }

  return (
    <form ref={formRef} action={handleAction} className="space-y-4">
      {children}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition disabled:opacity-50"
      >
        {isPending ? "Salvando..." : buttonLabel}
      </button>

      {message && (
        <p className="text-center text-sm text-slate-600">{message}</p>
      )}
    </form>
  );
}