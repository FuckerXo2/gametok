import React, { useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PooledWebView {
  id: string;
  url: string;
  loaded: boolean;
  ref: React.RefObject<WebView | null>;
}

interface WebViewPoolProps {
  onMessage?: (gameId: string, data: any) => void;
  isScrollMode?: boolean;
}

export interface WebViewPoolHandle {
  preloadGame: (id: string, url: string) => void;
  getActiveWebView: (id: string) => React.RefObject<WebView | null> | null;
  setActiveGame: (id: string) => void;
  isGameLoaded: (id: string) => boolean;
  injectJS: (id: string, js: string) => void;
}

const POOL_SIZE = 4;

const injectedJS = `
  (function() {
    // Viewport
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    
    // Start muted - will be unmuted when active
    window._gametokMuted = true;
    
    // Intercept Audio constructor
    var OriginalAudio = window.Audio;
    window.Audio = function(src) {
      var audio = new OriginalAudio(src);
      audio.muted = window._gametokMuted;
      audio.volume = window._gametokMuted ? 0 : 1;
      var origPlay = audio.play.bind(audio);
      audio.play = function() {
        if (window._gametokMuted) {
          return Promise.resolve();
        }
        return origPlay();
      };
      return audio;
    };
    
    // Intercept AudioContext
    var OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
    if (OriginalAudioContext) {
      window._audioContexts = [];
      window.AudioContext = window.webkitAudioContext = function() {
        var ctx = new OriginalAudioContext();
        window._audioContexts.push(ctx);
        if (window._gametokMuted) {
          ctx.suspend();
        }
        return ctx;
      };
    }
    
    // Mute existing elements
    document.querySelectorAll('audio, video').forEach(el => {
      el.muted = true;
      el.volume = 0;
    });
    
    // Observer for new audio/video elements
    var observer = new MutationObserver(function(mutations) {
      if (window._gametokMuted) {
        document.querySelectorAll('audio, video').forEach(el => {
          el.muted = true;
          el.volume = 0;
          el.pause();
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Disable selection and context menu
    var style = document.createElement('style');
    style.textContent = \`
      html, body { overflow: hidden !important; -webkit-user-select: none !important; }
      [class*="ad-"], [class*="ads-"], [class*="advert"], [id*="ad-"], [id*="ads-"],
      [class*="preroll"], [id*="preroll"], [class*="interstitial"], [id*="interstitial"],
      .gdsdk, #gdsdk, #sdk__advertisement, ins.adsbygoogle,
      iframe[src*="ads"], iframe[src*="doubleclick"], iframe[src*="googlesyndication"] {
        display: none !important;
        visibility: hidden !important;
      }
    \`;
    document.head.appendChild(style);
    document.addEventListener('contextmenu', e => e.preventDefault(), true);
    
    // Fake SDK
    var fakeSDK = {
      showBanner: function() { return Promise.resolve(); },
      hideBanner: function() { return Promise.resolve(); },
      showAd: function() { 
        if (window.sdk && window.sdk.onResumeGame) window.sdk.onResumeGame();
        return Promise.resolve(); 
      },
      preloadAd: function() { return Promise.resolve(); },
      showRewarded: function() { return Promise.resolve({ success: true }); },
      addEventListener: function() {},
      removeEventListener: function() {},
    };
    window.sdk = window.SDK = window.gdsdk = window.GD = fakeSDK;
  })();
  true;
`;

export const WebViewPool = forwardRef<WebViewPoolHandle, WebViewPoolProps>(({ onMessage, isScrollMode = true }, ref) => {
  const [pool, setPool] = useState<PooledWebView[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const webViewRefs = useRef<Map<string, React.RefObject<WebView | null>>>(new Map());

  const getOrCreateRef = (id: string): React.RefObject<WebView | null> => {
    if (!webViewRefs.current.has(id)) {
      webViewRefs.current.set(id, React.createRef<WebView>());
    }
    return webViewRefs.current.get(id)!;
  };

  const preloadGame = useCallback((id: string, url: string) => {
    setPool(prev => {
      // Already in pool?
      if (prev.find(p => p.id === id)) return prev;
      
      // Add to pool
      const newEntry: PooledWebView = {
        id,
        url,
        loaded: false,
        ref: getOrCreateRef(id),
      };
      
      // If pool is full, remove oldest non-active entry
      if (prev.length >= POOL_SIZE) {
        const toRemove = prev.find(p => p.id !== activeId);
        if (toRemove) {
          webViewRefs.current.delete(toRemove.id);
          return [...prev.filter(p => p.id !== toRemove.id), newEntry];
        }
      }
      
      return [...prev, newEntry];
    });
  }, [activeId]);

  const setActiveGame = useCallback((id: string) => {
    // Mute previous active
    if (activeId && activeId !== id) {
      const prevRef = webViewRefs.current.get(activeId);
      prevRef?.current?.injectJavaScript(`
        window._gametokMuted = true;
        document.querySelectorAll('audio, video').forEach(el => {
          el.muted = true;
          el.volume = 0;
          el.pause();
        });
        if (window._audioContexts) {
          window._audioContexts.forEach(ctx => ctx.suspend());
        }
        true;
      `);
    }
    
    // Unmute new active
    const newRef = webViewRefs.current.get(id);
    newRef?.current?.injectJavaScript(`
      window._gametokMuted = false;
      document.querySelectorAll('audio, video').forEach(el => {
        el.muted = false;
        el.volume = 1;
      });
      if (window._audioContexts) {
        window._audioContexts.forEach(ctx => ctx.resume());
      }
      true;
    `);
    
    setActiveId(id);
  }, [activeId]);

  const getActiveWebView = useCallback((id: string) => {
    return webViewRefs.current.get(id) || null;
  }, []);

  const isGameLoaded = useCallback((id: string) => {
    return pool.find(p => p.id === id)?.loaded || false;
  }, [pool]);

  const injectJS = useCallback((id: string, js: string) => {
    const ref = webViewRefs.current.get(id);
    ref?.current?.injectJavaScript(js);
  }, []);

  useImperativeHandle(ref, () => ({
    preloadGame,
    getActiveWebView,
    setActiveGame,
    isGameLoaded,
    injectJS,
  }), [preloadGame, getActiveWebView, setActiveGame, isGameLoaded, injectJS]);

  const handleLoadEnd = (id: string) => {
    setPool(prev => prev.map(p => p.id === id ? { ...p, loaded: true } : p));
  };

  const handleMessage = (id: string, event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      onMessage?.(id, data);
    } catch (e) {}
  };

  return (
    <View style={styles.poolContainer} pointerEvents="box-none">
      {pool.map(item => (
        <View
          key={item.id}
          style={[
            styles.webViewWrapper,
            item.id === activeId ? styles.activeWebView : styles.hiddenWebView,
          ]}
          pointerEvents={item.id === activeId && !isScrollMode ? 'auto' : 'none'}
        >
          <WebView
            ref={item.ref}
            source={{ uri: item.url }}
            style={styles.webView}
            scrollEnabled={false}
            bounces={false}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            injectedJavaScript={injectedJS}
            onLoadEnd={() => handleLoadEnd(item.id)}
            onMessage={(e) => handleMessage(item.id, e)}
            onShouldStartLoadWithRequest={(request) => {
              const url = request.url.toLowerCase();
              const adPatterns = ['googlesyndication', 'doubleclick', 'googleads', 'adservice', 'imasdk'];
              return !adPatterns.some(p => url.includes(p));
            }}
          />
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  poolContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  webViewWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  activeWebView: {
    opacity: 1,
    zIndex: 10,
  },
  hiddenWebView: {
    opacity: 0,
    zIndex: 1,
    // Position offscreen to prevent any visual glitches
    transform: [{ translateX: -9999 }],
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default WebViewPool;
