const deptSelect = document.getElementById('deptSelect');
const eventSelect = document.getElementById('eventSelect');
const loginBtn = document.getElementById('loginBtn');
const statusEl = document.getElementById('status');
const countEl = document.getElementById('count');
const contentEl = document.getElementById('content');

let lastLoadedDeptKey = '';
let lastLoadedParticipants = [];

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

function extractEventNames(events) {
  if (!Array.isArray(events)) return [];
  return events
    .map((e) => (typeof e === 'string' ? e : (e && typeof e === 'object' ? (e.eventName || e.name || e.title) : '')))
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);
}

function renderParticipantCard(p) {
  const name = safeText(p.studentName || p.name);
  const eventNames = extractEventNames(p.events);

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

function setCount(visible, total) {
  if (!countEl) return;
  if (!total) {
    countEl.textContent = '';
    return;
  }

  countEl.textContent = `Showing ${visible} of ${total}`;
}

function populateEventFilter(participants) {
  if (!eventSelect) return;

  const unique = new Set();
  for (const p of participants) {
    for (const name of extractEventNames(p.events)) unique.add(name);
  }

  const eventNames = Array.from(unique).sort((a, b) => a.localeCompare(b));
  eventSelect.innerHTML = '<option value="">All events</option>';
  for (const name of eventNames) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    eventSelect.appendChild(opt);
  }
  eventSelect.disabled = false;
  eventSelect.value = '';
}

function renderParticipants() {
  const selectedEvent = eventSelect ? eventSelect.value : '';
  const all = Array.isArray(lastLoadedParticipants) ? lastLoadedParticipants : [];

  const filtered = selectedEvent
    ? all.filter((p) => extractEventNames(p.events).includes(selectedEvent))
    : all;

  contentEl.innerHTML = filtered.length
    ? filtered.map(renderParticipantCard).join('')
    : '<div class="card">No students found for this selection.</div>';

  setCount(filtered.length, all.length);
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
  setCount(0, 0);
  if (eventSelect) {
    eventSelect.disabled = true;
    eventSelect.value = '';
    eventSelect.innerHTML = '<option value="">All events</option>';
  }

  try {
    const res = await fetch(`../api/departments/${encodeURIComponent(deptKey)}/participants?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const participants = Array.isArray(payload.data) ? payload.data : [];

    lastLoadedDeptKey = deptKey;
    lastLoadedParticipants = participants;
    populateEventFilter(participants);
    renderParticipants();

    setStatus('');
  } catch (e) {
    setStatus('Failed to load students');
    setCount(0, 0);
    contentEl.innerHTML = '<div class="card">Could not load department students.</div>';
  }
}

loginBtn.addEventListener('click', login);
if (eventSelect) {
  eventSelect.addEventListener('change', () => {
    if (!lastLoadedDeptKey) return;
    renderParticipants();
  });
}
loadDepartments();
