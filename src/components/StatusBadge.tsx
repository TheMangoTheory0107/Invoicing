const STYLES: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  UNPAID: "bg-slate-200 text-slate-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-red-50 text-red-500 line-through",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STYLES[status] || STYLES.UNPAID
      }`}
    >
      {status}
    </span>
  );
}
