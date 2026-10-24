// Cloud save, injected into each game once it has loaded (signed-in players only). Same rules as
// the website's gametok.co/cloud-save.js:
// - Save: keys the game writes to localStorage go to native (CLOUD_SAVE), debounced and on hide.
//   Hosted games share one storage origin, so only keys this game wrote are sent, tracked per
//   page path, never another game's.
// - Restore: saved keys this device doesn't have are written in and the game reloads once so it
//   starts with them (this runs after load, when the game has already read its storage). Local
//   progress is never replaced.
export const createCloudSaveScript = (gameId: string, initialData: Record<string, string> = {}) => `
(function() {
  if (window._cloudSaveActive) return;
  window._cloudSaveActive = true;
  var GAME_ID = ${JSON.stringify(gameId)};
  var store;
  try { store = window.localStorage; if (!store) return; } catch (e) { return; }
  var scope = location.pathname.replace(/[^/]*$/, '');
  var KEYS = '__gt_keys:' + scope;
  var RESTORED = '__gt_restored:' + scope;
  var setItem = store.setItem.bind(store);
  var removeItem = store.removeItem.bind(store);
  var clear = store.clear.bind(store);
  var owned = {};
  try { owned = JSON.parse(store.getItem(KEYS) || '{}') || {}; } catch (e) { owned = {}; }
  var remember = function() { try { setItem(KEYS, JSON.stringify(owned)); } catch (e) {} };

  var timer = null;
  var send = function() {
    timer = null;
    var data = {};
    for (var k in owned) { var v = store.getItem(k); if (v !== null) data[k] = v; }
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CLOUD_SAVE', gameId: GAME_ID, storageData: data }));
  };
  var schedule = function() { if (timer) clearTimeout(timer); timer = setTimeout(send, 2000); };
  store.setItem = function(key, value) {
    setItem(key, value);
    key = String(key);
    if (key.indexOf('__gt_') !== 0) { if (!owned[key]) { owned[key] = 1; remember(); } schedule(); }
  };
  store.removeItem = function(key) { removeItem(key); if (owned[key]) { delete owned[key]; remember(); schedule(); } };
  store.clear = function() { clear(); owned = {}; remember(); schedule(); };
  var flush = function() { if (timer) { clearTimeout(timer); send(); } };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'hidden') flush(); });

  var saved = ${JSON.stringify(initialData)};
  var changed = false;
  for (var key in saved) {
    if (key.indexOf('__gt_') === 0) continue;
    owned[key] = 1;
    if (store.getItem(key) === null) { setItem(key, String(saved[key])); changed = true; }
  }
  remember();
  var already = false;
  try { already = sessionStorage.getItem(RESTORED) === '1'; } catch (e) {}
  if (changed && !already) {
    try { sessionStorage.setItem(RESTORED, '1'); } catch (e) {}
    location.reload();
  }
})();
true;
`;
