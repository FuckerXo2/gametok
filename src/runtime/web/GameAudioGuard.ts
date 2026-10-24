/**
 * GameAudioGuard — Comprehensive Web Audio API & HTML5 Audio lifecycle manager.
 * 
 * Prevents the audio buffer buzzing / stuttering / leaking bug in mobile WebViews.
 * 
 * WHY BUZZING HAPPENED:
 * 1. Games use Web Audio API oscillators, sound synths, or buffer loops.
 * 2. When leaving a game or pausing, ctx.suspend() was called while audio nodes were rendering.
 * 3. In WebKit/Chromium, suspending an AudioContext halts currentTime, which freezes active oscillators
 *    mid-waveform and prevents scheduled stop() or gain ramps from executing.
 * 4. The underlying OS audio hardware buffer gets starved of frames and loops the last circular DMA
 *    buffer slice, creating a continuous ~100-350Hz BUZZING sound.
 * 5. Standalone new Audio() instances (not appended to document.body) were not tracked or paused.
 * 6. Modal game players (GamePlayerModal) never injected the audio guard and unmounted without silencing.
 * 
 * THE FIX:
 * 1. Dedicated Master Gain Node on every AudioContext:
 *    Every connection to ctx.destination is intercepted and routed through ctx._gametokMasterGain.
 *    On pause/suspend/leave, _gametokMasterGain.gain.setValueAtTime(0, ctx.currentTime) is set FIRST.
 *    Setting gain to 0 guarantees the signal sent to the hardware is pure silence (zero output).
 * 2. Standalone new Audio() tracking:
 *    win.Audio is wrapped so every instance created is stored in win._allAudioInstances and paused/muted.
 * 3. Engine-specific zeroing:
 *    Howler, Phaser (including masterVolumeNode and masterMuteNode), and CreateJS are muted and zeroed.
 * 4. HARD_MUTE_CLEANUP_SCRIPT:
 *    Injected immediately when exiting a game or closing the player modal.
 */

