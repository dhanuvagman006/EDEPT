const pageTitleEl = document.getElementById('pageTitle');
const pageSubtitleEl = document.getElementById('pageSubtitle');
const participantsNavBtn = document.getElementById('participantsNavBtn');
const teamsNavBtn = document.getElementById('teamsNavBtn');

const participantsViewEl = document.getElementById('participantsView');
const teamsViewEl = document.getElementById('teamsView');

// Participants elements
const participantsContentEl = document.getElementById('content');
const participantsSummaryEl = document.getElementById('summary');
const participantsStatusEl = document.getElementById('status');
const participantsReloadBtn = document.getElementById('reloadBtn');
const searchInput = document.getElementById('searchInput');
const eventSearchInput = document.getElementById('eventSearchInput');

// Teams elements
const teamsContentEl = document.getElementById('teamsContent');
const teamsSummaryEl = document.getElementById('teamsSummary');
const teamsStatusEl = document.getElementById('teamsStatus');
const teamsReloadBtn = document.getElementById('teamsReloadBtn');
const teamsSearchInput = document.getElementById('teamsSearchInput');

let allParticipants = [];
let allTeams = [];
let teamsLoadedOnce = false;
let activeTeamEventFilter = null; // null = all events

function setParticipantsStatus(msg) {
  participantsStatusEl.textContent = msg;
}

function setTeamsStatus(msg) {
  teamsStatusEl.textContent = msg;
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.participants)) return payload.participants;
  if (payload && Array.isArray(payload.teams)) return payload.teams;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return null;
}

