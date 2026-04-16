const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');
const { spawn } = require('node:child_process');
const { DEPARTMENTS } = require('./departments');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);

const PARTICIPANTS_ENDPOINT = String(
  process.env.PARTICIPANTS_ENDPOINT || 'https://envisionsit.in/api/v1/registrations/export/all-participants'
);
const PARTICIPANTS_CACHE_MS = (() => {
  const n = Number(process.env.PARTICIPANTS_CACHE_MS || 300000); // default 5 min
  return Number.isFinite(n) && n >= 0 ? n : 300000;
})();

const AUTO_REFRESH = String(process.env.AUTO_REFRESH || '').toLowerCase() !== '0';
const REFRESH_INTERVAL_MINUTES = Number(process.env.REFRESH_INTERVAL_MINUTES || 10);
const REFRESH_INTERVAL_MS = Number.isFinite(REFRESH_INTERVAL_MINUTES) && REFRESH_INTERVAL_MINUTES > 0
  ? REFRESH_INTERVAL_MINUTES * 60 * 1000
  : 0;

let refreshInProgress = false;

let cachedParticipantsPayload = null;
let cachedParticipantsAt = 0;
let backgroundRefreshPromise = null;

async function fetchParticipantsPayloadFromApi() {
  const res = await fetch(PARTICIPANTS_ENDPOINT, {
    method: 'GET',
    headers: {
      accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
    },
  });

  const text = await res.text();
  if (!res.ok) {
    const msg = `Upstream participants API failed: ${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.statusCode = res.status;
    err.body = text;
    throw err;
  }

  const payload = JSON.parse(text);

  cachedParticipantsPayload = payload;
  cachedParticipantsAt = Date.now();

  // Best-effort write to disk so /response.json still works.
  fs.writeFile(path.join(ROOT, 'response.json'), JSON.stringify(payload, null, 2), 'utf8').catch(() => {});

  return payload;
}

async function refreshCacheInBackground() {
  if (backgroundRefreshPromise) return;
  backgroundRefreshPromise = (async () => {
    try {
      await fetchParticipantsPayloadFromApi();
    } catch {
      // API unavailable — re-stamp the cache so we don't retry every request
      if (cachedParticipantsPayload) cachedParticipantsAt = Date.now();
    }
  })().finally(() => { backgroundRefreshPromise = null; });
}

async function getParticipantsPayload({ allowFileFallback = true } = {}) {
  const now = Date.now();

  // Cache hit — return immediately
  if (cachedParticipantsPayload && now - cachedParticipantsAt < PARTICIPANTS_CACHE_MS) {
    return cachedParticipantsPayload;
  }

  // Stale cache exists — return it instantly, refresh in background
  if (cachedParticipantsPayload) {
    refreshCacheInBackground();
    return cachedParticipantsPayload;
  }

  // No cache at all (first request) — must wait
  try {
    return await fetchParticipantsPayloadFromApi();
  } catch (e) {
    if (!allowFileFallback) throw e;
    const payload = await readJsonFile('response.json');
    cachedParticipantsPayload = payload;
    cachedParticipantsAt = now;
    return payload;
  }
}

function runNodeScript(scriptFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, scriptFile)], {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        QUIET: '1',
      },
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptFile} exited with code ${code}`));
    });
  });
}

async function refreshData() {
  if (refreshInProgress) return;
  refreshInProgress = true;

  const startedAt = Date.now();
  try {
    await runNodeScript('fetch_participents.js');
    const wantsTeams = ['1', 'true', 'yes'].includes(String(process.env.FETCH_TEAMS || '').toLowerCase());
    const hasTeamsAuth = Boolean(String(process.env.ENVISIONSIT_BEARER_TOKEN || '').trim())
      || Boolean(String(process.env.ENVISIONSIT_COOKIE || '').trim());

    if (wantsTeams || hasTeamsAuth) {
      await runNodeScript('team_details.js');
    }
    const ms = Date.now() - startedAt;
    console.log(`Data refreshed in ${ms}ms`);
  } catch (e) {
    console.error('Data refresh failed:', e?.message || e);
  } finally {
    refreshInProgress = false;
  }
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, payload) {
  send(
    res,
    status,
    {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    Buffer.from(JSON.stringify(payload, null, 2), 'utf8')
  );
}

const EVENT_NAME_ALIASES = new Map([
  // Common upstream / spelling variations
  ['operation chiper chase', 'operation cipher chase'],
  ['food fiesta', 'feast fiesta'],
]);

function normalize(str) {
  const raw = String(str || '').trim().toLowerCase();
  if (!raw) return '';

  // Remove parenthetical details (e.g. "(Eating Challenge)") and normalize punctuation.
  const noParens = raw.replace(/\([^)]*\)/g, ' ');
  const cleaned = noParens
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  // Drop common connectors so "Mr & Ms" and "Mr or Ms" normalize the same.
  const tokens = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t !== 'and' && t !== 'or');

  const normalized = tokens.join(' ');
  return EVENT_NAME_ALIASES.get(normalized) || normalized;
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.participants)) return payload.participants;
  return null;
}

