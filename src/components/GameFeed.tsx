import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, 
  FlatList, 
  StyleSheet, 
  Dimensions,
  ViewToken,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GameCard } from './GameCard';
import { NativeAdCard } from './NativeAdCard';
import { useTheme } from '../context/ThemeContext';
import { games as gamesApi } from '../services/api';

const ALL_GAMES = [
  { id: 'pacman', name: 'Pac-Man', icon: '🟡', color: '#FFFF00', plays: '2.5M' },
  { id: 'fruit-slicer', name: 'Fruit Slicer', icon: '🍉', color: '#ff6b6b', plays: '1.8M' },
];

const CATEGORIES = [
  { id: 'arcade', name: 'Arcade', icon: '🕹️', count: 12 },
  { id: 'puzzle', name: 'Puzzle', icon: '🧩', count: 8 },
  { id: 'action', name: 'Action', icon: '⚔️', count: 15 },
  { id: 'casual', name: 'Casual', icon: '🎯', count: 20 },
  { id: 'sports', name: 'Sports', icon: '⚽', count: 6 },
  { id: 'racing', name: 'Racing', icon: '🏎️', count: 4 },
];
import { initializeAds, AD_FREQUENCY } from '../services/ads';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const GAMES_HOST = 'https://gametok-games.pages.dev';

// Fallback games if API fails
const FALLBACK_GAMES = [
  { id: 'pacman', name: 'Pac-Man', description: 'Eat dots, avoid ghosts! Classic arcade action 👻', icon: '🟡', color: '#FFFF00' },
  { id: 'fruit-slicer', name: 'Fruit Slicer', description: 'Swipe to slice fruits! Avoid bombs 💣', icon: '🍉', color: '#ff6b6b' },
];

interface Game {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

interface FeedGame extends Game {
  uniqueId: string;
  gameUrl: string;
}

type FeedItem = FeedGame | { isAd: true; uniqueId: string };

export const GameFeed: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [games, setGames] = useState<Game[]>(FALLBACK_GAMES);
  const [feedData, setFeedData] = useState<FeedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'foryou' | 'explore'>('foryou');
  const [loading, setLoading] = useState(true);
  const [isGamePlaying, setIsGamePlaying] = useState(false);
  const [exploreSearch, setExploreSearch] = useState('');
  const [adsInitialized, setAdsInitialized] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const horizontalScrollRef = useRef<ScrollView>(null);
  const feedIndexRef = useRef(0);
  const adCounterRef = useRef(0);

  // Initialize ads SDK
  useEffect(() => {
    const init = async () => {
      const success = await initializeAds();
      setAdsInitialized(success);
    };
    init();
  }, []);

