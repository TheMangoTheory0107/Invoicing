import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import EmployeeDetail from "@/components/EmployeeDetail";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: { payments: { orderBy: { date: "desc" } } },
  });
  if (!employee) notFound();

  return (
    <div>
      <PageHeader title={employee.name} subtitle="Payroll" />
      <div className="px-8 pb-12">
        <EmployeeDetail
          data={{
            id: employee.id,
            name: employee.name,
            monthlySalary: toNumber(employee.monthlySalary),
            email: employee.email,
            phone: employee.phone,
            active: employee.active,
            payments: employee.payments.map((p) => ({
              id: p.id,
              date: p.date.toISOString(),
              amount: toNumber(p.amount),
              method: p.method,
              reference: p.reference,
            })),
          }}
        />
      </div>
    </div>
  );
}
