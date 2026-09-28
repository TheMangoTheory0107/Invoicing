import Sidebar from "@/components/Sidebar";
import { prisma } from "@/lib/prisma";
import { darken, lighten, safeHex } from "@/lib/color";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const brand = safeHex(settings?.brandColor, "#134f5c");

  return (
    <>
      <style>{`:root { --brand: ${brand}; --brand-dark: ${darken(brand, 0.25)}; --brand-light: ${lighten(brand, 0.88)}; }`}</style>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </>
  );
}
