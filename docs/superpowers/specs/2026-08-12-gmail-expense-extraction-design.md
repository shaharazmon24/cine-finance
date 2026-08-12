# Gmail → Expenses extraction (2026)

Date: 2026-08-12
Status: approved by owner, in implementation

## Purpose

Pull every business expense that arrived in the owner's Gmail during 2026 into CINE FINANCE,
so the VAT-input and deductible-profit figures reflect reality instead of the handful of
expenses typed in by hand.

The owner has an accountant who handles the actual filings; every receipt already goes to them
by WhatsApp. This feature is **not** bookkeeping — it is visibility. The number the app shows
must therefore be honest about what it does not know (see Confidence, below) rather than
complete-looking and wrong.

## Scope

**In:** business expenses received by email, 1 Jan 2026 → 12 Aug 2026.

**Out (explicitly):**
- Income / outgoing invoices. The owner's income already comes from Work Days and the Morning
  import; re-importing the Morning notification mails would duplicate data that is already
  more accurate elsewhere.
- Personal purchases. Captured only if a vendor is ambiguous, and then marked non-business.
- Live OAuth from inside the app. The one-time sweep is done by Claude through its Gmail
  connection; the app stores and organizes the result. OAuth may be added later as its own
  project.

## Architecture

Three layers, deliberately separated:

```
[sweep]    Claude reads Gmail (read-only)  →  structured JSON
[store]    cf_maildocs — a document warehouse. Touches no money.
[approve]  "מהמייל" view → owner approves → rows written into cf_expenses
```

The warehouse is the point. Nothing scanned affects VAT, income tax or Bituach Leumi until the
owner approves it, which means (a) a bad extraction can never silently corrupt the tax picture,
and (b) the sweep can be re-run later without breaking anything — re-scans dedupe on `msgId`.

## Data model

New localStorage key `cf_maildocs`, included in `dumpData()`/`applyData()` like every other
store, so it syncs and backs up with everything else.

```js
{
  id,                    // app-local uid
  msgId,                 // Gmail message id — the dedup key
  date,                  // YYYY-MM-DD, the document date
  vendor,                // display name, e.g. "קבוצת שלמה"
  vendorKey,             // sender domain, e.g. "shlomo.co.il" — groups recurring bills
  docType,               // "חשבונית מס" / "קבלה" / "receipt"
  docNo,                 // supplier's document number, when present
  amount,                // number, or null when only a PDF holds it
  currency,              // "ILS" | "USD" | ...
  vatMode,               // feeds splitVat(): 'included' | 'plus' | 'none'
  category,              // one of EXPENSE_CATS keys
  confidence,            // 'high' | 'needs-amount' | 'guess'
  business,              // bool — false marks a personal purchase
  subject, gmailUrl,     // provenance: always link back to the source mail
  status,                // 'pending' | 'approved' | 'ignored'
  linkedId               // id of the cf_expenses row created on approval
}
```

`confidence` drives the UI:
- `high` — vendor, date and amount all read directly from the mail. Safe to batch-approve.
- `needs-amount` — everything known except the number, because it lives inside a PDF
  attachment that the Gmail connector cannot download. **Never counted in any total.**
- `guess` — category or VAT treatment inferred rather than stated. Approvable, but shown
  with the inference made explicit.

## The PDF problem

The Gmail connector returns attachment *metadata* but not attachment *content*, so roughly
40–50 of the 2026 rows arrive with no amount. Three mitigations, applied in order:

1. **Read them through the owner's Chrome.** Claude opens each such mail and its attachment in
   the owner's already-signed-in browser and reads the amount off the rendered page.
   Read-only; no sending, deleting or modifying. Approved by the owner on 2026-08-12.
2. **Recurring-vendor propagation.** Shlomo (car lease), Bezeq and IEC bill nearly the same
   amount every cycle. One read establishes the pattern and the fill screen offers
   "same as last month" for the rest, which the owner confirms or corrects.
3. **Leave it visibly missing.** Anything still unresolved keeps `needs-amount`, stays out of
   every total, and shows in an orange band with a one-field inline fill. A visible gap is
   better than a plausible wrong number.

## UI — the "מהמייל" view

- **Month strip**: one card per month of 2026 — total approved expenses, VAT input reclaimable,
  and a count of rows still waiting.
- **Table**: grouped by month, then by vendor. Row = date · vendor · document · category ·
  amount · action. Each row links to its source mail in Gmail.
- **Bands**: `דורש סכום` / `ממתין לאישור` / `אושר`, as filter chips.
- **Quick fill**: `needs-amount` rows render as a single number input plus a
  "same as last month" button for vendors seen before.
- **Batch approve**: approve every `high` row in a month in one action.

## Writing through to expenses

On approval, a `cf_expenses` row is created through the existing model — `category`,
`vatMode`, and the per-category `deductPct`/`vatReclaimPct` defaults from `EXPENSE_CATS` — so
the tax engine treats a scanned expense exactly like a hand-typed one. The expense carries
`source:'gmail'` and `msgId`; the maildoc keeps `linkedId`. Un-approving deletes the expense
row and returns the maildoc to `pending`.

## Error handling

- A re-scan matching an existing `msgId` updates the maildoc in place and never touches an
  already-approved expense.
- An approved maildoc whose expense row was deleted by hand falls back to `pending` rather
  than pointing at nothing.
- Amounts in a foreign currency stay in that currency and are marked `guess`; no exchange rate
  is invented.

## Verification

In-browser against the real app: the view renders, month totals match the sum of approved
rows, a `needs-amount` row contributes zero to every total, approving writes one expense with
the right net/VAT split, un-approving removes it, and a second import of the same data creates
no duplicates.
