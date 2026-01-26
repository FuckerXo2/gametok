import React, { useRef, useState, useCallback, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Dimensions, 
  Text, 
  TouchableOpacity, 
  Animated,
  ActivityIndicator,
  StatusBar,
  Platform,
  NativeModules,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { scores, messages } from '../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MultiplayerModal } from './MultiplayerModal';
import { ShareSheet } from './ShareSheet';

const { WebViewScrollDisabler } = NativeModules;

// WebView wrapper with error boundary
const SafeWebView: React.FC<any> = (props) => {
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), Platform.OS === 'ios' ? 100 : 0);
    return () => clearTimeout(timer);
  }, []);
  
  if (hasError) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="game-controller-outline" size={48} color="#666" />
        <Text style={{ color: '#666', marginTop: 12, fontSize: 14 }}>Game unavailable</Text>
      </View>
    );
  }
  
  if (!isReady) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }
  
  return (
    <WebView
      {...props}
      onError={() => setHasError(true)}
      onHttpError={() => setHasError(true)}
    />
  );
};

const MULTIPLAYER_GAMES = [
  'tic-tac-toe', 'connect4', 'chess', 'rock-paper-scissors', 'pong',
  'tetris', '2048', 'flappy-bird', 'pacman', 'fruit-slicer',
  'piano-tiles', 'doodle-jump', 'geometry-dash', 'endless-runner',
  'crossy-road', 'breakout', 'ball-bounce', 'whack-a-mole', 'aim-trainer',
  'reaction-time', 'color-match', 'memory-match', 'tap-tap-dash',
  'number-tap', 'bubble-pop', 'simon-says', 'basketball', 'golf-putt',
  'snake-io', 'asteroids', 'space-invaders', 'missile-game', 'hexgl',
  'racer', 'clumsy-bird', 'hextris', 'tower-game',
];

const GAMES_WITH_OWN_PLAY_BUTTON: string[] = [
  'simon-says', 'basketball', 'block-blast', 'memory-match',
  'tower-blocks-3d', 'rock-paper-scissors', 'towermaster', 'hextris',
];

const useScreenDimensions = () => {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);
  
  return dimensions;
};

interface GameCardProps {
  game: {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    category?: string;
    thumbnail?: string;
  };
  gameUrl: string;
  isActive: boolean;
  isPreloading?: boolean;
  onPlayingChange?: (isPlaying: boolean) => void;
  isScrollMode?: boolean;
  useExternalWebView?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({ 
  game, 
  gameUrl, 
  isActive, 
  isPreloading = false, 
  onPlayingChange,
  isScrollMode = false,
  useExternalWebView = false,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const { width: screenWidth, height: screenHeight } = useScreenDimensions();
  
  const [score, setScore] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 500) + 50);
  const [shareCount] = useState(Math.floor(Math.random() * 100) + 10);
  const [gameLoaded, setGameLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  
  const heartScale = useRef(new Animated.Value(1)).current;
  const scrollModeOpacity = useRef(new Animated.Value(0)).current;
  
  const isMultiplayerGame = MULTIPLAYER_GAMES.includes(game.id);
  const isExternalGame = !!gameUrl.includes('gd_sdk_referrer_url');
  const hasOwnPlayButton = GAMES_WITH_OWN_PLAY_BUTTON.includes(game.id) || isExternalGame;
  
  void colors;
  void insets;

  // Animate scroll mode overlay
  useEffect(() => {
    Animated.timing(scrollModeOpacity, {
      toValue: isScrollMode ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [isScrollMode, scrollModeOpacity]);

  // Pause/mute when not active or preloading
  useEffect(() => {
    if (!isActive) {
      // Aggressively mute everything for non-active games
      webViewRef.current?.injectJavaScript(`
        // Try standard pause functions
        if (window.pauseGame) window.pauseGame();
        if (window.pause) window.pause();
        if (window.gamePause) window.gamePause();
        
        // Mute and pause ALL audio/video
        document.querySelectorAll('audio, video').forEach(el => {
          el.pause();
          el.muted = true;
          el.volume = 0;
        });
        
        // Suspend AudioContext
        if (window.AudioContext || window.webkitAudioContext) {
          if (window._audioContexts) {
            window._audioContexts.forEach(ctx => ctx.suspend());
          }
        }
        
        // Freeze animation frames
        if (!window._gametokPaused) {
          window._gametokPaused = true;
          window._originalRAF = window.requestAnimationFrame;
          window.requestAnimationFrame = function() { return 0; };
        }
        
        // Set global mute flag
        window._gametokMuted = true;
        true;
      `);
    } else if (isActive && !isPreloading) {
      webViewRef.current?.injectJavaScript(`
        // Restore animation frames
        if (window._gametokPaused && window._originalRAF) {
          window.requestAnimationFrame = window._originalRAF;
          window._gametokPaused = false;
        }
        
        // Resume AudioContext
        if (window._audioContexts) {
          window._audioContexts.forEach(ctx => ctx.resume());
        }
        
        // Unmute audio
        window._gametokMuted = false;
        document.querySelectorAll('audio, video').forEach(el => {
          el.muted = false;
          el.volume = 1;
        });
        true;
      `);
    }
  }, [isActive, isPreloading]);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'gameOver') {
        setScore(data.score);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (data.score > 0) scores.submit(game.id, data.score).catch(() => {});
      } else if (data.type === 'score') {
        setScore(data.score);
      }
    } catch (e) {}
  }, [game.id]);

