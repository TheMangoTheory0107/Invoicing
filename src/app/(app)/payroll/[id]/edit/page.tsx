import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmployeeForm from "@/components/EmployeeForm";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({ params }: { params: { id: string } }) {
  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${employee.name}`} />
      <div className="px-8 pb-12">
        <EmployeeForm employee={employee} />
      </div>
    </div>
  );
}
