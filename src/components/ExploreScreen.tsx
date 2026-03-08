import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Keyboard,
  RefreshControl,
  Dimensions,
  Image,
  Modal,
  StatusBar,
  FlatList,
  useColorScheme,
  Pressable,
} from 'react-native';
import Animated, { FadeInRight, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { WebView } from 'react-native-webview';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { games, users } from '../services/api';
import { FindFriendsModal } from './FindFriendsModal';
import { UserProfileModal } from './UserProfileModal';
import { Avatar } from './Avatar';
import { CategoryModal } from './CategoryModal';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useAuthScreen } from '../../App';
import { isExpoGo } from '../services/ads';
import { GameLoadingScreen } from './GameLoadingScreen';
import { LoopsBadges, LoopsIcons, BadgeSizes } from '../constants/LoopsBadges';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAMES_HOST = 'https://gametok-games.pages.dev';

// Theme colors matching the new design (clean, modern)
const themes = {
  light: {
    bg: '#ffffff',
    text: '#000000',
    textSecondary: '#666666',
    searchBg: '#f2f2f2',
    cardBg: '#f2f2f2',
    border: '#eeeeee',
    primary: '#a855f7', // Brand purple
  },
  dark: {
    bg: '#000000',
    text: '#ffffff',
    textSecondary: '#a1a1aa',
    searchBg: '#1f2937',
    cardBg: '#1f2937',
    border: '#333333',
    primary: '#a855f7',
  },
};

interface GameItem {
  id: string;
  name: string;
  thumbnail?: string;
  color?: string;
  category?: string;
  plays?: number;
  embedUrl?: string;
  _fakePlays?: number;
}

// No more MOCK_FRIENDS

const isExternalGame = (game: GameItem) => !!game.embedUrl;

const getGameUrl = (game: GameItem) => {
  if (game.embedUrl) {
    const sep = game.embedUrl.includes('?') ? '&' : '?';
    return `${game.embedUrl}${sep}gd_sdk_referrer_url=${encodeURIComponent(GAMES_HOST)}`;
  }
  // Make sure we correctly construct local Game URLs
  return `${GAMES_HOST}/${game.id}/`;
};

