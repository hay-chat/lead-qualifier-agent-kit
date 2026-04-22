#!/usr/bin/env node
// Outreach Prep — sequential, one agent, one browser.
// Cross-platform replacement for run.sh.
// For each GOOD_FIT row without key_people, research key decision-makers on LinkedIn.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');

const LOG_DIR = path.join(os.homedir(), '.lead-qualifier-agent-kit', 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });
const DATE = new Date().toISOString().slice(0, 10);
const LOG_FILE = path.join(LOG_DIR, `outreach-prep-${DATE}.log`);
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

function closeBrowser() {
  return new Promise((resolve) => {
    const child = spawn('npx', ['playwright-cli', '-s=main', 'close'], {
      cwd: ROOT,
      shell: true,
      stdio: 'ignore',
    });
    child.on('exit', () => resolve());
    child.on('error', () => resolve());
  });
}

async function main() {
  log(`=== Outreach prep starting at ${new Date().toISOString()} ===`);

  const qualifiedResult = runNode(['agents/lib/csv-io.js', 'list-qualified']);
  if (qualifiedResult.status !== 0) {
    logErr(qualifiedResult.stderr || 'Failed to fetch qualified companies.');
    process.exit(1);
  }
  let qualified;
  try {
    qualified = JSON.parse(qualifiedResult.stdout);
  } catch (err) {
    logErr(`Failed to parse qualified JSON: ${err.message}`);
    process.exit(1);
  }

  const total = qualified.length;
  if (total === 0) {
    log('No qualified companies awaiting outreach prep.');
    process.exit(0);
  }

  log(`Prepping outreach for ${total} companies (sequential).`);

  const session = runNode(['agents/lib/load-session.js'], { stdio: 'inherit' });
  if (session.status !== 0) {
    logErr('Failed to load session. Is the daemon running (npm start) and is LinkedIn logged in?');
    process.exit(1);
  }

  let exiting = false;
  const cleanupAndExit = async (code) => {
    if (exiting) return;
    exiting = true;
    log('[CLEANUP] Closing outreach-prep browser...');
    await closeBrowser();
    logStream.end();
    process.exit(code);
  };

  process.on('SIGINT', () => cleanupAndExit(130));
  process.on('SIGTERM', () => cleanupAndExit(143));

  const rowList = qualified
    .map((r) => `- index ${r.index}: ${r.name} (${r.website})`)
    .join('\n');

  const prompt = `Research key people on LinkedIn for the companies below, one at a time, then write findings to the CSV.

Your browser session name is: main

Companies to prep (do NOT fetch others):
${rowList}

Steps:
1. Read CLAUDE.md and outreach-prep/instructions.md.
2. Read ICP.md to understand which roles matter for this ICP and whether following / engaging is enabled.
3. Open a headed browser: npx playwright-cli -s=main open --headed
4. Load session state: npx playwright-cli -s=main state-load storage-state.json
5. For each company above, sequentially:
   a. Fetch the full row: node agents/lib/csv-io.js get <index>
   b. Read the notes column to understand the ICP research context.
   c. Search LinkedIn for the company; visit the company page.
   d. Find 2-3 key people relevant to the ICP.
   e. Visit their profiles.
   f. Optionally follow / like, only if ICP.md enables it.
   g. Write findings: node agents/lib/csv-io.js update <index> '<json with key_people, language, outreach_prepped_at>'
6. Close the browser: npx playwright-cli -s=main close.

CRITICAL rules:
- ONE agent, ONE browser, ONE company at a time. No subagents.
- Every playwright-cli command must include -s=main.
- Navigate naturally; snapshot after every goto.
- Stop immediately on auth walls or 403 errors.
- Default = research only. Only follow / like if ICP.md explicitly enables it.
- Write to the CSV once per company, right after research; never batch.`;

  const claudeArgs = [
    '-p',
    '--permission-mode', 'bypassPermissions',
    '--model', 'sonnet',
    '--allowedTools', 'Bash,Read,Write,Edit,Glob,Grep',
  ];

  await new Promise((resolve) => {
    const child = spawn('claude', claudeArgs, {
      cwd: ROOT,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    child.stdin.write(prompt);
    child.stdin.end();

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      logStream.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      logStream.write(chunk);
    });

    child.on('error', (err) => {
      logErr(`spawn error: ${err.message}`);
    });
    child.on('exit', () => resolve());
  });

  await closeBrowser();
  log(`=== Finished at ${new Date().toISOString()} ===`);
  logStream.end();
}

main().catch((err) => {
  logErr(`Fatal: ${err.stack || err.message}`);
  logStream.end();
  process.exit(1);
});
