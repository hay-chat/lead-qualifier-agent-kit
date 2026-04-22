require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), override: false });
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.DAEMON_URL || `http://localhost:${process.env.DAEMON_PORT || 7823}`;
const SESSION_URL = `${BASE_URL}/session`;
const AUTH_USER = process.env.BASIC_AUTH_USER || 'icp';
const AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD;

async function main() {
  const auth = Buffer.from(`${AUTH_USER}:${AUTH_PASSWORD}`).toString('base64');

  const res = await fetch(SESSION_URL, { headers: { Authorization: `Basic ${auth}` } });
  if (res.status === 404) {
    console.error('No LinkedIn session stored yet.');
    console.error('1. Make sure the daemon is running (npm start)');
    console.error('2. Install the Chrome extension (see chrome-extension/README.md)');
    console.error('3. Log into LinkedIn in that Chrome browser');
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`Failed to fetch cookies: ${res.status}. Is the daemon running? (npm start)`);
    process.exit(1);
  }

  const { cookies, expiresAt } = await res.json();

  const playwrightCookies = cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    expires: c.expirationDate || -1,
    httpOnly: !!c.httpOnly,
    secure: !!c.secure,
    sameSite: c.sameSite === 'no_restriction' ? 'None' : c.sameSite === 'lax' ? 'Lax' : 'Strict',
  }));

  const outPath = path.resolve(__dirname, '../../storage-state.json');
  fs.writeFileSync(outPath, JSON.stringify({ cookies: playwrightCookies, origins: [] }, null, 2));
  console.log(`Loaded ${playwrightCookies.length} cookies into storage-state.json`);

  if (expiresAt) {
    const exp = new Date(expiresAt);
    if (exp < new Date()) {
      console.log(`WARNING: Session expired on ${exp.toLocaleDateString()} — log into LinkedIn again.`);
    } else {
      console.log(`Session expires: ${exp.toLocaleDateString()}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
