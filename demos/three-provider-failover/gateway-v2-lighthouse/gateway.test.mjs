import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { createGateway } from './server.mjs';
import { sha, objectNames, download, urlFor } from './media.mjs';

const playlist = Buffer.from('#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXT-X-PLAYLIST-TYPE:VOD\n' + objectNames.slice(1).map(n => '#EXTINF:5,\n' + n + '\n').join('') + '#EXT-X-ENDLIST\n');
const objects = new Map(objectNames.map((n, i) => [n, i === 0 ? playlist : Buffer.alloc(376, i)]));
const manifest = { schemaVersion: 'open-strm.yc-demo-integrity/v1', assetId: 'this-is-relaystream-extended-hls', verifiedProviders: ['sia', 'storj', 'lighthouse'],
  verifiedAt: 'synthetic-test-only', playlist: { count: 14, seconds: 70 }, objects: [...objects].map(([path, b]) => ({ path, bytes: b.length, sha256: sha(b) })) };
const listen = s => new Promise(resolve => s.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${s.address().port}`)));
const shutdown = s => new Promise(resolve => { s.close(resolve); s.closeAllConnections(); });

async function setup(t, mode = 'normal') {
  const calls = [];
  const upstreams = {};
  for (const id of ['sia', 'storj', 'lighthouse']) {
    const s = createServer((req, res) => {
      const name = new URL(req.url, 'http://localhost').pathname.split('/').pop();
      calls.push({ provider: id, name, auth: req.headers.authorization });
      if (mode === 'bothfail' || (mode === 'firsttwofail' && id !== 'lighthouse')) { res.writeHead(503); res.end(); return; }
      if (id === 'sia' && mode === 'unauthorized') { res.writeHead(401); res.end(); return; }
      if (id === 'sia' && mode === 'redirect') { res.writeHead(302, { location: upstreams.storj?.url + '/leaked' }); res.end(); return; }
      const b = objects.get(name);
      if (!b) { res.writeHead(404); res.end(); return; }
      const body = ((id === 'sia' && mode === 'corrupt') || (id === 'lighthouse' && mode === 'corruptthird')) && name.endsWith('.ts') ? Buffer.alloc(b.length, 99) : b;
      const send = () => { if (!res.destroyed) { res.writeHead(200, { 'Content-Length': body.length }); res.end(body); } };
      if (((id === 'sia' && ['slow', 'timeout'].includes(mode)) || (id === 'storj' && mode === 'slowstorj')) && name.endsWith('.ts')) { const timer = setTimeout(send, 500); res.on('close', () => clearTimeout(timer)); }
      else send();
    });
    upstreams[id] = { server: s, url: await listen(s) };
  }
  const providerOrigins = new Map(['sia', 'storj', 'lighthouse'].map(id => [new URL(urlFor(id, 'index.m3u8')).origin, id]));
  const transport = (url, init) => {
    const u = new URL(url), id = providerOrigins.get(u.origin);
    assert.ok(id, 'The requested provider must have a local fixture');
    return fetch(upstreams[id].url + '/' + u.pathname.split('/').pop(), init);
  };
  const retrieve = (id, name, auth, opts) => download(id, name, auth, { ...opts, transport, timeoutMs: mode === 'timeout' && id === 'sia' ? 1 : 1000 });
  const g = createGateway({ manifest, auth: 'Basic local-test-only', retrieve });
  const port = await g.listen(), origin = `http://127.0.0.1:${port}`;
  t.after(async () => { await shutdown(g.server); for (const p of Object.values(upstreams)) await shutdown(p.server); });
  const { token } = await (await fetch(origin + '/api/session')).json();
  const action = path => fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'X-RelayStream-Token': token } });
  return { g, origin, calls, action };
}

