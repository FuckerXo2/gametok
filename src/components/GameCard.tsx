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

// WebView wrapper with error boundary for iOS 26.x crash workaround
const SafeWebView: React.FC<any> = (props) => {
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, Platform.OS === 'ios' ? 100 : 0);
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

// Games that have their own play/start button UI - don't show our overlay
const GAMES_WITH_OWN_PLAY_BUTTON: string[] = [
  'simon-says',
  'basketball',
  'block-blast',
  'memory-match',
  'tower-blocks-3d',
  'rock-paper-scissors', // Interactive from start
  'towermaster', // Auto-starts
  'hextris', // Auto-starts
];

// Bottom bar height (game name + actions)
const BOTTOM_BAR_HEIGHT = 120;

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
  };
  gameUrl: string;
  isActive: boolean;
  isPreloading?: boolean;
  onPlayingChange?: (isPlaying: boolean) => void;
}

export const GameCard: React.FC<GameCardProps> = ({ game, gameUrl, isActive, isPreloading = false, onPlayingChange }) => {
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
  const isMultiplayerGame = MULTIPLAYER_GAMES.includes(game.id);
  // External games (with embedUrl) have their own play buttons
  const isExternalGame = !!gameUrl.includes('gd_sdk_referrer_url');
  const hasOwnPlayButton = GAMES_WITH_OWN_PLAY_BUTTON.includes(game.id) || isExternalGame;
  
  void colors;

  // Calculate game area height (screen minus bottom bar and tab bar)
  const tabBarHeight = 80;
  const gameAreaHeight = screenHeight - BOTTOM_BAR_HEIGHT - insets.bottom - tabBarHeight;

  // Pause game and mute audio when not active OR when preloading
  useEffect(() => {
    if (!isActive || isPreloading) {
      webViewRef.current?.injectJavaScript(`
        // Pause game
        if (window.pauseGame) window.pauseGame();
        if (window.pause) window.pause();
        if (window.gamePause) window.gamePause();
        
        // Mute all audio immediately
        document.querySelectorAll('audio, video').forEach(function(el) {
          el.pause();
          el.muted = true;
          el.volume = 0;
        });
        
        // Stop Web Audio API
        if (window.AudioContext || window.webkitAudioContext) {
          try {
            if (window.audioContext) {
              window.audioContext.suspend();
            }
          } catch(e) {}
        }
        
        true;
      `);
    } else {
      // Unmute when active and not preloading
      webViewRef.current?.injectJavaScript(`
        document.querySelectorAll('audio, video').forEach(function(el) {
          el.muted = false;
          el.volume = 1;
        });
        
        if (window.audioContext) {
          try {
            window.audioContext.resume();
          } catch(e) {}
        }
        
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
      if (window.gameStart) window.gameStart();
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
      await messages.send({
        recipientId: friendId,
        gameShare: { gameId },
      });
      void isChallenge;
    } catch (e) {
      console.error('Failed to send game to friend:', e);
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

  return (
    <View style={[styles.container, { width: screenWidth, height: screenHeight }]}>
      <StatusBar hidden={false} barStyle="light-content" />
      
      {/* Game Area - doesn't go to bottom */}
      <View style={[styles.gameArea, { height: gameAreaHeight, marginTop: insets.top }]}>
        {/* Game WebView with rounded corners */}
        <View style={styles.gameFrame}>
          {/* Load WebView if active OR preloading next 3 games */}
          {(isActive || isPreloading) && (
            <SafeWebView
              ref={webViewRef}
              source={{ uri: gameUrl }}
              style={[styles.webView, isPreloading && styles.preloadingWebView]}
              scrollEnabled={false}
              bounces={false}
              onLoadEnd={() => setGameLoaded(true)}
              onMessage={handleMessage}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              scalesPageToFit={true}
              contentMode="mobile"
              onShouldStartLoadWithRequest={(request: { url: string }) => {
                const url = request.url.toLowerCase();
                if (
                  url.includes('googlesyndication') ||
                  url.includes('doubleclick') ||
                  url.includes('googleads') ||
                  url.includes('adservice') ||
                  url.includes('pagead') ||
                  url.includes('adsense') ||
                  url.includes('adnxs') ||
                  url.includes('advertising') ||
                  url.includes('banner') ||
                  url.includes('/ads/') ||
                  url.includes('/ad/') ||
                  url.includes('imasdk.googleapis')
                ) {
                  return false;
                }
                return true;
              }}
              injectedJavaScript={`
                var meta = document.querySelector('meta[name="viewport"]');
                if (!meta) {
                  meta = document.createElement('meta');
                  meta.name = 'viewport';
                  document.head.appendChild(meta);
                }
                meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
                
                // MUTE ALL AUDIO IMMEDIATELY ON LOAD (for preloaded games)
                document.querySelectorAll('audio, video').forEach(function(el) {
                  el.muted = true;
                  el.volume = 0;
                });
                
                // Disable all scrolling
                document.body.style.margin = '0';
                document.body.style.padding = '0';
                document.body.style.overflow = 'hidden';
                document.body.style.width = '100vw';
                document.body.style.height = '100vh';
                document.body.style.position = 'fixed';
                document.body.style.touchAction = 'none';
                document.documentElement.style.overflow = 'hidden';
                document.documentElement.style.touchAction = 'none';
                
                // Prevent scroll on touch
                document.addEventListener('touchmove', function(e) {
                  if (e.cancelable) {
                    e.preventDefault();
                  }
                }, { passive: false });
                
                var canvas = document.querySelector('canvas');
                if (canvas) {
                  canvas.style.width = '100vw';
                  canvas.style.height = '100vh';
                  canvas.style.objectFit = 'contain';
                  canvas.style.touchAction = 'auto';
                }
                (function() {
                  var fakeSDK = {
                    showBanner: function() { return Promise.resolve(); },
                    hideBanner: function() { return Promise.resolve(); },
                    showAd: function() { 
                      if (window.sdk && window.sdk.onResumeGame) window.sdk.onResumeGame();
                      return Promise.resolve(); 
                    },
                    preloadAd: function() { return Promise.resolve(); },
                    addEventListener: function() {},
                    removeEventListener: function() {},
                    onPauseGame: function() {},
                    onResumeGame: function() {}
                  };
                  window.sdk = window.sdk || fakeSDK;
                  Object.keys(fakeSDK).forEach(function(k) {
                    if (!window.sdk[k]) window.sdk[k] = fakeSDK[k];
                  });
                  var adSelectors = [
                    'iframe[src*="ads"]', 'iframe[src*="doubleclick"]',
                    'iframe[src*="googlesyndication"]', 'iframe[src*="adservice"]',
                    'iframe[src*="imasdk"]', 'iframe[src*="googleads"]',
                    '[class*="preroll"]', '[id*="preroll"]',
                    '[class*="interstitial"]', '[id*="interstitial"]',
                    '.gdsdk', '#gdsdk', '[class*="gdsdk"]',
                    '[class*="ad_container"]', '[id*="ad_container"]',
                    '[class*="ad-container"]', '[id*="ad-container"]',
                    '#sdk__advertisement', '[id*="sdk__"]',
                    '#imaContainer', '#imaContainer_new',
                    '[class*="Advertisement"]', '[class*="banner"]',
                    'ins.adsbygoogle', '.adsbygoogle',
                  ];
                  function hideAds() {
                    adSelectors.forEach(function(sel) {
                      try {
                        document.querySelectorAll(sel).forEach(function(el) {
                          el.style.display = 'none';
                          el.style.visibility = 'hidden';
                          el.style.height = '0';
                          el.style.width = '0';
                          el.style.position = 'absolute';
                          el.style.left = '-9999px';
                        });
                      } catch(e) {}
                    });
                  }
                  hideAds();
                  setInterval(hideAds, 300);
                  if (document.body) {
                    var observer = new MutationObserver(hideAds);
                    observer.observe(document.body, { childList: true, subtree: true });
                  }
                })();
                true;
              `}
            />
          )}
          
          {/* Play button overlay - only when not playing AND game doesn't have its own */}
          {!isPlaying && !hasOwnPlayButton && (
            <TouchableOpacity 
              style={styles.playOverlay} 
              onPress={handlePlay}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.2)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.playButton}>
                <Ionicons name="play" size={36} color="#fff" style={{ marginLeft: 4 }} />
              </View>
            </TouchableOpacity>
          )}
          
          {/* Transparent tap area for games with own play button */}
          {!isPlaying && hasOwnPlayButton && (
            <TouchableOpacity 
              style={styles.playOverlay} 
              onPress={handlePlay}
              activeOpacity={1}
            />
          )}
          
          {/* Loading indicator - only show if active and not loaded */}
          {!gameLoaded && isActive && !isPreloading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
          
          {/* Score badge when playing */}
          {isPlaying && score > 0 && (
            <View style={styles.scoreOverlay}>
              <Ionicons name="trophy" size={16} color="#FFD700" />
              <Text style={styles.scoreText}>{formatNumber(score)}</Text>
            </View>
          )}
          
          {/* Side Actions - TikTok style on right side */}
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
              <Ionicons 
                name="arrow-redo" 
                size={30} 
                color="#fff" 
                style={styles.iconShadow}
              />
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
        </View>
      </View>

      {/* Bottom Bar - Game name only */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + tabBarHeight }]}>
        <View style={styles.gameInfoRow}>
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
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  gameFrame: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  preloadingWebView: {
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
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  gameInfoRow: {
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
});

export default GameCard;
