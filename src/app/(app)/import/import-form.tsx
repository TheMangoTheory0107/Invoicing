"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RegisterSummary {
  totalRows: number;
  imported: number;
  skipped: number;
  partiesCreated: number;
  errors: string[];
}

interface ClientSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

type Summary = RegisterSummary | ClientSummary;

function isClientSummary(s: Summary): s is ClientSummary {
  return "created" in s;
}

export default function ImportForm({
  type,
  title,
  columns,
  optionalColumns,
}: {
  type: "SALES" | "PURCHASE" | "CLIENTS";
  title: string;
  columns: string[];
  optionalColumns?: string[];
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    setSummary(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    const res = await fetch("/api/import", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(data.error || "Import failed.");
      return;
    }
    setSummary(data);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <p className="text-xs text-slate-500 mt-1">
          Accepts .csv or .xlsx. Expected columns (any order, extra columns ignored):{" "}
          <span className="font-mono">{columns.join(", ")}</span>.
          {optionalColumns && optionalColumns.length > 0 && (
            <> Optional: <span className="font-mono">{optionalColumns.join(", ")}</span>.</>
          )}
        </p>
      </div>
      <input
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="text-sm"
      />
      <button
        type="submit"
        disabled={!file || uploading}
        className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark disabled:opacity-60"
      >
        {uploading ? "Importing…" : "Import"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="text-sm bg-slate-50 rounded-md p-3 space-y-1">
          {isClientSummary(summary) ? (
            <div>
              {summary.created} created, {summary.updated} updated, {summary.skipped} skipped out
              of {summary.totalRows} rows.
            </div>
          ) : (
            <div>
              {summary.imported} of {summary.totalRows} rows imported, {summary.skipped} skipped,{" "}
              {summary.partiesCreated} new {type === "SALES" ? "client(s)" : "creator(s)"} created.
            </div>
          )}
          {summary.errors.length > 0 && (
            <details className="text-xs text-amber-700">
              <summary className="cursor-pointer">{summary.errors.length} note(s)</summary>
              <ul className="list-disc list-inside mt-1">
                {summary.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </form>
  );
}
