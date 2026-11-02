import PageHeader from "@/components/PageHeader";
import EmployeeForm from "@/components/EmployeeForm";

export default function NewEmployeePage() {
  return (
    <div>
      <PageHeader title="Add employee" />
      <div className="px-8 pb-12">
        <EmployeeForm />
      </div>
    </div>
  );
}
