const deptSelect = document.getElementById('deptSelect');
const statusEl = document.getElementById('status');
const countEl = document.getElementById('count');
const contentEl = document.getElementById('content');
const pillsSectionEl = document.getElementById('pillsSection');
const pillsContainerEl = document.getElementById('pillsContainer');

const apiDownOverlayEl = document.getElementById('apiDownOverlay');
const popupBodyEl = document.getElementById('popupBody');
const popupRetryBtn = document.getElementById('popupRetryBtn');
const popupDismissBtn = document.getElementById('popupDismissBtn');

const departmentsByKey = new Map();

let allDeptParticipants = [];
let deptEventsList = []; // [{ name, norm, isMega }]
let activeEventFilter = null; // null = all
let currentDeptName = '';

let popupRetryHandler = null;

function setStatus(msg) {
  if (!statusEl) return;
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

function hideApiDownPopup() {
  if (!apiDownOverlayEl) return;
  apiDownOverlayEl.hidden = true;
  popupRetryHandler = null;
}

function showApiDownPopup(html, { onRetry } = {}) {
  if (!apiDownOverlayEl || !popupBodyEl) return;
  popupBodyEl.innerHTML = String(html || '');
  apiDownOverlayEl.hidden = false;
  popupRetryHandler = typeof onRetry === 'function' ? onRetry : null;
}

if (popupRetryBtn) {
  popupRetryBtn.addEventListener('click', () => {
    const fn = popupRetryHandler;
    hideApiDownPopup();
    if (fn) fn();
  });
}

if (popupDismissBtn) {
  popupDismissBtn.addEventListener('click', hideApiDownPopup);
}

if (apiDownOverlayEl) {
  apiDownOverlayEl.addEventListener('click', (e) => {
    if (e.target === apiDownOverlayEl) hideApiDownPopup();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideApiDownPopup();
});

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

function buildDeptEventsList(dept, participants) {
  const megaNorms = new Set((dept?.megaEvents || []).map(normalizeEventName));

  const baseEvents = Array.isArray(dept?.events) ? dept.events : [];
  if (baseEvents.length) {
    return baseEvents.map((name) => {
      const norm = normalizeEventName(name);
      return {
        name,
        norm,
        isMega: megaNorms.has(norm),
      };
    });
  }

  // Fallback: derive from payload if the API didn't include department.events.
  const unique = new Map(); // norm -> display
  for (const p of participants) {
    for (const n of extractEventNames(p?.events)) {
      const norm = normalizeEventName(n);
      if (!norm) continue;
      if (!unique.has(norm)) unique.set(norm, n);
    }
  }

  return [...unique.entries()]
    .map(([norm, name]) => ({ name, norm, isMega: megaNorms.has(norm) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function participantMatchesEventNorm(p, targetNorm) {
  if (!targetNorm) return false;
  return extractEventNames(p?.events).some((n) => normalizeEventName(n) === targetNorm);
}

function computeEventCounts() {
  const counts = new Map();
  const canonicalByNorm = new Map();

  for (const ev of deptEventsList) {
    counts.set(ev.name, 0);
    canonicalByNorm.set(ev.norm, ev.name);
  }

  for (const p of allDeptParticipants) {
    for (const n of extractEventNames(p?.events)) {
      const canonical = canonicalByNorm.get(normalizeEventName(n));
      if (!canonical) continue;
      counts.set(canonical, (counts.get(canonical) || 0) + 1);
    }
  }

  return counts;
}

const downloadSvg = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

function buildPills() {
  if (!pillsSectionEl || !pillsContainerEl) return;

  if (!deptEventsList.length) {
    pillsContainerEl.innerHTML = '';
    pillsSectionEl.hidden = true;
    return;
  }

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
      <button class="event-pill__download" data-event="" type="button" title="Download" aria-label="Print all students">
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
                title="Download" aria-label="Print ${escapeHtml(ev.name)}">
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

function renderParticipantCard(p) {
  const name = safeText(p.studentName || p.name);
  const eventNames = extractEventNames(p.events);

  const participantId = String(p.participantId ?? p.id ?? '').trim();
  const couponReceived = Boolean(p.foodCouponReceived);

  const paymentBadgeHtml = `<span class="badge">${escapeHtml(safeText(p.paymentStatus))}</span>`;
  const couponBadgeHtml = participantId
    ? `<span class="badge ${couponReceived ? 'badge--success' : 'badge--pending'}">Coupon: ${couponReceived ? 'Received' : 'Not received'}</span>`
    : '<span class="badge badge--pending">Coupon: —</span>';

  const couponToggleHtml = participantId
    ? `<label class="couponToggleLabel">
        <input type="checkbox" class="couponToggle" data-participant-id="${escapeHtml(participantId)}" ${couponReceived ? 'checked' : ''} />
        <span>${couponReceived ? 'Received' : 'Not received'}</span>
      </label>`
    : '<span class="muted">—</span>';

  return `
    <article class="card">
      <div class="cardHeader">
        <div class="cardTitle">
          <h2>${escapeHtml(name)}</h2>
          <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
            ${paymentBadgeHtml}
            ${couponBadgeHtml}
          </div>
        </div>
        <div class="muted">ID: ${escapeHtml(safeText(p.participantId ?? p.id))}</div>
      </div>
      <div class="kv">
        <div class="k">Food coupon</div>
        <div class="v">${couponToggleHtml}</div>

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
    </article>
  `;
}

function participantKey(p) {
  return String(p?.participantId ?? p?.id ?? '').trim();
}

async function setFoodCouponStatus(participantId, received) {
  const res = await fetch('../api/food-coupons', {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    cache: 'no-store',
    body: JSON.stringify({ participantId, received }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json().catch(() => ({}));
}

if (contentEl) {
  contentEl.addEventListener('change', async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.classList.contains('couponToggle')) return;

    const participantId = String(target.dataset.participantId || '').trim();
    if (!participantId) return;

    const received = Boolean(target.checked);

    target.disabled = true;
    setStatus('Saving coupon status…');

    try {
      await setFoodCouponStatus(participantId, received);

      const p = allDeptParticipants.find((x) => participantKey(x) === participantId);
      if (p) p.foodCouponReceived = received;

      setStatus('');
      renderParticipants();
    } catch {
      target.checked = !received;
      setStatus('Failed to save coupon status');
    } finally {
      target.disabled = false;
    }
  });
}

function renderParticipants() {
  if (!contentEl) return;

  const all = Array.isArray(allDeptParticipants) ? allDeptParticipants : [];

  let filtered = all;
  if (activeEventFilter) {
    const ev = deptEventsList.find((x) => x.name === activeEventFilter);
    const norm = ev?.norm;
    filtered = norm ? all.filter((p) => participantMatchesEventNorm(p, norm)) : all;
  }

  contentEl.innerHTML = filtered.length
    ? filtered.map(renderParticipantCard).join('')
    : '<div class="card">No students found for this selection.</div>';

  setCount(filtered.length, all.length);
}

function setActiveFilter(eventName) {
  activeEventFilter = eventName;
  buildPills();
  renderParticipants();
}

function renderAll() {
  buildPills();
  renderParticipants();
}

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
    ? (() => {
      const ev = deptEventsList.find((x) => x.name === eventName);
      const norm = ev?.norm;
      return norm ? allDeptParticipants.filter((p) => participantMatchesEventNorm(p, norm)) : allDeptParticipants;
    })()
    : allDeptParticipants;

  const label = eventName || 'All Students';
  const title = currentDeptName ? `${currentDeptName} — ${label}` : label;
  const html = buildPrintHtml(title, participants);

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

async function loadDepartments() {
  if (!deptSelect) return;

  // Common mistake: opening the HTML directly from disk.
  if (window.location.protocol === 'file:') {
    setStatus('');
    showApiDownPopup(
      'This page must be opened from the local server.<br>' +
      'Run <code>npm start</code> and open <code>http://localhost:3000/site/department.html</code>.',
      { onRetry: () => window.location.reload() }
    );
    return;
  }

  setStatus('Loading departments…');

  try {
    const res = await fetch('../api/departments', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const payload = await res.json();
    const list = Array.isArray(payload.data) ? payload.data : [];

    // Keep the placeholder option, clear the rest.
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
  } catch {
    setStatus('Failed to load departments');
    showApiDownPopup(
      'Could not reach the server to load departments.<br>Make sure <code>npm start</code> is running, then retry.',
      { onRetry: loadDepartments }
    );
  }
}

async function onDeptChange() {
  if (!deptSelect) return;

  const deptKey = deptSelect.value;

  if (!deptKey) {
    allDeptParticipants = [];
    deptEventsList = [];
    activeEventFilter = null;
    currentDeptName = '';

    if (pillsSectionEl) pillsSectionEl.hidden = true;
    if (pillsContainerEl) pillsContainerEl.innerHTML = '';
    if (contentEl) contentEl.innerHTML = '';

    setStatus('');
    setCount(0, 0);
    return;
  }

  const deptMeta = departmentsByKey.get(deptKey);
  currentDeptName = deptMeta?.name || deptKey;

  setStatus('Loading…');
  if (contentEl) contentEl.innerHTML = '<div class="card">Loading…</div>';
  if (pillsSectionEl) pillsSectionEl.hidden = true;
  if (pillsContainerEl) pillsContainerEl.innerHTML = '';
  allDeptParticipants = [];
  deptEventsList = [];
  activeEventFilter = null;
  setCount(0, 0);

  try {
    const res = await fetch(`../api/departments/${encodeURIComponent(deptKey)}/participants?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const payload = await res.json();
    const participants = Array.isArray(payload.data) ? payload.data : [];

    const deptFromApi = payload?.department && typeof payload.department === 'object' ? payload.department : null;
    currentDeptName = deptFromApi?.name || deptMeta?.name || deptKey;

    allDeptParticipants = participants;
    deptEventsList = buildDeptEventsList(deptFromApi || deptMeta || {}, participants);
    activeEventFilter = null;

    setStatus('');
    renderAll();
  } catch {
    setStatus('Failed to load students');
    if (contentEl) contentEl.innerHTML = '';
    setCount(0, 0);

    showApiDownPopup(
      `Could not load students for <strong>${escapeHtml(currentDeptName || deptKey)}</strong>.<br>` +
      `The participant API may be down. Place a valid <code>response.json</code> in the <code>EDEPT/</code> folder and restart the server.`,
      { onRetry: onDeptChange }
    );
  }
}

if (deptSelect) {
  deptSelect.addEventListener('change', onDeptChange);
}

loadDepartments();
