const deptSelect = document.getElementById('deptSelect');
const statusEl = document.getElementById('status');
const countEl = document.getElementById('count');
const contentEl = document.getElementById('content');
const pillsSectionEl = document.getElementById('pillsSection');
const pillsContainerEl = document.getElementById('pillsContainer');
const apiDownOverlay = document.getElementById('apiDownOverlay');
const popupBody = document.getElementById('popupBody');
const popupRetryBtn = document.getElementById('popupRetryBtn');
const popupDismissBtn = document.getElementById('popupDismissBtn');

let allDeptParticipants = [];
let activeEventFilter = null; // null = All Students, string = event name
let deptEventsList = []; // [{ name: string, isMega: boolean }]
let currentDeptName = '';

// ─── Popup ────────────────────────────────────────────────────────────────────

function showApiDownPopup(message) {
  if (message) popupBody.innerHTML = message;
  apiDownOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function hideApiDownPopup() {
  apiDownOverlay.hidden = true;
  document.body.style.overflow = '';
}

popupDismissBtn.addEventListener('click', hideApiDownPopup);
apiDownOverlay.addEventListener('click', (e) => {
  if (e.target === apiDownOverlay) hideApiDownPopup();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideApiDownPopup();
});
popupRetryBtn.addEventListener('click', () => {
  hideApiDownPopup();
  if (deptSelect.value) onDeptChange();
  else loadDepartments();
});

// ─── Utilities ────────────────────────────────────────────────────────────────

function setStatus(msg) {
  statusEl.textContent = msg;
}

function setCount(visible, total) {
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

// ─── Event count computation ──────────────────────────────────────────────────

function computeEventCounts() {
  const counts = new Map();
  for (const ev of deptEventsList) {
    counts.set(ev.name, 0);
  }
  for (const p of allDeptParticipants) {
    for (const name of extractEventNames(p.events)) {
      if (counts.has(name)) {
        counts.set(name, counts.get(name) + 1);
      }
    }
  }
  return counts;
}

// ─── Pills ────────────────────────────────────────────────────────────────────

const downloadSvg = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

function buildPills() {
  const counts = computeEventCounts();

  const sorted = [...deptEventsList]
    .map((ev) => ({ ...ev, count: counts.get(ev.name) || 0 }))
    .sort((a, b) => b.count - a.count);

  const allCount = allDeptParticipants.length;
  const allActive = activeEventFilter === null;

  const allPillHtml = `
    <div class="event-pill event-pill--clickable${allActive ? ' event-pill--active' : ''}"
         data-event="" role="button" tabindex="0" aria-pressed="${allActive}">
      <div class="event-pill__body">
        <div class="event-pill__label">All Students</div>
        <div class="event-pill__count">${allCount}</div>
      </div>
      <button class="event-pill__download" data-event="" type="button" title="Download PDF" aria-label="Download all students as PDF">
        ${downloadSvg}
      </button>
    </div>`;

  const eventPillsHtml = sorted.map((ev) => {
    const isActive = activeEventFilter === ev.name;
    return `
      <div class="event-pill event-pill--clickable${isActive ? ' event-pill--active' : ''}"
           data-event="${escapeHtml(ev.name)}" role="button" tabindex="0" aria-pressed="${isActive}">
        <div class="event-pill__body">
          <div class="event-pill__head">
            <div class="event-pill__label">${escapeHtml(ev.name)}</div>
            ${ev.isMega ? '<span class="event-pill__mega">Mega Event</span>' : ''}
          </div>
          <div class="event-pill__count">${ev.count}</div>
        </div>
        <button class="event-pill__download" data-event="${escapeHtml(ev.name)}" type="button"
                title="Download ${escapeHtml(ev.name)} PDF" aria-label="Download ${escapeHtml(ev.name)} as PDF">
          ${downloadSvg}
        </button>
      </div>`;
  }).join('');

  pillsContainerEl.innerHTML = allPillHtml + eventPillsHtml;
  pillsSectionEl.hidden = false;

  pillsContainerEl.querySelectorAll('.event-pill--clickable').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      if (e.target.closest('.event-pill__download')) return;
      const raw = pill.dataset.event;
      setActiveFilter(raw === '' ? null : raw);
    });
    pill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pill.click();
      }
    });
  });

  pillsContainerEl.querySelectorAll('.event-pill__download').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const raw = btn.dataset.event;
      downloadPdf(raw === '' ? null : raw);
    });
  });
}

