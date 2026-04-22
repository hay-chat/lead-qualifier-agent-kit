# Lead Qualifier Agent Kit

Claude Code agents that qualify leads against your ICP using your own logged-in LinkedIn session. Local-first, CSV-driven, no third-party services. Runs on macOS, Linux, and Windows.

## What it does

1. **You define your ICP** in `ICP.md` — what a good customer looks like, weighted scoring rubric, anti-patterns.
2. **You list target companies** in `companies.csv` (just `name` + `website`).
3. **The research agent** visits each company's website, scores it 1–10 against your rubric, and writes the results to `companies.output.csv`.
4. **The outreach-prep agent** takes the `GOOD_FIT` rows, finds 2–3 key decision-makers on LinkedIn, and appends them to the CSV — ready for you to reach out.

All browser automation runs in a real headed Chrome window with your actual LinkedIn session — nothing leaves your machine.

## Setup (one-time)

You'll need:

- **[Node.js 18+](https://nodejs.org)** — if you don't have it, install from nodejs.org.
- **[Claude Code](https://docs.claude.com/claude-code)** — Anthropic's CLI.
- **Google Chrome** — for the session-sync extension.

Then:

```bash
git clone https://github.com/hay-chat/lead-qualifier-agent-kit.git
cd lead-qualifier-agent-kit
npm run setup
```

The setup script installs dependencies and generates a `.env` with random secrets. No further config needed.

## Define your ICP

Open [`ICP.md`](./ICP.md) and fill in the template:
- What you sell
- What a strong-fit customer looks like
- Anti-patterns (BAD_FIT signals)
- Scoring rubric with weights
- Key personas for outreach

The agents read this file on every run, so you can tweak it anytime.

## Add target companies

Edit [`companies.csv`](./companies.csv):

```csv
name,website
Linear,linear.app
Notion,notion.so
Vercel,vercel.com
```

Just `name` and `website` — the agent fills in everything else.

## Start the daemon and sync your LinkedIn session

```bash
npm start
```

You'll see something like:

```
┌──────────────────────────────────────────────────────┐
│  Lead Qualifier Agent Kit — LinkedIn cookie daemon   │
├──────────────────────────────────────────────────────┤
│  URL:      http://localhost:7823                     │
│  Username: icp                                       │
│  Password: a1b2c3d4e5f6...                           │
│  Storage:  /Users/you/.lead-qualifier-agent-kit      │
└──────────────────────────────────────────────────────┘
```

Keep this terminal open — the daemon needs to stay running while you use the kit.

### Install the Chrome extension

In a new terminal (or just a new Chrome window):

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle) — Chrome will warn that dev-mode extensions are unverified; that's normal.
3. Click **Load unpacked** and select the `chrome-extension/` folder from this repo.
4. Click the extension icon in your toolbar → paste the **URL**, **Username**, and **Password** from the daemon terminal.
5. Click **Save**.

### Log into LinkedIn

Log into LinkedIn in Chrome like you normally would. The extension detects the cookies and pushes them to the daemon automatically (also every 60 min and any time you hit **Sync now** in the popup).

To verify: click the extension icon → **Sync now** → you should see "Cookies synced".

## Run the research

With the daemon still running, open a new terminal:

```bash
npm run research
```

The agent:
- Spins up 5 parallel headed Chrome windows
- Visits each company's homepage, pricing page, help center, and about page
- Scores each one against your `ICP.md` rubric
- Writes results to `companies.output.csv`

You'll see the browsers working in real time. Each company takes 1–3 minutes.

## Run the outreach prep

```bash
npm run outreach
```

The agent:
- Picks up every `GOOD_FIT` row from `companies.output.csv`
- Searches LinkedIn for the company
- Finds 2–3 key decision-makers (based on personas from your `ICP.md`)
- Appends them (as JSON) to the `key_people` column in the CSV

One company at a time, one browser, sequential (not parallel) — LinkedIn throttles aggressive automation.

## Open the results

```bash
open companies.output.csv       # macOS
xdg-open companies.output.csv   # Linux
start companies.output.csv      # Windows
```

Opens in Excel / Google Sheets / Numbers.

## Troubleshooting

| Problem | Fix |
|---|---|
| "No LinkedIn session stored" | Install the Chrome extension, log into LinkedIn, click **Sync now** in the popup. |
| "Cookies sync failed" in extension service worker logs | Is `npm start` running? Does the extension have the daemon URL from the terminal? |
| 403 errors during research | LinkedIn session may have expired. Log into LinkedIn again in Chrome; the extension will re-sync automatically. |
| Port 7823 already in use | The daemon auto-picks the next open port — check the terminal banner and update the extension popup. |
| Chrome says "unverified" when loading the extension | Normal for unpacked extensions. You're loading your own code from disk; Chrome doesn't review it. |

## Manual cookie fallback

If the daemon is down or the extension isn't working, you can export cookies by hand:

1. Open LinkedIn in Chrome → DevTools → **Application** tab → **Cookies** → select all → copy
2. Paste into a file named `.cookies` at the repo root
3. Run `node agents/lib/prepare-storage-state.js`

This produces the same `storage-state.json` the agents use.

## Repo layout

```
lead-qualifier-agent-kit/
├── ICP.md                 # YOUR scoring rubric (edit this)
├── companies.csv          # YOUR input (edit this)
├── companies.output.csv   # generated results
│
├── daemon/                # localhost server for LinkedIn cookies
├── chrome-extension/      # syncs cookies from Chrome into the daemon
└── agents/
    ├── CLAUDE.md          # base agent rules (Playwright, CSV, safety)
    ├── lib/               # shared helpers (session load, CSV I/O)
    ├── icp-research/      # scores companies
    └── outreach-prep/     # finds key people
```

## Customizing further

- **More research dimensions:** add columns in `agents/lib/csv-io.js` (`OUTPUT_COLUMNS`) and reference them in `agents/icp-research/instructions.md`.
- **Different parallelism:** `CONCURRENCY=5 npm run research` (macOS/Linux) or `set CONCURRENCY=5&& npm run research` (Windows cmd). Default is 5.
- **Limit a run:** `npm run research -- 20` processes only 20 companies.
- **Swap model:** edit `--model sonnet` in the `run.js` files.
