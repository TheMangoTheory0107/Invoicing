// "Overdue" is derived at read time (not stored) so it's always correct without a cron job.
export function displayStatus(status: string, dueDate: Date | null, amountPaid: number, totalAmount: number): string {
  if (status === "PAID" || amountPaid >= totalAmount && totalAmount > 0) return "PAID";
  if (dueDate && dueDate.getTime() < startOfTodayUTC().getTime()) return "OVERDUE";
  return status;
}

export function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
