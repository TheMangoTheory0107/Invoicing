"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CategorySelect from "@/components/personal/CategorySelect";
import type { CategoryOption } from "@/components/personal/types";

interface Tx {
  id: string;
  date: string;
  description: string;
  merchant: string;
  amount: number;
  direction: "DEBIT" | "CREDIT";
  categoryId: string | null;
  notes: string;
  source: string;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dmy = (d: string) => d.split("-").reverse().join("/");

export default function TransactionsClient({ transactions, categories }: { transactions: Tx[]; categories: CategoryOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);

  async function patch(tx: Tx, data: Record<string, unknown>) {
    setBusy(tx.id);
    const res = await fetch(`/api/personal/transactions/${tx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(null);
    const body = await res.json().catch(() => ({}));
    if (body.alsoUpdated) setFlash(`Also labelled ${body.alsoUpdated} other unlabelled payment(s) to ${tx.merchant}, and remembered it for next time.`);
    router.refresh();
  }

  async function remove(tx: Tx) {
    if (!confirm(`Delete ${inr(tx.amount)} — ${tx.merchant || tx.description}?`)) return;
    setBusy(tx.id);
    await fetch(`/api/personal/transactions/${tx.id}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  }

  const out = transactions.filter((t) => t.direction === "DEBIT").reduce((s, t) => s + t.amount, 0);
  const inn = transactions.filter((t) => t.direction === "CREDIT").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-b border-slate-100 text-sm">
        <span>
          <b>{transactions.length}</b> transactions
        </span>
        <span>Out {inr(Math.round(out))}</span>
        {inn > 0 && <span className="text-emerald-700">In {inr(Math.round(inn))}</span>}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          When I change a label, remember it for that merchant
        </label>
      </div>
      {flash && <div className="px-5 py-2 text-sm bg-emerald-50 text-emerald-800 border-b border-emerald-100">{flash}</div>}
      {transactions.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500 text-center">No transactions here.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
              <th className="px-5 py-2">Date</th>
              <th>Paid to / from</th>
              <th className="text-right pr-4">Amount</th>
              <th className="w-60">Label</th>
              <th className="px-3">Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className={`border-b border-slate-100 ${busy === t.id ? "opacity-50" : ""}`}>
                <td className="px-5 py-1.5 whitespace-nowrap text-slate-600">{dmy(t.date)}</td>
                <td className="py-1.5 max-w-[260px]">
                  <div className="truncate" title={t.description}>
                    {t.merchant || t.description}
                  </div>
                  {t.source === "MANUAL" && <div className="text-[11px] text-slate-400">added manually</div>}
                </td>
                <td className={`py-1.5 text-right pr-4 tabular-nums ${t.direction === "CREDIT" ? "text-emerald-700" : ""}`}>
                  {t.direction === "CREDIT" ? "+" : ""}
                  {inr(t.amount)}
                </td>
                <td className="py-1.5">
                  <CategorySelect
                    categories={categories}
                    value={t.categoryId}
                    onChange={(id) => patch(t, { categoryId: id, applyToMerchant: remember && !!id })}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    defaultValue={t.notes}
                    onBlur={(e) => e.target.value !== t.notes && patch(t, { notes: e.target.value })}
                    placeholder="—"
                    className="w-full rounded border border-transparent hover:border-slate-200 focus:border-slate-300 px-1.5 py-1 text-sm"
                  />
                </td>
                <td className="pr-4 text-right">
                  <button onClick={() => remove(t)} className="text-xs text-slate-400 hover:text-red-600" title="Delete">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
