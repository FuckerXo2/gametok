// GameSurface — the one place a game is sized and rotated for playback.
//
// Landscape games are played by rotating an integer-aligned container View 90 degrees inside
// a portrait box. The device stays portrait-locked; the player turns the phone. The game is laid out
// at the transposed size from its very first layout (e.g. 874x402), so it boots straight into a full-screen
// landscape viewport with no letterbox, no resize, no orientationchange, and no flash of portrait.
//
// To prevent bilinear texture blur ("fog") on iOS WKWebView, the rotation is applied to an intermediate
// native UIView container with exact integer offsets Math.round((evenW - evenH)/2) rather than non-integer
// floating points or direct WKWebView layer rotation. The WebView itself remains unrotated at full native 3x
// Retina resolution with hardware acceleration (-webkit-transform: translateZ(0)) and WebGL fog patching.

import React, { forwardRef, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Platform, Alert, DeviceEventEmitter, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import { isLandscape, DEFAULT_ORIENTATION, type Orientation } from '../constants/orientation';
import { buyItem, getAvatarAccount, syncAvatar, useAvatar } from '../avatar/store';
import { playerSessions } from '../services/api';
import { LOCAL_GAMES } from '../dev/localGames';
import { APP_VERSION } from './UpdateRequired';
import { BuyItemSheet, BuyRequest } from './BuyItemSheet';

export const GAMES_HOST = 'https://games.gametok.co';

/** Build the play URL for a game. Shared so every surface points at the same place. */
export const buildGameUrl = (
  game: { id: string; embedUrl?: string | null },
  apiOrigin: string,
): string => {
  if (LOCAL_GAMES[game.id]) return LOCAL_GAMES[game.id];   // dev: the game from this Mac (src/dev/localGames.ts)
  const rawUrl = game.embedUrl
    ? (game.embedUrl.startsWith('/') ? `${apiOrigin}${game.embedUrl}` : game.embedUrl)
    : `${GAMES_HOST}/${game.id}/`;
  const separator = rawUrl.includes('?') ? '&' : '?';
  return `${rawUrl}${separator}gd_sdk_referrer_url=${encodeURIComponent(GAMES_HOST)}`;
};

type Props = WebViewProps & {
  opaque?: boolean;
  backgroundColor?: string;
  orientation?: Orientation | string | null;
  containerStyle?: StyleProp<ViewStyle>;
  box?: { width: number; height: number } | null;
  runtime?: 'web' | 'native';
  gameScript?: string;
  showControls?: boolean;
  controlsConfig?: any;
  onScore?: (score: number) => void;
  onGameOver?: (won: boolean, score?: number) => void;
  /** The catalog id: lets the game ask who's playing (bridge.js GameTok.session()). */
  gameId?: string;
  /** Opened from a friend's Join: their GameTok user id. The game gets who they are in it (their per-game player id,
   *  from the player session) as window.GAMETOK_JOIN_FRIEND, and puts you in their party. */
  joinFriend?: string | null;
};

const buildCrispViewportScript = (w: number, h: number, isRotated: boolean) => `
(function() {
  try {
    var LW = ${w};
    var LH = ${h};
    var isRot = ${isRotated ? 'true' : 'false'};

    // 1. Precise viewport: keep device-width unscaled at native 1.0 scale
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      (document.head || document.documentElement).appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

    // 2. Hardware touch device capability spoofing (always coarse pointer & touch-enabled)
    try {
      if (!('ontouchstart' in window)) {
        window.ontouchstart = null;
      }
      if (navigator.maxTouchPoints < 5) {
        Object.defineProperty(navigator, 'maxTouchPoints', { get: function() { return 5; }, configurable: true });
      }
    } catch(e) {}

    // Global media query spoofing for JS matchMedia (coarse pointer, touch, hover: none)
    try {
      var origMatchMedia = window.matchMedia;
      window.matchMedia = function(query) {
        var q = String(query).toLowerCase();
        var matches = false;
        if (q.indexOf('pointer: coarse') !== -1 || q.indexOf('pointer:coarse') !== -1) {
          matches = true;
        } else if (q.indexOf('pointer: fine') !== -1 || q.indexOf('pointer:fine') !== -1) {
          matches = false;
        } else if (q.indexOf('hover: hover') !== -1 || q.indexOf('hover:hover') !== -1) {
          matches = false;
        } else if (q.indexOf('hover: none') !== -1 || q.indexOf('hover:none') !== -1) {
          matches = true;
        } else if (isRot && (q.indexOf('orientation: landscape') !== -1 || q.indexOf('orientation:landscape') !== -1)) {
          matches = true;
        } else if (isRot && (q.indexOf('orientation: portrait') !== -1 || q.indexOf('orientation:portrait') !== -1)) {
          matches = false;
        } else if (origMatchMedia) {
          return origMatchMedia.call(window, query);
        }
        return {
          matches: matches,
          media: query,
          onchange: null,
          addListener: function() {},
          removeListener: function() {},
          addEventListener: function() {},
          removeEventListener: function() {},
          dispatchEvent: function() { return false; }
        };
      };
    } catch(e) {}

    // 3. Transposed dimension overrides & input mapping for rotated landscape
    if (isRot) {
      try {
        Object.defineProperty(window, 'innerWidth',  { get: function() { return LW; }, configurable: true });
        Object.defineProperty(window, 'innerHeight', { get: function() { return LH; }, configurable: true });
        Object.defineProperty(screen, 'width',       { get: function() { return LW; }, configurable: true });
        Object.defineProperty(screen, 'height',      { get: function() { return LH; }, configurable: true });
        Object.defineProperty(screen, 'availWidth',  { get: function() { return LW; }, configurable: true });
        Object.defineProperty(screen, 'availHeight', { get: function() { return LH; }, configurable: true });
        if (window.visualViewport) {
          Object.defineProperty(window.visualViewport, 'width',  { get: function() { return LW; }, configurable: true });
          Object.defineProperty(window.visualViewport, 'height', { get: function() { return LH; }, configurable: true });
          Object.defineProperty(window.visualViewport, 'scale',  { get: function() { return 1.0; }, configurable: true });
        }
        if (document.documentElement) {
          Object.defineProperty(document.documentElement, 'clientWidth',  { get: function() { return LW; }, configurable: true });
          Object.defineProperty(document.documentElement, 'clientHeight', { get: function() { return LH; }, configurable: true });
        }
        Object.defineProperty(window, 'orientation', { get: function() { return 90; }, configurable: true });
        if (screen.orientation) {
          try {
            Object.defineProperty(screen.orientation, 'type', { get: function() { return 'landscape-primary'; }, configurable: true });
            Object.defineProperty(screen.orientation, 'angle', { get: function() { return 90; }, configurable: true });
          } catch(e) {}
        }
      } catch(e) {}

      // Element rect overrides for rotated coordinate space
      try {
        var origGetBoundingClientRect = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function() {
          var r = origGetBoundingClientRect.call(this);
          if (!r) return r;
          if (this === document.documentElement || this === document.body) {
            if (typeof DOMRect !== 'undefined') {
              return new DOMRect(0, 0, LW, LH);
            }
            return { left: 0, top: 0, right: LW, bottom: LH, x: 0, y: 0, width: LW, height: LH, toJSON: function() { return this; } };
          }
          var lsLeft = r.top;
          var lsTop = LH - r.right;
          var lsWidth = r.height;
          var lsHeight = r.width;
          if (typeof DOMRect !== 'undefined') {
            return new DOMRect(lsLeft, lsTop, lsWidth, lsHeight);
          }
          return {
            left: lsLeft,
            top: lsTop,
            right: lsLeft + lsWidth,
            bottom: lsTop + lsHeight,
            x: lsLeft,
            y: lsTop,
            width: lsWidth,
            height: lsHeight,
            toJSON: function() { return this; }
          };
        };
      } catch(e) {}

      // Coordinate mapping for rotated touch/pointer events (Physical Y -> Landscape X, LH - Physical X -> Landscape Y)
      try {
        var mapX = function(origX, origY) { return origY; };
        var mapY = function(origX, origY) { return LH - origX; };

        var patchProto = function(Proto) {
          if (!Proto) return;
          var descX = Object.getOwnPropertyDescriptor(Proto, 'clientX');
          var descY = Object.getOwnPropertyDescriptor(Proto, 'clientY');
          var descPX = Object.getOwnPropertyDescriptor(Proto, 'pageX');
          var descPY = Object.getOwnPropertyDescriptor(Proto, 'pageY');
          var descSX = Object.getOwnPropertyDescriptor(Proto, 'screenX');
          var descSY = Object.getOwnPropertyDescriptor(Proto, 'screenY');
          var descMX = Object.getOwnPropertyDescriptor(Proto, 'movementX');
          var descMY = Object.getOwnPropertyDescriptor(Proto, 'movementY');

          if (descX && descY && descX.get && descY.get) {
            Object.defineProperty(Proto, 'clientX', {
              get: function() {
                var ox = descX.get.call(this);
                var oy = descY.get.call(this);
                return mapX(ox, oy);
              },
              configurable: true
            });
            Object.defineProperty(Proto, 'clientY', {
              get: function() {
                var ox = descX.get.call(this);
                var oy = descY.get.call(this);
                return mapY(ox, oy);
              },
              configurable: true
            });
          }
          if (descPX && descPY && descPX.get && descPY.get) {
            Object.defineProperty(Proto, 'pageX', {
              get: function() {
                var ox = descPX.get.call(this);
                var oy = descPY.get.call(this);
                return mapX(ox, oy);
              },
              configurable: true
            });
            Object.defineProperty(Proto, 'pageY', {
              get: function() {
                var ox = descPX.get.call(this);
                var oy = descPY.get.call(this);
                return mapY(ox, oy);
              },
              configurable: true
            });
          }
          if (descSX && descSY && descSX.get && descSY.get) {
            Object.defineProperty(Proto, 'screenX', {
              get: function() {
                var ox = descSX.get.call(this);
                var oy = descSY.get.call(this);
                return mapX(ox, oy);
              },
              configurable: true
            });
            Object.defineProperty(Proto, 'screenY', {
              get: function() {
                var ox = descSX.get.call(this);
                var oy = descSY.get.call(this);
                return mapY(ox, oy);
              },
              configurable: true
            });
          }
          if (descMX && descMY && descMX.get && descMY.get) {
            Object.defineProperty(Proto, 'movementX', {
              get: function() {
                var oy = descMY.get.call(this);
                return oy;
              },
              configurable: true
            });
            Object.defineProperty(Proto, 'movementY', {
              get: function() {
                var ox = descMX.get.call(this);
                return -ox;
              },
              configurable: true
            });
          }
        };

        if (typeof Touch !== 'undefined') patchProto(Touch.prototype);
        if (typeof MouseEvent !== 'undefined') patchProto(MouseEvent.prototype);
        if (typeof PointerEvent !== 'undefined') patchProto(PointerEvent.prototype);
      } catch(e) {}

      // Adapt existing and dynamic <style> blocks so CSS media queries activate mobile controls
      function patchCSS(txt) {
        if (!txt || typeof txt !== 'string') return txt;
        return txt
          .replace(/\\(orientation\\s*:\\s*portrait\\)/gi, '(max-width: 0px)')
          .replace(/\\(orientation\\s*:\\s*landscape\\)/gi, '(min-width: 0px)')
          .replace(/\\(pointer\\s*:\\s*fine\\)/gi, '(max-width: 0px)')
          .replace(/\\(hover\\s*:\\s*hover\\)/gi, '(max-width: 0px)')
          .replace(/\\(pointer\\s*:\\s*coarse\\)/gi, '(min-width: 0px)')
          .replace(/\\(hover\\s*:\\s*none\\)/gi, '(min-width: 0px)')
          .replace(/\\(max-height\\s*:\\s*([0-9]+)px\\)/gi, function(match, val) {
            return Number(val) >= LH ? '(min-width: 0px)' : match;
          });
      }

      function patchAllStyles() {
        try {
          var styles = document.querySelectorAll('style');
          for (var i = 0; i < styles.length; i++) {
            var s = styles[i];
            if (s.id === 'gametok-surface-crisp') continue;
            var original = s.textContent;
            if (original && (original.indexOf('orientation') !== -1 || original.indexOf('max-height') !== -1 || original.indexOf('pointer') !== -1 || original.indexOf('hover') !== -1)) {
              var patched = patchCSS(original);
              if (patched !== original) {
                s.textContent = patched;
              }
            }
          }
        } catch(e) {}
      }

      patchAllStyles();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', patchAllStyles, { once: true });
      }
      try {
        var obs = new MutationObserver(patchAllStyles);
        obs.observe(document.documentElement || document, { childList: true, subtree: true });
      } catch(e) {}
    }

    // 4. Retina crisp style enforcement & full mobile control availability
    function applyCrispStyles() {
      try {
        var s = document.getElementById('gametok-surface-crisp');
        if (!s) {
          s = document.createElement('style');
          s.id = 'gametok-surface-crisp';
          (document.head || document.documentElement).appendChild(s);
        }
        var cssRules = [
          '* { -webkit-font-smoothing: antialiased !important; }',
          'html { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; -webkit-text-size-adjust: 100% !important; background: #000 !important; touch-action: manipulation !important; }'
        ];

        if (isRot) {
          cssRules.push(
            // 'html body' outranks any plain 'body' rule a game (or bridge.js: html, body { width: 100% !important }) adds later
            'html body { position: fixed !important; top: 0 !important; left: 0 !important; width: ' + LW + 'px !important; height: ' + LH + 'px !important; margin: 0 !important; padding: 0 !important; transform-origin: 0 0 !important; transform: rotate(90deg) translateY(-' + LH + 'px) !important; -webkit-transform: rotate(90deg) translateY(-' + LH + 'px) !important; overflow: hidden !important; -webkit-text-size-adjust: 100% !important; background: #000 !important; touch-action: manipulation !important; }'
          );
        } else {
          cssRules.push(
            'body { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; -webkit-text-size-adjust: 100% !important; background: #000 !important; touch-action: manipulation !important; }'
          );
        }

        cssRules.push(
          '#app, #canvas-wrap, #root, #game, #game-container, .game-container { width: 100% !important; height: 100% !important; transform: translateZ(0) !important; -webkit-transform: translateZ(0) !important; }',
          'canvas { display: block !important; width: 100% !important; height: 100% !important; outline: none !important; touch-action: none !important; image-rendering: -webkit-optimize-contrast !important; transform: translateZ(0) !important; -webkit-transform: translateZ(0) !important; will-change: transform !important; }',
          /* Virtual touch controls override: always visible unless .hidden */
          '.touch-controls:not(.hidden), #touch-controls:not(.hidden), [class*="touch-controls"]:not(.hidden), [id*="touch-controls"]:not(.hidden), .virtual-controls:not(.hidden), .mobile-controls:not(.hidden), .touch-ui:not(.hidden), #touch-ui:not(.hidden) { display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: none !important; }',
          '.touch-control, .touch-controls button, [class*="touch-control"], [class*="touch-btn"], .virtual-btn, .sunbreak-touch-root, .sunbreak-touch-btn, #leonida-touch-ui, .leonida-touch-btn, [class*="bmx-"], [id*="bmx-"], [class*="joy"], [id*="joy"], [class*="dpad"], [id*="dpad"] { pointer-events: auto !important; touch-action: manipulation !important; -webkit-tap-highlight-color: transparent !important; display: flex !important; visibility: visible !important; }',
          '.touch-controls.hidden, #touch-controls.hidden, .hidden { display: none !important; }',
          /* Hide desktop keyboard hints on mobile touch */
          '.controls-legend, .keyboard-legend, .desktop-controls-hint, .key-hints { display: none !important; }'
        );
        s.textContent = cssRules.join('\\n');
      } catch(e) {}
    }

    function triggerViewportSync() {
      try { window.dispatchEvent(new Event('resize')); } catch(e) {}
      try { window.dispatchEvent(new Event('orientationchange')); } catch(e) {}
    }

    applyCrispStyles();
    triggerViewportSync();
    document.addEventListener('DOMContentLoaded', function() {
      applyCrispStyles();
      triggerViewportSync();
    });
    window.addEventListener('load', function() {
      applyCrispStyles();
      triggerViewportSync();
    });
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(triggerViewportSync);
    }
    setTimeout(triggerViewportSync, 100);
    setTimeout(triggerViewportSync, 300);
    setTimeout(triggerViewportSync, 700);
    setTimeout(triggerViewportSync, 1500);
  } catch(e) {}
})();
true;
`;

export const GameSurface = forwardRef<WebView, Props>(function GameSurface(
  { orientation = DEFAULT_ORIENTATION, containerStyle, box: boxProp = null, style, runtime = 'web', gameScript, showControls, controlsConfig, onScore, onGameOver, gameId, joinFriend, ...webViewProps },
  ref,
) {
  const webRef = useRef<WebView | null>(null);
  const setRefs = useCallback((w: WebView | null) => {
    webRef.current = w;
    if (typeof ref === 'function') ref(w); else if (ref) ref.current = w;
  }, [ref]);
  // reply to the game (bridge.js reads message events with no source as the app's)
  const reply = useCallback((msg: object) => {
    webRef.current?.injectJavaScript(`window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(JSON.stringify(msg))} })); true;`);
  }, []);
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const [buyReq, setBuyReq] = useState<(BuyRequest & { done: (ok: boolean, error?: string) => void }) | null>(null);
  const box = boxProp || measured;
  // the player's avatar goes into every game: games that use it read window.GAMETOK_AVATAR
  const avatar = useAvatar();
  const wantsLandscape = isLandscape(orientation);

  // Only rotate when the box is actually portrait. On a tablet already held in landscape the box
  // is the right shape, and rotating would turn the game back into a portrait letterbox.
  const rotate = wantsLandscape && !!box && box.height >= box.width;

  const evenW = box ? Math.round(box.width / 2) * 2 : 0;
  const evenH = box ? Math.round(box.height / 2) * 2 : 0;

  // A landscape game must not paint before it has been measured, or it flashes portrait first.
  const waitingForMeasure = wantsLandscape && !box;

  const GAMETOK_HARDWARE_BRIDGE = `
(function() {
  try {
    // 1. Force native Retina pixel ratio on mobile
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    window.__GAMETOK_DPR__ = dpr;

    // 2. Hardware Taptic & Bridge API
    window.GameTOK = {
      haptic: function(style) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'HAPTIC', style: style || 'medium' }));
          }
        } catch(e) {}
      },
      submitScore: function(score) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SCORE', score: Number(score) || 0 }));
          }
        } catch(e) {}
      },
      gameOver: function(won, score) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'GAME_OVER', won: !!won, score: Number(score) || 0 }));
          }
        } catch(e) {}
      }
    };

    // 3. Instant Web Audio unlock on touch
    function unlockAudio() {
      try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          if (!window.__gametok_audio_ctx) {
            window.__gametok_audio_ctx = new AudioCtx();
          }
          if (window.__gametok_audio_ctx.state === 'suspended') {
            window.__gametok_audio_ctx.resume();
          }
        }
      } catch(e) {}
      window.removeEventListener('touchstart', unlockAudio, true);
      window.removeEventListener('pointerdown', unlockAudio, true);
    }
    window.addEventListener('touchstart', unlockAudio, true);
    window.addEventListener('pointerdown', unlockAudio, true);

    // 4. Console hardening: disable selection, callouts, tap delays
    var s = document.createElement('style');
    s.id = 'gametok-console-hardening';
    s.textContent = [
      '* { -webkit-touch-callout: none !important; -webkit-user-select: none !important; user-select: none !important; -webkit-tap-highlight-color: transparent !important; }',
      'canvas { display: block !important; outline: none !important; -webkit-tap-highlight-color: transparent !important; }'
    ].filter(Boolean).join('\\n');
    (document.head || document.documentElement).appendChild(s);

    // 5. Automatic WebGL & Web Audio cleanup on unmount/freeze to eliminate Jetsam kills
    function cleanTeardown() {
      try {
        if (window.__gametok_audio_ctx && window.__gametok_audio_ctx.state !== 'closed') {
          window.__gametok_audio_ctx.close().catch(function(){});
        }
      } catch(e) {}
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
    }
    window.addEventListener('pagehide', cleanTeardown);
    window.addEventListener('freeze', cleanTeardown);
    window.addEventListener('gametok:destroy', cleanTeardown);
  } catch(e) {}
})();
true;
`;

  const viewportScript = buildCrispViewportScript(
    rotate ? evenH : evenW,
    rotate ? evenW : evenH,
    rotate,
  );

  const finalInjectedJS =
    viewportScript +
    '\n' +
    GAMETOK_HARDWARE_BRIDGE +
    '\n' +
    (avatar ? `window.GAMETOK_AVATAR = ${JSON.stringify(avatar)};\n` : '') +
    // which app this is (a game can tell an app too old for it: no version = older than 2.2.0)
    `window.GAMETOK_APP_VERSION = ${JSON.stringify(APP_VERSION)};\n` +
    (webViewProps.injectedJavaScriptBeforeContentLoaded || '');

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'HAPTIC') {
        const style = data.style;
        if (style === 'light') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else if (style === 'heavy') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } else if (style === 'success') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (style === 'error') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } else if (data.type === 'GAMETOK_PLAYER_SESSION_REQUEST' && gameId) {
        // who's playing: the signed-in GameTok player (their name and avatar), signed for this game's server
        playerSessions.create(gameId, joinFriend)
          .then((r: any) => {
            if (r.joinFriend) webRef.current?.injectJavaScript(`window.GAMETOK_JOIN_FRIEND = ${JSON.stringify(String(r.joinFriend))}; true;`);
            reply({ type: 'GAMETOK_PLAYER_SESSION', requestId: data.requestId, ok: true, player: r.player, session: r.session, mode: r.mode, expiresIn: r.expiresIn });
          })
          .catch((e: any) => reply({ type: 'GAMETOK_PLAYER_SESSION', requestId: data.requestId, ok: false, code: e?.code, error: e?.message }));
      } else if (data.type === 'GAMETOK_PURCHASE_REQUEST' && gameId) {
        // a game sells its own items for TokBux: the player confirms here, at the server's price
        const item = String(data.item || ''), id = `${gameId}:${item}`;
        const done = (ok: boolean, error?: string) => reply({ type: 'GAMETOK_PURCHASE', requestId: data.requestId, ok, item, error });
        const name = String(data.name || item).slice(0, 40);
        syncAvatar().then(() => {   // the balance as it is now (TokBux may have been bought elsewhere)
          const acct = getAvatarAccount(), price = acct?.prices[id];
          if (!acct?.signedIn || price === undefined) { done(false, 'Not for sale'); return; }
          if (acct.owned.includes(id)) { done(true); return; }
          // the buy popup (it tops up TokBux first when short)
          setBuyReq({ name, price, thumb: typeof data.thumb === 'string' ? data.thumb : null, buy: () => buyItem(id), done });
        });
      } else if (data.type === 'GAMETOK_OPEN_TOKBUX') {
        DeviceEventEmitter.emit('gametok:open-tokbux');   // the game player opens the TokBux store over the game
      } else if (data.type === 'SCORE' && onScore) {
        onScore(data.score);
      } else if (data.type === 'GAME_OVER' && onGameOver) {
        onGameOver(data.won, data.score);
      }
    } catch(e) {}
    if (webViewProps.onMessage) {
      webViewProps.onMessage(event);
    }
  }, [onScore, onGameOver, webViewProps.onMessage, gameId, reply, joinFriend]);

  return (
    <View
      style={[styles.container, containerStyle]}
      collapsable={false}
      onLayout={
        boxProp
          ? undefined
          : (e) => {
              const { width, height } = e.nativeEvent.layout;
              setMeasured((prev) =>
                prev && prev.width === width && prev.height === height ? prev : { width, height },
              );
            }
      }
    >
      {!waitingForMeasure && (
        <View style={styles.fill} collapsable={false}>
          <RNWebView
            scalesPageToFit={false}
            contentMode="mobile"
            ref={setRefs}
            onContentProcessDidTerminate={(e: any) => {
              console.warn('[GameSurface] WebContent process terminated, reloading...');
              if (webViewProps.onContentProcessDidTerminate) {
                webViewProps.onContentProcessDidTerminate(e);
              } else {
                webRef.current?.reload();
              }
            }}
            setSupportMultipleWindows={false}
            saveFormDataDisabled={true}
            geolocationEnabled={false}
            setBuiltInZoomControls={false}
            setDisplayZoomControls={false}
            cacheEnabled={webViewProps.cacheEnabled ?? true}
            domStorageEnabled={webViewProps.domStorageEnabled ?? true}
            androidLayerType={webViewProps.androidLayerType ?? 'none'}
            cacheMode={webViewProps.cacheMode ?? 'LOAD_DEFAULT'}
            {...webViewProps}
            opaque={webViewProps.opaque ?? true}
            backgroundColor={webViewProps.backgroundColor ?? '#000000'}
            injectedJavaScriptBeforeContentLoaded={finalInjectedJS}
            onMessage={handleMessage}
            androidHardwareAccelerationDisabled={false}
            // Voice chat in multiplayer games: a game may ask for the microphone. iOS asks the player
            // ("Allow this game to use your microphone?"); Android uses the app's RECORD_AUDIO grant.
            mediaCapturePermissionGrantType="prompt"
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            allowsAirPlayForMediaPlayback={false}
            allowsPictureInPictureMediaPlayback={false}
            mediaTypesRequiringUserActionForPlayback={[]}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bounces={false}
            scrollEnabled={false}
            overScrollMode="never"
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            style={[styles.webview, style]}
          />
        </View>
      )}
      <BuyItemSheet request={buyReq} sideways={rotate} onDone={(ok) => { buyReq?.done(ok, ok ? undefined : 'CANCELLED'); setBuyReq(null); }} />
    </View>
  );
});

const RNWebView = WebView as any;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(Platform.OS === 'android' ? { overflow: 'hidden' } : {}),
  },
  fill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
