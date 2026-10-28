"use client";

import { useState } from "react";
import type { Settings } from "@prisma/client";
import LogoUpload from "./logo-upload";

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      <input
        {...props}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
    </label>
  );
}

export default function SettingsForm({ settings }: { settings: Settings }) {
  const [form, setForm] = useState({
    companyName: settings.companyName,
    addressLine1: settings.addressLine1,
    addressLine2: settings.addressLine2,
    addressLine3: settings.addressLine3,
    sacCode: settings.sacCode,
    gstin: settings.gstin,
    pan: settings.pan,
    bankAccName: settings.bankAccName,
    bankName: settings.bankName,
    bankAccNo: settings.bankAccNo,
    ifsc: settings.ifsc,
    upiId: settings.upiId,
    termsAndConditions: settings.termsAndConditions,
    paymentTermsDays: settings.paymentTermsDays,
    purchasePaymentTermsDays: settings.purchasePaymentTermsDays,
    storagePath: settings.storagePath,
    brandColor: settings.brandColor,
    geminiApiKey: settings.geminiApiKey,
    geminiModel: settings.geminiModel,
    emailFromAddress: settings.emailFromAddress,
    emailAppPassword: settings.emailAppPassword,
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ ok: true } | { ok: false; error: string } | null>(
    null
  );
  const [threadTesting, setThreadTesting] = useState(false);
  const [threadTestResult, setThreadTestResult] = useState<{ ok: true } | { ok: false; error: string } | null>(
    null
  );

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onTestEmail() {
    setEmailTesting(true);
    setEmailTestResult(null);
    const res = await fetch("/api/settings/email/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromAddress: form.emailFromAddress, appPassword: form.emailAppPassword }),
    });
    const data = await res.json();
    setEmailTesting(false);
    setEmailTestResult(res.ok ? { ok: true } : { ok: false, error: data.error });
  }

  async function onTestThreadAccess() {
    setThreadTesting(true);
    setThreadTestResult(null);
    const res = await fetch("/api/settings/email/test-thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromAddress: form.emailFromAddress }),
    });
    const data = await res.json();
    setThreadTesting(false);
    setThreadTestResult(res.ok ? { ok: true } : { ok: false, error: data.error });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save settings.");
      return;
    }
    setSavedAt(Date.now());
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Company profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Company name"
            value={form.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            required
          />
          <Field label="SAC code" value={form.sacCode} onChange={(e) => set("sacCode", e.target.value)} />
          <Field
            label="Address line 1"
            value={form.addressLine1}
            onChange={(e) => set("addressLine1", e.target.value)}
          />
          <Field
            label="Address line 2"
            value={form.addressLine2}
            onChange={(e) => set("addressLine2", e.target.value)}
          />
          <Field
            label="Address line 3"
            value={form.addressLine3}
            onChange={(e) => set("addressLine3", e.target.value)}
          />
          <Field label="GSTIN" value={form.gstin} onChange={(e) => set("gstin", e.target.value)} />
          <Field label="PAN" value={form.pan} onChange={(e) => set("pan", e.target.value)} />
          <Field
            label="Sales & Commission payment terms (days)"
            type="number"
            min={0}
            value={form.paymentTermsDays}
            onChange={(e) => set("paymentTermsDays", parseInt(e.target.value) || 0)}
          />
          <Field
            label="Purchase bill payment terms (days)"
            type="number"
            min={0}
            value={form.purchasePaymentTermsDays}
            onChange={(e) => set("purchasePaymentTermsDays", parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">
          Bank details (shown on your Sales invoices, for clients to pay you)
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Account name"
            value={form.bankAccName}
            onChange={(e) => set("bankAccName", e.target.value)}
          />
          <Field label="Bank name" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
          <Field
            label="Account number"
            value={form.bankAccNo}
            onChange={(e) => set("bankAccNo", e.target.value)}
          />
          <Field label="IFSC" value={form.ifsc} onChange={(e) => set("ifsc", e.target.value)} />
          <Field label="UPI ID" value={form.upiId} onChange={(e) => set("upiId", e.target.value)} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Invoice defaults</h2>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            Default terms and conditions
          </span>
          <textarea
            value={form.termsAndConditions}
            onChange={(e) => set("termsAndConditions", e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Branding</h2>
        <p className="text-xs text-slate-500 mb-3">
          Controls the accent color and logo used on every invoice PDF.
        </p>
        <div className="grid grid-cols-2 gap-4 items-start">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Accent color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.brandColor}
                onChange={(e) => set("brandColor", e.target.value)}
                className="h-9 w-12 rounded border border-slate-300 cursor-pointer"
              />
              <input
                value={form.brandColor}
                onChange={(e) => set("brandColor", e.target.value)}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </label>
          <LogoUpload initialLogoPath={settings.logoPath} />
          <LogoUpload
            initialLogoPath={settings.signaturePath}
            label="Signature"
            apiPath="/api/settings/signature"
            emptyLabel="No signature"
          />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Purchase bill auto-read</h2>
        <p className="text-xs text-slate-500 mb-3">
          Paste a free Gemini API key (from{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            aistudio.google.com/apikey
          </a>
          ) to let the app read uploaded Purchase bill PDFs automatically and fill in the invoice
          number, creator, amount, and dates for you.
        </p>
        <Field
          label="Gemini API key"
          type="password"
          value={form.geminiApiKey}
          onChange={(e) => set("geminiApiKey", e.target.value)}
          placeholder="AIza…"
        />
        <div className="mt-3">
          <Field
            label="Gemini model"
            value={form.geminiModel}
            onChange={(e) => set("geminiModel", e.target.value)}
            placeholder="gemini-3.6-flash"
          />
          <p className="text-xs text-slate-500 mt-1">
            If Google retires this model, auto-read will start failing with an error naming the
            model. Find the current model name at{" "}
            <a
              href="https://ai.google.dev/gemini-api/docs/models"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              ai.google.dev/gemini-api/docs/models
            </a>{" "}
            and paste it here — no code change or redeploy needed.
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Email invoices</h2>
        <p className="text-xs text-slate-500 mb-3">
          Lets you send an invoice straight from the app, from your own Gmail/Workspace address.
          Turn on 2-Step Verification for that account, then create an{" "}
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            App Password
          </a>{" "}
          (choose app &quot;Mail&quot;) — paste that below, not your regular login password.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="From address"
            type="email"
            value={form.emailFromAddress}
            onChange={(e) => set("emailFromAddress", e.target.value)}
            placeholder="business@themangotheory.co"
          />
          <Field
            label="App password"
            type="password"
            value={form.emailAppPassword}
            onChange={(e) => set("emailAppPassword", e.target.value)}
            placeholder="16-character app password"
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onTestEmail}
            disabled={emailTesting || !form.emailFromAddress || !form.emailAppPassword}
            className="rounded-md border border-slate-300 text-sm font-medium px-4 py-2 hover:bg-slate-50 disabled:opacity-60"
          >
            {emailTesting ? "Testing…" : "Test connection"}
          </button>
          {emailTestResult && (
            <span className={`text-xs ${emailTestResult.ok ? "text-emerald-600" : "text-red-600"}`}>
              {emailTestResult.ok ? "Connected — ready to send." : emailTestResult.error}
            </span>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100">
          <h3 className="text-xs font-semibold text-slate-700 mb-1">
            Landing in an existing email thread <span className="text-slate-400 font-normal">(optional)</span>
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            When you type a Subject while sending an invoice, the app can search{" "}
            {form.emailFromAddress || "your mailbox"} for the most recent thread with that exact subject and
            reply into it directly — real threading, not just a guess. This reuses the same service account
            JSON already pasted above under Google Sheets &amp; Drive sync, extended with Gmail access:
          </p>
          <ol className="text-xs text-slate-500 list-decimal list-inside space-y-1 mb-3">
            <li>
              In{" "}
              <a
                href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Google Cloud Console
              </a>
              , enable the <strong>Gmail API</strong> on the same project as your service account.
            </li>
            <li>
              Open the service account JSON you pasted above and copy its <code>client_id</code> field (a long
              number).
            </li>
            <li>
              In your{" "}
              <a
                href="https://admin.google.com/ac/owl/domainwidedelegation"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Workspace Admin Console → Security → API controls → Domain-wide delegation
              </a>
              , add that client ID with these two OAuth scopes:
              <code className="block bg-slate-50 rounded px-2 py-1 mt-1 break-all">
                https://www.googleapis.com/auth/gmail.readonly, https://www.googleapis.com/auth/gmail.send
              </code>
            </li>
          </ol>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onTestThreadAccess}
              disabled={threadTesting || !form.emailFromAddress}
              className="rounded-md border border-slate-300 text-sm font-medium px-4 py-2 hover:bg-slate-50 disabled:opacity-60"
            >
              {threadTesting ? "Testing…" : "Test thread search access"}
            </button>
            {threadTestResult && (
              <span className={`text-xs ${threadTestResult.ok ? "text-emerald-600" : "text-red-600"}`}>
                {threadTestResult.ok ? "Access confirmed — thread-matching is ready." : threadTestResult.error}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Not set up yet, or this test fails? No problem — leaving Subject blank (or if the search fails)
            always falls back to a normal new email via the App Password above.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {savedAt && <span className="text-xs text-emerald-600">Saved.</span>}
      </div>
    </form>
  );
}
