document.addEventListener('DOMContentLoaded', () => {
  const fields = ['daemonUrl', 'daemonUser', 'daemonPassword'];
  const defaults = { daemonUrl: 'http://localhost:7823', daemonUser: 'icp' };

  chrome.storage.sync.get(fields, (result) => {
    fields.forEach((field) => {
      const value = result[field] || defaults[field] || '';
      if (value) document.getElementById(field).value = value;
    });
  });

  function showStatus(text, color) {
    const status = document.getElementById('status');
    status.textContent = text;
    status.style.color = color || '#22c55e';
    status.style.display = 'block';
    setTimeout(() => { status.style.display = 'none'; }, 2000);
  }

  document.getElementById('saveBtn').addEventListener('click', () => {
    const data = {};
    fields.forEach((field) => {
      data[field] = document.getElementById(field).value.trim();
    });
    if (data.daemonUrl) data.daemonUrl = data.daemonUrl.replace(/\/+$/, '');
    chrome.storage.sync.set(data, () => showStatus('Saved'));
  });

  document.getElementById('syncBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'SYNC_COOKIES_NOW' }, (response) => {
      if (response && response.success) {
        showStatus('Cookies synced');
      } else {
        showStatus(response?.error || 'Sync failed', '#ef4444');
      }
    });
  });
});
