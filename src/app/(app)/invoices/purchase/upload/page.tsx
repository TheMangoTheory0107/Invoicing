import PageHeader from "@/components/PageHeader";
import PurchaseBulkUpload from "@/components/PurchaseBulkUpload";

export default function PurchaseBulkUploadPage() {
  return (
    <div>
      <PageHeader
        title="Upload purchase bills"
        subtitle="Drop vendor PDFs — each one is read and saved as a bill automatically"
      />
      <div className="px-8 pb-12">
        <PurchaseBulkUpload />
      </div>
    </div>
  );
}
