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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { WebView } from 'react-native-webview';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { games } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAuthScreen } from '../../App';
import { isExpoGo } from '../services/ads';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FEATURED_CARD_WIDTH = SCREEN_WIDTH * 0.7;
const GENRE_CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;
const GAMES_HOST = 'https://gametok-games.pages.dev';

// Theme colors
const themes = {
  light: {
    bg: '#ffffff',
    text: '#000000',
    textSecondary: 'rgba(0,0,0,0.5)',
    searchBg: 'rgba(0,0,0,0.05)',
    genreBg: 'rgba(0,0,0,0.05)',
    genreBorder: 'rgba(0,0,0,0.1)',
  },
  dark: {
    bg: '#0a0a0f',
    text: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.5)',
    searchBg: 'rgba(255,255,255,0.08)',
    genreBg: 'rgba(255,255,255,0.05)',
    genreBorder: 'rgba(255,255,255,0.1)',
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

// Hero categories - big visual cards
const HERO_CATEGORIES = [
  { id: 'trending', name: '#ViralGames', icon: 'flame', gradient: ['#FF0050', '#00F2FE'] },
  { id: 'hot', name: '#MostRagedAt', icon: 'flash', gradient: ['#FF416C', '#FF4B2B'] },
  { id: 'foryou', name: '#ForYouPage', icon: 'heart', gradient: ['#8A2387', '#E94057'] },
];

// Hashtag rows (formerly genres)
const HASHTAG_ROWS = [
  { id: 'puzzle', name: '#BrainTeasers', icon: 'extension-puzzle', gradient: ['#667eea', '#764ba2'] },
  { id: 'arcade', name: '#ArcadeClassics', icon: 'game-controller', gradient: ['#f093fb', '#f5576c'] },
  { id: 'action', name: '#ActionPacked', icon: 'flash', gradient: ['#4facfe', '#00f2fe'] },
  { id: 'racing', name: '#Speedrun', icon: 'car-sport', gradient: ['#43e97b', '#38f9d7'] },
  { id: 'hypercasual', name: '#Hypercasual', icon: 'happy', gradient: ['#a8edea', '#fed6e3'] },
];

const isExternalGame = (game: GameItem) => !!game.embedUrl;

const getGameUrl = (game: GameItem) => {
  if (game.embedUrl) {
    const sep = game.embedUrl.includes('?') ? '&' : '?';
    return `${game.embedUrl}${sep}gd_sdk_referrer_url=${encodeURIComponent(GAMES_HOST)}`;
  }
  return `${GAMES_HOST}/${game.id}/`;
};

// Generate a consistent fake number for a game based on its ID
const getFakePlayCount = (gameId: string) => {
  let hash = 0;
  for (let i = 0; i < gameId.length; i++) {
    hash = ((hash << 5) - hash) + gameId.charCodeAt(i);
    hash |= 0;
  }
  const randomCount = Math.abs(hash) % 1500000 + 10000; // Between 10K and ~1.5M
  return randomCount;
};

// Helper function to turn a large number into a short string like 1.2M or 12.3K for the UI
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// Ad blocker script for external games (same as HomeScreen)
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
  
  // Remove ad elements
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
  
  // Fullscreen CSS
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

// Hero Card - massive vertical cards for top trending
const HeroCard: React.FC<{
  category: typeof HERO_CATEGORIES[0];
  games: GameItem[];
  onPress: () => void;
}> = ({ category, games, onPress }) => {
  const thumbnail = games[0]?.thumbnail;
  return (
    <TouchableOpacity style={styles.heroCard} onPress={onPress} activeOpacity={0.95}>
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.heroBg} />
      ) : (
        <LinearGradient colors={category.gradient as [string, string]} style={styles.heroBg} />
      )}
      <LinearGradient colors={['transparent', 'transparent', 'rgba(0,0,0,0.95)']} style={styles.heroGradient}>
        <View style={styles.heroTopBadge}>
          <Ionicons name={category.icon as any} size={14} color="#fff" />
          <Text style={styles.heroTopBadgeText}>Top {games.length}</Text>
        </View>
        <View style={styles.heroContent}>
          <Text style={styles.heroName}>{category.name}</Text>
          {games[0] && (
            <Text style={styles.heroSubText}>Featuring: {games[0].name}</Text>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

// Game Card - modern vertical style
const GameCard: React.FC<{
  game: GameItem;
  onPress: () => void;
  large?: boolean;
}> = ({ game, onPress, large }) => (
  <TouchableOpacity style={[styles.gameCard, large && styles.gameCardLarge]} onPress={onPress} activeOpacity={0.9}>
    {game.thumbnail ? (
      <Image source={{ uri: game.thumbnail }} style={styles.gameCardImg} />
    ) : (
      <LinearGradient colors={[game.color || '#a855f7', '#1a1a2e']} style={styles.gameCardImg}>
        <Ionicons name="game-controller" size={28} color="rgba(255,255,255,0.4)" />
      </LinearGradient>
    )}
    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.95)']} style={styles.gameCardOverlay}>
      <Text style={styles.gameCardName} numberOfLines={2}>{game.name}</Text>
      <View style={styles.playCountRow}>
        <Ionicons name="play" size={10} color="rgba(255,255,255,0.8)" />
        <Text style={styles.playCountText}>
          {formatNumber(game._fakePlays || getFakePlayCount(game.id))} plays
        </Text>
      </View>
    </LinearGradient>
  </TouchableOpacity>
);

// Hashtag Row - horizontally scrolling list of games mapping to a category
const HashtagRow: React.FC<{
  hashtag: typeof HASHTAG_ROWS[0];
  games: GameItem[];
  theme: any;
  onPlayGame: (game: GameItem) => void;
  onViewAll: () => void;
}> = ({ hashtag, games, theme, onPlayGame, onViewAll }) => {
  if (!games || games.length === 0) return null;
  return (
    <View style={styles.hashtagSection}>
      <View style={styles.hashtagHeader}>
        <View style={styles.hashtagTitleRow}>
          <Ionicons name={hashtag.icon as any} size={20} color={hashtag.gradient[0]} />
          <Text style={[styles.hashtagTitle, { color: theme.text }]}>{hashtag.name}</Text>
        </View>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={[styles.viewAllText, { color: theme.textSecondary }]}>View All</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hashtagScroll}>
        {games.slice(0, 10).map(g => (
          <GameCard key={g.id} game={g} onPress={() => onPlayGame(g)} />
        ))}
      </ScrollView>
    </View>
  );
};

