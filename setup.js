#!/usr/bin/env node
// One-shot setup: installs deps, generates secrets, seeds .env, walks through ICP.
// Cross-platform (macOS, Linux, Windows).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const ROOT = __dirname;
const ENV_PATH = path.join(ROOT, '.env');

function run(cmd, args, label) {
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`${label} failed.`);
    process.exit(result.status ?? 1);
  }
}

console.log('=> Installing Node dependencies...');
run('npm', ['install'], 'npm install');

console.log('=> Priming playwright-cli (downloads on first use)...');
run('npx', ['--yes', 'playwright-cli', '--version'], 'playwright-cli fetch');

console.log('=> Installing Playwright Chromium browser (skipped if already cached)...');
run('npx', ['--yes', 'playwright-cli', 'install', 'chromium'], 'playwright-cli install chromium');

if (!fs.existsSync(ENV_PATH)) {
  console.log('=> Creating .env with generated secrets...');
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  const basicAuthPassword = crypto.randomBytes(16).toString('hex');
  const envContents =
    `# Local daemon — the Chrome extension and the agents both use these.\n` +
    `DAEMON_PORT=7823\n` +
    `BASIC_AUTH_PASSWORD=${basicAuthPassword}\n` +
    `\n` +
    `# 64-char hex string (32 bytes). Do not share this — it encrypts your LinkedIn cookies.\n` +
    `ENCRYPTION_KEY=${encryptionKey}\n`;
  fs.writeFileSync(ENV_PATH, envContents, { mode: 0o600 });
  if (process.platform !== 'win32') {
    try { fs.chmodSync(ENV_PATH, 0o600); } catch {}
  }
  console.log('=> .env created.');
} else {
  console.log('=> .env already exists — leaving it alone.');
}

