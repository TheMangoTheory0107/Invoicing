"use client";

import { useState } from "react";

export default function PayeeConfirmClient({
  partyId,
  token,
  name,
  alreadyDone,
}: {
  partyId: string;
  token: string;
  name: string;
  alreadyDone: boolean;
}) {
  const [done, setDone] = useState(alreadyDone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/payee/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partyId, token }),
    });
    setLoading(false);
    if (res.ok) {
      setDone(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not mark this as done.");
    }
  }

  if (done) {
    return <p className="text-sm text-emerald-700">✓ {name} is marked as added — no more reminders for them.</p>;
  }

  return (
    <div>
      <p className="text-sm text-slate-600 mb-4">
        Have you added <strong>{name}</strong> as a payee in your bank?
      </p>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <button
        onClick={onConfirm}
        disabled={loading}
        className="w-full rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Marking…" : `Yes, mark ${name} as added`}
      </button>
    </div>
  );
}
