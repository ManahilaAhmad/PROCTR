/**
 * offlineQueue.js — Offline-First Local Storage & Sync Queue
 * 
 * Architecture:
 * 1. All violations/logs are FIRST written to local JSON file (always works)
 * 2. Then attempted to sync to backend via HTTP
 * 3. If HTTP fails → queued in localStorage
 * 4. When internet reconnects → all queued items are flushed to backend
 */

const QUEUE_KEY = 'proctr_offline_queue';
const SYNC_BATCH_SIZE = 20; // Max items to sync per flush cycle
let isSyncing = false;

// ─── QUEUE MANAGEMENT ────────────────────────────────────────────

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch { return []; }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('[OfflineQueue] localStorage full, trimming...');
    // If storage is full, drop oldest half
    const trimmed = queue.slice(Math.floor(queue.length / 2));
    localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  }
}

function enqueue(endpoint, payload) {
  const queue = getQueue();
  queue.push({
    id: Date.now() + '_' + Math.random().toString(36).slice(2),
    endpoint,
    payload,
    timestamp: new Date().toISOString(),
    retries: 0
  });
  saveQueue(queue);
}

function dequeueAll() {
  const queue = getQueue();
  localStorage.removeItem(QUEUE_KEY);
  return queue;
}

function getPendingCount() {
  return getQueue().length;
}

// ─── CONNECTIVITY DETECTION ──────────────────────────────────────

let _isOnline = navigator.onLine;

async function checkConnectivity(apiBase) {
  try {
    const res = await fetch(`${apiBase}/health`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    _isOnline = res.ok;
  } catch {
    _isOnline = false;
  }
  updateConnectionBadge(_isOnline);
  return _isOnline;
}

function isOnline() { return _isOnline; }

window.addEventListener('online', () => {
  _isOnline = true;
  updateConnectionBadge(true);
  console.log('[OfflineQueue] Network restored — flushing queue');
  flushQueue(window._API_BASE || 'http://localhost:5000/api');
});

window.addEventListener('offline', () => {
  _isOnline = false;
  updateConnectionBadge(false);
  console.warn('[OfflineQueue] Network lost — switching to offline mode');
});

function updateConnectionBadge(online) {
  let badge = document.getElementById('connection-status-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'connection-status-badge';
    badge.style.cssText = `
      position: fixed; bottom: 16px; right: 16px; z-index: 9999;
      padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 700;
      display: flex; align-items: center; gap: 6px; 
      transition: all 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    document.body.appendChild(badge);
  }
  if (online) {
    badge.style.background = '#dcfce7';
    badge.style.color = '#166534';
    badge.style.border = '1.5px solid #22c55e';
    const pending = getPendingCount();
    badge.innerHTML = `<span style="width:7px;height:7px;background:#22c55e;border-radius:50%;display:inline-block;"></span> Online ${pending > 0 ? `(${pending} pending sync)` : ''}`;
    // Auto-hide after 3s if online and no pending
    if (pending === 0) {
      setTimeout(() => { badge.style.opacity = '0'; }, 3000);
    } else {
      badge.style.opacity = '1';
    }
  } else {
    badge.style.opacity = '1';
    badge.style.background = '#fee2e2';
    badge.style.color = '#991b1b';
    badge.style.border = '1.5px solid #ef4444';
    badge.innerHTML = `<span style="width:7px;height:7px;background:#ef4444;border-radius:50%;display:inline-block;"></span> Offline — Logs saved locally`;
  }
}

// ─── SAFE API CALL (local queue on failure) ──────────────────────

async function safePost(apiBase, endpoint, payload) {
  // Always write to local file log first (via Electron IPC)
  if (window.proctrAPI && window.proctrAPI.writeLocalLog) {
    await window.proctrAPI.writeLocalLog({
      endpoint,
      payload,
      timestamp: new Date().toISOString()
    }).catch(() => {});
  }

  // Attempt backend sync
  try {
    const res = await fetch(`${apiBase}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // Queue for later sync
    enqueue(endpoint, payload);
    console.warn(`[OfflineQueue] Queued (offline): ${endpoint} — pending: ${getPendingCount()}`);
    updateConnectionBadge(false);
    return null;
  }
}

// ─── FLUSH QUEUE TO BACKEND (when online) ────────────────────────

async function flushQueue(apiBase) {
  if (isSyncing) return;
  const queue = getQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  console.log(`[OfflineQueue] Flushing ${queue.length} queued items to backend...`);

  const batch = queue.slice(0, SYNC_BATCH_SIZE);
  const remaining = queue.slice(SYNC_BATCH_SIZE);
  const failed = [];

  for (const item of batch) {
    try {
      const res = await fetch(`${apiBase}${item.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item.payload, _offline_timestamp: item.timestamp }),
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log(`[OfflineQueue] Synced: ${item.endpoint}`);
    } catch {
      item.retries = (item.retries || 0) + 1;
      if (item.retries < 5) failed.push(item); // Drop after 5 retries
    }
  }

  saveQueue([...failed, ...remaining]);
  isSyncing = false;
  updateConnectionBadge(true);

  if (getPendingCount() > 0 && navigator.onLine) {
    setTimeout(() => flushQueue(apiBase), 5000); // Continue flushing if more remain
  }
}

// ─── EXPORTS ─────────────────────────────────────────────────────

window.offlineQueue = {
  safePost,
  flushQueue,
  getPendingCount,
  isOnline,
  checkConnectivity,
  enqueue,
  updateConnectionBadge
};
