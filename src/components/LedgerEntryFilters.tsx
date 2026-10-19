"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const STATUS_OPTIONS = ["", "UNPAID", "PARTIAL", "PAID", "OVERDUE"];

// Cuts down a long party ledger (one row per invoice) to just what's being asked about right
// now — mirrors the Register pages' filter bar so the whole app filters the same way.
export default function LedgerEntryFilters({
  fyOptions,
  monthOptions,
}: {
  fyOptions: string[];
  monthOptions: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <select
        value={params.get("fy") || ""}
        onChange={(e) => set("fy", e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">All years</option>
        {fyOptions.map((fy) => (
          <option key={fy} value={fy}>
            FY {fy}
          </option>
        ))}
      </select>
      <select
        value={params.get("month") || ""}
        onChange={(e) => set("month", e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">All months</option>
        {monthOptions.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select
        value={params.get("status") || ""}
        onChange={(e) => set("status", e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s || "All statuses"}
          </option>
        ))}
      </select>
      <select
        value={params.get("sort") || ""}
        onChange={(e) => set("sort", e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">Oldest first</option>
        <option value="newest">Newest first</option>
      </select>
      <input
        defaultValue={params.get("q") || ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") set("q", (e.target as HTMLInputElement).value);
        }}
        onBlur={(e) => set("q", e.target.value)}
        placeholder="Search invoice #…"
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
    </div>
  );
}