// Generate a consistent fake number for a game based on its ID
const getFakePlayCount = (gameId: string) => {
  let hash = 0;
  for (let i = 0; i < gameId.length; i++) {
    hash = ((hash << 5) - hash) + gameId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 1500000 + 10000;
};

// Ad blocker script from previous codebase
const AD_BLOCKER_SCRIPT = `
(function() {
  window.alert = function() {};
  window.confirm = function() { return true; };
  window.prompt = function() { return ''; };
  
  // Fake ad SDKs
  const fireCallbacks = (callbacks) => {
    if (!callbacks) return;
    callbacks.adStarted && callbacks.adStarted();
    callbacks.adFinished && callbacks.adFinished();
    callbacks.adReward && callbacks.adReward();
    callbacks.onComplete && callbacks.onComplete();
    callbacks.onReward && callbacks.onReward();
    callbacks.success && callbacks.success();
    callbacks.complete && callbacks.complete();
    callbacks.done && callbacks.done();
    callbacks.onClose && callbacks.onClose();
  };
  
  window.google = window.google || {};
  window.google.ima = {
    AdDisplayContainer: function() { this.initialize = function(){}; },
    AdsLoader: function() { this.addEventListener = function(){}; this.requestAds = function(){}; },
    AdsManager: function() { this.addEventListener = function(){}; this.init = function(){}; this.start = function(){}; },
    AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: 'adsManagerLoaded' } },
    AdErrorEvent: { Type: { AD_ERROR: 'adError' } },
    AdEvent: { Type: { CONTENT_PAUSE_REQUESTED: 'pause', CONTENT_RESUME_REQUESTED: 'resume', ALL_ADS_COMPLETED: 'complete' }},
    AdsRenderingSettings: function(){},
    AdsRequest: function(){},
  };
  
  window.sdk = {
    showBanner: () => Promise.resolve(),
    hideBanner: () => Promise.resolve(),
    showAd: (type, cb) => { fireCallbacks(cb); return Promise.resolve(); },
    showRewardedAd: (cb) => { fireCallbacks(cb); return Promise.resolve(); },
    preloadAd: (cb) => { cb && cb(); return Promise.resolve(); },
  };
  window.gdsdk = window.sdk;
  
  const removeAds = () => {
    const selectors = [
      'iframe[src*="ad"]', 'iframe[src*="doubleclick"]', '[class*="ad-"]', '[id*="ad-"]',
      '.gdsdk-container', '.advertisement', '.ad-overlay', '[class*="preroll"]',
      '.gm-loader', '.gm-splash', '[class*="gm-"]', '.loading-overlay', '.splash',
      '#unity-loading-bar', '.unity-loader', '[class*="unity-load"]',
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important;';
        try { el.remove(); } catch(e) {}
      });
    });
  };
  
  setInterval(removeAds, 200);
  setTimeout(removeAds, 0);
  setTimeout(removeAds, 100);
  setTimeout(removeAds, 500);
  setTimeout(removeAds, 1000);
  
  const style = document.createElement('style');
  style.textContent = \`
    html, body { margin:0!important; padding:0!important; width:100%!important; height:100%!important; overflow:hidden!important; }
    canvas, #game-container, .game-container, #unity-container { 
      width:100vw!important; height:100vh!important; position:fixed!important; top:0!important; left:0!important; 
    }
    .gm-loader, .gm-splash, [class*="gm-"], .loading-overlay, .splash, #unity-loading-bar, .unity-loader,
    [class*="loading-screen"], [class*="splash-screen"], .preloader, #preloader {
      display:none!important; visibility:hidden!important; opacity:0!important;
    }
  \`;
  document.head.appendChild(style);
})();
true;
`;

// Inject blurred game thumbnail as CSS background inside WebView
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


// Intelligent game ready detection script
const GAME_READY_SCRIPT = `
  (function () {
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

    const origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb) {
      rafCount++;
      if (rafCount >= 20 && !gameReady) notifyReady();
      return origRAF.call(window, cb);
    };

    const checkCanvas = () => {
    if (canvasFound) return;
    const canvases = document.querySelectorAll('canvas');
    for (const canvas of canvases) {
      if (canvas.width > 50 && canvas.height > 50) {
        const style = window.getComputedStyle(canvas);
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          canvasFound = true;
          // Canvas exists. Wait 1.5 seconds for it to render fully.
          setTimeout(() => { if (!gameReady) notifyReady(); }, 1500);
          break;
        }
      }
    }
  };

    const checkEngines = () => {
      if (window.unityInstance || window.Phaser?.GAMES?.[0]?.isRunning || window.PIXI?.Application || window.cr_getC2Runtime || window.C3 || window.gdjs?.runtimeGame) {
        notifyReady(); return true;
      }
      return false;
    };

    const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type) {
    if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
      canvasFound = true;
      setTimeout(() => { if (!gameReady) notifyReady(); }, 2000);
    }
    return origGetContext.apply(this, arguments);
  };

    window._gameReadyInterval = setInterval(() => {
    if (gameReady) {
      clearInterval(window._gameReadyInterval);
      window._gameReadyInterval = null;
      return;
    }
    checkCanvas();
    checkEngines();
    if (Date.now() - startTime > 3000 && rafCount > 60) notifyReady();
  }, 200);

    setTimeout(() => {
      if (!gameReady) notifyReady();
      if (window._gameReadyInterval) clearInterval(window._gameReadyInterval);
    }, 15000);
  })();
true;
`;

// Shared UI Components
const SectionHeader: React.FC<{ title: string; onChevronPress?: () => void; theme: any }> = ({ title, onChevronPress, theme }) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={styles.sectionHeader}
        onPress={onChevronPress}
        onPressIn={() => { if (onChevronPress) scale.value = withSpring(0.96, { damping: 12 }) }}
        onPressOut={() => { if (onChevronPress) scale.value = withSpring(1, { damping: 10 }) }}
        disabled={!onChevronPress}
      >
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
        {onChevronPress && (
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} style={{ marginTop: 2 }} />
        )}
      </Pressable>
    </Animated.View>
  );
};

