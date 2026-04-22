# Lead Qualifier Agent Kit — Browser automation for lead qualifying

## What this is

A generic starter for Claude Code agents that research companies against an ICP rubric you define, using your logged-in LinkedIn session. Designed to be cloned, customized, and run locally.

## How a session works

1. **LinkedIn cookies** live in a local daemon (`daemon/server.js` on `http://localhost:7823`), fed by the Chrome extension in `chrome-extension/`.
2. **`agents/lib/load-session.js`** fetches those cookies and writes `storage-state.json` at the repo root.
3. **Playwright CLI** (`npx playwright-cli`) drives a real headed browser with that session loaded.
4. **Results** are written to `companies.output.csv` via `agents/lib/csv-io.js` — one row per input company, with score, fit, notes, and researched key people.

### Loading the session

```bash
node agents/lib/load-session.js   # fetches the saved session from the daemon
```

**Fallback (daemon down):** Export cookies from Chrome DevTools → Application → Cookies into `.cookies`, then run `node agents/lib/prepare-storage-state.js`.

## Playwright CLI

```bash
npx playwright-cli -s=<session> open --headed          # open a headed browser in a named session
npx playwright-cli -s=<session> state-load storage-state.json   # load the LinkedIn session
npx playwright-cli -s=<session> goto <url>
npx playwright-cli -s=<session> snapshot               # read page content + element refs
npx playwright-cli -s=<session> click <ref>
npx playwright-cli -s=<session> fill <ref> <text>
npx playwright-cli -s=<session> type <text>
npx playwright-cli -s=<session> press <key>
npx playwright-cli -s=<session> screenshot
npx playwright-cli -s=<session> close
```

### Named sessions

Every command must include `-s=<session>`. Session names must be unique per agent; don't share. Common names:
- `main` — single-agent flows (outreach-prep)
- `icp1`, `icp2`, ... — parallel slots for icp-research

**Max 5 concurrent sessions.** Always `close` at the end.

## CSV I/O

All company data lives in CSV. Never write custom JSON files, never query APIs for company state.

```bash
node agents/lib/csv-io.js list-pending           # rows with no score yet (for icp-research)
node agents/lib/csv-io.js list-qualified         # GOOD_FIT rows without key_people (for outreach-prep)
node agents/lib/csv-io.js get <index>            # fetch a single row by index
node agents/lib/csv-io.js update <index> '<json>'  # merge JSON into row and write back
```

Writes are locked (`proper-lockfile`) so parallel agents can safely update different rows.

**Columns in `companies.output.csv`:**
`name`, `website`, `score`, `fit`, `stage`, `pricing_model`, `customer_type`, `vertical`, `employees`, `support_page`, `chat_supplier`, `notes`, `key_people`, `language`, `researched_at`, `outreach_prepped_at`.

## ICP definition

The scoring rubric lives in `ICP.md` at the repo root. **Always read `ICP.md` before scoring any company.** Never hardcode criteria in an agent run.

## CRITICAL RULES

### Write to CSV immediately after each company
After scoring a company, `node agents/lib/csv-io.js update <index> '{...}'`. Do not batch. If the agent crashes mid-session, partial work is already persisted.

### No automated browser scripts
Never write shell scripts, JS scripts, or batch automations that drive Playwright. The agent must manually `snapshot` → reason → `click`, one page at a time. Automated scripts get detected as bot activity.

### Strict browser limits
1 browser per slot. On crash, reopen **once**. If it fails again, stop and report. Never spawn additional browsers.

### Always use headed mode
`open --headed` so the user can see what's happening.

### Stop on auth walls or 403s
If LinkedIn returns 403s or shows auth walls, **stop immediately** and report. Do not retry. Likely the cookies expired — log into LinkedIn again in Chrome.

## When to ask the user

- Whether to follow someone (visible social action)
- Whether to comment or message (only liking + following are default safe)
- Anything ambiguous in the ICP rubric that would change a score
- Unexpected page states or flow errors
