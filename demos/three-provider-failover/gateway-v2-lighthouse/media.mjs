import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
export const ROOT = new URL('./', import.meta.url);
export const FIRST_SHA = '6b0dd2e335938e73beb759d44faabe5c8eee2d2fb8cd1eb9aaebf270e5c8c4b3';
export const STORJ = 'https://link.us1.storjshare.io/raw/jutboexwxkkyfbn5arow2v3lymnq/relaystream-vod/open-strm-tests/this-is-relaystream-extended-hls/';
export const LIGHTHOUSE = 'https://gateway.lighthouse.storage/ipfs/bafybeib5umus5hgdegzpruvvrzrukpphlg6zzmk3pdmy4jer527abft6y4/';
export const PROVIDERS = ['sia', 'storj', 'lighthouse'];
export const SIA = 'http://127.0.0.1:9980/api/worker/object/this-is-relaystream-extended-hls/';
export const sha = b => createHash('sha256').update(b).digest('hex');
export const objectNames = ['index.m3u8', ...Array.from({ length: 14 }, (_, i) => `segment_${String(i).padStart(5, '0')}.ts`)];
export function urlFor(provider, name) {
  if (!objectNames.includes(name)) throw new Error('Unknown object');
  if (provider === 'sia') return SIA + name + '?bucket=relay-vault&dl=true';
  if (provider === 'storj') return STORJ + name + '?download=1';
  if (provider === 'lighthouse') return LIGHTHOUSE + name;
  throw new Error('Unknown provider');
}
export function takeAuth() {
  const password = process.env.RELAYSTREAM_SIA_PASSWORD;
  delete process.env.RELAYSTREAM_SIA_PASSWORD;
  if (!password) throw new Error('Enter the Sia password using the local launcher commands.');
  return 'Basic ' + Buffer.from(':' + password, 'utf8').toString('base64');
}
export function playlistInfo(body) {
  const lines = body.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines[0] !== '#EXTM3U' || !lines.includes('#EXT-X-ENDLIST')) throw new Error('Invalid VOD playlist');
  if (lines.some(l => /^#EXT-X-(KEY|MAP|STREAM-INF|BYTERANGE)/.test(l))) throw new Error('Unsupported playlist feature');
  const names = lines.filter(l => !l.startsWith('#'));
  if (names.length !== 14 || names.some((n, i) => n !== objectNames[i + 1])) throw new Error('Unexpected segment paths');
  const durations = lines.filter(l => l.startsWith('#EXTINF:')).map(l => Number(l.slice(8).split(',')[0]));
  if (durations.length !== 14 || durations.some(n => !Number.isFinite(n) || n <= 0)) throw new Error('Invalid durations');
  return { count: names.length, seconds: Number(durations.reduce((a, b) => a + b, 0).toFixed(3)) };
}
export class RetrievalError extends Error {
  constructor(code, bytes = 0, status = null) { super(code); this.code = code; this.bytes = bytes; this.status = status; }
}
export async function download(provider, name, auth, { expected, signal, timeoutMs = 45000, transport = fetch } = {}) {
  const start = performance.now();
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  let count = 0, status = null, reader;
  try {
    const response = await transport(urlFor(provider, name), {
      method: 'GET', redirect: 'manual', signal: requestSignal,
      headers: { 'Cache-Control': 'no-cache', ...(provider === 'sia' ? { Authorization: auth } : {}) },
    });
    status = response.status;
    if (status !== 200) { await response.body?.cancel(); throw new RetrievalError('HTTP_' + status, 0, status); }
    const limit = name === 'index.m3u8' ? 65536 : 16777216;
    const declared = response.headers.get('content-length');
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit || (expected && Number(declared) !== expected.bytes))) {
      await response.body?.cancel(); throw new RetrievalError('INVALID_LENGTH', 0, status);
    }
    if (!response.body) throw new RetrievalError('EMPTY_BODY', 0, status);
    reader = response.body.getReader();
    const chunks = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > limit || (expected && count > expected.bytes)) throw new RetrievalError('OVERSIZED', count, status);
      chunks.push(Buffer.from(value));
    }
    if (declared !== null && Number(declared) !== count) throw new RetrievalError('TRUNCATED', count, status);
    const body = Buffer.concat(chunks), hash = sha(body);
    if (expected && (expected.bytes !== count || expected.sha256 !== hash)) throw new RetrievalError('INTEGRITY_MISMATCH', count, status);
    return { body, bytes: count, sha256: hash, httpStatus: status, elapsedMs: Math.round(performance.now() - start) };
  } catch (error) {
    if (reader) await reader.cancel().catch(() => {});
    if (error instanceof RetrievalError) throw error;
    throw new RetrievalError(signal?.aborted ? 'CANCELLED' : requestSignal.reason?.name === 'TimeoutError' || error?.name === 'TimeoutError' ? 'TIMEOUT' : 'TRANSPORT_ERROR', count, status);
  } finally { reader?.releaseLock(); }
}
export function validateManifest(m) {
  if (m?.schemaVersion !== 'open-strm.yc-demo-integrity/v1' || m.assetId !== 'this-is-relaystream-extended-hls' ||
      !Array.isArray(m.verifiedProviders) || !['sia,storj', 'sia,storj,lighthouse'].includes(m.verifiedProviders.join(',')) || !Array.isArray(m.objects) || m.objects.length !== 15) throw new Error('Invalid demo integrity manifest');
  for (let i = 0; i < 15; i++) {
    const o = m.objects[i];
    if (o.path !== objectNames[i] || !Number.isSafeInteger(o.bytes) || o.bytes < 1 || o.bytes > (i === 0 ? 65536 : 16777216) || !/^[a-f0-9]{64}$/.test(o.sha256)) throw new Error('Invalid object inventory');
  }
  return m;
}
export async function loadManifest() {
  return validateManifest(JSON.parse(await readFile(new URL('verified-media.json', ROOT), 'utf8')));
}
