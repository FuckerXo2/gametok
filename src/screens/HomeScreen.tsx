import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, useWindowDimensions, PanResponder, Animated, TouchableOpacity, Pressable, Image, ImageBackground, Easing, ActivityIndicator, AppState, Alert } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { WebView as WebViewType } from 'react-native-webview';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, G } from 'react-native-svg';
import { API_URL, games as gamesApi, likes as likesApi, savedGames as savedGamesApi, messages, gameProgress, ai as aiApi, users as usersApi } from '../services/api';
import { ShareSheet } from '../components/ShareSheet';
import { RemixModal } from '../components/RemixModal';
import { LeaderboardModal } from '../components/LeaderboardModal';
import { GameLoadingScreen } from '../components/GameLoadingScreen';
import { OnboardingOverlay } from '../components/OnboardingOverlay';
import { CommentsModal } from '../components/CommentsModal';
import { Avatar } from '../components/Avatar';
import { UserProfileModal } from '../components/UserProfileModal';
import { useDeepLink, useNavigation } from '../../App';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { resolveGameThumbnail } from '../utils/thumbnails';
import { LoopsColors, SemanticColors } from '../constants/LoopsColors';
import { LoopsAnimations } from '../constants/LoopsAnimations';
import { isLandscape, type Orientation } from '../constants/orientation';
import { GameSurface } from '../components/GameSurface';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GAMES_HOST = 'https://games.gametok.co';
const API_ORIGIN = API_URL.replace(/\/api$/, '');
const TAB_BAR_HEIGHT = 50; // Base tab bar height (insets.bottom added dynamically)
const TOP_ZONE_HEIGHT = 0; // Removed top scroll zone so taps at the top of the game work
const SWIPE_THRESHOLD = 50;

interface Game {
  id: string;
  name: string;
  description?: string;
  embedUrl?: string;
  thumbnail?: string;
  previewVideoUrl?: string | null;
  likes?: number;
  plays?: number;
  saves?: number;
  color?: string;
  category?: string | null;
  subcategory?: string | null;
  primaryTab?: string | null;
  discoveryChips?: string[];
  creatorId?: string | null;
  creatorDisplayName?: string | null;
  creatorUsername?: string | null;
  creatorVerified?: boolean;
  creatorAvatar?: string | null;
  remixedFrom?: string | null;
  /**
   * 'portrait' (default) or 'landscape'. A landscape game is played by rotating the WebView's
   * content 90° inside this portrait-locked card — the device never rotates, the player does.
   */
  orientation?: Orientation | null;
}

// Feed contains games
interface FeedItem {
  game?: Game;
  id: string;
}

const normalizeFollowKey = (value?: string | null) => String(value || '').trim().toLowerCase();

const getCreatorFollowKey = (game?: Game | null) => (
  normalizeFollowKey(game?.creatorId || game?.creatorUsername)
);

const isCreatorFollowed = (followedKeys: Set<string>, game?: Game | null) => {
  const creatorIdKey = normalizeFollowKey(game?.creatorId);
  const usernameKey = normalizeFollowKey(game?.creatorUsername);
  return Boolean(
    (creatorIdKey && followedKeys.has(creatorIdKey)) ||
    (usernameKey && followedKeys.has(usernameKey))
  );
};

const getGameUrl = (game: Game) => {
  const rawUrl = game.embedUrl
    ? (game.embedUrl.startsWith('/') ? `${API_ORIGIN}${game.embedUrl}` : game.embedUrl)
    : `${GAMES_HOST}/${game.id}/`;
  const separator = rawUrl.includes('?') ? '&' : '?';
  return `${rawUrl}${separator}gd_sdk_referrer_url=${encodeURIComponent(GAMES_HOST)}`;
};

const getThumbnailUrl = (game: Game) => {
  return resolveGameThumbnail(game.thumbnail, game.id, game);
};

const getFeedBackdropColor = () => '#050505';

const isExternalGame = (game: Game) => !!game.embedUrl;

// Domains to block at request level

const GAME_AUDIO_GUARD_SCRIPT = `
(function() {
  if (window.__gametokAudioGuardInstalled) return true;
  window.__gametokAudioGuardInstalled = true;
  window._gametokActive = false;
  window._gametokMuted = true;
  window._audioContexts = window._audioContexts || [];

  // Walk this window plus every same-origin child frame. A lot of HTML5 games
  // (especially distribution/ad-wrapped ones) run their actual audio inside a
  // nested <iframe>, which the top-frame mute never reached - that is why the
  // previous game kept playing after a scroll or after leaving the screen.
  var forEachFrame = function(win, cb) {
    try { cb(win); } catch (e) {}
    var frames;
    try { frames = win.frames; } catch (e) { return; }
    if (!frames) return;
    for (var i = 0; i < frames.length; i++) {
      var child;
      try {
        child = frames[i];
        void child.document; // throws for cross-origin frames -> skip them
      } catch (e) { continue; }
      if (child && child !== win) forEachFrame(child, cb);
    }
  };
  window.__gametokForEachFrame = function(cb) { forEachFrame(window, cb); };

  var muteWindow = function(win) {
    try { win._gametokActive = false; win._gametokMuted = true; } catch (e) {}
    try {
      win.document && win.document.querySelectorAll('audio, video').forEach(function(el) {
        try { el.pause(); el.muted = true; el.volume = 0; } catch (e) {}
      });
    } catch (e) {}
    try { (win._audioContexts || []).forEach(function(ctx) { try { ctx.suspend(); } catch (e) {} }); } catch (e) {}
    try { if (win.Howler) win.Howler.mute(true); } catch (e) {}
    try {
      if (win.Phaser && win.Phaser.GAMES) win.Phaser.GAMES.forEach(function(g) {
        try { if (g && g.sound) { g.sound.mute = true; g.sound.pauseAll && g.sound.pauseAll(); } } catch (e) {}
      });
    } catch (e) {}
    try { if (win.createjs && win.createjs.Sound) win.createjs.Sound.muted = true; } catch (e) {}
  };

  var unmuteWindow = function(win) {
    try { win._gametokActive = true; win._gametokMuted = false; } catch (e) {}
    try { (win._audioContexts || []).forEach(function(ctx) { try { ctx.resume(); } catch (e) {} }); } catch (e) {}
    try {
      win.document && win.document.querySelectorAll('audio, video').forEach(function(el) {
        try { el.muted = false; el.volume = 1; } catch (e) {}
      });
    } catch (e) {}
    try { if (win.Howler) win.Howler.mute(false); } catch (e) {}
    try {
      if (win.Phaser && win.Phaser.GAMES) win.Phaser.GAMES.forEach(function(g) {
        try { if (g && g.sound) g.sound.mute = false; } catch (e) {}
      });
    } catch (e) {}
    try { if (win.createjs && win.createjs.Sound) win.createjs.Sound.muted = false; } catch (e) {}
  };

  window.__gametokMuteAll = function() {
    window._gametokActive = false;
    window._gametokMuted = true;
    try { window._gamePaused = true; } catch (e) {}
    try { window.dispatchEvent(new Event('blur')); } catch (e) {}
    try { document.dispatchEvent(new Event('gametok:pause')); } catch (e) {}
    forEachFrame(window, muteWindow);
    try {
      if (navigator.mediaSession) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'paused';
      }
    } catch (e) {}
  };
  window.__gametokUnmuteAll = function() {
    window._gametokActive = true;
    window._gametokMuted = false;
    try { window._gamePaused = false; } catch (e) {}
    try { window.dispatchEvent(new Event('focus')); } catch (e) {}
    try { document.dispatchEvent(new Event('gametok:resume')); } catch (e) {}
    forEachFrame(window, unmuteWindow);
    try {
      if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
    } catch (e) {}
  };

  // Install the Audio / AudioContext / <media>.play guards into a window realm.
  // Each same-origin frame has its own constructors and prototypes, so the
  // guard has to be installed per realm (top frame + nested frames).
  var installInWindow = function(win) {
    try {
      if (win.__gametokRealmGuarded) return;
      win.__gametokRealmGuarded = true;
      win._audioContexts = win._audioContexts || [];

      var NativeAudio = win.Audio;
      if (NativeAudio && !NativeAudio.__gametokWrapped) {
        var WrappedAudio = function(src) {
          var audio = new NativeAudio(src);
          try { audio.muted = true; audio.volume = 0; } catch (e) {}
          var nativePlay = audio.play ? audio.play.bind(audio) : null;
          if (nativePlay) {
            audio.play = function() {
              if (!window._gametokActive || window._gametokMuted) {
                try { audio.muted = true; audio.volume = 0; } catch (e) {}
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

      var NativeAudioContext = win.AudioContext || win.webkitAudioContext;
      if (NativeAudioContext && !NativeAudioContext.__gametokWrapped) {
        var WrappedAudioContext = function() {
          var ctx = new NativeAudioContext();
          try { win._audioContexts.push(ctx); } catch (e) {}
          if (!window._gametokActive || window._gametokMuted) {
            try { ctx.suspend(); } catch (e) {}
          }
          return ctx;
        };
        WrappedAudioContext.prototype = NativeAudioContext.prototype;
        WrappedAudioContext.__gametokWrapped = true;
        win.AudioContext = WrappedAudioContext;
        win.webkitAudioContext = WrappedAudioContext;
      }

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

  // Guard nested same-origin frames as they appear and keep them silent while
  // this WebView is the inactive/background game.
  var sweepFrames = function() {
    forEachFrame(window, function(win) {
      if (win === window) return;
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
      window._gametokFrameSweep = setInterval(sweepFrames, 1000);
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
      if (data.type === 'GAMETOK_PAUSE') window.__gametokMuteAll();
      if (data.type === 'GAMETOK_RESUME') window.__gametokUnmuteAll();
    } catch (e) {}
  };
  window.addEventListener('message', handleHostMessage);
  document.addEventListener('message', handleHostMessage);
})();
true;
`;


// Script to pause/freeze a game
const PAUSE_SCRIPT = `
(function() {
  if (window.__gametokMuteAll) {
    try { window.__gametokMuteAll(); } catch(e) {}
  }

  // Immediately mute everything
  window._gamePaused = true;
  window._gametokActive = false;
  window._gametokMuted = true;
  
  // Clear ALL intervals to prevent memory leaks
  if (window._muteInterval) {
    clearInterval(window._muteInterval);
    window._muteInterval = null;
  }
  if (window._adRemovalInterval) {
    clearInterval(window._adRemovalInterval);
    window._adRemovalInterval = null;
  }
  if (window._edgeBlockerInterval) {
    clearInterval(window._edgeBlockerInterval);
    window._edgeBlockerInterval = null;
  }
  if (window._gameReadyInterval) {
    clearInterval(window._gameReadyInterval);
    window._gameReadyInterval = null;
  }
  
  // Function to mute everything
  const muteAll = () => {
    // 1. Mute ALL HTML5 audio/video elements
    document.querySelectorAll('audio, video').forEach(el => { 
      try { 
        el.pause(); 
        el.muted = true;
        el.volume = 0;
      } catch(e){} 
    });
    
    // 2. Suspend ALL AudioContexts
    if (window._audioContexts) {
      window._audioContexts.forEach(ctx => { 
        try { ctx.suspend(); } catch(e){} 
      });
    }
    if (window._allGainNodes) {
      window._allGainNodes.forEach(gain => {
        try { 
          gain.gain.setValueAtTime(0, gain.context.currentTime);
        } catch(e) {}
      });
    }
    
    // 3. Mute Howler.js
    if (window.Howler) {
      try { window.Howler.mute(true); } catch(e) {}
    }
    
    // 4. Mute Phaser
    if (window.Phaser && window.Phaser.GAMES) {
      window.Phaser.GAMES.forEach(g => {
        try { 
          if (g.sound) {
            g.sound.mute = true;
            g.sound.pauseAll && g.sound.pauseAll();
          }
        } catch(e) {}
      });
    }
    
    // 5. Mute CreateJS
    if (window.createjs && window.createjs.Sound) {
      try { window.createjs.Sound.muted = true; } catch(e) {}
    }

    // 6. Recurse through same-origin child frames (nested-iframe games)
    if (window.__gametokMuteAll) { try { window.__gametokMuteAll(); } catch(e) {} }
  };

  // Mute immediately
  muteAll();

  // Keep inactive WebViews silent, but avoid hammering every parked game engine.
  if (!window._muteInterval) {
    window._muteInterval = setInterval(muteAll, 2500);
  }
  
  // Unity
  if (window.unityInstance) {
    try { window.unityInstance.SendMessage('AudioManager', 'Mute'); } catch(e) {}
    try { window.unityInstance.SendMessage('SoundManager', 'Mute'); } catch(e) {}
    try { window.unityInstance.SendMessage('AudioListener', 'SetVolume', '0'); } catch(e) {}
  }
  
  // CreateJS Ticker
  if (window.createjs && window.createjs.Ticker) {
    try { window.createjs.Ticker.paused = true; } catch(e) {}
  }
  
  // Global master gain
  if (window._masterGain) {
    try { 
      window._originalGainValue = window._masterGain.gain.value;
      window._masterGain.gain.setValueAtTime(0, window._masterGain.context.currentTime);
    } catch(e) {}
  }
  
  // Stop requestAnimationFrame to freeze game
  if (!window._origRAF) {
    window._origRAF = window.requestAnimationFrame;
    window._rafQueue = [];
  }
  window.requestAnimationFrame = function(cb) {
    window._rafQueue.push(cb);
    return window._rafQueue.length;
  };
})();
true;
`;

