# Recorded playback evidence

These are unchanged JSON exports supplied by Michael Lipson from the working Windows demo. No fresh real-provider fetch or Windows playback was performed during repository preparation on November 7, 2026. Browser observations are unsigned client records, not independent attestations. Dates below use America/New_York; JSON timestamps are UTC.

| Run | Sia objects | Storj objects | Lighthouse objects | Finished media time | Recorded waiting/stall events |
|---|---:|---:|---:|---:|---:|
| [November 5](2026-11-05-three-provider-run.json) | 6 | 2 | 7 | 71.957 s | 0 |
| [November 6 recorded demo](2026-11-06-recorded-three-provider-run.json) | 5 | 4 | 6 | 71.957 s | 0 |

Each run delivered exactly 15 unique objects (playlist plus 14 segments), totaling 183,560,419 bytes, with lengths and SHA-256 values matching the included integrity inventory. Each records two simulated provider outages, failover to Storj then Lighthouse, playback fragments for all 14 segments, and an ENDED event. Counters were checked against individual delivery events during repository preparation. These observations apply to these runs only.

The November 6 run reports retrievalRecoveryMs of 4078 ms for the Storj handoff and 3562 ms for the Lighthouse handoff. This metric starts at the affected media request, including time already spent with the earlier provider. It is not outage-to-recovery time or a playback stall measurement. `outageToFallbackMs` is a separate gateway measure. Neither is decoded-video latency.

The source recording was inspected separately: about 95 seconds before trimming, 1920 × 956, with no audio track. Media files are not committed. The exports describe controlled gateway-only outages; upstream retrieval and hash checking were real. They do not demonstrate public live-channel failover, storage-network failures, Filecoin deal status, or production reliability.

## Source hashes

- `2026-11-06-recorded-three-provider-run.json`: SHA-256 `3fc33a49d668d8ac8cc9cae3fadf05ffd46938df57dd6bc05872a8c12df39f1f`
- `2026-11-05-three-provider-run.json`: SHA-256 `072bbb91713fa93d61d5cb81fb8ca1132f6f4c935b79258584bcc48bd4c31179`