function safeText(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string') return v.trim() || '—';
  return String(v);
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function pill(label, value) {
  return `
    <div class="pill">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(String(value))}</div>
    </div>
  `;
}

// ---------------------
// Participants rendering
// ---------------------

function renderParticipantsSummary(participants) {
  const couponsReceived = participants.filter((p) => Boolean(p.foodCouponReceived)).length;

  participantsSummaryEl.innerHTML = [
    pill('Coupons received', couponsReceived),
  ].join('');
}

function renderParticipantsList(participants) {
  participantsContentEl.innerHTML = '';

  if (participants.length === 0) {
    participantsContentEl.innerHTML = `<div class="card">No participants found in response.json.</div>`;
    return;
  }

  const html = participants.map(renderParticipantCard).join('');
  participantsContentEl.innerHTML = html;
}

function renderParticipantCard(p) {
  const name = safeText(p.studentName || p.name);

  const participantId = String(p.participantId ?? p.id ?? '').trim();
  const couponReceived = Boolean(p.foodCouponReceived);
  const couponBadgeHtml = participantId
    ? `<span class="badge ${couponReceived ? 'badge--success' : 'badge--pending'}">Coupon: ${couponReceived ? 'Received' : 'Not received'}</span>`
    : '<span class="badge badge--pending">Coupon: —</span>';

  const couponToggleHtml = participantId
    ? `<label class="couponToggleLabel">
        <input type="checkbox" class="couponToggle" data-participant-id="${escapeHtml(participantId)}" ${couponReceived ? 'checked' : ''} />
        <span>${couponReceived ? 'Received' : 'Not received'}</span>
      </label>`
    : '<span class="muted">—</span>';

  const events = Array.isArray(p.events) ? p.events : [];
  const teams = Array.isArray(p.teams) ? p.teams : [];

  const eventNames = events
    .map((e) => (typeof e === 'string' ? e : (e && typeof e === 'object' ? (e.eventName || e.name || e.title) : '')))
    .filter(Boolean);

  const eventsHtml = eventNames.length
    ? `<ul class="list">${eventNames.map((e) => `<li>${escapeHtml(String(e))}</li>`).join('')}</ul>`
    : '<div class="muted">—</div>';

  const teamsHtml = teams.length
    ? teams
        .map((t) => {
          const members = Array.isArray(t.members) ? t.members : [];
          const membersHtml = members.length
            ? `<ul class="list">${members
                .map((m) => {
                  const leader = m.isLeader ? ' (Leader)' : '';
                  return `<li>${escapeHtml(safeText(m.name))} — ${escapeHtml(safeText(m.envId))}${escapeHtml(leader)}</li>`;
                })
                .join('')}</ul>`
            : '<div class="muted">—</div>';

          return `
            <div class="card" style="padding:10px; background: var(--surface2);">
              <div class="cardHeader">
                <div class="cardTitle">
                  <h2>${escapeHtml(safeText(t.eventName))}</h2>
                  <span class="badge">${escapeHtml(safeText(t.department))}</span>
                </div>
                <div class="muted">Team: ${escapeHtml(safeText(t.teamName))}</div>
              </div>
              <div class="kv">
                <div class="k">Members</div>
                <div class="v">${membersHtml}</div>
              </div>
            </div>
          `;
        })
        .join('')
    : '<div class="muted">—</div>';

  return `
    <article class="card">
      <div class="cardHeader">
        <div class="cardTitle">
          <h2>${escapeHtml(name)}</h2>
          ${couponBadgeHtml}
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

        <div class="k">Amount paid</div>
        <div class="v">${escapeHtml(safeText(p.amountPaid))}</div>

        <div class="k">UTR ID</div>
        <div class="v">${escapeHtml(safeText(p.utrId))}</div>

        <div class="k">Registered</div>
        <div class="v">${escapeHtml(formatDate(p.registeredAt))}</div>
      </div>

      <details>
        <summary>View events and teams</summary>
        <div class="kv">
          <div class="k">Events</div>
          <div class="v">${eventsHtml}</div>

          <div class="k">Teams</div>
          <div class="v">${teamsHtml}</div>
        </div>
      </details>
    </article>
  `;
}

function applyParticipantsFilter() {
  const nameQ = (searchInput?.value || '').trim().toLowerCase();
  const eventQ = (eventSearchInput?.value || '').trim().toLowerCase();

  const filtered = allParticipants.filter((p) => {
    if (nameQ) {
      const name = safeText(p.studentName || p.name).toLowerCase();
      if (!name.includes(nameQ)) return false;
    }

    if (eventQ) {
      const events = Array.isArray(p.events) ? p.events : [];
      const teams = Array.isArray(p.teams) ? p.teams : [];

      const eventMatch = events.some((e) => {
        if (typeof e === 'string') return e.toLowerCase().includes(eventQ);
        if (e && typeof e === 'object') {
          const name = String(e.eventName || e.name || e.title || '');
          return name.toLowerCase().includes(eventQ);
        }
        return false;
      });
      const teamMatch = teams.some((t) => String(t?.eventName || '').toLowerCase().includes(eventQ));

      if (!eventMatch && !teamMatch) return false;
    }

    return true;
  });

  renderParticipantsList(filtered);
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

if (participantsContentEl) {
  participantsContentEl.addEventListener('change', async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.classList.contains('couponToggle')) return;

    const participantId = String(target.dataset.participantId || '').trim();
    if (!participantId) return;

    const received = Boolean(target.checked);

    target.disabled = true;
    setParticipantsStatus('Saving coupon status…');

    try {
      await setFoodCouponStatus(participantId, received);

      const p = allParticipants.find((x) => participantKey(x) === participantId);
      if (p) p.foodCouponReceived = received;

      renderParticipantsSummary(allParticipants);
      setParticipantsStatus('');
      applyParticipantsFilter();
    } catch {
      target.checked = !received;
      setParticipantsStatus('Failed to save coupon status');
    } finally {
      target.disabled = false;
    }
  });
}

async function loadParticipants() {
  setParticipantsStatus('Loading…');
  participantsContentEl.innerHTML = '<div class="card">Loading…</div>';
  participantsSummaryEl.innerHTML = '';

  const url = `../api/participants?ts=${Date.now()}`;

  let res;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    setParticipantsStatus('Failed to load participants');
    participantsContentEl.innerHTML = `<div class="card">Could not fetch participants. Ensure the server is running and refresh.</div>`;
    return;
  }

  if (!res.ok) {
    setParticipantsStatus(`HTTP ${res.status}`);
    participantsContentEl.innerHTML = `<div class="card">Server returned ${res.status} when requesting participants.</div>`;
    return;
  }

  const text = await res.text();

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    setParticipantsStatus('Response is not valid JSON');
    participantsContentEl.innerHTML = `<div class="card">Participants response is not valid JSON.</div>`;
    return;
  }

  const participants = asArray(payload);
  if (!participants) {
    setParticipantsStatus('Unrecognized JSON shape');
    participantsContentEl.innerHTML = `<div class="card">Loaded JSON but couldn't find a participants array. Expected an array or an object with <code>data</code>/<code>participants</code>/<code>items</code>.</div>`;
    return;
  }

  allParticipants = participants;
  renderParticipantsSummary(allParticipants);
  applyParticipantsFilter();
}