// Category Modal
const CategoryModal: React.FC<{
  visible: boolean;
  title: string;
  icon: string;
  gradient?: [string, string];
  games: GameItem[];
  onClose: () => void;
  onPlayGame: (game: GameItem) => void;
}> = ({ visible, title, icon, gradient, games, onClose, onPlayGame }) => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
        <LinearGradient colors={gradient || ['#667eea', '#764ba2']} style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.modalHeaderContent}>
            <Ionicons name={icon as any} size={32} color="#fff" />
            <Text style={styles.modalTitle}>{title}</Text>
            <Text style={styles.modalSubtitle}>{games.length} games</Text>
          </View>
        </LinearGradient>

        <FlatList
          data={games}
          numColumns={3}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.modalGrid}
          renderItem={({ item }) => (
            <GameCard game={item} onPress={() => onPlayGame(item)} />
          )}
        />
      </View>
    </Modal>
  );
};

export const ExploreScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = themes[colorScheme === 'dark' ? 'dark' : 'light'];
  const { isAuthenticated } = useAuth();
  const { showAuthScreen, showLoginScreen } = useAuthScreen();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GameItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [allGames, setAllGames] = useState<GameItem[]>([]);
  const [featuredGames, setFeaturedGames] = useState<Record<string, GameItem[]>>({});
  const [genreGames, setGenreGames] = useState<Record<string, GameItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState<{
    title: string;
    icon: string;
    gradient?: [string, string];
    games: GameItem[];
  } | null>(null);

  const [playingGame, setPlayingGame] = useState<GameItem | null>(null);
  const [gameLoaded, setGameLoaded] = useState(false);

  // Interstitial Ad
  const [interstitialAd, setInterstitialAd] = useState<InterstitialAd | null>(null);
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const pendingCloseRef = useRef(false);

  // Load interstitial ad
  useEffect(() => {
    if (isExpoGo) return; // Don't load real ads in Expo Go

    const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-1961802731817431/7682402362';
    const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      setIsAdLoaded(true);
    });

    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setIsAdLoaded(false);
      // Close the game AFTER the ad is dismissed
      if (pendingCloseRef.current) {
        pendingCloseRef.current = false;
        setPlayingGame(null);
      }
      interstitial.load(); // Load the next one
    });

    const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
      console.log('Interstitial Ad error: ', error);
      setIsAdLoaded(false);
      // If ad fails, close the game anyway
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

      // Sort for featured
      const byPlays = [...list].sort((a, b) => (b.plays || 0) - (a.plays || 0));

      // Deterministic shuffle for "raged at" — reverse the sorted list and take from different positions
      const ragedAt = [...list].sort((a, b) => {
        const hashA = a.id.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0);
        const hashB = b.id.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0);
        return hashA - hashB;
      });

      const shuffled = [...list].sort(() => Math.random() - 0.5);

      // Featured categories - each gets distinct games
      setFeaturedGames({
        trending: byPlays.slice(0, 20),
        hot: ragedAt.slice(0, 15),
        foryou: shuffled.slice(0, 20),
      });

      // Genre categories
      const byGenre: Record<string, GameItem[]> = {};
      list.forEach(g => {
        const cat = (g.category || 'arcade').toLowerCase();
        if (!byGenre[cat]) byGenre[cat] = [];
        byGenre[cat].push(g);
      });
      setGenreGames(byGenre);
    } catch (e) {
      console.log('Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auth gate
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
        <LinearGradient colors={['#7c3aed', '#a855f7']} style={styles.header}>
          <Text style={styles.headerTitle}>EXPLORE</Text>
        </LinearGradient>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.authGate}>
            <Ionicons name="compass" size={64} color="rgba(255,255,255,0.3)" />
            <Text style={styles.authTitle}>Discover Games</Text>
            <Text style={styles.authSubtitle}>Sign up to explore thousands of games and find your favorites</Text>
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

  // Search - uses server-side search for full database access
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const data = await games.search(searchQuery, 50);
        const results: GameItem[] = (data.games || []).map((g: GameItem) => ({
          ...g,
          thumbnail: g.thumbnail || `${GAMES_HOST}/thumbnails/${g.id}.png`,
          _fakePlays: getFakePlayCount(g.id)
        }));
        setSearchResults(results);
      } catch (e) {
        console.log('Search error:', e);
        // Fallback to local search if API fails
        const q = searchQuery.toLowerCase();
        const results = allGames.filter(g =>
          g.name.toLowerCase().includes(q) || g.category?.toLowerCase().includes(q)
        );
        setSearchResults(results);
      }
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, allGames]);

  const openFeatured = (cat: typeof HERO_CATEGORIES[0]) => {
    setModalData({
      title: cat.name,
      icon: cat.icon,
      gradient: cat.gradient as [string, string],
      games: featuredGames[cat.id] || [],
    });
    setModalVisible(true);
  };

  const openHashtag = (hashtag: typeof HASHTAG_ROWS[0]) => {
    setModalData({
      title: hashtag.name,
      icon: hashtag.icon,
      gradient: hashtag.gradient as [string, string],
      games: genreGames[hashtag.id] || [],
    });
    setModalVisible(true);
  };

  const playGame = (game: GameItem) => {
    setModalVisible(false);
    setPlayingGame(game);
    setGameLoaded(false);
  };

  const isSearchActive = searchQuery.length >= 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      {/* Transparent Dark Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Discover</Text>
        <Ionicons name="scan-outline" size={24} color={theme.text} />
      </View>

      {/* Search Bar */}
      <View style={[styles.searchWrap, { backgroundColor: theme.bg }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.searchBg }]}>
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search games..."
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
        <ActivityIndicator style={{ marginTop: 60 }} color="#a855f7" size="large" />
      ) : isSearchActive ? (
        <ScrollView contentContainerStyle={styles.searchResultsGrid}>
          {isSearching ? (
            <ActivityIndicator color="#a855f7" style={{ marginTop: 40 }} />
          ) : searchResults.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No games found</Text>
            </View>
          ) : (
            searchResults.map(g => (
              <GameCard key={g.id} game={g} onPress={() => playGame(g)} />
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor="#a855f7" />}
        >
          {/* Hero Trends Carousel */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.heroRow}
            snapToInterval={SCREEN_WIDTH * 0.85 + 14}
            decelerationRate="fast"
          >
            {HERO_CATEGORIES.map(cat => (
              <HeroCard
                key={cat.id}
                category={cat}
                games={featuredGames[cat.id] || []}
                onPress={() => openFeatured(cat)}
              />
            ))}
          </ScrollView>

          {/* Dynamic Hashtag Rows */}
          {HASHTAG_ROWS.map(hashtag => (
            <HashtagRow
              key={hashtag.id}
              hashtag={hashtag}
              games={genreGames[hashtag.id] || []}
              theme={theme}
              onPlayGame={playGame}
              onViewAll={() => openHashtag(hashtag)}
            />
          ))}

          {/* Discover More Grid */}
          <View style={[styles.hashtagSection, { marginTop: 10 }]}>
            <View style={styles.hashtagHeader}>
              <Text style={[styles.hashtagTitle, { color: theme.text }]}>#DiscoverMore</Text>
            </View>
            <View style={styles.gamesGrid}>
              {allGames.slice(0, 30).map(g => (
                <GameCard key={g.id} game={g} onPress={() => playGame(g)} large={true} />
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Category Modal */}
      {modalData && (
        <CategoryModal
          visible={modalVisible}
          title={modalData.title}
          icon={modalData.icon}
          gradient={modalData.gradient}
          games={modalData.games}
          onClose={() => setModalVisible(false)}
          onPlayGame={playGame}
        />
      )}

      {/* Game Modal - with ad blocker for external games */}
      <Modal visible={!!playingGame} animationType="slide" presentationStyle="fullScreen">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <StatusBar hidden />
          {playingGame && (
            <WebView
              source={{ uri: getGameUrl(playingGame) }}
              style={{ flex: 1 }}
              scrollEnabled={false}
              bounces={false}
              onLoadEnd={() => setGameLoaded(true)}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              injectedJavaScriptBeforeContentLoaded={isExternalGame(playingGame) ? AD_BLOCKER_SCRIPT : undefined}
            />
          )}
          {!gameLoaded && playingGame && (
            <View style={[StyleSheet.absoluteFill, styles.gameLoading, { backgroundColor: playingGame.color || '#a855f7' }]}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.gameLoadingText}>Loading {playingGame.name}...</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.gameCloseBtn, { top: insets.top + 10 }]}
            onPress={() => {
              // Show ad when closing game
              if (isExpoGo) {
                setPlayingGame(null);
                alert('Mock Interstitial Ad: Sponsored Content');
              } else if (isAdLoaded && interstitialAd) {
                // Mark pending close — game closes AFTER ad is dismissed
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  heroRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 14,
  },
  heroCard: {
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 1.1,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 14,
    backgroundColor: '#1a1a2e',
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.8,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 20,
  },
  heroTopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  heroTopBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroContent: {
    marginTop: 'auto',
  },
  heroName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroSubText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  hashtagSection: {
    marginTop: 20,
  },
  hashtagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  hashtagTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hashtagTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  viewAllText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  hashtagScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  gameCard: {
    width: 120,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    marginRight: 12,
  },
  gameCardLarge: {
    width: (SCREEN_WIDTH - 44) / 2,
    height: 220,
    marginRight: 0,
  },
  gameCardImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 12,
  },
  gameCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  playCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  playCountText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  searchResultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 10,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    width: SCREEN_WIDTH,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingTop: 16,
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderContent: {
    alignItems: 'center',
    paddingTop: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginTop: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  modalGrid: {
    padding: 16,
    gap: 10,
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
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
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
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 16,
  },
});

export default ExploreScreen;
