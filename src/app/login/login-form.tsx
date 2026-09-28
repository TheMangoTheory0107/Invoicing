"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm({ mode }: { mode: "login" | "setup" }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "setup" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode === "setup" ? "setup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }
      router.push(params.get("next") || "/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "setup" && (
        <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          First-time setup: choose a password to protect this app. Keep it safe — there is
          no self-service recovery.
        </p>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {mode === "setup" ? "New password" : "Password"}
        </label>
        <input
          type="password"
          required
          minLength={mode === "setup" ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#134F5C]"
          autoFocus
        />
      </div>
      {mode === "setup" && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Confirm password
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#134F5C]"
          />
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-[#134F5C] text-white text-sm font-medium py-2 hover:bg-[#0e3a44] disabled:opacity-60"
      >
        {loading ? "Please wait…" : mode === "setup" ? "Create account & continue" : "Log in"}
      </button>
    </form>
  );
}
