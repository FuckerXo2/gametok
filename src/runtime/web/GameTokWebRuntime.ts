export type GameTokLifecycleCommand =
  | 'GAMETOK_PRELOAD'
  | 'GAMETOK_ACTIVATE'
  | 'GAMETOK_PAUSE'
  | 'GAMETOK_RESUME'
  | 'GAMETOK_DESTROY';

export type GameTokQualityTier = 'low' | 'medium' | 'high';

export interface GameTokRuntimeMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Installed before game code. It is deliberately browser-native: games remain ordinary web
 * games, while the app gains a small lifecycle/performance channel when hosting them.
 */
export const GAMETOK_WEB_RUNTIME_SCRIPT = `
(function () {
  if (window.GameTokRuntime) return true;

  var VERSION = '1.0.0';
  var state = 'booting';
  var quality = 'high';
  var listeners = Object.create(null);
  var frameCount = 0;
  var sampleStartedAt = performance.now();
  var lastTelemetryAt = 0;
  var telemetryFrame = 0;
  var activeFrameToken = 0;
  var gameReady = false;

  function lockGameViewport() {
    try {
      var viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.setAttribute('name', 'viewport');
        viewport.setAttribute(
          'content',
          'initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'
        );
        document.head.appendChild(viewport);
      }
      var style = document.getElementById('gametok-game-surface-style');
      if (!style) {
        style = document.createElement('style');
        style.id = 'gametok-game-surface-style';
        style.textContent =
          '*{-webkit-tap-highlight-color:transparent!important}' +
          'html,body{width:100%;height:100%;margin:0;overflow:hidden!important;' +
          'overscroll-behavior:none!important;touch-action:none!important;' +
          '-webkit-user-select:none!important;user-select:none!important;' +
          '-webkit-touch-callout:none!important;background:#000}' +
          'img,a{-webkit-user-drag:none!important}';
        (document.head || document.documentElement).appendChild(style);
      }
    } catch (error) {}
  }

  lockGameViewport();
  document.addEventListener('DOMContentLoaded', lockGameViewport, { once: true });
  document.addEventListener('gesturestart', function (event) { event.preventDefault(); }, { passive: false });
  document.addEventListener('dragstart', function (event) { event.preventDefault(); }, { passive: false });
  document.addEventListener('selectstart', function (event) { event.preventDefault(); }, { passive: false });

  function post(message) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }
    } catch (error) {}
  }

  function emit(name, detail) {
    var callbacks = listeners[name] || [];
    callbacks.slice().forEach(function (callback) {
      try { callback(detail); } catch (error) {}
    });
    try {
      window.dispatchEvent(new CustomEvent('gametok:' + name, { detail: detail }));
    } catch (error) {}
  }

  function transition(nextState, detail) {
    state = nextState;
    emit(nextState, detail || {});
    post({ type: 'GAMETOK_STATE', state: state, version: VERSION });
    if (state === 'active') {
      startSampling();
      var token = ++activeFrameToken;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (state === 'active' && token === activeFrameToken) {
            post({ type: 'GAMETOK_FIRST_ACTIVE_FRAME', version: VERSION });
          }
        });
      });
    } else {
      activeFrameToken++;
      stopSampling();
    }
  }

  function handleMessage(event) {
    var message = event && event.data;
    try {
      if (typeof message === 'string') message = JSON.parse(message);
    } catch (error) {
      return;
    }
    if (!message || typeof message.type !== 'string') return;

    switch (message.type) {
      case 'GAMETOK_PRELOAD':
        transition('preloaded', message);
        break;
      case 'GAMETOK_ACTIVATE':
        transition('active', message);
        break;
      case 'GAMETOK_PAUSE':
        transition('paused', message);
        break;
      case 'GAMETOK_RESUME':
        transition('active', message);
        break;
      case 'GAMETOK_DESTROY':
        transition('destroyed', message);
        try {
          // 1. Purge all WebGL canvases and release GPU texture allocations synchronously
          var canvases = document.querySelectorAll('canvas');
          for (var ci = 0; ci < canvases.length; ci++) {
            var cgl = canvases[ci].getContext('webgl2') || canvases[ci].getContext('webgl') || canvases[ci].getContext('experimental-webgl');
            if (cgl) {
              var cext = cgl.getExtension('WEBGL_lose_context');
              if (cext && cext.loseContext) cext.loseContext();
            }
          }
        } catch (err) {}
        try {
          // 2. Explicitly close all active Web Audio Contexts to terminate native audio threads
          if (window.__gametok_audio_ctx && typeof window.__gametok_audio_ctx.close === 'function') {
            try { window.__gametok_audio_ctx.close().catch(function () {}); } catch (e) {}
            window.__gametok_audio_ctx = null;
          }
          for (var key in window) {
            try {
              var val = window[key];
              if (val && typeof val === 'object' && typeof val.close === 'function' && typeof val.currentTime === 'number') {
                try { val.close().catch(function () {}); } catch (e) {}
              }
            } catch (e) {}
          }
        } catch (err) {}
        listeners = Object.create(null);
        break;
      case 'GAMETOK_SET_QUALITY':
        if (message.quality === 'low' || message.quality === 'medium' || message.quality === 'high') {
          quality = message.quality;
          emit('qualitychange', { quality: quality, reason: message.reason || 'host' });
          post({ type: 'GAMETOK_QUALITY', quality: quality, version: VERSION });
        }
        break;
    }
  }

  window.GameTokRuntime = {
    version: VERSION,
    on: function (name, callback) {
      if (typeof callback !== 'function') return function () {};
      (listeners[name] || (listeners[name] = [])).push(callback);
      return function () {
        var callbacks = listeners[name] || [];
        var index = callbacks.indexOf(callback);
        if (index >= 0) callbacks.splice(index, 1);
      };
    },
    off: function (name, callback) {
      var callbacks = listeners[name] || [];
      var index = callbacks.indexOf(callback);
      if (index >= 0) callbacks.splice(index, 1);
    },
    ready: function (detail) {
      // Readiness is a capability flag, not a lifecycle state. A slow game may
      // finish booting after the host has already activated it; replacing
      // "active" with "ready" here would stop telemetry and lose the reveal
      // handshake until another host transition happened.
      gameReady = true;
      emit('ready', detail || {});
      post({ type: 'GAMETOK_GAME_READY', detail: detail || {}, version: VERSION });
    },
    reportMetrics: function (metrics) {
      post({ type: 'GAMETOK_GAME_METRICS', metrics: metrics || {}, version: VERSION });
    },
    getState: function () { return state; },
    isReady: function () { return gameReady; },
    getQuality: function () { return quality; }
  };

  window.addEventListener('message', handleMessage);
  document.addEventListener('message', handleMessage);

  window.addEventListener('webglcontextlost', function () {
    post({ type: 'GAMETOK_WEBGL_CONTEXT_LOST', version: VERSION });
  }, false);
  window.addEventListener('webglcontextrestored', function () {
    post({ type: 'GAMETOK_WEBGL_CONTEXT_RESTORED', version: VERSION });
  }, false);

  var frameDeltas = [];
  var lastFrameNow = 0;

  function stopSampling() {
    if (telemetryFrame) cancelAnimationFrame(telemetryFrame);
    telemetryFrame = 0;
    frameCount = 0;
    frameDeltas = [];
    sampleStartedAt = performance.now();
    lastFrameNow = 0;
  }

  function startSampling() {
    if (telemetryFrame) return;
    frameCount = 0;
    frameDeltas = [];
    sampleStartedAt = performance.now();
    lastFrameNow = sampleStartedAt;
    telemetryFrame = requestAnimationFrame(sample);
  }

  function sample(now) {
    telemetryFrame = 0;
    if (state !== 'active') return;
    frameCount += 1;
    if (lastFrameNow > 0) {
      frameDeltas.push(now - lastFrameNow);
    }
    lastFrameNow = now;

    var elapsed = now - sampleStartedAt;
    if (state === 'active' && elapsed >= 1000 && now - lastTelemetryAt >= 1000) {
      var sorted = frameDeltas.slice().sort(function (a, b) { return a - b; });
      var p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : 16.6;
      var p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 16.6;

      post({
        type: 'GAMETOK_HOST_TELEMETRY',
        fps: Math.round((frameCount * 1000) / elapsed),
        frameMs: Math.round((elapsed / Math.max(frameCount, 1)) * 10) / 10,
        p50: Math.round(p50 * 10) / 10,
        p95: Math.round(p95 * 10) / 10,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        dpr: window.devicePixelRatio || 1,
        quality: quality,
        state: state,
        version: VERSION
      });
      frameCount = 0;
      frameDeltas = [];
      sampleStartedAt = now;
      lastTelemetryAt = now;
    } else if (elapsed >= 1000) {
      frameCount = 0;
      frameDeltas = [];
      sampleStartedAt = now;
    }
    telemetryFrame = requestAnimationFrame(sample);
  }

  post({ type: 'GAMETOK_RUNTIME_READY', version: VERSION });
})();
true;
`;

export const createLifecycleMessage = (
  type: GameTokLifecycleCommand,
  gameId?: string,
): string => JSON.stringify({ type, gameId, sentAt: Date.now() });

export const createQualityMessage = (
  quality: GameTokQualityTier,
  reason: string,
): string => JSON.stringify({
  type: 'GAMETOK_SET_QUALITY',
  quality,
  reason,
  sentAt: Date.now(),
});

export const WEBGL_LOSE_CONTEXT_SCRIPT = `
(function() {
  try {
    var canvases = document.querySelectorAll('canvas');
    for (var i = 0; i < canvases.length; i++) {
      var gl = canvases[i].getContext('webgl2') || canvases[i].getContext('webgl') || canvases[i].getContext('experimental-webgl');
      if (gl) {
        var ext = gl.getExtension('WEBGL_lose_context');
        if (ext && ext.loseContext) ext.loseContext();
      }
    }
  } catch(e) {}
})();
true;
`;
