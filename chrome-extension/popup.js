document.addEventListener('DOMContentLoaded', () => {
  const fields = ['daemonUrl', 'daemonPassword'];
  const defaults = { daemonUrl: 'http://localhost:7823' };

  chrome.storage.sync.get(fields, (result) => {
    fields.forEach((field) => {
      const value = result[field] || defaults[field] || '';
      if (value) document.getElementById(field).value = value;
    });
  });

  let statusTimer;
  function showStatus(text, color) {
    const status = document.getElementById('status');
    status.textContent = text;
    status.style.color = color || '#22c55e';
    status.style.display = 'block';
    clearTimeout(statusTimer);
    const isError = color === '#ef4444';
    const isTransient = color === '#94a3b8';
    if (isTransient) return;
    statusTimer = setTimeout(() => { status.style.display = 'none'; }, isError ? 6000 : 2000);
  }

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const data = {};
    fields.forEach((field) => {
      data[field] = document.getElementById(field).value.trim();
    });
    if (data.daemonUrl) data.daemonUrl = data.daemonUrl.replace(/\/+$/, '');

    if (!data.daemonUrl || !data.daemonPassword) {
      showStatus('Fill in URL and password', '#ef4444');
      return;
    }

    try {
      new URL(data.daemonUrl);
    } catch {
      showStatus('Daemon URL is not a valid URL', '#ef4444');
      return;
    }

    showStatus('Checking daemon...', '#94a3b8');

    const probe = await probeDaemon(data.daemonUrl, data.daemonPassword);
    if (probe.ok) {
      chrome.storage.sync.set(data, () => showStatus('Saved — daemon reachable'));
    } else {
      showStatus(probe.error, '#ef4444');
    }
  });

  async function probeDaemon(daemonUrl, daemonPassword) {
    const authHeader = 'Basic ' + btoa(`icp:${daemonPassword}`);
    let res;
    try {
      res = await fetch(`${daemonUrl}/session/meta`, { headers: { Authorization: authHeader } });
    } catch {
      return { ok: false, error: 'Daemon not reachable. Run `npm start` in the project folder.' };
    }
    if (res.status === 401) return { ok: false, error: 'Password rejected by daemon.' };
    if (res.status === 200 || res.status === 404) return { ok: true };
    return { ok: false, error: `Daemon responded with ${res.status}. Check the URL.` };
  }

  document.getElementById('syncBtn').addEventListener('click', () => {
    showStatus('Syncing...', '#94a3b8');
    chrome.runtime.sendMessage({ type: 'SYNC_COOKIES_NOW' }, (response) => {
      if (response && response.ok) {
        showStatus(`Synced ${response.count} cookies`);
      } else {
        showStatus(response?.error || 'Sync failed', '#ef4444');
      }
    });
  });
});
