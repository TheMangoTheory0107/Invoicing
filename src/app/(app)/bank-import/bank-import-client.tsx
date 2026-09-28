"use client";

import { useMemo, useState } from "react";
import { formatINR } from "@/lib/format";

interface Candidate {
  invoiceId: string;
  number: string;
  partyName: string;
  type: string;
  remainingBalance: number;
  tdsAmount: number;
  label: string;
  diff: number;
}

interface TxRow {
  date: string;
  description: string;
  amount: number;
  direction: "CREDIT" | "DEBIT";
  candidates: Candidate[];
}

interface OpenInvoice {
  id: string;
  number: string;
  type: string;
  partyName: string;
  remainingBalance: number;
}

type Selection = { invoiceId: string; tdsAmount: number } | null;

export default function BankImportClient() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TxRow[] | null>(null);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [selections, setSelections] = useState<Record<number, Selection>>({});
  const [confirmed, setConfirmed] = useState<Record<number, boolean>>({});
  const [confirming, setConfirming] = useState<number | null>(null);
  const [manualSearch, setManualSearch] = useState<Record<number, string>>({});

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setRows(null);
    setSelections({});
    setConfirmed({});

    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/bank-import/parse", { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not read that file.");
      return;
    }
    const data = await res.json();
    setRows(data.rows);
    setOpenInvoices(data.openInvoices);
    const initial: Record<number, Selection> = {};
    data.rows.forEach((r: TxRow, i: number) => {
      initial[i] = r.candidates[0] ? { invoiceId: r.candidates[0].invoiceId, tdsAmount: r.candidates[0].tdsAmount } : null;
    });
    setSelections(initial);
  }

  async function confirmRow(i: number) {
    const row = rows?.[i];
    const selection = selections[i];
    if (!row || !selection) return;
    setConfirming(i);
    const res = await fetch(`/api/invoices/${selection.invoiceId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: row.date,
        amount: row.amount,
        tdsAmount: selection.tdsAmount,
        method: "Bank import",
        reference: row.description.slice(0, 120),
      }),
    });
    setConfirming(null);
    if (res.ok) setConfirmed((c) => ({ ...c, [i]: true }));
  }

  const relevantInvoices = useMemo(
    () => (direction: "CREDIT" | "DEBIT") =>
      openInvoices.filter((inv) => (direction === "CREDIT" ? inv.type !== "PURCHASE" : inv.type === "PURCHASE")),
    [openInvoices]
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <label className="inline-block rounded-md border border-slate-300 text-sm font-medium px-4 py-2 hover:bg-slate-50 cursor-pointer">
          {uploading ? "Reading…" : "Upload bank statement (CSV or XLSX)"}
          <input type="file" accept=".csv,.xlsx,.xls" onChange={onFileChange} disabled={uploading} className="hidden" />
        </label>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <p className="text-xs text-slate-400 mt-2">
          Needs Date and Description columns, plus either Credit/Debit columns or an Amount column
          (most bank-portal exports already look like this).
        </p>
      </div>

      {rows && rows.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Description</th>
                <th className="text-right px-3 py-2">Amount</th>
                <th className="text-left px-3 py-2">Direction</th>
                <th className="text-left px-3 py-2">Match</th>
                <th className="text-left px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isConfirmed = confirmed[i];
                const selection = selections[i];
                const candidateOptions = row.candidates;
                const search = manualSearch[i] || "";
                const manualMatches =
                  search.length > 1
                    ? relevantInvoices(row.direction).filter(
                        (inv) =>
                          inv.number.toLowerCase().includes(search.toLowerCase()) ||
                          inv.partyName.toLowerCase().includes(search.toLowerCase())
                      )
                    : [];

                return (
                  <tr key={i} className={`border-t border-slate-100 ${isConfirmed ? "bg-emerald-50" : ""}`}>
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2 max-w-xs truncate" title={row.description}>
                      {row.description}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatINR(row.amount)}</td>
                    <td className="px-3 py-2">
                      <span className={row.direction === "CREDIT" ? "text-emerald-600" : "text-amber-600"}>
                        {row.direction === "CREDIT" ? "In" : "Out"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {isConfirmed ? (
                        <span className="text-emerald-600 text-xs font-medium">Recorded ✓</span>
                      ) : (
                        <div className="space-y-1">
                          {candidateOptions.length > 0 ? (
                            <select
                              value={selection?.invoiceId || ""}
                              onChange={(e) => {
                                const cand = candidateOptions.find((c) => c.invoiceId === e.target.value);
                                setSelections((s) => ({
                                  ...s,
                                  [i]: cand ? { invoiceId: cand.invoiceId, tdsAmount: cand.tdsAmount } : null,
                                }));
                              }}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                            >
                              {candidateOptions.map((c) => (
                                <option key={c.invoiceId} value={c.invoiceId}>
                                  {c.number} · {c.partyName} · {c.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-slate-400">No automatic match</span>
                          )}
                          <input
                            value={search}
                            onChange={(e) => setManualSearch((m) => ({ ...m, [i]: e.target.value }))}
                            placeholder="Search other invoice / party…"
                            className="block w-48 rounded-md border border-slate-300 px-2 py-1 text-xs"
                          />
                          {manualMatches.length > 0 && (
                            <ul className="border border-slate-200 rounded-md max-h-28 overflow-y-auto text-xs">
                              {manualMatches.slice(0, 8).map((inv) => (
                                <li
                                  key={inv.id}
                                  onClick={() => {
                                    setSelections((s) => ({ ...s, [i]: { invoiceId: inv.id, tdsAmount: 0 } }));
                                    setManualSearch((m) => ({ ...m, [i]: "" }));
                                  }}
                                  className="px-2 py-1 hover:bg-slate-50 cursor-pointer"
                                >
                                  {inv.number} · {inv.partyName} · balance {formatINR(inv.remainingBalance)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {!isConfirmed && (
                        <button
                          onClick={() => confirmRow(i)}
                          disabled={!selection || confirming === i}
                          className="rounded-md bg-brand text-white text-xs font-medium px-3 py-1.5 hover:bg-brand-dark disabled:opacity-40"
                        >
                          {confirming === i ? "Saving…" : "Confirm payment"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
