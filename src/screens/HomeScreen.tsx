import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, PanResponder, Animated, TouchableOpacity, Share } from 'react-native';
import type { WebView as WebViewType } from 'react-native-webview';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { games as gamesApi } from '../services/api';
import { getAdFrequency, initializeAds, showInterstitial, loadInterstitial } from '../services/ads';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GAMES_HOST = 'https://gametok-games.pages.dev';
const TAB_BAR_HEIGHT = 50; // Base tab bar height (insets.bottom added dynamically)
const BOTTOM_ZONE_HEIGHT = SCREEN_HEIGHT * 0.10;
const SWIPE_THRESHOLD = 50;

interface Game {
  id: string;
  name: string;
  embedUrl?: string;
}

// Feed is now just games - no ad placeholders
interface FeedItem {
  game: Game;
  id: string;
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
  // Pause HTML5 audio/video
  document.querySelectorAll('audio, video').forEach(el => { try { el.pause(); } catch(e){} });
  
  // Suspend Web Audio API (used by Unity)
  if (window.AudioContext || window.webkitAudioContext) {
    // Find and suspend all audio contexts
    if (window._audioContexts) {
      window._audioContexts.forEach(ctx => { try { ctx.suspend(); } catch(e){} });
    }
  }
  
  // Mute Unity specifically
  if (window.unityInstance) {
    try { window.unityInstance.SendMessage('AudioManager', 'Mute'); } catch(e) {}
  }
  
  // Global mute fallback - set all gain nodes to 0
  if (window._masterGain) {
    try { window._masterGain.gain.value = 0; } catch(e) {}
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
    window.Phaser.GAMES.forEach(g => g.scene && g.scene.pause && g.scene.pause());
  }
  if (window.createjs && window.createjs.Ticker) {
    window.createjs.Ticker.paused = true;
  }
  
