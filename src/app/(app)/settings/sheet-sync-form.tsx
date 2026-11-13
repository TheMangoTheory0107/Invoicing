"use client";

import { useRef, useState } from "react";
import type { SheetSyncConfig } from "@prisma/client";

export default function SheetSyncForm({ config }: { config: SheetSyncConfig }) {
  const [form, setForm] = useState({
    spreadsheetId: config.spreadsheetId,
    salesSheetName: config.salesSheetName,
    purchaseSheetName: config.purchaseSheetName,
    commissionSheetName: config.commissionSheetName,
    serviceAccountJson: config.serviceAccountJson,
    enabled: config.enabled,
    driveFolderId: config.driveFolderId,
    formResponsesSpreadsheetId: config.formResponsesSpreadsheetId,
    formResponsesSheetName: config.formResponsesSheetName,
    formResponsesImpersonate: config.formResponsesImpersonate,
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<
    { ok: true; title: string; sheetNames: string[]; email: string } | { ok: false; error: string } | null
  >(null);
  const [testing, setTesting] = useState(false);
  const [driveTestResult, setDriveTestResult] = useState<
    { ok: true; name: string; email: string } | { ok: false; error: string } | null
  >(null);
  const [driveTesting, setDriveTesting] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<
    | {
        ok: true;
        matched: number;
        invoicesMatched: number;
        invoicesChecked: number;
        invoicesWithLinks: number;
        tabsScanned?: string[];
        sampleSheetLinks?: string[];
        sampleInvoiceLinks?: string[];
      }
    | { ok: false; error: string }
    | null
  >(null);
  const [formSyncing, setFormSyncing] = useState(false);
  const [formSyncLooping, setFormSyncLooping] = useState(false);
  const formSyncStopRef = useRef(false);
  const [formSyncResult, setFormSyncResult] = useState<
    | { ok: true; checked: number; created: number; matchedExisting: number; flagged: number; errors: string[]; rounds?: number }
    | { ok: false; error: string }
    | null
  >(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/settings/sheets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) setSavedAt(Date.now());
  }

  async function onTest() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/settings/sheets/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spreadsheetId: form.spreadsheetId,
        serviceAccountJson: form.serviceAccountJson,
      }),
    });
    const data = await res.json();
    setTesting(false);
    if (res.ok) {
      setTestResult({ ok: true, title: data.title, sheetNames: data.sheetNames, email: data.serviceAccountEmail });
    } else {
      setTestResult({ ok: false, error: data.error });
    }
  }

  async function onTestDrive() {
    setDriveTesting(true);
    setDriveTestResult(null);
    const res = await fetch("/api/settings/drive/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folderId: form.driveFolderId,
        serviceAccountJson: form.serviceAccountJson,
      }),
    });
    const data = await res.json();
    setDriveTesting(false);
    if (res.ok) {
      setDriveTestResult({ ok: true, name: data.name, email: data.serviceAccountEmail });
    } else {
      setDriveTestResult({ ok: false, error: data.error });
    }
  }

  async function onBackfill() {
    if (
      !confirm(
        "This scans every monthly tab from April 2026 onward for Link matches against every existing Sales/Commission invoice, and writes Bill No + that line item's amount wherever it finds one. Matching cells get highlighted yellow. Safe to re-run, but it does write to the live sheet now — continue?"
      )
    ) {
      return;
    }
    setBackfilling(true);
    setBackfillResult(null);
    const res = await fetch("/api/settings/sheets/backfill-links", { method: "POST" });
    const data = await res.json();
    setBackfilling(false);
    setBackfillResult(res.ok ? { ok: true, ...data } : { ok: false, error: data.error || "Could not run the backfill." });
  }

  type SyncRoundResult =
    | { kind: "ok"; checked: number; created: number; matchedExisting: number; flagged: number; errors: string[]; remaining: number }
    | { kind: "not-configured" }
    | { kind: "timeout" }
    | { kind: "error"; error: string };

  // One call to the sync endpoint — saves whatever's currently in the fields first, so a check
  // always reflects what's on screen rather than whatever was last saved.
  async function runSyncRound(): Promise<SyncRoundResult> {
    const saveRes = await fetch("/api/settings/sheets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!saveRes.ok) return { kind: "error", error: "Could not save these fields — fix any errors above and try again." };
    setSavedAt(Date.now());
    const res = await fetch("/api/settings/sheets/form-sync", { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!data) return { kind: "timeout" };
    if (res.ok && data.attempted === false) return { kind: "not-configured" };
    if (!res.ok || data.ok === false) return { kind: "error", error: data.error || data.errors?.[0] || "Could not run the sync." };
    return {
      kind: "ok",
      checked: data.checked,
      created: data.created,
      matchedExisting: data.matchedExisting,
      flagged: data.flagged,
      errors: data.errors || [],
      remaining: data.remaining ?? 0,
    };
  }

  function describeRoundFailure(result: Extract<SyncRoundResult, { kind: "not-configured" | "timeout" | "error" }>): string {
    if (result.kind === "timeout") {
      return "The check didn't finish in time (a bill can be slow to read) — your settings are saved, just try again to pick up where it left off.";
    }
    if (result.kind === "not-configured") {
      return "Nothing to check — fill in the Spreadsheet ID, Tab name, and impersonate mailbox above (and the service account JSON further up this page), then try again.";
    }
    return result.error;
  }

  // A single on-demand check — same as waiting for the once-a-day automatic run.
  async function onFormSync() {
    setFormSyncing(true);
    setFormSyncResult(null);
    try {
      const result = await runSyncRound();
      setFormSyncResult(result.kind === "ok" ? { ok: true, ...result } : { ok: false, error: describeRoundFailure(result) });
    } catch {
      setFormSyncResult({ ok: false, error: "Could not reach the server — check your connection and try again." });
    } finally {
      setFormSyncing(false);
    }
  }

  // Repeats the check automatically to clear a backlog of old submissions — each round only
  // auto-creates one brand-new bill (to stay well under the server's time limit), so catching up
  // on many old rows would otherwise mean clicking "Check now" over and over by hand. Stops once
  // the server says nothing is left genuinely pending (every row is either resolved or flagged
  // with a reason) — not just because one particular round happened to flag something instead of
  // creating something, which still leaves later rows untouched. Can also be stopped early.
  async function onFormSyncAll() {
    setFormSyncLooping(true);
    formSyncStopRef.current = false;
    setFormSyncResult(null);
    const totals = { checked: 0, created: 0, matchedExisting: 0, flagged: 0, errors: [] as string[] };
    let rounds = 0;
    try {
      while (rounds < 200 && !formSyncStopRef.current) {
        rounds++;
        let result: SyncRoundResult;
        try {
          result = await runSyncRound();
        } catch {
          setFormSyncResult({ ok: false, error: "Could not reach the server — check your connection and try again." });
          return;
        }
        if (result.kind !== "ok") {
          setFormSyncResult({ ok: false, error: describeRoundFailure(result) });
          return;
        }
        totals.checked = result.checked;
        totals.created += result.created;
        totals.matchedExisting += result.matchedExisting;
        totals.flagged += result.flagged;
        totals.errors.push(...result.errors);
        setFormSyncResult({ ok: true, ...totals, rounds });
        if (result.remaining <= 0) break;
      }
    } finally {
      setFormSyncLooping(false);
    }
  }

  return (
    <form onSubmit={onSave} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Google Sheets &amp; Drive sync</h2>
        <p className="text-xs text-slate-500 mt-1">
          Push register rows to a Google Sheet, and file every generated invoice PDF into a
          Google Drive folder — both use the same service account JSON key below (from Google
          Cloud Console). Share the Sheet with that service account&apos;s email as an Editor to
          turn Sheets sync on; leave it blank to skip it.
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2">
          The Drive folder must be inside a <strong>Shared Drive</strong> (Workspace only), not a
          regular My Drive folder — Google no longer gives service accounts their own storage, so
          uploads to an ordinary shared folder always fail. Create a Shared Drive, add the service
          account&apos;s email as a member (Content Manager or higher), then use a folder ID from
          inside that Shared Drive below.
        </p>
      </div>

      <label className="block">
        <span className="block text-xs font-medium text-slate-600 mb-1">Spreadsheet ID</span>
        <input
          value={form.spreadsheetId}
          onChange={(e) => set("spreadsheetId", e.target.value)}
          placeholder="the long ID from the sheet's URL"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </label>

      <div className="grid grid-cols-3 gap-4">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Sales Register tab name</span>
          <input
            value={form.salesSheetName}
            onChange={(e) => set("salesSheetName", e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Commission Register tab name</span>
          <input
            value={form.commissionSheetName}
            onChange={(e) => set("commissionSheetName", e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Purchase Register tab name</span>
          <input
            value={form.purchaseSheetName}
            onChange={(e) => set("purchaseSheetName", e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-xs font-medium text-slate-600 mb-1">
          Service account JSON key
        </span>
        <textarea
          value={form.serviceAccountJson}
          onChange={(e) => set("serviceAccountJson", e.target.value)}
          placeholder='Paste the full contents of the downloaded key file, e.g. {"type": "service_account", ...}'
          rows={4}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </label>

      <label className="block">
        <span className="block text-xs font-medium text-slate-600 mb-1">
          Drive folder ID <span className="font-normal text-slate-400">(optional — files every invoice PDF automatically)</span>
        </span>
        <input
          value={form.driveFolderId}
          onChange={(e) => set("driveFolderId", e.target.value)}
          placeholder="the long ID from the folder's URL"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <p className="text-xs text-slate-400 mt-1">
          PDFs are saved as {"{folder}"}/Sales Invoices|Commission Invoices|Purchase Bills/{"{FY}"}/{"{invoice number}"} - {"{party}"}.pdf
        </p>
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => set("enabled", e.target.checked)}
        />
        Enable automatic Sheets sync on invoice save / payment
      </label>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onTest}
          disabled={testing || !form.spreadsheetId || !form.serviceAccountJson}
          className="rounded-md border border-slate-300 text-sm font-medium px-4 py-2 hover:bg-slate-50 disabled:opacity-60"
        >
          {testing ? "Testing…" : "Test Sheet connection"}
        </button>
        <button
          type="button"
          onClick={onTestDrive}
          disabled={driveTesting || !form.driveFolderId || !form.serviceAccountJson}
          className="rounded-md border border-slate-300 text-sm font-medium px-4 py-2 hover:bg-slate-50 disabled:opacity-60"
        >
          {driveTesting ? "Testing…" : "Test Drive folder"}
        </button>
        {savedAt && <span className="text-xs text-emerald-600">Saved.</span>}
      </div>

      {testResult && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            testResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {testResult.ok ? (
            <>
              Connected to <strong>{testResult.title}</strong>. Tabs found:{" "}
              {testResult.sheetNames.join(", ") || "none"}.
              <div className="text-xs text-emerald-600 mt-1">
                Service account: {testResult.email} — make sure this has Editor access.
              </div>
            </>
          ) : (
            testResult.error
          )}
        </div>
      )}

      {driveTestResult && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            driveTestResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {driveTestResult.ok ? (
            <>
              Connected to folder <strong>{driveTestResult.name}</strong>.
              <div className="text-xs text-emerald-600 mt-1">
                Service account: {driveTestResult.email} — make sure this has Editor access.
              </div>
            </>
          ) : (
            driveTestResult.error
          )}
        </div>
      )}

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-800">Monthly sheet Bill No sync</h3>
        <p className="text-xs text-slate-500 mt-1">
          Every Sales/Commission invoice you save now also scans your monthly tracking tabs
          named like a month and year (e.g. Apr&apos;26, May&apos;26) for rows whose{" "}
          <strong>Link</strong> matches one of the invoice&apos;s line items, and writes that
          invoice&apos;s number — plus that line item&apos;s own amount, not the invoice total —
          into the row&apos;s <strong>Bill No</strong> column, highlighted yellow. Only tabs from
          April 2026 onward are scanned. A tab missing a Link or Bill No column is skipped
          automatically (your team reshuffles those column sets most months).
        </p>
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={onBackfill}
            disabled={backfilling || !form.spreadsheetId || !form.serviceAccountJson}
            className="rounded-md border border-slate-300 text-sm font-medium px-4 py-2 hover:bg-slate-50 disabled:opacity-60"
          >
            {backfilling ? "Running…" : "Backfill already-raised invoices"}
          </button>
          <span className="text-xs text-slate-400">
            One-time catch-up for invoices created before this was added. Safe to re-run.
          </span>
        </div>
        {backfillResult && (
          <div
            className={`rounded-md px-3 py-2 text-sm mt-2 ${
              backfillResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {backfillResult.ok ? (
              <>
                Checked {backfillResult.invoicesChecked} invoices ({backfillResult.invoicesWithLinks} had links).
                Matched {backfillResult.invoicesMatched} invoice(s), writing {backfillResult.matched} cell(s).
                {backfillResult.matched === 0 && backfillResult.tabsScanned && (
                  <div className="mt-2 text-xs text-emerald-800 space-y-1">
                    <div>Tabs scanned: {backfillResult.tabsScanned.join(", ") || "(none qualified)"}</div>
                    <div>Example links from the sheet: {backfillResult.sampleSheetLinks?.join(" | ") || "(none found)"}</div>
                    <div>Example links from your invoices: {backfillResult.sampleInvoiceLinks?.join(" | ") || "(none found)"}</div>
                  </div>
                )}
              </>
            ) : (
              backfillResult.error
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-800">Creator bill-submission form → auto Purchase bill</h3>
        <p className="text-xs text-slate-500 mt-1">
          Reads your Google Form&apos;s responses sheet (a different spreadsheet from the
          register one above) — every row, every time, including old submissions from before
          this was set up. For each response with an &quot;Invoice Copy&quot; attachment: if it
          matches a Purchase bill already in the app (by creator name, invoice number, and
          amount — so a renamed or re-saved file still matches), the row is just marked green;
          otherwise the attached bill is downloaded and read the same way the manual Purchase
          bill upload works, a bill is auto-created, and the row is marked green. A row that
          can&apos;t be processed is marked light red, with the reason written into column O of
          that row — clear that cell by hand to ask for a retry, otherwise it&apos;s left alone
          on later runs so one bad row can&apos;t block the ones after it. Runs automatically
          once a day, plus on demand below.
        </p>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Form responses spreadsheet ID</span>
            <input
              value={form.formResponsesSpreadsheetId}
              onChange={(e) => set("formResponsesSpreadsheetId", e.target.value)}
              placeholder="the long ID from that sheet's URL"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Tab name</span>
            <input
              value={form.formResponsesSheetName}
              onChange={(e) => set("formResponsesSheetName", e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
        </div>
        <label className="block mt-4">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            Mailbox to impersonate for reading attachments
          </span>
          <input
            value={form.formResponsesImpersonate}
            onChange={(e) => set("formResponsesImpersonate", e.target.value)}
            placeholder="business@themangotheory.co"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <p className="text-xs text-slate-400 mt-1">
            Needs domain-wide delegation for this service account to include the{" "}
            <code className="bg-slate-100 px-1 rounded">drive.readonly</code> scope (Workspace
            Admin Console → Security → API Controls → Domain-wide Delegation), alongside the
            Gmail scopes already granted there.
          </p>
        </label>
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={onFormSync}
            disabled={formSyncing || formSyncLooping || !form.formResponsesSpreadsheetId || !form.formResponsesImpersonate}
            className="rounded-md border border-slate-300 text-sm font-medium px-4 py-2 hover:bg-slate-50 disabled:opacity-60"
          >
            {formSyncing ? "Checking…" : "Check now"}
          </button>
          {formSyncLooping ? (
            <button
              type="button"
              onClick={() => {
                formSyncStopRef.current = true;
              }}
              className="rounded-md border border-slate-300 text-sm font-medium px-4 py-2 hover:bg-slate-50"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onFormSyncAll}
              disabled={formSyncing || !form.formResponsesSpreadsheetId || !form.formResponsesImpersonate}
              className="rounded-md border border-slate-300 text-sm font-medium px-4 py-2 hover:bg-slate-50 disabled:opacity-60"
            >
              Process entire backlog
            </button>
          )}
          <span className="text-xs text-slate-400">
            Checks every row, every time — old submissions included, no manual upload needed.
          </span>
        </div>
        {formSyncResult && (
          <div
            className={`rounded-md px-3 py-2 text-sm mt-2 ${
              formSyncResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {formSyncResult.ok ? (
              <>
                {formSyncLooping && "Still going… "}
                {formSyncResult.rounds && formSyncResult.rounds > 1 ? `Over ${formSyncResult.rounds} rounds — ` : ""}
                Checked {formSyncResult.checked} row(s) — created {formSyncResult.created}, matched{" "}
                {formSyncResult.matchedExisting} already-existing, flagged {formSyncResult.flagged} for review.
                {formSyncResult.errors.length > 0 && (
                  <ul className="list-disc list-inside mt-1">
                    {formSyncResult.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              formSyncResult.error
            )}
          </div>
        )}
      </div>
    </form>
  );
}
