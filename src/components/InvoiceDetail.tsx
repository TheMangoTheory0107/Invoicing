"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatINR } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { displayStatus } from "@/lib/status";
import { warnOnSyncFailure } from "@/lib/syncWarning";

export interface InvoiceDetailData {
  id: string;
  type: "SALES" | "PURCHASE" | "COMMISSION";
  number: string;
  date: string;
  dueDate: string | null;
  status: string;
  amountPaid: number;
  tdsDeducted: number;
  billAmount: number;
  gstAmount: number;
  reimbursements: number;
  totalAmount: number;
  pdfPath: string | null;
  hasSourcePdf?: boolean;
  vendorInvoiceNumber?: string | null;
  poNumber?: string | null;
  collaborationBrand: string | null;
  partyName: string;
  partyId: string | null;
  partyEmail?: string | null;
  lineItems: { id: string; description: string; link1: string | null; link2: string | null; qty: number; rate: number; amount: number }[];
  creators: { id: string; name: string; pageHandle: string | null; amount: number; partyId: string | null }[];
  payments: { id: string; date: string; amount: number; tdsAmount: number; method: string | null; reference: string | null }[];
  hasLinkedPurchaseBillsFor: string[]; // creator party ids that already have a purchase bill
}

export default function InvoiceDetail({ data }: { data: InvoiceDetailData }) {
  const router = useRouter();
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState<number | "">(
    Math.max(0, data.totalAmount - data.amountPaid - data.tdsDeducted) || ""
  );
  const [payTdsPct, setPayTdsPct] = useState<number | "">("");
  const payTdsAmount = Math.round((data.billAmount * (Number(payTdsPct) || 0)) / 100 * 100) / 100;
  const [payMethod, setPayMethod] = useState("");
  const [payReference, setPayReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingBills, setGeneratingBills] = useState(false);
  const [emailTo, setEmailTo] = useState(data.partyEmail || "");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{ ok: true } | { ok: false; error: string } | null>(null);

  const listHref =
    data.type === "SALES"
      ? "/invoices/sales"
      : data.type === "COMMISSION"
        ? "/invoices/commission"
        : "/invoices/purchase";
  const settled = data.amountPaid + data.tdsDeducted;
  const balance = data.totalAmount - settled;
  const effectiveStatus = displayStatus(
    data.status,
    data.dueDate ? new Date(data.dueDate) : null,
    settled,
    data.totalAmount
  );

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payAmount || payAmount <= 0) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/invoices/${data.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: payDate,
        amount: payAmount,
        tdsAmount: payTdsAmount,
        method: payMethod,
        reference: payReference,
      }),
    });
    const resData = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError("Could not record payment.");
      return;
    }
    warnOnSyncFailure(resData.syncResult);
    router.refresh();
  }

  async function deletePayment(id: string) {
    if (!confirm("Remove this payment?")) return;
    await fetch(`/api/payments/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function deleteInvoice() {
    if (!confirm(`Delete ${data.number}? This also removes its sheet row and Drive file.`)) return;
    const res = await fetch(`/api/invoices/${data.id}`, { method: "DELETE" });
    const resData = await res.json().catch(() => null);
    warnOnSyncFailure(resData?.syncResult, resData?.driveSyncResult);
    router.push(listHref);
    router.refresh();
  }

  async function generatePurchaseBills() {
    setGeneratingBills(true);
    const res = await fetch(`/api/invoices/${data.id}/generate-purchase-bills`, { method: "POST" });
    setGeneratingBills(false);
    if (res.ok) router.refresh();
  }

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    setSendingEmail(true);
    setEmailResult(null);
    const res = await fetch(`/api/invoices/${data.id}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: emailTo }),
    });
    const resData = await res.json().catch(() => null);
    setSendingEmail(false);
    setEmailResult(res.ok ? { ok: true } : { ok: false, error: resData?.error || "Could not send the email." });
  }

  const creatorsNeedingBills = data.creators.filter(
    (c) => c.partyId && c.amount > 0 && !data.hasLinkedPurchaseBillsFor.includes(c.partyId)
  );

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center gap-3">
        <StatusBadge status={effectiveStatus} />
        <span className="text-sm text-slate-500">
          {data.partyName} · {data.date.slice(0, 10)}
          {data.dueDate ? ` · due ${data.dueDate.slice(0, 10)}` : ""}
          {data.type === "PURCHASE" && data.vendorInvoiceNumber ? ` · our ref ${data.number}` : ""}
        </span>
        <div className="ml-auto flex gap-2">
          {data.pdfPath && (
            <a
              href={data.pdfPath}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-brand-light bg-brand-light text-brand text-sm px-3 py-1.5 hover:brightness-95 font-medium"
            >
              {data.type === "PURCHASE" ? "View original bill (Drive)" : "View in Drive"}
            </a>
          )}
          {!(data.type === "PURCHASE" && data.hasSourcePdf) && (
            <a
              href={`/api/invoices/${data.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-300 text-sm px-3 py-1.5 hover:bg-slate-50"
            >
              {data.type === "PURCHASE" ? "Internal record (PDF)" : "Download PDF"}
            </a>
          )}
          <Link
            href={`${listHref}/${data.id}/edit`}
            className="rounded-md border border-slate-300 text-sm px-3 py-1.5 hover:bg-slate-50"
          >
            Edit
          </Link>
          <button
            onClick={deleteInvoice}
            className="rounded-md border border-red-200 text-red-600 text-sm px-3 py-1.5 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {data.type !== "PURCHASE" && (
        <form
          onSubmit={sendEmail}
          className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex flex-wrap items-center gap-2"
        >
          <span className="text-sm font-medium text-slate-700 shrink-0">Send by email</span>
          <input
            type="email"
            required
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="client@example.com"
            className="flex-1 min-w-[200px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={sendingEmail}
            className="rounded-md bg-brand text-white text-sm font-medium px-3 py-1.5 hover:bg-brand-dark disabled:opacity-60"
          >
            {sendingEmail ? "Sending…" : "Send"}
          </button>
          {emailResult && (
            <span className={`text-xs ${emailResult.ok ? "text-emerald-600" : "text-red-600"} basis-full`}>
              {emailResult.ok ? "Sent." : emailResult.error}
            </span>
          )}
        </form>
      )}

      {data.type === "SALES" && creatorsNeedingBills.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-amber-800">
            {creatorsNeedingBills.length} creator(s) on this invoice don&apos;t have a purchase
            bill yet.
          </span>
          <button
            onClick={generatePurchaseBills}
            disabled={generatingBills}
            className="rounded-md bg-amber-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-amber-700 disabled:opacity-60"
          >
            {generatingBills ? "Generating…" : "Generate purchase bills"}
          </button>
        </div>
      )}

      {data.collaborationBrand && (
        <p className="text-sm text-slate-600">Collaboration brand: {data.collaborationBrand}</p>
      )}
      {data.poNumber && (
        <p className="text-sm text-slate-600">PO number: {data.poNumber}</p>
      )}

      {data.creators.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
            Creators referenced
          </div>
          <table className="w-full text-sm">
            <tbody>
              {data.creators.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-slate-500">{c.pageHandle || ""}</td>
                  <td className="px-4 py-2 text-right">{formatINR(c.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
          Line items
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-400 uppercase">
            <tr>
              <th className="text-left px-4 py-2">Description</th>
              <th className="text-right px-4 py-2">Qty</th>
              <th className="text-right px-4 py-2">Rate</th>
              <th className="text-right px-4 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((li) => (
              <tr key={li.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{li.description}</td>
                <td className="px-4 py-2 text-right">{li.qty}</td>
                <td className="px-4 py-2 text-right">{formatINR(li.rate)}</td>
                <td className="px-4 py-2 text-right">{formatINR(li.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-slate-200 px-4 py-3 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Bill amount</span>
              <span>{formatINR(data.billAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">GST</span>
              <span>{formatINR(data.gstAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Reimbursements</span>
              <span>{formatINR(data.reimbursements)}</span>
            </div>
            <div className="flex justify-between font-semibold text-brand border-t border-slate-200 pt-1">
              <span>Total</span>
              <span>{formatINR(data.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase bg-slate-50">
            Payments
          </div>
          {data.payments.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-400">No payments recorded.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.payments.map((p) => (
                <li key={p.id} className="px-4 py-2 flex items-center justify-between text-sm">
                  <div>
                    <div>{p.date.slice(0, 10)}</div>
                    <div className="text-xs text-slate-400">
                      {[p.method, p.reference].filter(Boolean).join(" · ")}
                      {p.tdsAmount > 0 ? ` · TDS ${formatINR(p.tdsAmount)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatINR(p.amount)}</span>
                    <button
                      onClick={() => deletePayment(p.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-slate-100 bg-slate-50 text-sm">
            <div className="px-4 py-1.5 flex justify-between text-slate-500">
              <span>{data.type === "PURCHASE" ? "Cash paid" : "Cash received"}</span>
              <span>{formatINR(data.amountPaid)}</span>
            </div>
            {data.tdsDeducted > 0 && (
              <div className="px-4 py-1.5 flex justify-between text-slate-500">
                <span>TDS deducted</span>
                <span>{formatINR(data.tdsDeducted)}</span>
              </div>
            )}
            <div className="px-4 py-2 border-t border-slate-200 flex justify-between">
              <span className="text-slate-500">Balance</span>
              <span className="font-semibold">{formatINR(Math.max(0, balance))}</span>
            </div>
          </div>
        </div>

        {balance > 0 && (
          <form onSubmit={recordPayment} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase">Record a payment</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs text-slate-600 mb-1">Date</span>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="block text-xs text-slate-600 mb-1">
                  {data.type === "PURCHASE" ? "Amount paid" : "Amount received"}
                </span>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value ? parseFloat(e.target.value) : "")}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="block text-xs text-slate-600 mb-1">TDS deducted (%, if any)</span>
                <input
                  type="number"
                  step="0.01"
                  value={payTdsPct}
                  onChange={(e) => setPayTdsPct(e.target.value ? parseFloat(e.target.value) : "")}
                  placeholder="e.g. 2"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                {payTdsPct !== "" && payTdsPct > 0 && (
                  <span className="block text-xs text-slate-400 mt-0.5">= {formatINR(payTdsAmount)}</span>
                )}
              </label>
              <label className="block">
                <span className="block text-xs text-slate-600 mb-1">Method</span>
                <input
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  placeholder="UPI / Bank transfer…"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="block text-xs text-slate-600 mb-1">Reference</span>
                <input
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark disabled:opacity-60"
            >
              {saving ? "Saving…" : "Record payment"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