test('one playlist route rewrites segments and verifies actual upstream bytes with correct MIME', async t => {
  const { origin, calls } = await setup(t);
  const list = await (await fetch(origin + '/play/index.m3u8')).text();
  assert.match(list, /\/play\/segment_00000.ts/);
  const r = await fetch(origin + '/play/segment_00000.ts');
  assert.equal(r.headers.get('content-type'), 'video/mp2t');
  assert.equal(r.headers.get('x-relaystream-provider'), 'sia');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), objects.get('segment_00000.ts'));
  assert.equal(calls[0].auth, 'Basic local-test-only');
});
test('simulated outage automatically serves the SAME segment URL from Storj without its receiving auth', async t => {
  const { origin, calls, action, g } = await setup(t);
  const url = origin + '/play/segment_00000.ts';
  const first = await fetch(url); await first.arrayBuffer();
  assert.equal(first.headers.get('x-relaystream-provider'), 'sia');
  assert.equal((await action('/api/outage')).status, 200);
  const fallback = await fetch(url); await fallback.arrayBuffer();
  assert.equal(fallback.headers.get('x-relaystream-provider'), 'storj');
  assert.equal(calls.filter(x => x.provider === 'sia').length, 1);
  assert.equal(calls.find(x => x.provider === 'storj').auth, undefined);
  assert.equal(g.status().activeRoute, 'storj');
  assert.ok(g.status().events.some(e => e.kind === 'FAILOVER'));
  assert.ok(g.status().recoveryMs >= 0);
});
test('corrupt primary bytes are never delivered and fallback is independently hash checked', async t => {
  const { origin, g } = await setup(t, 'corrupt');
  const r = await fetch(origin + '/play/segment_00001.ts');
  assert.equal(r.headers.get('x-relaystream-provider'), 'storj');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), objects.get('segment_00001.ts'));
  assert.ok(g.status().events.some(e => e.code === 'INTEGRITY_MISMATCH'));
});
test('primary auth failure falls back without logging credentials', async t => {
  const { origin, g } = await setup(t, 'unauthorized');
  const r = await fetch(origin + '/play/segment_00000.ts'); await r.arrayBuffer();
  assert.equal(r.headers.get('x-relaystream-provider'), 'storj');
  assert.ok(g.status().events.some(e => e.code === 'HTTP_401'));
  assert.equal(JSON.stringify(g.status()).includes('local-test-only'), false);
});
test('provider redirect is rejected without forwarding Sia authentication', async t => {
  const { origin, calls } = await setup(t, 'redirect');
  const r = await fetch(origin + '/play/segment_00000.ts'); await r.arrayBuffer();
  assert.equal(r.headers.get('x-relaystream-provider'), 'storj');
  assert.equal(calls.some(x => x.name === 'leaked'), false);
});
test('outage cancels an in-flight Sia download and retries the requested segment on Storj', async t => {
  const { origin, calls, action, g } = await setup(t, 'slow');
  const request = fetch(origin + '/play/segment_00000.ts');
  while (!calls.some(x => x.provider === 'sia')) await new Promise(resolve => setTimeout(resolve, 5));
  await action('/api/outage');
  const r = await request; await r.arrayBuffer();
  assert.equal(r.headers.get('x-relaystream-provider'), 'storj');
  assert.ok(g.status().events.some(e => e.code === 'SIMULATED_CANCEL'));
});
test('reset restores Sia and clears old run measurements', async t => {
  const { origin, action, g } = await setup(t);
  await action('/api/outage');
  const first = await fetch(origin + '/play/segment_00000.ts'); await first.arrayBuffer();
  await action('/api/reset');
  assert.equal(g.status().activeRoute, null);
  assert.equal(g.status().recoveryMs, null);
  const second = await fetch(origin + '/play/segment_00000.ts'); await second.arrayBuffer();
  assert.equal(second.headers.get('x-relaystream-provider'), 'sia');
});
test('control requests require same-origin token; unknown paths and host headers are rejected', async t => {
  const { origin } = await setup(t);
  assert.equal((await fetch(origin + '/api/outage', { method: 'POST' })).status, 403);
  assert.equal((await fetch(origin + '/play/not-in-inventory.ts')).status, 404);
  const code = await new Promise((resolve, reject) => {
    const req = httpRequest(origin + '/api/status', { headers: { Host: 'untrusted.example' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(code, 403);
});
test('a primary timeout triggers secondary retrieval', async t => {
  const { origin, g } = await setup(t, 'timeout');
  const r = await fetch(origin + '/play/segment_00000.ts'); await r.arrayBuffer();
  assert.equal(r.headers.get('x-relaystream-provider'), 'storj');
  assert.ok(g.status().events.some(e => e.code === 'TIMEOUT'));
});
test('all three unavailable providers yield a 503 without any claimed delivery', async t => {
  const { origin, g } = await setup(t, 'bothfail');
  const r = await fetch(origin + '/play/segment_00000.ts'); await r.text();
  assert.equal(r.status, 503);
  assert.equal(g.status().activeRoute, null);
  assert.equal(g.status().events.some(e => e.kind === 'DELIVERED'), false);
});
test('dashboard and vendored player are served locally', async t => {
  const { origin } = await setup(t);
  const page = await fetch(origin + '/');
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(await page.text(), /Simulate Sia outage/);
  const player = await fetch(origin + '/vendor/hls.min.js');
  assert.equal(player.status, 200); assert.ok((await player.text()).length > 100000);
});

test('two sequential simulated outages serve the same segment through Lighthouse without Sia auth', async t => {
  const { origin, calls, action, g } = await setup(t);
  const url = origin + '/play/segment_00000.ts';
  for (const [provider, control] of [['sia', '/api/outage'], ['storj', '/api/outage/storj'], ['lighthouse', null]]) {
    const r = await fetch(url);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('x-relaystream-provider'), provider);
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), objects.get('segment_00000.ts'));
    if (control) assert.equal((await action(control)).status, 200);
  }
  assert.equal(calls.find(c => c.provider === 'lighthouse').auth, undefined);
  assert.equal(g.status().preferred, 'lighthouse');
  assert.deepEqual(g.status().blockedProviders, ['sia', 'storj']);
  await action('/api/reset');
  assert.deepEqual(g.status().blockedProviders, []);
  assert.equal(g.status().providers.lighthouse.verifiedBytes, 0);
});
test('real upstream failures on both earlier routes automatically try Lighthouse', async t => {
  const { origin, calls } = await setup(t, 'firsttwofail');
  const r = await fetch(origin + '/play/index.m3u8');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-relaystream-provider'), 'lighthouse');
  assert.match(await r.text(), /\/play\/segment_00000.ts/);
  assert.deepEqual(calls.map(c => c.provider), ['sia', 'storj', 'lighthouse']);
});
test('corrupt Lighthouse bytes are rejected after both earlier routes are blocked', async t => {
  const { origin, action, g } = await setup(t, 'corruptthird');
  await action('/api/outage'); await action('/api/outage/storj');
  const r = await fetch(origin + '/play/segment_00000.ts');
  assert.equal(r.status, 503); await r.text();
  assert.equal(g.status().providers.lighthouse.deliveries, 0);
  assert.ok(g.status().events.some(e => e.provider === 'lighthouse' && e.code === 'INTEGRITY_MISMATCH'));
});
test('Storj outage control rejects requests without the same-origin token', async t => {
  const { origin } = await setup(t);
  assert.equal((await fetch(origin + '/api/outage/storj', { method: 'POST' })).status, 403);
});

test('Storj outage cancels its in-flight download and retries Lighthouse', async t => {
  const { origin, calls, action, g } = await setup(t, 'slowstorj');
  await action('/api/outage');
  const request = fetch(origin + '/play/segment_00000.ts');
  const deadline = Date.now() + 2000;
  while (!calls.some(c => c.provider === 'storj')) {
    assert.ok(Date.now() < deadline, 'Storj request should start');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  await action('/api/outage/storj');
  const r = await request; await r.arrayBuffer();
  assert.equal(r.headers.get('x-relaystream-provider'), 'lighthouse');
  assert.ok(g.status().events.some(e => e.provider === 'storj' && e.code === 'SIMULATED_CANCEL'));
});
