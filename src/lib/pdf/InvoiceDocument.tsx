import { Document, Page, View, Text, Image, Link, StyleSheet } from "@react-pdf/renderer";
import { formatDateDMY, formatDateTimeIST } from "@/lib/fy";

const TEXT = "#000000";
const LIGHT_GREY = "#F3F3F3";

// Built per-render from the company's brand color, so a customized accent color flows through
// every element that used to be hardcoded teal.
function getStyles(accent: string) {
  return StyleSheet.create({
    page: {
      paddingTop: 0,
      paddingHorizontal: 32,
      paddingBottom: 26,
      fontSize: 9.2,
      fontFamily: "Helvetica",
      color: TEXT,
    },
    topBanner: { height: 9, backgroundColor: accent, marginHorizontal: -32, marginBottom: 20 },
    bottomBanner: { position: "absolute", bottom: 0, left: 0, right: 0, height: 9, backgroundColor: accent },
    row: { flexDirection: "row", justifyContent: "space-between" },
    headerLeft: { width: "55%", flexDirection: "column", alignItems: "flex-start", gap: 7 },
    logo: { width: 104, height: 104, objectFit: "contain", marginBottom: 2 },
    companyName: { fontSize: 20, fontWeight: 700, color: accent, marginBottom: 3 },
    addressLine: { fontSize: 9, color: TEXT, marginBottom: 1 },
    bold: { fontWeight: 700 },
    sectionTitle: {
      fontSize: 9,
      fontWeight: 700,
      color: accent,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 5,
      marginTop: 9,
    },
    metaBox: {
      alignSelf: "flex-start",
    },
    metaLabel: { fontSize: 8, fontWeight: 700, color: "#666", textAlign: "right", textTransform: "uppercase", letterSpacing: 0.4 },
    metaValue: { fontSize: 9.5, fontWeight: 700, textAlign: "right", marginBottom: 5, color: TEXT },
    partyBlock: { fontSize: 9.2, lineHeight: 1.4 },
    table: { marginTop: 6, borderTopWidth: 1, borderTopColor: accent, borderBottomWidth: 1, borderBottomColor: accent },
    tableHeaderRow: { flexDirection: "row", paddingVertical: 3.5 },
    tableHeaderCell: { fontSize: 8, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4 },
    tableRow: { flexDirection: "row", paddingVertical: 3.5, alignItems: "center" },
    tableCell: { fontSize: 8.6 },
    tableCellBold: { fontSize: 8.6, fontWeight: 700 },
    colDescription: { width: "50%", paddingRight: 8 },
    colLink: { width: "11%" },
    colQty: { width: "8%", textAlign: "right" },
    colAmount: { width: "20%", textAlign: "right" },
    linkText: { fontSize: 8.2, color: accent },
    summaryRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
    termsCol: { width: "48%" },
    rightCol: { width: "46%" },
    totalsBlock: {
      backgroundColor: LIGHT_GREY,
      borderRadius: 4,
      borderWidth: 0.75,
      borderColor: "#e0e0e0",
      padding: 11,
    },
    totalsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 2.5,
      borderBottomWidth: 0.5,
      borderBottomColor: "#ddd",
    },
    totalsLabel: { fontSize: 9, color: TEXT },
    totalsValue: { fontSize: 9, fontWeight: 700 },
    grandTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
      paddingTop: 6,
      borderTopWidth: 1.5,
      borderTopColor: accent,
      marginTop: 2,
    },
    grandTotalLabel: { fontSize: 11.5, fontWeight: 700, color: accent },
    grandTotalValue: { fontSize: 11.5, fontWeight: 700, color: accent },
    signatureBlock: { marginTop: 6, alignItems: "flex-end" },
    signatureFor: { fontSize: 9.2, fontWeight: 700, color: TEXT, marginBottom: 6 },
    signatureImageWrap: { position: "relative", width: 140, alignItems: "center" },
    signatureImage: { width: 120, height: 42, objectFit: "contain" },
    signatureTimestampOverlay: {
      position: "absolute",
      top: 17,
      fontSize: 5.5,
      color: "#00000090",
      width: 140,
      textAlign: "center",
    },
    signatureLabel: { fontSize: 9, color: TEXT, borderTopWidth: 1, borderTopColor: "#999", paddingTop: 3, marginTop: 4, width: 140, textAlign: "center" },
    signatureNote: { fontSize: 7.3, color: "#555", marginTop: 4 },
    footerLine: { fontSize: 8.3, marginBottom: 4, lineHeight: 1.25 },
    detailRow: { flexDirection: "row", marginBottom: 5 },
    detailLabel: { width: 64, fontSize: 9, fontWeight: 700, color: TEXT },
    detailValue: { fontSize: 9, color: TEXT },
    creatorRow: { fontSize: 8.5, marginBottom: 2 },
    creatorCaptionRow: {
      flexDirection: "row",
      paddingVertical: 5,
      paddingHorizontal: 2,
      borderBottomWidth: 0.5,
      borderBottomColor: "#ddd",
    },
    creatorCaptionLabel: { fontSize: 8, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, width: 58 },
  });
}

