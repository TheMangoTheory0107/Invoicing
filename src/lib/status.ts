// "Overdue" is derived at read time (not stored) so it's always correct without a cron job.
// CANCELLED is checked first — a cancelled invoice's old due date shouldn't make it show as
// OVERDUE, and cancelling always wins over whatever the payment-derived status would be.
export function displayStatus(status: string, dueDate: Date | null, amountPaid: number, totalAmount: number): string {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "PAID" || amountPaid >= totalAmount && totalAmount > 0) return "PAID";
  if (dueDate && dueDate.getTime() < startOfTodayUTC().getTime()) return "OVERDUE";
  return status;
}

export function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
