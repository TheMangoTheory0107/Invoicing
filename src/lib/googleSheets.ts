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