  const handlePlay = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPlaying(true);
    onPlayingChange?.(true);
    webViewRef.current?.injectJavaScript(`
      if (window.startGame) window.startGame();
      if (window.start) window.start();
      true;
    `);
  }, [onPlayingChange]);

  const handleLike = useCallback(() => {
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setLikeCount(prev => newLiked ? prev + 1 : prev - 1);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, speed: 50 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 50 }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [isLiked, heartScale]);

  const handleShare = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowShareSheet(true);
  }, []);

  const handleSendToFriend = useCallback(async (friendId: string, gameId: string, isChallenge?: boolean) => {
    try {
      await messages.send({ recipientId: friendId, gameShare: { gameId } });
      void isChallenge;
    } catch (e) {
      console.error('Failed to send game:', e);
    }
  }, []);

  const handleSave = useCallback(() => {
    setIsSaved(prev => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

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
      
      // Disable selection and context menu
      var style = document.createElement('style');
      style.textContent = \`
        html, body { overflow: hidden !important; -webkit-user-select: none !important; }
        /* Hide all ad containers */
        [class*="ad-"], [class*="ads-"], [class*="advert"], [id*="ad-"], [id*="ads-"], [id*="advert"],
        [class*="preroll"], [id*="preroll"], [class*="interstitial"], [id*="interstitial"],
        .gdsdk, #gdsdk, #sdk__advertisement, ins.adsbygoogle,
        [class*="ad_container"], [id*="ad_container"], [class*="adContainer"], [id*="adContainer"],
        iframe[src*="ads"], iframe[src*="doubleclick"], iframe[src*="googlesyndication"],
        [class*="banner"], [id*="banner"], [class*="sponsor"], [id*="sponsor"],
        div[data-ad], div[data-ads], [class*="AdSlot"], [class*="ad-slot"],
        [class*="video-ad"], [id*="video-ad"], [class*="rewarded"], [id*="rewarded"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          width: 0 !important;
          height: 0 !important;
          position: absolute !important;
          left: -9999px !important;
        }
      \`;
      document.head.appendChild(style);
      document.addEventListener('contextmenu', e => e.preventDefault(), true);
      
      // Mute on load for preloaded games
      document.querySelectorAll('audio, video').forEach(el => {
        el.muted = true;
        el.volume = 0;
      });
      
      // Aggressive fake SDK
      var fakeSDK = {
        showBanner: function() { return Promise.resolve(); },
        hideBanner: function() { return Promise.resolve(); },
        showAd: function(type) { 
          console.log('Ad blocked:', type);
          if (window.sdk && window.sdk.onResumeGame) window.sdk.onResumeGame();
          return Promise.resolve(); 
        },
        preloadAd: function() { return Promise.resolve(); },
        preloadRewarded: function() { return Promise.resolve(); },
        showRewarded: function() { 
          if (window.sdk && window.sdk.onResumeGame) window.sdk.onResumeGame();
          return Promise.resolve({ success: true }); 
        },
        addEventListener: function() {},
        removeEventListener: function() {},
        onPauseGame: function() {},
        onResumeGame: function() {},
        isAdBlocked: false,
        hasRewarded: true,
      };
      window.sdk = fakeSDK;
      window.SDK = fakeSDK;
      window.gdsdk = fakeSDK;
      window.GD = fakeSDK;
      
      // Block ad scripts from running
      var origCreate = document.createElement;
      document.createElement = function(tag) {
        var el = origCreate.call(document, tag);
        if (tag.toLowerCase() === 'script') {
          var origSetAttr = el.setAttribute;
          el.setAttribute = function(name, value) {
            if (name === 'src' && value && (
              value.includes('googlesyndication') || 
              value.includes('doubleclick') || 
              value.includes('googleads') ||
              value.includes('adservice') ||
              value.includes('imasdk')
            )) {
              console.log('Blocked ad script:', value);
              return;
            }
            return origSetAttr.call(el, name, value);
          };
        }
        return el;
      };
      
      // Periodically hide any ads that slip through
      setInterval(function() {
        var adSelectors = [
          'iframe[src*="ads"]', 'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]',
          '[class*="preroll"]', '[id*="preroll"]', '[class*="interstitial"]', '[id*="interstitial"]',
          '.gdsdk', '#gdsdk', '#sdk__advertisement', 'ins.adsbygoogle',
          '[class*="ad_container"]', '[id*="ad_container"]', '[class*="video-ad"]', '[id*="video-ad"]'
        ];
        adSelectors.forEach(function(sel) {
          try {
            document.querySelectorAll(sel).forEach(function(el) {
              el.style.display = 'none';
              el.remove();
            });
          } catch(e) {}
        });
      }, 1000);
    })();
    true;
  `;

  return (
    <View style={[styles.container, { width: screenWidth, height: screenHeight }]}>
      <StatusBar hidden={false} barStyle="light-content" />
      
      <View style={styles.gameArea}>
        <View style={styles.gameFrame}>
          {/* WebView - only render if NOT using external pool */}
          {!useExternalWebView && (isActive || isPreloading) && (
            <View style={[StyleSheet.absoluteFill, !isActive && styles.hiddenWebView]}>
              <SafeWebView
                ref={webViewRef}
                source={{ uri: gameUrl }}
                style={styles.webView}
                scrollEnabled={false}
                bounces={false}
                overScrollMode="never"
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                onLoadEnd={() => {
                  setGameLoaded(true);
                  if (Platform.OS === 'ios' && WebViewScrollDisabler?.disableScrollGestures) {
                    setTimeout(() => WebViewScrollDisabler.disableScrollGestures(), 100);
                  }
                }}
                onMessage={handleMessage}
                javaScriptEnabled
                domStorageEnabled
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                injectedJavaScript={injectedJS}
                onShouldStartLoadWithRequest={(request: { url: string }) => {
                  const url = request.url.toLowerCase();
                  // Block all ad-related URLs
                  const adPatterns = [
                    'googlesyndication', 'doubleclick', 'googleads', 'adservice',
                    'pagead', 'adsense', 'adnxs', 'advertising', '/ads/', '/ad/',
                    'imasdk.googleapis', 'googleadservices', 'adcolony', 'applovin',
                    'unity3d.com/ads', 'unityads', 'vungle', 'chartboost', 'ironsource',
                    'mopub', 'admob', 'facebook.com/tr', 'fbcdn', 'amazon-adsystem',
                    'criteo', 'taboola', 'outbrain', 'revcontent', 'mgid',
                  ];
                  if (adPatterns.some(pattern => url.includes(pattern))) {
                    console.log('Blocked ad URL:', url);
                    return false;
                  }
                  return true;
                }}
              />
            </View>
          )}
          
          {/* Play button overlay */}
          {!isPlaying && !hasOwnPlayButton && (
            <TouchableOpacity style={styles.playOverlay} onPress={handlePlay} activeOpacity={0.9}>
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.2)']} style={StyleSheet.absoluteFill} />
              <View style={styles.playButton}>
                <Ionicons name="play" size={36} color="#fff" style={{ marginLeft: 4 }} />
              </View>
            </TouchableOpacity>
          )}
          
          {/* Transparent tap for games with own play button */}
          {!isPlaying && hasOwnPlayButton && (
            <TouchableOpacity style={styles.playOverlay} onPress={handlePlay} activeOpacity={1} />
          )}
          
          {/* Loading indicator */}
          {!gameLoaded && isActive && !isPreloading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
          
          {/* Score badge */}
          {isPlaying && score > 0 && (
            <View style={styles.scoreOverlay}>
              <Ionicons name="trophy" size={16} color="#FFD700" />
              <Text style={styles.scoreText}>{formatNumber(score)}</Text>
            </View>
          )}
          
          {/* Side Actions */}
          <View style={styles.sideActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={32} 
                  color={isLiked ? '#FF6B6B' : '#fff'} 
                  style={styles.iconShadow}
                />
              </Animated.View>
              <Text style={styles.actionCount}>{formatNumber(likeCount)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
              <Ionicons name="arrow-redo" size={30} color="#fff" style={styles.iconShadow} />
              <Text style={styles.actionCount}>{formatNumber(shareCount)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleSave} activeOpacity={0.7}>
              <Ionicons 
                name={isSaved ? "bookmark" : "bookmark-outline"} 
                size={30} 
                color={isSaved ? '#FFD700' : '#fff'} 
                style={styles.iconShadow}
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              activeOpacity={0.7}
            >
              <Ionicons name="trophy" size={30} color="#FFD700" style={styles.iconShadow} />
            </TouchableOpacity>
          </View>

          {/* Game name overlay */}
          <View style={styles.gameNameOverlay}>
            <View style={styles.gameNameContainer}>
              <Text style={styles.gameName} numberOfLines={1}>{game.name}</Text>
              {isMultiplayerGame && (
                <View style={styles.multiplayerBadge}>
                  <Ionicons name="people" size={10} color="#fff" />
                </View>
              )}
            </View>
            {score > 0 && !isPlaying && (
              <View style={styles.highScoreBadge}>
                <Text style={styles.highScoreText}>Best: {formatNumber(score)}</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Scroll mode dim overlay */}
        <Animated.View 
          style={[styles.scrollModeOverlay, { opacity: scrollModeOpacity }]} 
          pointerEvents="none"
        />
      </View>

      <MultiplayerModal
        visible={showMultiplayer}
        gameId={game.id}
        gameName={game.name}
        onClose={() => setShowMultiplayer(false)}
      />

      <ShareSheet
        visible={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        gameId={game.id}
        gameName={game.name}
        gameIcon={game.icon}
        gameColor={game.color}
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
  gameArea: {
    ...StyleSheet.absoluteFillObject,
  },
  gameFrame: {
    flex: 1,
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  preloadingWebView: {
    opacity: 0,
    pointerEvents: 'none',
  },
  hiddenWebView: {
    opacity: 0,
    pointerEvents: 'none',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  scoreOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  scoreText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  sideActions: {
    position: 'absolute',
    right: 10,
    bottom: 20,
    alignItems: 'center',
    gap: 16,
  },
  actionBtn: {
    alignItems: 'center',
  },
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  actionCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gameNameOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  gameName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  multiplayerBadge: {
    backgroundColor: '#ff2d55',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  highScoreBadge: {
    backgroundColor: 'rgba(255,215,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  highScoreText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollModeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 100,
  },
});

export default GameCard;
