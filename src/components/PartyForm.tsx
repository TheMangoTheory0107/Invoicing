"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Party } from "@prisma/client";

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

export default function PartyForm({
  type,
  party,
  listHref,
}: {
  type: "CLIENT" | "CREATOR";
  party?: Party;
  listHref: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: party?.name || "",
    gstin: party?.gstin || "",
    panNo: party?.panNo || "",
    address: party?.address || "",
    email: party?.email || "",
    phone: party?.phone || "",
    pageHandle: party?.pageHandle || "",
    bankAccName: party?.bankAccName || "",
    bankName: party?.bankName || "",
    bankAccNo: party?.bankAccNo || "",
    ifsc: party?.ifsc || "",
    upiId: party?.upiId || "",
    notes: party?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const url = party ? `/api/parties/${party.id}` : "/api/parties";
    const res = await fetch(url, {
      method: party ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, type }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save. Check the fields and try again.");
      return;
    }
    router.push(listHref);
    router.refresh();
  }

  async function onDelete() {
    if (!party) return;
    if (!confirm(`Delete ${party.name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/parties/${party.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not delete.");
      return;
    }
    router.push(listHref);
    router.refresh();
  }

  const isCreator = type === "CREATOR";

  return (
    <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        <Field label="GSTIN" value={form.gstin} onChange={(e) => set("gstin", e.target.value)} />
        <Field label="PAN" value={form.panNo} onChange={(e) => set("panNo", e.target.value)} />
        <Field label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        <Field label="Email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        {isCreator && (
          <Field
            label="Page handle"
            value={form.pageHandle}
            onChange={(e) => set("pageHandle", e.target.value)}
          />
        )}
      </div>
      <label className="block">
        <span className="block text-xs font-medium text-slate-600 mb-1">Address</span>
        <textarea
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          rows={2}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </label>

      {isCreator && (
        <div>
          <h3 className="text-xs font-semibold text-slate-700 uppercase mb-2">
            Bank details (for paying this creator)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Account name"
              value={form.bankAccName}
              onChange={(e) => set("bankAccName", e.target.value)}
            />
            <Field label="Bank name" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
            <Field
              label="Account number"
              value={form.bankAccNo}
              onChange={(e) => set("bankAccNo", e.target.value)}
            />
            <Field label="IFSC" value={form.ifsc} onChange={(e) => set("ifsc", e.target.value)} />
            <Field label="UPI ID" value={form.upiId} onChange={(e) => set("upiId", e.target.value)} />
          </div>
        </div>
      )}

      <label className="block">
        <span className="block text-xs font-medium text-slate-600 mb-1">Notes</span>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : party ? "Save changes" : "Create"}
        </button>
        {party && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-red-200 text-red-600 text-sm font-medium px-4 py-2 hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
