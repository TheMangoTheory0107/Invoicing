"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Employee } from "@prisma/client";
import { toNumber } from "@/lib/format";

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      <input
        {...props}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
    </label>
  );
}

export default function EmployeeForm({ employee }: { employee?: Employee }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: employee?.name || "",
    monthlySalary: employee ? toNumber(employee.monthlySalary) : 75000,
    email: employee?.email || "",
    phone: employee?.phone || "",
    notes: employee?.notes || "",
    active: employee?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const url = employee ? `/api/employees/${employee.id}` : "/api/employees";
    const res = await fetch(url, {
      method: employee ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save. Check the fields and try again.");
      return;
    }
    const saved = await res.json();
    router.push(employee ? `/payroll/${employee.id}` : `/payroll/${saved.id}`);
    router.refresh();
  }

  async function onDelete() {
    if (!employee) return;
    if (!confirm(`Delete ${employee.name}? This also deletes their salary payment history. This cannot be undone.`)) return;
    const res = await fetch(`/api/employees/${employee.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not delete.");
      return;
    }
    router.push("/payroll");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 max-w-xl">
      <Field label="Name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
      <Field
        label="Monthly salary"
        type="number"
        min={0}
        required
        value={form.monthlySalary}
        onChange={(e) => set("monthlySalary", parseFloat(e.target.value) || 0)}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        <Field label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <label className="block">
        <span className="block text-xs font-medium text-slate-600 mb-1">Notes</span>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </label>
      {employee && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
          Active (still on payroll)
        </label>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {employee && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-red-200 text-red-600 text-sm px-4 py-2 hover:bg-red-50"
          >
            Delete employee
          </button>
        )}
      </div>
    </form>
  );
}
