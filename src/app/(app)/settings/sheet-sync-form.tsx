"use client";

import { useState } from "react";
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
    </form>
  );
}
