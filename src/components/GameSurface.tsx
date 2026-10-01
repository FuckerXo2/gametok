// GameSurface — the one place a game is sized and rotated for playback.
//
// Landscape games are played by rotating the WebView's CONTENT 90 degrees inside a portrait box.
// The device stays portrait-locked; the player turns the phone. The game is laid out at the
// transposed size from its very first layout, so it boots straight into a landscape viewport with
// no resize, no orientationchange, and no flash of portrait — game code needs no orientation
// awareness of its own.
//
// On iOS, native `transform: [{ rotate: '90deg' }]` on a WKWebView triggers CoreAnimation to
// treat the remote layer as a 1x rasterized texture, resulting in severe bilinear blur (the "fog").
// By rotating the page content inside WebKit via CSS on iOS, the WKWebView remains completely
// unrotated at 0deg in UIKit, rendering at full native 3x Retina resolution with zero blur.
// On Android, Chromium hardware layers do not suffer from this bug, so native rotation is used.

import React, { forwardRef, useState } from 'react';
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';
import { isLandscape, DEFAULT_ORIENTATION, type Orientation } from '../constants/orientation';
import { GameTokEngineView, isNativeEngineLinked } from '../../modules/gametok-engine';

export const GAMES_HOST = 'https://games.gametok.co';

/** Build the play URL for a game. Shared so every surface points at the same place. */
export const buildGameUrl = (
  game: { id: string; embedUrl?: string | null },
  apiOrigin: string,
): string => {
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
};

// WebGL distance fog patch to prevent horizon washout in 3D games
const FOG_SHADER_PATCH = `
    function patchShader(src) {
      if (typeof src !== 'string') return src;
      if (src.indexOf('depth-120.0') !== -1 || src.indexOf('vDepth-120.0') !== -1 || src.indexOf('depth-1200.0') !== -1 || src.indexOf('vDepth-1200.0') !== -1) {
        src = src
          .split('depth-120.0').join('depth-5000.0')
          .split('vDepth-120.0').join('vDepth-5000.0')
          .split('depth-1200.0').join('depth-5000.0')
          .split('vDepth-1200.0').join('vDepth-5000.0')
          .split('/2350.0,0.0,0.88').join('/8000.0,0.0,0.05')
          .split('/4000.0,0.0,0.25').join('/8000.0,0.0,0.05')
          .split('/4000.0,0.0,0.15').join('/8000.0,0.0,0.05');
      }
      if (src.indexOf('fogFactor') !== -1 && src.indexOf('mix(') !== -1) {
        src = src.replace(
          /([a-zA-Z0-9_]+\\.rgb\\s*=\\s*mix\\(\\s*[a-zA-Z0-9_]+\\.rgb\\s*,\\s*fogColor\\s*,\\s*)fogFactor(\\s*\\);)/g,
          '$1min(fogFactor * 0.1, 0.15)$2'
        );
      }
      return src;
    }

    if (window.WebGLRenderingContext && WebGLRenderingContext.prototype) {
      var orig1 = WebGLRenderingContext.prototype.shaderSource;
      WebGLRenderingContext.prototype.shaderSource = function(shader, src) {
        return orig1.call(this, shader, patchShader(src));
      };
    }
    if (window.WebGL2RenderingContext && WebGL2RenderingContext.prototype) {
      var orig2 = WebGL2RenderingContext.prototype.shaderSource;
      WebGL2RenderingContext.prototype.shaderSource = function(shader, src) {
        return orig2.call(this, shader, patchShader(src));
      };
    }
`;

