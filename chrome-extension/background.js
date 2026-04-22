// Background service worker — syncs LinkedIn cookies (including HttpOnly) to the local daemon.

const SYNC_INTERVAL_MINUTES = 60;
const ALARM_NAME = 'sync-linkedin-cookies';

async function getLinkedInCookies() {
  const [a, b, c] = await Promise.all([
    chrome.cookies.getAll({ domain: '.linkedin.com' }),
    chrome.cookies.getAll({ domain: 'www.linkedin.com' }),
    chrome.cookies.getAll({ domain: '.www.linkedin.com' }),
  ]);
  const seen = new Set();
  const all = [];
  for (const cookie of [...a, ...b, ...c]) {
    const key = `${cookie.name}|${cookie.domain}|${cookie.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      all.push(cookie);
    }
  }
  return all;
}

async function getSettings() {
  return chrome.storage.sync.get(['daemonUrl', 'daemonPassword']);
}

async function syncCookies() {
  const { daemonUrl, daemonPassword } = await getSettings();

  if (!daemonUrl || !daemonPassword) {
    return { ok: false, error: 'Extension not configured — save the daemon URL and password first.' };
  }

  const cookies = await getLinkedInCookies();
  if (cookies.length === 0) {
    return { ok: false, error: 'No LinkedIn cookies found. Log into LinkedIn in this browser first.' };
  }

  const authHeader = 'Basic ' + btoa(`icp:${daemonPassword}`);

  let res;
  try {
    res = await fetch(`${daemonUrl}/session`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cookies }),
    });
  } catch (err) {
    console.error('[ICP] Cookie sync error (is the daemon running?):', err.message);
    return { ok: false, error: 'Daemon not reachable. Run `npm start` in the project folder.' };
  }

  if (res.status === 401) {
    return { ok: false, error: 'Password rejected by daemon.' };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[ICP] Cookie sync failed:', res.status, body);
    return { ok: false, error: `Daemon responded with ${res.status}.` };
  }

  const data = await res.json();
  console.log('[ICP] LinkedIn cookies synced. Expires:', data.expiresAt);
  await chrome.storage.local.set({ lastCookieSync: Date.now() });
  return { ok: true, count: cookies.length, expiresAt: data.expiresAt };
}

chrome.alarms.create(ALARM_NAME, { periodInMinutes: SYNC_INTERVAL_MINUTES });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    syncCookies().catch((err) => console.error('[ICP] Cookie sync error:', err));
  }
});

chrome.runtime.onInstalled.addListener(() => {
  syncCookies().catch((err) => console.error('[ICP] Initial cookie sync error:', err));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.daemonUrl) {
    syncCookies().catch((err) => console.error('[ICP] Cookie sync after settings change error:', err));
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SYNC_COOKIES_NOW') {
    syncCookies()
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