// -------------
// Teams rendering
// -------------

function renderTeamsSummary(teams) {
  const totalTeams = teams.length;
  const totalMembers = teams.reduce((sum, t) => {
    const members = Array.isArray(t.members) ? t.members : [];
    return sum + members.length;
  }, 0);
  const uniqueEvents = new Set(teams.map((t) => safeText(t.eventName)).filter((v) => v !== '—')).size;

  teamsSummaryEl.innerHTML = [
    pill('Total teams', totalTeams),
    pill('Unique events', uniqueEvents),
    pill('Total members', totalMembers),
  ].join('');
}

function buildTeamEventPills() {
  const pillsEl = document.getElementById('teamsPillsContainer');
  if (!pillsEl) return;

  if (allTeams.length === 0) {
    pillsEl.innerHTML = '';
    pillsEl.hidden = true;
    return;
  }

  // Count teams per event, sorted by count desc
  const eventCounts = new Map();
  for (const t of allTeams) {
    const ev = safeText(t.eventName);
    if (ev === '—') continue;
    eventCounts.set(ev, (eventCounts.get(ev) || 0) + 1);
  }
  const sorted = [...eventCounts.entries()].sort((a, b) => b[1] - a[1]);
  const allActive = activeTeamEventFilter === null;

  const allPill = `
    <div class="event-pill event-pill--clickable${allActive ? ' event-pill--active' : ''}"
         data-event="" role="button" tabindex="0" aria-pressed="${allActive}">
      <div class="event-pill__body">
        <div class="event-pill__head">
          <div class="event-pill__label">All Events</div>
        </div>
        <div class="event-pill__count">${allTeams.length}</div>
      </div>
    </div>`;

  const eventPills = sorted.map(([ev, count]) => {
    const isActive = activeTeamEventFilter === ev;
    return `
      <div class="event-pill event-pill--clickable${isActive ? ' event-pill--active' : ''}"
           data-event="${escapeHtml(ev)}" role="button" tabindex="0" aria-pressed="${isActive}">
        <div class="event-pill__body">
          <div class="event-pill__head">
            <div class="event-pill__label">${escapeHtml(ev)}</div>
          </div>
          <div class="event-pill__count">${count}</div>
        </div>
      </div>`;
  }).join('');

  pillsEl.innerHTML = allPill + eventPills;
  pillsEl.hidden = false;

  pillsEl.querySelectorAll('.event-pill--clickable').forEach((pill) => {
    pill.addEventListener('click', () => {
      const raw = pill.dataset.event;
      activeTeamEventFilter = raw === '' ? null : raw;
      buildTeamEventPills();
      applyTeamsFilter();
    });
  });
}

function renderTeamsList(teams) {
  teamsContentEl.innerHTML = '';
  if (teams.length === 0) {
    teamsContentEl.innerHTML = `<div class="card">No teams found for this selection.</div>`;
    return;
  }
  teamsContentEl.innerHTML = teams.map(renderTeamCard).join('');
}

function applyTeamsFilter() {
  const q = (teamsSearchInput?.value || '').trim().toLowerCase();

  let filtered = activeTeamEventFilter
    ? allTeams.filter((t) => safeText(t.eventName) === activeTeamEventFilter)
    : allTeams;

  if (q) {
    filtered = filtered.filter((t) => {
      const members = Array.isArray(t.members) ? t.members : [];
      return safeText(t.teamName).toLowerCase().includes(q)
        || safeText(t.eventName).toLowerCase().includes(q)
        || safeText(t.department).toLowerCase().includes(q)
        || members.some((m) => safeText(m.name).toLowerCase().includes(q));
    });
  }

  const base = activeTeamEventFilter
    ? allTeams.filter((t) => safeText(t.eventName) === activeTeamEventFilter).length
    : allTeams.length;

  renderTeamsSummary(filtered);
  renderTeamsList(filtered);
  setTeamsStatus(q ? `Showing ${filtered.length} of ${base}` : `${base} team${base !== 1 ? 's' : ''}`);
}

