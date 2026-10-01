"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Party } from "@prisma/client";
import { formatINR } from "@/lib/format";
import { warnOnSyncFailure } from "@/lib/syncWarning";

const GST_RATE = 0.18;

interface LineItemRow {
  description: string;
  link1: string;
  link2: string;
  qty: number;
  rate: number;
  amount: number;
}

interface CreatorRow {
  partyId: string | null;
  name: string;
  address: string;
  email: string;
  phone: string;
  pageHandle: string;
  gstNumber: string;
  link1: string;
  link2: string;
  amount: number;
}

const emptyLineItem: LineItemRow = { description: "", link1: "", link2: "", qty: 1, rate: 0, amount: 0 };
const emptyCreator: CreatorRow = {
  partyId: null,
  name: "",
  address: "",
  email: "",
  phone: "",
  pageHandle: "",
  gstNumber: "",
  link1: "",
  link2: "",
  amount: 0,
};

export interface SalesInvoiceInitial {
  id?: string;
  clientId: string;
  date: string;
  poNumber: string;
  dueDate: string;
  collaborationBrand: string;
  gstAmount: number;
  reimbursements: number;
  termsAndConditions: string;
  notes: string;
  lineItems: LineItemRow[];
  creators: CreatorRow[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function SalesInvoiceForm({
  clients,
  creatorParties,
  initial,
  defaultTerms,
  kind = "sales",
}: {
  clients: Party[];
  creatorParties: Party[];
  initial?: SalesInvoiceInitial;
  defaultTerms: string;
  kind?: "sales" | "commission";
}) {
  const basePath = kind === "commission" ? "/invoices/commission" : "/invoices/sales";
  const createUrl = kind === "commission" ? "/api/invoices/commission" : "/api/invoices/sales";
  const router = useRouter();
  const isEdit = !!initial?.id;

  const [clientList, setClientList] = useState(clients);
  const [clientId, setClientId] = useState(initial?.clientId || clients[0]?.id || "");
  const [clientQuery, setClientQuery] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientPickerRef = useRef<HTMLDivElement>(null);
  const [addingClient, setAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientGstin, setNewClientGstin] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientError, setNewClientError] = useState<string | null>(null);
  const [date, setDate] = useState(initial?.date || todayStr());
  const [poNumber, setPoNumber] = useState(initial?.poNumber || "");
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [collaborationBrand, setCollaborationBrand] = useState(initial?.collaborationBrand || "");
  const [gstAmount, setGstAmount] = useState(initial?.gstAmount ?? 0);
  const [reimbursements, setReimbursements] = useState(initial?.reimbursements ?? 0);
  const [terms, setTerms] = useState(initial?.termsAndConditions ?? defaultTerms);
  const [notes, setNotes] = useState(initial?.notes || "");
  const [lineItems, setLineItems] = useState<LineItemRow[]>(
    initial?.lineItems?.length ? initial.lineItems : [{ ...emptyLineItem }]
  );
  const [creators, setCreators] = useState<CreatorRow[]>(initial?.creators || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailOnSave, setEmailOnSave] = useState(false);
  const [emailOnSaveTo, setEmailOnSaveTo] = useState("");
  const [emailOnSaveSubject, setEmailOnSaveSubject] = useState("");

  const billAmount = useMemo(() => lineItems.reduce((s, li) => s + (li.amount || 0), 0), [lineItems]);
  const totalAmount = billAmount + (gstAmount || 0) + (reimbursements || 0);

  // GST auto-calculates as 18% of the bill amount whenever line items change — but if
  // someone has manually typed a different GST figure (e.g. a zero-rated invoice), we stop
  // overwriting it. Editing an existing invoice starts "manual" so its saved amount isn't
  // silently recalculated just from opening the page.
  const gstManuallySet = useRef(!!initial);
  useEffect(() => {
    if (gstManuallySet.current) return;
    setGstAmount(Math.round(billAmount * GST_RATE * 100) / 100);
  }, [billAmount]);

  // Due date defaults to one month after the invoice date — recalculated as the date
  // changes, unless the user has typed their own due date (or we're editing an invoice
  // that already has one saved).
  const dueDateManuallySet = useRef(!!initial?.dueDate);
  useEffect(() => {
    if (dueDateManuallySet.current || !date) return;
    const d = new Date(`${date}T00:00:00`);
    d.setMonth(d.getMonth() + 1);
    setDueDate(d.toISOString().slice(0, 10));
  }, [date]);

  const selectedClientName = clientList.find((c) => c.id === clientId)?.name || "";
  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clientList;
    return clientList.filter((c) => c.name.toLowerCase().includes(q));
  }, [clientList, clientQuery]);

  // Pre-fills the "email after saving" address from whichever client is selected, same as
  // the detail page's Send by email box does — but never overwrites it once the user has
  // typed their own address in.
  const emailToManuallySet = useRef(false);
  useEffect(() => {
    if (emailToManuallySet.current || isEdit) return;
    setEmailOnSaveTo(clientList.find((c) => c.id === clientId)?.email || "");
  }, [clientId, clientList, isEdit]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (clientPickerRef.current && !clientPickerRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function updateLineItem(i: number, patch: Partial<LineItemRow>) {
    setLineItems((rows) => {
      const next = [...rows];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  function updateCreator(i: number, patch: Partial<CreatorRow>) {
    setCreators((rows) => {
      const next = [...rows];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  async function createClient() {
    if (!newClientName.trim()) {
      setNewClientError("Name is required.");
      return;
    }
    setCreatingClient(true);
    setNewClientError(null);
    const res = await fetch("/api/parties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "CLIENT", name: newClientName.trim(), gstin: newClientGstin.trim() }),
    });
    setCreatingClient(false);
    if (!res.ok) {
      setNewClientError("Could not create client.");
      return;
    }
    const party = await res.json();
    setClientList((list) => [...list, party].sort((a, b) => a.name.localeCompare(b.name)));
    setClientId(party.id);
    setAddingClient(false);
    setNewClientName("");
    setNewClientGstin("");
  }

  function pickExistingCreator(i: number, partyId: string) {
    const party = creatorParties.find((p) => p.id === partyId);
    if (!party) {
      updateCreator(i, { partyId: null });
      return;
    }
    updateCreator(i, {
      partyId: party.id,
      name: party.name,
      address: party.address || "",
      email: party.email || "",
      phone: party.phone || "",
      pageHandle: party.pageHandle || "",
      gstNumber: party.gstin || "",
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId) {
      setError("Please select a client.");
      return;
    }
    if (lineItems.length === 0 || lineItems.some((li) => !li.description)) {
      setError("Every line item needs a description.");
      return;
    }
    if (emailOnSave && !emailOnSaveTo.trim() && !emailOnSaveSubject.trim()) {
      setError("Enter an email address, a subject, or both, or uncheck \"Email this invoice once it's saved\".");
      return;
    }
    setSaving(true);

    const payload = {
      clientId,
      date,
      poNumber,
      dueDate: dueDate || null,
      collaborationBrand,
      creators: creators.filter((c) => c.name.trim()),
      lineItems,
      gstAmount,
      reimbursements,
      termsAndConditions: terms,
      notes,
    };

    const url = isEdit ? `/api/invoices/${initial!.id}` : createUrl;
    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not save invoice.");
      return;
    }
    warnOnSyncFailure(data.syncResult, data.driveSyncResult);

    if (!isEdit && emailOnSave && (emailOnSaveTo.trim() || emailOnSaveSubject.trim())) {
      const emailRes = await fetch(`/api/invoices/${data.invoice.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailOnSaveTo.trim() || undefined, subject: emailOnSaveSubject.trim() || undefined }),
      });
      if (!emailRes.ok) {
        const emailData = await emailRes.json().catch(() => null);
        alert(
          `The invoice saved, but the email didn't send: ${emailData?.error || "unknown error"}\n\nYou can retry from the invoice's detail page.`
        );
      }
    }

    router.push(`${basePath}/${data.invoice.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-4xl pb-16">
      {error && <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Invoice details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="block relative" ref={clientPickerRef}>
            <label htmlFor="client-picker-input" className="block text-xs font-medium text-slate-600 mb-1">
              Client / Agency
            </label>
            <input
              id="client-picker-input"
              type="text"
              value={clientDropdownOpen ? clientQuery : selectedClientName}
              placeholder="Search clients…"
              onFocus={() => {
                setClientQuery("");
                setClientDropdownOpen(true);
              }}
              onChange={(e) => {
                setClientQuery(e.target.value);
                setClientDropdownOpen(true);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              required={!clientId}
            />
            {clientDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setClientId(c.id);
                      setClientDropdownOpen(false);
                      setClientQuery("");
                    }}
                    className={`block w-full text-left px-3 py-2 text-sm hover:bg-brand-light ${
                      c.id === clientId ? "bg-brand-light text-brand font-medium" : "text-slate-700"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-400">No matching clients.</div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAddingClient(true);
                    setClientDropdownOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-sm text-brand font-medium border-t border-slate-100 hover:bg-brand-light"
                >
                  + Add new client…
                </button>
              </div>
            )}
            {addingClient && (
              <div className="mt-2 border border-slate-200 rounded-md p-3 space-y-2 bg-slate-50">
                <input
                  autoFocus
                  placeholder="Client / agency name"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  placeholder="GSTIN (optional)"
                  value={newClientGstin}
                  onChange={(e) => setNewClientGstin(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                {newClientError && <p className="text-xs text-red-600">{newClientError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={createClient}
                    disabled={creatingClient}
                    className="rounded-md bg-brand text-white text-xs font-medium px-3 py-1.5 hover:bg-brand-dark disabled:opacity-60"
                  >
                    {creatingClient ? "Adding…" : "Add client"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingClient(false);
                      setNewClientError(null);
                    }}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {clientList.length === 0 && !addingClient && (
              <p className="text-xs text-amber-600 mt-1">No clients yet — add one above.</p>
            )}
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Collaboration brand</span>
            <input
              value={collaborationBrand}
              onChange={(e) => setCollaborationBrand(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Invoice date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              required
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              Due date <span className="text-slate-400">(auto: 1 month after invoice date)</span>
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                dueDateManuallySet.current = true;
                setDueDate(e.target.value);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              PO number <span className="text-slate-400">(client&apos;s purchase order, if any)</span>
            </span>
            <input
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="e.g. PO-4521"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
        </div>
      </section>

      {!isEdit && (
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-1">
            <input
              type="checkbox"
              checked={emailOnSave}
              onChange={(e) => setEmailOnSave(e.target.checked)}
            />
            Email this invoice once it&apos;s saved
          </label>
          {emailOnSave && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">
                  Send to <span className="text-slate-400">(not needed if Subject matches a thread)</span>
                </span>
                <input
                  type="email"
                  value={emailOnSaveTo}
                  onChange={(e) => {
                    emailToManuallySet.current = true;
                    setEmailOnSaveTo(e.target.value);
                  }}
                  placeholder="client@example.com"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">
                  Subject <span className="text-slate-400">(optional — match a thread instead of the address above)</span>
                </span>
                <input
                  value={emailOnSaveSubject}
                  onChange={(e) => setEmailOnSaveSubject(e.target.value)}
                  placeholder="Leave blank, or an existing thread's exact subject"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </label>
            </div>
          )}
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-800">
            Creator details <span className="text-slate-400 font-normal">(who this campaign involved)</span>
          </h2>
          <button
            type="button"
            onClick={() => setCreators((c) => [...c, { ...emptyCreator }])}
            className="text-xs text-brand font-medium hover:underline"
          >
            + Add creator
          </button>
        </div>
        {creators.length === 0 && (
          <p className="text-xs text-slate-400">No creators added. Add one if this invoice covers creator work you&apos;ll also need to pay out.</p>
        )}
        <div className="space-y-4">
          {creators.map((c, i) => (
            <div key={i} className="border border-slate-200 rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={c.partyId || ""}
                  onChange={(e) => pickExistingCreator(i, e.target.value)}
                  className="text-xs rounded-md border border-slate-300 px-2 py-1.5"
                >
                  <option value="">Pick existing creator…</option>
                  {creatorParties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setCreators((rows) => rows.filter((_, idx) => idx !== i))}
                  className="ml-auto text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  placeholder="Name"
                  value={c.name}
                  onChange={(e) => updateCreator(i, { name: e.target.value })}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  placeholder="Page handle"
                  value={c.pageHandle}
                  onChange={(e) => updateCreator(i, { pageHandle: e.target.value })}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  placeholder="GST number"
                  value={c.gstNumber}
                  onChange={(e) => updateCreator(i, { gstNumber: e.target.value })}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  placeholder="Live link 1"
                  value={c.link1}
                  onChange={(e) => updateCreator(i, { link1: e.target.value })}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  placeholder="Live link 2"
                  value={c.link2}
                  onChange={(e) => updateCreator(i, { link2: e.target.value })}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  placeholder="Amount owed to creator"
                  value={c.amount || ""}
                  onChange={(e) => updateCreator(i, { amount: parseFloat(e.target.value) || 0 })}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              {c.amount > 0 && !c.partyId && (
                <p className="text-xs text-amber-600">
                  Pick an existing creator (or add them under Creators first) to be able to
                  auto-generate a purchase bill for this amount later.
                </p>
              )}
            </div>
          ))}
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
              <th className="pb-2 w-[28%]">Description</th>
              <th className="pb-2 w-[20%]">Live link 1</th>
              <th className="pb-2 w-[20%]">Live link 2</th>
              <th className="pb-2 w-[10%]">Qty</th>
              <th className="pb-2 w-[14%] text-right">Amount</th>
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
                    value={li.link1}
                    onChange={(e) => updateLineItem(i, { link1: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="py-1.5 pr-1">
                  <input
                    value={li.link2}
                    onChange={(e) => updateLineItem(i, { link2: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Totals &amp; terms</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                GST amount <span className="font-normal text-slate-400">(auto-calculated at 18%, editable)</span>
              </span>
              <input
                type="number"
                value={gstAmount}
                onChange={(e) => {
                  gstManuallySet.current = true;
                  setGstAmount(parseFloat(e.target.value) || 0);
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {gstManuallySet.current && (
                <button
                  type="button"
                  onClick={() => {
                    gstManuallySet.current = false;
                    setGstAmount(Math.round(billAmount * GST_RATE * 100) / 100);
                  }}
                  className="text-xs text-brand hover:underline mt-1"
                >
                  Reset to auto (18%)
                </button>
              )}
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
              <span className="block text-xs font-medium text-slate-600 mb-1">Terms and conditions</span>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={3}
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
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create invoice & generate PDF"}
        </button>
      </div>
    </form>
  );
}
