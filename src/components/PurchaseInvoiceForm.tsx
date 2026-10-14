"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Party } from "@prisma/client";
import { formatINR } from "@/lib/format";
import { warnOnSyncFailure } from "@/lib/syncWarning";
import { detectPurchaseBillFileKind, PURCHASE_BILL_ACCEPT } from "@/lib/purchaseBillFileType";
import type { ExtractedPurchaseBill } from "@/lib/geminiExtract";

interface LineItemRow {
  description: string;
  link1: string;
  link2: string;
  qty: number;
  rate: number;
  amount: number;
}

const emptyLineItem: LineItemRow = { description: "", link1: "", link2: "", qty: 1, rate: 0, amount: 0 };

export interface PurchaseInvoiceInitial {
  id?: string;
  creatorId: string;
  date: string;
  dueDate: string;
  gstAmount: number;
  reimbursements: number;
  termsAndConditions: string;
  notes: string;
  vendorInvoiceNumber: string;
  lineItems: LineItemRow[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function PurchaseInvoiceForm({
  creators,
  initial,
}: {
  creators: Party[];
  initial?: PurchaseInvoiceInitial;
}) {
  const router = useRouter();
  const isEdit = !!initial?.id;

  const [creatorList, setCreatorList] = useState(creators);
  const [creatorId, setCreatorId] = useState(initial?.creatorId || creators[0]?.id || "");
  const [addingCreator, setAddingCreator] = useState(false);
  const [newCreatorName, setNewCreatorName] = useState("");
  const [newCreatorGstin, setNewCreatorGstin] = useState("");
  const [creatingCreator, setCreatingCreator] = useState(false);
  const [newCreatorError, setNewCreatorError] = useState<string | null>(null);
  const [date, setDate] = useState(initial?.date || todayStr());
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [gstAmount, setGstAmount] = useState(initial?.gstAmount ?? 0);
  const [reimbursements, setReimbursements] = useState(initial?.reimbursements ?? 0);
  const [notes, setNotes] = useState(initial?.notes || "");
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState(initial?.vendorInvoiceNumber || "");
  const [lineItems, setLineItems] = useState<LineItemRow[]>(
    initial?.lineItems?.length ? initial.lineItems : [{ ...emptyLineItem }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [autoCreatedVendor, setAutoCreatedVendor] = useState<string | null>(null);
  const [possibleDuplicate, setPossibleDuplicate] = useState<{ id: string; number: string; vendorInvoiceNumber: string | null } | null>(null);
  const [sourcePdfFile, setSourcePdfFile] = useState<File | null>(null);

  async function createCreator() {
    if (!newCreatorName.trim()) {
      setNewCreatorError("Name is required.");
      return;
    }
    setCreatingCreator(true);
    setNewCreatorError(null);
    const res = await fetch("/api/parties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "CREATOR", name: newCreatorName.trim(), gstin: newCreatorGstin.trim() }),
    });
    setCreatingCreator(false);
    if (!res.ok) {
      setNewCreatorError("Could not create creator.");
      return;
    }
    const party = await res.json();
    setCreatorList((list) => [...list, party].sort((a, b) => a.name.localeCompare(b.name)));
    setCreatorId(party.id);
    setAddingCreator(false);
    setNewCreatorName("");
    setNewCreatorGstin("");
    setAutoCreatedVendor(null);
  }

  async function onExtractPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtractError(null);
    setAutoCreatedVendor(null);
    setPossibleDuplicate(null);

    const detected = detectPurchaseBillFileKind(file.name, file.type);
    if ("error" in detected) {
      setExtractError(detected.error);
      return;
    }

    setExtracting(true);
    setSourcePdfFile(file);

    const formData = new FormData();
    formData.append("file", file);
    let res: Response;
    let data: { error?: string } | { extracted: ExtractedPurchaseBill; matchedCreatorId: string | null; possibleDuplicate: { id: string; number: string; vendorInvoiceNumber: string | null } | null };
    try {
      res = await fetch("/api/invoices/purchase/extract", { method: "POST", body: formData });
      data = await res.json();
    } catch {
      setExtracting(false);
      setExtractError("Could not read that file — the request timed out or failed. Try again.");
      return;
    }
    setExtracting(false);
    if (!res.ok || !("extracted" in data)) {
      setExtractError(("error" in data && data.error) || "Could not read that file.");
      return;
    }

    const { extracted, matchedCreatorId, possibleDuplicate: dup } = data;
    if (dup) setPossibleDuplicate(dup);
    if (matchedCreatorId) {
      setCreatorId(matchedCreatorId);
    } else if (extracted.vendorName) {
      // No existing creator matches this vendor — create one automatically rather than
      // stopping to ask, so a single PDF upload is enough to get to a savable bill.
      const createRes = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CREATOR",
          name: extracted.vendorName,
          gstin: extracted.vendorGstin || "",
          panNo: extracted.vendorPan || "",
          bankAccName: extracted.vendorBankAccName || "",
          bankName: extracted.vendorBankName || "",
          bankAccNo: extracted.vendorBankAccNo || "",
          ifsc: extracted.vendorIfsc || "",
          upiId: extracted.vendorUpiId || "",
        }),
      });
      if (createRes.ok) {
        const party = await createRes.json();
        setCreatorList((list) => [...list, party].sort((a, b) => a.name.localeCompare(b.name)));
        setCreatorId(party.id);
        setAutoCreatedVendor(extracted.vendorName);
      } else {
        setExtractError(`Read the PDF, but couldn't auto-create creator "${extracted.vendorName}" — add them manually below.`);
      }
    }
    if (extracted.invoiceNumber) setVendorInvoiceNumber(extracted.invoiceNumber);
    if (extracted.invoiceDate) setDate(extracted.invoiceDate);
    if (extracted.dueDate) setDueDate(extracted.dueDate);
    if (extracted.gstAmount) setGstAmount(extracted.gstAmount);
    if (extracted.lineItems?.length) {
      setLineItems(
        extracted.lineItems.map((li: { description: string; qty: number; rate: number; amount: number }) => ({
          description: li.description || "",
          link1: "",
          link2: "",
          qty: li.qty || 1,
          rate: li.rate || li.amount || 0,
          amount: li.amount || 0,
        }))
      );
    }
  }

  const billAmount = useMemo(() => lineItems.reduce((s, li) => s + (li.amount || 0), 0), [lineItems]);
  const totalAmount = billAmount + (gstAmount || 0) + (reimbursements || 0);

  function updateLineItem(i: number, patch: Partial<LineItemRow>) {
    setLineItems((rows) => {
      const next = [...rows];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!creatorId) {
      setError("Please select a creator.");
      return;
    }
    setSaving(true);

    const payload = {
      creatorId,
      date,
      dueDate: dueDate || null,
      billAmount,
      gstAmount,
      reimbursements,
      lineItems,
      termsAndConditions: "",
      notes,
      vendorInvoiceNumber,
      hasSourcePdf: !isEdit && !!sourcePdfFile,
    };

    const url = isEdit ? `/api/invoices/${initial!.id}` : "/api/invoices/purchase";
    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(typeof data.error === "string" ? data.error : "Could not save bill.");
      return;
    }

    let originalUploadResult = null;
    if (!isEdit && sourcePdfFile) {
      const sourceForm = new FormData();
      sourceForm.append("file", sourcePdfFile);
      const uploadRes = await fetch(`/api/invoices/${data.invoice.id}/upload-source-pdf`, {
        method: "POST",
        body: sourceForm,
      });
      if (uploadRes.ok) {
        originalUploadResult = (await uploadRes.json()).driveSyncResult;
      }
    }

    setSaving(false);
    warnOnSyncFailure(data.syncResult, data.driveSyncResult || originalUploadResult);
    router.push(`/invoices/purchase/${data.invoice.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl pb-16">
      {error && <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      {!isEdit && (
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Auto-read from a bill</h2>
          <p className="text-xs text-slate-500 mb-3">
            Upload the bill you received (PDF, Excel .xlsx, or CSV) and this fills in the creator,
            date, amounts, and line items automatically (needs a Gemini API key set in Settings).
            Numbers files aren&apos;t supported directly — export to PDF or Excel first.
          </p>
          <label className="inline-block rounded-md border border-slate-300 text-sm font-medium px-4 py-2 hover:bg-slate-50 cursor-pointer">
            {extracting ? "Reading…" : "Upload bill"}
            <input type="file" accept={PURCHASE_BILL_ACCEPT} onChange={onExtractPdf} disabled={extracting} className="hidden" />
          </label>
          {extractError && <p className="text-xs text-red-600 mt-2">{extractError}</p>}
          {possibleDuplicate && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2">
              This looks like it may already be recorded, as{" "}
              <a href={`/invoices/purchase/${possibleDuplicate.id}`} target="_blank" rel="noreferrer" className="underline font-medium">
                {possibleDuplicate.number}
              </a>{" "}
              (their invoice #{possibleDuplicate.vendorInvoiceNumber}). Check before saving to
              avoid a duplicate.
            </p>
          )}
          {autoCreatedVendor && (
            <p className="text-xs text-emerald-600 mt-2">
              No existing creator matched — added &quot;{autoCreatedVendor}&quot; as a new creator automatically.
            </p>
          )}
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Bill details</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Creator</span>
            <select
              value={addingCreator ? "__new__" : creatorId}
              onChange={(e) => {
                if (e.target.value === "__new__") {
                  setAddingCreator(true);
                  return;
                }
                setCreatorId(e.target.value);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              required
            >
              <option value="">Select a creator…</option>
              {creatorList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__new__">+ Add new creator…</option>
            </select>
            {addingCreator && (
              <div className="mt-2 border border-slate-200 rounded-md p-3 space-y-2 bg-slate-50">
                <input
                  autoFocus
                  placeholder="Creator name"
                  value={newCreatorName}
                  onChange={(e) => setNewCreatorName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  placeholder="GSTIN (optional)"
                  value={newCreatorGstin}
                  onChange={(e) => setNewCreatorGstin(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                {newCreatorError && <p className="text-xs text-red-600">{newCreatorError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={createCreator}
                    disabled={creatingCreator}
                    className="rounded-md bg-brand text-white text-xs font-medium px-3 py-1.5 hover:bg-brand-dark disabled:opacity-60"
                  >
                    {creatingCreator ? "Adding…" : "Add creator"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCreator(false);
                      setNewCreatorError(null);
                    }}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {creatorList.length === 0 && !addingCreator && (
              <p className="text-xs text-amber-600 mt-1">No creators yet — add one above.</p>
            )}
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              Vendor&apos;s invoice number <span className="text-slate-400">(their own number, not ours)</span>
            </span>
            <input
              value={vendorInvoiceNumber}
              onChange={(e) => setVendorInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-2026-0042"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Bill date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              Due date <span className="text-slate-400">(blank = auto from settings)</span>
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-800">Line items</h2>
          <button
            type="button"
            onClick={() => setLineItems((rows) => [...rows, { ...emptyLineItem }])}
            className="text-xs text-brand font-medium hover:underline"
          >
            + Add line
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 uppercase text-left">
              <th className="pb-2 w-[40%]">Description</th>
              <th className="pb-2 w-[14%]">Qty</th>
              <th className="pb-2 w-[24%] text-right">Amount</th>
              <th className="pb-2 w-[4%]"></th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1.5 pr-1">
                  <input
                    value={li.description}
                    onChange={(e) => updateLineItem(i, { description: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    required
                  />
                </td>
                <td className="py-1.5 pr-1">
                  <input
                    type="number"
                    value={li.qty}
                    onChange={(e) => updateLineItem(i, { qty: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="py-1.5 pr-1 text-right">
                  <input
                    type="number"
                    value={li.amount}
                    onChange={(e) => updateLineItem(i, { amount: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-right"
                  />
                </td>
                <td className="py-1.5 text-center">
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLineItems((rows) => rows.filter((_, idx) => idx !== i))}
                      className="text-red-500 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Totals &amp; notes</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">GST amount</span>
              <input
                type="number"
                value={gstAmount}
                onChange={(e) => setGstAmount(parseFloat(e.target.value) || 0)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Reimbursements</span>
              <input
                type="number"
                value={reimbursements}
                onChange={(e) => setReimbursements(parseFloat(e.target.value) || 0)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Internal notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="bg-slate-50 rounded-md p-4 h-fit space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Bill amount</span>
              <span>{formatINR(billAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">GST</span>
              <span>{formatINR(gstAmount || 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Reimbursements</span>
              <span>{formatINR(reimbursements || 0)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold border-t border-slate-200 pt-2 text-brand">
              <span>Total</span>
              <span>{formatINR(totalAmount)}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create bill & generate PDF"}
        </button>
      </div>
    </form>
  );
}
