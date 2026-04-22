# Chrome extension — LinkedIn session sync

Syncs your logged-in LinkedIn cookies (including HttpOnly ones like `li_at`) to the local daemon so the ICP research agent can browse as you.

## Install

1. Open `chrome://extensions` in Chrome
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked** and select this folder (`chrome-extension/`)
4. Pin the extension to your toolbar so you can find it again
5. Click the extension icon → paste the **Daemon URL**, **Username**, and **Password** printed in your terminal when you ran `npm start`
6. Click **Save**
7. Log into LinkedIn in this Chrome browser like normal — cookies sync automatically

## Verifying it worked

- Open `chrome://extensions`, find this extension, click **service worker** (under "Inspect views") to see logs
- You should see: `[ICP] LinkedIn cookies synced. Expires: <date>`
- Or: click the extension icon → **Sync now**

## When cookies sync

- Every 60 minutes automatically (via `chrome.alarms`)
- On extension install/reload
- Whenever you change the daemon URL in the popup
- On demand via **Sync now**

LinkedIn sessions last ~30 days. As long as you stay logged into LinkedIn in this browser, the daemon always has a fresh copy.
