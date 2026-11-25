"use client";

import { useState } from "react";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not change password.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess(true);
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
      <h2 className="text-sm font-semibold text-slate-800">Change password</h2>
      <div className="grid grid-cols-1 gap-3 max-w-sm">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Current password</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">New password</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Confirm new password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
      </div>
      {error && <div className="rounded-md bg-red-50 text-red-700 px-3 py-2 text-sm max-w-sm">{error}</div>}
      {success && (
        <div className="rounded-md bg-emerald-50 text-emerald-700 px-3 py-2 text-sm max-w-sm">
          Password changed.
        </div>
      )}
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark disabled:opacity-60"
      >
        {saving ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
