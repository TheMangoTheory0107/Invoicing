import PageHeader from "@/components/PageHeader";
import { getCategories } from "@/lib/personal/categories";
import { getSettings } from "@/lib/settings";
import ImportClient from "./import-client";

export const dynamic = "force-dynamic";

export default async function PersonalImportPage() {
  const [categories, settings] = await Promise.all([getCategories(), getSettings()]);
  return (
    <div>
      <PageHeader
        title="Import bank statement"
        subtitle="Upload a PDF or Excel statement — Gemini reads it, labels what it can, and asks you about the rest"
      />
      <div className="px-8 py-6 max-w-6xl">
        {!settings.geminiApiKey && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 max-w-2xl">
            No Gemini API key yet — add a free one in <a href="/settings" className="underline">Settings</a> to read PDF statements and get
            smarter labels. Excel/CSV exports still work without it.
          </div>
        )}
        <ImportClient categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, bucket: c.bucket }))} />
      </div>
    </div>
  );
}
