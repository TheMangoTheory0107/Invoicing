"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SERIES } from "@/components/personal/types";

interface Plan {
  monthlySalary: number;
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
}
interface Cat {
  id: string;
  name: string;
  kind: string;
  bucket: string;
  monthlyBudget: number;
  archived: boolean;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const input = "rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

const PRESETS: { label: string; needs: number; wants: number; savings: number }[] = [
  { label: "Balanced 50/30/20", needs: 50, wants: 30, savings: 20 },
  { label: "Saver 50/20/30", needs: 50, wants: 20, savings: 30 },
  { label: "Aggressive 40/20/40", needs: 40, wants: 20, savings: 40 },
];

export default function PlanClient({
  plan,
  overrides,
  currentMonth,
  categories,
}: {
  plan: Plan;
  overrides: { month: string; salary: number }[];
  currentMonth: string;
  categories: Cat[];
}) {
  const router = useRouter();
  const [p, setP] = useState(plan);
  const [salaryText, setSalaryText] = useState(plan.monthlySalary ? String(plan.monthlySalary) : "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [ovMonth, setOvMonth] = useState(currentMonth);
  const [ovSalary, setOvSalary] = useState("");

  const salary = parseFloat(salaryText) || 0;
  const sum = p.needsPct + p.wantsPct + p.savingsPct;

  async function savePlan() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/personal/plan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, monthlySalary: salary }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: "Plan saved." } : { ok: false, text: data.error || "Couldn't save." });
    router.refresh();
  }

  async function saveOverride(month: string, value: number | null) {
    await fetch("/api/personal/month-income", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, salary: value }),
    });
    setOvSalary("");
    router.refresh();
  }

  const split = [
    { key: "needsPct" as const, label: "Needs", hint: "rent, groceries, bills, transport, health, EMIs", color: SERIES.needs },
    { key: "wantsPct" as const, label: "Wants", hint: "eating out, shopping, subscriptions, trips — your fun money", color: SERIES.wants },
    { key: "savingsPct" as const, label: "Savings & investing", hint: "SIPs, stocks, FD, PPF, emergency fund", color: SERIES.invested },
  ];

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Salary &amp; targets</h2>
          <p className="text-xs text-slate-500">Your monthly take-home (in-hand) salary. Every month uses this unless you set a different amount for it below.</p>
        </div>
        <label className="block max-w-xs">
          <span className="block text-xs font-medium text-slate-600 mb-1">Monthly take-home salary (₹)</span>
          <input type="number" min="0" value={salaryText} onChange={(e) => setSalaryText(e.target.value)} className={`${input} w-full`} placeholder="e.g. 120000" />
        </label>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((pr) => (
            <button
              key={pr.label}
              onClick={() => setP({ ...p, needsPct: pr.needs, wantsPct: pr.wants, savingsPct: pr.savings })}
              className={`rounded-full border px-3 py-1 text-xs ${
                p.needsPct === pr.needs && p.wantsPct === pr.wants ? "border-brand bg-brand-light text-brand" : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              {pr.label}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {split.map((s) => (
            <div key={s.key} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 h-8">{s.hint}</div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={p[s.key]}
                  onChange={(e) => setP({ ...p, [s.key]: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                  className={`${input} w-20`}
                />
                <span className="text-sm text-slate-500">%</span>
              </div>
              <div className="text-xl font-semibold text-slate-900 mt-2 tabular-nums">{salary ? inr((salary * p[s.key]) / 100) : "—"}</div>
              <div className="text-xs text-slate-500">per month</div>
            </div>
          ))}
        </div>
        {sum !== 100 && <p className="text-sm text-red-600">These add up to {sum}% — they need to total 100%.</p>}

        {salary > 0 && sum === 100 && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 space-y-1">
            <div>
              <b>Your monthly targets:</b> spend at most {inr((salary * p.needsPct) / 100)} on needs, enjoy up to{" "}
              {inr((salary * p.wantsPct) / 100)} on wants (≈ {inr((salary * p.wantsPct) / 100 / 30)}/day), and put away{" "}
              {inr((salary * p.savingsPct) / 100)}.
            </div>
            <div>
              Stick to it and you&apos;ll set aside <b>{inr((salary * p.savingsPct * 12) / 100)}</b> a year. Invested at ~12%/yr via SIP, that grows to
              about <b>{inr(sipFutureValue((salary * p.savingsPct) / 100, 0.12, 5))}</b> in 5 years and{" "}
              <b>{inr(sipFutureValue((salary * p.savingsPct) / 100, 0.12, 10))}</b> in 10 (illustrative, not guaranteed).
            </div>
            <div>Keep an emergency fund of ~{inr(((salary * p.needsPct) / 100) * 6)} (6 months of needs) before taking investment risk.</div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={savePlan}
            disabled={saving || sum !== 100}
            className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save plan"}
          </button>
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">A different salary for one month</h2>
          <p className="text-xs text-slate-500">Bonus, increment, or unpaid leave. Only changes that month.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input type="month" value={ovMonth} onChange={(e) => setOvMonth(e.target.value)} className={input} />
          <input type="number" min="0" placeholder="₹ Salary that month" value={ovSalary} onChange={(e) => setOvSalary(e.target.value)} className={`${input} w-48`} />
          <button
            disabled={!ovMonth || !ovSalary}
            onClick={() => saveOverride(ovMonth, parseFloat(ovSalary))}
            className="rounded-md border border-slate-300 text-sm px-4 py-2 hover:bg-slate-50 disabled:opacity-50"
          >
            Set
          </button>
        </div>
        {overrides.length > 0 && (
          <table className="text-sm">
            <tbody>
              {overrides.map((o) => (
                <tr key={o.month}>
                  <td className="pr-6 py-1">{o.month}</td>
                  <td className="pr-6 py-1 tabular-nums">{inr(o.salary)}</td>
                  <td>
                    <button onClick={() => saveOverride(o.month, null)} className="text-xs text-slate-400 hover:text-red-600">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <CategoriesEditor categories={categories} />
    </div>
  );
}

function sipFutureValue(monthly: number, annualRate: number, years: number) {
  const r = annualRate / 12;
  const n = years * 12;
  return monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
}

function CategoriesEditor({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", kind: "EXPENSE", bucket: "WANTS", monthlyBudget: "" });

  async function patch(id: string, data: Partial<Cat>) {
    setError(null);
    const res = await fetch(`/api/personal/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || "Couldn't save.");
    router.refresh();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/personal/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newCat, monthlyBudget: parseFloat(newCat.monthlyBudget) || 0 }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || "Couldn't add.");
      return;
    }
    setNewCat({ name: "", kind: "EXPENSE", bucket: "WANTS", monthlyBudget: "" });
    router.refresh();
  }

  const visible = categories.filter((c) => showArchived || !c.archived);
  const sel = "rounded border border-slate-300 px-2 py-1 text-sm";

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Labels</h2>
          <p className="text-xs text-slate-500">
            Expenses are split into Needs or Wants. Investments count as savings. Transfers (credit-card bill, self transfer) are left out of every total
            so nothing is counted twice. An optional monthly cap flags a category on the dashboard when you go over it.
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show hidden
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b">
            <th className="py-2">Name</th>
            <th>Type</th>
            <th>Need / Want</th>
            <th>Monthly cap (₹)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {visible.map((c) => (
            <tr key={c.id} className={`border-b border-slate-100 ${c.archived ? "opacity-50" : ""}`}>
              <td className="py-1.5 pr-2">
                <input defaultValue={c.name} onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && patch(c.id, { name: e.target.value.trim() })} className={`${sel} w-full`} />
              </td>
              <td className="pr-2">
                <select value={c.kind} onChange={(e) => patch(c.id, { kind: e.target.value })} className={sel}>
                  <option value="EXPENSE">Expense</option>
                  <option value="INVESTMENT">Investment</option>
                  <option value="INCOME">Income</option>
                  <option value="TRANSFER">Transfer</option>
                </select>
              </td>
              <td className="pr-2">
                {c.kind === "EXPENSE" ? (
                  <select value={c.bucket} onChange={(e) => patch(c.id, { bucket: e.target.value })} className={sel}>
                    <option value="NEEDS">Need</option>
                    <option value="WANTS">Want</option>
                  </select>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </td>
              <td className="pr-2">
                {c.kind === "EXPENSE" ? (
                  <input
                    type="number"
                    min="0"
                    defaultValue={c.monthlyBudget || ""}
                    placeholder="no cap"
                    onBlur={(e) => (parseFloat(e.target.value) || 0) !== c.monthlyBudget && patch(c.id, { monthlyBudget: parseFloat(e.target.value) || 0 })}
                    className={`${sel} w-28`}
                  />
                ) : null}
              </td>
              <td className="text-right">
                <button onClick={() => patch(c.id, { archived: !c.archived })} className="text-xs text-slate-400 hover:text-slate-700">
                  {c.archived ? "Unhide" : "Hide"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={add} className="flex flex-wrap gap-2 items-center pt-2">
        <input placeholder="New label name" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} className={`${input} w-56`} required />
        <select value={newCat.kind} onChange={(e) => setNewCat({ ...newCat, kind: e.target.value })} className={input}>
          <option value="EXPENSE">Expense</option>
          <option value="INVESTMENT">Investment</option>
          <option value="INCOME">Income</option>
          <option value="TRANSFER">Transfer</option>
        </select>
        {newCat.kind === "EXPENSE" && (
          <select value={newCat.bucket} onChange={(e) => setNewCat({ ...newCat, bucket: e.target.value })} className={input}>
            <option value="NEEDS">Need</option>
            <option value="WANTS">Want</option>
          </select>
        )}
        <button className="rounded-md border border-slate-300 text-sm px-4 py-2 hover:bg-slate-50">Add label</button>
      </form>
    </section>
  );
}
