# TheMangoTheory Invoicing

An invoicing app for TheMangoTheory: create Sales invoices (to clients/agencies) and Purchase
bills (to creators), auto-numbered per financial year, kept in a Sales Register and Purchase
Register, optionally synced to a Google Sheet for your CA, with payment tracking and overdue
reminders on both sides. Runs either as a double-click app on your Mac, or deployed to the web
with a real URL (see below) — same code either way.

## What it does

- **Invoices matching your template** — company letterhead, creator details, GST breakup,
  reimbursements, bank payment details — generated as a PDF on demand (click Download PDF any
  time; always reflects the current data, nothing goes stale on disk).
- **Auto-numbering** — `001/25-26` style, separate counters for Sales and Purchase, reset each
  financial year (Apr–Mar).
- **Sales Register & Purchase Register** — auto-populated on every invoice, filterable by year /
  month / status / party, exportable as CSV or a real Excel (.xlsx) file.
- **Reconciliation view** — combined Sales + Purchase ledger with date-range and status filters,
  running totals, export as CSV or Excel — for tallying against your books or forwarding to your CA.
- **Payments** — record a payment against any invoice; it updates to Partial/Paid automatically
  and the balance shows everywhere.
- **Overdue tracking** — dashboard surfaces overdue Sales (receivables) and Purchase (payables)
  invoices based on each invoice's due date.