function renderTeamCard(t) {
  const eventName = safeText(t.eventName);
  const department = safeText(t.department);
  const teamName = safeText(t.teamName);
  const members = Array.isArray(t.members) ? t.members : [];

  const membersHtml = members.length
    ? `<ul class="list">${members
        .map((m) => {
          const leader = m.isLeader ? ' (Leader)' : '';
          return `<li>${escapeHtml(safeText(m.name))} — ${escapeHtml(safeText(m.envId))}${escapeHtml(leader)}</li>`;
        })
        .join('')}</ul>`
    : '<div class="muted">—</div>';

  return `
    <article class="card">
      <div class="cardHeader">
        <div class="cardTitle">
          <h2>${escapeHtml(eventName)}</h2>
          <span class="badge">${escapeHtml(department)}</span>
        </div>
        <div class="muted">Team: ${escapeHtml(teamName)} • ID: ${escapeHtml(safeText(t.id))}</div>
      </div>

      <div class="kv">
        <div class="k">Members</div>
        <div class="v">${membersHtml}</div>
      </div>
    </article>
  `;
}

async function loadTeams() {
  setTeamsStatus('Loading…');
  teamsContentEl.innerHTML = '<div class="card">Loading…</div>';
  teamsSummaryEl.innerHTML = '';
  activeTeamEventFilter = null;

  const pillsEl = document.getElementById('teamsPillsContainer');
  if (pillsEl) { pillsEl.innerHTML = ''; pillsEl.hidden = true; }

  let res;
  try {
    res = await fetch(`../api/teams?ts=${Date.now()}`, { cache: 'no-store' });
  } catch {
    setTeamsStatus('Failed to connect');
    teamsContentEl.innerHTML = `<div class="card">Could not reach the server. Make sure it is running.</div>`;
    return;
  }

  if (!res.ok) {
    setTeamsStatus(`HTTP ${res.status}`);
    teamsContentEl.innerHTML = `<div class="card">Server error ${res.status}.</div>`;
    return;
  }

  let payload;
  try {
    payload = await res.json();
  } catch {
    setTeamsStatus('Invalid response');
    teamsContentEl.innerHTML = `<div class="card">Server returned invalid JSON.</div>`;
    return;
  }

  const teams = asArray(payload);
  if (!teams || teams.length === 0) {
    setTeamsStatus('No teams data');
    teamsContentEl.innerHTML = `
      <div class="card">
        No teams data available yet.<br><br>
        To load teams, provide auth credentials and run:<br>
        <code>$env:ENVISIONSIT_BEARER_TOKEN = "your-token"; npm run fetch:teams</code><br>
        then restart the server.
      </div>`;
    teamsSummaryEl.innerHTML = '';
    return;
  }

  allTeams = teams;
  buildTeamEventPills();
  applyTeamsFilter();
  teamsLoadedOnce = true;
}

// ---------
// Navigation
// ---------

function setActiveNav(view) {
  participantsNavBtn.removeAttribute('aria-current');
  teamsNavBtn.removeAttribute('aria-current');

  if (view === 'teams') {
    teamsNavBtn.setAttribute('aria-current', 'page');
  } else {
    participantsNavBtn.setAttribute('aria-current', 'page');
  }
}

function showView(view) {
  const isTeams = view === 'teams';

  participantsViewEl.hidden = isTeams;
  teamsViewEl.hidden = !isTeams;

  if (isTeams) {
    pageTitleEl.textContent = 'Teams';
    pageSubtitleEl.innerHTML = 'Shows the contents of <code>teams.json</code>.';
    setActiveNav('teams');
  } else {
    pageTitleEl.textContent = 'Participants';
    pageSubtitleEl.innerHTML = 'Shows the contents of <code>response.json</code>.';
    setActiveNav('participants');
  }
}

function syncRoute() {
  const hash = (window.location.hash || '').toLowerCase();
  const view = hash === '#teams' ? 'teams' : 'participants';
  showView(view);

  if (view === 'teams' && !teamsLoadedOnce) {
    loadTeams();
  }
}

participantsNavBtn.addEventListener('click', () => {
  window.location.hash = '#participants';
});

teamsNavBtn.addEventListener('click', () => {
  window.location.hash = '#teams';
});

window.addEventListener('hashchange', syncRoute);

participantsReloadBtn.addEventListener('click', loadParticipants);
searchInput?.addEventListener('input', applyParticipantsFilter);
eventSearchInput?.addEventListener('input', applyParticipantsFilter);

teamsReloadBtn.addEventListener('click', loadTeams);
teamsSearchInput?.addEventListener('input', applyTeamsFilter);

// Initial load
syncRoute();
loadParticipants();
