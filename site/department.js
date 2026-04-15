const deptSelect = document.getElementById('deptSelect');
const loginBtn = document.getElementById('loginBtn');
const statusEl = document.getElementById('status');
const contentEl = document.getElementById('content');

function setStatus(msg) {
  statusEl.textContent = msg;
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeText(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string') return v.trim() || '—';
  return String(v);
}

function renderParticipantCard(p) {
  const name = safeText(p.studentName || p.name);
  const events = Array.isArray(p.events) ? p.events : [];
  const eventNames = events
    .map((e) => (typeof e === 'string' ? e : (e && typeof e === 'object' ? (e.eventName || e.name || e.title) : '')))
    .filter(Boolean);

  return `
    <article class="card">
      <div class="cardHeader">
        <div class="cardTitle">
          <h2>${escapeHtml(name)}</h2>
          <span class="badge">${escapeHtml(safeText(p.paymentStatus))}</span>
        </div>
        <div class="muted">ID: ${escapeHtml(safeText(p.participantId ?? p.id))}</div>
      </div>

      <div class="kv">
        <div class="k">Email</div>
        <div class="v">${escapeHtml(safeText(p.email))}</div>

        <div class="k">Phone</div>
        <div class="v">${escapeHtml(safeText(p.phone))}</div>

        <div class="k">College</div>
        <div class="v">${escapeHtml(safeText(p.college))}</div>

        <div class="k">Events</div>
        <div class="v">${eventNames.length ? `<ul class="list">${eventNames.map((e) => `<li>${escapeHtml(String(e))}</li>`).join('')}</ul>` : '<div class="muted">—</div>'}</div>
      </div>
    </article>
  `;
}

async function loadDepartments() {
  setStatus('Loading departments…');
  try {
    const res = await fetch('../api/departments', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const list = Array.isArray(payload.data) ? payload.data : [];

    for (const d of list) {
      const opt = document.createElement('option');
      opt.value = d.key;
      opt.textContent = d.name;
      deptSelect.appendChild(opt);
    }

    setStatus('');
  } catch (e) {
    setStatus('Failed to load departments');
  }
}

async function login() {
  const deptKey = deptSelect.value;
  if (!deptKey) {
    setStatus('Select a department');
    return;
  }

  setStatus('Loading students…');
  contentEl.innerHTML = '<div class="card">Loading…</div>';

  try {
    const res = await fetch(`../api/departments/${encodeURIComponent(deptKey)}/participants?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const participants = Array.isArray(payload.data) ? payload.data : [];

    contentEl.innerHTML = participants.length
      ? participants.map(renderParticipantCard).join('')
      : '<div class="card">No students found for this department.</div>';

    setStatus('');
  } catch (e) {
    setStatus('Failed to load students');
    contentEl.innerHTML = '<div class="card">Could not load department students.</div>';
  }
}

loginBtn.addEventListener('click', login);
loadDepartments();
