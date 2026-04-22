#!/usr/bin/env node
// One-shot setup: installs deps, generates secrets, seeds .env.
// Cross-platform (macOS, Linux, Windows).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const ENV_PATH = path.join(ROOT, '.env');

console.log('=> Installing Node dependencies...');
const npm = spawnSync('npm', ['install'], { cwd: ROOT, stdio: 'inherit', shell: true });
if (npm.status !== 0) {
  console.error('npm install failed.');
  process.exit(npm.status ?? 1);
}

if (!fs.existsSync(ENV_PATH)) {
  console.log('=> Creating .env with generated secrets...');
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  const basicAuthPassword = crypto.randomBytes(16).toString('hex');
  const envContents =
    `# Local daemon — the Chrome extension and the agents both use these.\n` +
    `DAEMON_PORT=7823\n` +
    `BASIC_AUTH_USER=icp\n` +
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

console.log('');
console.log('Setup complete.');
console.log('');
console.log('Next steps:');
console.log('  1. Edit ICP.md to describe your ideal customer and scoring rubric.');
console.log('  2. Put your target companies in companies.csv (columns: name, website).');
console.log('  3. Run: npm start           # daemon starts; copy URL/user/password into the Chrome extension');
console.log('  4. Install the Chrome extension from chrome-extension/ (see its README)');
console.log('  5. Log into LinkedIn in that Chrome browser');
console.log('  6. Run: npm run research    # scores your companies');
console.log('  7. Run: npm run outreach    # finds key people for GOOD_FIT rows');
console.log('');
