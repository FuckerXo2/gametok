import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, PanResponder, Animated, TouchableOpacity, Image, ImageBackground, Easing } from 'react-native';
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
import { games as gamesApi, likes as likesApi, savedGames as savedGamesApi, messages } from '../services/api';
import { getAdFrequency, initializeAds } from '../services/ads';
import { ShareSheet } from '../components/ShareSheet';
import NativeAdView from '../components/NativeAdView';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GAMES_HOST = 'https://gametok-games.pages.dev';
const TAB_BAR_HEIGHT = 50; // Base tab bar height (insets.bottom added dynamically)
const BOTTOM_ZONE_HEIGHT = SCREEN_HEIGHT * 0.10;
const SWIPE_THRESHOLD = 50;

interface Game {
  id: string;
  name: string;
  embedUrl?: string;
  likes?: number;
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
  // Famobi/GameDistribution ads
  'adinplay.com',
  'gamedistribution.com',
  'gdsdk.com',
];

const shouldBlockRequest = (url: string): boolean => {
  return AD_DOMAINS.some(domain => url.includes(domain));
};

// Script to pause/freeze a game
const PAUSE_SCRIPT = `
(function() {
  // Pause ALL HTML5 audio/video elements
  document.querySelectorAll('audio, video').forEach(el => { 
    try { 
      el.pause(); 
      el.muted = true;
    } catch(e){} 
  });
  
  // Mute ALL audio contexts (not just tracked ones)
  if (window.AudioContext || window.webkitAudioContext) {
    // Suspend tracked contexts
    if (window._audioContexts) {
      window._audioContexts.forEach(ctx => { 
        try { 
          ctx.suspend(); 
        } catch(e){} 
      });
    }
    
    // Save and mute any gain nodes
    if (window._allGainNodes) {
      window._allGainNodes.forEach(gain => {
        try { 
          gain._savedValue = gain.gain.value;
          gain.gain.value = 0; 
        } catch(e) {}
      });
    }
  }
  
  // Mute Unity specifically
  if (window.unityInstance) {
    try { window.unityInstance.SendMessage('AudioManager', 'Mute'); } catch(e) {}
    try { window.unityInstance.SendMessage('SoundManager', 'Mute'); } catch(e) {}
  }
  
  // Global mute fallback
  if (window._masterGain) {
    try { 
      window._originalGainValue = window._masterGain.gain.value;
      window._masterGain.gain.value = 0; 
    } catch(e) {}
  }
  
  // Howler.js (common audio library)
  if (window.Howler) {
    try { window.Howler.mute(true); } catch(e) {}
  }
  
  // Stop requestAnimationFrame
  if (!window._origRAF) {
    window._origRAF = window.requestAnimationFrame;
    window._rafQueue = [];
  }
  window.requestAnimationFrame = function(cb) {
    window._rafQueue.push(cb);
    return window._rafQueue.length;
  };
  
  // Pause common game engines
  if (window.Phaser && window.Phaser.GAMES) {
    window.Phaser.GAMES.forEach(g => {
      try { g.sound && g.sound.mute && (g.sound.mute = true); } catch(e) {}
      try { g.scene && g.scene.pause && g.scene.pause(); } catch(e) {}
    });
  }
  if (window.createjs && window.createjs.Ticker) {
    window.createjs.Ticker.paused = true;
  }
  if (window.createjs && window.createjs.Sound) {
    try { window.createjs.Sound.muted = true; } catch(e) {}
  }
  
  window._gamePaused = true;
})();
true;
`;

