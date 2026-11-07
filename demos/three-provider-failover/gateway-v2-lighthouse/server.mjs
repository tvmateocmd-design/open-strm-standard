import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { ROOT, takeAuth, download, validateManifest, loadManifest, playlistInfo, RetrievalError } from './media.mjs';

export function createGateway({ manifest, auth, retrieve = download, port = 0 }) {
  validateManifest(manifest);
  const ids = manifest.verifiedProviders;
  const blocked = new Set();
  const token = randomBytes(24).toString('hex');
  let preferred = 'sia', activeRoute = null, simulated = false, generation = 0, inflight = 0;
  let outageAt = null, outageToFallbackMs = null, recoveryMs = null, counter = 0;
  const attempts = new Set(), events = [];
  const providers = Object.fromEntries(ids.map(id => [id, { status: 'Not requested this run', verifiedBytes: 0, deliveries: 0 }]));
  const add = (kind, data = {}) => { events.push({ id: ++counter, at: new Date().toISOString(), kind, ...data }); if (events.length > 300) events.shift(); };
  const status = () => ({ activeRoute, preferred, simulated, blockedProviders: [...blocked], recoveryMs, outageToFallbackMs, inflight,
    verifiedAt: manifest.verifiedAt, package: manifest.playlist, providers: structuredClone(providers), events: [...events] });
  function send(res, code, body, type = 'application/json', extra = {}) {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  }
  const server = createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (req.headers.host !== origin.slice(7)) { send(res, 403, { error: 'Use the printed loopback address' }); return; }
    let u;
    try { u = new URL(req.url, origin); } catch { send(res, 400, {}); return; }
    if (req.method === 'GET' && u.pathname === '/api/status') { send(res, 200, status()); return; }
    if (req.method === 'GET' && u.pathname === '/api/session') { send(res, 200, { token }); return; }
    if (req.method === 'POST' && ['/api/outage', '/api/outage/storj', '/api/reset'].includes(u.pathname)) {
      if (req.headers.origin !== origin || req.headers['x-relaystream-token'] !== token) { send(res, 403, { error: 'Invalid demo control request' }); return; }
      if (u.pathname !== '/api/reset') {
        const id = u.pathname === '/api/outage' ? 'sia' : 'storj';
        if (blocked.has(id)) { send(res, 200, status()); return; }
        blocked.add(id); simulated = true; outageAt = performance.now(); outageToFallbackMs = null;
        providers[id].status = 'Simulated unavailable';
        add('SIMULATED_OUTAGE', { provider: id, note: 'Gateway-only simulation; upstream services and media are unchanged.' });
        for (const a of attempts) if (a.provider === id) a.controller.abort();
      } else {
        generation++;
        for (const a of attempts) a.controller.abort();
        blocked.clear(); simulated = false; preferred = 'sia'; activeRoute = null; outageAt = null; recoveryMs = null; outageToFallbackMs = null;
        events.length = 0;
        for (const id of ids) Object.assign(providers[id], { status: 'Not requested this run', verifiedBytes: 0, deliveries: 0 });
        add('RESET', { note: 'New demo run; primary is Sia.' });
      }
      send(res, 200, status()); return;
    }
    const files = { '/': ['public/index.html', 'text/html; charset=utf-8'], '/app.js': ['public/app.js', 'text/javascript'],
      '/style.css': ['public/style.css', 'text/css'], '/vendor/hls.min.js': ['public/vendor/hls.min.js', 'text/javascript'] };
    if (req.method === 'GET' && files[u.pathname]) {
      const [path, type] = files[u.pathname];
      try { send(res, 200, await readFile(new URL(path, ROOT)), type, { 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob:; worker-src 'self' blob:; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'" }); }
      catch { send(res, 500, { error: 'Missing dashboard asset' }); }
      return;
    }
    if (req.method !== 'GET' || !u.pathname.startsWith('/play/')) { send(res, 404, {}); return; }
    const name = u.pathname.slice(6), expected = manifest.objects.find(o => o.path === name);
    if (!expected || u.search) { send(res, 404, { error: 'Unknown media object' }); return; }
    if (inflight >= 3) { send(res, 429, { error: 'Demo request limit' }); return; }
    inflight++;
    const run = generation, requestId = randomBytes(5).toString('hex'), started = performance.now();
    let failed = false;
    const order = [preferred, ...ids.filter(id => id !== preferred)];
    try {
      for (const provider of order) {
        if (run !== generation || res.destroyed) break;
        if (blocked.has(provider)) {
          failed = true;
          add('SIMULATED_READ_BLOCKED', { requestId, provider, object: name, bytes: 0, note: 'No upstream request made for this blocked provider.' });
          continue;
        }
        const controller = new AbortController(), attempt = { provider, controller };
        const cancel = () => controller.abort();
        attempts.add(attempt); res.on('close', cancel);
        add('REQUEST', { requestId, provider, object: name }); providers[provider].status = 'Retrieving';
        try {
          const data = await retrieve(provider, name, auth, { expected, signal: controller.signal, timeoutMs: 20000 });
          if (run !== generation || res.destroyed) break;
          if (blocked.has(provider)) throw new RetrievalError('CANCELLED', data.bytes, data.httpStatus);
          // The default transport verifies bytes. Keep this boundary check too.
          if (data.bytes !== expected.bytes || data.sha256 !== expected.sha256) throw new RetrievalError('INTEGRITY_MISMATCH', data.bytes, data.httpStatus);
          let body = data.body;
          if (name === 'index.m3u8') { playlistInfo(body); body = Buffer.from(body.toString('utf8').split(/\r?\n/).map(line => line && !line.startsWith('#') ? '/play/' + line.trim() : line).join('\n')); }
          providers[provider].status = 'Retrieval verified'; providers[provider].verifiedBytes += data.bytes; providers[provider].deliveries++;
          const retrievalMs = Math.round(performance.now() - started);
          if (name.endsWith('.ts')) {
            activeRoute = provider;
            if (failed) { preferred = provider; recoveryMs = retrievalMs; }
            if (!blocked.has(provider) && outageAt !== null && outageToFallbackMs === null) outageToFallbackMs = Math.round(performance.now() - outageAt);
          }
          add('DELIVERED', { requestId, provider, object: name, bytes: data.bytes, httpStatus: data.httpStatus, sha256: data.sha256,
            attemptMs: data.elapsedMs, requestMs: retrievalMs, failover: failed });
          if (failed) add('FAILOVER', { requestId, to: provider, object: name, retrievalRecoveryMs: retrievalMs, note: 'Verified fallback bytes ready at gateway; playback is measured separately.' });
          send(res, 200, body, name.endsWith('.ts') ? 'video/mp2t' : 'application/vnd.apple.mpegurl', {
            'Content-Length': body.length, 'X-RelayStream-Provider': provider, 'X-RelayStream-SHA256': data.sha256,
            'X-RelayStream-Request': requestId, 'X-RelayStream-Retrieval-Ms': retrievalMs,
          });
          return;
        } catch (error) {
          if (run !== generation || res.destroyed) break;
          failed = true;
          const simulatedFailure = blocked.has(provider);
          const code = simulatedFailure ? 'SIMULATED_CANCEL' : error instanceof RetrievalError ? error.code : 'VALIDATION_FAILED';
          providers[provider].status = simulatedFailure ? 'Simulated unavailable' : 'Last request failed';
          add('FAILED', { requestId, provider, object: name, code, bytes: error?.bytes || 0, httpStatus: error?.status || null });
        } finally { res.off('close', cancel); attempts.delete(attempt); }
      }
      if (!res.destroyed) send(res, 503, { error: run !== generation ? 'Demo reset; restart playback' : 'No verified provider response' });
    } finally { inflight--; }
  });
  server.requestTimeout = 60000;
  server.headersTimeout = 10000;
  server.on('close', () => { for (const a of attempts) a.controller.abort(); });
  return { server, listen: () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve(server.address().port)); }), status };
}
async function main() {
  const manifest = await loadManifest(), auth = takeAuth();
  const gateway = createGateway({ manifest, auth, port: 3088 });
  await gateway.listen();
  console.log('RelayStream YC demo: http://127.0.0.1:3088');
  console.log('Single playback URL: http://127.0.0.1:3088/play/index.m3u8');
  console.log('Each media request retrieves upstream bytes and checks the full object hash. No local media cache.');
  console.log('Outage controls block Sia/Storj only inside this gateway; upstream services remain running.');
  console.log('Ctrl+C stops this standalone server.');
  process.on('SIGINT', () => { gateway.server.close(); gateway.server.closeAllConnections(); setTimeout(() => process.exit(0), 1000).unref(); });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => {
  console.error(e?.code === 'ENOENT' ? 'Run the full-package prepare.mjs check first.' : e?.code === 'EADDRINUSE' ? 'Port 3088 is already in use; server did not start.' : 'Server could not start. Check the integrity manifest and local password setup.'); process.exitCode = 1;
});
