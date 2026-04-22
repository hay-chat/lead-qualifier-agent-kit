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
  return chrome.storage.sync.get(['daemonUrl', 'daemonUser', 'daemonPassword']);
}

async function syncCookies() {
  const { daemonUrl, daemonUser, daemonPassword } = await getSettings();

  if (!daemonUrl || !daemonUser || !daemonPassword) {
    console.log('[ICP] Skipping cookie sync — extension not fully configured');
    return;
  }

  const cookies = await getLinkedInCookies();
  if (cookies.length === 0) {
    console.log('[ICP] No LinkedIn cookies found — log into LinkedIn in this browser first');
    return;
  }

  const authHeader = 'Basic ' + btoa(`${daemonUser}:${daemonPassword}`);

  try {
    const res = await fetch(`${daemonUrl}/session`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cookies }),
    });

    if (!res.ok) {
      console.error('[ICP] Cookie sync failed:', res.status, await res.text());
      return;
    }

    const data = await res.json();
    console.log('[ICP] LinkedIn cookies synced. Expires:', data.expiresAt);
    await chrome.storage.local.set({ lastCookieSync: Date.now() });
  } catch (err) {
    console.error('[ICP] Cookie sync error (is the daemon running?):', err.message);
  }
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
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});
