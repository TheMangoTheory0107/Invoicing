"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

// A single "sort by invoice number" control, dropped onto plain invoice list pages that don't
// already have a filter bar (Sales/Commission/Purchase invoices) — Register pages get the same
// options folded into RegisterFilters instead, since they already have one.
export default function SortControl() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("sort", value);
    else next.delete("sort");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <select
      value={params.get("sort") || ""}
      onChange={(e) => set(e.target.value)}
      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
    >
      <option value="">Sort: Newest first</option>
      <option value="number-asc">Invoice # — low to high</option>
      <option value="number-desc">Invoice # — high to low</option>
    </select>
  );
}