(async () => {
  const prompts = require('@clack/prompts');

  prompts.intro('Let\'s configure your ICP');

  const proceed = await prompts.confirm({
    message: 'Run the ICP wizard now? (rewrites ICP.md via Claude)',
    initialValue: true,
  });
  if (prompts.isCancel(proceed) || !proceed) {
    prompts.outro('Skipped ICP wizard. Edit ICP.md by hand whenever you\'re ready.');
    printNextSteps();
    return;
  }

  const companyName = await prompts.text({
    message: 'What\'s your company name?',
    placeholder: 'Acme Inc',
    validate: (v) => (!v?.trim() ? 'Required' : undefined),
  });
  if (prompts.isCancel(companyName)) return cancel(prompts);

  const offering = await prompts.text({
    message: 'What do you do or sell? (one or two sentences)',
    placeholder: 'AI-powered customer support for e-commerce brands',
    validate: (v) => (!v?.trim() ? 'Required' : undefined),
  });
  if (prompts.isCancel(offering)) return cancel(prompts);

  const businessModel = await prompts.select({
    message: 'Business model',
    options: [
      { value: 'B2B', label: 'B2B' },
      { value: 'B2C', label: 'B2C' },
      { value: 'B2B2C', label: 'B2B2C' },
      { value: 'Other', label: 'Other' },
    ],
    initialValue: 'B2B',
  });
  if (prompts.isCancel(businessModel)) return cancel(prompts);

  const companySizes = await prompts.multiselect({
    message: 'Target company sizes (space to toggle, enter to confirm)',
    options: [
      { value: '1-10', label: '1-10 employees' },
      { value: '11-50', label: '11-50 employees' },
      { value: '51-200', label: '51-200 employees' },
      { value: '201-500', label: '201-500 employees' },
      { value: '501-1,000', label: '501-1,000 employees' },
      { value: '1,001-5,000', label: '1,001-5,000 employees' },
      { value: '5,001-10,000', label: '5,001-10,000 employees' },
      { value: '10,001+', label: '10,001+ employees' },
    ],
    required: true,
  });
  if (prompts.isCancel(companySizes)) return cancel(prompts);

  const industries = await prompts.text({
    message: 'Target industries (free text — list everything relevant)',
    placeholder: 'e.g., SaaS, fintech, DTC e-commerce, healthtech',
    validate: (v) => (!v?.trim() ? 'Required' : undefined),
  });
  if (prompts.isCancel(industries)) return cancel(prompts);

  const antiPatterns = await prompts.text({
    message: 'Anti-patterns / red flags (what disqualifies a lead?)',
    placeholder: 'e.g., pre-revenue, builds in-house, uses competitor X',
    validate: (v) => (!v?.trim() ? 'Required' : undefined),
  });
  if (prompts.isCancel(antiPatterns)) return cancel(prompts);

  const engagement = await prompts.select({
    message: 'Engagement rules — what should the outreach agent do on LinkedIn?',
    options: [
      { value: 'research-only', label: 'Research only, no visible social actions (default)' },
      { value: 'follow', label: 'Follow key people on LinkedIn' },
      { value: 'like', label: 'Like relevant recent posts' },
      { value: 'like-and-follow', label: 'Like + Follow' },
    ],
    initialValue: 'research-only',
  });
  if (prompts.isCancel(engagement)) return cancel(prompts);

  const spinner = prompts.spinner();
  spinner.start('Asking Claude to rewrite ICP.md (this usually takes 20-60s)');

  const prompt = buildClaudePrompt({
    companyName,
    offering,
    businessModel,
    companySizes,
    industries,
    antiPatterns,
    engagement,
  });

  const result = await runClaude(prompt);

  if (result.code !== 0) {
    spinner.stop('Claude failed to update ICP.md');
    if (result.stderr) process.stderr.write(result.stderr);
    console.error('\nYou can still edit ICP.md by hand. Your answers:');
    console.error(JSON.stringify({ companyName, offering, businessModel, companySizes, industries, antiPatterns, engagement }, null, 2));
    process.exit(result.code ?? 1);
  }

  spinner.stop('ICP.md updated.');
  if (result.stdout.trim()) console.log(result.stdout.trim());

  prompts.outro('ICP configured. Review ICP.md and tweak anything Claude got wrong.');
  printNextSteps();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

function cancel(prompts) {
  prompts.cancel('Cancelled. Re-run `npm run setup` when you\'re ready.');
  process.exit(0);
}

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'claude',
      ['-p', '--permission-mode', 'acceptEdits'],
      {
        cwd: ROOT,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      }
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function buildClaudePrompt(icp) {
  const sizes = Array.isArray(icp.companySizes) ? icp.companySizes.join(', ') : String(icp.companySizes);
  const engagementLabels = {
    'research-only': 'Research only, no visible social actions (default)',
    'follow': 'Follow key people on LinkedIn',
    'like': 'Like relevant recent posts',
    'like-and-follow': 'Like + Follow',
  };
  const engagementLabel = engagementLabels[icp.engagement] || icp.engagement;
  return [
    `You are editing ICP.md in the current working directory. Read the existing ICP.md to understand its structure, then rewrite it so it matches the user-supplied ICP below.`,
    ``,
    `User-supplied ICP:`,
    `- Company name: ${icp.companyName}`,
    `- What they do/sell: ${icp.offering}`,
    `- Business model: ${icp.businessModel}`,
    `- Target company sizes: ${sizes} employees`,
    `- Target industries: ${icp.industries}`,
    `- Anti-patterns / red flags: ${icp.antiPatterns}`,
    `- Engagement rule selected: ${engagementLabel}`,
    ``,
    `Requirements:`,
    `1. Preserve the section headings and overall shape of ICP.md (What we sell, Strong-fit criteria, Anti-patterns, Scoring rubric, Classification thresholds, Signal multipliers, Outreach — key personas, Engagement rules, Language).`,
    `2. Replace all placeholder text with concrete content based on the user's answers.`,
    `3. In "Strong-fit criteria", reflect the selected company sizes and industries verbatim.`,
    `4. In "Anti-patterns", expand the user's red flags into a clear bullet list.`,
    `5. Keep the scoring rubric table but adjust factors, weights, and examples to fit this ICP. Weights must sum to 100%.`,
    `6. Leave the HTML comment guide lines (<!-- ... -->) out of the final file — those were placeholder hints.`,
    `7. Do not invent outreach personas the user didn't mention; use reasonable defaults for the business model and note they should be edited.`,
    `8. In "Engagement rules", include exactly these four checkbox options (in this order) and mark ONLY the one matching the user's selection with [x], the others with [ ]:`,
    `   - [ ] Follow key people on LinkedIn`,
    `   - [ ] Like relevant recent posts`,
    `   - [ ] Like + Follow`,
    `   - [ ] Research only, no visible social actions (default)`,
    `9. Use the Edit/Write tools to save the changes. Do not print the full file back — just confirm in one sentence what you changed.`,
  ].join('\n');
}

function printNextSteps() {
  console.log('');
  console.log('Next steps:');
  console.log('  1. Put your target companies in companies.csv (columns: name, website).');
  console.log('  2. Run: npm start           # daemon starts; copy URL/password into the Chrome extension');
  console.log('  3. Install the Chrome extension from chrome-extension/ (see its README)');
  console.log('  4. Log into LinkedIn in that Chrome browser');
  console.log('  5. Run: npm run research    # scores your companies');
  console.log('  6. Run: npm run outreach    # finds key people for GOOD_FIT rows');
  console.log('');
}
