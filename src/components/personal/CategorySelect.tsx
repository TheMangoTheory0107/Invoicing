"use client";

import type { CategoryOption } from "./types";

const GROUPS: { label: string; match: (c: CategoryOption) => boolean }[] = [
  { label: "Needs (essentials)", match: (c) => c.kind === "EXPENSE" && c.bucket === "NEEDS" },
  { label: "Wants (fun money)", match: (c) => c.kind === "EXPENSE" && c.bucket !== "NEEDS" },
  { label: "Investments", match: (c) => c.kind === "INVESTMENT" },
  { label: "Income", match: (c) => c.kind === "INCOME" },
  { label: "Transfers (not counted)", match: (c) => c.kind === "TRANSFER" },
];

export default function CategorySelect({
  categories,
  value,
  onChange,
  className,
  placeholder = "— Pick a label —",
}: {
  categories: CategoryOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={
        className ||
        `w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand ${
          value ? "border-slate-300" : "border-amber-400 bg-amber-50"
        }`
      }
    >
      <option value="">{placeholder}</option>
      {GROUPS.map((g) => {
        const items = categories.filter(g.match);
        if (!items.length) return null;
        return (
          <optgroup key={g.label} label={g.label}>
            {items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
