#!/usr/bin/env node
// ICP Research — parallel spawner (cross-platform replacement for run.sh).
// Keeps CONCURRENCY Claude processes running at all times. When one finishes,
// the next pending company is picked up immediately.
//
// Env:
//   CONCURRENCY (default 5)
// Args:
//   optional positional LIMIT to cap total companies for this run

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY) || 5);
const LIMIT = process.argv[2] ? Number(process.argv[2]) : null;

const LOG_DIR = path.join(os.homedir(), '.lead-qualifier-agent-kit', 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });
const DATE = new Date().toISOString().slice(0, 10);
const LOG_FILE = path.join(LOG_DIR, `icp-research-${DATE}.log`);
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function log(line) {
  const text = `${line}\n`;
  process.stdout.write(text);
  logStream.write(text);
}

function logErr(line) {
  const text = `${line}\n`;
  process.stderr.write(text);
  logStream.write(text);
}

function runNode(args, { stdio = 'pipe' } = {}) {
  return spawnSync(process.execPath, args, { cwd: ROOT, stdio, encoding: 'utf8' });
}

function closeBrowser(slot) {
  return new Promise((resolve) => {
    const child = spawn('npx', ['playwright-cli', `-s=icp${slot}`, 'close'], {
      cwd: ROOT,
      shell: true,
      stdio: 'ignore',
    });
    child.on('exit', () => resolve());
    child.on('error', () => resolve());
  });
}

async function cleanupAllBrowsers() {
  log('[CLEANUP] Closing icp-research browsers...');
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => closeBrowser(i + 1)));
}

function buildPrompt({ slot, name, website, csvIndex }) {
  return `Research a company for ICP fit and write the result to the CSV.

Your browser session name is: icp${slot}

Company: ${name}
Website: ${website}
CSV index: ${csvIndex}

Steps:
1. Read CLAUDE.md and icp-research/instructions.md.
2. Read ICP.md for the user's scoring rubric.
3. Open a headed browser: npx playwright-cli -s=icp${slot} open --headed
4. Load session state: npx playwright-cli -s=icp${slot} state-load storage-state.json
5. Visit the website and the pages listed in icp-research/instructions.md.
6. Score the company against the ICP.md rubric.
7. Write the result with: node agents/lib/csv-io.js update ${csvIndex} '<json>'
8. Close the browser: npx playwright-cli -s=icp${slot} close
9. Report: company name, score, classification, key findings.

CRITICAL rules:
- Every playwright-cli command must include -s=icp${slot}
- 1 browser only. If it crashes, retry ONCE. If it fails again, stop and report.
- Navigate naturally, one page at a time; snapshot after each navigation.
- Write to the CSV ONCE at the end — never batch, never duplicate.
- If the domain does not load or shows a captcha, skip and do NOT write to the CSV.`;
}

function researchCompany(company, slot) {
  return new Promise(async (resolve) => {
    const { index: csvIndex, name, website } = company;
    log(`[slot ${slot}] Researching: ${name} (${website}) [csv_index=${csvIndex}]`);

    await closeBrowser(slot);

    const prompt = buildPrompt({ slot, name, website, csvIndex });

    const claudeArgs = [
      '-p',
      '--permission-mode', 'bypassPermissions',
      '--model', 'sonnet',
      '--allowedTools', 'Bash,Read,Write,Edit,Glob,Grep',
    ];

    const child = spawn('claude', claudeArgs, {
      cwd: ROOT,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    child.stdin.write(prompt);
    child.stdin.end();

    child.stderr.on('data', (chunk) => logStream.write(chunk));
    // Claude's -p output is the final result; capture but don't spam stdout with it
    child.stdout.on('data', (chunk) => logStream.write(chunk));

    child.on('error', (err) => {
      logErr(`[slot ${slot}] spawn error: ${err.message}`);
    });

    child.on('exit', async () => {
      await closeBrowser(slot);
      log(`[slot ${slot}] Done: ${name}`);
      resolve();
    });
  });
}

async function main() {
  log(`=== ICP research starting at ${new Date().toISOString()} ===`);

  // Fetch pending companies
  const pendingResult = runNode(['agents/lib/csv-io.js', 'list-pending']);
  if (pendingResult.status !== 0) {
    logErr(pendingResult.stderr || 'Failed to fetch pending companies.');
    process.exit(1);
  }
  let pending;
  try {
    pending = JSON.parse(pendingResult.stdout);
  } catch (err) {
    logErr(`Failed to parse pending companies JSON: ${err.message}`);
    process.exit(1);
  }

  if (LIMIT != null && !Number.isNaN(LIMIT)) {
    pending = pending.slice(0, LIMIT);
  }
  const total = pending.length;

  if (total === 0) {
    log('No pending companies.');
    process.exit(0);
  }

  log(`Researching ${total} companies with concurrency=${CONCURRENCY}`);

  // Load session once at the start
  const session = runNode(['agents/lib/load-session.js'], { stdio: 'inherit' });
  if (session.status !== 0) {
    logErr('Failed to load session. Is the daemon running (npm start) and is LinkedIn logged in?');
    process.exit(1);
  }

  let exiting = false;
  const cleanupAndExit = async (code) => {
    if (exiting) return;
    exiting = true;
    await cleanupAllBrowsers();
    logStream.end();
    process.exit(code);
  };

  process.on('SIGINT', () => cleanupAndExit(130));
  process.on('SIGTERM', () => cleanupAndExit(143));

  let nextIdx = 0;

  // Slot-based worker loop: each worker holds its slot for the whole run.
  async function worker(slot) {
    while (nextIdx < total) {
      const idx = nextIdx++;
      await researchCompany(pending[idx], slot);
    }
  }

  const slots = Math.min(CONCURRENCY, total);
  const workers = [];
  for (let s = 1; s <= slots; s++) {
    workers.push(worker(s));
  }

  try {
    await Promise.all(workers);
  } finally {
    await cleanupAllBrowsers();
  }

  log(`=== Finished at ${new Date().toISOString()} ===`);
  log('Results: companies.output.csv');
  log(`Log: ${LOG_FILE}`);
  logStream.end();
}

main().catch((err) => {
  logErr(`Fatal: ${err.stack || err.message}`);
  logStream.end();
  process.exit(1);
});