// ─── Participants rendering ───────────────────────────────────────────────────

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
        <div class="v">${eventNames.length
          ? `<ul class="list">${eventNames.map((e) => `<li>${escapeHtml(String(e))}</li>`).join('')}</ul>`
          : '<span class="muted">—</span>'
        }</div>
      </div>
    </article>`;
}

function renderParticipants() {
  const filtered = activeEventFilter
    ? allDeptParticipants.filter((p) => extractEventNames(p.events).includes(activeEventFilter))
    : allDeptParticipants;

  contentEl.innerHTML = filtered.length
    ? filtered.map(renderParticipantCard).join('')
    : '<div class="card">No students found for this selection.</div>';

  setCount(filtered.length, allDeptParticipants.length);
}

// ─── Filter + render ──────────────────────────────────────────────────────────

function setActiveFilter(eventName) {
  activeEventFilter = eventName;
  buildPills();
  renderParticipants();
}

function renderAll() {
  buildPills();
  renderParticipants();
}

// ─── PDF download ─────────────────────────────────────────────────────────────

function buildPrintHtml(title, participants) {
  const rows = participants.map((p, i) => {
    const name = escapeHtml(safeText(p.studentName || p.name));
    const id = escapeHtml(safeText(p.participantId ?? p.id));
    const college = escapeHtml(safeText(p.college));
    const phone = escapeHtml(safeText(p.phone));
    const payment = escapeHtml(safeText(p.paymentStatus));
    const events = escapeHtml(extractEventNames(p.events).join(', ') || '—');
    return `<tr>
      <td>${i + 1}</td>
      <td>${name}</td>
      <td>${id}</td>
      <td>${college}</td>
      <td>${phone}</td>
      <td>${payment}</td>
      <td>${events}</td>
    </tr>`;
  }).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; margin: 24px; color: #1a1a1a; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p { margin: 0 0 16px; color: #6b7280; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e5e7eb; padding: 7px 10px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600; }
    tr:nth-child(even) td { background: #f9fafb; }
    @media print { @page { margin: 16mm; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>Total: ${participants.length} student${participants.length !== 1 ? 's' : ''}</p>
  <table>
    <thead>
      <tr><th>#</th><th>Name</th><th>ID</th><th>College</th><th>Phone</th><th>Payment</th><th>Events</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function downloadPdf(eventName) {
  const participants = eventName
    ? allDeptParticipants.filter((p) => extractEventNames(p.events).includes(eventName))
    : allDeptParticipants;

  const label = eventName || 'All Students';
  const title = currentDeptName ? `${currentDeptName} — ${label}` : label;
  const html = buildPrintHtml(title, participants);

  // Use a hidden iframe so no popup blocker is triggered
  const old = document.getElementById('__printFrame');
  if (old) old.remove();

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.id = '__printFrame';
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px;top:-9999px;';
  document.body.appendChild(iframe);

  iframe.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    URL.revokeObjectURL(url);
    setTimeout(() => iframe.remove(), 2000);
  };

  iframe.src = url;
}

// ─── Data loading ─────────────────────────────────────────────────────────────

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
    showApiDownPopup(
      'Could not reach the server to load departments.<br>Make sure <code>npm start</code> is running, then retry.'
    );
  }
}

async function onDeptChange() {
  const deptKey = deptSelect.value;

  if (!deptKey) {
    allDeptParticipants = [];
    deptEventsList = [];
    activeEventFilter = null;
    currentDeptName = '';
    pillsSectionEl.hidden = true;
    pillsContainerEl.innerHTML = '';
    contentEl.innerHTML = '';
    setStatus('');
    setCount(0, 0);
    return;
  }

  setStatus('Loading…');
  contentEl.innerHTML = '<div class="card">Loading…</div>';
  pillsSectionEl.hidden = true;
  pillsContainerEl.innerHTML = '';
  allDeptParticipants = [];
  deptEventsList = [];
  activeEventFilter = null;
  setCount(0, 0);

  try {
    const res = await fetch(
      `../api/departments/${encodeURIComponent(deptKey)}/participants?ts=${Date.now()}`,
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();

    allDeptParticipants = Array.isArray(payload.data) ? payload.data : [];
    currentDeptName = payload.department?.name || deptKey;

    const deptEvents = Array.isArray(payload.department?.events) ? payload.department.events : [];
    const megaSet = new Set(Array.isArray(payload.department?.megaEvents) ? payload.department.megaEvents : []);
    deptEventsList = deptEvents.map((name) => ({ name, isMega: megaSet.has(name) }));

    setStatus('');
    renderAll();
  } catch {
    setStatus('Failed to load students');
    contentEl.innerHTML = '';
    setCount(0, 0);
    showApiDownPopup(
      `Could not load students for <strong>${escapeHtml(currentDeptName || deptKey)}</strong>.<br>` +
      `The participant API may be down. Place a valid <code>response.json</code> in the <code>EDEPT/</code> folder and restart the server.`
    );
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

deptSelect.addEventListener('change', onDeptChange);
loadDepartments();
