RelayStream gateway v2 — Sia / Storj / Lighthouse

INSTALL (Windows, Node 24+; no npm install)
1. Extract gateway-v2-lighthouse beside gateway-v1 in:
   C:\Users\tvmat\RelayStream-YC-Demo
   This is a separate version. Keep gateway-v1 as the working baseline.
2. Stop the old demo server with Ctrl+C before starting this version;
   both versions use 127.0.0.1:3088.
3. Open PowerShell in gateway-v2-lighthouse and run:
   powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Gateway.ps1
   This sets execution policy for the new process only. It does not change
   your machine policy. Enter the renterd password at the hidden prompt.
4. Open http://127.0.0.1:3088 and hard refresh (Ctrl+F5).
5. Start video. Confirm SIA delivery. Click Simulate Sia outage.
   Confirm STORJ delivery, then click Simulate Storj outage.
   Confirm LIGHTHOUSE delivery and watch playback to completion.
6. Download run evidence before resetting. Record any browser stall.

WHAT CHANGED
The same /play/index.m3u8 route now supports three verified providers.
Fallback order starts with Sia, then Storj, then Lighthouse. After a successful
segment fallback the provider becomes preferred until reset. On another failure,
remaining configured providers are tried. Blocked routes are skipped.
Reset clears both simulated outages, cancels outstanding attempts, and restores
Sia as primary. Both controls simulate failure inside this gateway only.

VERIFICATION
The included original inventory contains Sia/Storj verification from your v1
package. verify-lighthouse.mjs compares every Lighthouse object to that inventory.
Lighthouse is enabled only once all 15 files match. If checking fails, the
previous provider inventory is preserved. To repeat the Lighthouse check:
   node .\verify-lighthouse.mjs
This retrieves about 183.6 MB; normal gateway usage may apply. It updates the
local verification record after success. No API key is needed for this public
Lighthouse gateway. No Sia credentials are sent to Storj or Lighthouse.

AUTOMATED TESTS
   node --test .\gateway.test.mjs
Local synthetic HTTP fixtures exercise normal delivery, both simulated outages,
actual HTTP failures, timeout, cancellation, corrupt bytes, control authorization,
reset, and credential isolation. These tests do not verify Windows playback.

LIMITATIONS
Standalone prototype, separate from 005N. Not production ready.
Every response is fully buffered and SHA-256 checked before delivery; no local
media cache. Each playback can retrieve about 183.6 MB plus retries. Gateway
provider caching and underlying storage host behavior are not observable here.
Lighthouse gateway retrieval is not evidence of Filecoin deals or durability.
Playback requests allow 20 seconds per provider attempt; slow real failures can
stall the browser. Controlled outages skip/cancel blocked attempts immediately.
Exported retrieval timings measure readiness of verified bytes at the gateway,
not decoded video recovery. Browser frame/stall observations are separate and
unsigned. The video remains the original unencrypted HLS package.
Local trusted inventory is unsigned. Keep it protected from unwanted changes.

DEPENDENCY
Vendored HLS.js is unchanged from v1. License: public/vendor/HLS-LICENSE.

REPOSITORY PACKAGING — 2026-11-07
See ../README.md for clone prerequisites and ../evidence/README.md for subsequent
Windows playback results. This folder preserves the working v2 runtime. The
automated test fixture now maps configured provider origins to local servers.