// Script to resume/unfreeze a game
const RESUME_SCRIPT = `
(function() {
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
  
  window._gamePaused = false;
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
  const OrigAudioContext = window.AudioContext || window.webkitAudioContext;
  if (OrigAudioContext) {
    window.AudioContext = window.webkitAudioContext = function() {
      const ctx = new OrigAudioContext();
      window._audioContexts.push(ctx);
      
      // Also intercept createGain to track all gain nodes
      const origCreateGain = ctx.createGain.bind(ctx);
      ctx.createGain = function() {
        const gain = origCreateGain();
        window._allGainNodes.push(gain);
        return gain;
      };
      
      return ctx;
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
  
  // Clear localStorage/sessionStorage for tracking
  try { localStorage.clear(); } catch(e) {}
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
  };
  
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
  
  const adDomains = ['imasdk.googleapis.com', 'pagead2.googlesyndication.com', 'doubleclick.net', 'googlesyndication.com', 'googleadservices.com'];
  
  const origFetch = window.fetch;
  window.fetch = function(url) {
    if (typeof url === 'string' && adDomains.some(d => url.includes(d))) {
      return Promise.resolve(new Response('', { status: 200 }));
    }
    return origFetch.apply(this, arguments);
  };
  
  const origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, url) {
    this._blocked = typeof url === 'string' && adDomains.some(d => url.includes(d));
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
    /* Hide Unity branding/footer/warnings */
    #unity-footer, .unity-footer, #unity-logo, .unity-logo,
    #unity-fullscreen-button, #unity-build-title, .unity-mobile-warning,
    #unity-warning, .unity-warning, #unity-mobile-warning,
    #unity-progress-bar-empty, #unity-progress-bar-full,
    [class*="unity-warning"], [id*="unity-warning"],
    p:contains("WebGL builds are not supported") {
      display: none !important;
      visibility: hidden !important;
    }
    /* Hide any ad containers or overlays */
    .ad-container, .ads-container, #ad-container, #ads-container,
    .advertisement, #advertisement, .ad-overlay, #ad-overlay,
    .gdsdk-container, #gdsdk-container { 
      display: none !important; 
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
})();
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
const SwipeUpHand: React.FC<{ size?: number; color?: string }> = ({ size = 48, color = '#ffffff' }) => (
  <Svg width={size} height={size} viewBox="0 0 116.91 122.88" fill="none">
    <G fill={color}>
      <Path d="M40.75,67.62c-0.15-0.07-0.33-0.18-0.48-0.29c-1.95-1.55-4.09-3.28-5.93-4.79c-2.69-2.21-5.78-4.75-7.95-6.55 c-1.47-1.21-3.17-2.06-4.75-2.39c-1.03-0.18-1.95-0.18-2.69,0.11c-0.59,0.26-1.1,0.74-1.44,1.47c-0.44,0.99-0.66,2.39-0.55,4.31 c0.11,1.69,0.7,3.53,1.47,5.34c1.14,2.61,2.72,5.04,3.9,6.59c0.07,0.11,0.15,0.18,0.18,0.29l23.3,33.28 c0.29,0.44,0.48,0.92,0.52,1.4c0.48,3.83,1.29,6.74,2.47,8.54c0.88,1.33,1.99,1.99,3.42,1.95H88.9c2.28-0.04,4.34-0.7,6.26-2.02 c2.1-1.44,3.98-3.68,5.71-6.7c0.04-0.04,0.07-0.11,0.11-0.15c0.66-1.14,1.55-2.61,2.39-4.01c3.72-6.11,6.96-11.45,7.33-19.03 l-0.22-10.45c-0.04-0.15-0.04-0.29-0.04-0.44c0-0.15,0-1.14,0.04-2.47c0.07-6.92,0.18-15.46-6.15-16.53h-4.09 c-0.04,1.95-0.15,3.94-0.26,5.85c-0.11,1.73-0.22,3.35-0.22,4.93c0,1.69-1.36,3.06-3.06,3.06s-3.06-1.36-3.06-3.06 c0-1.58,0.11-3.42,0.22-5.34c0.41-6.52,0.88-13.99-4.31-14.91h-4.05c-0.22,0-0.44-0.04-0.66-0.07c0.04,2.36-0.11,4.79-0.26,7.14 c-0.11,1.73-0.22,3.35-0.22,4.93c0,1.69-1.36,3.06-3.06,3.06s-3.06-1.36-3.06-3.06c0-1.58,0.11-3.42,0.22-5.34 c0.4-6.52,0.88-13.99-4.31-14.91h-4.05c-0.29,0-0.55-0.04-0.81-0.11v11.89c0,1.69-1.36,3.06-3.06,3.06s-3.06-1.36-3.06-3.06V17.23 c0-5.34-2.17-8.72-4.97-10.12c-1.03-0.52-2.14-0.77-3.2-0.77c-1.07,0-2.17,0.26-3.2,0.77c-2.76,1.4-4.9,4.79-4.9,10.27v55.92 c0,1.69-1.36,3.06-3.06,3.06s-3.06-1.36-3.06-3.06v-5.67H40.75L40.75,67.62z M0.81,12.28c-1.04,0.99-1.08,2.64-0.09,3.68 C1.71,17,3.35,17.04,4.4,16.05l7.69-7.35v22.08c0,1.44,1.17,2.61,2.61,2.61s2.61-1.17,2.61-2.61V8.68l7.73,7.37 c1.04,0.99,2.69,0.95,3.68-0.09c0.99-1.04,0.95-2.69-0.09-3.68L16.49,0.72c-1-0.95-2.58-0.96-3.59,0L0.81,12.28L0.81,12.28z M69.32,31.33c0.26-0.07,0.52-0.11,0.81-0.11h4.23c0.22,0,0.48,0.04,0.7,0.07c5.63,0.88,8.17,4.16,9.2,8.43 c0.4-0.18,0.85-0.29,1.29-0.29h4.23c0.22,0,0.48,0.04,0.7,0.07c6.07,0.96,8.5,4.67,9.39,9.39c0.15-0.04,0.29-0.04,0.48-0.04h4.23 c0.22,0,0.48,0.04,0.7,0.07c11.63,1.8,11.49,13.36,11.37,22.68v2.43l0.26,10.75v0.33c-0.44,9.17-4.05,15.09-8.21,21.94 c-0.7,1.14-1.4,2.32-2.36,3.94c-0.04,0.04-0.04,0.07-0.07,0.11c-2.17,3.79-4.67,6.7-7.55,8.69c-2.91,2.02-6.15,3.06-9.68,3.09 H52.42c-3.64,0.07-6.48-1.51-8.58-4.64c-1.69-2.5-2.8-6.04-3.39-10.45L17.63,75.17l-0.11-0.11c-1.36-1.8-3.2-4.64-4.6-7.77 c-1.03-2.36-1.8-4.9-1.99-7.4c-0.18-2.98,0.22-5.34,1.07-7.22c1.03-2.32,2.72-3.83,4.75-4.64c1.88-0.77,4.01-0.88,6.15-0.44 c2.58,0.52,5.23,1.8,7.47,3.68c1.84,1.55,4.93,4.05,7.95,6.52l2.5,2.06V17.41c0-8.14,3.61-13.36,8.28-15.72 c1.88-0.96,3.9-1.44,5.96-1.44c2.06,0,4.09,0.48,5.96,1.44c4.68,2.36,8.36,7.62,8.36,15.61v14.06L69.32,31.33L69.32,31.33z" />
    </G>
  </Svg>
);

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

      {/* Bottom swipe zone with neon glow */}
      <View style={welcomeStyles.bottomZone}>
        {/* Neon glow bar */}
        <Animated.View style={[
          welcomeStyles.glowBarContainer,
          {
            opacity: glowPulse,
            transform: [{ scaleX: barWidth }],
          }
        ]}>
          <LinearGradient
            colors={['#00f5ff', '#a855f7', '#ff00aa']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={welcomeStyles.glowBar}
          />
          {/* Glow effect layer */}
          <LinearGradient
            colors={['#00f5ff', '#a855f7', '#ff00aa']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={welcomeStyles.glowBarBlur}
          />
        </Animated.View>
      </View>

      {/* Animated swipe hand - positioned absolutely from screen bottom */}
      <Animated.View style={[
        welcomeStyles.swipeHandContainer,
        {
          transform: [{ translateY: handY }],
        }
      ]}>
        <SwipeUpHand size={32} color="#ffffff" />
      </Animated.View>
    </View>
  );
};

const welcomeStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
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

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1); // Start at -1 for welcome screen
  const [loading, setLoading] = useState(true);
  const [scrollEnabled, setScrollEnabled] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const swipeHintOpacity = useRef(new Animated.Value(0)).current;

  // Store original games for infinite loop
  const allGamesRef = useRef<Game[]>([]);
  const feedCycleRef = useRef(0);

  // Track liked games and like counts
  const [likedGames, setLikedGames] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<{ [gameId: string]: number }>({});
  
  // Track saved games (bookmarks)
  const [savedGames, setSavedGames] = useState<Set<string>>(new Set());

  // Share sheet state
  const [showShare, setShowShare] = useState(false);
  const [shareGameId, setShareGameId] = useState<string>('');
  const [shareGameName, setShareGameName] = useState<string>('');

  // Calculate actual content height (screen minus tab bar)
  const contentHeight = SCREEN_HEIGHT - TAB_BAR_HEIGHT - insets.bottom;

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
    }
  };

  // Handle share - opens share sheet
  const handleShare = (game: Game) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShareGameId(game.id);
    setShareGameName(game.name);
    setShowShare(true);
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
  const isAnimating = useRef(false);
  const webViewRefs = useRef<{ [key: string]: WebViewType | null }>({});
  const prevIndexRef = useRef(-1); // Start at -1 to match initial currentIndex

  // Pause/resume WebViews when index changes
  useEffect(() => {
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
  }, [currentIndex, feed]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

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

          // Store initial like counts from API
          const counts: { [id: string]: number } = {};
          data.games.forEach((g: Game) => {
            counts[g.id] = g.likes || 0;
          });
          setLikeCounts(counts);

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

    Animated.timing(translateY, {
      toValue: direction * contentHeight,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex(newIndex);
      translateY.setValue(0);
      isAnimating.current = false;
      // Keep scrollEnabled true - only disable on tap
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
  const handleGestureEnd = useCallback((translationY: number) => {
    hideHint();

    if (isAnimating.current) return;

    const idx = currentIndexRef.current;
    const total = feedRef.current.length;

    if (translationY < -SWIPE_THRESHOLD && idx < total - 1) {
      animateToIndex(idx + 1);
    } else if (translationY > SWIPE_THRESHOLD && idx > -1) {
      animateToIndex(idx - 1);
    } else {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  }, [translateY]);

  // Helper to handle gesture start (for runOnJS)
  const handleGestureStart = useCallback(() => {
    setScrollEnabled(true);
    showHint();
  }, []);

  // Bottom zone gesture - uses react-native-gesture-handler for better touch handling
  // The gesture only activates after 15px of vertical movement, allowing taps to pass through
  const bottomPanGesture = Gesture.Pan()
    .activeOffsetY([-15, 15]) // Only activate after 15px vertical movement
    .failOffsetX([-20, 20]) // Fail if horizontal movement is too large
    .onStart(() => {
      'worklet';
      runOnJS(handleGestureStart)();
    })
    .onUpdate((event) => {
      'worklet';
      if (!isAnimating.current) {
        runOnJS(updateTranslateY)(event.translationY);
      }
    })
    .onEnd((event) => {
      'worklet';
      runOnJS(handleGestureEnd)(event.translationY);
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(hideHint)();
    });

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
    })
  ).current;

  // Get prev, current, next items for preloading (2 ahead to handle ads)
  // Index -1 is the welcome screen
  const visibleItems = useMemo(() => {
    const result: { item: FeedItem | null; position: number; isWelcome: boolean }[] = [];

    // Welcome screen at position -1
    if (currentIndex === -1) {
      result.push({ item: null, position: 0, isWelcome: true });
      if (feed[0]) {
        result.push({ item: feed[0], position: 1, isWelcome: false });
      }
    } else {
      // Previous item (could be welcome screen)
      if (currentIndex === 0) {
        result.push({ item: null, position: -1, isWelcome: true });
      } else if (feed[currentIndex - 1]) {
        result.push({ item: feed[currentIndex - 1], position: -1, isWelcome: false });
      }

      if (feed[currentIndex]) {
        result.push({ item: feed[currentIndex], position: 0, isWelcome: false });
      }
      if (feed[currentIndex + 1]) {
        result.push({ item: feed[currentIndex + 1], position: 1, isWelcome: false });
      }
      // Preload one more ahead so games load while viewing ads
      if (feed[currentIndex + 2]) {
        result.push({ item: feed[currentIndex + 2], position: 2, isWelcome: false });
      }
    }

    return result;
  }, [feed, currentIndex]);

  if (loading) {
    return <View style={styles.container} />;
  }

  if (feed.length === 0) return null;

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
            <WelcomeScreen contentHeight={contentHeight} />
          ) : item!.isAd ? (
            // Native Ad
            <NativeAdView contentHeight={contentHeight} />
          ) : (
            // Game screen
            <>
              <WebView
                ref={(ref) => { webViewRefs.current[item!.id] = ref; }}
                source={{ uri: getGameUrl(item!.game!) }}
                style={styles.webview}
                javaScriptEnabled
                domStorageEnabled
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                thirdPartyCookiesEnabled={!isExternalGame(item!.game!)}
                sharedCookiesEnabled={false}
                injectedJavaScriptBeforeContentLoaded={isExternalGame(item!.game!) ? AD_BLOCKER_SCRIPT : undefined}
                onMessage={() => { }} // Suppress messages
                javaScriptCanOpenWindowsAutomatically={false}
                setSupportMultipleWindows={false}
                onLoad={() => {
                  // Auto-pause if not the current game OR if on welcome screen
                  const shouldPause = position !== 0 || currentIndex === -1;
                  if (shouldPause && webViewRefs.current[item!.id]) {
                    webViewRefs.current[item!.id]?.injectJavaScript(PAUSE_SCRIPT);
                  }
                }}
                onShouldStartLoadWithRequest={(request) => {
                  if (isExternalGame(item!.game!)) {
                    const blocked = shouldBlockRequest(request.url);
                    return !blocked;
                  }
                  return true;
                }}
                renderError={(errorDomain, errorCode, errorDesc) => (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorEmoji}>📶</Text>
                    <Text style={styles.errorTitle}>Couldn't load game</Text>
                    <Text style={styles.errorMessage}>Check your connection and swipe to try another</Text>
                  </View>
                )}
              />

              {/* Only show action buttons and game info for games, not ads */}
              {!item!.isAd && (
                <>
                  {/* TikTok-style action buttons - right side */}
                  <View style={styles.actionButtons}>
                    {/* Like */}
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleLike(item!.game!.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="heart"
                        size={32}
                        color={likedGames.has(item!.game!.id) ? "#ff2d55" : "#fff"}
                      />
                      <Text style={styles.actionCount}>{likeCounts[item!.game!.id] || 0}</Text>
                    </TouchableOpacity>

                    {/* Bookmark/Save */}
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleSave(item!.game!.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={savedGames.has(item!.game!.id) ? "bookmark" : "bookmark-outline"}
                        size={30}
                        color={savedGames.has(item!.game!.id) ? "#ffd60a" : "#fff"}
                      />
                      <Text style={styles.actionCount}>Save</Text>
                    </TouchableOpacity>

                    {/* Share */}
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleShare(item!.game!)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-redo" size={30} color="#fff" />
                      <Text style={styles.actionCount}>Share</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Game info - bottom left */}
                  <View style={styles.gameInfo} pointerEvents="none">
                    <View style={styles.gameNameRow}>
                      <Text style={styles.gameName}>{item!.game!.name}</Text>
                      <View style={styles.gameBadge}>
                        <Ionicons name="game-controller" size={12} color="#fff" />
                      </View>
                    </View>
                    <Text style={styles.gameTagline}>{getRandomTagline(item!.game!.id)}</Text>
                  </View>
                </>
              )}
            </>
          )}
        </Animated.View>
      ))}

      {/* For You header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.forYouText}>For You</Text>
      </View>

      {/* Scroll overlay - only visible when scroll mode is active */}
      {scrollEnabled && (
        <View
          style={styles.scrollOverlay}
          {...overlayPanResponder.panHandlers}
        />
      )}

      <GestureDetector gesture={bottomPanGesture}>
        <View style={styles.bottomZone} />
      </GestureDetector>

      {/* Swipe hint - permanent on welcome, on-touch for games */}
      {(currentIndex === -1 || showSwipeHint) && (
        <Animated.View
          style={[
            styles.hintContainer,
            currentIndex !== -1 && { opacity: swipeHintOpacity }
          ]}
          pointerEvents="none"
        >
          <View style={[
            styles.hintGlow,
            currentIndex !== -1 && styles.hintGlowDark
          ]} />
          <Text style={[
            styles.hintText,
            currentIndex !== -1 && styles.hintTextDark
          ]}>Swipe from bottom to browse</Text>
        </Animated.View>
      )}

      {/* Share Sheet */}
      <ShareSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        gameId={shareGameId}
        gameName={shareGameName}
        onSendToFriend={handleSendToFriend}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  forYouText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  gameContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
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
    zIndex: 10,
  },
  hintContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_ZONE_HEIGHT + 40,
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
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  hintText: {
    color: '#a855f7',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: '#a855f7',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
    marginBottom: 10,
  },
  hintGlowDark: {
    backgroundColor: 'rgba(168, 85, 247, 0.4)',
    shadowOpacity: 0.7,
  },
  hintTextDark: {
    color: '#a855f7',
    textShadowRadius: 10,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000',
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
    right: 10,
    bottom: 120,
    alignItems: 'center',
    zIndex: 10,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  actionCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  gameBadge: {
    backgroundColor: '#ff4757',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 8,
  },
  gameTagline: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
