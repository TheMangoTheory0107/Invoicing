import { google } from "googleapis";

export class SheetSyncError extends Error {}

// The service account key is stored as raw JSON content (pasted into Settings), not a
// filesystem path — this needs to work on serverless hosting with no persistent disk, as
// well as the local Mac app.
function parseServiceAccount(json: string) {
  try {
    return JSON.parse(json) as { client_email: string; private_key: string };
  } catch {
    throw new SheetSyncError(
      "The service account key isn't valid JSON. Paste the full contents of the key file you downloaded from Google Cloud Console."
    );
  }
}

function getSheetsClient(json: string) {
  const key = parseServiceAccount(json);
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

export async function testSheetConnection(spreadsheetId: string, serviceAccountJson: string) {
  const sheets = getSheetsClient(serviceAccountJson);
  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    const key = parseServiceAccount(serviceAccountJson);
    return {
      title: res.data.properties?.title || "(untitled)",
      sheetNames: (res.data.sheets || []).map((s) => s.properties?.title).filter(Boolean),
      serviceAccountEmail: key.client_email,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SheetSyncError(
      `Could not open the spreadsheet. Make sure it's shared (Editor access) with the service account email, and the spreadsheet ID is correct. (${message})`
    );
  }
}

function quoteSheetName(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

async function getHeaderRow(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  sheetName: string
): Promise<string[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheetName(sheetName)}!1:1`,
  });
  return (res.data.values?.[0] || []).map((h) => String(h).trim());
}

// Finds an existing row by matching `keyHeader` column value, or returns null if not found.
async function findRowByKey(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  sheetName: string,
  keyColIndex: number,
  keyValue: string
): Promise<number | null> {
  const colLetter = columnLetter(keyColIndex);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheetName(sheetName)}!${colLetter}2:${colLetter}`,
  });
  const rows = res.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || "").trim() === keyValue) {
      return i + 2; // account for header row + 1-indexing
    }
  }
  return null;
}

const HIGHLIGHT_YELLOW = { red: 1, green: 1, blue: 0 };

// Every tab in the workbook that happens to have both a "Link" and a "Bill No" column — the
// monthly creator-tracking tabs (named like "Oct'25", "Nov'26", ...) — gets scanned for rows
// whose Link matches one of this invoice's line items. The sheet's own team reshuffles these
// tabs' columns most months (renamed, added, or dropped), so headers are looked up fresh per
// tab rather than assumed; a tab missing either header is simply skipped, never guessed at.
async function findLinkTrackingTabs(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string
): Promise<{ sheetId: number; title: string; linkCol: number; billNoCol: number; totalAmountCol: number }[]> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const tabs = (meta.data.sheets || [])
    .map((s) => ({ sheetId: s.properties?.sheetId, title: s.properties?.title }))
    .filter((t): t is { sheetId: number; title: string } => t.sheetId != null && !!t.title);

  const norm = (s: string) => s.trim().toLowerCase();
  const qualifying: { sheetId: number; title: string; linkCol: number; billNoCol: number; totalAmountCol: number }[] = [];
  for (const tab of tabs) {
    const headers = await getHeaderRow(sheets, spreadsheetId, tab.title);
    const linkCol = headers.findIndex((h) => norm(h) === "link");
    const billNoCol = headers.findIndex((h) => norm(h) === "bill no");
    if (linkCol === -1 || billNoCol === -1) continue;
    const totalAmountCol = headers.findIndex((h) => norm(h) === "total amount");
    qualifying.push({ ...tab, linkCol, billNoCol, totalAmountCol });
  }
  return qualifying;
}

export interface LinkSyncResult {
  attempted: boolean;
  ok: boolean;
  matched: number;
  error?: string;
}

