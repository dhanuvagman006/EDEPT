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
  return str
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
  const total = participants.length;
  const verified = participants.filter((p) => String(p.paymentStatus || '').toLowerCase() === 'verified').length;
  const paidTotal = participants.reduce((sum, p) => {
    const n = Number(p.amountPaid);
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);

  participantsSummaryEl.innerHTML = [
    pill('Total participants', total),
    pill('Verified payments', verified),
    pill('Total amount paid', paidTotal ? String(paidTotal) : '0'),
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
  const paymentStatus = safeText(p.paymentStatus);
  const badgeText = paymentStatus !== '—' ? `Payment: ${paymentStatus}` : 'Payment: —';

  const events = Array.isArray(p.events) ? p.events : [];
  const teams = Array.isArray(p.teams) ? p.teams : [];

  const eventsHtml = events.length
    ? `<ul class="list">${events.map((e) => `<li>${escapeHtml(String(e))}</li>`).join('')}</ul>`
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
          <span class="badge">${escapeHtml(badgeText)}</span>
        </div>
        <div class="muted">ID: ${escapeHtml(safeText(p.id))}</div>
      </div>

      <div class="kv">
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

      const eventMatch = events.some((e) => String(e || '').toLowerCase().includes(eventQ));
      const teamMatch = teams.some((t) => String(t?.eventName || '').toLowerCase().includes(eventQ));

      if (!eventMatch && !teamMatch) return false;
    }

    return true;
  });

  renderParticipantsSummary(filtered);
  renderParticipantsList(filtered);

  if (nameQ || eventQ) {
    setParticipantsStatus(`Showing ${filtered.length} of ${allParticipants.length}`);
  } else {
    setParticipantsStatus(`Loaded ${allParticipants.length} participant(s)`);
  }
}

async function loadParticipants() {
  setParticipantsStatus('Loading…');
  participantsContentEl.innerHTML = '<div class="card">Loading…</div>';
  participantsSummaryEl.innerHTML = '';

  const url = `../response.json?ts=${Date.now()}`;

  let res;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    setParticipantsStatus('Failed to load response.json');
    participantsContentEl.innerHTML = `<div class="card">Could not fetch <code>response.json</code>. Run <code>npm run fetch</code> and refresh.</div>`;
    return;
  }

  if (!res.ok) {
    setParticipantsStatus(`HTTP ${res.status}`);
    participantsContentEl.innerHTML = `<div class="card">Server returned ${res.status} when requesting <code>response.json</code>.</div>`;
    return;
  }

  const text = await res.text();

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    setParticipantsStatus('response.json is not valid JSON');
    participantsContentEl.innerHTML = `<div class="card"><code>response.json</code> is not valid JSON.</div>`;
    return;
  }

  const participants = asArray(payload);
  if (!participants) {
    setParticipantsStatus('Unrecognized JSON shape');
    participantsContentEl.innerHTML = `<div class="card">Loaded JSON but couldn't find a participants array. Expected an array or an object with <code>data</code>/<code>participants</code>/<code>items</code>.</div>`;
    return;
  }

  allParticipants = participants;
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

function renderTeamsList(teams) {
  teamsContentEl.innerHTML = '';

  if (teams.length === 0) {
    teamsContentEl.innerHTML = `<div class="card">No teams found in teams.json.</div>`;
    return;
  }

  teamsContentEl.innerHTML = teams.map(renderTeamCard).join('');
}

function applyTeamsFilter() {
  const q = (teamsSearchInput?.value || '').trim().toLowerCase();

  const filtered = q
    ? allTeams.filter((t) => {
        const teamName = safeText(t.teamName).toLowerCase();
        const eventName = safeText(t.eventName).toLowerCase();
        const leader = safeText(t.leader).toLowerCase();
        return teamName.includes(q) || eventName.includes(q) || leader.includes(q);
      })
    : allTeams;

  renderTeamsSummary(filtered);
  renderTeamsList(filtered);

  if (q) {
    setTeamsStatus(`Showing ${filtered.length} of ${allTeams.length}`);
  } else {
    setTeamsStatus(`Loaded ${allTeams.length} team(s)`);
  }
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

  const url = `../teams.json?ts=${Date.now()}`;

  let res;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    setTeamsStatus('Failed to load teams.json');
    teamsContentEl.innerHTML = `<div class="card">Could not fetch <code>teams.json</code>. Run <code>node team_details.js</code> and refresh.</div>`;
    return;
  }

  if (!res.ok) {
    setTeamsStatus(`HTTP ${res.status}`);
    teamsContentEl.innerHTML = `<div class="card">Server returned ${res.status} when requesting <code>teams.json</code>.</div>`;
    return;
  }

  const text = await res.text();

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    setTeamsStatus('teams.json is not valid JSON');
    teamsContentEl.innerHTML = `<div class="card"><code>teams.json</code> is not valid JSON.</div>`;
    return;
  }

  const teams = asArray(payload);
  if (!teams) {
    setTeamsStatus('Unrecognized JSON shape');
    teamsContentEl.innerHTML = `<div class="card">Loaded JSON but couldn't find a teams array. Expected an array or an object with <code>data</code>/<code>teams</code>/<code>items</code>.</div>`;
    return;
  }

  allTeams = teams;
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
