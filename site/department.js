const deptSelect = document.getElementById('deptSelect');
const eventSelect = document.getElementById('eventSelect');
const loginBtn = document.getElementById('loginBtn');
const statusEl = document.getElementById('status');
const countEl = document.getElementById('count');
const contentEl = document.getElementById('content');

let lastLoadedDeptKey = '';
let lastLoadedParticipants = [];
const departmentsByKey = new Map();

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

const EVENT_NAME_ALIASES = new Map([
  ['operation chiper chase', 'operation cipher chase'],
  ['food fiesta', 'feast fiesta'],
]);

function normalizeEventName(str) {
  const raw = String(str || '').trim().toLowerCase();
  if (!raw) return '';

  const noParens = raw.replace(/\([^)]*\)/g, ' ');
  const cleaned = noParens
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const tokens = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t !== 'and' && t !== 'or');

  const normalized = tokens.join(' ');
  return EVENT_NAME_ALIASES.get(normalized) || normalized;
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

function populateEventFilter(deptKey, participants) {
  if (!eventSelect) return;

  const dept = departmentsByKey.get(deptKey);
  const configured = Array.isArray(dept?.events) ? dept.events : [];

  // Use normalized event name as the key to avoid duplicates from naming variations.
  const uniqueByNorm = new Map();

  for (const name of configured) {
    const display = typeof name === 'string' ? name.trim() : '';
    if (!display) continue;
    uniqueByNorm.set(normalizeEventName(display), display);
  }

  for (const p of participants) {
    for (const name of extractEventNames(p.events)) {
      const display = String(name).trim();
      const norm = normalizeEventName(display);
      if (!norm) continue;
      if (!uniqueByNorm.has(norm)) uniqueByNorm.set(norm, display);
    }
  }

  const eventNames = Array.from(uniqueByNorm.entries()).sort((a, b) => a[1].localeCompare(b[1]));

  eventSelect.innerHTML = '<option value="">All events</option>';
  for (const [norm, display] of eventNames) {
    const opt = document.createElement('option');
    opt.value = norm;
    opt.textContent = display;
    eventSelect.appendChild(opt);
  }
  eventSelect.disabled = false;
  eventSelect.value = '';
}

function renderParticipants() {
  const selectedEventNorm = eventSelect ? eventSelect.value : '';
  const all = Array.isArray(lastLoadedParticipants) ? lastLoadedParticipants : [];

  const filtered = selectedEventNorm
    ? all.filter((p) => extractEventNames(p.events).some((n) => normalizeEventName(n) === selectedEventNorm))
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

    departmentsByKey.clear();

    // Keep the placeholder option, clear any existing items (in case of reload).
    while (deptSelect.options.length > 1) deptSelect.remove(1);

    for (const d of list) {
      if (!d || !d.key) continue;
      departmentsByKey.set(d.key, d);

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
    populateEventFilter(deptKey, participants);
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
