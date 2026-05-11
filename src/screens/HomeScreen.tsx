import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, PanResponder, Animated, TouchableOpacity, Pressable, Image, ImageBackground, Easing, ActivityIndicator, AppState, Alert } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { WebView as WebViewType } from 'react-native-webview';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, G } from 'react-native-svg';
import { API_URL, games as gamesApi, likes as likesApi, savedGames as savedGamesApi, messages, gameProgress } from '../services/api';
import { ShareSheet } from '../components/ShareSheet';
import { LeaderboardModal } from '../components/LeaderboardModal';
import { GameLoadingScreen } from '../components/GameLoadingScreen';
import { OnboardingOverlay } from '../components/OnboardingOverlay';
import { CommentsModal } from '../components/CommentsModal';
import { useDeepLink, useNavigation } from '../../App';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { resolveGameThumbnail } from '../utils/thumbnails';
import { LoopsColors, SemanticColors } from '../constants/LoopsColors';
import { LoopsAnimations } from '../constants/LoopsAnimations';


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
  creatorDisplayName?: string | null;
  creatorUsername?: string | null;
  creatorVerified?: boolean;
  creatorAvatar?: string | null;
}

// Feed contains games
interface FeedItem {
  game?: Game;
  id: string;
}

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

  const muteMedia = function() {
    try {
      document.querySelectorAll('audio, video').forEach(function(el) {
        try {
          el.muted = true;
          el.volume = 0;
          if (!window._gametokActive) el.pause();
        } catch (e) {}
      });
    } catch (e) {}
  };

  try {
    if (navigator.mediaSession) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  } catch (e) {}

  const NativeAudio = window.Audio;
  if (NativeAudio && !NativeAudio.__gametokWrapped) {
    const WrappedAudio = function(src) {
      const audio = new NativeAudio(src);
      audio.muted = true;
      audio.volume = 0;
      const nativePlay = audio.play ? audio.play.bind(audio) : null;
      if (nativePlay) {
        audio.play = function() {
          if (!window._gametokActive || window._gametokMuted) {
            audio.muted = true;
            audio.volume = 0;
            return Promise.resolve();
          }
          return nativePlay();
        };
      }
      return audio;
    };
    WrappedAudio.prototype = NativeAudio.prototype;
    WrappedAudio.__gametokWrapped = true;
    window.Audio = WrappedAudio;
  }

  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (NativeAudioContext && !NativeAudioContext.__gametokWrapped) {
    const WrappedAudioContext = function() {
      const ctx = new NativeAudioContext();
      window._audioContexts.push(ctx);
      if (!window._gametokActive || window._gametokMuted) {
        try { ctx.suspend(); } catch (e) {}
      }
      return ctx;
    };
    WrappedAudioContext.prototype = NativeAudioContext.prototype;
    WrappedAudioContext.__gametokWrapped = true;
    window.AudioContext = WrappedAudioContext;
    window.webkitAudioContext = WrappedAudioContext;
  }

  if (window.HTMLMediaElement && window.HTMLMediaElement.prototype && !window.HTMLMediaElement.prototype.__gametokPlayWrapped) {
    const nativeMediaPlay = window.HTMLMediaElement.prototype.play;
    window.HTMLMediaElement.prototype.play = function() {
      if (!window._gametokActive || window._gametokMuted) {
        try {
          this.muted = true;
          this.volume = 0;
          this.pause();
        } catch (e) {}
        return Promise.resolve();
      }
      return nativeMediaPlay.apply(this, arguments);
    };
    window.HTMLMediaElement.prototype.__gametokPlayWrapped = true;
  }

  const installObserver = function() {
    muteMedia();
    if (!window._gametokMediaObserver && document.body) {
      window._gametokMediaObserver = new MutationObserver(muteMedia);
      window._gametokMediaObserver.observe(document.body, { childList: true, subtree: true });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installObserver, { once: true });
  } else {
    installObserver();
  }
})();
true;
`;


// Script to pause/freeze a game
const PAUSE_SCRIPT = `
(function() {
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

// Script for the immediate next game: let it paint/warm up, but keep it silent.
const PRELOAD_SCRIPT = `
(function() {
  window._gamePaused = false;
  window._gametokActive = false;
  window._gametokMuted = true;

  if (window._origRAF) {
    window.requestAnimationFrame = window._origRAF;
    window._rafQueue && window._rafQueue.forEach(cb => window._origRAF(cb));
    window._rafQueue = [];
  }

  if (window.createjs && window.createjs.Ticker) {
    try { window.createjs.Ticker.paused = false; } catch(e) {}
  }
  if (window.Phaser && window.Phaser.GAMES) {
    window.Phaser.GAMES.forEach(g => {
      try { g.scene && g.scene.resume && g.scene.resume(); } catch(e) {}
      try { if (g.sound) g.sound.mute = true; } catch(e) {}
    });
  }

  const muteOnly = () => {
    document.querySelectorAll('audio, video').forEach(el => {
      try {
        el.pause();
        el.muted = true;
        el.volume = 0;
      } catch(e) {}
    });
    if (window._audioContexts) {
      window._audioContexts.forEach(ctx => {
        try { ctx.suspend(); } catch(e) {}
      });
    }
    if (window._allGainNodes) {
      window._allGainNodes.forEach(gain => {
        try { gain.gain.setValueAtTime(0, gain.context.currentTime); } catch(e) {}
      });
    }
    if (window.Howler) {
      try { window.Howler.mute(true); } catch(e) {}
    }
    if (window.createjs && window.createjs.Sound) {
      try { window.createjs.Sound.muted = true; } catch(e) {}
    }
  };

  muteOnly();
  if (!window._muteInterval) {
    window._muteInterval = setInterval(muteOnly, 2500);
  }
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
})();
true;
`;

// Edge blocking script - prevents WebView from capturing swipe gestures at screen edges
// This is injected into ALL games (both internal and external)
// NOTE: We only use event listeners, NOT div blockers, because:
// 1. Native gesture zones handle the actual swipe detection
// 2. Div blockers with pointer-events:auto could interfere with native touch handling
// 3. Event listeners just stop propagation within the WebView, letting native handle it
const EDGE_BLOCK_SCRIPT = `
(function() {
  // Prevent iOS Now Playing widget
  if (navigator.mediaSession) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.playbackState = 'none';
  }
  try { Object.defineProperty(navigator, 'mediaSession', { get: function() { return { metadata: null, setActionHandler: function(){}, playbackState: 'none', setPositionState: function(){} }; }, configurable: true }); } catch(e) {}

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

const HUD_INTERACTION_BRIDGE_SCRIPT = `
(function() {
  if (window._hudInteractionBridgeActive) return;
  window._hudInteractionBridgeActive = true;

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
    if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx)) {
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

// Animated Welcome Screen Component
const WelcomeScreen: React.FC<{ contentHeight: number }> = ({ contentHeight }) => {
  // Animation values
  const glowPulse = useRef(new Animated.Value(0.4)).current;
  const chevron1Y = useRef(new Animated.Value(0)).current;
  const chevron2Y = useRef(new Animated.Value(0)).current;
  const chevron3Y = useRef(new Animated.Value(0)).current;
  const chevronOpacity = useRef(new Animated.Value(0.5)).current;
  const barWidth = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Neon glow pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.4,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Chevron bounce animations (staggered wave)
    const bounceChevron = (anim: Animated.Value, delay: number) => {
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: -8,
              duration: 600,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 600,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
          ])
        ).start();
      }, delay);
    };

    bounceChevron(chevron1Y, 0);
    bounceChevron(chevron2Y, 200);
    bounceChevron(chevron3Y, 400);

    // Chevron opacity pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(chevronOpacity, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(chevronOpacity, {
          toValue: 0.5,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Bar width pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(barWidth, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(barWidth, {
          toValue: 0.6,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={welcomeStyles.container}>
      <Image
        source={require('../../assets/gametok_bg.png')}
        style={[welcomeStyles.backgroundImage, { height: contentHeight }]}
        resizeMode="cover"
      />

      {/* Logo and title in center */}
      <View style={welcomeStyles.brandingContainer}>
        <Image
          source={require('../../assets/icon.png')}
          style={welcomeStyles.logo}
          resizeMode="contain"
        />
        <Text style={welcomeStyles.title}>GameTOK</Text>
      </View>

      {/* Tagline above bottom zone */}
      <Text style={welcomeStyles.tagline}>Swipe. Play. Repeat.</Text>
    </View>
  );
};

const welcomeStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.bgDark,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
  },

  brandingContainer: {
    position: 'absolute',
    top: 0,
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 28,
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
    textShadowColor: '#00f5ff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  tagline: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    letterSpacing: 2,
  },


  glowBarContainer: {
    width: 200,
    height: 4,
    marginBottom: 20,
    alignItems: 'center',
  },
  glowBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
  },
  glowBarBlur: {
    position: 'absolute',
    width: '100%',
    height: 12,
    borderRadius: 6,
    opacity: 0.5,
    top: -4,
  },
  chevronsContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },


});

