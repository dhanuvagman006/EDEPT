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
  const n = Number(process.env.PARTICIPANTS_CACHE_MS || 30000);
  return Number.isFinite(n) && n >= 0 ? n : 30000;
})();

const AUTO_REFRESH = String(process.env.AUTO_REFRESH || '').toLowerCase() !== '0';
const REFRESH_INTERVAL_MINUTES = Number(process.env.REFRESH_INTERVAL_MINUTES || 10);
const REFRESH_INTERVAL_MS = Number.isFinite(REFRESH_INTERVAL_MINUTES) && REFRESH_INTERVAL_MINUTES > 0
  ? REFRESH_INTERVAL_MINUTES * 60 * 1000
  : 0;

let refreshInProgress = false;

let cachedParticipantsPayload = null;
let cachedParticipantsAt = 0;

// Pre-load response.json into memory on startup so the first request is instant.
async function preloadCache() {
  try {
    const payload = await readJsonFile('response.json');
    cachedParticipantsPayload = payload;
    cachedParticipantsAt = Date.now();
    console.log('Participants cache pre-loaded from response.json');
  } catch {
    // File doesn't exist yet — first fetch will populate it.
  }
}

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

async function getParticipantsPayload({ allowFileFallback = true } = {}) {
  // Serve from cache if fresh — always fast.
  if (cachedParticipantsPayload) {
    const age = Date.now() - cachedParticipantsAt;
    if (age < PARTICIPANTS_CACHE_MS) {
      return cachedParticipantsPayload;
    }
    // Cache stale: return existing data immediately and refresh in background.
    fetchParticipantsPayloadFromApi().catch(() => {});
    return cachedParticipantsPayload;
  }

  // No cache yet — try file first (fast), then API as last resort.
  if (allowFileFallback) {
    try {
      const payload = await readJsonFile('response.json');
      cachedParticipantsPayload = payload;
      cachedParticipantsAt = Date.now();
      return payload;
    } catch { /* fall through to live fetch */ }
  }

  return await fetchParticipantsPayloadFromApi();
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

function normalize(str) {
  return String(str || '').trim().toLowerCase();
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.participants)) return payload.participants;
  return null;
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
  if (url.pathname === '/api/departments') {
    const list = DEPARTMENTS.map((d) => ({ key: d.key, name: d.name, events: d.events }));
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

      const deptFiltered = filterParticipantsForDepartment(participants, dept);

      // Optional ?event= param: filter further to a single event
      const eventParam = normalize(url.searchParams.get('event') || '');
      const filtered = eventParam
        ? deptFiltered.filter((p) => {
            const events = Array.isArray(p.events) ? p.events : [];
            return events.some((e) => {
              const name = typeof e === 'string' ? e : (e && typeof e === 'object' ? (e.eventName || e.name || e.title || '') : '');
              return normalize(name) === eventParam;
            });
          })
        : deptFiltered;

      sendJson(res, 200, { department: { key: dept.key, name: dept.name }, data: filtered });
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

  preloadCache();

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
