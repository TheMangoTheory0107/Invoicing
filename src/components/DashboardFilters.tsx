"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function DashboardFilters({
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
    <div className="flex flex-wrap items-center gap-2">
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
        value={params.get("sort") || ""}
        onChange={(e) => set("sort", e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">Sort: Newest first</option>
        <option value="number-asc">Invoice # — low to high</option>
        <option value="number-desc">Invoice # — high to low</option>
      </select>
    </div>
  );
}
