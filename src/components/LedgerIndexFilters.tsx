"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function LedgerIndexFilters() {
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
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <select
        value={params.get("sort") || ""}
        onChange={(e) => set("sort", e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">Sort: Outstanding — high to low</option>
        <option value="outstanding-asc">Outstanding — low to high</option>
        <option value="name">Name A–Z</option>
      </select>
      <input
        defaultValue={params.get("q") || ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") set("q", (e.target as HTMLInputElement).value);
        }}
        onBlur={(e) => set("q", e.target.value)}
        placeholder="Search name…"
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
    </div>
  );
}
