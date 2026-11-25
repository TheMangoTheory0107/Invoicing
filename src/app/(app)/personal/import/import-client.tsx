"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CategorySelect from "@/components/personal/CategorySelect";
import type { CategoryOption } from "@/components/personal/types";

interface Row {
  date: string;
  description: string;
  merchant: string;
  merchantKey: string;
  amount: number;
  direction: "DEBIT" | "CREDIT";
  categoryId: string | null;
  via: "rule" | "keyword" | "ai" | "none";
  needsReview: boolean;
  question: string;
  importHash: string;
  duplicate: boolean;
  // client-side
  notes: string;
  remember: boolean;
  edited: boolean;
}

const VIA_LABEL: Record<Row["via"], string> = {
  rule: "your rule",
  keyword: "known merchant",
  ai: "AI guess",
  none: "",
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dmy = (d: string) => d.split("-").reverse().join("/");

export default function ImportClient({ categories }: { categories: CategoryOption[] }) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAuto, setShowAuto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ saved: number; skipped: number; learned: number } | null>(null);

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploading(true);
    setError(null);
    setRows(null);
    setResult(null);
    setNotes([]);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/personal/import/parse", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't read that file.");
        return;
      }
      setNotes(data.notes || []);
      setRows(
        (data.rows as Omit<Row, "notes" | "remember" | "edited">[]).map((r) => ({ ...r, notes: "", remember: r.needsReview, edited: false }))
      );
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const fresh = rows?.filter((r) => !r.duplicate) || [];
  const dupes = rows?.filter((r) => r.duplicate) || [];
  const reviewRows = fresh.filter((r) => r.needsReview);
  const autoRows = fresh.filter((r) => !r.needsReview);

  // Group the rows needing input by merchant, biggest total first, so one answer labels
  // every payment to the same person/shop.
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; merchant: string; rows: Row[]; total: number }>();
    for (const r of reviewRows) {
      const key = r.merchantKey || r.importHash;
      const g = map.get(key) || { key, merchant: r.merchant, rows: [], total: 0 };
      g.rows.push(r);
      g.total += r.amount;
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [reviewRows]);

  function update(hashes: Set<string>, patch: Partial<Row>) {
    setRows((prev) => prev && prev.map((r) => (hashes.has(r.importHash) ? { ...r, ...patch } : r)));
  }

  const labelledInReview = reviewRows.filter((r) => r.categoryId).length;
  const totalOut = fresh.filter((r) => r.direction === "DEBIT").reduce((s, r) => s + r.amount, 0);

  async function save() {
    if (!rows) return;
    const unlabelled = fresh.filter((r) => !r.categoryId).length;
    if (unlabelled > 0 && !confirm(`${unlabelled} transactions are still unlabelled. Save anyway? (You can label them later.)`)) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/personal/import/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: fresh.map((r) => ({
          date: r.date,
          description: r.description,
          merchant: r.merchant,
          merchantKey: r.merchantKey,
          amount: r.amount,
          direction: r.direction,
          categoryId: r.categoryId,
          notes: r.notes,
          importHash: r.importHash,
          remember: r.remember && !!r.categoryId,
        })),
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Couldn't save.");
      return;
    }
    setResult(data);
    setRows(null);
  }

  if (result) {
    return (
      <div className="bg-white border border-emerald-200 rounded-lg p-6 max-w-xl">
        <div className="text-lg font-semibold text-emerald-800">Imported ✓</div>
        <p className="text-sm text-slate-700 mt-2">
          Saved <b>{result.saved}</b> transactions{result.skipped ? `, skipped ${result.skipped} already imported` : ""}.
          {result.learned > 0 && ` Learned ${result.learned} merchant labels for next time.`}
        </p>
        <div className="flex gap-3 mt-4">
          <Link href="/personal" className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark">
            See dashboard
          </Link>
          <button onClick={() => setResult(null)} className="rounded-md border border-slate-300 text-sm px-4 py-2 hover:bg-slate-50">
            Import another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!rows && (
        <label className="block bg-white border-2 border-dashed border-slate-300 rounded-lg p-10 text-center cursor-pointer hover:border-brand max-w-2xl">
          <input type="file" accept=".pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp" className="hidden" onChange={onFile} disabled={uploading} />
          {uploading ? (
            <div>
              <div className="text-sm font-medium text-slate-800">Reading {fileName}…</div>
              <div className="text-xs text-slate-500 mt-1">
                Gemini is going through every page and labelling each payment. A multi-page PDF can take a minute.
              </div>
              <div className="mt-4 h-1.5 w-48 mx-auto bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-brand rounded-full animate-pulse" />
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm font-medium text-slate-800">Drop in a bank statement</div>
              <div className="text-xs text-slate-500 mt-1">PDF (read by Gemini), or Excel / CSV export from net banking</div>
              <div className="mt-4 inline-block rounded-md bg-brand text-white text-sm font-medium px-4 py-2">Choose file</div>
            </div>
          )}
        </label>
      )}

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 max-w-2xl">{error}</div>}
      {notes.map((n, i) => (
        <div key={i} className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 max-w-2xl">
          {n}
        </div>
      ))}

      {rows && (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm bg-white border border-slate-200 rounded-lg px-5 py-4">
            <span className="font-medium text-slate-900">{fileName}</span>
            <span>
              <b>{fresh.length}</b> transactions · {inr(Math.round(totalOut))} out
            </span>
            <span className="text-emerald-700">{autoRows.length} auto-labelled</span>
            <span className="text-amber-700">
              {reviewRows.length} need your input ({labelledInReview} answered)
            </span>
            {dupes.length > 0 && <span className="text-slate-500">{dupes.length} already imported (will be skipped)</span>}
            <div className="ml-auto flex gap-2">
              <button onClick={() => setRows(null)} className="rounded-md border border-slate-300 text-sm px-3 py-1.5 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || fresh.length === 0}
                className="rounded-md bg-brand text-white text-sm font-medium px-4 py-1.5 hover:bg-brand-dark disabled:opacity-60"
              >
                {saving ? "Saving…" : `Save ${fresh.length} transactions`}
              </button>
            </div>
          </div>

          {groups.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Help me label these</h2>
                <p className="text-xs text-slate-500">
                  Grouped by who you paid — one answer covers every payment in the group. Tick &ldquo;remember&rdquo; and future statements
                  will label them automatically.
                </p>
              </div>
              {groups.map((g) => {
                const hashes = new Set(g.rows.map((r) => r.importHash));
                const groupCat = g.rows.every((r) => r.categoryId === g.rows[0].categoryId) ? g.rows[0].categoryId : null;
                const answered = g.rows.every((r) => r.categoryId);
                return (
                  <div key={g.key} className={`bg-white border rounded-lg p-4 ${answered ? "border-emerald-200" : "border-amber-300"}`}>
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="flex-1 min-w-[260px]">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-slate-900">{g.merchant}</span>
                          <span className="text-xs text-slate-500">
                            {g.rows.length} payment{g.rows.length > 1 ? "s" : ""} · {inr(Math.round(g.total * 100) / 100)}
                          </span>
                          {answered && <span className="text-xs text-emerald-700">✓</span>}
                        </div>
                        <div className="text-sm text-slate-700 mt-1">{g.rows[0].question}</div>
                        <div className="text-[11px] text-slate-400 mt-1 truncate max-w-xl" title={g.rows[0].description}>
                          {g.rows[0].description}
                        </div>
                      </div>
                      <div className="w-60">
                        <CategorySelect
                          categories={categories}
                          value={groupCat}
                          onChange={(id) => update(hashes, { categoryId: id, edited: true })}
                          placeholder={groupCat === null && g.rows.some((r) => r.categoryId) ? "— Mixed —" : undefined}
                        />
                        {g.rows[0].via === "ai" && g.rows[0].categoryId && !g.rows[0].edited && (
                          <div className="text-[11px] text-slate-500 mt-1">Gemini&apos;s guess: {catName.get(g.rows[0].categoryId)} — change if wrong</div>
                        )}
                      </div>
                      <div className="w-56">
                        <input
                          placeholder="Note (optional)"
                          value={g.rows[0].notes}
                          onChange={(e) => update(hashes, { notes: e.target.value })}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        />
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 mt-1.5">
                          <input
                            type="checkbox"
                            checked={g.rows[0].remember}
                            onChange={(e) => update(hashes, { remember: e.target.checked })}
                          />
                          Remember for {g.merchant}
                        </label>
                      </div>
                    </div>
                    {g.rows.length > 1 && (
                      <button
                        onClick={() => setExpanded((x) => ({ ...x, [g.key]: !x[g.key] }))}
                        className="text-xs text-brand hover:underline mt-2"
                      >
                        {expanded[g.key] ? "Hide" : "Label individually"} ({g.rows.length})
                      </button>
                    )}
                    {expanded[g.key] && (
                      <table className="w-full text-sm mt-2">
                        <tbody>
                          {g.rows.map((r) => (
                            <tr key={r.importHash} className="border-t border-slate-100">
                              <td className="py-1.5 w-24 text-slate-600">{dmy(r.date)}</td>
                              <td className="py-1.5 w-28 tabular-nums">{r.direction === "CREDIT" ? "+" : ""}{inr(r.amount)}</td>
                              <td className="py-1.5 w-60">
                                <CategorySelect
                                  categories={categories}
                                  value={r.categoryId}
                                  onChange={(id) => update(new Set([r.importHash]), { categoryId: id, edited: true })}
                                />
                              </td>
                              <td className="py-1.5 pl-2">
                                <input
                                  placeholder="Note"
                                  value={r.notes}
                                  onChange={(e) => update(new Set([r.importHash]), { notes: e.target.value })}
                                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          <section className="bg-white border border-slate-200 rounded-lg">
            <button onClick={() => setShowAuto((s) => !s)} className="w-full flex justify-between items-center px-5 py-3 text-left">
              <span>
                <span className="font-semibold text-slate-900">Auto-labelled</span>
                <span className="text-sm text-slate-500 ml-2">{autoRows.length} transactions — quick check, change anything that&apos;s off</span>
              </span>
              <span className="text-sm text-brand">{showAuto ? "Hide" : "Show"}</span>
            </button>
            {showAuto && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-y border-slate-100 bg-slate-50">
                    <th className="px-5 py-2">Date</th>
                    <th>Paid to / from</th>
                    <th className="text-right pr-4">Amount</th>
                    <th className="w-64">Label</th>
                    <th className="px-3">How</th>
                  </tr>
                </thead>
                <tbody>
                  {autoRows.map((r) => (
                    <tr key={r.importHash} className="border-b border-slate-100">
                      <td className="px-5 py-1.5 text-slate-600 whitespace-nowrap">{dmy(r.date)}</td>
                      <td className="py-1.5" title={r.description}>
                        {r.merchant}
                      </td>
                      <td className={`py-1.5 text-right pr-4 tabular-nums ${r.direction === "CREDIT" ? "text-emerald-700" : ""}`}>
                        {r.direction === "CREDIT" ? "+" : ""}
                        {inr(r.amount)}
                      </td>
                      <td className="py-1.5">
                        <CategorySelect
                          categories={categories}
                          value={r.categoryId}
                          onChange={(id) => update(new Set([r.importHash]), { categoryId: id, edited: true, remember: true })}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-xs text-slate-400 whitespace-nowrap">{r.edited ? "edited" : VIA_LABEL[r.via]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
