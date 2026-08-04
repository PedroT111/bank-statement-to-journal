# Asientos · Coop

Web application to generate monthly accounting entries from bank statements. Runs as a single HTML page with no build step, with a minimal serverless backend to persist state in Postgres.

## What it does

1. **You upload bank statements** (PDF or Excel, from any bank) by dragging them into the app.
2. The parser automatically detects transactions by **comparing the balance line by line** (balance delta), instead of relying on keywords like "debit"/"credit" — which is why it works the same with Bancor, Banco Julio, Galicia, BBVA, etc. without needing a different reader per bank.
3. Each transaction is **classified into an accounting account** based on a rules table (keyword → account) editable from within the app itself, evaluated in priority order.
4. For each month of the chosen year, the app builds a **summary entry** (Debit/Credit with the "BANCOS" account as the counterpart) that you can preview or export.
5. You generate a `.zip` with the 12 `asiento_AAAA_MM.txt` files for the year, or an Excel file with the detail of all transactions.

All state (classification rules, loaded transactions) is automatically saved to a Postgres database and protected by a shared password.

## Structure

- [index.html](index.html) — the full app: UI, statement parser, classification engine, and entry generation. No build step or installed frontend dependencies; uses `pdf.js`, `xlsx`, and `jszip` from CDN.
- [api/state.js](api/state.js) — serverless function (Vercel, Node 20 runtime) that reads and writes the app's state to an `app_state` table in Postgres (Neon), protected by the `APP_PASSWORD` variable.
- [vercel.json](vercel.json), [package.json](package.json) — minimal deployment configuration.

## How the parser works

- It walks through the text extracted from the statement line by line, looking for an opening balance and then lines with a date (`DD/MM` or `DD/MM/AAAA`).
- The **amount and direction** (debit or credit) of each transaction are always calculated from the actual balance change between one line and the next — never from the concept text. This avoids ambiguities like in BBVA, where "TRANSFERENCIA" can be either an income or an expense.
- Lines matching the **"stop reading if it contains"** list halt parsing (to avoid reading summaries or informational sections at the end of the statement); lines matching **"exclude if the concept contains"** are discarded but still update the reference balance.
- Once a transaction is detected, it's classified against the rules table: the first rule (sorted by ascending priority) whose keyword appears in the normalized concept (no accents, lowercase) determines the accounting account. If none match, it's left as `SIN CLASIFICAR` (unclassified) for manual review.

## Run / deploy

In short, the app needs two environment variables in Vercel:

- `DATABASE_URL` (or `POSTGRES_URL` / `DATABASE_URL_UNPOOLED`) — injected automatically when installing the Neon Postgres integration.
- `APP_PASSWORD` — access password for the app; if not set, the API does not require authentication.

## Notes

- Each bank uses different terms for equivalent concepts (taxes, transfers, etc.). When loading the first statement from a new bank, it's normal to see "unclassified" transactions; once those rules are added, subsequent months from that bank get classified automatically.
- The "Backup (.json)" button in the top bar lets you download the entire state (rules + transactions) as an additional backup to the database.
