const fsp = require('node:fs/promises');

const ENDPOINT = 'https://envisionsit.in/api/v1/admin/teams?limit=1000';
const OUTPUT_FILE = 'teams.json';

const quiet = String(process.env.QUIET || '').toLowerCase() === '1'
  || String(process.env.QUIET || '').toLowerCase() === 'true';

const bearerToken = String(process.env.ENVISIONSIT_BEARER_TOKEN || '').trim();
const cookie = String(process.env.ENVISIONSIT_COOKIE || '').trim();

async function main() {
  if (!bearerToken && !cookie) {
    if (!quiet) {
      console.warn('Skipping teams fetch: no ENVISIONSIT_BEARER_TOKEN or ENVISIONSIT_COOKIE provided.');
    }
    return;
  }

  const headers = {
    accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
  };

  if (bearerToken) headers.authorization = `Bearer ${bearerToken}`;
  if (cookie) headers.cookie = cookie;

  const res = await fetch(ENDPOINT, { method: 'GET', headers });
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (!res.ok) {
    const msg = `Teams request failed: ${res.status} ${res.statusText}`;
    if (!quiet) {
      console.error(msg);
      if (text) console.error(text.slice(0, 2000));
    }
    await fsp.writeFile('teams.error.txt', `${msg}\n\n${text}`, 'utf8');
    process.exitCode = 1;
    return;
  }

  let outputText = text;
  if (contentType.includes('application/json')) {
    try {
      outputText = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // keep raw
    }
  }

  await fsp.writeFile(OUTPUT_FILE, outputText, 'utf8');
  if (!quiet) console.log('Saved:', OUTPUT_FILE);
}

main().catch((err) => {
  console.error('Teams fetch failed:', err?.message || err);
  process.exitCode = 1;
});