# Three-provider VOD failover prototype

This is the verified v2 baseline developed before the Eternal sprint. It packages the founder's working Windows backup without changing gateway runtime behavior. The test transport fixture was updated to recognize the configured provider origins instead of an obsolete Lighthouse hostname.

## What it demonstrates

One URL, `http://127.0.0.1:3088/play/index.m3u8`, retrieves a fixed promotional HLS asset across Sia, Storj, and Lighthouse. Each upstream object is fully read and compared with the saved length and SHA-256 hash before delivery. The playlist is then rewritten to local `/play/` segment routes. This gateway has no local media cache; the browser has a playback buffer. Upstream caches and storage-host internals are not measured.

The outage buttons block or cancel retrieval inside this gateway. They do not shut down renterd, Storj, Lighthouse, or any storage network. After a successful segment fallback, the new provider becomes preferred until another failure or reset.

## Run automated tests (no credentials or upstream media needed)

Requires Node.js 24 or newer. No npm install is needed for this demo.

```powershell
cd demos/three-provider-failover/gateway-v2-lighthouse
node --test .\gateway.test.mjs
```

The 16 tests use local HTTP fixtures. They exercise hash verification, two sequential outages, upstream failures, timeout, cancellation, corrupt bytes, reset, control authorization, and credential isolation. Passing tests do not establish current provider availability or browser playback quality.

## Run the Windows playback demo

Prerequisites: Node.js 24+, PowerShell, a running local renterd worker at port 9980, its API password, and the matching media package in bucket `relay-vault` under `this-is-relaystream-extended-hls/`. A clone alone does not provision Sia storage or download the media package. The public Storj folder share and Lighthouse CID are configured in `media.mjs`; their future availability is not guaranteed.

1. Stop any other gateway using port 3088. Leave renterd running.
2. From `gateway-v2-lighthouse`, run:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Gateway.ps1
   ```

   The execution-policy override applies only to that process. Enter the renterd password at the hidden prompt. The launcher restores the parent process environment on exit; the gateway does not forward Sia authorization to the public providers.
3. Open `http://127.0.0.1:3088` and hard-refresh. Start video.
4. After about five seconds of playback, simulate Sia outage. Once the route shows Storj, simulate Storj outage. Let playback finish through Lighthouse.
5. Download run evidence before resetting. Compare retrieval events and browser observations separately.

The server binds to loopback and enforces its printed Host/Origin. It is not configured for public hosting. Each playback transfers approximately 183.56 MB, plus retries; provider bandwidth/usage charges may apply.

## Evidence and provenance

See [evidence/README.md](evidence/README.md) for two exported full-playback runs, source-file hashes, timing definitions, and the distinction between prior live verification and local tests. Historical `lighthouse-verification.json`, `live-gateway-check.json`, and `verified-media.json` remain unchanged from the backup. Their older Lighthouse hostname records where those checks originally ran; current runtime configuration uses `gateway.lighthouse.storage` and Storj's regional `/raw/` endpoint.

## Boundaries and next work

This is a standalone prototype for a single fixed asset, with an unsigned trusted integrity inventory and full-object buffering. It is not a generalized Open-STRM manifest gateway, a live-channel failover engine, or a production service. Browser buffering covered retrieval handoffs in the recorded runs; slower failures can still stall playback. Returning automatically to a recovered provider (failback) was not demonstrated. No Filecoin deal, durability, onchain rights, licensing, or network-wide outage claim follows from these tests.

The separate live-channel prototype was demonstrated on desktop and Android Chrome over 5G. Source credentials and third-party broadcast recordings are intentionally omitted from this repository. Media remains offchain; Solana rights integration is planned.

Vendored HLS.js retains its [license](gateway-v2-lighthouse/public/vendor/HLS-LICENSE). Existing repository materials are preserved.
