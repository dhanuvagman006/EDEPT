const summaryEl = document.getElementById('summary');
const statusEl = document.getElementById('status');
const reloadBtn = document.getElementById('reloadBtn');
const deptTableBodyEl = document.getElementById('deptTableBody');

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

function pill(label, value) {
  return `
    <div class="pill">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(String(value))}</div>
    </div>
  `;
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  return String(num);
}

function renderSummary(payload) {
  const totalUsers = payload?.totalUsers ?? 0;
  const totalAmountCollected = payload?.totalAmountCollected ?? 0;

  const top = payload?.highestRegistrationCollegeDept;
  const topLabel = top ? `${top.name} (${top.registrations})` : '—';

  summaryEl.innerHTML = [
    pill('Total users', totalUsers),
    pill('Total collected', money(totalAmountCollected)),
    pill('Highest dept', topLabel),
  ].join('');
}

function renderDepartmentTable(stats) {
  const list = Array.isArray(stats) ? stats : [];

  if (!list.length) {
    deptTableBodyEl.innerHTML = '<tr><td colspan="5" class="muted">No data</td></tr>';
    return;
  }

  deptTableBodyEl.innerHTML = list
    .map((d, idx) => {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(d.name)} <span class="muted">(${escapeHtml(d.key)})</span></td>
          <td style="text-align:right;">${escapeHtml(String(d.registrations ?? 0))}</td>
          <td style="text-align:right;">${escapeHtml(String(d.verifiedPayments ?? 0))}</td>
          <td style="text-align:right;">${escapeHtml(money(d.amountCollected))}</td>
        </tr>
      `;
    })
    .join('');
}

async function loadAdmin() {
  setStatus('Loading…');
  summaryEl.innerHTML = '';
  deptTableBodyEl.innerHTML = '';

  const url = `../sup/sec/admin?ts=${Date.now()}`;

  let res;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    setStatus('Failed to load');
    deptTableBodyEl.innerHTML = '<tr><td colspan="5">Could not fetch admin stats. Ensure the server is running.</td></tr>';
    return;
  }

  if (!res.ok) {
    setStatus(`HTTP ${res.status}`);
    deptTableBodyEl.innerHTML = `<tr><td colspan="5">Server returned ${res.status}.</td></tr>`;
    return;
  }

  let payload;
  try {
    payload = await res.json();
  } catch {
    setStatus('Invalid JSON');
    deptTableBodyEl.innerHTML = '<tr><td colspan="5">Admin response is not valid JSON.</td></tr>';
    return;
  }

  renderSummary(payload);
  renderDepartmentTable(payload.departmentStats);
  setStatus('');
}

reloadBtn.addEventListener('click', loadAdmin);
loadAdmin();