function buildLandscapeCSS(lw: number, lh: number): string {
  return [
    ':root { color-scheme: dark !important; background: #000000 !important; }',
    '* { -webkit-font-smoothing: antialiased !important; }',
    'html {',
    '  width: ' + lw + 'px !important;',
    '  height: ' + lh + 'px !important;',
    '  margin: 0 !important;',
    '  padding: 0 !important;',
    '  overflow: hidden !important;',
    '  background: #000000 !important;',
    '  transform-origin: top left !important;',
    '  transform: rotate(90deg) translateY(-' + lh + 'px) !important;',
    '}',
    'body {',
    '  width: ' + lw + 'px !important;',
    '  height: ' + lh + 'px !important;',
    '  margin: 0 !important;',
    '  padding: 0 !important;',
    '  overflow: hidden !important;',
    '  background: #000000 !important;',
    '}',
    'canvas { background-color: transparent !important; }',
    '.controls-legend, #title-rotate, .rotate-device, .phone-spin, [data-orientation-warning] { display: none !important; }',
    '.touch-controls { display: flex !important; }',
    '#hud .frame-top { top: 12px !important; }',

    // Turbo Kart Rush layout rules:
    // In CSS rotation, WebKit evaluates vw against portrait width (393px) and vh against portrait height (852px).
    // These rules give the character selection grid the authentic wide layout (~66% of widescreen width)
    // with 48px left padding so it is completely clear of the Dynamic Island.
    '.panel-chars { --col: min(66%, 980px) !important; align-items: flex-start !important; }',
    '.panel-chars .select-header, .panel-chars .card-grid, .panel-chars .select-footer { width: min(66%, 980px) !important; margin: 0 !important; }',
    '.panel-select { padding: 10px 16px 8px max(48px, env(safe-area-inset-left)) !important; gap: 8px !important; justify-content: space-between !important; }',
    '.char-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 8px !important; }',
    '.card { padding: 10px 10px 8px !important; }',
    '.card-tag { display: none !important; }',
    '.char-swatch { height: 56px !important; }',
    '.track-art { height: 64px !important; }',
    '.stats { gap: 3px !important; }',
    '.stat-bar { height: 4px !important; }',
    '.select-header .panel-title { font-size: 30px !important; }',
    '.select-footer { padding: 8px 16px !important; }',
    '.difficulty-blurb { display: none !important; }',

    // Sunbreak responsive rules
    '#title-panel.title-panel {',
    '  left: 5% !important;',
    '  top: 14% !important;',
    '  width: 310px !important;',
    '  max-width: 90vw !important;',
    '}',
    '#title-panel .eyebrow { font-size: 8px !important; }',
    '#title-panel h1 { font-size: 44px !important; letter-spacing: -3px !important; line-height: 0.85 !important; margin: 6px 0 8px !important; }',
    '#title-panel h1 em { letter-spacing: -3px !important; }',
    '#title-panel>p { font-size: 10px !important; margin: 6px 0 10px !important; }',
    '#title-panel .course-card { width: 275px !important; padding-top: 6px !important; gap: 8px !important; }',
    '#title-panel .course-number { font-size: 20px !important; }',
    '#title-panel .course-card b { font-size: 8px !important; }',
    '#title-panel .course-card span:not(.course-arrow) { font-size: 6px !important; margin-top: 2px !important; }',
    '#title-panel .course-arrow { width: 18px !important; height: 18px !important; flex-basis: 18px !important; }',
    '#title-panel .course-stats { margin: 8px 0 10px !important; gap: 16px !important; }',
    '#title-panel .course-stats b { font-size: 15px !important; }',
    '#title-panel .course-stats span { font-size: 6px !important; margin-top: 2px !important; }',
    '#title-panel .ride-btn {',
    '  width: 275px !important;',
    '  height: 44px !important;',
    '  padding: 0 16px !important;',
    '  font-size: 13px !important;',
    '  display: flex !important;',
    '  visibility: visible !important;',
    '  opacity: 1 !important;',
    '}',
    '#title-panel .ride-btn>small { font-size: 7px !important; }',
    '#title-panel .ride-arrow { width: 18px !important; height: 18px !important; flex-basis: 18px !important; }',
    '#title-panel .title-hint { display: none !important; }',
    '.title-bottom { bottom: 8px !important; }',
  ].join('\n');
}