  window._gamePaused = true;
})();
true;
`;

// Script to resume/unfreeze a game
const RESUME_SCRIPT = `
(function() {
  // Resume HTML5 audio/video
  document.querySelectorAll('audio, video').forEach(el => { try { if(el.dataset.wasPlaying) el.play(); } catch(e){} });
  
  // Resume Web Audio API
  if (window._audioContexts) {
    window._audioContexts.forEach(ctx => { try { ctx.resume(); } catch(e){} });
  }
  
  // Unmute Unity
  if (window.unityInstance) {
    try { window.unityInstance.SendMessage('AudioManager', 'Unmute'); } catch(e) {}
  }
  
  // Restore master gain
  if (window._masterGain && window._originalGain !== undefined) {
    try { window._masterGain.gain.value = window._originalGain; } catch(e) {}
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
    window.Phaser.GAMES.forEach(g => g.scene && g.scene.resume && g.scene.resume());
  }
  if (window.createjs && window.createjs.Ticker) {
    window.createjs.Ticker.paused = false;
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
  
  // Track audio contexts for pause/resume
  window._audioContexts = [];
  const OrigAudioContext = window.AudioContext || window.webkitAudioContext;
  if (OrigAudioContext) {
    window.AudioContext = window.webkitAudioContext = function() {
      const ctx = new OrigAudioContext();
      window._audioContexts.push(ctx);
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

// Shuffle array randomly (Fisher-Yates)
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Create feed with just games (no ad placeholders)
const createFeed = (games: Game[]): FeedItem[] => {
  // Shuffle games for variety
  const shuffledGames = shuffleArray(games);
  
  return shuffledGames.map((game, index) => ({
    game,
    id: `${game.id}-${index}`,
  }));
};

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scrollEnabled, setScrollEnabled] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const hintOpacity = useRef(new Animated.Value(1)).current;
  
  // Store original games for infinite loop
  const allGamesRef = useRef<Game[]>([]);
  const feedCycleRef = useRef(0);
  
  // Track games played for ad frequency
  const gamesPlayedRef = useRef(0);
  
  // Track liked games
  const [likedGames, setLikedGames] = useState<Set<string>>(new Set());
  
  // Calculate actual content height (screen minus tab bar)
  const contentHeight = SCREEN_HEIGHT - TAB_BAR_HEIGHT - insets.bottom;
  
  // Handle like
  const handleLike = (gameId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLikedGames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gameId)) {
        newSet.delete(gameId);
      } else {
        newSet.add(gameId);
      }
      return newSet;
    });
  };
  
  // Handle share
  const handleShare = async (game: Game) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Check out ${game.name} on GameTOK! 🎮`,
        url: `https://gametok.app/game/${game.id}`,
      });
    } catch (e) {}
  };
  
  // Handle comment (placeholder for now)
  const handleComment = (gameId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Open comments modal
  };
  
  const currentIndexRef = useRef(0);
  const feedRef = useRef<FeedItem[]>([]);
  const translateY = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);
  const webViewRefs = useRef<{ [key: string]: WebViewType | null }>({});
  const prevIndexRef = useRef(0);

  // Pause/resume WebViews when index changes
  useEffect(() => {
    const prevIdx = prevIndexRef.current;
    const currIdx = currentIndex;
    
    if (prevIdx !== currIdx) {
      // Pause the previous game
      const prevItem = feed[prevIdx];
      if (prevItem && webViewRefs.current[prevItem.id]) {
        webViewRefs.current[prevItem.id]?.injectJavaScript(PAUSE_SCRIPT);
      }
      
      // Resume the current game
      const currItem = feed[currIdx];
      if (currItem && webViewRefs.current[currItem.id]) {
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

  // Show hint for 4 seconds then fade out
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(hintOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => setShowHint(false));
    }, 4000);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const init = async () => {
      // Initialize ads SDK
      await initializeAds();
      
      // Preload first interstitial
      await loadInterstitial();
      
      // Fetch games
      try {
        const data = await gamesApi.list(50);
        if (data.games?.length > 0) {
          allGamesRef.current = data.games;
          setFeed(createFeed(data.games));
        }
      } catch (e) {
        const fallbackGames = [
          { id: 'flappy-bird', name: 'Flappy Bird' },
          { id: 'fruit-slicer', name: 'Fruit Slicer' },
          { id: 'tetris', name: 'Tetris' },
        ];
        allGamesRef.current = fallbackGames;
        setFeed(createFeed(fallbackGames));
      } finally {
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
            
            const newItems: FeedItem[] = data.games.map((game: Game, index: number) => ({
              game,
              id: `${game.id}-cycle${cycle}-${index}`,
            }));
            
            setFeed(prev => [...prev, ...newItems]);
          }
        } catch (e) {
          // If fetch fails, just loop existing games
          feedCycleRef.current += 1;
          const cycle = feedCycleRef.current;
          
          const shuffledGames = shuffleArray(allGamesRef.current);
          const newItems: FeedItem[] = shuffledGames.map((game, index) => ({
            game,
            id: `${game.id}-cycle${cycle}-${index}`,
          }));
          
          setFeed(prev => [...prev, ...newItems]);
        }
      };
      
      fetchMoreGames();
    }
  }, [currentIndex, feed.length, loading]);

  const animateToIndex = async (newIndex: number) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    
    const direction = newIndex > currentIndexRef.current ? -1 : 1;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Track games played and show interstitial every N games (only when swiping forward)
    if (newIndex > currentIndexRef.current) {
      gamesPlayedRef.current += 1;
      const adFrequency = getAdFrequency();
      
      if (gamesPlayedRef.current % adFrequency === 0) {
        // Show interstitial ad
        await showInterstitial();
      }
    }
    
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

  const bottomPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        setScrollEnabled(true);
        return true;
      },
      onMoveShouldSetPanResponder: () => true,
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
        } else if (gestureState.dy > SWIPE_THRESHOLD && idx > 0) {
          animateToIndex(idx - 1);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          // Keep scrollEnabled true - only disable on tap
        }
      },
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
        } else if (gestureState.dy > SWIPE_THRESHOLD && idx > 0) {
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
  const visibleItems = useMemo(() => {
    const result: { item: FeedItem; position: number }[] = [];
    
    if (feed[currentIndex - 1]) {
      result.push({ item: feed[currentIndex - 1], position: -1 });
    }
    if (feed[currentIndex]) {
      result.push({ item: feed[currentIndex], position: 0 });
    }
    if (feed[currentIndex + 1]) {
      result.push({ item: feed[currentIndex + 1], position: 1 });
    }
    // Preload one more ahead so games load while viewing ads
    if (feed[currentIndex + 2]) {
      result.push({ item: feed[currentIndex + 2], position: 2 });
    }
    
    return result;
  }, [feed, currentIndex]);

  if (loading) {
    return <View style={styles.container} />;
  }

  if (feed.length === 0) return null;

  return (
    <View style={styles.container}>
      {visibleItems.map(({ item, position }) => (
        <Animated.View 
          key={item.id}
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
          <WebView
            ref={(ref) => { webViewRefs.current[item.id] = ref; }}
            source={{ uri: getGameUrl(item.game) }}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            thirdPartyCookiesEnabled={!isExternalGame(item.game)}
            sharedCookiesEnabled={false}
            injectedJavaScriptBeforeContentLoaded={isExternalGame(item.game) ? AD_BLOCKER_SCRIPT : undefined}
            onMessage={() => {}} // Suppress messages
            javaScriptCanOpenWindowsAutomatically={false}
            setSupportMultipleWindows={false}
            onLoad={() => {
              // Auto-pause if not the current game
              if (position !== 0 && webViewRefs.current[item.id]) {
                webViewRefs.current[item.id]?.injectJavaScript(PAUSE_SCRIPT);
              }
            }}
            onShouldStartLoadWithRequest={(request) => {
              if (isExternalGame(item.game)) {
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
          {/* TikTok-style action buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => handleLike(item.game.id)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={likedGames.has(item.game.id) ? "heart" : "heart-outline"} 
                size={35} 
                color={likedGames.has(item.game.id) ? "#ff2d55" : "#fff"} 
              />
              <Text style={styles.actionCount}>{likedGames.has(item.game.id) ? '1' : '0'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => handleComment(item.game.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-ellipses" size={33} color="#fff" />
              <Text style={styles.actionCount}>0</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => handleShare(item.game)}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-redo" size={33} color="#fff" />
              <Text style={styles.actionCount}>Share</Text>
            </TouchableOpacity>
          </View>
          
          {/* Game name - bottom left */}
          <View style={styles.gameInfo}>
            <Text style={styles.gameName}>{item.game.name}</Text>
          </View>
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
      
      <View style={styles.bottomZone} {...bottomPanResponder.panHandlers} />
      
      {/* Swipe hint - shows on app open */}
      {showHint && (
        <Animated.View style={[styles.hintContainer, { opacity: hintOpacity }]} pointerEvents="none">
          <View style={styles.hintGlow} />
          <Text style={styles.hintText}>Swipe from bottom to browse</Text>
        </Animated.View>
      )}
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  hintText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginBottom: 10,
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
    right: 8,
    bottom: 140,
    alignItems: 'center',
    zIndex: 10,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 18,
  },
  actionCount: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gameInfo: {
    position: 'absolute',
    left: 12,
    bottom: 100,
    right: 70,
    zIndex: 10,
  },
  gameName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