// Writes this invoice's number (and that specific line item's own amount, not the invoice
// total) into every monthly tab row whose Link matches one of the invoice's line items — the
// same job a hand-run Apps Script used to do, now automatic on save. Both written cells are
// highlighted yellow so it's obvious at a glance which Bill No entries came from the app.
export async function syncLineItemLinksToMonthlySheets(params: {
  serviceAccountJson: string;
  spreadsheetId: string;
  invoiceNumber: string;
  links: { link: string; amount: number }[];
}): Promise<LinkSyncResult> {
  const { serviceAccountJson, spreadsheetId, invoiceNumber, links } = params;
  if (links.length === 0) return { attempted: false, ok: true, matched: 0 };

  const sheets = getSheetsClient(serviceAccountJson);
  try {
    const tabs = await findLinkTrackingTabs(sheets, spreadsheetId);
    const byLink = new Map(links.map((l) => [l.link, l.amount]));

    const requests: Record<string, unknown>[] = [];
    let matched = 0;

    for (const tab of tabs) {
      const colLetter1 = columnLetter(tab.linkCol);
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${quoteSheetName(tab.title)}!${colLetter1}2:${colLetter1}`,
      });
      const linkRows = res.data.values || [];

      for (let i = 0; i < linkRows.length; i++) {
        const cellLink = String(linkRows[i][0] || "").trim();
        if (!cellLink || !byLink.has(cellLink)) continue;
        const amount = byLink.get(cellLink)!;
        const rowIndex = i + 1; // data starts at sheet row 2 -> 0-indexed grid row 1

        matched++;
        requests.push({
          updateCells: {
            rows: [
              {
                values: [
                  {
                    userEnteredValue: { stringValue: invoiceNumber },
                    userEnteredFormat: { backgroundColor: HIGHLIGHT_YELLOW },
                  },
                ],
              },
            ],
            fields: "userEnteredValue,userEnteredFormat.backgroundColor",
            start: { sheetId: tab.sheetId, rowIndex, columnIndex: tab.billNoCol },
          },
        });

        if (tab.totalAmountCol !== -1) {
          requests.push({
            updateCells: {
              rows: [
                {
                  values: [
                    {
                      userEnteredValue: { numberValue: amount },
                      userEnteredFormat: { backgroundColor: HIGHLIGHT_YELLOW },
                    },
                  ],
                },
              ],
              fields: "userEnteredValue,userEnteredFormat.backgroundColor",
              start: { sheetId: tab.sheetId, rowIndex, columnIndex: tab.totalAmountCol },
            },
          });
        }
      }
    }

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    }

    return { attempted: true, ok: true, matched };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error syncing links.";
    return { attempted: true, ok: false, matched: 0, error: message };
  }
}

export interface LinkBackfillResult {
  ok: boolean;
  matched: number; // total cells written
  invoicesMatched: number; // distinct invoices that matched at least one row
  error?: string;
}

// A one-time catch-up run for invoices that existed before this sync was wired in. Reads each
// qualifying tab's Link column exactly once (not once per invoice — with dozens of invoices
// and dozens of tabs, re-scanning per invoice would be slow and risk the sheet's API rate
// limit), builds a single link -> row lookup, then writes every match in one batch.
export async function backfillLinksAcrossInvoices(params: {
  serviceAccountJson: string;
  spreadsheetId: string;
  invoices: { invoiceNumber: string; links: { link: string; amount: number }[] }[];
}): Promise<LinkBackfillResult> {
  const { serviceAccountJson, spreadsheetId, invoices } = params;
  const sheets = getSheetsClient(serviceAccountJson);
  try {
    const tabs = await findLinkTrackingTabs(sheets, spreadsheetId);

    const linkIndex = new Map<
      string,
      { sheetId: number; rowIndex: number; billNoCol: number; totalAmountCol: number }[]
    >();
    for (const tab of tabs) {
      const colLetter1 = columnLetter(tab.linkCol);
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${quoteSheetName(tab.title)}!${colLetter1}2:${colLetter1}`,
      });
      const linkRows = res.data.values || [];
      for (let i = 0; i < linkRows.length; i++) {
        const cellLink = String(linkRows[i][0] || "").trim();
        if (!cellLink) continue;
        const entry = { sheetId: tab.sheetId, rowIndex: i + 1, billNoCol: tab.billNoCol, totalAmountCol: tab.totalAmountCol };
        const list = linkIndex.get(cellLink);
        if (list) list.push(entry);
        else linkIndex.set(cellLink, [entry]);
      }
    }

    const requests: Record<string, unknown>[] = [];
    let matched = 0;
    let invoicesMatched = 0;

    for (const inv of invoices) {
      let invoiceHadMatch = false;
      for (const { link, amount } of inv.links) {
        const targets = linkIndex.get(link);
        if (!targets) continue;
        for (const t of targets) {
          matched++;
          invoiceHadMatch = true;
          requests.push({
            updateCells: {
              rows: [
                {
                  values: [
                    {
                      userEnteredValue: { stringValue: inv.invoiceNumber },
                      userEnteredFormat: { backgroundColor: HIGHLIGHT_YELLOW },
                    },
                  ],
                },
              ],
              fields: "userEnteredValue,userEnteredFormat.backgroundColor",
              start: { sheetId: t.sheetId, rowIndex: t.rowIndex, columnIndex: t.billNoCol },
            },
          });
          if (t.totalAmountCol !== -1) {
            requests.push({
              updateCells: {
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: { numberValue: amount },
                        userEnteredFormat: { backgroundColor: HIGHLIGHT_YELLOW },
                      },
                    ],
                  },
                ],
                fields: "userEnteredValue,userEnteredFormat.backgroundColor",
                start: { sheetId: t.sheetId, rowIndex: t.rowIndex, columnIndex: t.totalAmountCol },
              },
            });
          }
        }
      }
      if (invoiceHadMatch) invoicesMatched++;
    }

    const CHUNK = 400;
    for (let i = 0; i < requests.length; i += CHUNK) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: requests.slice(i, i + CHUNK) } });
    }

    return { ok: true, matched, invoicesMatched };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error backfilling links.";
    return { ok: false, matched: 0, invoicesMatched: 0, error: message };
  }
}