  // Fetch games from backend
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const data = await gamesApi.list(50);
        if (data.games && data.games.length > 0) {
          // Filter to only games that have valid URLs on our host
          const validGames = data.games.filter((g: any) => g.id && g.name);
          if (validGames.length > 0) {
            setGames(validGames);
          }
        }
      } catch (e) {
        console.log('Failed to fetch games, using fallback');
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  // Generate feed when games are loaded AND ads are initialized
  useEffect(() => {
    if (games.length > 0) {
      const initialFeed = generateFeed(10, 0);
      setFeedData(initialFeed);
      feedIndexRef.current = 10;
    }
  }, [games, adsInitialized]);

  const generateFeed = (count: number, startIndex: number): FeedItem[] => {
    const feed: FeedItem[] = [];
    for (let i = 0; i < count; i++) {
      const game = games[(startIndex + i) % games.length];
      feed.push({
        ...game,
        uniqueId: `${game.id}-${startIndex + i}-${Date.now()}`,
        gameUrl: `${GAMES_HOST}/${game.id}/`,
      });
      
      // Insert ad after every AD_FREQUENCY games (but not at the very start)
      adCounterRef.current++;
      if (adCounterRef.current % AD_FREQUENCY === 0 && adsInitialized) {
        feed.push({
          isAd: true,
          uniqueId: `ad-${adCounterRef.current}-${Date.now()}`,
        });
      }
    }
    return feed;
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const loadMore = useCallback(() => {
    if (games.length === 0) return;
    const newGames = generateFeed(5, feedIndexRef.current);
    feedIndexRef.current += 5;
    setFeedData(prev => [...prev, ...newGames]);
  }, [games]);

  const renderItem = useCallback(({ item, index }: { item: FeedItem; index: number }) => {
    // Check if this is an ad
    if ('isAd' in item && item.isAd) {
      return <NativeAdCard isActive={index === activeIndex} />;
    }
    
    // Regular game card - cast to FeedGame since we know it's not an ad
    const gameItem = item as FeedGame;
    return (
      <GameCard
        game={gameItem}
        gameUrl={gameItem.gameUrl}
        isActive={index === activeIndex}
        onPlayingChange={setIsGamePlaying}
      />
    );
  }, [activeIndex]);

  const keyExtractor = useCallback((item: FeedItem) => item.uniqueId, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: SCREEN_HEIGHT,
    offset: SCREEN_HEIGHT * index,
    index,
  }), []);

  const handleTabPress = (tab: 'foryou' | 'explore') => {
    setActiveTab(tab);
    horizontalScrollRef.current?.scrollTo({
      x: tab === 'explore' ? 0 : SCREEN_WIDTH,
      animated: true,
    });
  };

  const handleHorizontalScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    if (offsetX < SCREEN_WIDTH / 2) {
      setActiveTab('explore');
    } else {
      setActiveTab('foryou');
    }
  };

  const renderFeed = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading games...</Text>
        </View>
      );
    }

    return (
      <FlatList
        ref={flatListRef}
        data={feedData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={loadMore}
        onEndReachedThreshold={3}
        getItemLayout={getItemLayout}
        removeClippedSubviews
        maxToRenderPerBatch={2}
        windowSize={3}
        initialNumToRender={1}
        scrollEnabled={!isGamePlaying}
      />
    );
  };

  const filteredGames = exploreSearch.length > 0
    ? ALL_GAMES.filter(g => g.name.toLowerCase().includes(exploreSearch.toLowerCase()))
    : ALL_GAMES;

  const renderExplore = () => (
    <View style={[styles.exploreContainer, { backgroundColor: colors.background }]}>
      {/* Search Bar */}
      <View style={[styles.exploreSearchBar, { backgroundColor: colors.surface }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.exploreSearchInput, { color: colors.text }]}
          placeholder="Search games"
          placeholderTextColor={colors.textSecondary}
          value={exploreSearch}
          onChangeText={setExploreSearch}
        />
        {exploreSearch.length > 0 && (
          <TouchableOpacity onPress={() => setExploreSearch('')}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Categories */}
        {exploreSearch.length === 0 && (
          <View style={styles.exploreSection}>
            <Text style={[styles.exploreSectionTitle, { color: colors.text }]}>Categories</Text>
            <View style={styles.exploreCategoriesGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity 
                  key={cat.id}
                  style={[styles.exploreCategoryCard, { backgroundColor: colors.surface }]}
                >
                  <Text style={styles.exploreCategoryIcon}>{cat.icon}</Text>
                  <Text style={[styles.exploreCategoryName, { color: colors.text }]}>{cat.name}</Text>
                  <Text style={[styles.exploreCategoryCount, { color: colors.textSecondary }]}>
                    {cat.count} games
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Games List */}
        <View style={styles.exploreSection}>
          <Text style={[styles.exploreSectionTitle, { color: colors.text }]}>
            {exploreSearch.length > 0 ? 'Results' : 'All Games'}
          </Text>
          
          {filteredGames.length === 0 ? (
            <Text style={[styles.exploreNoResults, { color: colors.textSecondary }]}>
              No games found for "{exploreSearch}"
            </Text>
          ) : (
            filteredGames.map((game) => (
              <TouchableOpacity
                key={game.id}
                style={[styles.exploreGameRow, { borderBottomColor: colors.border }]}
              >
                <View style={[styles.exploreGameIcon, { backgroundColor: game.color }]}>
                  <Text style={styles.exploreGameEmoji}>{game.icon}</Text>
                </View>
                <View style={styles.exploreGameInfo}>
                  <Text style={[styles.exploreGameName, { color: colors.text }]}>{game.name}</Text>
                  <Text style={[styles.exploreGamePlays, { color: colors.textSecondary }]}>
                    {game.plays} plays
                  </Text>
                </View>
                <TouchableOpacity style={[styles.explorePlayBtn, { backgroundColor: colors.primary }]}>
                  <Ionicons name="play" size={16} color="#fff" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      {!isGamePlaying && (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerBtn} />
          <View style={styles.headerTabs}>
            <TouchableOpacity onPress={() => handleTabPress('explore')} style={styles.headerTab}>
              <Text style={[
                styles.headerTabText, 
                { color: activeTab === 'explore' ? colors.text : (activeTab === 'explore' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)') },
                activeTab === 'explore' && { color: colors.text }
              ]}>Explore</Text>
              {activeTab === 'explore' && <View style={[styles.headerTabIndicator, { backgroundColor: colors.text }]} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleTabPress('foryou')} style={styles.headerTab}>
              <Text style={[
                styles.headerTabText,
                { color: activeTab === 'explore' ? colors.textSecondary : (activeTab === 'foryou' ? '#fff' : 'rgba(255,255,255,0.6)') }
              ]}>For You</Text>
              {activeTab === 'foryou' && <View style={styles.headerTabIndicator} />}
            </TouchableOpacity>
          </View>
          <View style={styles.headerBtn} />
        </View>
      )}

      <ScrollView
        ref={horizontalScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleHorizontalScroll}
        contentOffset={{ x: SCREEN_WIDTH, y: 0 }}
        scrollEnabled={!isGamePlaying}
      >
        <View style={styles.page}>{renderExplore()}</View>
        <View style={styles.page}>{renderFeed()}</View>
      </ScrollView>
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
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  headerTab: {
    alignItems: 'center',
  },
  headerTabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 17,
    fontWeight: '600',
  },
  headerTabTextActive: {
    color: '#fff',
  },
  headerTabIndicator: {
    width: 28,
    height: 3,
    backgroundColor: '#fff',
    borderRadius: 2,
    marginTop: 4,
  },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  exploreContainer: {
    flex: 1,
    paddingTop: 100,
  },
  exploreSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  exploreSearchInput: {
    flex: 1,
    fontSize: 16,
  },
  exploreSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  exploreSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  exploreCategoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  exploreCategoryCard: {
    width: '31%',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
  },
  exploreCategoryIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  exploreCategoryName: {
    fontSize: 13,
    fontWeight: '600',
  },
  exploreCategoryCount: {
    fontSize: 11,
    marginTop: 2,
  },
  exploreNoResults: {
    textAlign: 'center',
    fontSize: 15,
    marginTop: 20,
  },
  exploreGameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  exploreGameIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  exploreGameEmoji: {
    fontSize: 26,
  },
  exploreGameInfo: {
    flex: 1,
  },
  exploreGameName: {
    fontSize: 16,
    fontWeight: '600',
  },
  exploreGamePlays: {
    fontSize: 13,
    marginTop: 2,
  },
  explorePlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
