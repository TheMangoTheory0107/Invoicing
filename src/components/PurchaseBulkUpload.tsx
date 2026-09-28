"use client";

import { useState } from "react";
import Link from "next/link";
import { detectPurchaseBillFileKind, PURCHASE_BILL_ACCEPT } from "@/lib/purchaseBillFileType";

type FileStatus = "pending" | "reading" | "saving" | "done" | "error" | "duplicate";

interface FileEntry {
  key: string;
  name: string;
  status: FileStatus;
  message?: string;
  invoiceId?: string;
  vendorName?: string;
  amount?: number;
}

async function processOne(file: File, update: (patch: Partial<FileEntry>) => void) {
  update({ status: "reading" });

  const extractForm = new FormData();
  extractForm.append("file", file);
  const extractRes = await fetch("/api/invoices/purchase/extract", { method: "POST", body: extractForm });
  const extractData = await extractRes.json();
  if (!extractRes.ok) {
    update({ status: "error", message: extractData.error || "Could not read this file." });
    return;
  }

  const { extracted, matchedCreatorId, possibleDuplicate } = extractData;
  update({ vendorName: extracted.vendorName, amount: extracted.totalAmount });

  if (possibleDuplicate) {
    update({
      status: "duplicate",
      invoiceId: possibleDuplicate.id,
      message: `Already recorded as ${possibleDuplicate.number} (their #${possibleDuplicate.vendorInvoiceNumber}) — not saved again.`,
    });
    return;
  }

  let creatorId: string | null = matchedCreatorId;
  if (!creatorId && extracted.vendorName) {
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
    if (!createRes.ok) {
      update({ status: "error", message: `Couldn't auto-create creator "${extracted.vendorName}".` });
      return;
    }
    const party = await createRes.json();
    creatorId = party.id;
  }

  if (!creatorId) {
    update({ status: "error", message: "Couldn't identify a vendor on this bill." });
    return;
  }

  update({ status: "saving" });

  const lineItems = extracted.lineItems?.length
    ? extracted.lineItems.map((li: { description: string; qty: number; rate: number; amount: number }) => ({
        description: li.description || "",
        link1: "",
        link2: "",
        qty: li.qty || 1,
        rate: li.rate || li.amount || 0,
        amount: li.amount || 0,
      }))
    : [
        {
          description: "Bill",
          link1: "",
          link2: "",
          qty: 1,
          rate: extracted.billAmount || 0,
          amount: extracted.billAmount || 0,
        },
      ];

  const createInvoiceRes = await fetch("/api/invoices/purchase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creatorId,
      date: extracted.invoiceDate || new Date().toISOString().slice(0, 10),
      dueDate: extracted.dueDate || null,
      billAmount: extracted.billAmount || 0,
      gstAmount: extracted.gstAmount || 0,
      reimbursements: 0,
      lineItems,
      termsAndConditions: "",
      notes: "",
      vendorInvoiceNumber: extracted.invoiceNumber || "",
      hasSourcePdf: true,
    }),
  });
  const invoiceData = await createInvoiceRes.json();
  if (!createInvoiceRes.ok) {
    const errMsg =
      typeof invoiceData.error === "string"
        ? invoiceData.error
        : invoiceData.error?.formErrors?.[0] || "Could not save this bill.";
    update({ status: "error", message: errMsg });
    return;
  }

  const invoiceId = invoiceData.invoice.id;
  const sourceForm = new FormData();
  sourceForm.append("file", file);
  await fetch(`/api/invoices/${invoiceId}/upload-source-pdf`, { method: "POST", body: sourceForm });

  update({ status: "done", invoiceId });
}

export default function PurchaseBulkUpload() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);

    const entries: FileEntry[] = incoming.map((f) => ({
      key: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      name: f.name,
      status: "pending",
    }));
    setFiles((prev) => [...entries, ...prev]);
    setProcessing(true);

    for (let i = 0; i < incoming.length; i++) {
      const key = entries[i].key;
      const update = (patch: Partial<FileEntry>) =>
        setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));

      const detected = detectPurchaseBillFileKind(incoming[i].name, incoming[i].type);
      if ("error" in detected) {
        update({ status: "error", message: detected.error });
        continue;
      }
      try {
        await processOne(incoming[i], update);
      } catch {
        update({ status: "error", message: "Unexpected error processing this file." });
      }
    }
    setProcessing(false);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragOver ? "border-brand bg-brand-light" : "border-slate-300 bg-white"
        }`}
      >
        <p className="text-sm text-slate-600">
          Drop one or more vendor bills here (PDF, Excel .xlsx, or CSV) — each one is read and
          saved automatically. Numbers files aren&apos;t supported directly — export to PDF or
          Excel first.
        </p>
        <label className="inline-block mt-3 rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark cursor-pointer">
          Or choose files
          <input
            type="file"
            accept={PURCHASE_BILL_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <ul className="divide-y divide-slate-100">
            {files.map((f) => (
              <li key={f.key} className="px-4 py-3 flex items-center justify-between text-sm gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 truncate">{f.name}</div>
                  {f.vendorName && (
                    <div className="text-xs text-slate-500">
                      {f.vendorName}
                      {typeof f.amount === "number" && f.amount > 0 ? ` · ${f.amount}` : ""}
                    </div>
                  )}
                  {f.status === "error" && <div className="text-xs text-red-600 mt-0.5">{f.message}</div>}
                  {f.status === "duplicate" && <div className="text-xs text-amber-600 mt-0.5">{f.message}</div>}
                </div>
                <div className="shrink-0">
                  {f.status === "pending" && <span className="text-xs text-slate-400">Waiting…</span>}
                  {f.status === "reading" && <span className="text-xs text-amber-600">Reading…</span>}
                  {f.status === "saving" && <span className="text-xs text-amber-600">Saving…</span>}
                  {f.status === "done" && (
                    <Link href={`/invoices/purchase/${f.invoiceId}`} className="text-xs text-emerald-700 font-medium hover:underline">
                      Saved — view
                    </Link>
                  )}
                  {f.status === "error" && <span className="text-xs text-red-600 font-medium">Failed</span>}
                  {f.status === "duplicate" && (
                    <Link href={`/invoices/purchase/${f.invoiceId}`} className="text-xs text-amber-700 font-medium hover:underline">
                      Possible duplicate — view existing
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {processing && <p className="mt-3 text-xs text-slate-500">Processing… you can leave files to keep going.</p>}
    </div>
  );
}
