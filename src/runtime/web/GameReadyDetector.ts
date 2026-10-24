/**
 * GameReadyDetector — Intelligent game readiness detector script.
 * 
 * Injected into game WebViews to monitor when games finish bootstrapping
 * their render loops and draw actual frames to canvas, eliminating the black
 * screen gap between raw HTML load and first frame presentation.
 */

export const GAME_READY_DETECTOR_SCRIPT = `
(function() {
  if (window._gtGameReadyActive) return;
  window._gtGameReadyActive = true;

  var gameReady = false;
  var rafCount = 0;
  var notifyAttempts = 0;

  function notifyReady() {
    if (gameReady) return;
    notifyAttempts++;
    try {
      if (typeof window.ReactNativeWebView !== 'undefined' && typeof window.ReactNativeWebView.postMessage === 'function') {
        gameReady = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'GAMETOK_GAME_READY' }));
      } else if (window.parent && window.parent !== window) {
        gameReady = true;
        window.parent.postMessage({ type: 'GAMETOK_GAME_READY' }, '*');
      } else {
        if (notifyAttempts < 30) {
          setTimeout(notifyReady, 150);
        } else {
          gameReady = true;
        }
      }
    } catch (e) {
      if (notifyAttempts < 30) {
        setTimeout(notifyReady, 150);
      } else {
        gameReady = true;
      }
    }
  }

  // 1. Explicit message from game engine or template
  window.addEventListener('message', function(ev) {
    try {
      var data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
      if (data && (data.type === 'GAMETOK_GAME_READY' || data.type === 'GAME_READY')) {
        notifyReady();
      }
    } catch(e) {}
  }, { passive: true });

  // 2. Track requestAnimationFrame — once game loop renders frames, canvas is active
  var origRAF = window.requestAnimationFrame;
  if (typeof origRAF === 'function') {
    window.requestAnimationFrame = function(cb) {
      rafCount++;
      if (rafCount >= 6 && !gameReady) {
        notifyReady();
      }
      return origRAF.call(window, cb);
    };
  }

  // 3. Monitor canvas initialization
  function checkCanvas() {
    if (gameReady) return;
    var canvases = document.querySelectorAll('canvas');
    for (var i = 0; i < canvases.length; i++) {
      var c = canvases[i];
      if (c.width > 20 && c.height > 20) {
        setTimeout(function() {
          if (!gameReady) notifyReady();
        }, 500);
        return;
      }
    }
  }

  // 4. Hook WebGL / 2D context creation
  try {
    var origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function() {
      setTimeout(function() {
        if (!gameReady) notifyReady();
      }, 700);
      return origGetContext.apply(this, arguments);
    };
  } catch(e) {}

  var interval = setInterval(function() {
    if (gameReady) {
      clearInterval(interval);
      return;
    }
    checkCanvas();
  }, 200);

  // 5. Safety fallback: maximum 4 seconds
  setTimeout(function() {
    if (!gameReady) notifyReady();
    clearInterval(interval);
  }, 4000);
})();
true;
`;
