"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_GROUPS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "",
    items: [{ href: "/", label: "Dashboard" }],
  },
  {
    label: "Invoices",
    items: [
      { href: "/invoices/sales", label: "Sales Invoices" },
      { href: "/invoices/commission", label: "Commission Invoices" },
      { href: "/invoices/purchase", label: "Purchase Bills" },
    ],
  },
  {
    label: "Records",
    items: [
      { href: "/registers/sales", label: "Sales Register" },
      { href: "/registers/commission", label: "Commission Register" },
      { href: "/registers/purchase", label: "Purchase Register" },
      { href: "/payments", label: "Payments" },
      { href: "/reconciliation", label: "Reconciliation" },
      { href: "/ledger", label: "Ledgers" },
      { href: "/bank-import", label: "Bank Import" },
      { href: "/gst-filing", label: "GST Filing" },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/parties/clients", label: "Clients / Agencies" },
      { href: "/parties/creators", label: "Creators" },
      { href: "/import", label: "Import Data" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className="w-64 shrink-0 text-white flex flex-col min-h-screen"
      style={{ background: "linear-gradient(180deg, var(--brand) 0%, var(--brand-dark) 100%)" }}
    >
      <div className="px-5 py-6 border-b border-white/10">
        <div className="text-lg font-bold leading-tight tracking-tight">THE MANGO THEORY</div>
        <div className="text-xs text-white/55 mt-0.5">Invoicing</div>
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-4" : ""}>
            {group.label && (
              <div className="px-5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block mx-2 px-3.5 py-2 rounded-md text-sm transition-colors ${
                      active
                        ? "bg-white/15 font-medium text-white"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <button
        onClick={logout}
        className="m-4 rounded-md border border-white/20 px-3 py-2 text-xs text-white/75 hover:bg-white/10 hover:text-white transition-colors"
      >
        Log out
      </button>
    </aside>
  );
}