// Script to resume/unfreeze a game
const RESUME_SCRIPT = `
(function() {
  // Clear the mute interval first
  window._gamePaused = false;
  window._gametokActive = true;
  window._gametokMuted = false;
  if (window._muteInterval) {
    clearInterval(window._muteInterval);
    window._muteInterval = null;
  }
  
  // Resume Web Audio API contexts first
  if (window._audioContexts) {
    window._audioContexts.forEach(ctx => { 
      try { ctx.resume(); } catch(e){} 
    });
  }
  
  // Restore gain nodes
  if (window._allGainNodes) {
    window._allGainNodes.forEach(gain => {
      try { 
        if (gain._savedValue !== undefined) {
          gain.gain.value = gain._savedValue;
        } else {
          gain.gain.value = 1;
        }
      } catch(e) {}
    });
  }
  
  // Restore master gain
  if (window._masterGain && window._originalGainValue !== undefined) {
    try { window._masterGain.gain.value = window._originalGainValue; } catch(e) {}
  }
  
  // Unmute HTML5 audio/video
  document.querySelectorAll('audio, video').forEach(el => { 
    try { el.muted = false; } catch(e){} 
  });
  
  // Unmute Unity
  if (window.unityInstance) {
    try { window.unityInstance.SendMessage('AudioManager', 'Unmute'); } catch(e) {}
    try { window.unityInstance.SendMessage('SoundManager', 'Unmute'); } catch(e) {}
  }
  
  // Unmute Howler.js
  if (window.Howler) {
    try { window.Howler.mute(false); } catch(e) {}
  }
  
  // Restore requestAnimationFrame
  if (window._origRAF) {
    window.requestAnimationFrame = window._origRAF;
    // Run queued frames
    window._rafQueue && window._rafQueue.forEach(cb => window._origRAF(cb));
    window._rafQueue = [];
  }
  
  // Resume common game engines
  if (window.Phaser && window.Phaser.GAMES) {
    window.Phaser.GAMES.forEach(g => {
      try { g.sound && g.sound.mute !== undefined && (g.sound.mute = false); } catch(e) {}
      try { g.scene && g.scene.resume && g.scene.resume(); } catch(e) {}
    });
  }
  if (window.createjs && window.createjs.Ticker) {
    window.createjs.Ticker.paused = false;
  }
  if (window.createjs && window.createjs.Sound) {
    try { window.createjs.Sound.muted = false; } catch(e) {}
  }

  // Resume same-origin child frames (nested-iframe games) too
  if (window.__gametokUnmuteAll) { try { window.__gametokUnmuteAll(); } catch(e) {} }
})();
true;
`;

// Edge blocking script - prevents WebView from capturing swipe gestures at screen edges
// This is injected into ALL games (both internal and external)
// NOTE: We only use event listeners, NOT div blockers, because:
// 1. Native gesture zones handle the actual swipe detection
// 2. Div blockers with pointer-events:auto could interfere with native touch handling
// 3. Event listeners just stop propagation within the WebView, letting native handle it
// Split out of EDGE_BLOCK_SCRIPT so landscape cards can take this half without the edge-zone
// blocker below (see EDGE_BLOCK_SCRIPT's note). Nothing here is orientation-dependent.
const MEDIA_SESSION_GUARD_SCRIPT = `
(function() {
  // Prevent iOS Now Playing widget
  if (navigator.mediaSession) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.playbackState = 'none';
  }
  try { Object.defineProperty(navigator, 'mediaSession', { get: function() { return { metadata: null, setActionHandler: function(){}, playbackState: 'none', setPositionState: function(){} }; }, configurable: true }); } catch(e) {}
})();
true;
`;

// PORTRAIT ONLY. This blocks touches in the top 15% of the *content*, to complement a native
// gesture band measured in device coordinates. On a rotated landscape card those two bands are
// perpendicular — content-top is the user's left — so the blocker would silently eat touches down
// one whole edge of the screen, which is exactly where a landscape HUD lives, while protecting
// nothing. (The native band it pairs with is already inert: TOP_ZONE_HEIGHT is 0.)
const EDGE_BLOCK_SCRIPT = `
(function() {
  if (window._edgeBlockActive) return;
  window._edgeBlockActive = true;
  
  const TOP_EDGE_ZONE = window.innerHeight * 0.15; // 15% for top swipe detection
  
  // Block touch events in edge zones at capture phase
  // This prevents games from capturing swipes that should go to native gesture handlers
  const blockEdgeTouches = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    const y = touch.clientY;
    const screenHeight = window.innerHeight;
    
    // If touch is in edge zone, stop it from reaching game
    if (y < TOP_EDGE_ZONE) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Don't preventDefault - let native handle it
    }
  };
  
  // Capture phase listeners - intercept before game handlers
  document.addEventListener('touchstart', blockEdgeTouches, { capture: true, passive: true });
  document.addEventListener('touchmove', blockEdgeTouches, { capture: true, passive: true });
  document.addEventListener('touchend', blockEdgeTouches, { capture: true, passive: true });
  
  // Also block pointer events for mouse/stylus
  const blockEdgePointer = (e) => {
    const y = e.clientY;
    const screenHeight = window.innerHeight;
    if (y < TOP_EDGE_ZONE) {
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  };
  document.addEventListener('pointerdown', blockEdgePointer, { capture: true, passive: true });
  document.addEventListener('pointermove', blockEdgePointer, { capture: true, passive: true });
  
  // NO div blockers - native gesture zones handle swipe detection
  // Div blockers with pointer-events:auto were causing issues over time
})();
true;
`;



// Cloud save script - intercepts localStorage and syncs with server
// This is a function because we need to inject the gameId and initial data
const createCloudSaveScript = (gameId: string, initialData: Record<string, string> = {}) => `
(function() {
  if (window._cloudSaveActive) return;
  window._cloudSaveActive = true;
  
  const GAME_ID = '${gameId}';
  const SAVE_DEBOUNCE_MS = 2000; // Save to server every 2 seconds max
  
  // Restore initial data from server
  const initialData = ${JSON.stringify(initialData)};
  Object.keys(initialData).forEach(key => {
    try {
      localStorage.setItem(key, initialData[key]);
    } catch(e) {}
  });
  
  // Track changes for debounced save
  let pendingChanges = {};
  let saveTimeout = null;
  
  // Send changes to React Native
  const syncToServer = () => {
    if (Object.keys(pendingChanges).length === 0) return;
    
    // Collect all localStorage data
    const allData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        allData[key] = localStorage.getItem(key);
      }
    }
    
    window.ReactNativeWebView?.postMessage(JSON.stringify({
      type: 'CLOUD_SAVE',
      gameId: GAME_ID,
      storageData: allData
    }));
    
    pendingChanges = {};
  };
  
  // Intercept localStorage.setItem
  const origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    origSetItem(key, value);
    pendingChanges[key] = value;
    
    // Debounce the save
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(syncToServer, SAVE_DEBOUNCE_MS);
  };
  
  // Also save when page unloads
  window.addEventListener('beforeunload', syncToServer);
  window.addEventListener('pagehide', syncToServer);
  
  console.log('[CloudSave] Initialized for game:', GAME_ID);
})();
true;
`;

/**
 * Tells native when the player touched the game (hide chrome) and when they made a feed-swipe
 * gesture inside it (bring chrome back).
 *
 * The swipe test MUST match the orientation. These deltas are content-frame `clientX/clientY`,
 * but the feed pages on device-Y — and on a rotated landscape card, device-Y *is* content-X.
 * Getting this wrong is not cosmetic: `fullScreenPanResponder` is stripped the moment the player
 * interacts with a game (see the WebView's gesture wrapper) and `edgePanResponder` is inert
 * (TOP_ZONE_HEIGHT is 0), so this message is the only thing that restores the chrome. If it never
 * fires, the player is trapped in the game with no way back to the feed.
 */
const buildHudInteractionBridgeScript = (orientation: Orientation) => `
(function() {
  if (window._hudInteractionBridgeActive) return;
  window._hudInteractionBridgeActive = true;
  // The content axis that corresponds to the feed's paging direction.
  var SWIPE_AXIS = ${JSON.stringify(isLandscape(orientation) ? 'x' : 'y')};

  let lastHudPing = 0;
  let lastInteractionPing = 0;
  let swipeStartY = null;
  let swipeStartX = null;
  const notifyInteraction = (type) => {
    const now = Date.now();
    if (type === 'USER_SWIPE_INTENT') {
      if (now - lastHudPing < 1200) return;
      lastHudPing = now;
    } else if (type === 'USER_INTERACTION') {
      if (now - lastInteractionPing < 500) return;
      lastInteractionPing = now;
    }
    
    window.ReactNativeWebView?.postMessage(JSON.stringify({
      type,
      ts: now
    }));
  };

  const handleTouchStart = (event) => {
    notifyInteraction('USER_INTERACTION');
    const point = event.touches && event.touches[0];
    if (!point) return;
    swipeStartY = point.clientY;
    swipeStartX = point.clientX;
  };

  const handleTouchMove = (event) => {
    const point = event.touches && event.touches[0];
    if (!point || swipeStartY == null || swipeStartX == null) return;
    const dy = point.clientY - swipeStartY;
    const dx = point.clientX - swipeStartX;
    // along = movement on the feed's paging axis, across = the perpendicular one.
    const along = SWIPE_AXIS === 'x' ? dx : dy;
    const across = SWIPE_AXIS === 'x' ? dy : dx;
    if (Math.abs(along) > 18 && Math.abs(along) > Math.abs(across)) {
      notifyInteraction('USER_SWIPE_INTENT');
    }
  };

  const resetSwipe = () => {
    swipeStartY = null;
    swipeStartX = null;
  };

  ['touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, handleTouchStart, { passive: true });
    document.addEventListener(eventName, handleTouchStart, { passive: true });
  });

  ['touchmove'].forEach((eventName) => {
    window.addEventListener(eventName, handleTouchMove, { passive: true });
    document.addEventListener(eventName, handleTouchMove, { passive: true });
  });

  ['touchend', 'touchcancel'].forEach((eventName) => {
    window.addEventListener(eventName, resetSwipe, { passive: true });
    document.addEventListener(eventName, resetSwipe, { passive: true });
  });
})();
true;
`;