- **Google Sheets sync** — optional, via a Google service account; pushes register rows to a
  spreadsheet by column header name (so your sheet's own column order/extra columns are safe).
- **Import** — bring in historical Sales/Purchase register data and a Client/Agency master list
  from CSV/XLSX.
- **Branding** — set a brand colour and upload your logo in Settings; both appear on every
  generated invoice PDF.

## Quickstart on Mac (no Terminal needed)

This folder includes a double-click launcher, so you never need to open Terminal for day-to-day
use:

- **`TheMangoTheory Invoicing.app`** — double-click to start the app. Everything it needs is
  already installed and built into this folder, so there's no waiting on the first run — it opens
  straight in your default browser at `http://localhost:3000`.
- **`Stop TheMangoTheory Invoicing.command`** — double-click to shut the app down when you're done.

You only need Node.js installed once beforehand (get the LTS installer from
[nodejs.org](https://nodejs.org/)) — the launcher checks for it and tells you if it's missing.
Node itself is the only thing not bundled in, since it needs to match your Mac.

If something goes wrong, the launcher writes `launcher.log` and `server.log` in this folder —
check those for details, or try double-clicking the app again.

Everything below (manual `npm` commands, PM2, Docker, etc.) is for anyone who prefers running it
themselves from a terminal, or hosting it on a server instead of a personal Mac — you don't need
any of it for the double-click flow above.

## Deploy to the web (Vercel + Turso)

Instead of running on one Mac, you can host this as a real website — one URL, works from any
device/browser, nothing to double-click or keep running. Two free services, ~10 minutes total.

**1. Move the database to Turso** (a free hosted SQLite service — Turso is the storage, not a
separate app):

```bash
curl -sSfL https://get.tur.so/install.sh | bash   # installs the Turso CLI
turso auth login                                   # opens a browser to sign up/log in (free)
turso db create themangotheory-invoicing
turso db import prisma/dev.db                      # uploads your existing data as-is
turso db show themangotheory-invoicing --url        # copy this → TURSO_DATABASE_URL
turso db tokens create themangotheory-invoicing     # copy this → TURSO_AUTH_TOKEN
```

**2. Deploy to Vercel** (free hosting, deploys straight from this folder — no GitHub needed):

```bash
npm install -g vercel
vercel login                                        # opens a browser to sign up/log in (free)
vercel link                                         # answer the prompts (any project name is fine)
vercel env add DATABASE_URL production               # paste: file:./dev.db
vercel env add SESSION_SECRET production             # paste a random 32+ char string
vercel env add TURSO_DATABASE_URL production          # paste the URL from step 1
vercel env add TURSO_AUTH_TOKEN production             # paste the token from step 1
vercel --prod
```

That last command prints your live URL when it finishes. Open it, set your password on the
first visit (same as the Mac app), and you're in — same data, same features, accessible from
anywhere. Re-run `vercel --prod` any time you want to push a code update; your data stays in
Turso independently of deploys.

## Requirements

- Node.js 20+
- A place to run it continuously (your own machine, a small VPS, etc.) — this app is self-hosted,
  not deployed to a cloud platform.

## First-time setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

- `DATABASE_URL` — leave as `file:./dev.db` unless you want the SQLite file elsewhere.
- `SESSION_SECRET` — replace with a random string, at least 32 characters
  (`openssl rand -base64 32` works well). This signs your login session — keep it secret and
  stable across restarts (changing it logs everyone out).

Then create the database and build:

```bash
npx prisma migrate deploy
npm run build
npm run start
```

Open `http://localhost:3000`. The first visit prompts you to set an admin password — there's no
recovery flow, so store it somewhere safe (a password manager).

### Running it continuously

Use a process manager so it survives reboots/crashes, e.g. with [PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start npm --name invoicing -- start
pm2 save
```

Or run it in Docker / systemd — any way of keeping `npm run start` alive on port 3000 works.

### Backups

Everything that matters lives in one place: the SQLite database file (`dev.db` by default, per
`DATABASE_URL`) — or, if deployed to the web, your Turso database (Turso keeps its own backups;
`turso db shell <name> .dump` also works for a manual export any time). PDFs aren't stored
anywhere — they're generated fresh from this data whenever you click Download, so there's nothing
extra to back up. Back up the database file regularly if running locally (it's gitignored — never
commit it).

## Using the app

1. **Settings** — fill in your company profile, bank details, default payment terms, and your
   **Branding** (brand colour + logo upload). All of this appears on every Sales invoice PDF.
2. **Clients / Agencies** and **Creators** — add the parties you bill and pay. You can also let
   these get created automatically the first time you reference a new name on an invoice/import,
   or bulk-import a client list (Name, GST, Address, Agency code) from the **Import** page.
3. **Sales Invoices → New invoice** — pick a client, add line items, optionally list the
   creator(s) the campaign involved (with the amount you owe each). Saving auto-numbers the
   invoice, generates the PDF, and adds a Sales Register row.
4. If creators were listed with an amount, the invoice detail page offers **Generate purchase
   bills** — one Purchase bill per creator, auto-numbered on its own series, linked back to the
   Sales invoice.
5. **Record a payment** on any invoice's detail page — the balance and status (Unpaid / Partial /
   Paid) update immediately, both in the app and (if enabled) in your Google Sheet.
6. **Dashboard** shows outstanding receivable/payable totals and lists everything overdue, on
   both the Sales and Purchase side.
7. **Reconciliation** — filter by date range, type, status or party name to cross-check against
   your bank statement or books; export the filtered view as CSV or Excel any time — the Excel
   export is a real .xlsx file, ready to forward straight to your CA. The same Export CSV/Excel
   buttons are on the Sales and Purchase Register pages too, and respect whatever filters you've
   applied there.

### Historical data already loaded

This copy of the app comes pre-loaded with your existing Sales and Purchase registers (FY 25-26
and FY 26-27) and your Client/Agency list, imported from your spreadsheets — so you don't need to
re-enter anything. Each imported invoice keeps its original bill/invoice number (Sales) or a note
with the original reference (Purchase), and carries over amounts already received and their dates,
so the Dashboard and Reconciliation views reflect real payment history from day one. On first
login you'll set your own admin password — nothing has been pre-set for you.

If you ever need to re-import or add more historical rows later, use the **Import** page — it's
safe to re-run: existing invoices/clients are matched and skipped or updated rather than
duplicated.

## Google Sheets sync (optional)

To push Sales/Purchase Register rows to a Google Sheet automatically:

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (or reuse one),
   enable the **Google Sheets API**, and create a **Service Account**.
2. Create a JSON key for that service account and save it somewhere on the server running this
   app (e.g. `/etc/invoicing/service-account.json`) — **not** inside the git repo.
3. Open your target Google Sheet and share it with the service account's email address
   (found in the JSON key, `client_email`) as an **Editor**.
4. Make sure the sheet has tabs named for Sales/Purchase Register (default `Sales Register` /
   `Purchase Register`, configurable) with a header row. The app matches columns by header text,
   so you can keep whatever extra columns your CA already uses — the app only ever writes into
   columns it recognizes (Month, Date, Agency, GST No., Bill no, Bill Amount, GST, Total Amount,
   Status, Amount Paid, Balance for Sales; Month, Invoice sent date, Name, Invoice number, Amount,
   Status, Amount Paid, Balance for Purchase) and never touches the rest.
5. In the app's **Settings** page, fill in the Spreadsheet ID (from the sheet's URL), the tab
   names, and the path to the JSON key file, click **Test connection**, then enable sync.

If the sheet is ever unreachable, saving an invoice or recording a payment still succeeds locally
— you'll see a sync warning, and the next save retries the sync.

## Notes on scope

- Auth is a single shared password (or one per person if you want multiple people using the same
  login) — there's no multi-user/role system.
- "Reminders" for overdue invoices are in-app (dashboard + register filters), not push
  notifications or emails — there's no outbound email configured by default.
- This app doesn't create a Google Drive presence itself; PDFs are generated on demand from the
  database, not stored as files anywhere.

## Development

```bash
npm run dev      # dev server with hot reload
npx prisma studio  # browse/edit the database directly
npx tsc --noEmit    # typecheck
npm run build       # production build (also lints)
```