// Animated Game Loading Component - Glowing geometric shapes
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
  const { setActiveTab: setRootActiveTab, setSearchModalVisible, setIsGameDeckActive, isGameDeckActive, isHudHidden, setIsHudHidden, gameRestartTrigger, gameSkipCounter } = useNavigation();
  const { user } = useAuth();
  const { setMyStatus } = useSocket();
  const isFocused = isActive; // Use the prop instead of navigation hook
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [interactedGameId, setInteractedGameId] = useState<string | null>(null);

  useEffect(() => {
    setIsGameDeckActive(false);
  }, [currentIndex, setIsGameDeckActive]);

  // Restore thumbnail state when user exits Game Deck by pressing "Home"
  useEffect(() => {
    if (!isGameDeckActive) {
      setInteractedGameId(null);
    }
  }, [isGameDeckActive]);

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

  // Calculate actual content height (screen minus tab bar)
  const contentHeight = SCREEN_HEIGHT - TAB_BAR_HEIGHT - insets.bottom;
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

  // Listen for AppState changes to unlock broken gestures
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' || state === 'inactive') {
        Object.values(webViewRefs.current).forEach(webView => {
          webView?.injectJavaScript(PAUSE_SCRIPT);
        });
        if (!isAnimating.current) {
          translateY.setValue(0);
        }
        setScrollEnabled(false);
      } else if (state === 'active' && isFocused) {
        const currItem = currentIndexRef.current >= 0 ? feedRef.current[currentIndexRef.current] : null;
        if (currItem && webViewRefs.current[currItem.id]) {
          webViewRefs.current[currItem.id]?.injectJavaScript(RESUME_SCRIPT);
        }
      }
    });
    return () => sub.remove();
  }, [translateY, isFocused]);
  const isAnimating = useRef(false);
  const webViewRefs = useRef<{ [key: string]: WebViewType | null }>({});
  const prevIndexRef = useRef(-1); // Start at -1 to match initial currentIndex

  // Pause/resume WebViews when focus changes (navigating to/from other tabs)
  useEffect(() => {
    if (!isFocused) {
      // Pause ALL games when leaving the tab
      Object.values(webViewRefs.current).forEach(webView => {
        if (webView) {
          webView.injectJavaScript(PAUSE_SCRIPT);
        }
      });

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

      // Resume current game when coming back to the tab
      const currItem = currentIndex >= 0 ? feed[currentIndex] : null;
      if (currItem && webViewRefs.current[currItem.id]) {
        webViewRefs.current[currItem.id]?.injectJavaScript(RESUME_SCRIPT);
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
  }, [isFocused]);

  // Pause/resume WebViews when index changes
  useEffect(() => {
    // Don't do anything if tab is not focused
    if (!isFocused) return;

    const prevIdx = prevIndexRef.current;
    const currIdx = currentIndex;

    if (prevIdx !== currIdx) {
      const currItem = currIdx >= 0 ? feed[currIdx] : null;
      const currItemId = currItem?.id;

      const nextItem = currIdx === -1 ? feed[0] : feed[currIdx + 1];
      const nextItemId = nextItem?.id;

      // Freeze old/offscreen games, but let the immediate next game render silently.
      Object.entries(webViewRefs.current).forEach(([id, webView]) => {
        if (webView && id !== currItemId) {
          webView.injectJavaScript(id === nextItemId ? PRELOAD_SCRIPT : PAUSE_SCRIPT);
        }
      });

      // When swiping to a new game, reset interaction state to show thumbnail
      setIsGameDeckActive(false);
      setInteractedGameId(null);

      // Pause the current game initially - it will resume when user taps thumbnail
      if (currIdx >= 0 && currItem && webViewRefs.current[currItem.id]) {
        webViewRefs.current[currItem.id]?.injectJavaScript(PAUSE_SCRIPT);
      }

      prevIndexRef.current = currIdx;
    }
  }, [currentIndex, feed, isFocused]);

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

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
      {renderedItems.map(({ item, position }) => (
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
                <WebView
                  ref={(ref) => {
                    if (ref) {
                      webViewRefs.current[item!.id] = ref;
                    } else {
                      delete webViewRefs.current[item!.id];
                    }
                  }}
                  source={{ uri: getGameUrl(item!.game!) }}
                  style={styles.webview} // Already has backgroundColor: 'transparent'
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
                  injectedJavaScriptBeforeContentLoaded={GAME_AUDIO_GUARD_SCRIPT + EDGE_BLOCK_SCRIPT + HUD_INTERACTION_BRIDGE_SCRIPT}
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

                    const shouldResume = position === 0 && currentIndexRef.current >= 0 && isFocused;
                    webViewRefs.current[item!.id]?.injectJavaScript(
                      shouldResume ? RESUME_SCRIPT : position === 1 ? PRELOAD_SCRIPT : PAUSE_SCRIPT
                    );
                  }}
                  onLoad={() => {
                    const shouldResume = position === 0 && currentIndex !== -1 && isFocused;
                    if (!shouldResume && webViewRefs.current[item!.id]) {
                      webViewRefs.current[item!.id]?.injectJavaScript(position === 1 ? PRELOAD_SCRIPT : PAUSE_SCRIPT);
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
                    style={[StyleSheet.absoluteFill, { zIndex: 5, justifyContent: 'center', alignItems: 'center', opacity: (item!.game!.id !== interactedGameId || position !== 0) ? 1 : 0 }]} 
                    pointerEvents={(item!.game!.id !== interactedGameId || position !== 0) ? 'auto' : 'none'}
                    onStartShouldSetResponder={() => (item!.game!.id !== interactedGameId || position !== 0)}
                    onResponderRelease={() => {
                      if (position === 0) {
                        if (item!.game!.id === interactedGameId) {
                          // Tapping thumbnail while game is playing - reset to show thumbnail
                          setInteractedGameId(null);
                          setIsGameDeckActive(false);
                          // Pause the game
                          webViewRefs.current[item!.id]?.injectJavaScript(PAUSE_SCRIPT);
                        } else {
                          // Tapping thumbnail to start game
                          setInteractedGameId(item!.game!.id);
                          setIsGameDeckActive(true);
                          // Resume the game
                          webViewRefs.current[item!.id]?.injectJavaScript(RESUME_SCRIPT);
                        }
                      }
                    }}
                  >
                    {/* The crisp thumbnail card floating on top */}
                    <View style={styles.thumbnailCardContainer}>
                      <View style={styles.thumbnailCardInner}>
                        <Image 
                          source={{ uri: getThumbnailUrl(item!.game) }} 
                          style={styles.thumbnailCardImage} 
                        />
                        <View style={styles.thumbnailCardPlayPill}>
                          <Ionicons 
                            name={item!.game!.id === interactedGameId && position === 0 ? "reload" : "play"} 
                            size={12} 
                            color="#fff" 
                          />
                          <Text style={styles.thumbnailCardPlayText}>
                            {formatCount(item!.game.plays || 0)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* TikTok-style action buttons - right side - animated slide */}
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
                  </Animated.View>

                {/* Game info - bottom left (V2 mockup-faithful) - animated fade */}
                  <Animated.View style={[styles.gameInfo, { opacity: overlayInfoOpacity }]} pointerEvents="none">
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
                        <Text style={styles.creatorDisplayName} numberOfLines={1}>
                          {item!.game!.creatorDisplayName || item!.game!.creatorUsername}
                        </Text>
                        {item!.game!.creatorVerified ? (
                          <View style={styles.verifiedDot}>
                            <Text style={styles.verifiedCheck}>✓</Text>
                          </View>
                        ) : null}
                      </View>
                    )}
                    <View style={styles.gameMetaRow}>
                      <View style={styles.gameMetaPill}>
                        <Ionicons name="play" size={11} color="rgba(255,255,255,0.85)" />
                        <Text style={styles.gameMetaText}>
                          {formatCount(item!.game!.plays || 0)} plays
                        </Text>
                      </View>
                    </View>
                  </Animated.View>
            </Animated.View>
        </Animated.View>
      ))}

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
  gameContainer: {
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
    gap: 8,
    marginBottom: 8,
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
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#a855f7',
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
