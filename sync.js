/* sync.js — Cross-device progress sync, IP-keyed.
 *
 * Same public IP = same session. Progress + book/chapter metadata syncs;
 * SETTINGS stay device-local (per spec — desktop and mobile shouldn't
 * share font sizes / margin choices).
 *
 * Backend lives at the existing TTS Space: erikmoyer-tts-tool.hf.space.
 * Two endpoints: GET/POST /api/sync/{ip}. Last-write-wins by timestamp.
 *
 * What syncs (per-book progress + last-loaded markers):
 *   /reader/   ebr_book_last, ebr_pos_*, ebr_audio_last, ebr_audio_*
 *   /audiobooker/  jbj_last, jbj_*
 *
 * What doesn't (settings, device-local):
 *   ebr_settings, tlt_langs
 *
 * What can't (file blobs in IndexedDB, often 50–500MB):
 *   When metadata says "device A is reading X.epub at chapter 5" but
 *   device B doesn't have the file, the page shows the file name + an
 *   "upload to continue" prompt. The user re-drops the file on device B
 *   and sync resumes.
 *
 * Public API:
 *   window.EMSync.push()        — debounced 5s push of all sync keys
 *   window.EMSync.pushNow()     — immediate push (no debounce)
 *   window.EMSync.pull()        — fetch remote state, apply if newer
 *   window.EMSync.getIP()       — returns the cached public IP (or fetches)
 *   window.EMSync.lastSyncTs    — timestamp of last successful push/pull
 *   'em-sync-applied' event     — fires when remote state was applied
 *                                  (event.detail.changedKeys has the keys)
 */
(function(){
  var SYNC_API = 'https://erikmoyer-tts-tool.hf.space/api/sync';

  // localStorage key prefixes that are sync-eligible
  var SYNC_KEY_PATTERNS = [
    /^ebr_book_last$/,
    /^ebr_pos_/,
    /^ebr_audio_last$/,
    /^ebr_audio_/,
    /^jbj_last$/,
    /^jbj_/,
  ];

  // Cache the IP for the session (ipify is rate-limited; 1 fetch is enough)
  var userIP = null;
  var ipPromise = null;
  var syncDebounce = null;
  var lastSyncTs = 0;
  var applying = false;  // set during applyRemoteState so push doesn't fire

  function isSyncKey(key) {
    if (!key) return false;
    for (var i = 0; i < SYNC_KEY_PATTERNS.length; i++) {
      if (SYNC_KEY_PATTERNS[i].test(key)) return true;
    }
    return false;
  }

  async function getIP() {
    if (userIP) return userIP;
    if (ipPromise) return ipPromise;
    ipPromise = (async function(){
      try {
        var r = await fetch('https://api.ipify.org?format=json');
        var d = await r.json();
        userIP = d.ip;
        return userIP;
      } catch (e) {
        console.warn('[sync] IP detection failed:', e);
        return null;
      }
    })();
    return ipPromise;
  }

  function readLocalState() {
    var state = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (isSyncKey(key)) {
        state[key] = localStorage.getItem(key);
      }
    }
    return state;
  }

  function applyRemoteState(remoteState) {
    if (!remoteState) return [];
    var changed = [];
    applying = true;
    try {
      // Clean up sync keys that exist locally but not in remote
      // (keeps devices in sync when book is removed on one)
      var localKeys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (isSyncKey(k)) localKeys.push(k);
      }
      for (var j = 0; j < localKeys.length; j++) {
        var lk = localKeys[j];
        if (!(lk in remoteState)) {
          // Don't auto-delete — be conservative. Future enhancement.
        }
      }
      // Apply remote values that differ from local
      for (var key in remoteState) {
        if (!isSyncKey(key)) continue;
        var local = localStorage.getItem(key);
        if (local !== remoteState[key]) {
          localStorage.setItem(key, remoteState[key]);
          changed.push(key);
        }
      }
    } finally {
      applying = false;
    }
    return changed;
  }

  async function pushSync() {
    if (applying) return;  // Don't push while we're applying remote state
    var ip = await getIP();
    if (!ip) return;
    var state = readLocalState();
    if (Object.keys(state).length === 0) return;
    try {
      var r = await fetch(SYNC_API + '/' + encodeURIComponent(ip), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(state),
      });
      if (r.ok) {
        var d = await r.json();
        lastSyncTs = d.ts || Date.now() / 1000;
      }
    } catch (e) {
      console.warn('[sync] push failed:', e);
    }
  }

  async function pullSync() {
    var ip = await getIP();
    if (!ip) return;
    try {
      var r = await fetch(SYNC_API + '/' + encodeURIComponent(ip));
      if (!r.ok) return;
      var d = await r.json();
      if (!d.state) return;
      // Only apply if remote is strictly newer than what we last pushed
      if (d.ts && d.ts > lastSyncTs) {
        var changed = applyRemoteState(d.state);
        lastSyncTs = d.ts;
        if (changed.length > 0) {
          console.log('[sync] applied remote state, changed keys:', changed);
          window.dispatchEvent(new CustomEvent('em-sync-applied', {
            detail: {changedKeys: changed, state: d.state, ts: d.ts}
          }));
        }
      }
    } catch (e) {
      console.warn('[sync] pull failed:', e);
    }
  }

  window.EMSync = {
    push: function(){
      if (syncDebounce) clearTimeout(syncDebounce);
      syncDebounce = setTimeout(pushSync, 5000);
    },
    pushNow: pushSync,
    pull: pullSync,
    getIP: getIP,
    get lastSyncTs(){ return lastSyncTs; },
  };

  // Auto-pull on load (after a brief delay so the host page initializes first)
  window.addEventListener('load', function(){
    setTimeout(pullSync, 800);
  });

  // Cross-tab sync: if another tab writes a sync key, push from this tab
  window.addEventListener('storage', function(e){
    if (isSyncKey(e.key)) window.EMSync.push();
  });

  // Push pending state when the tab is being hidden/closed
  window.addEventListener('beforeunload', function(){
    if (syncDebounce) {
      clearTimeout(syncDebounce);
      // Synchronous-ish push using sendBeacon if available
      if (navigator.sendBeacon && userIP) {
        var state = readLocalState();
        if (Object.keys(state).length > 0) {
          var blob = new Blob([JSON.stringify(state)], {type: 'application/json'});
          navigator.sendBeacon(SYNC_API + '/' + encodeURIComponent(userIP), blob);
        }
      }
    }
  });
})();
