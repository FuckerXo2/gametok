import React, { useState, useEffect, useCallback } from 'react';
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
import Animated, { FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { WebView } from 'react-native-webview';
import { games } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAuthScreen } from '../../App';

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
}

// Featured categories - big visual cards
const FEATURED_CATEGORIES = [
  { id: 'trending', name: 'Trending', icon: 'flame', gradient: ['#FF416C', '#FF4B2B'] },
  { id: 'hot', name: 'Hot Now', icon: 'flash', gradient: ['#F857A6', '#FF5858'] },
  { id: 'foryou', name: 'For You', icon: 'heart', gradient: ['#a855f7', '#7c3aed'] },
];

// Genre categories with gradients for cards
const GENRE_CATEGORIES = [
  { id: 'puzzle', name: 'Puzzle', icon: 'extension-puzzle', gradient: ['#667eea', '#764ba2'] },
  { id: 'arcade', name: 'Arcade', icon: 'game-controller', gradient: ['#f093fb', '#f5576c'] },
  { id: 'action', name: 'Action', icon: 'flash', gradient: ['#4facfe', '#00f2fe'] },
  { id: 'racing', name: 'Racing', icon: 'car-sport', gradient: ['#43e97b', '#38f9d7'] },
  { id: 'sports', name: 'Sports', icon: 'football', gradient: ['#fa709a', '#fee140'] },
  { id: 'hypercasual', name: 'Casual', icon: 'happy', gradient: ['#a8edea', '#fed6e3'] },
];

const isExternalGame = (game: GameItem) => !!game.embedUrl;

const getGameUrl = (game: GameItem) => {
  if (game.embedUrl) {
    const sep = game.embedUrl.includes('?') ? '&' : '?';
    return `${game.embedUrl}${sep}gd_sdk_referrer_url=${encodeURIComponent(GAMES_HOST)}`;
  }
  return `${GAMES_HOST}/${game.id}/`;
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

// Animated wrapper for press physics + staggered entrance
const AnimatedCard: React.FC<{ onPress: () => void; index?: number; children: React.ReactNode; style?: any }> = ({ onPress, index = 0, children, style }) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => { scale.value = withSpring(0.96, { damping: 12, stiffness: 200 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 10, stiffness: 250 }); };
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min((index) * 60, 400)).springify().damping(18)}
      style={[style, animatedStyle]}
    >
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress}>
        {children}
      </Pressable>
    </Animated.View>
  );
};

// Featured Card - big card with thumbnail and gradient
const FeaturedCard: React.FC<{
  category: typeof FEATURED_CATEGORIES[0];
  games: GameItem[];
  onPress: () => void;
  index?: number;
}> = ({ category, games, onPress, index }) => {
  const thumbnail = games[0]?.thumbnail;
  return (
    <AnimatedCard style={styles.featuredCard} onPress={onPress} index={index}>
      <LinearGradient colors={category.gradient as [string, string]} style={styles.featuredGradient}>
        {thumbnail && (
          <Image source={{ uri: thumbnail }} style={styles.featuredBg} blurRadius={2} />
        )}
        <View style={styles.featuredContent}>
          <View style={styles.featuredIcon}>
            <Ionicons name={category.icon as any} size={28} color="#fff" />
          </View>
          <Text style={styles.featuredName}>{category.name}</Text>
          <Text style={styles.featuredCount}>{games.length} games</Text>
        </View>
      </LinearGradient>
    </AnimatedCard>
  );
};

// Genre Card - medium card with thumbnail grid
const GenreCard: React.FC<{
  genre: typeof GENRE_CATEGORIES[0];
  games: GameItem[];
  onPress: () => void;
  index?: number;
}> = ({ genre, games, onPress, index }) => {
  // Get up to 4 thumbnails for the grid
  const thumbnails = games.slice(0, 4).map(g => g.thumbnail).filter(Boolean);

  return (
    <AnimatedCard style={styles.genreCard} onPress={onPress} index={index}>
      <LinearGradient colors={genre.gradient as [string, string]} style={styles.genreGradient}>
        {/* Thumbnail grid background */}
        {thumbnails.length > 0 && (
          <View style={styles.genreThumbnailGrid}>
            {thumbnails.map((thumb, i) => (
              <Image key={i} source={{ uri: thumb }} style={styles.genreThumbnail} />
            ))}
          </View>
        )}
        <View style={styles.genreOverlay} />
        <View style={styles.genreContent}>
          <Ionicons name={genre.icon as any} size={24} color="#fff" />
          <Text style={styles.genreName}>{genre.name}</Text>
          <Text style={styles.genreCount}>{games.length} games</Text>
        </View>
      </LinearGradient>
    </AnimatedCard>
  );
};