const FriendCard: React.FC<{ friend?: any; isAdd?: boolean; theme: any; onPress?: () => void; onlineUsers?: string[]; index?: number }> = React.memo(({ friend, isAdd, theme, onPress, onlineUsers, index = 0 }) => {
  if (isAdd) {
    return (
      <AnimatedCard onPress={onPress || (() => { })} index={index} style={styles.friendCard}>
        <View style={[styles.friendAvatarContainer, { backgroundColor: theme.searchBg }]}>
          <Ionicons name="person-add-outline" size={24} color={theme.text} />
        </View>
        <Text style={[styles.friendName, { color: theme.text }]}>Add</Text>
      </AnimatedCard>
    );
  }

  return (
    <AnimatedCard onPress={onPress || (() => { })} index={index} style={styles.friendCard}>
      <View>
        <Avatar uri={friend.avatar} size={64} style={styles.friendAvatar} />
        {onlineUsers?.includes(friend.id) && <View style={[styles.onlineIndicator, { borderColor: theme.bg }]} />}
      </View>
      <Text style={[styles.friendName, { color: theme.text }]} numberOfLines={1}>{friend.displayName || friend.username}</Text>
      {friend.tag && <Text style={[styles.friendTag, { color: theme.textSecondary }]} numberOfLines={1}>{friend.tag}</Text>}
    </AnimatedCard>
  );
});

// Animated wrapper for press physics + staggered entrance
const AnimatedCard: React.FC<{ onPress: () => void; index?: number; children: React.ReactNode; style?: any }> = React.memo(({ onPress, index = 0, children, style }) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => { scale.value = withSpring(0.96, { damping: 12, stiffness: 200 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 10, stiffness: 250 }); };
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  // Optimize: Only animate the first few visible items
  const enteringAnim = index < 4 ? FadeInRight.delay(index * 60).springify().damping(18) : undefined;

  return (
    <Animated.View
      entering={enteringAnim}
      style={[style, animatedStyle]}
    >
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress}>
        {children}
      </Pressable>
    </Animated.View>
  );
});

// 1:1 Square Card for "Continue"
const SquareGameCard: React.FC<{ game: GameItem; onPress: () => void; theme: any; badge?: 'hot' | 'new' | 'like' | 'top1'; index?: number }> = React.memo(({ game, onPress, theme, badge, index }) => (
  <AnimatedCard onPress={onPress} index={index} style={styles.squareGameCard}>
    <View style={[styles.squareGameImgContainer, { backgroundColor: theme.cardBg }]}>
      {game.thumbnail ? (
        <Image source={{ uri: game.thumbnail }} style={styles.squareGameImg} />
      ) : (
        <Ionicons name="game-controller" size={32} color={theme.textSecondary} />
      )}
      {badge && (
        <Image
          source={LoopsBadges[badge]}
          style={{
            position: 'absolute',
            top: badge === 'top1' ? 6 : 8,
            right: badge === 'top1' ? 6 : 8,
            width: badge === 'top1' ? BadgeSizes.top1.width : BadgeSizes.hot.width,
            height: badge === 'top1' ? BadgeSizes.top1.height : BadgeSizes.hot.height,
          }}
          resizeMode="contain"
        />
      )}
    </View>
    <Text style={[styles.gameCardName, { color: theme.text }]} numberOfLines={1}>{game.name}</Text>
  </AnimatedCard>
));

// 16:9 Rectangular Card for "Recommended"
const RectGameCard: React.FC<{ game: GameItem; onPress: () => void; theme: any; badge?: 'hot' | 'new' | 'like' | 'top1'; index?: number }> = React.memo(({ game, onPress, theme, badge, index }) => (
  <AnimatedCard onPress={onPress} index={index} style={styles.rectGameCard}>
    <View style={[styles.rectGameImgContainer, { backgroundColor: theme.cardBg }]}>
      {game.thumbnail ? (
        <Image source={{ uri: game.thumbnail }} style={styles.rectGameImg} />
      ) : (
        <Ionicons name="game-controller" size={32} color={theme.textSecondary} />
      )}
      {badge && (
        <Image
          source={LoopsBadges[badge]}
          style={{
            position: 'absolute',
            top: badge === 'top1' ? 6 : 8,
            right: badge === 'top1' ? 6 : 8,
            width: badge === 'top1' ? BadgeSizes.top1.width : BadgeSizes.hot.width,
            height: badge === 'top1' ? BadgeSizes.top1.height : BadgeSizes.hot.height,
          }}
          resizeMode="contain"
        />
      )}
    </View>
    <Text style={[styles.gameCardName, { color: theme.text }]} numberOfLines={1}>{game.name}</Text>
  </AnimatedCard>
));

