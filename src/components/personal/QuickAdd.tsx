"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CategorySelect from "./CategorySelect";
import type { CategoryOption } from "./types";

function todayIST() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

// One-line "I just spent ₹X on Y" form for day-to-day entries.
export default function QuickAdd({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [date, setDate] = useState(todayIST());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (!categoryId) {
      setError("Pick a label so it lands in the right bucket.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/personal/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, description, amount: parseFloat(amount), direction, categoryId, notes: "" }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't save that.");
      return;
    }
    setDone(`Added ₹${parseFloat(amount).toLocaleString("en-IN")} — ${description}`);
    setDescription("");
    setAmount("");
    setCategoryId(null);
    router.refresh();
  }

  const input = "rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";
  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-sm font-semibold text-slate-800 mb-3">Add an expense</div>
      <div className="flex flex-wrap gap-2 items-start">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} w-40`} required />
        <input
          placeholder="What was it? e.g. Chai with team"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${input} flex-1 min-w-[200px]`}
          required
        />
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          placeholder="₹ Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${input} w-32`}
          required
        />
        <select value={direction} onChange={(e) => setDirection(e.target.value as "DEBIT" | "CREDIT")} className={`${input} w-32`}>
          <option value="DEBIT">Money out</option>
          <option value="CREDIT">Money in</option>
        </select>
        <div className="w-56">
          <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      {done && <p className="text-sm text-emerald-700 mt-2">{done}</p>}
    </form>
  );
}
