require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const http = require('http');
const net = require('net');
const { URL } = require('url');
const { saveSession, getSession, sessionMeta, STORAGE_DIR } = require('./storage');
const { generateKey } = require('./encryption');

const DEFAULT_PORT = Number(process.env.DAEMON_PORT) || 7823;
const BASIC_AUTH_USER = 'icp';
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD;

if (!process.env.ENCRYPTION_KEY) {
  console.error('ENCRYPTION_KEY is missing from .env');
  console.error('Generate one with:');
  console.error(`  echo "ENCRYPTION_KEY=${generateKey()}" >> .env`);
  process.exit(1);
}

if (!BASIC_AUTH_PASSWORD) {
  console.error('BASIC_AUTH_PASSWORD is missing from .env');
  process.exit(1);
}

function checkAuth(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');
  return user === BASIC_AUTH_USER && pass === BASIC_AUTH_PASSWORD;
}

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(Buffer.concat(chunks).toString('utf8'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, {});

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    return json(res, 200, { ok: true, hasSession: !!sessionMeta() });
  }

  if (!checkAuth(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="lead-qualifier-agent-kit"' });
    return res.end('Unauthorized');
  }

  if (req.method === 'POST' && url.pathname === '/session') {
    try {
      const body = JSON.parse(await readBody(req));
      const { cookies } = body;
      if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
        return json(res, 400, { error: 'cookies array is required' });
      }
      const { expiresAt } = saveSession(cookies);
      console.log(`[daemon] saved ${cookies.length} cookies (expires ${expiresAt || 'session-only'})`);
      return json(res, 200, { success: true, expiresAt });
    } catch (err) {
      console.error('[daemon] save error:', err.message);
      return json(res, 500, { error: 'Failed to save cookies' });
    }
  }

  if (req.method === 'GET' && url.pathname === '/session') {
    const session = getSession();
    if (!session) return json(res, 404, { cookies: null });
    return json(res, 200, session);
  }

  if (req.method === 'GET' && url.pathname === '/session/meta') {
    const meta = sessionMeta();
    if (!meta) return json(res, 404, { session: null });
    return json(res, 200, { session: meta });
  }

  return json(res, 404, { error: 'Not found' });
}

function portInUse(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(true));
    s.once('listening', () => s.close(() => resolve(false)));
    s.listen(port, '127.0.0.1');
  });
}

async function findOpenPort(start) {
  for (let p = start; p < start + 50; p++) {
    if (!(await portInUse(p))) return p;
  }
  throw new Error(`No open port found in range ${start}-${start + 50}`);
}

(async () => {
  const port = await findOpenPort(DEFAULT_PORT);
  const server = http.createServer(handler);
  server.listen(port, '127.0.0.1', () => {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────┐');
    console.log('│  Lead Qualifier Agent Kit — LinkedIn cookie daemon   │');
    console.log('├──────────────────────────────────────────────────────┤');
    console.log(`│  URL:      http://localhost:${port.toString().padEnd(25)}│`);
    console.log(`│  Password: ${BASIC_AUTH_PASSWORD.padEnd(42)}│`);
    console.log(`│  Storage:  ${STORAGE_DIR.padEnd(42)}│`);
    console.log('└──────────────────────────────────────────────────────┘');
    console.log('');
    console.log('Paste the URL and Password into the Chrome extension popup.');
    console.log('Then log into LinkedIn in Chrome — cookies sync automatically.');
    console.log('');
  });
})();