// Intelligent game ready detection script
// Monitors multiple signals to determine when a game is actually playable
const GAME_READY_SCRIPT = `
(function() {
  if (window._gameReadyDetectorActive) return;
  window._gameReadyDetectorActive = true;
  
  let gameReady = false;
  let rafCount = 0;
  let canvasFound = false;
  const startTime = Date.now();
  
  let notifyAttempts = 0;
  const notifyReady = () => {
    if (gameReady) return;
    notifyAttempts++;
    
    // Minimum 2.5 seconds before we can mark as ready to let their loaders finish
    if (Date.now() - startTime < 2500) {
      setTimeout(notifyReady, 2500 - (Date.now() - startTime));
      return;
    }
    
    try {
      if (typeof window.ReactNativeWebView !== 'undefined' && typeof window.ReactNativeWebView.postMessage === 'function') {
        gameReady = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'GAME_READY' }));
      } else {
        // React Native bridge isn't here yet, retry shortly. 
        // Stop retrying if we've tried for roughly 15 seconds.
        if (notifyAttempts < 60) {
            setTimeout(notifyReady, 250);
        } else {
            gameReady = true; // Give up and force unblock UI
        }
      }
    } catch (e) {
      // Fallback if accessing window.ReactNativeWebView throws cross-origin or sandbox errors
      if (notifyAttempts < 60) {
          setTimeout(notifyReady, 250);
      } else {
          gameReady = true;
      }
    }
  };
  
  // 1. Track RAF calls - if game loop is running, game is ready
  const origRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = function(cb) {
    rafCount++;
    // After 20 frames, game is definitely running
    if (rafCount >= 20 && !gameReady) {
      notifyReady();
    }
    return origRAF.call(window, cb);
  };
  
  // 2. Check for canvas with content
  const checkCanvas = () => {
    if (canvasFound) return;
    const canvases = document.querySelectorAll('canvas');
    for (const canvas of canvases) {
      if (canvas.width > 50 && canvas.height > 50) {
        const style = window.getComputedStyle(canvas);
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          canvasFound = true;
          // Canvas exists and is visible. Wait 1.5 seconds for it to render fully.
          setTimeout(() => {
            if (!gameReady) notifyReady();
          }, 1500);
          break;
        }
      }
    }
  };
  
  // 3. Check for common game engines being ready
  const checkEngines = () => {
    // Unity
    if (window.unityInstance) { notifyReady(); return true; }
    // Phaser running
    if (window.Phaser?.GAMES?.[0]?.isRunning) { notifyReady(); return true; }
    // PixiJS
    if (window.PIXI?.Application) { notifyReady(); return true; }
    // Construct
    if (window.cr_getC2Runtime || window.C3) { notifyReady(); return true; }
    // GDevelop
    if (window.gdjs?.runtimeGame) { notifyReady(); return true; }
    return false;
  };
  
  // Wait for WebGL context to be created (strong signal game engine actually started)
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type) {
    if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
      canvasFound = true;
      setTimeout(() => {
        if (!gameReady) notifyReady();
      }, 2000); // Wait 2 seconds after engine initializes WebGL
    }
    return origGetContext.apply(this, arguments);
  };

  // Run checks every 200ms
  window._gameReadyInterval = setInterval(() => {
    if (gameReady) {
      clearInterval(window._gameReadyInterval);
      window._gameReadyInterval = null;
      return;
    }
    checkCanvas();
    checkEngines();
    
    // Force ready if RAF is running well
    if (Date.now() - startTime > 3000 && rafCount > 60) {
      notifyReady();
    }
  }, 200);
  
  // Fallback: max 8 seconds (heavy 3D games take a while)
  setTimeout(() => {
    if (!gameReady) notifyReady();
    if (window._gameReadyInterval) {
      clearInterval(window._gameReadyInterval);
      window._gameReadyInterval = null;
    }
  }, 15000);
true;
`;

// Format count like TikTok (1.2K, 3.4M, etc)
const formatCount = (count: number): string => {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
};

// Generate fake engagement numbers that vary per day + session
// Numbers "grow" over time (day-based) and jitter per session
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

// Shuffle array randomly (Fisher-Yates)
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Create feed of games
const createFeed = (games: Game[], cycle: number = 0): FeedItem[] => {
  // Shuffle games for variety
  const shuffledGames = shuffleArray(games);
  const result: FeedItem[] = [];

  shuffledGames.forEach((game, index) => {
    result.push({
      game,
      id: `${game.id}-cycle${cycle}-${index}`,
    });
  });

  return result;
};

// Animated Like Button
const AnimatedLikeButton = ({
  isLiked,
  onPress,
  likeCount,
  styles
}: {
  isLiked: boolean;
  onPress: (e: any) => void;
  likeCount: number;
  styles: any;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = (e: any) => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.7,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1.2,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true,
      })
    ]).start();
    onPress(e);
  };

  return (
    <TouchableOpacity style={styles.actionButton} onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name="heart"
          size={35}
          color={isLiked ? LoopsColors.mainPink : LoopsColors.white}
        />
      </Animated.View>
      <Text style={styles.actionCount}>{formatCount(likeCount)}</Text>
    </TouchableOpacity>
  );
};

const AnimatedShareButton = ({
  onPress,
  shareCount,
  styles
}: {
  onPress: (e: any) => void;
  shareCount: number;
  styles: any;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = (e: any) => {
    onPress(e);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.7, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1.2, friction: 3, tension: 40, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true })
    ]).start();
  };

  return (
    <TouchableOpacity style={styles.actionButton} onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name="arrow-redo" size={32} color={LoopsColors.white} />
      </Animated.View>
      <Text style={styles.actionCount}>{formatCount(shareCount)}</Text>
    </TouchableOpacity>
  );
};

const AnimatedCommentButton = ({
  onPress,
  commentCount,
  styles
}: {
  onPress: (e: any) => void;
  commentCount: number;
  styles: any;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = (e: any) => {
    onPress(e);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.72, duration: 90, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1.14, friction: 3, tension: 40, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true })
    ]).start();
  };

  return (
    <TouchableOpacity style={styles.actionButton} onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name="chatbubble-outline" size={32} color={LoopsColors.white} />
      </Animated.View>
      <Text style={styles.actionCount}>{formatCount(commentCount)}</Text>
    </TouchableOpacity>
  );
};

