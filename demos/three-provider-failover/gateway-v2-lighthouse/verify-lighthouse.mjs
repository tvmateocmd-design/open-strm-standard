import { writeFile, rename } from 'node:fs/promises';
import { ROOT, LIGHTHOUSE, loadManifest, download, playlistInfo } from './media.mjs';

// Adds verification evidence only after all 15 Lighthouse objects match the
// previously verified Sia/Storj inventory. A failure preserves the old manifest.
const manifest = await loadManifest();
console.log('Reading about 183.6 MB from Lighthouse; normal gateway usage may apply.');
const measurements = [];
try {
  for (const expected of manifest.objects) {
    const result = await download('lighthouse', expected.path, undefined, { expected, timeoutMs: 60000 });
    if (expected.path === 'index.m3u8') playlistInfo(result.body);
    measurements.push({ path: expected.path, bytes: result.bytes, sha256: result.sha256, httpStatus: result.httpStatus, elapsedMs: result.elapsedMs });
    console.log('MATCH', expected.path, result.bytes, result.sha256);
  }
  const verifiedAt = new Date().toISOString();
  const evidence = { provider: 'lighthouse', gateway: LIGHTHOUSE, verifiedAt, measurements,
    note: 'Gateway retrieval and byte equality only; not a Filecoin deal or durability attestation.' };
  await writeFile(new URL('lighthouse-verification.json', ROOT), JSON.stringify(evidence, null, 2) + '\n');
  const updated = { ...manifest, verifiedProviders: ['sia', 'storj', 'lighthouse'], lighthouseVerification: evidence };
  const temp = new URL('verified-media.json.tmp', ROOT);
  await writeFile(temp, JSON.stringify(updated, null, 2) + '\n');
  await rename(temp, new URL('verified-media.json', ROOT));
  console.log('PASS: all 15 Lighthouse objects match. Three-provider routing enabled.');
} catch (error) {
  console.error('STOPPED:', error.code || 'verification failed', '— original provider manifest preserved.');
  process.exitCode = 1;
}
