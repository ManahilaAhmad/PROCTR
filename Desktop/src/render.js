let alertCount = 0;

window.proctrAPI.onSensorEvent((payload) => {
  console.log('[Render Received Payload]:', payload);

  if (payload.type === 'SENSOR_SYSTEM_START') {
    const wsElem = document.getElementById('val-workspace');
    if (wsElem && payload.workspace_dir) {
      wsElem.innerText = payload.workspace_dir;
    }
  } else if (payload.type === 'VIOLATION_ALERT') {
    addViolationCard(payload);
  }
});

window.proctrAPI.onCloseWarning(() => {
  const modal = document.getElementById('warning-modal');
  if (modal) modal.style.display = 'flex';
});

document.getElementById('modal-close-btn')?.addEventListener('click', () => {
  const modal = document.getElementById('warning-modal');
  if (modal) modal.style.display = 'none';
});

function addViolationCard(v) {
  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.style.display = 'none';

  alertCount++;
  const counterElem = document.getElementById('alert-counter');
  if (counterElem) counterElem.innerText = `${alertCount} Alert(s) Logged`;

  const feedStream = document.getElementById('feed-stream');
  if (!feedStream) return;

  const card = document.createElement('div');
  card.className = 'alert-item';

  const timeStr = v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();

  card.innerHTML = `
    <div class="alert-icon">!</div>
    <div class="alert-body">
      <div class="alert-header-row">
        <span class="alert-title">${v.title}</span>
        <span class="alert-code">${v.code}</span>
      </div>
      <div class="alert-desc">${v.description}</div>
      <div style="display:flex; justify-content:space-between; margin-top:6px;">
        <span style="font-size:11px; color:var(--red-400); font-weight:700;">${v.severity} VIOLATION</span>
        <span class="alert-time">${timeStr}</span>
      </div>
    </div>
  `;

  feedStream.prepend(card);
}
