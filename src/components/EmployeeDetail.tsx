"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatINR, toNumber } from "@/lib/format";
import { formatDateDMY } from "@/lib/fy";

export interface EmployeeDetailData {
  id: string;
  name: string;
  monthlySalary: number;
  email: string | null;
  phone: string | null;
  active: boolean;
  payments: { id: string; date: string; amount: number; method: string | null; reference: string | null }[];
}

export default function EmployeeDetail({ data }: { data: EmployeeDetailData }) {
  const router = useRouter();
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState<number | "">(data.monthlySalary);
  const [payMethod, setPayMethod] = useState("");
  const [payReference, setPayReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPaid = data.payments.reduce((s, p) => s + toNumber(p.amount), 0);

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payAmount || payAmount <= 0) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/employees/${data.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: payDate, amount: payAmount, method: payMethod, reference: payReference }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not record payment.");
      return;
    }
    setPayMethod("");
    setPayReference("");
    router.refresh();
  }

  async function deletePayment(id: string) {
    if (!confirm("Remove this payment?")) return;
    await fetch(`/api/salary-payments/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center gap-3">
        {data.active ? (
          <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">
            Active
          </span>
        ) : (
          <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-200 text-slate-700">
            Inactive
          </span>
        )}
        <span className="text-sm text-slate-500">
          {formatINR(data.monthlySalary)}/month{data.email ? ` · ${data.email}` : ""}
          {data.phone ? ` · ${data.phone}` : ""}
        </span>
        <Link
          href={`/payroll/${data.id}/edit`}
          className="ml-auto rounded-md border border-slate-300 text-sm px-3 py-1.5 hover:bg-slate-50"
        >
          Edit
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-4">
          <div className="text-xs text-slate-500">Total paid (lifetime)</div>
          <div className="text-xl font-semibold mt-1 text-slate-800">{formatINR(totalPaid)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-4">
          <div className="text-xs text-slate-500">Last paid</div>
          <div className="text-xl font-semibold mt-1 text-slate-800">
            {data.payments[0] ? formatDateDMY(new Date(data.payments[0].date)) : "—"}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-right px-3 py-2">Amount</th>
              <th className="text-left px-3 py-2">Method</th>
              <th className="text-left px-3 py-2">Reference</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.payments.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2">{formatDateDMY(new Date(p.date))}</td>
                <td className="px-3 py-2 text-right font-medium">{formatINR(toNumber(p.amount))}</td>
                <td className="px-3 py-2 text-slate-500">{p.method || "—"}</td>
                <td className="px-3 py-2 text-slate-500">{p.reference || "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => deletePayment(p.id)} className="text-xs text-red-500 hover:underline">
                    remove
                  </button>
                </td>
              </tr>
            ))}
            {data.payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No salary payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={recordPayment} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="text-xs font-semibold text-slate-500 uppercase">Record a payment</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">Date</span>
            <input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">Amount</span>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value ? parseFloat(e.target.value) : "")}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">Method</span>
            <input
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              placeholder="UPI / Bank transfer…"
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">Reference</span>
            <input
              value={payReference}
              onChange={(e) => setPayReference(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : "Record payment"}
        </button>
      </form>
    </div>
  );
}
