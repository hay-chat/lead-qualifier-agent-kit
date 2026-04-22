const fs = require('fs');
const os = require('os');
const path = require('path');
const { encrypt, decrypt } = require('./encryption');

const STORAGE_DIR = path.join(os.homedir(), '.lead-qualifier-agent-kit');
const SESSION_FILE = path.join(STORAGE_DIR, 'session.json');

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true, mode: 0o700 });
  }
}

function saveSession(cookies) {
  ensureStorageDir();
  let maxExpiry = null;
  for (const cookie of cookies) {
    if (cookie.expirationDate && cookie.expirationDate > 0) {
      const d = new Date(cookie.expirationDate * 1000).toISOString();
      if (!maxExpiry || d > maxExpiry) maxExpiry = d;
    }
  }
  const prev = fs.existsSync(SESSION_FILE)
    ? JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'))
    : null;
  const now = new Date().toISOString();
  const payload = {
    cookiesEncrypted: encrypt(JSON.stringify(cookies)),
    expiresAt: maxExpiry,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };
  const tmp = SESSION_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, SESSION_FILE);
  return { expiresAt: maxExpiry };
}

function getSession() {
  if (!fs.existsSync(SESSION_FILE)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    return { cookies: JSON.parse(decrypt(payload.cookiesEncrypted)), expiresAt: payload.expiresAt };
  } catch (err) {
    console.error('[storage] Failed to read session file:', err.message);
    return null;
  }
}

function sessionMeta() {
  if (!fs.existsSync(SESSION_FILE)) return null;
  try {
    const { expiresAt, createdAt, updatedAt } = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    return { expiresAt, createdAt, updatedAt };
  } catch {
    return null;
  }
}

module.exports = { saveSession, getSession, sessionMeta, STORAGE_DIR };
