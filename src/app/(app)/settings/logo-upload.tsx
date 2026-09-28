"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoUpload({
  initialLogoPath,
  label = "Logo",
  apiPath = "/api/settings/logo",
  emptyLabel = "No logo",
}: {
  initialLogoPath: string | null;
  label?: string;
  apiPath?: string;
  emptyLabel?: string;
}) {
  const router = useRouter();
  const [hasImage, setHasImage] = useState(!!initialLogoPath);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState(0);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(apiPath, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not upload image.");
      return;
    }
    setHasImage(true);
    setCacheBust((n) => n + 1);
    router.refresh();
  }

  async function onRemove() {
    setUploading(true);
    await fetch(apiPath, { method: "DELETE" });
    setUploading(false);
    setHasImage(false);
    router.refresh();
  }

  return (
    <div>
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      <div className="flex items-center gap-3">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${apiPath}?v=${cacheBust}`}
            alt={label}
            className="h-12 max-w-[140px] object-contain border border-slate-200 rounded bg-white p-1"
          />
        ) : (
          <div className="h-12 w-24 rounded border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
            {emptyLabel}
          </div>
        )}
        <div className="space-y-1">
          <label className="inline-block rounded-md border border-slate-300 text-xs font-medium px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
            {uploading ? "Uploading…" : hasImage ? "Replace" : "Upload"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={onFileChange}
              disabled={uploading}
              className="hidden"
            />
          </label>
          {hasImage && (
            <button
              type="button"
              onClick={onRemove}
              disabled={uploading}
              className="block text-xs text-red-500 hover:underline"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <p className="text-xs text-slate-400 mt-1">PNG, JPG, or SVG, up to 2MB.</p>
    </div>
  );
}
