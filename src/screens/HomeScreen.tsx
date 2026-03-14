import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, PanResponder, Animated, TouchableOpacity, Image, ImageBackground, Easing, ActivityIndicator, AppState, Alert } from 'react-native';
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
import { games as gamesApi, likes as likesApi, savedGames as savedGamesApi, messages, gameProgress, gamification } from '../services/api';
import { getAdFrequency, initializeAds } from '../services/ads';
import { ShareSheet } from '../components/ShareSheet';
import { CommentsSheet } from '../components/CommentsSheet';
import { LeaderboardModal } from '../components/LeaderboardModal';
import { GameLoadingScreen } from '../components/GameLoadingScreen';
import NativeAdView from '../components/NativeAdView';
import { OnboardingOverlay } from '../components/OnboardingOverlay';
import { useDeepLink } from '../../App';
import { useAuth } from '../context/AuthContext';
import { LoopsColors, SemanticColors } from '../constants/LoopsColors';
import { LoopsAnimations } from '../constants/LoopsAnimations';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GAMES_HOST = 'https://gametok-games.pages.dev';
const TAB_BAR_HEIGHT = 50; // Base tab bar height (insets.bottom added dynamically)
const BOTTOM_ZONE_HEIGHT = SCREEN_HEIGHT * 0.15; // 15% for better swipe detection
const TOP_ZONE_HEIGHT = SCREEN_HEIGHT * 0.15;
const SWIPE_THRESHOLD = 50;

interface Game {
  id: string;
  name: string;
  embedUrl?: string;
  thumbnail?: string;
  likes?: number;
  color?: string;
}

// Feed contains games and native ad placeholders every AD_FREQUENCY games
interface FeedItem {
  game?: Game;
  id: string;
  isAd?: boolean;
}

const getGameUrl = (game: Game) => {
  if (game.embedUrl) {
    const separator = game.embedUrl.includes('?') ? '&' : '?';
    return `${game.embedUrl}${separator}gd_sdk_referrer_url=${encodeURIComponent(GAMES_HOST)}`;
  }
  return `${GAMES_HOST}/${game.id}/`;
};

const getThumbnailUrl = (game: Game) => {
  if (game.thumbnail) {
    return game.thumbnail.startsWith('http') ? game.thumbnail : `${GAMES_HOST}${game.thumbnail}`;
  }
  return `${GAMES_HOST}/thumbnails/${game.id}.png`;
};

const isExternalGame = (game: Game) => !!game.embedUrl;

// Domains to block at request level
const AD_DOMAINS = [
  'imasdk.googleapis.com',
  'pagead2.googlesyndication.com',
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google',
  'googleads.g.doubleclick.net',
  'www.googletagservices.com',
  'securepubads.g.doubleclick.net',
  'tpc.googlesyndication.com',
  'ad.doubleclick.net',
  'amazon-adsystem.com',
  'a-mo.net',
  'applovin.com',
  'criteo.com',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'smartadserver.com',
  'casalemedia.com',
  // Only specific ad endpoints, do NOT block the main game host domains
  'api.gamemonetize.com',
  'api.gamemonetize.co',
  'gamemonetize.com/gamemonetize.js',
  'html5.gamedistribution.com/rvv1/gdsdk/gdsdk.js',
  'gamedistribution.com/rvv1/',
  'gdsdk.com',
  'adinplay.com',
];

// Check if URL should be blocked - uses Set for O(1) lookup on exact matches
// and falls back to substring matching for partial domain matches
const AD_DOMAINS_SET = new Set(AD_DOMAINS);
const shouldBlockRequest = (url: string): boolean => {
  const urlLower = url.toLowerCase();
  // Fast path: check if any domain is in the URL
  for (const domain of AD_DOMAINS) {
    if (urlLower.includes(domain)) {
      return true;
    }
  }
  return false;
};

