import { formatINR } from "@/lib/format";
import { formatDateDMY } from "@/lib/fy";

export function buildInvoiceEmailHtml(params: {
  companyName: string;
  brandColor: string;
  clientName: string;
  invoiceLabel: string; // "Invoice" | "Commission Invoice"
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date | null;
  totalAmount: number;
  balance: number;
  note?: string;
}): string {
  const { companyName, brandColor, clientName, invoiceLabel, invoiceNumber, invoiceDate, dueDate, totalAmount, balance, note } =
    params;

  return `
<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background:#f4f7f7; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px; margin:0 auto; padding:32px 16px;">
      <div style="background:${brandColor}; border-radius:10px 10px 0 0; padding:20px 28px;">
        <p style="margin:0; color:#ffffff; font-size:16px; font-weight:700; letter-spacing:0.02em;">${companyName}</p>
      </div>
      <div style="background:#ffffff; border-radius:0 0 10px 10px; padding:28px; border:1px solid #e2e8f0; border-top:none;">
        <p style="margin:0 0 16px; color:#0f172a; font-size:15px;">Hi ${clientName || "there"},</p>
        <p style="margin:0 0 20px; color:#334155; font-size:14px; line-height:1.6;">
          Please find attached ${invoiceLabel.toLowerCase()} <strong>${invoiceNumber}</strong> from ${companyName}.
          ${note ? `<br /><br />${note}` : ""}
        </p>
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
          <tr>
            <td style="padding:8px 0; color:#64748b; font-size:13px;">${invoiceLabel} number</td>
            <td style="padding:8px 0; color:#0f172a; font-size:13px; text-align:right; font-weight:600;">${invoiceNumber}</td>
          </tr>
          <tr style="border-top:1px solid #e2e8f0;">
            <td style="padding:8px 0; color:#64748b; font-size:13px;">Date</td>
            <td style="padding:8px 0; color:#0f172a; font-size:13px; text-align:right;">${formatDateDMY(invoiceDate)}</td>
          </tr>
          ${
            dueDate
              ? `<tr style="border-top:1px solid #e2e8f0;">
            <td style="padding:8px 0; color:#64748b; font-size:13px;">Due date</td>
            <td style="padding:8px 0; color:#0f172a; font-size:13px; text-align:right;">${formatDateDMY(dueDate)}</td>
          </tr>`
              : ""
          }
          <tr style="border-top:1px solid #e2e8f0;">
            <td style="padding:8px 0; color:#64748b; font-size:13px;">Total amount</td>
            <td style="padding:8px 0; color:#0f172a; font-size:13px; text-align:right; font-weight:600;">${formatINR(totalAmount)}</td>
          </tr>
          <tr style="border-top:1px solid #e2e8f0;">
            <td style="padding:8px 0; color:#64748b; font-size:13px;">Balance due</td>
            <td style="padding:8px 0; color:${balance > 0.01 ? "#b45309" : "#0f7a5c"}; font-size:13px; text-align:right; font-weight:700;">
              ${formatINR(balance)}
            </td>
          </tr>
        </table>
        <p style="margin:0; color:#94a3b8; font-size:12px;">This is an automated email from ${companyName}'s invoicing system.</p>
      </div>
    </div>
  </body>
</html>`;
}