export function buildGameAudioGuardScript(startActive: boolean = false): string {
  return `
(function() {
  if (window.__gametokAudioGuardInstalled) return true;
  window.__gametokAudioGuardInstalled = true;
  window._gametokActive = ${startActive ? 'true' : 'false'};
  window._gametokMuted = ${startActive ? 'false' : 'true'};
  window._audioContexts = window._audioContexts || [];
  window._allAudioInstances = window._allAudioInstances || [];

  var forEachFrame = function(win, cb) {
    try { cb(win); } catch (e) {}
    var frames;
    try { frames = win.frames; } catch (e) { return; }
    if (!frames) return;
    for (var i = 0; i < frames.length; i++) {
      var child;
      try {
        child = frames[i];
        void child.document;
      } catch (e) { continue; }
      if (child && child !== win) forEachFrame(child, cb);
    }
  };
  window.__gametokForEachFrame = function(cb) { forEachFrame(window, cb); };

  var muteWindow = function(win) {
    try { win._gametokActive = false; win._gametokMuted = true; } catch (e) {}

    // 1. Instantly zero master gain on all Web Audio contexts and physically disconnect them.
    // Physically disconnecting _gametokMasterGain cuts off the OS CoreAudio hardware circular buffer completely (prevents buzzing).
    try {
      (win._audioContexts || []).forEach(function(ctx) {
        try {
          if (ctx._gametokMasterGain) {
            if (ctx._gametokMasterGain.gain) {
              try {
                ctx._gametokMasterGain.gain.setValueAtTime(0, ctx.currentTime || 0);
              } catch (e) {}
              ctx._gametokMasterGain.gain.value = 0;
            }
            if (ctx._gametokMasterGainConnected) {
              try { ctx._gametokMasterGain.disconnect(); } catch (e) {}
              ctx._gametokMasterGainConnected = false;
            }
          }
        } catch (e) {}
        try { ctx.suspend(); } catch (e) {}
      });
    } catch (e) {}

    // 2. Pause and mute ALL HTML5 audio/video (both in DOM and standalone Audio instances)
    try {
      var allMedia = [];
      if (win.document) {
        allMedia.push.apply(allMedia, win.document.querySelectorAll('audio, video'));
      }
      if (win._allAudioInstances) {
        allMedia.push.apply(allMedia, win._allAudioInstances);
      }
      allMedia.forEach(function(el) {
        try {
          el.pause();
          el.muted = true;
          el.volume = 0;
        } catch (e) {}
      });
    } catch (e) {}

    // 3. Silence Howler.js
    try {
      if (win.Howler) {
        win.Howler.mute(true);
        if (typeof win.Howler.volume === 'function') win.Howler.volume(0);
      }
    } catch (e) {}

    // 4. Silence Phaser sound managers
    try {
      if (win.Phaser && win.Phaser.GAMES) {
        win.Phaser.GAMES.forEach(function(g) {
          try {
            if (g && g.sound) {
              g.sound.mute = true;
              g.sound.pauseAll && g.sound.pauseAll();
              if (g.sound.masterMuteNode && g.sound.masterMuteNode.gain) {
                g.sound.masterMuteNode.gain.setValueAtTime(0, 0);
                g.sound.masterMuteNode.gain.value = 0;
              }
              if (g.sound.masterVolumeNode && g.sound.masterVolumeNode.gain) {
                g.sound.masterVolumeNode.gain.setValueAtTime(0, 0);
                g.sound.masterVolumeNode.gain.value = 0;
              }
            }
          } catch (e) {}
        });
      }
    } catch (e) {}

    // 5. Silence CreateJS
    try {
      if (win.createjs && win.createjs.Sound) {
        win.createjs.Sound.muted = true;
        win.createjs.Sound.stop && win.createjs.Sound.stop();
      }
    } catch (e) {}
  };

  var unmuteWindow = function(win) {
    try { win._gametokActive = true; win._gametokMuted = false; } catch (e) {}

    // 1. Resume Web Audio contexts and restore master gain
    try {
      (win._audioContexts || []).forEach(function(ctx) {
        try {
          if (ctx._gametokMasterGain) {
            var nativeConnect = win.AudioNode ? win.AudioNode.prototype.connect : null;
            if (!ctx._gametokMasterGainConnected && nativeConnect) {
              try {
                nativeConnect.call(ctx._gametokMasterGain, ctx.destination);
                ctx._gametokMasterGainConnected = true;
              } catch (e) {}
            }
            ctx.resume().then(function() {
              if (win._gametokActive && !win._gametokMuted && ctx._gametokMasterGain && ctx._gametokMasterGain.gain) {
                ctx._gametokMasterGain.gain.setValueAtTime(1, ctx.currentTime);
                ctx._gametokMasterGain.gain.value = 1;
              }
            });
            if (ctx._gametokMasterGain.gain) {
              ctx._gametokMasterGain.gain.setValueAtTime(1, ctx.currentTime);
              ctx._gametokMasterGain.gain.value = 1;
            }
          } else {
            try { ctx.resume(); } catch (e) {}
          }
        } catch (e) {}
      });
    } catch (e) {}

    // 2. Unmute media elements
    try {
      var allMedia = [];
      if (win.document) {
        allMedia.push.apply(allMedia, win.document.querySelectorAll('audio, video'));
      }
      if (win._allAudioInstances) {
        allMedia.push.apply(allMedia, win._allAudioInstances);
      }
      allMedia.forEach(function(el) {
        try {
          el.muted = false;
          el.volume = 1;
        } catch (e) {}
      });
    } catch (e) {}

    try {
      if (win.Howler) {
        win.Howler.mute(false);
        if (typeof win.Howler.volume === 'function') win.Howler.volume(1);
      }
    } catch (e) {}

    try {
      if (win.Phaser && win.Phaser.GAMES) {
        win.Phaser.GAMES.forEach(function(g) {
          try {
            if (g && g.sound) {
              g.sound.mute = false;
              if (g.sound.masterMuteNode && g.sound.masterMuteNode.gain) {
                g.sound.masterMuteNode.gain.setValueAtTime(1, 0);
                g.sound.masterMuteNode.gain.value = 1;
              }
              if (g.sound.masterVolumeNode && g.sound.masterVolumeNode.gain) {
                g.sound.masterVolumeNode.gain.setValueAtTime(1, 0);
                g.sound.masterVolumeNode.gain.value = 1;
              }
            }
          } catch (e) {}
        });
      }
    } catch (e) {}

    try {
      if (win.createjs && win.createjs.Sound) {
        win.createjs.Sound.muted = false;
      }
    } catch (e) {}
  };

  var pauseStartTime = 0;
  var totalPausedDuration = 0;
  var isRenderActive = ${startActive ? 'true' : 'false'};
  var bootGraceFrames = ${startActive ? 0 : 30};

  var getHighResTime = function() {
    return (window.performance && window.performance.now) ? window.performance.now() : Date.now();
  };

  var setRenderActiveInWindow = function(win, active) {
    try {
      win._gametokRenderActive = !!active;
      if (win.__gametokLocalSetRenderActive) {
        win.__gametokLocalSetRenderActive(active);
      }
    } catch(e) {}
  };

  window.__gametokSetRenderActive = function(active) {
    var nextActive = !!active;
    if (isRenderActive === nextActive) return;
    isRenderActive = nextActive;
    window._gametokRenderActive = nextActive;

    var realNow = getHighResTime();
    if (isRenderActive) {
      if (pauseStartTime > 0) {
        totalPausedDuration += (realNow - pauseStartTime);
        pauseStartTime = 0;
      }
    } else {
      pauseStartTime = realNow;
    }

    forEachFrame(window, function(win) {
      setRenderActiveInWindow(win, nextActive);
    });
  };

  window.__gametokSetMediaActive = function(active) {
    window._gametokActive = !!active;
    window._gametokMuted = !active;
    forEachFrame(window, active ? unmuteWindow : muteWindow);
    try {
      if (navigator.mediaSession) {
        if (!active) navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = active ? 'playing' : 'paused';
      }
    } catch (e) {}
  };
  window.__gametokMuteAll = function() {
    window.__gametokSetMediaActive(false);
  };
  window.__gametokUnmuteAll = function() {
    window.__gametokSetMediaActive(true);
  };

  var installInWindow = function(win) {
    try {
      if (win.__gametokRealmGuarded) return;
      win.__gametokRealmGuarded = true;
      win._audioContexts = win._audioContexts || [];
      win._allAudioInstances = win._allAudioInstances || [];

      // Intercept requestAnimationFrame, cancelAnimationFrame, and performance.now
      if (!win.__gametokRafGuarded) {
        win.__gametokRafGuarded = true;
        var nativeRaf = (win.requestAnimationFrame || win.webkitRequestAnimationFrame || win.mozRequestAnimationFrame || win.msRequestAnimationFrame);
        if (nativeRaf) nativeRaf = nativeRaf.bind(win);
        var nativeCancelRaf = (win.cancelAnimationFrame || win.webkitCancelAnimationFrame || win.mozCancelAnimationFrame || win.msCancelAnimationFrame);
        if (nativeCancelRaf) nativeCancelRaf = nativeCancelRaf.bind(win);

        var heldRafCallbacks = {};
        var nextRafId = 1;

        var flushHeldCallbacks = function() {
          if (!nativeRaf) return;
          var keys = Object.keys(heldRafCallbacks);
          if (keys.length === 0) return;
          var callbacks = [];
          for (var i = 0; i < keys.length; i++) {
            var cb = heldRafCallbacks[keys[i]];
            if (cb) callbacks.push(cb);
          }
          heldRafCallbacks = {};
          nativeRaf(function(now) {
            var adjNow = now - totalPausedDuration;
            for (var j = 0; j < callbacks.length; j++) {
              try { callbacks[j](adjNow); } catch(e) {}
            }
          });
        };

        win.__gametokLocalSetRenderActive = function(active) {
          if (active) {
            flushHeldCallbacks();
          }
        };

        if (nativeRaf) {
          win.requestAnimationFrame = function(cb) {
            if (isRenderActive) {
              return nativeRaf(function(now) {
                var adjNow = now - totalPausedDuration;
                try { cb(adjNow); } catch(e) {}
              });
            }

            // Offscreen initial boot grace: let the game draw its initial ~30 frames to the canvas
            if (bootGraceFrames > 0) {
              bootGraceFrames--;
              return nativeRaf(function(now) {
                var adjNow = now - totalPausedDuration;
                try { cb(adjNow); } catch(e) {}
              });
            }

            // Idle sleep: hold callback without executing or dispatching GPU draw calls
            var id = nextRafId++;
            heldRafCallbacks[id] = cb;
            return id;
          };

          if (nativeCancelRaf) {
            win.cancelAnimationFrame = function(id) {
              if (heldRafCallbacks[id]) {
                delete heldRafCallbacks[id];
                return;
              }
              return nativeCancelRaf(id);
            };
          }
        }

        // Smooth performance.now time compensation so delta-time never spikes after unpausing
        var nativePerf = win.performance;
        if (nativePerf && nativePerf.now && !nativePerf.__gametokNowWrapped) {
          var nativePerfNow = nativePerf.now.bind(nativePerf);
          nativePerf.now = function() {
            var real = nativePerfNow();
            var extra = (pauseStartTime > 0) ? (real - pauseStartTime) : 0;
            return Math.max(0, real - totalPausedDuration - extra);
          };
          nativePerf.__gametokNowWrapped = true;
        }
      }

      // Track and wrap standalone new Audio() calls
      var NativeAudio = win.Audio;
      if (NativeAudio && !NativeAudio.__gametokWrapped) {
        var WrappedAudio = function(src) {
          var audio = new NativeAudio(src);
          try { win._allAudioInstances.push(audio); } catch (e) {}
          if (!window._gametokActive || window._gametokMuted) {
            try { audio.muted = true; audio.volume = 0; } catch (e) {}
          }
          var nativePlay = audio.play ? audio.play.bind(audio) : null;
          if (nativePlay) {
            audio.play = function() {
              if (!window._gametokActive || window._gametokMuted) {
                try { audio.muted = true; audio.volume = 0; audio.pause(); } catch (e) {}
                return Promise.resolve();
              }
              return nativePlay();
            };
          }
          return audio;
        };
        WrappedAudio.prototype = NativeAudio.prototype;
        WrappedAudio.__gametokWrapped = true;
        win.Audio = WrappedAudio;
      }

      // Wrap AudioContext & webkitAudioContext with Master Gain interception
      var NativeAudioContext = win.AudioContext || win.webkitAudioContext;
      if (NativeAudioContext && !NativeAudioContext.__gametokWrapped) {
        var nativeConnect = win.AudioNode ? win.AudioNode.prototype.connect : null;

        var WrappedAudioContext = function() {
          var ctx = new NativeAudioContext();
          try { win._audioContexts.push(ctx); } catch (e) {}

          var masterGain = null;
          try {
            masterGain = ctx.createGain();
            var initialMuted = (!window._gametokActive || window._gametokMuted);
            masterGain.gain.setValueAtTime(initialMuted ? 0 : 1, 0);
            masterGain.gain.value = initialMuted ? 0 : 1;
            if (nativeConnect && !initialMuted) {
              nativeConnect.call(masterGain, ctx.destination);
              ctx._gametokMasterGainConnected = true;
            } else {
              ctx._gametokMasterGainConnected = false;
            }
            ctx._gametokMasterGain = masterGain;
          } catch (e) {}

          try {
            var nativeResume = ctx.resume && ctx.resume.bind(ctx);
            if (nativeResume) {
              ctx.resume = function() {
                if (!window._gametokActive || window._gametokMuted) {
                  return Promise.resolve();
                }
                return nativeResume();
              };
            }
          } catch (e) {}

          if (!window._gametokActive || window._gametokMuted) {
            try { ctx.suspend(); } catch (e) {}
          }
          return ctx;
        };

        WrappedAudioContext.prototype = NativeAudioContext.prototype;
        WrappedAudioContext.__gametokWrapped = true;
        win.AudioContext = WrappedAudioContext;
        win.webkitAudioContext = WrappedAudioContext;

        // Route any connection to ctx.destination through ctx._gametokMasterGain
        if (nativeConnect && win.AudioNode && win.AudioNode.prototype && !win.AudioNode.prototype.__gametokWrapped) {
          win.AudioNode.prototype.connect = function(destination) {
            try {
              if (this.context && this.context._gametokMasterGain && destination === this.context.destination) {
                return nativeConnect.call(this, this.context._gametokMasterGain);
              }
            } catch (e) {}
            return nativeConnect.apply(this, arguments);
          };
          win.AudioNode.prototype.__gametokWrapped = true;
        }
      }

      // Wrap HTMLMediaElement.prototype.play
      if (win.HTMLMediaElement && win.HTMLMediaElement.prototype && !win.HTMLMediaElement.prototype.__gametokPlayWrapped) {
        var nativeMediaPlay = win.HTMLMediaElement.prototype.play;
        win.HTMLMediaElement.prototype.play = function() {
          if (!window._gametokActive || window._gametokMuted) {
            try { this.muted = true; this.volume = 0; this.pause(); } catch (e) {}
            return Promise.resolve();
          }
          return nativeMediaPlay.apply(this, arguments);
        };
        win.HTMLMediaElement.prototype.__gametokPlayWrapped = true;
      }
    } catch (e) {}
  };

  try {
    if (navigator.mediaSession) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  } catch (e) {}

  installInWindow(window);

  var sweepFrames = function() {
    forEachFrame(window, function(win) {
      installInWindow(win);
      if (!window._gametokActive || window._gametokMuted) muteWindow(win);
    });
  };

  var installObserver = function() {
    if (!window._gametokActive || window._gametokMuted) window.__gametokMuteAll();
    sweepFrames();
    if (!window._gametokMediaObserver && document.body) {
      window._gametokMediaObserver = new MutationObserver(function() {
        if (!window._gametokActive || window._gametokMuted) {
          window.__gametokMuteAll();
          sweepFrames();
        }
      });
      window._gametokMediaObserver.observe(document.body, { childList: true, subtree: true });
    }
    if (!window._gametokFrameSweep) {
      window._gametokFrameSweep = setInterval(sweepFrames, 500);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installObserver, { once: true });
  } else {
    installObserver();
  }

  var handleHostMessage = function(event) {
    try {
      var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (!data || !data.type) return;
      if (data.type === 'GAMETOK_AUDIO_MUTE') window.__gametokSetMediaActive(false);
      if (data.type === 'GAMETOK_AUDIO_UNMUTE') window.__gametokSetMediaActive(true);
      if (data.type === 'GAMETOK_RENDER_PAUSE') window.__gametokSetRenderActive(false);
      if (data.type === 'GAMETOK_RENDER_RESUME') window.__gametokSetRenderActive(true);
      if (data.type === 'GAMETOK_PRELOAD') {
        window.__gametokSetMediaActive(false);
        window.__gametokSetRenderActive(false);
      }
      if (data.type === 'GAMETOK_PAUSE') {
        window.__gametokSetMediaActive(false);
        window.__gametokSetRenderActive(false);
      }
      if (data.type === 'GAMETOK_RESUME' || data.type === 'GAMETOK_ACTIVATE') {
        window.__gametokSetMediaActive(true);
        window.__gametokSetRenderActive(true);
      }
    } catch (e) {}
  };
  window.addEventListener('message', handleHostMessage);
  document.addEventListener('message', handleHostMessage);
})();
true;
`;
}

