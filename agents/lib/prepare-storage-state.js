// Manual fallback: convert a Chrome DevTools cookie export (.cookies TSV) into
// a Playwright storage-state.json. Use this if the daemon is unavailable.
//
// How to export: DevTools → Application → Cookies → select all → copy → paste into .cookies
//
// Run: node agents/lib/prepare-storage-state.js

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const input = path.join(root, '.cookies');
const output = path.join(root, 'storage-state.json');

if (!fs.existsSync(input)) {
  console.error(`Missing ${input}. Export your LinkedIn cookies from Chrome DevTools first.`);
  process.exit(1);
}

const lines = fs.readFileSync(input, 'utf-8').trim().split('\n');

const cookies = lines
  .map((line) => {
    const [name, value, domain, p, expires, _size, httpOnly, secure, sameSite] = line.split('\t');
    if (!name || !domain) return null;
    if (!domain.includes('linkedin.com')) return null;
    return {
      name,
      value,
      domain,
      path: p || '/',
      expires:
        expires === 'Session' || !expires
          ? -1
          : Math.floor(new Date(expires).getTime() / 1000),
      httpOnly: httpOnly === '✓',
      secure: secure === '✓',
      sameSite: sameSite === 'None' ? 'None' : sameSite === 'Lax' ? 'Lax' : 'Strict',
    };
  })
  .filter(Boolean);

fs.writeFileSync(output, JSON.stringify({ cookies, origins: [] }, null, 2));
console.log(`Converted ${cookies.length} cookies to storage-state.json`);