export const ExploreScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme === 'dark' ? 'dark' : 'light'];
  const { isAuthenticated, user } = useAuth();
  const { showAuthScreen, showLoginScreen } = useAuthScreen();
  const { onlineUsers } = useSocket();

  const [searchQuery, setSearchQuery] = useState('');

  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  const [allGames, setAllGames] = useState<GameItem[]>([]);
  const [featuredGames, setFeaturedGames] = useState<Record<string, GameItem[]>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [playingGame, setPlayingGame] = useState<GameItem | null>(null);
  const [gameLoaded, setGameLoaded] = useState(false);

  const [showFindFriends, setShowFindFriends] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [categoryModal, setCategoryModal] = useState<{ title: string; category: string } | null>(null);

  const [friends, setFriends] = useState<any[]>([]);

  const [searchGames, setSearchGames] = useState<GameItem[]>([]);
  const [searchUsers, setSearchUsers] = useState<any[]>([]);

  const loadFriends = useCallback(async () => {
    if (isAuthenticated && user?.id) {
      try {
        const res = await users.following(user.id);
        const list = Array.isArray(res) ? res : [];
        setFriends(list);
      } catch (e) {
        console.log('Friends error', e);
      }
    } else {
      setFriends([]);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  // Interstitial Ad
  const [interstitialAd, setInterstitialAd] = useState<InterstitialAd | null>(null);
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const pendingCloseRef = useRef(false);

  useEffect(() => {
    if (isExpoGo) return;

    const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-1961802731817431/7682402362';
    const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => setIsAdLoaded(true));
    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setIsAdLoaded(false);
      if (pendingCloseRef.current) {
        pendingCloseRef.current = false;
        setPlayingGame(null);
      }
      interstitial.load();
    });
    const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
      setIsAdLoaded(false);
      if (pendingCloseRef.current) {
        pendingCloseRef.current = false;
        setPlayingGame(null);
      }
    });

    interstitial.load();
    setInterstitialAd(interstitial);

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, []);

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await games.list(100, 0);
      const list: GameItem[] = (data.games || []).map((g: GameItem) => ({
        ...g,
        thumbnail: g.thumbnail || `${GAMES_HOST}/thumbnails/${g.id}.png`,
        _fakePlays: getFakePlayCount(g.id)
      }));
      setAllGames(list);

      // We'll organize them into various categories based on genre or mock metrics
      const getCategoryList = (catName: string) => {
        return list.filter(g => g.category?.toLowerCase().includes(catName.toLowerCase()));
      };

      const shuffled = [...list].sort(() => Math.random() - 0.5);

      setFeaturedGames({
        continue: shuffled.slice(0, 10),
        recommended: [...list].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 15),
        hot: shuffled.slice(10, 25),
        action: getCategoryList('action').slice(0, 15),
        puzzle: getCategoryList('puzzle').slice(0, 15),
        racing: getCategoryList('racing').slice(0, 15),
        arcade: getCategoryList('arcade').slice(0, 15),
        new: shuffled.slice(25, 40),
      });
    } catch (e) {
      console.log('Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    if (refresh) loadFriends();
  }, [loadFriends]);

  useEffect(() => { loadData(); }, [loadData]);

  // Search logic
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (searchQuery.length > 2) {
      setIsSearching(true);
      timeout = setTimeout(async () => {
        try {
          const [resGames, resUsers] = await Promise.all([
            games.search(searchQuery).catch((e) => { console.log('Games search error', e); return { games: [] }; }),
            users.search(searchQuery).catch((e) => { console.log('Users search error', e); return { users: [] }; })
          ]);

          let gameResults = (resGames.games || []).map((g: GameItem) => ({
            ...g,
            thumbnail: g.thumbnail || `${GAMES_HOST}/thumbnails/${g.id}.png`,
          }));
          setSearchGames(gameResults);
          const userResults = resUsers?.users || resUsers;
          setSearchUsers(Array.isArray(userResults) ? userResults : []);
        } catch (e) {
          // Fallback
          const q = searchQuery.toLowerCase();
          setSearchGames(allGames.filter(g => g.name.toLowerCase().includes(q)));
          setSearchUsers([]);
        }
        setIsSearching(false);
      }, 300);
    } else {
      setSearchGames([]);
      setSearchUsers([]);
      setIsSearching(false);
    }
    return () => clearTimeout(timeout);
  }, [searchQuery, allGames]);

  // Hard safety net: if onLoadEnd never fires (network issues, etc), force-dismiss after 15s
  useEffect(() => {
    let safetyTimeout: NodeJS.Timeout;
    if (playingGame && !gameLoaded) {
      safetyTimeout = setTimeout(() => {
        setGameLoaded(true);
      }, 15000);
    }
    return () => clearTimeout(safetyTimeout);
  }, [playingGame, gameLoaded]);

  const webViewRef = useRef<WebView>(null);

  const playGame = (game: GameItem) => {
    setPlayingGame(game);
    setGameLoaded(false);
  };

  const isSearchActive = searchQuery.length >= 2;

  // Auth gate
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Explore</Text>
        </View>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={80} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.authGate}>
            <Ionicons name="game-controller" size={64} color={theme.textSecondary} />
            <Text style={[styles.authTitle, { color: theme.text }]}>Discover Games</Text>
            <Text style={[styles.authSubtitle, { color: theme.textSecondary }]}>Sign up to explore thousands of games and find your favorites</Text>
            <TouchableOpacity style={styles.authBtn} onPress={showAuthScreen}>
              <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.authBtnGradient}>
                <Text style={styles.authBtnText}>Sign Up</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={showLoginScreen}>
              <Text style={styles.authLogin}>Already have an account? Log in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      {/* App Header (Like the Screenshot) */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Explore</Text>
        <View style={styles.headerIcons}>
          {/* Wheel/Roulette icon */}
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="aperture" size={26} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={26} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: theme.searchBg }]}>
          <Image source={LoopsIcons.search} style={{ width: 20, height: 20, tintColor: theme.textSecondary }} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search games or friends"
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); Keyboard.dismiss(); }}>
              <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={theme.primary} size="large" />
      ) : isSearchActive ? (
        // Search Results State
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {isSearching ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
          ) : searchGames.length === 0 && searchUsers.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No results found</Text>
            </View>
          ) : (
            <>
              {searchUsers.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <SectionHeader title="People" theme={theme} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                    {searchUsers.map(u => (
                      <FriendCard key={u.id} friend={u} theme={theme} onPress={() => { setSelectedUser(u); setShowUserProfile(true); }} onlineUsers={onlineUsers} />
                    ))}
                  </ScrollView>
                </View>
              )}
              {searchGames.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <SectionHeader title="Games" theme={theme} />
                  <View style={styles.searchResultsGrid}>
                    {searchGames.map(g => (
                      <SquareGameCard key={g.id} game={g} onPress={() => playGame(g)} theme={theme} />
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        // Main Explore Stream
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={theme.primary} />}
        >
          {/* Friends Section */}
          <SectionHeader title="Friends" onChevronPress={() => { }} theme={theme} />
          {friends.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              <FriendCard isAdd theme={theme} onPress={() => setShowFindFriends(true)} index={0} />
              {[...friends].sort((a, b) => {
                const aOnline = onlineUsers.includes(a.id) ? 1 : 0;
                const bOnline = onlineUsers.includes(b.id) ? 1 : 0;
                return bOnline - aOnline; // online first
              }).map((f, idx) => (
                <FriendCard key={f.id} friend={f} theme={theme} onPress={() => { setSelectedUser(f); setShowUserProfile(true); }} onlineUsers={onlineUsers} index={idx + 1} />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.emptyFriendsCard, { backgroundColor: theme.cardBg }]}>
              <View style={[styles.emptyFriendsIconBg, { backgroundColor: theme.bg }]}>
                <Ionicons name="game-controller-outline" size={28} color={theme.textSecondary} />
              </View>
              <View style={styles.emptyFriendsTextContainer}>
                <Text style={[styles.emptyFriendsTitle, { color: theme.text }]}>It's quiet here...</Text>
                <Text style={[styles.emptyFriendsSub, { color: theme.textSecondary }]}>Add friends to see what they're playing!</Text>
              </View>
              <TouchableOpacity
                style={[styles.emptyFriendsBtn, { backgroundColor: theme.primary }]}
                onPress={() => setShowFindFriends(true)}
              >
                <Text style={styles.emptyFriendsBtnText}>Find</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Continue Playing */}
          <SectionHeader title="Continue" onChevronPress={() => { }} theme={theme} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {(featuredGames.continue || []).map((g, idx) => (
              <SquareGameCard key={g.id} game={g} onPress={() => playGame(g)} theme={theme} index={idx} />
            ))}
          </ScrollView>

          {/* Recommended For You */}
          <SectionHeader title="Recommended For You" onChevronPress={() => setCategoryModal({ title: "Recommended For You", category: "recommended" })} theme={theme} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {(featuredGames.recommended || []).map((g, idx) => (
              <RectGameCard key={g.id} game={g} onPress={() => playGame(g)} theme={theme} badge={idx === 0 ? 'top1' : 'like'} index={idx} />
            ))}
          </ScrollView>

          {/* Hot Games */}
          <SectionHeader title="Hot Games" onChevronPress={() => setCategoryModal({ title: "Hot Games", category: "hot" })} theme={theme} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {(featuredGames.hot || []).map((g, idx) => (
              <SquareGameCard key={g.id} game={g} onPress={() => playGame(g)} theme={theme} badge={idx === 0 ? 'top1' : 'hot'} index={idx} />
            ))}
          </ScrollView>

          {/* Action & Adventure */}
          {featuredGames.action?.length > 0 && (
            <>
              <SectionHeader title="Action & Adventure" onChevronPress={() => setCategoryModal({ title: "Action & Adventure", category: "action" })} theme={theme} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                {(featuredGames.action || []).map((g, idx) => (
                  <RectGameCard key={g.id} game={g} onPress={() => playGame(g)} theme={theme} badge={idx === 0 ? 'top1' : undefined} index={idx} />
                ))}
              </ScrollView>
            </>
          )}

          {/* Brain Teasers */}
          {featuredGames.puzzle?.length > 0 && (
            <>
              <SectionHeader title="Brain Teasers" onChevronPress={() => setCategoryModal({ title: "Brain Teasers", category: "puzzle" })} theme={theme} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                {(featuredGames.puzzle || []).map((g, idx) => (
                  <SquareGameCard key={g.id} game={g} onPress={() => playGame(g)} theme={theme} badge={idx === 0 ? 'top1' : undefined} index={idx} />
                ))}
              </ScrollView>
            </>
          )}

          {/* Racing & Driving */}
          {featuredGames.racing?.length > 0 && (
            <>
              <SectionHeader title="Racing & Driving" onChevronPress={() => setCategoryModal({ title: "Racing & Driving", category: "racing" })} theme={theme} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                {(featuredGames.racing || []).map((g, idx) => (
                  <RectGameCard key={g.id} game={g} onPress={() => playGame(g)} theme={theme} badge={idx === 0 ? 'top1' : undefined} index={idx} />
                ))}
              </ScrollView>
            </>
          )}

          {/* Arcade Classics */}
          {featuredGames.arcade?.length > 0 && (
            <>
              <SectionHeader title="Arcade Classics" onChevronPress={() => setCategoryModal({ title: "Arcade Classics", category: "arcade" })} theme={theme} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                {(featuredGames.arcade || []).map((g, idx) => (
                  <SquareGameCard key={g.id} game={g} onPress={() => playGame(g)} theme={theme} badge={idx === 0 ? 'top1' : undefined} index={idx} />
                ))}
              </ScrollView>
            </>
          )}

          {/* New Releases */}
          <SectionHeader title="New Releases" onChevronPress={() => setCategoryModal({ title: "New Releases", category: "new" })} theme={theme} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {(featuredGames.new || []).map((g, idx) => (
              <RectGameCard key={g.id} game={g} onPress={() => playGame(g)} theme={theme} badge={idx === 0 ? 'top1' : 'new'} index={idx} />
            ))}
          </ScrollView>

        </ScrollView>
      )}

      {/* Game Modal */}
      <Modal visible={!!playingGame} animationType="slide" presentationStyle="fullScreen">
        <View style={{ flex: 1, backgroundColor: playingGame?.color || '#1a1a2e' }}>
          <StatusBar hidden />

          {playingGame && (
            <WebView
              source={{ uri: getGameUrl(playingGame) }}
              style={{ flex: 1, backgroundColor: 'transparent' }}
              // @ts-ignore
              opaque={false}
              backgroundColor="transparent"
              scrollEnabled={false}
              bounces={false}
              onLoadEnd={() => {
                // Inject blurred thumbnail bg after page fully loads (backup)
                const thumbUrl = playingGame?.thumbnail || `${GAMES_HOST}/thumbnails/${playingGame?.id}.png`;
                const fallback = playingGame?.color || '#1a1a2e';
                webViewRef.current?.injectJavaScript(`
                  document.documentElement.style.setProperty('background', '${fallback}', 'important');
                  document.body.style.setProperty('background', 'transparent', 'important');
                  if(!document.getElementById('_gt_blur_bg')){
                    var s=document.createElement('style');s.id='_gt_blur_bg';
                    s.textContent='body::before{content:"";position:fixed;top:-20px;left:-20px;right:-20px;bottom:-20px;background:url(${thumbUrl}) center/cover no-repeat;filter:blur(30px);-webkit-filter:blur(30px);opacity:0.5;z-index:-1;pointer-events:none;}';
                    document.head.appendChild(s);
                  }
                  true;
                `);

                // Page has fully loaded. Wait 3s for the game to render,
                // then dismiss the loading screen. Simple & reliable.
                setTimeout(() => setGameLoaded(true), 3000);
              }}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowsAirPlayForMediaPlayback={false}
              injectedJavaScriptBeforeContentLoaded={isExternalGame(playingGame) ? AD_BLOCKER_SCRIPT : undefined}
              injectedJavaScript={createBlurBgScript(playingGame?.thumbnail || `${GAMES_HOST}/thumbnails/${playingGame?.id}.png`, playingGame?.color || '#1a1a2e')}
              ref={webViewRef}
            />
          )}

          {!gameLoaded && playingGame && (
            <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]}>
              <GameLoadingScreen
                gameName={playingGame.name}
                gameThumbnail={playingGame.thumbnail || `${GAMES_HOST}/thumbnails/${playingGame.id}.png`}
                progress={75}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.gameCloseBtn, { top: insets.top + 10, zIndex: 20 }]}
            onPress={() => {
              if (isExpoGo) {
                setPlayingGame(null);
                alert('Mock Interstitial Ad: Sponsored Content');
              } else if (isAdLoaded && interstitialAd) {
                pendingCloseRef.current = true;
                interstitialAd.show();
              } else {
                setPlayingGame(null);
              }
            }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
      <FindFriendsModal
        visible={showFindFriends}
        onClose={() => {
          setShowFindFriends(false);
          loadFriends();
        }}
        onOpenProfile={(user) => {
          setShowFindFriends(false);
          setTimeout(() => {
            setSelectedUser(user);
            setShowUserProfile(true);
          }, 300);
        }}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        visible={showUserProfile}
        onClose={() => setShowUserProfile(false)}
        user={selectedUser ? {
          id: selectedUser.id,
          username: selectedUser.username,
          avatar: selectedUser.avatar || null,
          status: 'GAMETOK USER',
          isOnline: false,
          isFriend: false,
        } : null}
      />

      <CategoryModal
        visible={!!categoryModal}
        onClose={() => setCategoryModal(null)}
        title={categoryModal?.title || ''}
        games={categoryModal ? featuredGames[categoryModal.category] || [] : []}
        onPlayGame={playGame}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBtn: {
    padding: 4,
  },
  searchWrap: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 4,
  },
  horizontalScroll: {
    paddingHorizontal: 20,
    gap: 16,
  },

  // Friends List Styles
  friendCard: {
    alignItems: 'center',
    width: 72,
    marginRight: 4,
  },
  friendAvatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  friendAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    borderWidth: 2,
  },
  friendName: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Empty Friends State
  emptyFriendsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 20,
    borderRadius: 16,
    gap: 16,
  },
  emptyFriendsIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFriendsTextContainer: {
    flex: 1,
  },
  emptyFriendsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyFriendsSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyFriendsBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyFriendsBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  friendTag: {
    fontSize: 11,
    marginTop: 2,
  },

  // Game Card Styles
  squareGameCard: {
    width: 120,
  },
  squareGameImgContainer: {
    width: 120,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  squareGameImg: {
    width: '100%',
    height: '100%',
  },
  rectGameCard: {
    width: 200,
  },
  rectGameImgContainer: {
    width: 200,
    height: 112, // 16:9 ratio
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rectGameImg: {
    width: '100%',
    height: '100%',
  },
  gameCardName: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  searchResultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 16,
    justifyContent: 'flex-start',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
    width: SCREEN_WIDTH,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  gameLoading: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameLoadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  gameCloseBtn: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Auth Gate
  authGate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    paddingTop: 100,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  authBtn: {
    marginTop: 32,
    borderRadius: 25,
    overflow: 'hidden',
  },
  authBtnGradient: {
    paddingHorizontal: 48,
    paddingVertical: 14,
  },
  authBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  authLogin: {
    color: '#a1a1aa',
    fontSize: 14,
    marginTop: 16,
  },
});

export default ExploreScreen;
