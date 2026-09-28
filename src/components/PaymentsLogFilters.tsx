"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function PaymentsLogFilters() {
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
      <label className="flex items-center gap-1.5 text-xs text-slate-500">
        From
        <input
          type="date"
          defaultValue={params.get("from") || ""}
          onChange={(e) => set("from", e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-slate-500">
        To
        <input
          type="date"
          defaultValue={params.get("to") || ""}
          onChange={(e) => set("to", e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <select
        value={params.get("type") || ""}
        onChange={(e) => set("type", e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">All types</option>
        <option value="SALES">Sales only</option>
        <option value="COMMISSION">Commission only</option>
        <option value="PURCHASE">Purchase only</option>
      </select>
      <input
        defaultValue={params.get("q") || ""}
        onBlur={(e) => set("q", e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") set("q", (e.target as HTMLInputElement).value);
        }}
        placeholder="Search party name…"
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
    </div>
  );
}
