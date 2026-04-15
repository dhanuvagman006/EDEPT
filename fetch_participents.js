const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { pipeline } = require('node:stream/promises');

const ENDPOINT = 'https://envisionsit.in/api/v1/registrations/export/all-participants';
const OUTPUT_FILE = 'response.json';

const quiet = String(process.env.QUIET || '').toLowerCase() === '1'
  || String(process.env.QUIET || '').toLowerCase() === 'true';

const timeoutMs = Number(process.env.FETCH_TIMEOUT_MS || 180000);

async function main() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const startedAt = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: 'GET',
      headers: {
        accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
      },
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') || '';
    const contentLengthHeader = res.headers.get('content-length');
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const msg = `Request failed: ${res.status} ${res.statusText}`;
      if (!quiet) {
        console.error(msg);
        if (errText) console.error(errText.slice(0, 2000));
      }
      await fsp.writeFile('response.error.txt', `${msg}\n\n${errText}`, 'utf8');
      process.exitCode = 1;
      return;
    }

    if (!res.body) {
      const msg = 'No response body received.';
      if (!quiet) console.error(msg);
      await fsp.writeFile('response.error.txt', msg, 'utf8');
      process.exitCode = 1;
      return;
    }

    await pipeline(res.body, fs.createWriteStream(OUTPUT_FILE));

    const ms = Date.now() - startedAt;
    const stat = await fsp.stat(OUTPUT_FILE);

    if (!quiet) {
      console.log('Status:', res.status, res.statusText);
      console.log('Content-Type:', contentType || '(unknown)');
      console.log('Content-Length header:', Number.isFinite(contentLength) ? contentLength : '(none)');
      console.log('Saved:', OUTPUT_FILE, `${stat.size} bytes`);
      console.log('Time:', `${ms}ms`);
    }
  } catch (err) {
    const message = err?.name === 'AbortError'
      ? `Request timed out after ${timeoutMs}ms`
      : `Fetch failed: ${err?.message || String(err)}`;

    if (!quiet) console.error(message);
    await fsp.writeFile('response.error.txt', message, 'utf8');
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
  }
}

main();