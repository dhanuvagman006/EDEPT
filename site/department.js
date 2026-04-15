const deptSelect = document.getElementById('deptSelect');
const statusEl = document.getElementById('status');
const countEl = document.getElementById('count');
const contentEl = document.getElementById('content');
const countCardEl = document.getElementById('countCard');
const countSummaryEl = document.getElementById('countSummary');

let currentDeptKey = '';
let allDeptParticipants = [];   // full dept list — used only to build count cards
let activeEventFilter = '';     // '' = all

function setStatus(msg) {
  statusEl.textContent = msg;
}

function setCount(visible, total) {
  if (!countEl) return;
  countEl.textContent = total ? `Showing ${visible} of ${total}` : '';
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

async function downloadPdf(eventName) {
  const deptName = deptSelect.options[deptSelect.selectedIndex]?.text || currentDeptKey;
  const label = eventName || 'All Students';

  const url = eventName
    ? `../api/departments/${encodeURIComponent(currentDeptKey)}/participants?event=${encodeURIComponent(eventName)}`
    : `../api/departments/${encodeURIComponent(currentDeptKey)}/participants`;

  let participants = [];
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error();
    const payload = await res.json();
    participants = Array.isArray(payload.data) ? payload.data : [];
  } catch {
    alert('Failed to fetch participant data for download.');
    return;
  }

  const rows = participants.map((p, i) => {
    const eventNames = extractEventNames(p.events);
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(safeText(p.studentName || p.name))}</td>
        <td>${esc(safeText(p.participantId ?? p.id))}</td>
        <td>${esc(safeText(p.email))}</td>
        <td>${esc(safeText(p.phone))}</td>
        <td>${esc(safeText(p.college))}</td>
        <td>${esc(safeText(p.paymentStatus))}</td>
        <td>${esc(safeText(p.amountPaid))}</td>
        <td>${eventNames.map(esc).join(', ') || '—'}</td>
      </tr>
    `;
  }).join('');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${esc(deptName)} — ${esc(label)}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 24px; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    p  { font-size: 12px; color: #555; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #2563eb; color: #fff; text-align: left; padding: 6px 8px; font-size: 11px; }
    td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background: #f8f9fa; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <h1>${esc(deptName)}</h1>
  <p>Event: ${esc(label)} &nbsp;|&nbsp; Total: ${participants.length} student(s) &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}</p>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Name</th><th>ID</th><th>Email</th><th>Phone</th>
        <th>College</th><th>Payment</th><th>Amount</th><th>Events</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
}

function esc(str) {
  return String(str || '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

// Build count cards from the full dept list and attach click handlers
function renderCountCard() {
  if (!countCardEl || !countSummaryEl || !allDeptParticipants.length) {
    if (countCardEl) countCardEl.hidden = true;
    return;
  }

  const eventCounts = {};
  for (const p of allDeptParticipants) {
    for (const name of extractEventNames(p.events)) {
      eventCounts[name] = (eventCounts[name] || 0) + 1;
    }
  }

  const sorted = Object.entries(eventCounts).sort((a, b) => b[1] - a[1]);

  const allActive = activeEventFilter === '';
  let html = `
    <div class="pill pill--clickable ${allActive ? 'pill--active' : ''}" data-event="">
      <div class="pill-main">
        <div class="label">All Students</div>
        <div class="value">${allDeptParticipants.length}</div>
      </div>
      <button class="pill-download" title="Download PDF" data-event="">&#8681;</button>
    </div>
  `;

  for (const [name, count] of sorted) {
    const active = activeEventFilter === name;
    html += `
      <div class="pill pill--clickable ${active ? 'pill--active' : ''}" data-event="${escapeHtml(name)}">
        <div class="pill-main">
          <div class="label">${escapeHtml(name)}</div>
          <div class="value">${count}</div>
        </div>
        <button class="pill-download" title="Download PDF" data-event="${escapeHtml(name)}">&#8681;</button>
      </div>
    `;
  }

  countSummaryEl.innerHTML = html;
  countCardEl.hidden = false;

  countSummaryEl.querySelectorAll('.pill--clickable').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      if (e.target.closest('.pill-download')) return; // handled separately
      activeEventFilter = pill.dataset.event;
      renderCountCard();
      fetchAndRenderParticipants();
    });
  });

  countSummaryEl.querySelectorAll('.pill-download').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadPdf(btn.dataset.event);
    });
  });
}

// Fetch participants from server — filtered by dept + optionally by event
async function fetchAndRenderParticipants() {
  if (!currentDeptKey) return;

  const url = activeEventFilter
    ? `../api/departments/${encodeURIComponent(currentDeptKey)}/participants?event=${encodeURIComponent(activeEventFilter)}&ts=${Date.now()}`
    : `../api/departments/${encodeURIComponent(currentDeptKey)}/participants?ts=${Date.now()}`;

  contentEl.innerHTML = '<div class="card">Loading…</div>';

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const participants = Array.isArray(payload.data) ? payload.data : [];

    contentEl.innerHTML = participants.length
      ? participants.map(renderParticipantCard).join('')
      : '<div class="card">No students found for this event.</div>';

    setCount(participants.length, allDeptParticipants.length);
  } catch {
    contentEl.innerHTML = '<div class="card">Could not load participants.</div>';
  }
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
  } catch {
    setStatus('Failed to load departments');
  }
}

async function onDeptChange() {
  const deptKey = deptSelect.value;
  if (!deptKey) return;

  currentDeptKey = deptKey;
  activeEventFilter = '';
  allDeptParticipants = [];

  if (countCardEl) countCardEl.hidden = true;
  contentEl.innerHTML = '<div class="card">Loading…</div>';
  setCount(0, 0);
  setStatus('Loading…');

  try {
    // Fetch all dept participants once — used to build count cards
    const res = await fetch(`../api/departments/${encodeURIComponent(deptKey)}/participants?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    allDeptParticipants = Array.isArray(payload.data) ? payload.data : [];

    renderCountCard();

    // Render the full list (already fetched, reuse it)
    contentEl.innerHTML = allDeptParticipants.length
      ? allDeptParticipants.map(renderParticipantCard).join('')
      : '<div class="card">No students found.</div>';

    setCount(allDeptParticipants.length, allDeptParticipants.length);
    setStatus('');
  } catch {
    setStatus('Failed to load students');
    contentEl.innerHTML = '<div class="card">Could not load department students.</div>';
  }
}

deptSelect.addEventListener('change', onDeptChange);
loadDepartments();