export const GAME_AUDIO_GUARD_SCRIPT = buildGameAudioGuardScript(false);
export const GAME_AUDIO_GUARD_SCRIPT_ACTIVE = buildGameAudioGuardScript(true);

export const COOPERATIVE_PAUSE_SCRIPT = `
(function() {
  try { if (window.__gametokSetMediaActive) window.__gametokSetMediaActive(false); } catch (e) {}
  try { if (window.__gametokMuteAll) window.__gametokMuteAll(); } catch (e) {}
  try { if (window.__gametokSetRenderActive) window.__gametokSetRenderActive(false); } catch (e) {}
  true;
})();
`;

export const COOPERATIVE_RESUME_SCRIPT = `
(function() {
  try { if (window.__gametokSetMediaActive) window.__gametokSetMediaActive(true); } catch (e) {}
  try { if (window.__gametokUnmuteAll) window.__gametokUnmuteAll(); } catch (e) {}
  try { if (window.__gametokSetRenderActive) window.__gametokSetRenderActive(true); } catch (e) {}
  try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  true;
})();
`;

export const COOPERATIVE_WARM_SCRIPT = `
(function() {
  try { if (window.__gametokSetMediaActive) window.__gametokSetMediaActive(false); } catch (e) {}
  try { if (window.__gametokMuteAll) window.__gametokMuteAll(); } catch (e) {}
  try { if (window.__gametokSetRenderActive) window.__gametokSetRenderActive(true); } catch (e) {}
  try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  true;
})();
`;