// Script to pause/freeze a game
const PAUSE_SCRIPT = `
(function() {
  // Immediately mute everything
  window._gamePaused = true;
  
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
  
  // DON'T start a new interval - just mute once. This prevents memory leaks.
  
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
  
  const EDGE_ZONE = window.innerHeight * 0.15; // 15% of screen height
  
  // Block touch events in edge zones at capture phase
  // This prevents games from capturing swipes that should go to native gesture handlers
  const blockEdgeTouches = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    const y = touch.clientY;
    const screenHeight = window.innerHeight;
    
    // If touch is in edge zone, stop it from reaching game
    if (y < EDGE_ZONE || y > screenHeight - EDGE_ZONE) {
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
    if (y < EDGE_ZONE || y > screenHeight - EDGE_ZONE) {
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

// Inject blurred game thumbnail as CSS background inside WebView
// Uses body::before pseudo-element so blur stays behind game content
const createBlurBgScript = (thumbnailUrl: string, fallbackColor: string) => `
(function() {
  if (window._blurBgActive) return;
  window._blurBgActive = true;
  var thumbUrl = '${thumbnailUrl}';
  var fallback = '${fallbackColor}';
  var applyBg = function() {
    var s = document.getElementById('_gt_blur_bg');
    if (s) s.remove();
    s = document.createElement('style');
    s.id = '_gt_blur_bg';
    s.textContent = [
      'html, body { background: ' + fallback + ' !important; background-color: ' + fallback + ' !important; margin:0; padding:0; }',
      'body::before {',
      '  content: "";',
      '  position: fixed;',
      '  top: -20px; left: -20px; right: -20px; bottom: -20px;',
      '  background: url(' + thumbUrl + ') center/cover no-repeat;',
      '  filter: blur(30px);',
      '  -webkit-filter: blur(30px);',
      '  opacity: 0.5;',
      '  z-index: -1;',
      '  pointer-events: none;',
      '}',
    ].join('\\n');
    if (document.head) document.head.appendChild(s);
    if (document.documentElement) document.documentElement.style.setProperty('background', fallback, 'important');
    if (document.body) document.body.style.setProperty('background', 'transparent', 'important');
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBg);
  } else {
    applyBg();
  }
  setInterval(applyBg, 1500);
})();
true;
`;

// Mock GD SDK to bypass ads completely
const AD_BLOCKER_SCRIPT = `
(function() {
  // Suppress error dialogs
  window.alert = function() {};
  window.confirm = function() { return true; };
  window.prompt = function() { return ''; };
  
  // Track audio contexts and gain nodes for pause/resume
  window._audioContexts = [];
  window._allGainNodes = [];
  window._gamePaused = false; // Will be set to true by PAUSE_SCRIPT
  
  const OrigAudioContext = window.AudioContext || window.webkitAudioContext;
  if (OrigAudioContext) {
    window.AudioContext = window.webkitAudioContext = function() {
      const ctx = new OrigAudioContext();
      window._audioContexts.push(ctx);
      
      // If game is paused, immediately suspend new contexts
      if (window._gamePaused) {
        try { ctx.suspend(); } catch(e) {}
      }
      
      // Also intercept createGain to track all gain nodes
      const origCreateGain = ctx.createGain.bind(ctx);
      ctx.createGain = function() {
        const gain = origCreateGain();
        window._allGainNodes.push(gain);
        // If paused, mute new gain nodes
        if (window._gamePaused) {
          try { gain.gain.setValueAtTime(0, ctx.currentTime); } catch(e) {}
        }
        return gain;
      };
      
      return ctx;
    };
  }
  
  // Also intercept Audio constructor
  const OrigAudio = window.Audio;
  if (OrigAudio) {
    window.Audio = function(src) {
      const audio = new OrigAudio(src);
      // If game is paused, mute new audio elements
      if (window._gamePaused) {
        audio.muted = true;
        audio.volume = 0;
      }
      return audio;
    };
  }
  
  // Fake OneTrust consent - pretend user already accepted
  // This prevents the consent banner from showing
  window.OnetrustActiveGroups = ',C0001,C0002,C0003,C0004,';
  window.OptanonActiveGroups = ',C0001,C0002,C0003,C0004,';
  window.OneTrust = {
    IsAlertBoxClosed: function() { return true; },
    GetDomainData: function() { return { ShowAlertNotice: false }; },
    Init: function() {},
    LoadBanner: function() {},
    ToggleInfoDisplay: function() {},
    Close: function() {},
    AllowAll: function() {},
    RejectAll: function() {}
  };
  window.Optanon = window.OneTrust;
  
  // Block OneTrust/Optanon scripts from loading
  const blockScripts = ['onetrust', 'optanon', 'cookielaw', 'cookie-consent', 'consent-manager'];
  
  // Override createElement to block consent scripts
  const origCreateElement = document.createElement.bind(document);
  document.createElement = function(tag) {
    const el = origCreateElement(tag);
    if (tag.toLowerCase() === 'script') {
      const origSetAttribute = el.setAttribute.bind(el);
      el.setAttribute = function(name, value) {
        if (name === 'src' && typeof value === 'string') {
          if (blockScripts.some(s => value.toLowerCase().includes(s))) {
            return; // Don't set src for blocked scripts
          }
        }
        return origSetAttribute(name, value);
      };
      Object.defineProperty(el, 'src', {
        set: function(value) {
          if (typeof value === 'string' && blockScripts.some(s => value.toLowerCase().includes(s))) {
            return; // Block
          }
          origSetAttribute('src', value);
        },
        get: function() { return el.getAttribute('src'); }
      });
    }
    return el;
  };

  // Clear all cookies
  document.cookie.split(';').forEach(function(c) {
    document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
  });
  
  // Block cookie setting
  const origCookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') || 
                         Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
  if (origCookieDesc) {
    Object.defineProperty(document, 'cookie', {
      get: function() { return ''; },
      set: function() { return true; },
      configurable: true
    });
  }
  
  // Don't clear localStorage - we need it for game saves!
  // Only clear sessionStorage for tracking
  try { sessionStorage.clear(); } catch(e) {}

  window.google = window.google || {};
  window.google.ima = {
    AdDisplayContainer: function() { this.initialize = function(){}; },
    AdsLoader: function() {
      this.addEventListener = function(){};
      this.requestAds = function(){};
      this.contentComplete = function(){};
    },
    AdsManager: function() {
      this.addEventListener = function(){};
      this.init = function(){};
      this.start = function(){};
      this.destroy = function(){};
    },
    AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: 'adsManagerLoaded' } },
    AdErrorEvent: { Type: { AD_ERROR: 'adError' } },
    AdEvent: { Type: { 
      CONTENT_PAUSE_REQUESTED: 'contentPauseRequested',
      CONTENT_RESUME_REQUESTED: 'contentResumeRequested',
      ALL_ADS_COMPLETED: 'allAdsCompleted',
      LOADED: 'loaded',
      STARTED: 'started',
      COMPLETE: 'complete'
    }},
    AdsRenderingSettings: function(){},
    AdsRequest: function(){ this.adTagUrl = ''; this.linearAdSlotWidth = 0; this.linearAdSlotHeight = 0; },
    ViewMode: { NORMAL: 'normal' },
    settings: { setVpaidMode: function(){}, setLocale: function(){} }
  };

  // Instant callback - no delay
  const fireCallbacks = (callbacks) => {
    if (!callbacks) return;
    // Fire all callbacks immediately in sequence
    callbacks.adStarted && callbacks.adStarted();
    callbacks.adFinished && callbacks.adFinished();
    callbacks.adReward && callbacks.adReward();
    // Also try common alternative names
    callbacks.onAdStarted && callbacks.onAdStarted();
    callbacks.onAdFinished && callbacks.onAdFinished();
    callbacks.onComplete && callbacks.onComplete();
    callbacks.onReward && callbacks.onReward();
    callbacks.success && callbacks.success();
    callbacks.complete && callbacks.complete();
    // More callback variations
    callbacks.done && callbacks.done();
    callbacks.finished && callbacks.finished();
    callbacks.callback && callbacks.callback();
    callbacks.onDone && callbacks.onDone();
    callbacks.onFinished && callbacks.onFinished();
    callbacks.onSuccess && callbacks.onSuccess();
    callbacks.onClose && callbacks.onClose();
    callbacks.close && callbacks.close();
    callbacks.beforeReward && callbacks.beforeReward();
    callbacks.afterReward && callbacks.afterReward();
    callbacks.adViewed && callbacks.adViewed();
    callbacks.onAdViewed && callbacks.onAdViewed();
    callbacks.rewardReceived && callbacks.rewardReceived();
    callbacks.onRewardReceived && callbacks.onRewardReceived();
  };
  
  // Aggressive ad container removal
  const removeAdElements = () => {
    const adSelectors = [
      'iframe[src*="ad"]', 'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]',
      'iframe[id*="ad"]', 'iframe[class*="ad"]', 'iframe[src*="imasdk"]',
      'div[id*="preroll"]', 'div[class*="preroll"]', 'div[id*="ad-"]', 'div[class*="ad-"]',
      'div[id*="video-ad"]', 'div[class*="video-ad"]', 'div[id*="rewarded"]',
      '.gdsdk-container', '#gdsdk-container', '[class*="gdsdk"]', '[id*="gdsdk"]',
      '.ad-container', '#ad-container', '.ads-container', '#ads-container',
      '.advertisement', '#advertisement', '.ad-overlay', '#ad-overlay',
      '[class*="interstitial"]', '[id*="interstitial"]',
      '[class*="preroll"]', '[id*="preroll"]',
      'video[src*="ad"]', 'video[class*="ad"]', 'video[id*="ad"]',
      'iframe[src*="gamemonetize"]', 'div[class*="gamemonetize"]', '#gamemonetize-video'
    ];
    adSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        try { el.remove(); } catch(e) {}
      });
    });
    
    // GameMonetize specific: find and remove "skip" countdown elements
    document.querySelectorAll('*').forEach(el => {
      const text = el.innerText || el.textContent || '';
      if (text.includes('skip this in') || text.includes('Skip Ad') || 
          text.includes('skip ad') || text.includes('Advertisement') ||
          text.includes('skip in') || text.includes('Skip in')) {
        // Find the parent container and nuke it
        let parent = el;
        for (let i = 0; i < 5; i++) {
          if (parent.parentElement) parent = parent.parentElement;
        }
        parent.style.display = 'none';
        try { parent.remove(); } catch(e) {}
        el.style.display = 'none';
        try { el.remove(); } catch(e) {}
      }
    });
    
    // Y8/Yad Games: remove "More Games" links and cross-promo overlays
    document.querySelectorAll('*').forEach(el => {
      const text = el.innerText || el.textContent || '';
      if (text.includes('More Games') || text.includes('more games') ||
          text.includes('Play More') || text.includes('play more') ||
          text.includes('Similar Games') || text.includes('You May Also Like') ||
          text.includes('Recommended') || text.includes('Try These') ||
          text.includes('Play Again') && el.tagName === 'A') {
        el.style.display = 'none';
        el.style.pointerEvents = 'none';
        try { el.remove(); } catch(e) {}
      }
    });
    
    // Block all external links (anything not pointing to the game itself)
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href.startsWith('http') && !href.includes(window.location.hostname)) {
        a.style.display = 'none';
        a.style.pointerEvents = 'none';
        a.removeAttribute('href');
        a.onclick = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
      }
    });
    
    // Also look for fixed position elements at bottom (ad bars)
    document.querySelectorAll('div, span, p').forEach(el => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      // If it's fixed at bottom and small height, likely an ad bar
      if (style.position === 'fixed' && rect.bottom > window.innerHeight - 100 && rect.height < 80) {
        const text = el.innerText || '';
        if (text.includes('skip') || text.includes('Skip') || text.includes('ad') || text.includes('Ad')) {
          el.style.display = 'none';
          try { el.remove(); } catch(e) {}
        }
      }
    });
  };
  
  // Run ad removal periodically (but NOT loader removal - that was breaking games)
  // Store interval ID so it can be cleared on pause
  // Run every 2 seconds instead of 500ms to reduce CPU load
  window._adRemovalInterval = setInterval(removeAdElements, 2000);
  
  // Initial ad removal attempts
  setTimeout(removeAdElements, 0);
  setTimeout(removeAdElements, 100);
  setTimeout(removeAdElements, 500);
  setTimeout(removeAdElements, 1000);
  setTimeout(removeAdElements, 2000);
  
  window.sdk = {
    showBanner: function() { return Promise.resolve(); },
    hideBanner: function() { return Promise.resolve(); },
    showAd: function(type, callbacks) {
      fireCallbacks(callbacks);
      return Promise.resolve();
    },
    preloadAd: function(cb) { cb && cb(); return Promise.resolve(); },
    preloadRewardedAd: function(cb) { cb && cb(); return Promise.resolve(); },
    showRewardedAd: function(callbacks) {
      fireCallbacks(callbacks);
      return Promise.resolve();
    },
    cancelAd: function() { return Promise.resolve(); },
    openConsole: function() {},
    onPauseGame: function() {},
    onResumeGame: function() {},
    play: function() { return Promise.resolve(); },
    start: function() { return Promise.resolve(); },
    pause: function() { return Promise.resolve(); },
    resume: function() { return Promise.resolve(); },
    requestAd: function(callback) { callback && callback(); },
    customVideoAd: function(functionFunc) { if (typeof functionFunc === 'function') functionFunc(); },
    adBreak: function(config) {
      // Handle adBreak API used by some games
      if (config && config.adBreakDone) config.adBreakDone();
      if (config && config.afterAd) config.afterAd();
    },
    adConfig: function(config) {
      if (config && config.onReady) config.onReady();
    }
  };
  
  window.gdsdk = window.sdk;
  
  // GameDistribution specific SDK mock
  window.GD_OPTIONS = {
    gameId: 'test',
    onEvent: function(event) {
      console.log('GD Event:', event);
    }
  };
  
  // Full GD SDK mock
  window.gdsdk = {
    showAd: function(type) {
      return new Promise(resolve => {
        if (window.GD_OPTIONS && window.GD_OPTIONS.onEvent) {
          window.GD_OPTIONS.onEvent({ name: 'SDK_GAME_START' });
        }
        resolve();
      });
    },
    preloadAd: function() { return Promise.resolve(); },
    cancelAd: function() { return Promise.resolve(); },
    showBanner: function() { return Promise.resolve(); },
    openConsole: function() {},
    ...window.sdk
  };
  
  // Mock the GD SDK loader
  window.GD = window.gdsdk;
  
  // Fire SDK ready event
  setTimeout(() => {
    if (window.GD_OPTIONS && window.GD_OPTIONS.onEvent) {
      window.GD_OPTIONS.onEvent({ name: 'SDK_READY' });
      window.GD_OPTIONS.onEvent({ name: 'SDK_GAME_START' });
    }
    // Also dispatch custom event some games listen for
    window.dispatchEvent(new Event('게임시작'));
    window.dispatchEvent(new CustomEvent('game-ready'));
  }, 100);
  
  // Also mock adBreak/adConfig globals (used by some SDKs)
  window.adBreak = window.sdk.adBreak;
  window.adConfig = window.sdk.adConfig;
  
  const adDomains = [
    'imasdk.googleapis.com', 'pagead2.googlesyndication.com', 'doubleclick.net', 'googlesyndication.com', 
    'googleadservices.com', 'api.gamemonetize.com', 'gdsdk.com', '/gdsdk/', 'gamemonetize.js'
  ];
  
  // Block ad requests at fetch level
  const origFetch = window.fetch;
  window.fetch = function(url) {
    if (typeof url === 'string') {
      const urlLower = url.toLowerCase();
      for (let i = 0; i < adDomains.length; i++) {
        if (urlLower.includes(adDomains[i])) {
          console.log('[AdBlock] Blocked fetch:', url);
          return Promise.resolve(new Response('', { status: 200 }));
        }
      }
    }
    return origFetch.apply(this, arguments);
  };
  
  // Block ad requests at XHR level
  const origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, url) {
    this._blocked = false;
    if (typeof url === 'string') {
      const urlLower = url.toLowerCase();
      for (let i = 0; i < adDomains.length; i++) {
        if (urlLower.includes(adDomains[i])) {
          this._blocked = true;
          console.log('[AdBlock] Blocked XHR:', url);
          break;
        }
      }
    }
    return origXHROpen.apply(this, arguments);
  };
  const origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    if (this._blocked) {
      Object.defineProperty(this, 'readyState', { value: 4 });
      Object.defineProperty(this, 'status', { value: 200 });
      Object.defineProperty(this, 'responseText', { value: '' });
      setTimeout(() => {
        this.onreadystatechange && this.onreadystatechange();
        this.onload && this.onload();
      }, 0);
      return;
    }
    return origXHRSend.apply(this, arguments);
  };
  
  // Force fullscreen for external games
  const fullscreenStyle = document.createElement('style');
  fullscreenStyle.textContent = \`
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: 100% !important;
      overflow: hidden !important;
      background: #000 !important;
    }
    /* Unity WebGL specific */
    #unity-container, .unity-container, #unityContainer,
    #unity-canvas, .unity-canvas, #gameContainer,
    .webgl-content, #webgl-content {
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      background: #000 !important;
    }
    canvas, #game-container, .game-container, #game, .game, 
    #game-canvas, .game-canvas, #gameFrame, .gameFrame, #game_frame, .game_frame {
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
    }
    /* Hide Unity branding/footer/warnings AND loading screens */
    #unity-footer, .unity-footer, #unity-logo, .unity-logo,
    #unity-fullscreen-button, #unity-build-title, .unity-mobile-warning,
    #unity-warning, .unity-warning, #unity-mobile-warning,
    #unity-progress-bar-empty, #unity-progress-bar-full,
    #unity-loading-bar, .unity-loading-bar, #unity-loader, .unity-loader,
    #unity-progress, .unity-progress, #unity-loading, .unity-loading,
    #unity-loading-cover, .unity-loading-cover,
    #unity-loading-background, .unity-loading-background,
    #loading-cover, .loading-cover, #loading-bar, .loading-bar,
    #preloader, .preloader, #loader, .loader:not(canvas),
    [class*="unity-warning"], [id*="unity-warning"],
    [class*="unity-load"], [id*="unity-load"],
    [class*="loading-screen"], [id*="loading-screen"],
    [class*="splash-screen"], [id*="splash-screen"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      position: absolute !important;
      left: -9999px !important;
      top: -9999px !important;
      width: 0 !important;
      height: 0 !important;
    }
    /* Hide any ad containers or overlays */
    .ad-container, .ads-container, #ad-container, #ads-container,
    .advertisement, #advertisement, .ad-overlay, #ad-overlay,
    .gdsdk-container, #gdsdk-container { 
      display: none !important; 
    }
    /* Ad-related elements only */
    [class*="preroll"], [id*="preroll"], [class*="Preroll"], [id*="Preroll"],
    [class*="video-ad"], [id*="video-ad"], [class*="videoAd"], [id*="videoAd"],
    [class*="adContainer"], [id*="adContainer"], [class*="ad-wrapper"], [id*="ad-wrapper"],
    [class*="rewarded"], [id*="rewarded"], [class*="interstitial"], [id*="interstitial"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      position: absolute !important;
      left: -9999px !important;
      top: -9999px !important;
      width: 0 !important;
      height: 0 !important;
    }
    /* Hide cookie consent banners */
    .cookie-consent, .cookie-banner, .cookie-notice, .cookie-popup,
    .consent-banner, .consent-popup, .consent-modal, .consent-overlay,
    .gdpr-banner, .gdpr-popup, .gdpr-consent, .privacy-banner,
    #cookie-consent, #cookie-banner, #cookie-notice, #cookieConsent,
    #consent-banner, #consent-popup, #gdpr-banner, #privacy-banner,
    [class*="cookie-consent"], [class*="cookie-banner"], [class*="CookieConsent"],
    [class*="consent-banner"], [class*="gdpr"], [id*="cookie"], [id*="consent"],
    .fc-consent-root, .qc-cmp2-container, #qc-cmp2-container,
    .cmp-container, #cmp-container, .cmpbox, #cmpbox,
    /* Famobi specific */
    #onetrust-consent-sdk, .onetrust-pc-dark-filter, #onetrust-banner-sdk,
    .ot-sdk-container, [class*="onetrust"], [id*="onetrust"],
    .optanon-alert-box-wrapper, #optanon-popup-bg, #optanon-popup-wrapper {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  \`;
  document.head.appendChild(fullscreenStyle);
  
  // Auto-accept cookie consent (runs after DOM loads)
  const autoAcceptCookies = () => {
    // Famobi uses OneTrust - look for their specific buttons
    const acceptSelectors = [
      '#onetrust-accept-btn-handler',
      '.onetrust-close-btn-handler',
      '#accept-recommended-btn-handler',
      'button[id*="accept"]',
      'button[class*="accept"]',
      '[class*="accept"][class*="cookie"]',
      '[class*="Accept"][class*="Cookie"]',
      'button:contains("Accept All")',
      '[class*="accept"]', '[class*="Accept"]', '[class*="agree"]', '[class*="Agree"]',
      '[id*="accept"]', '[id*="Accept"]', '[id*="agree"]', '[id*="Agree"]',
      'button[class*="consent"]', 'button[class*="cookie"]',
      '.fc-cta-consent', '.qc-cmp2-summary-buttons button:first-child',
      '[data-testid="accept-button"]', '[data-action="accept"]'
    ];
    
    for (const selector of acceptSelectors) {
      try {
        const btns = document.querySelectorAll(selector);
        for (const btn of btns) {
          if (btn && btn.offsetParent !== null && btn.innerText && 
              (btn.innerText.toLowerCase().includes('accept') || btn.innerText.toLowerCase().includes('agree'))) {
            btn.click();
            return true;
          }
        }
        // Also try just clicking first match
        const btn = document.querySelector(selector);
        if (btn && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      } catch(e) {}
    }
    
    // Famobi specific: find button with "Accept All Cookies" text
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      if (btn.innerText && btn.innerText.includes('Accept All Cookies')) {
        btn.click();
        return true;
      }
      // Y8 "Got it" button
      if (btn.innerText && btn.innerText.trim() === 'Got it') {
        btn.click();
      }
    }
    
    return false;
  };
  
  // Y8 specific: auto-click "PLAY IN FULLSCREEN" button
  const autoClickY8Play = () => {
    const allButtons = document.querySelectorAll('button, a, div');
    for (const btn of allButtons) {
      if (btn.innerText && (
        btn.innerText.includes('PLAY IN FULLSCREEN') || 
        btn.innerText.includes('Play in Fullscreen') ||
        btn.innerText.includes('PLAY NOW') ||
        btn.innerText.includes('Play Now') ||
        btn.innerText.includes('START GAME') ||
        btn.innerText.includes('Start Game')
      )) {
        btn.click();
        return true;
      }
    }
    return false;
  };
  
  // Try immediately and after short delays
  setTimeout(autoAcceptCookies, 100);
  setTimeout(autoAcceptCookies, 500);
  setTimeout(autoAcceptCookies, 1000);
  setTimeout(autoAcceptCookies, 2000);
  
  // Y8 play button clicks
  setTimeout(autoClickY8Play, 500);
  setTimeout(autoClickY8Play, 1000);
  setTimeout(autoClickY8Play, 2000);
  setTimeout(autoClickY8Play, 3000);
  
  // Also observe for dynamically added consent dialogs
  const observer = new MutationObserver(() => {
    autoAcceptCookies();
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
  setTimeout(() => observer.disconnect(), 10000); // Stop after 10s
  
  // Force fullscreen via JavaScript (for Unity games that resist CSS)
  const forceFullscreen = () => {
    // Remove Unity mobile warning
    const warnings = document.querySelectorAll('#unity-warning, .unity-warning, #unity-mobile-warning, .unity-mobile-warning');
    warnings.forEach(w => w.remove());
    
    // Also remove any paragraph with the warning text
    document.querySelectorAll('p').forEach(p => {
      if (p.textContent && p.textContent.includes('WebGL builds are not supported')) {
        p.remove();
      }
    });
    
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.style.cssText = 'width:100vw!important;height:100vh!important;position:fixed!important;top:0!important;left:0!important;display:block!important;';
    }
    // Also resize Unity container
    const containers = document.querySelectorAll('#unity-container, #gameContainer, .webgl-content, #unityContainer');
    containers.forEach(c => {
      c.style.cssText = 'width:100vw!important;height:100vh!important;position:fixed!important;top:0!important;left:0!important;background:#000!important;';
    });
  };
  
  // Run multiple times as Unity loads
  setTimeout(forceFullscreen, 500);
  setTimeout(forceFullscreen, 1000);
  setTimeout(forceFullscreen, 2000);
  setTimeout(forceFullscreen, 3000);
  
  // Also run on window resize
  window.addEventListener('resize', forceFullscreen);
  
  // CRITICAL: Block touch events at screen edges to allow native swipe gestures
  // This prevents the WebView from capturing swipe gestures at top/bottom
  const EDGE_ZONE = window.innerHeight * 0.15; // 15% of screen height
  
  const blockEdgeTouches = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    const y = touch.clientY;
    const screenHeight = window.innerHeight;
    
    // Block touches in top or bottom edge zones
    if (y < EDGE_ZONE || y > screenHeight - EDGE_ZONE) {
      e.stopPropagation();
      // Don't preventDefault - let it bubble to native
    }
  };
  
  // Capture phase to intercept before game handlers
  document.addEventListener('touchstart', blockEdgeTouches, { capture: true, passive: true });
  document.addEventListener('touchmove', blockEdgeTouches, { capture: true, passive: true });
  
  // NO div blockers - native gesture zones handle swipe detection
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

// Random taglines for games
const GAME_TAGLINES = [
  "So addicting 🔥",
  "Can you beat this?",
  "Try not to rage quit 😤",
  "One more game...",
  "Warning: highly addictive",
  "Brain melting fun",
  "Simple but deadly",
  "You won't put it down",
  "Challenge accepted? 💪",
  "Pure chaos",
  "Satisfying af",
  "Quick dopamine hit",
  "Lowkey fire 🔥",
  "Trust me on this one",
  "Your new obsession",
];

const getRandomTagline = (gameId: string) => {
  // Use gameId to get consistent tagline per game
  const hash = gameId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return GAME_TAGLINES[hash % GAME_TAGLINES.length];
};

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

// Session jitter — random offset generated once per app launch
const SESSION_JITTER = Math.random();

const getFakeCount = (gameId: string, type: 'likes' | 'comments' | 'saves' | 'shares'): number => {
  const dayOfYear = Math.floor(Date.now() / 86400000); // changes daily
  const baseSeed = hashString(gameId + type);
  const dailySeed = hashString(gameId + type + dayOfYear);

  const ranges: Record<string, [number, number]> = {
    likes: [800, 86000],
    comments: [20, 4800],
    saves: [100, 15000],
    shares: [50, 9000],
  };
  const [min, max] = ranges[type];
  const baseCount = min + (baseSeed % (max - min));

  // Daily drift: ±5% based on day
  const dailyDrift = ((dailySeed % 100) - 50) / 1000; // -0.05 to +0.05
  // Session jitter: ±2%
  const sessionDrift = (SESSION_JITTER - 0.5) * 0.04; // -0.02 to +0.02

  return Math.max(min, Math.round(baseCount * (1 + dailyDrift + sessionDrift)));
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

// Create feed with native ads inserted every AD_FREQUENCY games
const createFeed = (games: Game[], cycle: number = 0): FeedItem[] => {
  // Shuffle games for variety
  const shuffledGames = shuffleArray(games);
  const adFrequency = getAdFrequency();
  const result: FeedItem[] = [];

  shuffledGames.forEach((game, index) => {
    // Insert an ad before every N games (after the first batch)
    if (index > 0 && index % adFrequency === 0) {
      result.push({
        id: `ad-${cycle}-${index}`,
        isAd: true,
      });
    }
    result.push({
      game,
      id: `${game.id}-cycle${cycle}-${index}`,
      isAd: false,
    });
  });

  return result;
};

// Swipe Up Hand Icon Component
const SwipeUpHand: React.FC<{ size?: number; color?: string }> = ({ size = 48, color = LoopsColors.white }) => (
  <Svg width={size} height={size} viewBox="0 0 116.91 122.88" fill="none">
    <G fill={color}>
      <Path d="M40.75,67.62c-0.15-0.07-0.33-0.18-0.48-0.29c-1.95-1.55-4.09-3.28-5.93-4.79c-2.69-2.21-5.78-4.75-7.95-6.55 c-1.47-1.21-3.17-2.06-4.75-2.39c-1.03-0.18-1.95-0.18-2.69,0.11c-0.59,0.26-1.1,0.74-1.44,1.47c-0.44,0.99-0.66,2.39-0.55,4.31 c0.11,1.69,0.7,3.53,1.47,5.34c1.14,2.61,2.72,5.04,3.9,6.59c0.07,0.11,0.15,0.18,0.18,0.29l23.3,33.28 c0.29,0.44,0.48,0.92,0.52,1.4c0.48,3.83,1.29,6.74,2.47,8.54c0.88,1.33,1.99,1.99,3.42,1.95H88.9c2.28-0.04,4.34-0.7,6.26-2.02 c2.1-1.44,3.98-3.68,5.71-6.7c0.04-0.04,0.07-0.11,0.11-0.15c0.66-1.14,1.55-2.61,2.39-4.01c3.72-6.11,6.96-11.45,7.33-19.03 l-0.22-10.45c-0.04-0.15-0.04-0.29-0.04-0.44c0-0.15,0-1.14,0.04-2.47c0.07-6.92,0.18-15.46-6.15-16.53h-4.09 c-0.04,1.95-0.15,3.94-0.26,5.85c-0.11,1.73-0.22,3.35-0.22,4.93c0,1.69-1.36,3.06-3.06,3.06s-3.06-1.36-3.06-3.06 c0-1.58,0.11-3.42,0.22-5.34c0.41-6.52,0.88-13.99-4.31-14.91h-4.05c-0.22,0-0.44-0.04-0.66-0.07c0.04,2.36-0.11,4.79-0.26,7.14 c-0.11,1.73-0.22,3.35-0.22,4.93c0,1.69-1.36,3.06-3.06,3.06s-3.06-1.36-3.06-3.06c0-1.58,0.11-3.42,0.22-5.34 c0.4-6.52,0.88-13.99-4.31-14.91h-4.05c-0.29,0-0.55-0.04-0.81-0.11v11.89c0,1.69-1.36,3.06-3.06,3.06s-3.06-1.36-3.06-3.06V17.23 c0-5.34-2.17-8.72-4.97-10.12c-1.03-0.52-2.14-0.77-3.2-0.77c-1.07,0-2.17,0.26-3.2,0.77c-2.76,1.4-4.9,4.79-4.9,10.27v55.92 c0,1.69-1.36,3.06-3.06,3.06s-3.06-1.36-3.06-3.06v-5.67H40.75L40.75,67.62z M0.81,12.28c-1.04,0.99-1.08,2.64-0.09,3.68 C1.71,17,3.35,17.04,4.4,16.05l7.69-7.35v22.08c0,1.44,1.17,2.61,2.61,2.61s2.61-1.17,2.61-2.61V8.68l7.73,7.37 c1.04,0.99,2.69,0.95,3.68-0.09c0.99-1.04,0.95-2.69-0.09-3.68L16.49,0.72c-1-0.95-2.58-0.96-3.59,0L0.81,12.28L0.81,12.28z M69.32,31.33c0.26-0.07,0.52-0.11,0.81-0.11h4.23c0.22,0,0.48,0.04,0.7,0.07c5.63,0.88,8.17,4.16,9.2,8.43 c0.4-0.18,0.85-0.29,1.29-0.29h4.23c0.22,0,0.48,0.04,0.7,0.07c6.07,0.96,8.5,4.67,9.39,9.39c0.15-0.04,0.29-0.04,0.48-0.04h4.23 c0.22,0,0.48,0.04,0.7,0.07c11.63,1.8,11.49,13.36,11.37,22.68v2.43l0.26,10.75v0.33c-0.44,9.17-4.05,15.09-8.21,21.94 c-0.7,1.14-1.4,2.32-2.36,3.94c-0.04,0.04-0.04,0.07-0.07,0.11c-2.17,3.79-4.67,6.7-7.55,8.69c-2.91,2.02-6.15,3.06-9.68,3.09 H52.42c-3.64,0.07-6.48-1.51-8.58-4.64c-1.69-2.5-2.8-6.04-3.39-10.45L17.63,75.17l-0.11-0.11c-1.36-1.8-3.2-4.64-4.6-7.77 c-1.03-2.36-1.8-4.9-1.99-7.4c-0.18-2.98,0.22-5.34,1.07-7.22c1.03-2.32,2.72-3.83,4.75-4.64c1.88-0.77,4.01-0.88,6.15-0.44 c2.58,0.52,5.23,1.8,7.47,3.68c1.84,1.55,4.93,4.05,7.95,6.52l2.5,2.06V17.41c0-8.14,3.61-13.36,8.28-15.72 c1.88-0.96,3.9-1.44,5.96-1.44c2.06,0,4.09,0.48,5.96,1.44c4.68,2.36,8.36,7.62,8.36,15.61v14.06L69.32,31.33L69.32,31.33z" />
    </G>
  </Svg>
);

// Swipe hint overlay — shows the hand icon and highlight area in the bottom swipe zone
// occasionally to remind users where to swipe
const SwipeHintOverlay: React.FC<{ gameIndex: number; shouldShow: boolean }> = ({ gameIndex, shouldShow }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const handY = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!shouldShow) {
      setVisible(false);
      return;
    }

    setVisible(true);
    opacity.setValue(0);
    handY.setValue(0);

    // Fade in
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Hand swipe animation - travels from bottom upwards like the welcome screen
    const swipeAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(handY, {
          toValue: -80, // Travel up 80px
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(handY, {
          toValue: 0,
          duration: 800,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(300), // Pause at bottom before repeating
      ])
    );
    swipeAnimation.start();

    // Fade out after 4 seconds (gives 1s fade out before the 5s mark)
    const fadeTimer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        swipeAnimation.stop();
      });
    }, 4000);

    return () => {
      clearTimeout(fadeTimer);
      swipeAnimation.stop();
    };
  }, [gameIndex, shouldShow]);

  if (!visible || gameIndex < 0) return null; // Don't show on welcome screen

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: BOTTOM_ZONE_HEIGHT,
        opacity,
        zIndex: 5,
        backgroundColor: 'rgba(168, 85, 247, 0.15)', // Semi-transparent purple
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(168, 85, 247, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      pointerEvents="none"
    >
      <Animated.View style={{
        alignItems: 'center',
        transform: [{ translateY: handY }]
      }}>
        <SwipeUpHand size={36} color="rgba(255,255,255,0.9)" />
        <Text style={{
          color: 'rgba(255,255,255,0.9)',
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
          textShadowColor: 'rgba(0,0,0,0.5)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
        }}>Swipe up for next</Text>
      </Animated.View>
    </Animated.View>
  );
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
      Animated.timing(scale, { toValue: 0.75, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1.15, friction: 3, tension: 40, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true })
    ]).start();
  };

  return (
    <TouchableOpacity style={styles.actionButton} onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name="chatbubble-ellipses" size={32} color={LoopsColors.white} />
      </Animated.View>
      <Text style={styles.actionCount}>{formatCount(commentCount)}</Text>
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

// Animated Welcome Screen Component
const WelcomeScreen: React.FC<{ contentHeight: number }> = ({ contentHeight }) => {
  // Animation values
  const glowPulse = useRef(new Animated.Value(0.4)).current;
  const chevron1Y = useRef(new Animated.Value(0)).current;
  const chevron2Y = useRef(new Animated.Value(0)).current;
  const chevron3Y = useRef(new Animated.Value(0)).current;
  const chevronOpacity = useRef(new Animated.Value(0.5)).current;
  const barWidth = useRef(new Animated.Value(0.6)).current;
  const handY = useRef(new Animated.Value(0)).current; // New animation for hand

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

    // Hand swipe animation - travels from bottom to near tagline
    Animated.loop(
      Animated.sequence([
        Animated.timing(handY, {
          toValue: -80, // Travel up 80px
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(handY, {
          toValue: 0,
          duration: 800,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(300), // Pause at bottom before repeating
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

      {/* Bottom swipe zone - purple background, no glow */}
      <View style={welcomeStyles.bottomZone}>
        <View style={welcomeStyles.purpleBar} />
      </View>

      {/* Animated swipe hand - positioned absolutely from screen bottom */}
      <Animated.View style={[
        welcomeStyles.swipeHandContainer,
        {
          transform: [{ translateY: handY }],
        }
      ]}>
        <SwipeUpHand size={32} color={LoopsColors.white} />
      </Animated.View>

      {/* Transparent scroll zone indicator */}
      <View style={welcomeStyles.scrollZoneIndicator} pointerEvents="none" />
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
  scrollZoneIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_ZONE_HEIGHT,
    backgroundColor: 'rgba(168, 85, 247, 0.15)', // Semi-transparent purple
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(168, 85, 247, 0.3)',
    zIndex: 1,
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
    bottom: BOTTOM_ZONE_HEIGHT + 40,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    letterSpacing: 2,
  },
  bottomZone: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_ZONE_HEIGHT + 80,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 25,
  },
  purpleBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_ZONE_HEIGHT,
    backgroundColor: 'rgba(168, 85, 247, 0.5)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  swipeHandContainer: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  swipeText: {
    fontSize: 15,
    color: '#a855f7',
    fontWeight: '600',
    textShadowColor: '#a855f7',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    letterSpacing: 1,
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
  const { user } = useAuth();
  const isFocused = isActive; // Use the prop instead of navigation hook
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1); // Start at -1 for welcome screen
  const [loading, setLoading] = useState(true);

  const [scrollEnabled, setScrollEnabled] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const swipeHintOpacity = useRef(new Animated.Value(0)).current;
  const [gestureKey, setGestureKey] = useState(0);

  // Track which games have finished loading (ready to play)
  const [readyGames, setReadyGames] = useState<Set<string>>(new Set());

  // Hard safety net: if onLoadEnd never fires, force-dismiss after 15s
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (feed.length > 0 && currentIndex >= 0 && currentIndex < feed.length) {
      const activeItem = feed[currentIndex];
      if (activeItem && !activeItem.isAd && !readyGames.has(activeItem.id)) {
        timeout = setTimeout(() => {
          setReadyGames(prev => new Set(prev).add(activeItem.id));
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

  // Click animation state - track position of last tap
  const [clickAnimations, setClickAnimations] = useState<Array<{ id: string; x: number; y: number }>>([]);

  // Comments sheet state
  const [showComments, setShowComments] = useState(false);
  const [commentsGameId, setCommentsGameId] = useState<string>('');
  const [commentsGameName, setCommentsGameName] = useState<string>('');

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
          await gamification.gamePlayed(gameId, playTimeSeconds);
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

  const currentIndexRef = useRef(0);
  const feedRef = useRef<FeedItem[]>([]);
  const translateY = useRef(new Animated.Value(0)).current;

  // Listen for AppState changes to unlock broken gestures
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' || state === 'inactive') {
        if (!isAnimating.current) {
          translateY.setValue(0);
        }
        setScrollEnabled(false);
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
          console.log(`[Gamification] Tab unfocused - played ${gameId} for ${playTimeSeconds}s`);
          gamification.gamePlayed(gameId, playTimeSeconds).catch(e => {
            console.log('[Gamification] Failed to record play:', e);
          });
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

      // Pause all games EXCEPT the current one
      Object.entries(webViewRefs.current).forEach(([id, webView]) => {
        if (webView && id !== currItemId) {
          webView.injectJavaScript(PAUSE_SCRIPT);
        }
      });

      // Resume the current game (if not on welcome screen)
      if (currIdx >= 0 && currItem && webViewRefs.current[currItem.id]) {
        webViewRefs.current[currItem.id]?.injectJavaScript(RESUME_SCRIPT);
      }

      prevIndexRef.current = currIdx;
    }
  }, [currentIndex, feed, isFocused]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

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
        console.log(`[Gamification] Played ${gameId} for ${playTimeSeconds}s`);
        gamification.gamePlayed(gameId, playTimeSeconds).then(result => {
          console.log('[Gamification] Points earned:', result.pointsEarned, 'XP:', result.xpEarned);
          // Clear saved session points after successful sync
          gameSessionPointsRef.current[gameId] = 0;
        }).catch(e => {
          console.log('[Gamification] Failed to record play:', e);
        });
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
        console.log(`[Gamification] Sync check - gameStartTime: ${gameStartTimeRef.current}, user: ${user?.id || 'NO USER'}, gameId: ${currentGameId}`);
        if (gameStartTimeRef.current && user && currentGameId) {
          const playTimeSeconds = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);
          if (playTimeSeconds >= 5) {
            console.log(`[Gamification] Syncing ${currentGameId}: ${playTimeSeconds}s played`);
            gamification.gamePlayed(currentGameId, playTimeSeconds).then((result) => {
              console.log(`[Gamification] Sync SUCCESS - points earned: ${result.pointsEarned}`);
              // Reset start time after successful sync
              gameStartTimeRef.current = Date.now();
            }).catch(e => {
              console.log('[Gamification] Sync FAILED:', e.message || e);
            });
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
    const init = async () => {
      console.log('[HomeScreen] Starting init...');

      // Check if this is the first launch
      const hasLaunchedBefore = await AsyncStorage.getItem('hasLaunchedBefore');
      const isFirstLaunch = !hasLaunchedBefore;

      if (!isFirstLaunch) {
        // Skip welcome screen on subsequent launches
        setCurrentIndex(0);
      }

      // Mark that the app has been launched
      if (isFirstLaunch) {
        await AsyncStorage.setItem('hasLaunchedBefore', 'true');
      }

      // Initialize ads SDK (don't block on this)
      console.log('[HomeScreen] Initializing ads...');
      initializeAds().then(() => {
        console.log('[HomeScreen] Ads SDK initialized successfully');
        // Native ads are loaded on-demand by NativeAdView component
      }).catch(e => console.log('[HomeScreen] Ads init error:', e));

      // Fetch games immediately (don't wait for ads)
      console.log('[HomeScreen] Fetching games...');
      try {
        const data = await gamesApi.list(50);
        console.log('[HomeScreen] Games fetched:', data?.games?.length || 0);
        if (data.games?.length > 0) {
          allGamesRef.current = data.games;
          setFeed(createFeed(data.games));

          // Store initial like and save counts from API
          const likeCnts: { [id: string]: number } = {};
          const saveCnts: { [id: string]: number } = {};
          data.games.forEach((g: any) => {
            likeCnts[g.id] = g.likes || 0;
            saveCnts[g.id] = g.saves || 0;
          });
          setLikeCounts(likeCnts);
          setSaveCounts(saveCnts);

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
      const data = await gamesApi.list(50);
      if (data.games?.length > 0) {
        allGamesRef.current = data.games;
        setFeed(createFeed(data.games));
        setCurrentIndex(0);
        translateY.setValue(0);
      }
    } catch (e: any) {
      console.log('[HomeScreen] Refresh error:', e?.message || e);
    } finally {
      setLoading(false);
    }
  }, []);

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
        gamesApi.list(100).then(data => {
          const game = data.games?.find((g: Game) =>
            g.id === sharedGameId || g.id?.toLowerCase() === sharedGameId.toLowerCase()
          );
          if (game) {
            // Add the shared game to the front of the feed
            const newItem: FeedItem = { game, id: `shared-${game.id}`, isAd: false };
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
          const data = await gamesApi.list(50);
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
      // Update state first — items will change positions
      setCurrentIndex(newIndex);

      // Delay resetting translateY so it aligns perfectly with the next native render tick
      requestAnimationFrame(() => {
        clearTimeout(safetyTimer);
        translateY.setValue(0);
        isAnimating.current = false;
        setGestureKey(prev => prev + 1);
      });
    });
  };

  // Show swipe hint with fade in
  const showHint = () => {
    if (currentIndexRef.current !== -1) { // Not on welcome screen
      setShowSwipeHint(true);
      Animated.timing(swipeHintOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  };

  // Hide swipe hint with fade out
  const hideHint = () => {
    Animated.timing(swipeHintOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowSwipeHint(false));
  };

  // Helper function to update translateY value (for runOnJS)
  const updateTranslateY = useCallback((value: number) => {
    translateY.setValue(value);
  }, [translateY]);

  // Helper function to handle gesture end (for runOnJS)
  // Uses both distance and velocity for snappy TikTok-like scrolling
  const handleGestureEnd = useCallback((translationY: number, velocityY?: number) => {
    hideHint();
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
    } else if (swipeDown && idx > -1) {
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
    showHint();
  }, []);

  const touchStartY = useRef(0);

  // Edge pan responder - natively intercepts touches BEFORE they reach the WebView
  // but ONLY if the touch started in the top 13% or bottom 13% and is a swipe.
  // This guarantees taps pass through while scrolling always works.
  const edgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (e) => {
        touchStartY.current = e.nativeEvent.pageY;
        return false; // Let taps pass through
      },
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        const isBottomEdge = touchStartY.current > SCREEN_HEIGHT - BOTTOM_ZONE_HEIGHT - 85; // 85px accounts for BottomNav + safe area
        const isTopEdge = touchStartY.current < TOP_ZONE_HEIGHT + 50; // 50px accounts for top safe area
        const isEdge = isBottomEdge || isTopEdge;
        
        const isVerticalSwipe = Math.abs(gesture.dy) > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
        return isEdge && isVerticalSwipe; // Steal touch if it's an edge swipe
      },
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        const isBottomEdge = touchStartY.current > SCREEN_HEIGHT - BOTTOM_ZONE_HEIGHT - 85;
        const isTopEdge = touchStartY.current < TOP_ZONE_HEIGHT + 50;
        const isEdge = isBottomEdge || isTopEdge;
        
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
        } else if (swipeDown && idx > -1) {
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
        // Tap disables scroll mode
        setScrollEnabled(false);
        return false; // Don't capture the tap, let it pass through after disabling
      },
      onMoveShouldSetPanResponder: (_, gesture) => {
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
        return Math.abs(gesture.dy) > 15; // Take over aggressively in capture phase if vertical swipe
      },
      onStartShouldSetPanResponder: () => false, // Let taps pass through to buttons
      onMoveShouldSetPanResponder: (_, gesture) => {
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
        } else if (swipeDown && idx > -1) {
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

  // Only keep current + 1 ahead. NO position 2 preload.
  // This limits live WebViews to 1 (only position 0 gets a real WebView).
  const visibleItems = useMemo(() => {
    const result: { item: FeedItem | null; position: number; isWelcome: boolean }[] = [];

    // Welcome screen at position -1
    if (currentIndex === -1) {
      result.push({ item: null, position: 0, isWelcome: true });
      if (feed[0]) {
        result.push({ item: feed[0], position: 1, isWelcome: false });
      }
    } else {
      // Previous item (position -1)
      if (currentIndex === 0) {
        result.push({ item: null, position: -1, isWelcome: true });
      } else if (feed[currentIndex - 1]) {
        result.push({ item: feed[currentIndex - 1], position: -1, isWelcome: false });
      }

      // Current item (position 0)
      if (feed[currentIndex]) {
        result.push({ item: feed[currentIndex], position: 0, isWelcome: false });
      }

      // Next item (position +1)
      if (feed[currentIndex + 1]) {
        result.push({ item: feed[currentIndex + 1], position: 1, isWelcome: false });
      }

      // One more ahead (position +2) — only if an ad is nearby (ads are empty off-screen, so we have memory room)
      const hasNearbyAd = (feed[currentIndex - 1]?.isAd) || (feed[currentIndex]?.isAd) || (feed[currentIndex + 1]?.isAd);
      if (feed[currentIndex + 2] && hasNearbyAd) {
        result.push({ item: feed[currentIndex + 2], position: 2, isWelcome: false });
      }
    }

    return result;
  }, [feed, currentIndex]);

  if (loading) {
    return <View style={styles.container} />;
  }

  if (feed.length === 0) return null;

  const isCurrentAd = currentIndex > -1 && feed[currentIndex] && feed[currentIndex].isAd;

  return (
    <View style={styles.container}>
      {visibleItems.map(({ item, position, isWelcome }) => (
        <Animated.View
          key={isWelcome ? 'welcome' : item!.id}
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
          {isWelcome ? (
            // Welcome screen
            <Animated.View {...fullScreenPanResponder.panHandlers} style={{ flex: 1 }} collapsable={false}>
              <WelcomeScreen contentHeight={contentHeight} />
            </Animated.View>
          ) : item!.isAd ? (
            // Native Ad — load at position 0 and +1/-1 (so it doesn't instantly unmount and crash when swiping past)
            <Animated.View {...fullScreenPanResponder.panHandlers} style={{ flex: 1, backgroundColor: '#000' }} collapsable={false}>
              {(Math.abs(position) <= 1) && <NativeAdView contentHeight={contentHeight} />}
            </Animated.View>
          ) : (
            // Game screen - natively tracks edge panning around the webview
            <Animated.View {...edgePanResponder.panHandlers} style={{ flex: 1, backgroundColor: item!.game?.color || '#1a1a2e' }} pointerEvents="box-none" collapsable={false}>
              {/* Blurred thumbnail background for letterboxed games */}
              {item!.game && (
                <Image
                  source={{ uri: getThumbnailUrl(item!.game) }}
                  style={[StyleSheet.absoluteFillObject, { opacity: 0.45 }]}
                  blurRadius={40}
                />
              )}

              <Animated.View style={{ flex: 1 }}>
                <WebView
                  ref={(ref) => { webViewRefs.current[item!.id] = ref; }}
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
                  injectedJavaScriptBeforeContentLoaded={isExternalGame(item!.game!) ? AD_BLOCKER_SCRIPT + EDGE_BLOCK_SCRIPT : EDGE_BLOCK_SCRIPT}
                  injectedJavaScript={createBlurBgScript(getThumbnailUrl(item!.game!), item!.game?.color || '#1a1a2e')}
                  onMessage={async (event) => {
                    try {
                      const data = JSON.parse(event.nativeEvent.data);
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
                    // Inject blurred thumbnail bg after page fully loads (backup)
                    const thumbUrl = getThumbnailUrl(item!.game!);
                    const fallback = item!.game?.color || '#1a1a2e';
                    webViewRefs.current[item!.id]?.injectJavaScript(`
                      document.documentElement.style.setProperty('background', '${fallback}', 'important');
                      document.body.style.setProperty('background', 'transparent', 'important');
                      if(!document.getElementById('_gt_blur_bg')){
                        var s=document.createElement('style');s.id='_gt_blur_bg';
                        s.textContent='body::before{content:"";position:fixed;top:-20px;left:-20px;right:-20px;bottom:-20px;background:url(${thumbUrl}) center/cover no-repeat;filter:blur(30px);-webkit-filter:blur(30px);opacity:0.5;z-index:-1;pointer-events:none;}';
                        document.head.appendChild(s);
                      }
                      true;
                    `);

                    // Page fully loaded — wait 3s for game to render, then mark ready
                    setTimeout(() => {
                      setReadyGames(prev => new Set(prev).add(item!.id));
                    }, 3000);

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
                  }}
                  onLoad={() => {
                    const shouldPause = position !== 0 || currentIndex === -1;
                    if (shouldPause && webViewRefs.current[item!.id]) {
                      webViewRefs.current[item!.id]?.injectJavaScript(PAUSE_SCRIPT);
                    }
                  }}
                  onShouldStartLoadWithRequest={(request) => {
                    if (isExternalGame(item!.game!)) {
                      return !shouldBlockRequest(request.url);
                    }
                    return true;
                  }}
                />
              </Animated.View>

              {/* Native gesture zones intercept handled earlier via Animated.View pointerEvents box-none */}

                {/* Loading overlay - shows until game is ready */}
                {!readyGames.has(item!.id) && item!.game && (
                  <View style={styles.gameLoadingOverlay}>
                    <GameLoadingScreen
                      gameName={item!.game.name}
                      gameThumbnail={getThumbnailUrl(item!.game)}
                      progress={75} // Can be dynamic if you track actual load progress
                    />
                  </View>
                )}

                {/* Only show action buttons and game info for games, not ads */}
                {!item!.isAd && (
                  <>
                    {/* TikTok-style action buttons - right side */}
                    <View style={styles.actionButtons}>
                      {/* Session Points Counter - tap for leaderboard */}
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={(e) => {
                          triggerClickAnimation(e);
                          handleOpenLeaderboard(item!.game!.id, item!.game!.name);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trophy" size={32} color={LoopsColors.coinGold} />
                        <Text style={[styles.actionCount, { color: LoopsColors.coinGold }]}>+{sessionPoints}</Text>
                      </TouchableOpacity>

                      <AnimatedLikeButton
                        isLiked={likedGames.has(item!.game!.id)}
                        onPress={(e) => {
                          triggerClickAnimation(e);
                          handleLike(item!.game!.id);
                        }}
                        likeCount={getFakeCount(item!.game!.id, 'likes') + (likedGames.has(item!.game!.id) ? 1 : 0)}
                        styles={styles}
                      />

                      {/* Comments */}
                      <AnimatedCommentButton
                        onPress={(e) => {
                          triggerClickAnimation(e);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setCommentsGameId(item!.game!.id);
                          setCommentsGameName(item!.game!.name);
                          setShowComments(true);
                        }}
                        commentCount={getFakeCount(item!.game!.id, 'comments')}
                        styles={styles}
                      />

                      {/* Bookmark/Save */}
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={(e) => {
                          triggerClickAnimation(e);
                          handleSave(item!.game!.id);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="bookmark"
                          size={32}
                          color={savedGames.has(item!.game!.id) ? LoopsColors.coinGold : LoopsColors.white}
                        />
                        <Text style={styles.actionCount}>{formatCount(getFakeCount(item!.game!.id, 'saves') + (savedGames.has(item!.game!.id) ? 1 : 0))}</Text>
                      </TouchableOpacity>

                      {/* Share */}
                      <AnimatedShareButton
                        onPress={(e) => {
                          triggerClickAnimation(e);
                          handleShare(item!.game!);
                        }}
                        shareCount={getFakeCount(item!.game!.id, 'shares')}
                        styles={styles}
                      />
                    </View>

                    {/* Game info - bottom left */}
                    <View style={styles.gameInfo} pointerEvents="none">
                      <View style={styles.gameNameRow}>
                        <Text style={styles.gameName}>{item!.game!.name}</Text>
                        <View style={styles.gameBadge}>
                          <Ionicons name="game-controller" size={12} color={LoopsColors.white} />
                        </View>
                      </View>
                      <Text style={styles.gameTagline}>{getRandomTagline(item!.game!.id)}</Text>
                    </View>
                  </>
                )}
            </Animated.View>
          )}
        </Animated.View>
      ))}

      {/* Swipe hint — shows hand icon for 5s on first game or after an ad */}
      <SwipeHintOverlay 
        gameIndex={currentIndex} 
        shouldShow={currentIndex === 0 || (currentIndex > 0 && !!feed[currentIndex - 1]?.isAd)}
      />

      {/* For You header - tappable to refresh, swipes pass through around it */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={refreshFeed}
          activeOpacity={0.7}
          style={styles.forYouButton}
        >
          <Text style={styles.forYouText}>For You</Text>
        </TouchableOpacity>
      </View>

      {/* Scroll overlay - only visible when scroll mode is active */}
      {scrollEnabled && (
        <View
          style={styles.scrollOverlay}
          {...overlayPanResponder.panHandlers}
        />
      )}

      {/* Overlay gesture zones removed - scrolling is handled completely by PanResponders now */}

      {/* Swipe hint - permanently visible on the screen */}
      <Animated.View
        style={[
          styles.hintContainer,
          currentIndex !== -1 && { opacity: 0.8 }
        ]}
        pointerEvents="none"
      >
        {currentIndex !== -1 && (
          <View style={styles.hintGlow} />
        )}
        <Text style={styles.hintText}>Swipe up to browse</Text>
      </Animated.View>

      {/* Share Sheet */}
      <ShareSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        gameId={shareGameId}
        gameName={shareGameName}
        onSendToFriend={handleSendToFriend}
      />

      {/* Comments Sheet */}
      <CommentsSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        gameId={commentsGameId}
        gameName={commentsGameName}
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

      {/* Onboarding Tooltip Walkthrough */}
      <OnboardingOverlay onComplete={() => { }} />

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
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10000,
  },
  forYouText: {
    color: LoopsColors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  forYouButton: {
    paddingHorizontal: 20,
    paddingVertical: 6,
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
    bottom: BOTTOM_ZONE_HEIGHT,
    backgroundColor: 'transparent',
    zIndex: 5,
  },
  bottomZone: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_ZONE_HEIGHT,
    backgroundColor: 'transparent',
    zIndex: 9999,
    elevation: 9999,
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
  hintContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_ZONE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  hintGlow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_ZONE_HEIGHT,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(168, 85, 247, 0.3)',
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 2,
    marginBottom: 10,
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
    bottom: 100,
    alignItems: 'center',
    zIndex: 10,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 24,
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
  gameNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  gameName: {
    color: LoopsColors.white,
    fontSize: 22,
    fontWeight: '700',
    textShadowColor: LoopsColors.black90,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  gameBadge: {
    backgroundColor: LoopsColors.mainPink,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 8,
  },
  gameTagline: {
    color: LoopsColors.white80,
    fontSize: 14,
    textShadowColor: LoopsColors.black80,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gameLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: LoopsColors.black, // Seamless with container
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
});
