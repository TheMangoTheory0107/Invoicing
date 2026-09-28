import { getSettings } from "@/lib/settings";
import PageHeader from "@/components/PageHeader";
import SettingsForm from "./settings-form";
import SheetSyncForm from "./sheet-sync-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  const sheetConfig = await prisma.sheetSyncConfig.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Company profile, bank details and invoice defaults used on every PDF"
      />
      <div className="px-8 pb-12 max-w-3xl space-y-8">
        <SettingsForm settings={settings} />
        <SheetSyncForm config={sheetConfig} />
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-2">
          <h2 className="text-sm font-semibold text-slate-800">Backup</h2>
          <p className="text-xs text-slate-500">
            Download every client, creator, invoice, and payment as one Excel file — an offline
            copy you control, independent of the hosting database.
          </p>
          <a
            href="/api/backup/export"
            className="inline-block rounded-md border border-slate-300 text-sm font-medium px-4 py-2 hover:bg-slate-50"
          >
            Download full backup (.xlsx)
          </a>
        </div>
      </div>
    </div>
  );
}