function getEventDepartmentForParticipant(p) {
  const events = Array.isArray(p?.events) ? p.events : [];
  for (const e of events) {
    if (e && typeof e === 'object' && typeof e.department === 'string' && e.department.trim()) {
      return e.department.trim();
    }
  }
  return 'Unknown';
}

async function readJsonFile(fileName) {
  const filePath = path.join(ROOT, fileName);
  const text = await fs.readFile(filePath, 'utf8');
  return JSON.parse(text);
}

function filterParticipantsForDepartment(participants, dept) {
  const allowed = new Set((dept.events || []).map(normalize));
  return participants.filter((p) => {
    const events = Array.isArray(p.events) ? p.events : [];
    const teams = Array.isArray(p.teams) ? p.teams : [];

    const eventNames = [];
    for (const e of events) {
      if (typeof e === 'string') {
        eventNames.push(e);
        continue;
      }
      if (e && typeof e === 'object') {
        if (typeof e.eventName === 'string') eventNames.push(e.eventName);
        if (typeof e.name === 'string') eventNames.push(e.name);
        if (typeof e.title === 'string') eventNames.push(e.title);
      }
    }

    const inEvents = eventNames.some((name) => allowed.has(normalize(name)));
    const inTeams = teams.some((t) => allowed.has(normalize(t && (t.eventName || t.name))));
    return inEvents || inTeams;
  });
}

function safeJoin(rootDir, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const rel = decoded.replace(/^\/+/, '');
  const full = path.resolve(rootDir, rel);
  if (!full.startsWith(path.resolve(rootDir) + path.sep) && full !== path.resolve(rootDir)) {
    return null;
  }
  return full;
}

