"use client"

import { useMemo, useState } from "react"

type CurrencyInputProps = {
  name: string
  required?: boolean
  defaultValue?: string
}

export default function CurrencyInput({
  name,
  required = false,
  defaultValue = "",
}: CurrencyInputProps) {
  const initialCents = useMemo(() => {
    return decimalStringToCents(defaultValue)
  }, [defaultValue])

  const [cents, setCents] = useState<number>(initialCents)

  const displayValue = formatCentsToBRL(cents)
  const submitValue = (cents / 100).toFixed(2)

  return (
    <div>
      <input
        type="hidden"
        name={name}
        value={submitValue}
      />

      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "")
          setCents(digits ? Number(digits) : 0)
        }}
        placeholder="R$ 0,00"
        className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none"
        required={required}
      />
    </div>
  )
}

function formatCentsToBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100)
}

function decimalStringToCents(value: string) {
  const trimmed = value.trim()

  if (!trimmed) return 0

  const normalized = trimmed
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")

  const number = Number(normalized)

  if (Number.isNaN(number)) return 0

  return Math.round(number * 100)
}