export interface InvoicePdfData {
  type: "SALES" | "PURCHASE" | "COMMISSION";
  number: string;
  date: string;
  billingDate1?: string | null;
  billingDate2?: string | null;
  collaborationBrand?: string | null;
  brandColor: string;
  logoPath?: string | null;
  signaturePath?: string | null;
  company: {
    name: string;
    addressLine1: string;
    addressLine2: string;
    addressLine3: string;
    sacCode: string;
    gstin: string;
  };
  // Bank details to show in the "Payment Details" block — the company's own for a Sales
  // invoice (client pays TheMangoTheory), or the creator's for a Purchase bill (TheMangoTheory
  // pays the creator).
  paymentDetails: {
    accName: string;
    bankName: string;
    accNo: string;
    ifsc: string;
    upiId: string;
    pan: string;
  };
  billedParty: {
    name: string;
    gstin?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  creators: {
    name: string;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    pageHandle?: string | null;
    gstNumber?: string | null;
    link1?: string | null;
    link2?: string | null;
  }[];
  lineItems: {
    description: string;
    link1?: string | null;
    link2?: string | null;
    qty: number;
    rate: number;
    amount: number;
  }[];
  billAmount: number;
  gstAmount: number;
  reimbursements: number;
  totalAmount: number;
  termsAndConditions?: string | null;
  // When this invoice was first created — shown as a fixed "digitally generated on" stamp,
  // so it stays the same every time the PDF is re-downloaded (not the download time).
  generatedAt: string;
}

function money(n: number): string {
  return `Rs. ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const partyLabel = data.type === "PURCHASE" ? "Payment to" : "Invoice to";
  const styles = getStyles(data.brandColor || "#134F5C");

  // Client-billed invoices (Sales/Commission) split GST into CGST+SGST when the client is in
  // the same state as us (GST prefix matches), or show it as a single IGST line otherwise —
  // the total tax amount is identical either way, only the presentation/labeling differs.
  // Purchase bills (paying creators) keep the plain "GST" line — that rule was only about
  // billing clients.
  const billsAClient = data.type === "SALES" || data.type === "COMMISSION";
  const companyState = data.company.gstin?.trim().slice(0, 2);
  const clientState = data.billedParty?.gstin?.trim().slice(0, 2);
  const isIntraState = billsAClient && !!companyState && companyState === clientState;
  const showGstSplit = billsAClient && data.gstAmount > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBanner} />
        <View style={styles.row}>
          <View style={styles.headerLeft}>
            {data.logoPath ? <Image src={data.logoPath} style={styles.logo} /> : null}
            <View>
            <Text style={styles.companyName}>{data.company.name}</Text>
            <Text style={styles.addressLine}>{data.company.addressLine1}</Text>
            <Text style={styles.addressLine}>{data.company.addressLine2}</Text>
            <Text style={styles.addressLine}>{data.company.addressLine3}</Text>
            {data.company.sacCode ? (
              <Text style={[styles.addressLine, styles.bold]}>SAC code: {data.company.sacCode}</Text>
            ) : null}
            {data.company.gstin ? (
              <Text style={[styles.addressLine, styles.bold]}>GSTIN:- {data.company.gstin}</Text>
            ) : null}
            </View>
          </View>
          <View style={[styles.metaBox, { width: "38%", marginTop: 12 }]}>
            <Text style={styles.metaLabel}>Invoice No:</Text>
            <Text style={styles.metaValue}>{data.number}</Text>
            <Text style={styles.metaLabel}>Invoice date</Text>
            <Text style={[styles.metaValue, (data.billingDate1 || data.billingDate2) ? {} : { marginBottom: 0 }]}>
              {formatDateDMY(new Date(data.date))}
            </Text>
            {(data.billingDate1 || data.billingDate2) && (
              <>
                <Text style={styles.metaLabel}>Billing Date</Text>
                <Text style={[styles.metaValue, { marginBottom: 0 }]}>
                  {[data.billingDate1, data.billingDate2]
                    .filter(Boolean)
                    .map((d) => formatDateDMY(new Date(d as string)))
                    .join(", ")}
                </Text>
              </>
            )}
          </View>
        </View>

        {data.billedParty && (
          <View>
            <Text style={styles.sectionTitle}>{partyLabel}:</Text>
            <View style={styles.partyBlock}>
              <Text style={styles.bold}>{data.billedParty.name}</Text>
              {data.billedParty.address ? <Text>{data.billedParty.address}</Text> : null}
              {data.billedParty.gstin ? <Text>GST Number: {data.billedParty.gstin}</Text> : null}
              {data.billedParty.email ? <Text>Email: {data.billedParty.email}</Text> : null}
              {data.billedParty.phone ? <Text>Phone: {data.billedParty.phone}</Text> : null}
            </View>
          </View>
        )}

        {data.collaborationBrand ? (
          <Text style={[styles.addressLine, { marginTop: 6 }]}>
            Collaboration brand: {data.collaborationBrand}
          </Text>
        ) : null}

        <View style={styles.table}>
          {data.creators.length > 0 && (
            <View style={styles.creatorCaptionRow}>
              <Text style={styles.creatorCaptionLabel}>Creators:</Text>
              <View style={{ flex: 1 }}>
                {data.creators.map((c, i) => (
                  <View key={i} style={{ flexDirection: "row", marginBottom: 1 }}>
                    <Text style={styles.creatorRow}>
                      {c.name}
                      {c.pageHandle ? ` (${c.pageHandle})` : ""}
                      {c.gstNumber ? ` — GST: ${c.gstNumber}` : ""}
                    </Text>
                    {c.link1 ? (
                      <Link src={c.link1} style={[styles.linkText, { marginLeft: 6 }]}>
                        Link 1
                      </Link>
                    ) : null}
                    {c.link2 ? (
                      <Link src={c.link2} style={[styles.linkText, { marginLeft: 6 }]}>
                        Link 2
                      </Link>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          )}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colLink]}>Live Link 1</Text>
            <Text style={[styles.tableHeaderCell, styles.colLink]}>Live Link 2</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
          </View>
          {data.lineItems.map((li, i) => (
            <View
              key={i}
              style={[styles.tableRow, i % 2 === 0 ? { backgroundColor: LIGHT_GREY } : {}]}
            >
              <Text style={[styles.tableCell, styles.colDescription]}>{li.description}</Text>
              <View style={styles.colLink}>
                {li.link1 ? (
                  <Link src={li.link1} style={styles.linkText}>
                    View
                  </Link>
                ) : null}
              </View>
              <View style={styles.colLink}>
                {li.link2 ? (
                  <Link src={li.link2} style={styles.linkText}>
                    View
                  </Link>
                ) : null}
              </View>
              <Text style={[styles.tableCell, styles.colQty]}>{li.qty}</Text>
              <Text style={[styles.tableCellBold, styles.colAmount]}>{money(li.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexGrow: 1, minHeight: 4 }} />

        <View style={styles.summaryRow}>
          <View style={styles.termsCol}>
            <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 8 }]}>Payment Details :</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Acc Name:</Text>
              <Text style={styles.detailValue}>{data.paymentDetails.accName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bank Name:</Text>
              <Text style={styles.detailValue}>{data.paymentDetails.bankName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>PAN:</Text>
              <Text style={styles.detailValue}>{data.paymentDetails.pan}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Acc No:</Text>
              <Text style={styles.detailValue}>{data.paymentDetails.accNo}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>IFSC:</Text>
              <Text style={styles.detailValue}>{data.paymentDetails.ifsc}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>UPI ID:</Text>
              <Text style={styles.detailValue}>{data.paymentDetails.upiId}</Text>
            </View>
          </View>

          <View style={styles.rightCol}>
            <View style={styles.totalsBlock}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Bill Amount</Text>
                <Text style={styles.totalsValue}>{money(data.billAmount)}</Text>
              </View>
              {showGstSplit && isIntraState ? (
                <>
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>CGST @9%</Text>
                    <Text style={styles.totalsValue}>{money(data.gstAmount / 2)}</Text>
                  </View>
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>SGST @9%</Text>
                    <Text style={styles.totalsValue}>{money(data.gstAmount / 2)}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>{showGstSplit ? "IGST @18%" : "GST"}</Text>
                  <Text style={styles.totalsValue}>{money(data.gstAmount)}</Text>
                </View>
              )}
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Reimbursements</Text>
                <Text style={styles.totalsValue}>{money(data.reimbursements)}</Text>
              </View>
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Total</Text>
                <Text style={styles.grandTotalValue}>{money(data.totalAmount)}</Text>
              </View>
            </View>
          </View>
        </View>

        {data.termsAndConditions ? (
          <View style={{ marginTop: 26 }}>
            <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Terms and Conditions:</Text>
            <Text style={styles.footerLine}>{data.termsAndConditions}</Text>
          </View>
        ) : null}

        <View style={{ flexGrow: 1, minHeight: 4 }} />

        {data.type !== "PURCHASE" ? (
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureFor}>For {data.company.name}</Text>
            {data.signaturePath ? (
              <>
                <View style={styles.signatureImageWrap}>
                  <Image src={data.signaturePath} style={styles.signatureImage} />
                  <Text style={styles.signatureTimestampOverlay}>
                    {formatDateTimeIST(data.generatedAt)}
                  </Text>
                </View>
                <Text style={styles.signatureLabel}>Authorized Signatory</Text>
              </>
            ) : (
              <>
                <Text style={[styles.signatureLabel, { marginTop: 26 }]}>Authorized Signatory</Text>
                <Text style={styles.signatureNote}>
                  Digitally generated by {data.company.name} on {formatDateTimeIST(data.generatedAt)} —
                  no physical signature required.
                </Text>
              </>
            )}
          </View>
        ) : null}
        <View style={styles.bottomBanner} fixed />
      </Page>
    </Document>
  );
}