async function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const ct = contentTypes[ext] || 'application/octet-stream';

  try {
    const data = await fs.readFile(filePath);
    send(res, 200, {
      'content-type': ct,
      'cache-control': 'no-store',
    }, data);
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      send(res, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Not found');
      return;
    }
    send(res, 500, { 'content-type': 'text/plain; charset=utf-8' }, 'Server error');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  // API
  const acceptHeader = String(req.headers.accept || '');
  const wantsAdminJson = url.searchParams.get('format') === 'json' || acceptHeader.includes('application/json');

  if (url.pathname === '/sup/sec/admin' && !wantsAdminJson) {
    res.writeHead(302, { location: '/site/admin.html' });
    res.end();
    return;
  }

  if (url.pathname === '/sup/sec/admin' || url.pathname === '/api/sup/sec/admin') {
    try {
      const payload = await getParticipantsPayload({ allowFileFallback: true });
      const participants = extractArray(payload);
      if (!participants) {
        sendJson(res, 500, { error: 'Participants payload has unexpected shape' });
        return;
      }

      const totalUsers = participants.length;

      let totalAmountCollected = 0;
      for (const p of participants) {
        const status = String(p?.paymentStatus || '').toLowerCase();
        if (status !== 'verified') continue;
        const n = Number(p?.amountPaid);
        if (Number.isFinite(n)) totalAmountCollected += n;
      }

      const byEventDepartment = new Map();
      for (const p of participants) {
        const dept = getEventDepartmentForParticipant(p);
        byEventDepartment.set(dept, (byEventDepartment.get(dept) || 0) + 1);
      }

      let topEventDepartment = '';
      let topEventDepartmentRegistrations = 0;
      for (const [dept, count] of byEventDepartment.entries()) {
        if (count > topEventDepartmentRegistrations) {
          topEventDepartment = dept;
          topEventDepartmentRegistrations = count;
        }
      }

      const departmentStats = DEPARTMENTS.map((d) => {
        const deptParticipants = filterParticipantsForDepartment(participants, d);

        let amountCollected = 0;
        let verifiedPayments = 0;
        for (const p of deptParticipants) {
          const status = String(p?.paymentStatus || '').toLowerCase();
          if (status !== 'verified') continue;
          verifiedPayments += 1;
          const n = Number(p?.amountPaid);
          if (Number.isFinite(n)) amountCollected += n;
        }

        return {
          key: d.key,
          name: d.name,
          registrations: deptParticipants.length,
          verifiedPayments,
          amountCollected,
        };
      }).sort((a, b) => (b.registrations - a.registrations) || a.name.localeCompare(b.name));

      const topCollegeDept = departmentStats[0] || null;

      sendJson(res, 200, {
        totalUsers,
        totalAmountCollected,
        highestRegistrationDept: topEventDepartment
          ? { department: topEventDepartment, registrations: topEventDepartmentRegistrations }
          : null,
        highestRegistrationCollegeDept: topCollegeDept
          ? { key: topCollegeDept.key, name: topCollegeDept.name, registrations: topCollegeDept.registrations }
          : null,
        departmentStats,
      });
      return;
    } catch (e) {
      sendJson(res, 500, {
        error: 'Failed to load participants',
        message: e?.message || String(e),
      });
      return;
    }
  }

  if (url.pathname === '/api/teams') {
    try {
      const payload = await readJsonFile('teams.json');
      const teams = extractArray(payload) || [];
      sendJson(res, 200, { data: teams });
    } catch {
      sendJson(res, 200, { data: [] });
    }
    return;
  }

  if (url.pathname === '/api/departments') {
    const list = DEPARTMENTS.map((d) => ({
      key: d.key,
      name: d.name,
      events: d.events,
      megaEvents: d.megaEvents || [],
    }));
    sendJson(res, 200, { data: list });
    return;
  }

  if (url.pathname === '/api/participants') {
    try {
      const payload = await getParticipantsPayload({ allowFileFallback: true });
      const participants = extractArray(payload);
      if (!participants) {
        sendJson(res, 500, { error: 'Participants payload has unexpected shape' });
        return;
      }

      sendJson(res, 200, { data: participants });
      return;
    } catch (e) {
      sendJson(res, 502, {
        error: 'Failed to fetch participants from upstream API',
        message: e?.message || String(e),
      });
      return;
    }
  }

  const deptMatch = url.pathname.match(/^\/api\/departments\/([^/]+)\/participants$/);
  if (deptMatch) {
    const deptKey = deptMatch[1];
    const dept = DEPARTMENTS.find((d) => d.key === deptKey);
    if (!dept) {
      sendJson(res, 404, { error: 'Unknown department', deptKey });
      return;
    }

    try {
      const payload = await getParticipantsPayload({ allowFileFallback: true });
      const participants = extractArray(payload);
      if (!participants) {
        sendJson(res, 500, { error: 'response.json has unexpected shape' });
        return;
      }

      const filtered = filterParticipantsForDepartment(participants, dept);
      sendJson(res, 200, {
        department: {
          key: dept.key,
          name: dept.name,
          events: dept.events,
          megaEvents: dept.megaEvents || [],
        },
        data: filtered,
      });
      return;
    } catch (e) {
      sendJson(res, 500, { error: 'Failed to read response.json' });
      return;
    }
  }

  // Basic routing
  if (url.pathname === '/') {
    res.writeHead(302, { location: '/site/' });
    res.end();
    return;
  }

  if (url.pathname === '/site') {
    res.writeHead(302, { location: '/site/' });
    res.end();
    return;
  }

  // Serve /site/* from the site folder
  if (url.pathname.startsWith('/site/')) {
    const rel = url.pathname.replace(/^\/site\//, '');
    const target = rel === '' ? 'index.html' : rel;
    const filePath = safeJoin(path.join(ROOT, 'site'), target);
    if (!filePath) {
      send(res, 400, { 'content-type': 'text/plain; charset=utf-8' }, 'Bad request');
      return;
    }
    await serveFile(res, filePath);
    return;
  }

  // Serve response.json at /response.json
  if (url.pathname === '/response.json') {
    const filePath = path.join(ROOT, 'response.json');
    await serveFile(res, filePath);
    return;
  }

  // Serve teams.json at /teams.json
  if (url.pathname === '/teams.json') {
    const filePath = path.join(ROOT, 'teams.json');
    await serveFile(res, filePath);
    return;
  }

  send(res, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Not found');
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    console.error('Stop the other server, or run with a different port:');
    console.error('  PowerShell: $env:PORT = 3001; npm start');
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}/site/`);

  // Pre-load cache from file so the very first request is instant
  readJsonFile('response.json').then((payload) => {
    if (!cachedParticipantsPayload) {
      cachedParticipantsPayload = payload;
      cachedParticipantsAt = Date.now();
      console.log('Cache pre-loaded from response.json');
    }
  }).catch(() => {});

  if (AUTO_REFRESH) {
    console.log(`Auto-refresh: ON${REFRESH_INTERVAL_MS ? ` (every ${REFRESH_INTERVAL_MINUTES} min)` : ''}`);
    refreshData();
    if (REFRESH_INTERVAL_MS) {
      setInterval(refreshData, REFRESH_INTERVAL_MS);
    }
  } else {
    console.log('Auto-refresh: OFF (set AUTO_REFRESH=1 to enable)');
  }
});