// Game Card
const GameCard: React.FC<{
  game: GameItem;
  onPress: () => void;
  index?: number;
}> = ({ game, onPress, index }) => (
  <AnimatedCard style={styles.gameCard} onPress={onPress} index={index}>
    {game.thumbnail ? (
      <Image source={{ uri: game.thumbnail }} style={styles.gameCardImg} />
    ) : (
      <LinearGradient colors={[game.color || '#a855f7', '#1a1a2e']} style={styles.gameCardImg}>
        <Ionicons name="game-controller" size={28} color="rgba(255,255,255,0.4)" />
      </LinearGradient>
    )}
    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.gameCardOverlay}>
      <Text style={styles.gameCardName} numberOfLines={2}>{game.name}</Text>
    </LinearGradient>
  </AnimatedCard>
);

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
            <Image source={require('../../assets/ui/icons/ic_close.png')} style={{ width: 28, height: 28, tintColor: '#fff' }} />
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
          renderItem={({ item, index }) => (
            <GameCard game={item} index={index} onPress={() => onPlayGame(item)} />
          )}
        />
      </View>
    </Modal>
  );
};

export const ConnectScreen: React.FC = () => {
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

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await games.list(100, 0);
      const list: GameItem[] = (data.games || []).map((g: GameItem) => ({
        ...g,
        thumbnail: g.thumbnail || `${GAMES_HOST}/thumbnails/${g.id}.png`,
      }));
      setAllGames(list);

      // Sort for featured
      const byPlays = [...list].sort((a, b) => (b.plays || 0) - (a.plays || 0));
      const shuffled = [...list].sort(() => Math.random() - 0.5);

      // Featured categories
      setFeaturedGames({
        trending: byPlays.slice(0, 20),
        hot: byPlays.slice(0, 15),
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

  const openFeatured = (cat: typeof FEATURED_CATEGORIES[0]) => {
    setModalData({
      title: cat.name,
      icon: cat.icon,
      gradient: cat.gradient as [string, string],
      games: featuredGames[cat.id] || [],
    });
    setModalVisible(true);
  };

  const openGenre = (genre: typeof GENRE_CATEGORIES[0]) => {
    setModalData({
      title: genre.name,
      icon: genre.icon,
      gradient: genre.gradient as [string, string],
      games: genreGames[genre.id] || [],
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
      {/* Purple Header */}
      <LinearGradient colors={['#7c3aed', '#a855f7']} style={styles.header}>
        <Text style={styles.headerTitle}>EXPLORE</Text>
      </LinearGradient>

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
            searchResults.map((g, idx) => (
              <GameCard key={g.id} game={g} index={idx} onPress={() => playGame(g)} />
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor="#a855f7" />}
        >
          {/* Featured Categories - Big Cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredRow}
          >
            {FEATURED_CATEGORIES.map((cat, idx) => (
              <FeaturedCard
                key={cat.id}
                category={cat}
                index={idx}
                games={featuredGames[cat.id] || []}
                onPress={() => openFeatured(cat)}
              />
            ))}
          </ScrollView>

          {/* Genre Categories - Cards with thumbnails */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Categories</Text>
            <View style={styles.genreGrid}>
              {GENRE_CATEGORIES.filter(g => (genreGames[g.id]?.length || 0) > 0).map((genre, idx) => (
                <GenreCard
                  key={genre.id}
                  genre={genre}
                  index={idx}
                  games={genreGames[genre.id] || []}
                  onPress={() => openGenre(genre)}
                />
              ))}
            </View>
          </View>

          {/* All Games Grid */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Games</Text>
            <View style={styles.gamesGrid}>
              {allGames.slice(0, 30).map((g, idx) => (
                <GameCard key={g.id} game={g} index={idx} onPress={() => playGame(g)} />
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
            onPress={() => setPlayingGame(null)}
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
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  featuredRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  featuredCard: {
    width: FEATURED_CARD_WIDTH,
    height: FEATURED_CARD_WIDTH * 0.55,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 14,
  },
  featuredGradient: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  featuredBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  featuredContent: {
    padding: 18,
  },
  featuredIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  featuredName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  featuredCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  genreCard: {
    width: GENRE_CARD_WIDTH,
    height: GENRE_CARD_WIDTH * 0.6,
    borderRadius: 16,
    overflow: 'hidden',
  },
  genreGradient: {
    flex: 1,
  },
  genreThumbnailGrid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  genreThumbnail: {
    width: '50%',
    height: '50%',
    opacity: 0.5,
  },
  genreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  genreContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  genreName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginTop: 6,
  },
  genreCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gameCard: {
    width: (SCREEN_WIDTH - 52) / 3,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
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
    padding: 8,
  },
  gameCardName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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

export default ConnectScreen;
