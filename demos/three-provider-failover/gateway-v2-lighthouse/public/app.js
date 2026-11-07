'use strict';
const $ = id => document.getElementById(id);
const video = $('video'), playerURL = location.origin + '/play/index.m3u8';
let hls, token, snapshot, running = false, polling = false, waitingAt = null, lastFrame = null, fragment = null;
let latestStallMs = null, frames = 0, samples = [], runStarted = new Date().toISOString(), errorNoted = false;
$('endpoint').textContent = playerURL;
const ms = n => n === null || n === undefined ? '—' : n >= 1000 ? (n / 1000).toFixed(2) + ' s' : n + ' ms';
const size = n => (n / 1000000).toFixed(2) + ' MB';
function note(event, data = {}) { samples.push({ at: new Date().toISOString(), event, mediaTime: Number(video.currentTime.toFixed(3)), ...data }); if (samples.length > 600) samples.shift(); }
function message(text) { $('message').textContent = text; }
function stop() {
  running = false; waitingAt = null;
  if (hls) { hls.destroy(); hls = null; }
  video.pause(); video.removeAttribute('src'); video.load(); fragment = null;
}
async function action(path) {
  const r = await fetch(path, { method: 'POST', headers: { 'X-RelayStream-Token': token } });
  if (!r.ok) throw new Error('Demo control failed: HTTP ' + r.status);
  snapshot = await r.json(); render();
}
function render() {
  if (!snapshot) return;
  $('route').textContent = snapshot.activeRoute ? snapshot.activeRoute.toUpperCase() : 'Awaiting playback';
  for (const id of ['sia', 'storj', 'lighthouse']) {
    if (!snapshot.providers[id]) { $(id + 'Status').textContent = 'Not verified — run verification first'; continue; }
    $(id + 'Status').textContent = snapshot.providers[id].status;
    $(id + 'Bytes').textContent = size(snapshot.providers[id].verifiedBytes) + ' verified · ' + snapshot.providers[id].deliveries + ' objects';
  }
  $('recovery').textContent = ms(snapshot.recoveryMs);
  $('simulation').textContent = snapshot.simulated ? 'ON · Blocked inside gateway: ' + snapshot.blockedProviders.join(', ') : 'Off. All verified provider routes are available to this gateway.';
  $('outage').disabled = !running || snapshot.blockedProviders.includes('sia') || snapshot.activeRoute !== 'sia';
  $('outageStorj').disabled = !running || snapshot.blockedProviders.includes('storj') || snapshot.activeRoute !== 'storj';
  const tbody = $('events'); tbody.replaceChildren();
  for (const e of snapshot.events.slice(-60).reverse()) {
    const row = document.createElement('tr');
    const values = [e.at.slice(11, 23), e.kind, e.provider || e.to || '—'];
    for (const value of values) { const td = document.createElement('td'); td.textContent = value; row.append(td); }
    const td = document.createElement('td');
    td.textContent = [e.object, e.httpStatus ? 'HTTP ' + e.httpStatus : '', e.bytes !== undefined ? e.bytes.toLocaleString() + ' bytes' : '',
      e.requestMs !== undefined ? ms(e.requestMs) : '', e.code, e.note].filter(Boolean).join(' · ');
    if (e.sha256) { const hash = document.createElement('div'); hash.className = 'hash'; hash.textContent = 'SHA-256 ' + e.sha256; td.append(hash); }
    row.append(td); tbody.append(row);
  }
}
async function poll() {
  if (polling) return;
  polling = true;
  try {
    const r = await fetch('/api/status'); if (!r.ok) throw new Error(); snapshot = await r.json(); render(); errorNoted = false;
  } catch { if (!errorNoted) { message('Gateway connection lost. Check the PowerShell server window.'); errorNoted = true; } }
  finally { polling = false; }
}
$('start').onclick = async () => {
  try {
    $('start').disabled = true; stop(); await action('/api/reset');
    samples = []; latestStallMs = null; lastFrame = null; frames = 0; runStarted = new Date().toISOString(); $('stall').textContent = 'Not observed';
    running = true; note('START');
    if (!window.Hls || !Hls.isSupported()) throw new Error('Use current Chrome or Edge with Media Source Extensions.');
    hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60, maxBufferSize: 0, backBufferLength: 0, enableWorker: true });
    hls.on(Hls.Events.FRAG_CHANGED, (_event, data) => { fragment = { name: new URL(data.frag.url, location.href).pathname.split('/').pop(), start: data.frag.start, duration: data.frag.duration }; note('PLAYBACK_FRAGMENT', fragment); });
    hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) { note('FATAL_PLAYER_ERROR', { type: data.type, details: data.details }); message('Player stopped: ' + data.details + '. Export evidence before resetting.'); running = false; $('outage').disabled = true; } });
    hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => message('Press Play in the video controls.')); });
    hls.attachMedia(video); hls.loadSource(playerURL);
    message('Sia is primary. Once playback starts, simulate its outage to exercise fallback.');
  } catch (error) { running = false; message(error.message); }
  finally { $('start').disabled = false; }
};
$('outage').onclick = async () => {
  $('outage').disabled = true;
  try { note('SIMULATION_CLICK'); await action('/api/outage'); message('Sia blocked in this gateway. The next affected request will try Storj automatically.'); }
  catch (error) { message(error.message); }
};
$('outageStorj').onclick = async () => {
  $('outageStorj').disabled = true;
  try { note('STORJ_SIMULATION_CLICK'); await action('/api/outage/storj'); message('Storj blocked in this gateway. The next affected request will try another verified provider, including Lighthouse.'); }
  catch (error) { message(error.message); }
};
$('reset').onclick = async () => {
  stop();
  try { await action('/api/reset'); samples = []; latestStallMs = null; lastFrame = null; frames = 0; $('stall').textContent = 'Not observed'; $('frame').textContent = 'No decoded frames observed yet.'; message('Demo reset. Start video for a new run.'); }
  catch (error) { message(error.message); }
};
video.addEventListener('waiting', () => { if (running && !video.paused && lastFrame !== null && waitingAt === null) { waitingAt = performance.now(); note('WAITING'); } $('playState').textContent = 'Buffering'; });
video.addEventListener('playing', () => { $('playState').textContent = 'Playing'; note('PLAYING'); });
video.addEventListener('pause', () => { waitingAt = null; $('playState').textContent = 'Paused'; note('PAUSED'); });
video.addEventListener('seeking', () => { waitingAt = null; lastFrame = null; note('SEEKING'); });
video.addEventListener('ended', () => { running = false; waitingAt = null; $('playState').textContent = 'Finished'; $('outage').disabled = true; note('ENDED'); });
if ('requestVideoFrameCallback' in video) {
  const frame = (_now, meta) => {
    if (running && !video.paused && (lastFrame === null || meta.mediaTime > lastFrame)) {
      frames++;
      if (waitingAt !== null) { latestStallMs = Math.round(performance.now() - waitingAt); note('ADVANCING_FRAME_AFTER_WAIT', { stallMs: latestStallMs }); waitingAt = null; $('stall').textContent = ms(latestStallMs); }
      lastFrame = meta.mediaTime;
      const source = snapshot?.events.findLast(e => e.kind === 'DELIVERED' && e.object === fragment?.name)?.provider;
      $('frame').textContent = `Frames advancing · ${meta.mediaTime.toFixed(2)} s` + (fragment ? ` · ${fragment.name} · ${source ? source.toUpperCase() : 'route pending'}` : '');
    }
    video.requestVideoFrameCallback(frame);
  };
  video.requestVideoFrameCallback(frame);
} else { $('frame').textContent = 'Frame-level measurement unavailable in this browser.'; }
setInterval(() => {
  let ahead = 0;
  for (let i = 0; i < video.buffered.length; i++) if (video.currentTime >= video.buffered.start(i) && video.currentTime <= video.buffered.end(i)) ahead = video.buffered.end(i) - video.currentTime;
  $('buffer').textContent = 'Buffered ahead: ' + ahead.toFixed(1) + ' s';
}, 500);
$('export').onclick = async () => {
  await poll();
  const report = { demo: 'RelayStream standalone YC provider failover', exportedAt: new Date().toISOString(), runStarted,
    disclosure: 'Sia and Storj outages, when enabled, are simulated inside the gateway. Upstream media downloads and hash checks are real.',
    limitations: 'Browser events are client observations, not signed attestations. Buffered playback may mask an outage. Rights clearance is not verified by this software.',
    playerURL, gateway: snapshot, browser: { framesObserved: frames, currentTime: video.currentTime, latestStallMs, events: samples } };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'relaystream-run-' + Date.now() + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000);
};
(async () => {
  try { const r = await fetch('/api/session'); if (!r.ok) throw new Error(); ({ token } = await r.json()); await poll(); message('Ready. Start video to retrieve media through RelayStream.'); setInterval(poll, 600); }
  catch { message('Could not initialize dashboard. Check the local server.'); $('start').disabled = true; }
})();