function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Writes/updates a register row keyed by `keyHeader` (e.g. "Bill no" / "Invoice number"),
// mapping fields by header name. Only the specific cells for headers we know about are
// touched (via per-cell batchUpdate) so any extra columns the CA has added by hand — notes,
// manual flags, whatever — are never clobbered on an update.
export async function upsertRegisterRow(params: {
  serviceAccountJson: string;
  spreadsheetId: string;
  sheetName: string;
  keyHeader: string;
  keyValue: string;
  values: Record<string, string | number>;
}) {
  const { serviceAccountJson, spreadsheetId, sheetName, keyHeader, keyValue, values } = params;
  const sheets = getSheetsClient(serviceAccountJson);
  const headers = await getHeaderRow(sheets, spreadsheetId, sheetName);

  const norm = (s: string) => s.trim().toLowerCase();
  const keyColIndex = headers.findIndex((h) => norm(h) === norm(keyHeader));
  if (keyColIndex === -1) {
    throw new SheetSyncError(
      `Header "${keyHeader}" not found in row 1 of "${sheetName}". Check the sheet's column headers.`
    );
  }

  const existingRow = await findRowByKey(sheets, spreadsheetId, sheetName, keyColIndex, keyValue);

  let targetRow: number;
  if (existingRow) {
    targetRow = existingRow;
  } else {
    const lastRowRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${quoteSheetName(sheetName)}!A:A`,
    });
    targetRow = (lastRowRes.data.values?.length || 1) + 1;
  }

  const data = Object.entries(values)
    .map(([header, value]) => {
      const colIndex = headers.findIndex((h) => norm(h) === norm(header));
      if (colIndex === -1) return null;
      return {
        range: `${quoteSheetName(sheetName)}!${columnLetter(colIndex)}${targetRow}`,
        values: [[String(value)]],
      };
    })
    .filter((v): v is { range: string; values: string[][] } => v !== null);

  if (data.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
}

// Removes a register row entirely (not just clearing its cells) when its invoice is deleted
// from the app, so a deleted invoice doesn't linger in the sheet. A no-op if the row can't be
// found — already deleted, or never synced in the first place.
export async function deleteRegisterRow(params: {
  serviceAccountJson: string;
  spreadsheetId: string;
  sheetName: string;
  keyHeader: string;
  keyValue: string;
}) {
  const { serviceAccountJson, spreadsheetId, sheetName, keyHeader, keyValue } = params;
  const sheets = getSheetsClient(serviceAccountJson);

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetMeta = (meta.data.sheets || []).find(
    (s) => s.properties?.title?.trim().toLowerCase() === sheetName.trim().toLowerCase()
  );
  const sheetId = sheetMeta?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) return;

  const headers = await getHeaderRow(sheets, spreadsheetId, sheetName);
  const norm = (s: string) => s.trim().toLowerCase();
  const keyColIndex = headers.findIndex((h) => norm(h) === norm(keyHeader));
  if (keyColIndex === -1) return;

  const rowNumber = await findRowByKey(sheets, spreadsheetId, sheetName, keyColIndex, keyValue);
  if (!rowNumber) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });
}
