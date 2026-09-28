import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await prisma.user.findUnique({ where: { id: 1 } });

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold text-[#134F5C]">THE MANGO THEORY</div>
          <div className="text-sm text-slate-500 mt-1">Invoicing</div>
        </div>
        <Suspense fallback={null}>
          <LoginForm mode={user ? "login" : "setup"} />
        </Suspense>
      </div>
    </div>
  );
}