export const HARD_MUTE_CLEANUP_SCRIPT = `
(function() {
  try {
    if (window.__gametokSetRenderActive) window.__gametokSetRenderActive(false);
    if (window.__gametokMuteAll) window.__gametokMuteAll();
    if (window._audioContexts) {
      window._audioContexts.forEach(function(ctx) {
        try {
          if (ctx._gametokMasterGain) {
            if (ctx._gametokMasterGain.gain) {
              try {
                ctx._gametokMasterGain.gain.setValueAtTime(0, ctx.currentTime || 0);
              } catch (e) {}
              ctx._gametokMasterGain.gain.value = 0;
            }
            try { ctx._gametokMasterGain.disconnect(); } catch(e){}
            ctx._gametokMasterGainConnected = false;
          }
          try {
            if (ctx.close) {
              ctx.close().catch(function(){});
            } else if (ctx.suspend) {
              ctx.suspend().catch(function(){});
            }
          } catch(e) {}
        } catch(e) {}
      });
      window._audioContexts = [];
    }

    // Scan window properties for any unmanaged AudioContext instances
    try {
      for (var k in window) {
        try {
          var v = window[k];
          if (v && typeof v === 'object' && typeof v.close === 'function' && typeof v.currentTime === 'number') {
            try { v.close().catch(function(){}); } catch(e){}
          }
        } catch(e) {}
      }
    } catch(e) {}

    var allMedia = [];
    if (document) {
      allMedia.push.apply(allMedia, document.querySelectorAll('audio, video'));
    }
    if (window._allAudioInstances) {
      allMedia.push.apply(allMedia, window._allAudioInstances);
      window._allAudioInstances = [];
    }
    allMedia.forEach(function(el) {
      try {
        el.pause();
        el.muted = true;
        el.volume = 0;
        el.currentTime = 0;
        el.removeAttribute('src');
        el.load();
      } catch(e) {}
    });

    try { if (window.Howler) { window.Howler.mute(true); if (typeof window.Howler.unload === 'function') window.Howler.unload(); } } catch(e){}
    try {
      if (window.Phaser && window.Phaser.GAMES) {
        window.Phaser.GAMES.forEach(function(g) {
          try { if (g && g.sound) { g.sound.mute = true; g.sound.stopAll && g.sound.stopAll(); } } catch(e){}
        });
      }
    } catch(e){}
    try { if (window.createjs && window.createjs.Sound) { window.createjs.Sound.stop && window.createjs.Sound.stop(); } } catch(e){}
  } catch(e) {}
  true;
})();
`;