export const GameSurface = forwardRef<WebView, Props>(function GameSurface(
  { orientation = DEFAULT_ORIENTATION, containerStyle, box: boxProp = null, style, runtime = 'web', gameScript, showControls, controlsConfig, ...webViewProps },
  ref,
) {
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const box = boxProp || measured;
  const wantsLandscape = isLandscape(orientation);

  // Only rotate when the box is actually portrait. On a tablet already held in landscape the box
  // is the right shape, and rotating would turn the game back into a portrait letterbox.
  const rotate = wantsLandscape && !!box && box.height >= box.width;

  const evenW = box ? Math.round(box.width / 2) * 2 : 0;
  const evenH = box ? Math.round(box.height / 2) * 2 : 0;

  // On iOS, keep the WKWebView unrotated in UIKit (flex: 1) and rotate via CSS inside WebKit.
  // This avoids Apple CoreAnimation downsampling the transformed CALayer to 1x raster (eliminating the "fog").
  // On Android, use native transform rotation.
  const useNativeRotation = rotate && Platform.OS === 'android';
  const useCSSRotation = rotate && Platform.OS === 'ios';

  const rotatedStyle = useNativeRotation
    ? {
        position: 'absolute' as const,
        flex: 0,
        width: evenH,
        height: evenW,
        left: (evenW - evenH) / 2,
        top: (evenH - evenW) / 2,
        transform: [{ rotate: '90deg' }],
      }
    : null;

  // A landscape game must not paint before it has been measured, or it flashes portrait first.
  const waitingForMeasure = wantsLandscape && !box;

  const landscapeCSS = buildLandscapeCSS(evenH, evenW);

  const landscapeFixScript = useCSSRotation
    ? `
(function() {
  try {
    var LW = ${evenH};
    var LH = ${evenW};

    // 1. Override window/screen dimensions so game JS sees landscape
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
      }
      if (document.documentElement) {
        Object.defineProperty(document.documentElement, 'clientWidth',  { get: function() { return LW; }, configurable: true });
        Object.defineProperty(document.documentElement, 'clientHeight', { get: function() { return LH; }, configurable: true });
      }
    } catch(e) {}

    // 2. Report landscape screen orientation
    try {
      Object.defineProperty(screen, 'orientation', {
        get: function() {
          return {
            type: 'landscape-primary',
            angle: 90,
            addEventListener: function() {},
            removeEventListener: function() {},
            dispatchEvent: function() { return false; }
          };
        },
        configurable: true
      });
    } catch(e) {}

    // 3. Spoof window.matchMedia for orientation and viewport queries
    try {
      var origMatchMedia = window.matchMedia;
      window.matchMedia = function(query) {
        var q = String(query).toLowerCase();
        var matches = false;

        if (q.indexOf('orientation: landscape') !== -1 || q.indexOf('orientation:landscape') !== -1) {
          matches = true;
        } else if (q.indexOf('orientation: portrait') !== -1 || q.indexOf('orientation:portrait') !== -1) {
          matches = false;
        } else if (q.indexOf('pointer: coarse') !== -1 || q.indexOf('pointer:coarse') !== -1) {
          matches = true;
        } else if (q.indexOf('pointer: fine') !== -1 || q.indexOf('pointer:fine') !== -1) {
          matches = false;
        } else if (q.indexOf('hover: hover') !== -1 || q.indexOf('hover:hover') !== -1) {
          matches = false;
        } else if (q.indexOf('hover: none') !== -1 || q.indexOf('hover:none') !== -1) {
          matches = true;
        } else if (q.indexOf('max-height') !== -1) {
          var m = q.match(/max-height\\s*:\\s*([0-9]+)px/);
          matches = m ? LH <= Number(m[1]) : true;
        } else if (q.indexOf('min-height') !== -1) {
          var m = q.match(/min-height\\s*:\\s*([0-9]+)px/);
          matches = m ? LH >= Number(m[1]) : false;
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

    // 4. Viewport meta locking
    function setViewportMeta() {
      try {
        var meta = document.querySelector('meta[name="viewport"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = 'viewport';
          (document.head || document.documentElement).appendChild(meta);
        }
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      } catch(e) {}
    }

    // 5. Patch existing and newly added <style> sheets so CSS media queries adapt
    function patchCSS(txt) {
      if (!txt || typeof txt !== 'string') return txt;
      return txt
        .replace(/\\(orientation\\s*:\\s*portrait\\)/gi, '(max-width: 0px)')
        .replace(/\\(orientation\\s*:\\s*landscape\\)/gi, '(min-width: 0px)')
        .replace(/\\(pointer\\s*:\\s*fine\\)/gi, '(max-width: 0px)')
        .replace(/\\(hover\\s*:\\s*hover\\)/gi, '(max-width: 0px)')
        .replace(/\\(pointer\\s*:\\s*coarse\\)/gi, '(min-width: 0px)')
        .replace(/\\(max-height\\s*:\\s*([0-9]+)px\\)/gi, function(match, val) {
          return Number(val) >= LH ? '(min-width: 0px)' : match;
        });
    }

    function patchAllStyles() {
      try {
        var styles = document.querySelectorAll('style');
        for (var i = 0; i < styles.length; i++) {
          var s = styles[i];
          if (s.id === 'gametok-ios-landscape-fix') continue;
          var original = s.textContent;
          if (original && (original.indexOf('orientation') !== -1 || original.indexOf('max-height') !== -1 || original.indexOf('pointer') !== -1)) {
            var patched = patchCSS(original);
            if (patched !== original) {
              s.textContent = patched;
            }
          }
        }
      } catch(e) {}
    }

    // 6. Inject CSS rotation and mobile landscape compatibility rules
    function injectLandscapeCSS() {
      try {
        setViewportMeta();
        patchAllStyles();

        var s = document.getElementById('gametok-ios-landscape-fix');
        if (!s) {
          s = document.createElement('style');
          s.id = 'gametok-ios-landscape-fix';
          s.textContent = ${JSON.stringify(landscapeCSS)};
          (document.head || document.documentElement).appendChild(s);
        }
      } catch(e) {}
    }

    injectLandscapeCSS();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectLandscapeCSS, { once: true });
    }
    window.addEventListener('load', function() {
      injectLandscapeCSS();
      try { window.dispatchEvent(new Event('resize')); } catch(e) {}
    }, { once: true });

    try {
      var observer = new MutationObserver(function() {
        patchAllStyles();
      });
      observer.observe(document.documentElement || document, { childList: true, subtree: true });
    } catch(e) {}

    ${FOG_SHADER_PATCH}
  } catch(e) {}
})();
true;
`
    : `
(function() {
  try {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      (document.head || document.documentElement).appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

    var s = document.createElement('style');
    s.id = 'gametok-surface-crisp';
    s.textContent = '* { -webkit-font-smoothing: antialiased !important; }';
    (document.head || document.documentElement).appendChild(s);

    ${FOG_SHADER_PATCH}
  } catch(e) {}
})();
true;
`;

  const finalInjectedJS = landscapeFixScript + '\n' + (webViewProps.injectedJavaScriptBeforeContentLoaded || '');

  if (runtime === 'native') {
    return (
      <View style={[styles.container, containerStyle]}>
        <GameTokEngineView
          style={[styles.webview, style]}
          gameScript={gameScript}
          cameraMode={isLandscape(orientation) ? '3D' : '2D'}
          showControls={showControls ?? true}
          controlsConfig={controlsConfig}
        />
      </View>
    );
  }

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
        <RNWebView
          scalesPageToFit={false}
          contentMode="mobile"
          ref={ref}
          onContentProcessDidTerminate={(e: any) => {
            console.warn('[GameSurface] WebContent process terminated, reloading...');
            if (webViewProps.onContentProcessDidTerminate) {
              webViewProps.onContentProcessDidTerminate(e);
            } else if (ref && typeof ref !== 'function' && ref.current?.reload) {
              ref.current.reload();
            }
          }}
          {...webViewProps}
          opaque={webViewProps.opaque ?? false}
          backgroundColor={webViewProps.backgroundColor ?? 'transparent'}
          injectedJavaScriptBeforeContentLoaded={finalInjectedJS}
          style={[rotatedStyle ?? styles.webview, style]}
        />
      )}
    </View>
  );
});

const RNWebView = WebView as any;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(Platform.OS === 'android' ? { overflow: 'hidden' } : {}),
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
