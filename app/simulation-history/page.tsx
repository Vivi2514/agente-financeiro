"use client";

import { useEffect, useState } from "react";

type Simulation = {
  id: string;
  title: string;
  totalAmount: number;
  createdAt: string;
  recommendationTitle: string;
};

export default function SimulationHistoryPage() {
  const [data, setData] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const res = await fetch("/api/simulation-history");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmDelete = confirm("Deseja excluir esta simulação?");
    if (!confirmDelete) return;

    try {
      await fetch(`/api/simulation-history/${id}`, {
        method: "DELETE",
      });

      setData((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <div className="p-4">Carregando...</div>;
  }

  if (data.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-lg font-bold">Histórico de simulações</h1>
        <p className="mt-2 text-sm text-gray-500">
          Nenhuma simulação salva ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-lg font-bold mb-4">
        Histórico de simulações
      </h1>

      <div className="space-y-3">
        {data.map((item) => (
          <div
            key={item.id}
            className="border rounded-lg p-3 flex justify-between items-center"
          >
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-gray-500">
                R$ {item.totalAmount.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">
                {item.recommendationTitle}
              </p>
            </div>

            <button
              onClick={() => handleDelete(item.id)}
              className="text-red-500 hover:text-red-700"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}