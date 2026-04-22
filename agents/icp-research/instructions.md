# ICP Research & Qualification

## What this does

For each company in `companies.csv` that hasn't been scored yet, visit its website, evaluate it against the user's ICP definition in `ICP.md`, and write the score + findings to `companies.output.csv`.

## Process (per company)

### 1. Read the rubric
Read `ICP.md` once at the start of the session to understand the user's ICP criteria, scoring weights, and signal multipliers. **Never hardcode criteria — always use what's in `ICP.md`.**

### 2. Get the company
Your orchestrator (`run.sh`) gives you a single company: `{index, name, website}`. Do not fetch other companies.

### 3. Research via the browser
Visit with a headed browser (`npx playwright-cli -s=icp<slot> ...`):

1. **Homepage** — understand product, value prop, target customer
2. **Pricing page** — classify pricing model per `ICP.md` (typically `PLG_FREEMIUM` / `SELF_SERVE` / `SALES_LED` / `ENTERPRISE_ONLY`)
3. **Help / support page** — try:
   - `help.<domain>`, `support.<domain>`, `docs.<domain>`
   - `<domain>/help`, `<domain>/support`, `<domain>/faq`, `<domain>/knowledge-base`
   - If you find one, capture its URL (for `support_page`) and rough article count
4. **About / team page** — employee count, location, stage
5. **Check for a chat widget** — look at page DOM for Intercom, Crisp, Zendesk, Drift, etc. Capture as `chat_supplier`.

**Navigate naturally.** One page at a time, `snapshot` after each goto to verify the page loaded. If the domain doesn't resolve or shows a captcha, skip the company (don't write anything to the CSV — it stays pending for a future run).

### 4. Score
Apply the weighted formula from `ICP.md` to produce a score 1-10. Classify:
- **GOOD_FIT** (typically 8-10)
- **MEDIUM_FIT** (typically 5-7)
- **BAD_FIT** (typically 1-4)

The exact thresholds are defined in `ICP.md` — follow that file, not this one.

### 5. Decide stage
- GOOD_FIT → `stage: "SALES_QUALIFIED"` (outreach-prep will pick this up)
- MEDIUM_FIT → `stage: "MARKETING_QUALIFIED"`
- BAD_FIT → `stage: "NOT_A_FIT"`

### 6. Write result to CSV
```bash
node agents/lib/csv-io.js update <index> '{
  "score": "<1-10>",
  "fit": "GOOD_FIT | MEDIUM_FIT | BAD_FIT",
  "stage": "SALES_QUALIFIED | MARKETING_QUALIFIED | NOT_A_FIT",
  "pricing_model": "...",
  "customer_type": "SMB | MID_MARKET | ENTERPRISE",
  "vertical": "...",
  "employees": "...",
  "support_page": "...",
  "chat_supplier": "...",
  "notes": "2-3 paragraph summary of findings, including what they sell, pricing model, help center status, support automation potential, and why the score is what it is.",
  "researched_at": "<YYYY-MM-DD>"
}'
```

Write **once**, immediately after scoring. Never batch across companies.

### 7. Close the browser
`npx playwright-cli -s=icp<slot> close` when done.

## Anti-patterns

- Do not create browser automation scripts — manually control the browser page-by-page
- Do not batch CSV writes — one company scored = one CSV update
- Do not score without reading `ICP.md` first
- Do not open more than 1 browser per slot
- Do not retry aggressively on errors — one reopen on crash, then stop and report