const AnimatedFollowBadge = ({
  loading,
  followed,
  disabled,
  onPress,
  styles
}: {
  loading: boolean;
  followed: boolean;
  disabled?: boolean;
  onPress: () => void;
  styles: any;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(0.7)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading && !followed) return;

    scale.setValue(0.72);
    ringScale.setValue(0.7);
    ringOpacity.setValue(0.5);

    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.22,
          friction: 4,
          tension: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(ringScale, {
        toValue: 1.75,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(ringOpacity, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [followed, loading, ringOpacity, ringScale, scale]);

  return (
    <Pressable
      style={styles.creatorFollowBadgeWrap}
      onPress={onPress}
      disabled={disabled || loading || followed}
      hitSlop={10}
    >
      <Animated.View
        style={[
          styles.creatorFollowPulse,
          {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.creatorFollowBadge,
          followed && styles.creatorFollowBadgeDone,
          { transform: [{ scale }] },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Ionicons name={followed ? "checkmark" : "add"} size={20} color="#FFF" />
        )}
      </Animated.View>
    </Pressable>
  );
};

const GameLoadingAnimation: React.FC = () => {
  // Shape rotations
  const rotation1 = useRef(new Animated.Value(0)).current;
  const rotation2 = useRef(new Animated.Value(0)).current;
  const rotation3 = useRef(new Animated.Value(0)).current;

  // Scale morphing
  const scale1 = useRef(new Animated.Value(1)).current;
  const scale2 = useRef(new Animated.Value(0.8)).current;
  const scale3 = useRef(new Animated.Value(0.6)).current;

  // Glow pulse
  const glow = useRef(new Animated.Value(0.4)).current;

  // Fade in
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Outer shape - slow rotation
    Animated.loop(
      Animated.timing(rotation1, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Middle shape - medium rotation opposite direction
    Animated.loop(
      Animated.timing(rotation2, {
        toValue: -1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Inner shape - fast rotation
    Animated.loop(
      Animated.timing(rotation3, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Scale morphing - outer
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale1, {
          toValue: 1.15,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale1, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Scale morphing - middle (offset)
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale2, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale2, {
          toValue: 0.7,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Scale morphing - inner
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale3, {
          toValue: 0.8,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale3, {
          toValue: 0.5,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.4,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const spin1 = rotation1.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spin2 = rotation2.interpolate({
    inputRange: [-1, 0],
    outputRange: ['-360deg', '0deg'],
  });

  const spin3 = rotation3.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[loadingStyles.container, { opacity }]}>
      {/* Glow effect behind shapes */}
      <Animated.View style={[loadingStyles.glowOrb, { opacity: glow }]} />

      {/* Outer hexagon */}
      <Animated.View style={[loadingStyles.shapeContainer, { transform: [{ rotate: spin1 }, { scale: scale1 }] }]}>
        <Svg width={120} height={120} viewBox="0 0 120 120">
          <Path
            d="M60 10 L105 35 L105 85 L60 110 L15 85 L15 35 Z"
            stroke="#a855f7"
            strokeWidth="2"
            fill="none"
            opacity="0.8"
          />
        </Svg>
      </Animated.View>

      {/* Middle square (diamond) */}
      <Animated.View style={[loadingStyles.shapeContainer, loadingStyles.shapeAbsolute, { transform: [{ rotate: spin2 }, { scale: scale2 }] }]}>
        <Svg width={90} height={90} viewBox="0 0 90 90">
          <Path
            d="M45 5 L85 45 L45 85 L5 45 Z"
            stroke="#06b6d4"
            strokeWidth="2"
            fill="none"
            opacity="0.8"
          />
        </Svg>
      </Animated.View>

      {/* Inner triangle */}
      <Animated.View style={[loadingStyles.shapeContainer, loadingStyles.shapeAbsolute, { transform: [{ rotate: spin3 }, { scale: scale3 }] }]}>
        <Svg width={60} height={60} viewBox="0 0 60 60">
          <Path
            d="M30 8 L55 52 L5 52 Z"
            stroke="#f472b6"
            strokeWidth="2.5"
            fill="none"
            opacity="0.9"
          />
        </Svg>
      </Animated.View>

      {/* Center dot */}
      <View style={loadingStyles.centerDot} />
    </Animated.View>
  );
};

const loadingStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
    height: 140,
  },
  glowOrb: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#a855f7',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 40,
  },
  shapeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shapeAbsolute: {
    position: 'absolute',
  },
  centerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
});

interface HomeScreenProps {
  isActive?: boolean;
  onHomeDoubleTap?: () => void;
  refreshTrigger?: number;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ isActive = true, refreshTrigger = 0 }) => {
  const insets = useSafeAreaInsets();
  const { sharedGameId, clearSharedGame } = useDeepLink();
  const { setActiveTab: setRootActiveTab, setPendingDraftId, setSearchModalVisible, setIsGameDeckActive, isGameDeckActive, isHudHidden, setIsHudHidden, gameRestartTrigger, gameSkipCounter } = useNavigation();
  const { user } = useAuth();
  const { setMyStatus } = useSocket();
  const isFocused = isActive; // Use the prop instead of navigation hook
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [interactedGameId, setInteractedGameId] = useState<string | null>(null);
  const [followingCreatorIds, setFollowingCreatorIds] = useState<Set<string>>(new Set());
  const [followingLoadingIds, setFollowingLoadingIds] = useState<Set<string>>(new Set());
  const [followSuccessIds, setFollowSuccessIds] = useState<Set<string>>(new Set());
  const [selectedProfileUser, setSelectedProfileUser] = useState<any>(null);
  const [webViewResetKeys, setWebViewResetKeys] = useState<Record<string, number>>({});
  const followSuccessTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isGameDeckActiveRef = useRef(isGameDeckActive);
  useEffect(() => {
    isGameDeckActiveRef.current = isGameDeckActive;
  }, [isGameDeckActive]);

  const interactedGameIdRef = useRef(interactedGameId);
  useEffect(() => {
    interactedGameIdRef.current = interactedGameId;
  }, [interactedGameId]);

  useEffect(() => {
    if (!user?.id) {
      setFollowingCreatorIds(new Set());
      setFollowingLoadingIds(new Set());
      setFollowSuccessIds(new Set());
      return;
    }

    let cancelled = false;
    usersApi.following(user.id)
      .then((res: any) => {
        if (cancelled) return;
        const following = Array.isArray(res)
          ? res
          : res?.users || res?.following || [];
        setFollowingCreatorIds(
          new Set(
            following
              .flatMap((item: any) => [
                normalizeFollowKey(item?.id || item?.userId),
                normalizeFollowKey(item?.username),
              ])
              .filter(Boolean),
          ),
        );
      })
      .catch((error) => {
        console.warn("Failed to load following creators:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    return () => {
      Object.values(followSuccessTimeouts.current).forEach(clearTimeout);
      followSuccessTimeouts.current = {};
    };
  }, []);

  const resolveCreatorId = useCallback(async (creatorId?: string | null, creatorUsername?: string | null) => {
    if (creatorId) return creatorId;
    const username = creatorUsername?.trim();
    if (!username) return null;

    const result = await usersApi.search(username);
    const users = Array.isArray(result) ? result : result?.users || [];
    const matchedUser = users.find((candidate: any) => (
      String(candidate?.username || "").toLowerCase() === username.toLowerCase()
    )) || users[0];

    return matchedUser?.id ? String(matchedUser.id) : null;
  }, []);

  const handleOpenCreatorProfile = useCallback(async (game: Game) => {
    const fallbackId = game.creatorId || game.creatorUsername;
    if (!fallbackId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (game.creatorId) {
      setSelectedProfileUser({
        id: game.creatorId,
        username: game.creatorUsername || game.creatorDisplayName || 'creator',
        displayName: game.creatorDisplayName || game.creatorUsername || 'Creator',
        avatar: game.creatorAvatar || null,
        verified: Boolean(game.creatorVerified),
        status: 'GAME CREATOR',
        isOnline: false,
        isFriend: isCreatorFollowed(followingCreatorIds, game),
      });
      return;
    }

    try {
      const resolvedId = await resolveCreatorId(null, game.creatorUsername);
      const profile = resolvedId ? await usersApi.get(resolvedId) : null;
      const profileUser = profile?.user || {};
      setSelectedProfileUser({
        id: profileUser.id || resolvedId || fallbackId,
        username: profileUser.username || game.creatorUsername || 'creator',
        displayName: profileUser.displayName || game.creatorDisplayName || game.creatorUsername || 'Creator',
        avatar: profileUser.avatar || game.creatorAvatar || null,
        verified: Boolean(profileUser.verified ?? game.creatorVerified),
        status: 'GAME CREATOR',
        isOnline: false,
        isFriend: Boolean(profile?.isFollowing),
      });
    } catch (error) {
      console.warn("Failed to open creator profile:", error);
      setSelectedProfileUser({
        id: fallbackId,
        username: game.creatorUsername || 'creator',
        displayName: game.creatorDisplayName || game.creatorUsername || 'Creator',
        avatar: game.creatorAvatar || null,
        verified: Boolean(game.creatorVerified),
        status: 'GAME CREATOR',
        isOnline: false,
        isFriend: false,
      });
    }
  }, [followingCreatorIds, resolveCreatorId]);

  const handleFollowCreator = useCallback(async (creatorId?: string | null, creatorUsername?: string | null) => {
    const optimisticId = normalizeFollowKey(creatorId || creatorUsername);
    if (!optimisticId || optimisticId === normalizeFollowKey(user?.id) || followingLoadingIds.has(optimisticId)) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFollowingLoadingIds(prev => {
      const next = new Set(prev);
      next.add(optimisticId);
      return next;
    });

    try {
      const resolvedCreatorId = await resolveCreatorId(creatorId, creatorUsername);
      if (!resolvedCreatorId || normalizeFollowKey(resolvedCreatorId) === normalizeFollowKey(user?.id)) {
        throw new Error("Creator id unavailable");
      }
      const resolvedCreatorKey = normalizeFollowKey(resolvedCreatorId);
      const creatorUsernameKey = normalizeFollowKey(creatorUsername);

      const result = await usersApi.follow(resolvedCreatorId);
      if (result?.following === false) {
        setFollowingCreatorIds(prev => {
          const next = new Set(prev);
          next.delete(resolvedCreatorKey);
          if (creatorUsernameKey) next.delete(creatorUsernameKey);
          return next;
        });
        return;
      }

      setFollowingCreatorIds(prev => {
        const next = new Set(prev);
        next.add(resolvedCreatorKey);
        if (creatorUsernameKey) next.add(creatorUsernameKey);
        return next;
      });
      setFollowSuccessIds(prev => {
        const next = new Set(prev);
        next.add(optimisticId);
        next.add(resolvedCreatorKey);
        return next;
      });

      if (followSuccessTimeouts.current[optimisticId]) {
        clearTimeout(followSuccessTimeouts.current[optimisticId]);
      }
      followSuccessTimeouts.current[optimisticId] = setTimeout(() => {
        setFollowSuccessIds(prev => {
          const next = new Set(prev);
          next.delete(optimisticId);
          next.delete(resolvedCreatorKey);
          return next;
        });
        delete followSuccessTimeouts.current[optimisticId];
      }, 900);
    } catch (error) {
      setFollowingCreatorIds(prev => {
        const next = new Set(prev);
        const creatorIdKey = normalizeFollowKey(creatorId);
        const creatorUsernameKey = normalizeFollowKey(creatorUsername);
        if (creatorIdKey) next.delete(creatorIdKey);
        if (creatorUsernameKey) next.delete(creatorUsernameKey);
        return next;
      });
      console.warn("Failed to follow creator:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setFollowingLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(optimisticId);
        return next;
      });
    }
  }, [followingLoadingIds, resolveCreatorId, user?.id]);

  useEffect(() => {
    if (gameSkipCounter.count > 0) {
      const idx = currentIndexRef.current;
      const total = feedRef.current.length;
      if (gameSkipCounter.direction === 'next' && idx < total - 1) {
        animateToIndex(idx + 1);
      } else if (gameSkipCounter.direction === 'prev' && idx > 0) {
        animateToIndex(idx - 1);
      }
    }
  }, [gameSkipCounter]);

  useEffect(() => {
    if (gameRestartTrigger > 0 && currentIndex >= 0 && feed[currentIndex]) {
      const activeGameId = feed[currentIndex].id;
      // Inject a script to restart the game
      webViewRefs.current[activeGameId]?.injectJavaScript(`
        if (typeof window !== 'undefined') {
          // Hard reload the iframe/window
          window.location.reload();
        }
        true;
      `);
    }
  }, [gameRestartTrigger]);

  // Toggle presence between 'in-game' (when actively playing) and 'online'
  useEffect(() => {
    if (!isActive) return;
    if (currentIndex >= 0) {
      setMyStatus('in-game');
    } else {
      setMyStatus('online');
    }
    return () => {
      setMyStatus('online');
    };
  }, [isActive, currentIndex, setMyStatus]);
  const [loading, setLoading] = useState(true);

  const [scrollEnabled, setScrollEnabled] = useState(false);
  const [gestureKey, setGestureKey] = useState(0);
  const hudHintOpacity = useRef(new Animated.Value(0.82)).current;
  const hideHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Animated opacity for the "For You" top bar and game info (bottom left)
  const overlayInfoOpacity = useRef(new Animated.Value(1)).current;

  // Animated slide for right-side action buttons (vertical)
  const actionButtonsTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(overlayInfoOpacity, {
      toValue: isGameDeckActive ? 0 : 1,
      duration: isGameDeckActive ? 200 : 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [isGameDeckActive, overlayInfoOpacity]);

  useEffect(() => {
    Animated.spring(actionButtonsTranslateY, {
      toValue: isHudHidden ? 120 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  }, [isHudHidden, actionButtonsTranslateY]);

  // Track which games have finished loading (ready to play)
  const [readyGames, setReadyGames] = useState<Set<string>>(new Set());

  // Hard safety net: if onLoadEnd never fires, force-dismiss after 15s
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (feed.length > 0 && currentIndex >= 0 && currentIndex < feed.length) {
      const activeItem = feed[currentIndex];
      if (activeItem && !readyGames.has(activeItem.id)) {
        timeout = setTimeout(() => {
          setReadyGames(prev => {
            if (prev.has(activeItem.id)) return prev;
            const next = new Set(prev);
            next.add(activeItem.id);
            return next;
          });
        }, 15000);
      }
    }
    return () => clearTimeout(timeout);
  }, [currentIndex, feed, readyGames]);



  // Store original games for infinite loop
  const allGamesRef = useRef<Game[]>([]);
  const feedCycleRef = useRef(0);

  // Track liked games and like counts
  const [likedGames, setLikedGames] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<{ [gameId: string]: number }>({});

  // Track saved games (bookmarks) and counts
  const [savedGames, setSavedGames] = useState<Set<string>>(new Set());
  const [saveCounts, setSaveCounts] = useState<{ [gameId: string]: number }>({});

  // Track share counts
  const [shareCounts, setShareCounts] = useState<{ [gameId: string]: number }>({});

  // Cloud save - track loaded progress per game
  const loadedProgressRef = useRef<{ [gameId: string]: Record<string, string> }>({});

  // Gamification - track play time for current game
  const gameStartTimeRef = useRef<number | null>(null);
  const lastTrackedGameRef = useRef<string | null>(null);
  const playRecordedForSessionRef = useRef<Set<string>>(new Set());
  const playRecordTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Live session points counter (ticks up every 5 seconds)
  const [sessionPoints, setSessionPoints] = useState(0);
  const sessionPointsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const periodicSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Track session points per game so they persist when switching back
  const gameSessionPointsRef = useRef<{ [gameId: string]: number }>({});

  // Share sheet state
  const [showShare, setShowShare] = useState(false);
  const [shareGameId, setShareGameId] = useState<string>('');
  const [shareGameName, setShareGameName] = useState<string>('');
  const [showComments, setShowComments] = useState(false);
  const [commentGameId, setCommentGameId] = useState<string>('');
  const [commentGameName, setCommentGameName] = useState<string>('');
  const [remixTarget, setRemixTarget] = useState<Game | null>(null);
  const [remixLoading, setRemixLoading] = useState(false);

  // Click animation state - track position of last tap
  const [clickAnimations, setClickAnimations] = useState<Array<{ id: string; x: number; y: number }>>([]);

  // Leaderboard modal state
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardGameId, setLeaderboardGameId] = useState<string>('');
  const [leaderboardGameName, setLeaderboardGameName] = useState<string>('');

  // Handle opening leaderboard - submit current session points first
  const handleOpenLeaderboard = async (gameId: string, gameName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Submit current session points to backend before showing leaderboard
    if (gameStartTimeRef.current && user && sessionPoints > 0) {
      const playTimeSeconds = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);
      if (playTimeSeconds >= 5) {
        try {
          // Gamification removed
          console.log(`[Game] Played ${gameId} for ${playTimeSeconds}s`);
          // Reset the start time to now (so we don't double-count)
          gameStartTimeRef.current = Date.now();
        } catch (e) {
          console.log('[Gamification] Failed to sync points:', e);
        }
      }
    }

    setLeaderboardGameId(gameId);
    setLeaderboardGameName(gameName);
    setShowLeaderboard(true);
  };

  // Keep the playable surface inside the phone chrome boundaries.
  // SCREEN_WIDTH/SCREEN_HEIGHT above are captured once at module load, which is fine on a
  // portrait-locked phone. iPad is NOT locked (see ios/GameTOK/Info.plist), so read the live
  // window too — the landscape-rotation decision below depends on the window's true shape.
  const windowDims = useWindowDimensions();
  const windowIsPortrait = windowDims.height >= windowDims.width;
  const contentHeight = SCREEN_HEIGHT - insets.top - TAB_BAR_HEIGHT - insets.bottom;
  const contentHeightRef = useRef(contentHeight);
  
  useEffect(() => {
    contentHeightRef.current = contentHeight;
  }, [contentHeight]);

  // Trigger click animation at button position
  const triggerClickAnimation = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    const id = Date.now().toString();
    setClickAnimations(prev => [...prev, { id, x: pageX, y: pageY }]);

    // Remove animation after 500ms
    setTimeout(() => {
      setClickAnimations(prev => prev.filter(anim => anim.id !== id));
    }, 500);
  };

  const clearHudTimers = useCallback(() => {
    if (hideHintTimeoutRef.current) {
      clearTimeout(hideHintTimeoutRef.current);
      hideHintTimeoutRef.current = null;
    }
  }, []);

  const scheduleImmersiveHud = useCallback(() => {
    clearHudTimers();

    hideHintTimeoutRef.current = setTimeout(() => {
      Animated.timing(hudHintOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, 7000);
  }, [clearHudTimers, hudHintOpacity]);

  const restoreHud = useCallback((reschedule: boolean = true) => {
    clearHudTimers();
    Animated.timing(hudHintOpacity, {
      toValue: 0.82,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    if (reschedule) {
      scheduleImmersiveHud();
    }
  }, [clearHudTimers, hudHintOpacity, scheduleImmersiveHud]);

  // Handle like - calls API and updates count
  const handleLike = async (gameId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Optimistic update
    const wasLiked = likedGames.has(gameId);
    setLikedGames(prev => {
      const newSet = new Set(prev);
      if (wasLiked) {
        newSet.delete(gameId);
      } else {
        newSet.add(gameId);
      }
      return newSet;
    });
    setLikeCounts(prev => ({
      ...prev,
      [gameId]: (prev[gameId] || 0) + (wasLiked ? -1 : 1)
    }));

    // Call API
    try {
      const result = await likesApi.toggle(gameId);
      // Update with server's count
      setLikeCounts(prev => ({
        ...prev,
        [gameId]: result.likeCount
      }));
      // Sync liked state with server
      setLikedGames(prev => {
        const newSet = new Set(prev);
        if (result.liked) {
          newSet.add(gameId);
        } else {
          newSet.delete(gameId);
        }
        return newSet;
      });
    } catch (e) {
      // Revert on error
      setLikedGames(prev => {
        const newSet = new Set(prev);
        if (wasLiked) {
          newSet.add(gameId);
        } else {
          newSet.delete(gameId);
        }
        return newSet;
      });
      setLikeCounts(prev => ({
        ...prev,
        [gameId]: (prev[gameId] || 0) + (wasLiked ? 1 : -1)
      }));
    }
  };

  // Handle save/bookmark - calls API
  const handleSave = async (gameId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic update
    const wasSaved = savedGames.has(gameId);
    setSavedGames(prev => {
      const newSet = new Set(prev);
      if (wasSaved) {
        newSet.delete(gameId);
      } else {
        newSet.add(gameId);
      }
      return newSet;
    });
    setSaveCounts(prev => ({
      ...prev,
      [gameId]: (prev[gameId] || 0) + (wasSaved ? -1 : 1)
    }));

    // Call API
    try {
      const result = await savedGamesApi.toggle(gameId);
      // Sync saved state with server
      setSavedGames(prev => {
        const newSet = new Set(prev);
        if (result.saved) {
          newSet.add(gameId);
        } else {
          newSet.delete(gameId);
        }
        return newSet;
      });
      // Update with server's count
      if (result.saveCount !== undefined) {
        setSaveCounts(prev => ({
          ...prev,
          [gameId]: result.saveCount
        }));
      }
    } catch (e) {
      // Revert on error
      setSavedGames(prev => {
        const newSet = new Set(prev);
        if (wasSaved) {
          newSet.add(gameId);
        } else {
          newSet.delete(gameId);
        }
        return newSet;
      });
      setSaveCounts(prev => ({
        ...prev,
        [gameId]: (prev[gameId] || 0) + (wasSaved ? 1 : -1)
      }));
    }
  };

  // Handle share - opens share sheet
  const handleShare = (game: Game) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setShareGameId(game.id);
      setShareGameName(game.name);
      setShowShare(true);
    } catch (e: any) {
      Alert.alert('Share Error', e.message || String(e));
    }
  };

  const handleRemix = (game: Game) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const sourceId = game.embedUrl?.split('/api/ai/play/')[1]?.split(/[?#]/)[0];
    if (!sourceId) {
      Alert.alert('Cannot remix', "This game can't be remixed.");
      return;
    }
    setRemixTarget(game);
  };

  const confirmRemix = async () => {
    if (!remixTarget || remixLoading) return;
    const sourceId = remixTarget.embedUrl?.split('/api/ai/play/')[1]?.split(/[?#]/)[0];
    if (!sourceId) { setRemixTarget(null); return; }
    setRemixLoading(true);
    try {
      const res = await aiApi.remixGame(sourceId);
      if (res?.draftId) {
        setRemixTarget(null);
        // Jump straight into editing the fresh remix draft.
        setPendingDraftId(res.draftId);
        setRootActiveTab('create');
      } else {
        Alert.alert('Remix failed', res?.error || "Couldn't remix this game.");
      }
    } catch (e: any) {
      Alert.alert('Remix failed', e?.message || String(e));
    } finally {
      setRemixLoading(false);
    }
  };

  const handleOpenComments = (game: Game) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCommentGameId(game.id);
      setCommentGameName(game.name);
      setShowComments(true);
    } catch (e: any) {
      Alert.alert('Comments Error', e.message || String(e));
    }
  };

  // Handle sending game to friend
  const handleSendToFriend = async (friendId: string, gameId: string) => {
    try {
      await messages.send({
        recipientId: friendId,
        gameShare: { gameId }
      });
    } catch (e) {
      console.error('Failed to send game:', e);
    }
  };

  const getFeedCount = useCallback((gameId: string, type: 'likes' | 'saves' | 'shares') => {
    if (type === 'likes') {
      return Math.max(0, likeCounts[gameId] ?? 0);
    }
    if (type === 'saves') {
      return Math.max(0, saveCounts[gameId] ?? 0);
    }
    return Math.max(0, shareCounts[gameId] ?? 0);
  }, [likeCounts, saveCounts, shareCounts]);

  const currentIndexRef = useRef(0);
  const feedRef = useRef<FeedItem[]>([]);
  const translateY = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);
  const webViewRefs = useRef<{ [key: string]: WebViewType | null }>({});
  const prevIndexRef = useRef(-1); // Start at -1 to match initial currentIndex

  const pauseWebView = useCallback((webView?: WebViewType | null) => {
    if (!webView) return;
    webView.postMessage(JSON.stringify({ type: 'GAMETOK_PAUSE' }));
    webView.injectJavaScript(PAUSE_SCRIPT);
  }, []);

  const resumeWebView = useCallback((webView?: WebViewType | null) => {
    if (!webView) return;
    webView.postMessage(JSON.stringify({ type: 'GAMETOK_RESUME' }));
    webView.injectJavaScript(RESUME_SCRIPT);
  }, []);

  const pauseAllWebViews = useCallback(() => {
    Object.values(webViewRefs.current).forEach(pauseWebView);
  }, [pauseWebView]);

  // Silence a game WITHOUT tearing it down: pause its loop, stop and detach any audio/video, but
  // leave the WebView mounted so its last rendered frame stays on screen behind the thumbnail.
  // This is what "the game paused in the background behind the poster" needs — resetWebView below
  // bumps the React key, which destroys the WebView and restarts the download, leaving nothing to
  // show. Use this for the thumbnail tap; keep resetWebView for cases where the frame is not
  // wanted anymore (app backgrounded, leaving the game deck).
  const suspendWebView = useCallback((itemId?: string | null) => {
    if (!itemId) return;
    const webView = webViewRefs.current[itemId];
    if (!webView) return;
    pauseWebView(webView);
    try {
      webView.injectJavaScript(`
        try {
          if (window.__gametokMuteAll) window.__gametokMuteAll();
          document.querySelectorAll('audio, video').forEach(function(el) {
            try { el.pause(); } catch(e) {}
          });
        } catch(e) {}
        true;
      `);
    } catch {}
  }, [pauseWebView]);

  const resetWebView = useCallback((itemId?: string | null) => {
    if (!itemId) return;
    const webView = webViewRefs.current[itemId];
    if (webView) {
      pauseWebView(webView);
      try {
        webView.stopLoading?.();
      } catch {}
      try {
        webView.injectJavaScript(`
          try {
            if (window.__gametokMuteAll) window.__gametokMuteAll();
            document.querySelectorAll('audio, video').forEach(function(el) {
              try { el.pause(); el.src = ''; el.load && el.load(); } catch(e) {}
            });
            window.location.replace('about:blank');
          } catch(e) {}
          true;
        `);
      } catch {}
    }
    delete webViewRefs.current[itemId];
    setReadyGames(prev => {
      if (!prev.has(itemId)) return prev;
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    setWebViewResetKeys(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));
  }, [pauseWebView]);

  const resetAllWebViews = useCallback(() => {
    Object.keys(webViewRefs.current).forEach(resetWebView);
  }, [resetWebView]);

  const suspendAllWebViews = useCallback(() => {
    Object.keys(webViewRefs.current).forEach(suspendWebView);
  }, [suspendWebView]);

  // Leaving the game deck suspends rather than hard-resets. It used to reset — but this effect
  // fires on the thumbnail tap too (that handler sets isGameDeckActive false), so a hard reset
  // here destroyed the WebView the tap had just suspended, which is the other half of why no
  // paused frame ever showed behind the poster.
  //
  // The hard reset existed because some games keep audio alive through a soft pause. suspend
  // still mutes and pauses all media, and the genuinely destructive exits — app backgrounded,
  // feed unfocused — still call resetAllWebViews below, so a leaking game is still caught there.
  useEffect(() => {
    if (!isGameDeckActive) {
      setInteractedGameId(null);
      suspendAllWebViews();
    }
  }, [isGameDeckActive, suspendAllWebViews]);

  // Listen for AppState changes to unlock broken gestures
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' || state === 'inactive') {
        resetAllWebViews();
        setInteractedGameId(null);
        setIsGameDeckActive(false);
        if (!isAnimating.current) {
          translateY.setValue(0);
        }
        setScrollEnabled(false);
      } else if (state === 'active' && isFocused) {
        // Only resume if the game was already being played (interacted with)
        const currItem = currentIndexRef.current >= 0 ? feedRef.current[currentIndexRef.current] : null;
        if (currItem && webViewRefs.current[currItem.id] && currItem.game?.id === interactedGameId) {
          resumeWebView(webViewRefs.current[currItem.id]);
        }
      }
    });
    return () => sub.remove();
  }, [translateY, isFocused, interactedGameId, resetAllWebViews, resumeWebView, setIsGameDeckActive]);

  // Pause/resume WebViews when focus changes (navigating to/from other tabs)
  useEffect(() => {
    if (!isFocused) {
      // Pause ALL games when leaving the tab
      resetAllWebViews();
      setInteractedGameId(null);

      // Record play time when leaving tab
      if (lastTrackedGameRef.current && gameStartTimeRef.current && user) {
        const playTimeSeconds = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);
        const gameId = lastTrackedGameRef.current;

        if (playTimeSeconds >= 5) {
          console.log(`[Game] Tab unfocused - played ${gameId} for ${playTimeSeconds}s`);
          // Gamification removed
        }
        gameStartTimeRef.current = null;
      }

      // Pause session points interval when leaving tab
      if (sessionPointsIntervalRef.current) {
        clearInterval(sessionPointsIntervalRef.current);
        sessionPointsIntervalRef.current = null;
      }
    } else {
      // CRITICAL: Reset scroll state when coming back to tab
      // This prevents the scroll overlay from being stuck in active state
      setScrollEnabled(false);
      isAnimating.current = false;
      translateY.setValue(0); // Reset any partial swipe animation

      // Resume current game ONLY if it was already being played (interacted with)
      const currItem = currentIndex >= 0 ? feed[currentIndex] : null;
      if (currItem && webViewRefs.current[currItem.id] && currItem.game?.id === interactedGameId) {
        resumeWebView(webViewRefs.current[currItem.id]);
      }

      // Restart play time tracking when coming back
      if (currItem?.game?.id) {
        gameStartTimeRef.current = Date.now();
        lastTrackedGameRef.current = currItem.game.id;

        // Resume session points interval
        if (!sessionPointsIntervalRef.current) {
          sessionPointsIntervalRef.current = setInterval(() => {
            setSessionPoints(prev => prev + 1);
          }, 5000);
        }
      }
    }
  }, [isFocused, resetAllWebViews, resumeWebView, currentIndex, feed, interactedGameId, user]);

  // Pause/resume WebViews when index changes
  useEffect(() => {
    // Don't do anything if tab is not focused
    if (!isFocused) return;

    const prevIdx = prevIndexRef.current;
    const currIdx = currentIndex;

    if (prevIdx !== currIdx) {
      const currItem = currIdx >= 0 ? feed[currIdx] : null;
      const currItemId = currItem?.id;

      // Freeze old/offscreen games. Do not "preload by resuming" because games
      // can start audio before the user taps them.
      Object.entries(webViewRefs.current).forEach(([id, webView]) => {
        if (webView && id !== currItemId) {
          resetWebView(id);
        }
      });

      // If user was actively playing in game deck mode, seamlessly transition to the next game in deck mode
      const wasInGameDeck = isGameDeckActiveRef.current || interactedGameIdRef.current !== null;

      if (wasInGameDeck && currItem?.game?.id) {
        setInteractedGameId(currItem.game.id);
        setIsGameDeckActive(true);
        if (webViewRefs.current[currItem.id]) {
          resumeWebView(webViewRefs.current[currItem.id]);
        }
      } else {
        // When browsing feed thumbnails, reset interaction state
        setIsGameDeckActive(false);
        setInteractedGameId(null);
        if (currIdx >= 0 && currItem && webViewRefs.current[currItem.id]) {
          resetWebView(currItem.id);
        }
      }

      prevIndexRef.current = currIdx;
    }
  }, [currentIndex, feed, isFocused, resetWebView, resumeWebView, setIsGameDeckActive]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (playRecordTimeoutRef.current) {
      clearTimeout(playRecordTimeoutRef.current);
      playRecordTimeoutRef.current = null;
    }

    if (!isFocused) return;
    if (currentIndex < 0) return;

    const currentItem = feed[currentIndex];
    if (!currentItem || !currentItem.game?.id) return;

    const gameId = currentItem.game.id;
    if (playRecordedForSessionRef.current.has(gameId)) return;

    // Count a play only after the user has actually stayed on the game briefly.
    playRecordTimeoutRef.current = setTimeout(() => {
      gamesApi.recordPlay(gameId)
        .then((result) => {
          if (result?.counted === false) {
            return;
          }
          playRecordedForSessionRef.current.add(gameId);
          setFeed((prev) => prev.map((entry) => (
            entry.game?.id === gameId
              ? {
                  ...entry,
                  game: {
                    ...entry.game,
                    plays: (entry.game.plays || 0) + 1,
                  },
                }
              : entry
          )));
        })
        .catch((error) => {
          console.log('[HomeScreen] recordPlay error:', error?.message || error);
        })
        .finally(() => {
          playRecordTimeoutRef.current = null;
        });
    }, 1800);

    return () => {
      if (playRecordTimeoutRef.current) {
        clearTimeout(playRecordTimeoutRef.current);
        playRecordTimeoutRef.current = null;
      }
    };
  }, [currentIndex, feed, isFocused]);

  // Track game play time for gamification
  useEffect(() => {
    const currentItem = currentIndex >= 0 ? feed[currentIndex] : null;
    const currentGameId = currentItem?.game?.id || null;

    // If we switched away from a game, record the play time and save session points
    if (lastTrackedGameRef.current && lastTrackedGameRef.current !== currentGameId && gameStartTimeRef.current && user) {
      const playTimeSeconds = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);
      const gameId = lastTrackedGameRef.current;

      // Save current session points for this game before switching
      gameSessionPointsRef.current[gameId] = sessionPoints;

      // Only track if played for at least 5 seconds
      if (playTimeSeconds >= 5) {
        console.log(`[Game] Played ${gameId} for ${playTimeSeconds}s`);
        // Gamification removed - clear saved session points
        gameSessionPointsRef.current[gameId] = 0;
      }

      gameStartTimeRef.current = null;

      // Clear session points interval when leaving game
      if (sessionPointsIntervalRef.current) {
        clearInterval(sessionPointsIntervalRef.current);
        sessionPointsIntervalRef.current = null;
      }
      // Clear periodic sync interval
      if (periodicSyncIntervalRef.current) {
        clearInterval(periodicSyncIntervalRef.current);
        periodicSyncIntervalRef.current = null;
      }
    }

    // If we're now on a new game, start tracking
    if (currentGameId && currentGameId !== lastTrackedGameRef.current) {
      console.log(`[Gamification] Starting to track game: ${currentGameId}, user: ${user?.id || 'NO USER'}`);
      gameStartTimeRef.current = Date.now();

      // Restore saved session points for this game, or start at 0
      const savedPoints = gameSessionPointsRef.current[currentGameId] || 0;
      setSessionPoints(savedPoints);

      // Start interval to increment points every 5 seconds
      if (sessionPointsIntervalRef.current) {
        clearInterval(sessionPointsIntervalRef.current);
      }
      sessionPointsIntervalRef.current = setInterval(() => {
        setSessionPoints(prev => {
          const newPoints = prev + 1;
          console.log(`[Gamification] Local points: ${newPoints}`);
          // Also update the ref so it persists
          if (currentGameId) {
            gameSessionPointsRef.current[currentGameId] = newPoints;
          }
          return newPoints;
        });
      }, 5000); // +1 point every 5 seconds

      // Start periodic sync interval - sync to backend every 5 seconds
      if (periodicSyncIntervalRef.current) {
        clearInterval(periodicSyncIntervalRef.current);
      }
      periodicSyncIntervalRef.current = setInterval(() => {
        console.log(`[Game] Sync check - gameStartTime: ${gameStartTimeRef.current}, user: ${user?.id || 'NO USER'}, gameId: ${currentGameId}`);
        if (gameStartTimeRef.current && user && currentGameId) {
          const playTimeSeconds = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);
          if (playTimeSeconds >= 5) {
            console.log(`[Game] Syncing ${currentGameId}: ${playTimeSeconds}s played`);
            // Gamification removed
            gameStartTimeRef.current = Date.now();
          }
        }
      }, 5000); // Sync every 5 seconds
    }

    lastTrackedGameRef.current = currentGameId;

    // Cleanup on unmount
    return () => {
      if (sessionPointsIntervalRef.current) {
        clearInterval(sessionPointsIntervalRef.current);
      }
      if (periodicSyncIntervalRef.current) {
        clearInterval(periodicSyncIntervalRef.current);
      }
    };
  }, [currentIndex, feed, user]);

  useEffect(() => {
    feedRef.current = feed;
  }, [feed]);

  useEffect(() => {
    if (!isFocused || currentIndex < 0 || !feed[currentIndex]) {
      clearHudTimers();
      return;
    }

    restoreHud();

    return () => {
      clearHudTimers();
    };
  }, [clearHudTimers, currentIndex, feed, isFocused, restoreHud]);

  useEffect(() => {
    const init = async () => {
      console.log('[HomeScreen] Starting init...');

      // Mark that the app has been launched (kept for legacy analytics/flags if needed)
      const hasLaunchedBefore = await AsyncStorage.getItem('hasLaunchedBefore');
      if (!hasLaunchedBefore) {
        await AsyncStorage.setItem('hasLaunchedBefore', 'true');
      } else {
        // Returning user — skip welcome screen, go straight to games
        setCurrentIndex(0);
      }

      // Fetch games immediately
      console.log('[HomeScreen] Fetching games...');
      try {
        const data = await gamesApi.list(50, 0, { sort: 'discover' });
        console.log('[HomeScreen] Games fetched:', data?.games?.length || 0);
        if (data.games?.length > 0) {
          allGamesRef.current = data.games;
          setFeed(createFeed(data.games));

          // Store initial like and save counts from API
          const likeCnts: { [id: string]: number } = {};
          const saveCnts: { [id: string]: number } = {};
          const shareCnts: { [id: string]: number } = {};
          data.games.forEach((g: any) => {
            likeCnts[g.id] = g.likes || 0;
            saveCnts[g.id] = g.saves || 0;
            shareCnts[g.id] = 0;
          });
          setLikeCounts(likeCnts);
          setSaveCounts(saveCnts);
          setShareCounts(shareCnts);

          // Check which games user has liked (fire and forget)
          const gameIds = data.games.map((g: Game) => g.id);
          likesApi.check(gameIds).then(result => {
            if (result.likedGameIds?.length > 0) {
              setLikedGames(new Set(result.likedGameIds));
            }
          }).catch(() => { });

          // Check which games user has saved (fire and forget)
          savedGamesApi.check(gameIds).then(result => {
            if (result.savedGameIds?.length > 0) {
              setSavedGames(new Set(result.savedGameIds));
            }
          }).catch(() => { });
        }
      } catch (e: any) {
        console.log('[HomeScreen] Games fetch error:', e?.message || e);
        const fallbackGames = [
          { id: 'flappy-bird', name: 'Flappy Bird', likes: 0 },
          { id: 'fruit-slicer', name: 'Fruit Slicer', likes: 0 },
          { id: 'tetris', name: 'Tetris', likes: 0 },
        ];
        allGamesRef.current = fallbackGames;
        setFeed(createFeed(fallbackGames));
      } finally {
        console.log('[HomeScreen] Init complete, setting loading false');
        setLoading(false);
      }
    };
    init();
  }, []);

  // Refresh feed function - reshuffles games and goes back to top
  const refreshFeed = useCallback(async () => {
    console.log('[HomeScreen] Refreshing feed...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // If we have cached games, just reshuffle
    if (allGamesRef.current.length > 0) {
      feedCycleRef.current += 1;
      const newFeed = createFeed(allGamesRef.current, feedCycleRef.current);
      setFeed(newFeed);
      setCurrentIndex(0);
      translateY.setValue(0);
      return;
    }

    // Otherwise fetch fresh
    setLoading(true);
    try {
      const data = await gamesApi.list(50, 0, { sort: 'discover' });
      if (data.games?.length > 0) {
        allGamesRef.current = data.games;
        setFeed(createFeed(data.games));
        setCurrentIndex(0);
        translateY.setValue(0);

        const likeCnts: { [id: string]: number } = {};
        const saveCnts: { [id: string]: number } = {};
        const shareCnts: { [id: string]: number } = {};
        data.games.forEach((g: any) => {
          likeCnts[g.id] = g.likes || 0;
          saveCnts[g.id] = g.saves || 0;
          shareCnts[g.id] = shareCounts[g.id] ?? 0;
        });
        setLikeCounts(likeCnts);
        setSaveCounts(saveCnts);
        setShareCounts(shareCnts);
      }
    } catch (e: any) {
      console.log('[HomeScreen] Refresh error:', e?.message || e);
    } finally {
      setLoading(false);
    }
  }, [shareCounts]);

  // Handle refreshTrigger from parent (home button re-tap)
  const lastRefreshTrigger = useRef(0);
  useEffect(() => {
    if (refreshTrigger > 0 && refreshTrigger !== lastRefreshTrigger.current) {
      lastRefreshTrigger.current = refreshTrigger;
      refreshFeed();
    }
  }, [refreshTrigger, refreshFeed]);

  // Handle deep link - navigate to shared game
  useEffect(() => {
    if (sharedGameId && feed.length > 0 && !loading) {
      console.log('[DeepLink] Looking for game:', sharedGameId);

      // Find the game in the feed
      const gameIndex = feed.findIndex(item =>
        item.game?.id === sharedGameId ||
        item.game?.id?.toLowerCase() === sharedGameId.toLowerCase()
      );

      if (gameIndex !== -1) {
        console.log('[DeepLink] Found game at index:', gameIndex);
        setCurrentIndex(gameIndex);
        clearSharedGame();
      } else {
        // Game not in current feed - try to fetch it and add to front
        console.log('[DeepLink] Game not in feed, fetching...');
        gamesApi.list(100, 0, { sort: 'discover' }).then(data => {
          const game = data.games?.find((g: Game) =>
            g.id === sharedGameId || g.id?.toLowerCase() === sharedGameId.toLowerCase()
          );
          if (game) {
            // Add the shared game to the front of the feed
            const newItem: FeedItem = { game, id: `shared-${game.id}` };
            setFeed(prev => [newItem, ...prev]);
            setCurrentIndex(0);
          }
          clearSharedGame();
        }).catch(() => {
          clearSharedGame();
        });
      }
    }
  }, [sharedGameId, feed.length, loading, clearSharedGame]);

  // Extend feed when nearing the end (infinite scroll) - fetch NEW random games from server
  useEffect(() => {
    const gamesLeft = feed.length - currentIndex;
    if (gamesLeft < 10 && !loading) {
      // Fetch fresh random games from server
      const fetchMoreGames = async () => {
        try {
          const data = await gamesApi.list(50, 0, { sort: 'discover' });
          if (data.games?.length > 0) {
            feedCycleRef.current += 1;
            const cycle = feedCycleRef.current;

            // Use createFeed to maintain ad insertion pattern
            const newItems = createFeed(data.games, cycle);

            setFeed(prev => [...prev, ...newItems]);
          }
        } catch (e) {
          // If fetch fails, just loop existing games
          feedCycleRef.current += 1;
          const cycle = feedCycleRef.current;

          // Use createFeed to maintain ad insertion pattern
          const newItems = createFeed(allGamesRef.current, cycle);

          setFeed(prev => [...prev, ...newItems]);
        }
      };

      fetchMoreGames();
    }
  }, [currentIndex, feed.length, loading]);

  const animateToIndex = (newIndex: number) => {
    if (isAnimating.current) return;
    isAnimating.current = true;

    const direction = newIndex > currentIndexRef.current ? -1 : 1;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Safety timeout — if the animation callback or rAF never fires
    // (e.g. JS thread blocked by heavy WebView mount on iPhone X),
    // force-unlock gestures after 600ms so scrolling doesn't permanently freeze.
    const safetyTimer = setTimeout(() => {
      if (isAnimating.current) {
        console.log('[Feed] Safety timeout: force-unlocking isAnimating');
        translateY.setValue(0);
        isAnimating.current = false;
        setGestureKey(prev => prev + 1);
      }
    }, 600);

    Animated.timing(translateY, {
      toValue: direction * contentHeight,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      // Reset the animated offset before changing the rendered window.
      // Updating currentIndex while translateY is still +/-height causes a
      // one-frame flash where the next stack renders with the old offset.
      clearTimeout(safetyTimer);
      translateY.setValue(0);
      setCurrentIndex(newIndex);

      requestAnimationFrame(() => {
        isAnimating.current = false;
        setGestureKey(prev => prev + 1);
      });
    });
  };

  // Helper function to update translateY value (for runOnJS)
  const updateTranslateY = useCallback((value: number) => {
    translateY.setValue(value);
  }, [translateY]);

  // Helper function to handle gesture end (for runOnJS)
  // Uses both distance and velocity for snappy TikTok-like scrolling
  const handleGestureEnd = useCallback((translationY: number, velocityY?: number) => {
    setScrollEnabled(false);

    if (isAnimating.current) return;

    const idx = currentIndexRef.current;
    const total = feedRef.current.length;
    const vel = velocityY || 0;

    // Trigger scroll if distance OR velocity exceeds threshold
    const swipeUp = translationY < -SWIPE_THRESHOLD || vel < -800;
    const swipeDown = translationY > SWIPE_THRESHOLD || vel > 800;

    if (swipeUp && idx < total - 1) {
      animateToIndex(idx + 1);
    } else if (swipeDown && idx > 0) {
      animateToIndex(idx - 1);
    } else {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
    }
  }, [translateY]);

  // Helper to handle gesture start (for runOnJS)
  const handleGestureStart = useCallback(() => {
    setScrollEnabled(true);
  }, []);

  const touchStartY = useRef(0);

  // Edge pan responder - natively intercepts touches BEFORE they reach the WebView
  // but ONLY if the touch started in the top 15% or bottom 15% and is a swipe.
  // This guarantees taps pass through while scrolling always works.
  const edgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (e) => {
        touchStartY.current = e.nativeEvent.pageY;
        return false; // Let taps pass through
      },
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        // Use EXACT mathematically precise boundaries based on the latest physical rendered height
        // This flawlessly syncs the invisible PanResponder zone to the visible purple box overlay
        const isTopEdge = touchStartY.current < TOP_ZONE_HEIGHT; 
        const isEdge = isTopEdge;
        if (Math.abs(gesture.dy) > 6) restoreHud();
        
        const isVerticalSwipe = Math.abs(gesture.dy) > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
        return isEdge && isVerticalSwipe; // Steal touch if it's an edge swipe
      },
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        const isTopEdge = touchStartY.current < TOP_ZONE_HEIGHT;
        const isEdge = isTopEdge;
        if (Math.abs(gesture.dy) > 6) restoreHud();
        
        const isVerticalSwipe = Math.abs(gesture.dy) > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
        return isEdge && isVerticalSwipe;
      },
      onPanResponderMove: (_, gesture) => {
        if (!isAnimating.current) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isAnimating.current) return;

        const idx = currentIndexRef.current;
        const total = feedRef.current.length;

        const swipeUp = gestureState.dy < -SWIPE_THRESHOLD || gestureState.vy < -0.5;
        const swipeDown = gestureState.dy > SWIPE_THRESHOLD || gestureState.vy > 0.5;

        if (swipeUp && idx < total - 1) {
          animateToIndex(idx + 1);
        } else if (swipeDown && idx > 0) {
          animateToIndex(idx - 1);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (isAnimating.current) return;
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    })
  ).current;

  // Overlay pan responder - captures touches when scroll mode is active
  const overlayPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        restoreHud();
        // Tap disables scroll mode
        setScrollEnabled(false);
        return false; // Don't capture the tap, let it pass through after disabling
      },
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (Math.abs(gesture.dy) > 6) restoreHud();
        return Math.abs(gesture.dy) > 10;
      },
      onPanResponderMove: (_, gesture) => {
        if (!isAnimating.current) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isAnimating.current) return;

        const idx = currentIndexRef.current;
        const total = feedRef.current.length;

        if (gestureState.dy < -SWIPE_THRESHOLD && idx < total - 1) {
          animateToIndex(idx + 1);
        } else if (gestureState.dy > SWIPE_THRESHOLD && idx > -1) {
          animateToIndex(idx - 1);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (isAnimating.current) return;
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    })
  ).current;

  // Full-screen pan responder for Welcome and Ad screens
  // Allows the entire screen to be scrollable but passes taps through
  const fullScreenPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false, // Let taps pass through to buttons
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        if (Math.abs(gesture.dy) > 6) restoreHud();
        return Math.abs(gesture.dy) > 15; // Take over aggressively in capture phase if vertical swipe
      },
      onStartShouldSetPanResponder: () => false, // Let taps pass through to buttons
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (Math.abs(gesture.dy) > 6) restoreHud();
        return Math.abs(gesture.dy) > 15; // Only take over if it's a clear vertical swipe
      },
      onPanResponderMove: (_, gesture) => {
        if (!isAnimating.current) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isAnimating.current) return;

        const idx = currentIndexRef.current;
        const total = feedRef.current.length;

        const swipeUp = gestureState.dy < -SWIPE_THRESHOLD || gestureState.vy < -0.5;
        const swipeDown = gestureState.dy > SWIPE_THRESHOLD || gestureState.vy > 0.5;

        if (swipeUp && idx < total - 1) {
          animateToIndex(idx + 1);
        } else if (swipeDown && idx > 0) {
          animateToIndex(idx - 1);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (isAnimating.current) return;
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    })
  ).current;

  // Keep only the swipe neighbors alive. Each item is a full game WebView,
  // so preloading too far ahead causes home-feed jank on real devices.
  const visibleItems = useMemo(() => {
    const result: { item: FeedItem | null; position: number }[] = [];

    // Previous item (position -1)
    if (currentIndex > 0 && feed[currentIndex - 1]) {
      result.push({ item: feed[currentIndex - 1], position: -1 });
    }

    // Current item (position 0)
    if (feed[currentIndex]) {
      result.push({ item: feed[currentIndex], position: 0 });
    }

    // Next item (position +1)
    if (feed[currentIndex + 1]) {
      result.push({ item: feed[currentIndex + 1], position: 1 });
    }

    return result;
  }, [feed, currentIndex]);

  if (loading) {
    return <View style={styles.container} />;
  }

  if (feed.length === 0) return null;

  const renderedItems = isFocused ? visibleItems : [];

  // The card box is known up front, so hand it to GameSurface rather than making it measure —
  // that way a landscape game is already rotated on its first paint. The rotation itself (and the
  // reasoning behind it) lives in GameSurface, shared with explore.
  const cardBox = { width: windowDims.width, height: contentHeight };

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
      <View style={[styles.gameViewport, { top: insets.top, height: contentHeight }]}>
        {renderedItems.map(({ item, position }) => {
          // Rotate only when the card box is actually portrait. On an iPad already held in
          // landscape the window IS the right shape, so a landscape game plays unrotated — and
          // rotating it there would turn it back into a portrait letterbox.
          const cardIsLandscape = isLandscape(item!.game!.orientation) && windowIsPortrait;
          return (
          <Animated.View
            key={item!.id}
            style={[
              styles.gameContainer,
              {
                height: contentHeight,
                transform: [{
                  translateY: Animated.add(translateY, position * contentHeight)
                }],
                zIndex: position === 0 ? 1 : 0,
              }
            ]}
          >
          {/* Game screen - conditionally allows swipe only if not interacted */}
          <Animated.View {...((item!.game!.id !== interactedGameId || position !== 0) ? fullScreenPanResponder.panHandlers : {})} style={{ flex: 1, backgroundColor: getFeedBackdropColor() }} pointerEvents="box-none" collapsable={false}>
              <Animated.View style={{ flex: 1 }}>
                <GameSurface
                  key={`${item!.id}-webview-${webViewResetKeys[item!.id] || 0}`}
                  orientation={cardIsLandscape ? 'landscape' : 'portrait'}
                  box={cardBox}
                  ref={(ref) => {
                    if (ref) {
                      webViewRefs.current[item!.id] = ref;
                    } else {
                      delete webViewRefs.current[item!.id];
                    }
                  }}
                  source={{ uri: getGameUrl(item!.game!) }}
                  opaque={false} // Crucial for iOS transparent background
                  backgroundColor="transparent" // Crucial for Android transparent background
                  javaScriptEnabled
                  domStorageEnabled
                  cacheEnabled={true}
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  allowsAirPlayForMediaPlayback={false}
                  scrollEnabled={false}
                  bounces={false}
                  overScrollMode="never"
                  nestedScrollEnabled={false}
                  thirdPartyCookiesEnabled={false}
                  sharedCookiesEnabled={false}
                  injectedJavaScriptBeforeContentLoaded={
                    GAME_AUDIO_GUARD_SCRIPT
                    + MEDIA_SESSION_GUARD_SCRIPT
                    // The edge-zone blocker is portrait-only — see EDGE_BLOCK_SCRIPT.
                    + (cardIsLandscape ? '' : EDGE_BLOCK_SCRIPT)
                    + buildHudInteractionBridgeScript(cardIsLandscape ? 'landscape' : 'portrait')
                  }
                  onMessage={async (event) => {
                    try {
                      const data = JSON.parse(event.nativeEvent.data);
                      if (data.type === 'USER_INTERACTION') {
                        setIsGameDeckActive(true);
                        return;
                      }
                      if (data.type === 'USER_SWIPE_INTENT') {
                        restoreHud();
                        return;
                      }
                      if (data.type === 'CLOUD_SAVE' && user) {
                        try {
                          await gameProgress.save(data.gameId, data.storageData);
                          console.log('[CloudSave] Saved progress for', data.gameId);
                        } catch (e) {
                          console.log('[CloudSave] Failed to save:', e);
                        }
                      }
                    } catch (e) {
                      // Ignore non-JSON messages
                    }
                  }}
                  javaScriptCanOpenWindowsAutomatically={false}
                  setSupportMultipleWindows={false}
                  onLoadEnd={async () => {
                    // Only animate the visible game's loading state. Preloaded
                    // neighbors should not run hidden loading animations.
                    if (position === 0) {
                      setTimeout(() => {
                        setReadyGames(prev => {
                          if (prev.has(item!.id)) return prev;
                          const next = new Set(prev);
                          next.add(item!.id);
                          return next;
                        });
                      }, 3000);
                    } else {
                      setReadyGames(prev => {
                        if (prev.has(item!.id)) return prev;
                        const next = new Set(prev);
                        next.add(item!.id);
                        return next;
                      });
                    }

                    if (isExternalGame(item!.game!) && user && item!.game?.id) {
                      try {
                        if (!loadedProgressRef.current[item!.game!.id]) {
                          const result = await gameProgress.get(item!.game!.id);
                          loadedProgressRef.current[item!.game!.id] = result.storageData || {};
                        }
                        const savedData = loadedProgressRef.current[item!.game!.id];
                        webViewRefs.current[item!.id]?.injectJavaScript(createCloudSaveScript(item!.game!.id, savedData));
                      } catch (e) {
                        webViewRefs.current[item!.id]?.injectJavaScript(createCloudSaveScript(item!.game!.id, {}));
                      }
                    }

                    // CRITICAL: Only resume if the game has been interacted with (thumbnail tapped)
                    // Otherwise, keep it paused so it doesn't play in the background
                    const shouldResume = position === 0 && currentIndexRef.current >= 0 && isFocused && item!.game!.id === interactedGameId;
                    if (shouldResume) {
                      resumeWebView(webViewRefs.current[item!.id]);
                    } else {
                      pauseWebView(webViewRefs.current[item!.id]);
                    }
                  }}
                  onLoad={() => {
                    // CRITICAL: Only resume if the game has been interacted with (thumbnail tapped)
                    // Otherwise, keep it paused so it doesn't play in the background
                    const shouldResume = position === 0 && currentIndex !== -1 && isFocused && item!.game!.id === interactedGameId;
                    if (!shouldResume && webViewRefs.current[item!.id]) {
                      pauseWebView(webViewRefs.current[item!.id]);
                    }
                  }}
                  onShouldStartLoadWithRequest={(request) => {
                    return true;
                  }}
                />
              </Animated.View>

              {/* Native gesture zones intercept handled earlier via Animated.View pointerEvents box-none */}

                {/* Thumbnail Overlay - always rendered, opacity-controlled to prevent blink on skip */}
                {item!.game && (
                  <View 
                    // Hold the poster until the game has actually finished loading, not merely
                    // until it was tapped. `readyGames` was already being tracked (and given a 15s
                    // safety net) but never read by anything, so the cover art dropped the instant
                    // you tapped and you stared at an empty WebView until the game painted.
                    // Deliberately the thumbnail and not explore's GameLoadingScreen: a branded
                    // loading card has no place mid-scroll in the feed.
                    style={[StyleSheet.absoluteFill, { zIndex: 5, justifyContent: 'center', alignItems: 'center', opacity: (item!.game!.id !== interactedGameId || position !== 0 || !readyGames.has(item!.id)) ? 1 : 0 }]}
                    pointerEvents={(item!.game!.id !== interactedGameId || position !== 0) ? 'auto' : 'none'}
                    onStartShouldSetResponder={() => (item!.game!.id !== interactedGameId || position !== 0)}
                    onResponderRelease={() => {
                      if (position === 0) {
                        if (item!.game!.id === interactedGameId) {
                          // Tapping the thumbnail while playing SUSPENDS the game — it stays
                          // mounted and its last frame keeps rendering behind the poster. It used
                          // to call resetWebView, which bumps the React key and destroys the
                          // WebView, so the game restarted from the network every time and there
                          // was nothing behind the thumbnail but the backdrop colour.
                          setInteractedGameId(null);
                          setIsGameDeckActive(false);
                          suspendWebView(item!.id);
                        } else {
                          // Tapping thumbnail to start game
                          setInteractedGameId(item!.game!.id);
                          setIsGameDeckActive(true);
                          // Resume the game
                          resumeWebView(webViewRefs.current[item!.id]);
                        }
                      }
                    }}
                  >
                    {/* The crisp thumbnail card floating on top. Deliberately NOT rotated for
                        landscape games: this overlay is only ever shown in the browse state (the
                        tap handler above resets the WebView rather than pausing it), and browsing
                        happens with the phone upright. Only the game itself rotates — sideways
                        content is its own instruction to turn the phone. */}
                    <View style={styles.thumbnailCardContainer}>
                      <View style={styles.thumbnailCardInner}>
                        <Image 
                          source={{ uri: getThumbnailUrl(item!.game) }} 
                          style={styles.thumbnailCardImage} 
                        />
                        <View style={styles.thumbnailCardPlayPill}>
                          <Ionicons
                            name={item!.game!.id === interactedGameId && position === 0 ? "reload-circle" : "play"}
                            size={12}
                            color="#fff"
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* TikTok-style action buttons - right side - animated slide.
                    Hidden on landscape cards: this rail is positioned with portrait-relative
                    safe-area insets, so rotating it would land it on the wrong physical edge, and
                    leaving it un-rotated would print it sideways across the game. Like/comment/
                    remix stay reachable from the (rotated) pause overlay above. */}
                {!cardIsLandscape && (
                  <Animated.View style={[styles.actionButtons, { bottom: 64, transform: [{ translateY: actionButtonsTranslateY }], opacity: actionButtonsTranslateY.interpolate({ inputRange: [0, 120], outputRange: [1, 0] }) }]}>
                    <AnimatedLikeButton
                      isLiked={likedGames.has(item!.game!.id)}
                      onPress={(e) => {
                        triggerClickAnimation(e);
                        handleLike(item!.game!.id);
                      }}
                      likeCount={getFeedCount(item!.game!.id, 'likes')}
                      styles={styles}
                    />
                    <AnimatedCommentButton
                      onPress={(e) => {
                        triggerClickAnimation(e);
                        handleOpenComments(item!.game!);
                      }}
                      commentCount={0}
                      styles={styles}
                    />
                    {/* Share */}
                    <AnimatedShareButton
                      onPress={(e) => {
                        triggerClickAnimation(e);
                        handleShare(item!.game!);
                      }}
                      shareCount={getFeedCount(item!.game!.id, 'shares')}
                      styles={styles}
                    />
                    {/* Remix */}
                    <TouchableOpacity
                      style={styles.actionButton}
                      activeOpacity={0.9}
                      onPress={(e) => {
                        triggerClickAnimation(e);
                        handleRemix(item!.game!);
                      }}
                    >
                      <Ionicons name="git-branch" size={30} color={LoopsColors.white} />
                      <Text style={styles.actionCount}>Remix</Text>
                    </TouchableOpacity>
                  </Animated.View>
                )}

                {/* Game info - bottom left (V2 mockup-faithful) - animated fade.
                    Hidden on landscape cards for the same inset reason as the action rail. */}
                {!cardIsLandscape && (
                  <Animated.View style={[styles.gameInfo, { opacity: overlayInfoOpacity }]} pointerEvents="box-none">
                    <View style={styles.gameTitleRow}>
                      <Text style={styles.gameName} numberOfLines={2}>
                        {item!.game!.name}
                      </Text>
                      <View style={styles.gameTitlePill}>
                        <Ionicons name="game-controller" size={12} color="#fff" />
                      </View>
                    </View>
                    {!!item!.game!.creatorDisplayName && (
                      <View style={styles.creatorRow}>
                        <View style={styles.creatorAvatarWrap}>
                          <Pressable
                            style={styles.creatorAvatarPressable}
                            onPress={() => handleOpenCreatorProfile(item!.game!)}
                          >
                            <Avatar
                              uri={item!.game!.creatorAvatar || null}
                              userId={
                                item!.game!.creatorId ||
                                item!.game!.creatorUsername ||
                                item!.game!.creatorDisplayName ||
                                item!.game!.id
                              }
                              size={50}
                            />
                          </Pressable>
                          {(item!.game!.creatorId || item!.game!.creatorUsername) &&
                            item!.game!.creatorId !== user?.id &&
                            (
                              !isCreatorFollowed(followingCreatorIds, item!.game!) ||
                              followSuccessIds.has(getCreatorFollowKey(item!.game!))
                            ) && (
                              <AnimatedFollowBadge
                                loading={followingLoadingIds.has(getCreatorFollowKey(item!.game!))}
                                followed={followSuccessIds.has(getCreatorFollowKey(item!.game!))}
                                disabled={
                                  followingLoadingIds.has(getCreatorFollowKey(item!.game!)) ||
                                  followSuccessIds.has(getCreatorFollowKey(item!.game!))
                                }
                                onPress={() => handleFollowCreator(item!.game!.creatorId, item!.game!.creatorUsername)}
                                styles={styles}
                              />
                            )}
                        </View>
                        <Pressable
                          style={styles.creatorNameWrap}
                          onPress={() => handleOpenCreatorProfile(item!.game!)}
                        >
                          <Text style={styles.creatorDisplayName} numberOfLines={1}>
                            {item!.game!.creatorDisplayName || item!.game!.creatorUsername}
                          </Text>
                          {item!.game!.creatorVerified ? (
                            <View style={styles.verifiedDot}>
                              <MaterialIcons name="verified" size={18} color="#a855f7" />
                            </View>
                          ) : null}
                        </Pressable>
                      </View>
                    )}
                    {!!item!.game!.remixedFrom && (
                      <View style={styles.remixCreditRow}>
                        <Ionicons name="git-branch" size={11} color="rgba(255,255,255,0.75)" />
                        <Text style={styles.remixCreditText} numberOfLines={1}>
                          Remixed from @{item!.game!.remixedFrom}
                        </Text>
                      </View>
                    )}
                  </Animated.View>
                )}
            </Animated.View>
          </Animated.View>
          );
        })}
      </View>

      {/* V2 Top bar (mockup): gametok / search - animated fade */}
        <Animated.View
          style={[styles.topBarV2, { paddingTop: insets.top + 8, opacity: overlayInfoOpacity }]}
          pointerEvents={isGameDeckActive ? 'none' : 'box-none'}
        >
          <View style={styles.topBarV2Row}>
            <View style={styles.topBarV2Side} />
            <View style={styles.topBarV2Center}>
              <TouchableOpacity
                onPress={refreshFeed}
                activeOpacity={0.85}
                style={styles.forYouV2Pill}
              >
                <Text style={[styles.forYouV2Text, { marginRight: 4 }]}>For You</Text>
                <View style={styles.forYouV2Dot} />
              </TouchableOpacity>
            </View>
            <View style={[styles.topBarV2Side, { alignItems: 'flex-end' }]}>
              <TouchableOpacity
                style={styles.topV2IconBtn}
                onPress={() => setSearchModalVisible(true)}
                activeOpacity={0.85}
                hitSlop={6}
              >
                <Ionicons name="search" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

      {/* Scroll overlay - only visible when scroll mode is active */}
      {scrollEnabled && (
        <View
          style={styles.scrollOverlay}
          {...overlayPanResponder.panHandlers}
        />
      )}

      {/* Overlay gesture zones removed - scrolling is handled completely by PanResponders now */}


      </View>

      {/* Share Sheet */}
      <ShareSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        gameId={shareGameId}
        gameName={shareGameName}
        onSendToFriend={handleSendToFriend}
      />

      <RemixModal
        visible={!!remixTarget}
        gameName={remixTarget?.name}
        gameThumbnail={remixTarget ? getThumbnailUrl(remixTarget) : null}
        loading={remixLoading}
        onCancel={() => { if (!remixLoading) setRemixTarget(null); }}
        onConfirm={confirmRemix}
      />

      <CommentsModal
        visible={showComments}
        onClose={() => setShowComments(false)}
        gameId={commentGameId}
        gameName={commentGameName}
      />

      {/* Leaderboard Modal */}
      <LeaderboardModal
        visible={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        gameId={leaderboardGameId}
        gameName={leaderboardGameName}
        currentUser={user ? {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
        } : null}
        sessionPoints={sessionPoints}
        sessionPlayTime={gameStartTimeRef.current ? Math.floor((Date.now() - gameStartTimeRef.current) / 1000) : 0}
      />

      <UserProfileModal
        visible={!!selectedProfileUser}
        onClose={() => setSelectedProfileUser(null)}
        user={selectedProfileUser}
        onFriendStatusChange={(creatorId, isFollowing) => {
          setFollowingCreatorIds(prev => {
            const next = new Set(prev);
            const creatorIdKey = normalizeFollowKey(creatorId);
            const usernameKey = normalizeFollowKey(selectedProfileUser?.username);
            if (isFollowing) {
              if (creatorIdKey) next.add(creatorIdKey);
              if (usernameKey) next.add(usernameKey);
            } else {
              if (creatorIdKey) next.delete(creatorIdKey);
              if (usernameKey) next.delete(usernameKey);
            }
            return next;
          });
        }}
      />

      {/* Click animations overlay */}
      {clickAnimations.map(anim => (
        <View
          key={anim.id}
          style={{
            position: 'absolute',
            left: anim.x - 50,
            top: anim.y - 50,
            width: 100,
            height: 100,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          <Image
            source={LoopsAnimations.clickEffect}
            style={{ width: 100, height: 100 }}
            resizeMode="contain"
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LoopsColors.black, // Fallback for loading state
  },
  // ── V2 mockup top bar ────────────────────────────────────────────
  topBarV2: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
    paddingHorizontal: 14,
  },
  topBarV2Row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarV2Side: {
    flex: 1,
  },
  topBarV2Center: {
    alignItems: 'center',
  },
  gametokLogoV2: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  topV2IconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forYouV2Wrap: {
    alignItems: 'center',
    marginTop: 14,
  },
  forYouV2Pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 118,
    height: 43,
    justifyContent: 'center',
    paddingHorizontal: 19,
    borderRadius: 999,
    backgroundColor: 'rgba(8,8,10,0.62)',
    borderWidth: 1.25,
    borderColor: 'rgba(255,255,255,0.13)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  forYouV2Dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ff2f92',
    shadowColor: '#ff2f92',
    shadowOpacity: 0.85,
    shadowRadius: 6,
  },
  forYouV2Text: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10000,
  },
  headerRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feedModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.45)',
  },
  feedModeDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#a855f7',
    marginRight: 8,
    shadowColor: '#a855f7',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  forYouText: {
    color: LoopsColors.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  gameViewport: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: getFeedBackdropColor(),
  },
  gameContainer: {
    // Belt-and-braces for Android: the rotation math already lands the WebView exactly on the card
    // box, but a hardware-layer child under a transform is not reliably clipped without this.
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent', // Let blurred thumbnail show through
  },
  scrollOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 5,
  },

  topZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TOP_ZONE_HEIGHT,
    backgroundColor: 'transparent',
    zIndex: 9999,
    elevation: 9999,
  },






  errorContainer: {
    flex: 1,
    backgroundColor: LoopsColors.black, // Match GameLoadingScreen background
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  actionButtons: {
    position: 'absolute',
    right: 8,
    bottom: 24,
    alignItems: 'center',
    zIndex: 10,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 18,
  },
  actionCount: {
    color: LoopsColors.white,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  gameInfo: {
    position: 'absolute',
    left: 14,
    bottom: 100,
    right: 80,
    zIndex: 10,
  },
  gameTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  gameTitlePill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#a855f7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a855f7',
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  gameNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  creatorAvatarWrap: {
    position: 'relative',
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarPressable: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorFollowBadgeWrap: {
    position: 'absolute',
    right: -3,
    bottom: -4,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorFollowPulse: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 45, 85, 0.35)',
  },
  creatorFollowBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ff2d55',
    borderWidth: 2,
    borderColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff2d55',
    shadowOpacity: 0.65,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  creatorFollowBadgeDone: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
  },
  creatorNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    paddingTop: 2,
  },
  remixCreditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  remixCreditText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
  },
  creatorAvatarBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  creatorAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarInitial: {
    color: LoopsColors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  creatorDisplayName: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    flexShrink: 1,
  },
  verifiedDot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedCheck: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    marginTop: -1,
  },
  gameName: {
    color: LoopsColors.white,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    flexShrink: 1,
  },
  gameBadge: {
    backgroundColor: 'rgba(168,85,247,0.85)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  gameMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  gameMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  gameMetaPillAccent: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderColor: 'rgba(168,85,247,0.4)',
  },
  gameMetaText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  thumbnailBgBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  thumbnailOverlayDarken: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 25, 0.7)',
  },
  thumbnailCardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '75%', // Narrower to match competitor
    maxWidth: 360,
    zIndex: 10,
    marginTop: 60, // Push down from center to match competitor positioning
  },
  thumbnailCardInner: {
    width: '100%',
    aspectRatio: 0.72, // Taller card like competitor
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  thumbnailCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailCardPlayPill: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  thumbnailCardPlayText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
});
