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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GameCard } from './GameCard';
import { GameSearchModal } from './GameSearchModal';
import { useTheme } from '../context/ThemeContext';
import { games as gamesApi } from '../services/api';

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

export const GameFeed: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [games, setGames] = useState<Game[]>(FALLBACK_GAMES);
  const [feedData, setFeedData] = useState<FeedGame[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'foryou' | 'explore'>('foryou');
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const horizontalScrollRef = useRef<ScrollView>(null);
  const feedIndexRef = useRef(0);

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

  // Generate feed when games are loaded
  useEffect(() => {
    if (games.length > 0) {
      const initialFeed = generateFeed(10, 0);
      setFeedData(initialFeed);
      feedIndexRef.current = 10;
    }
  }, [games]);

  const generateFeed = (count: number, startIndex: number): FeedGame[] => {
    const feed: FeedGame[] = [];
    for (let i = 0; i < count; i++) {
      const game = games[(startIndex + i) % games.length];
      feed.push({
        ...game,
        uniqueId: `${game.id}-${startIndex + i}-${Date.now()}`,
        gameUrl: `${GAMES_HOST}/${game.id}/`,
      });
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

  const renderItem = useCallback(({ item, index }: { item: FeedGame; index: number }) => (
    <GameCard
      game={item}
      gameUrl={item.gameUrl}
      isActive={index === activeIndex}
    />
  ), [activeIndex]);

  const keyExtractor = useCallback((item: FeedGame) => item.uniqueId, []);

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

  const handleSelectGame = (gameId: string) => {
    const gameIndex = feedData.findIndex(g => g.id === gameId);
    if (gameIndex >= 0) {
      flatListRef.current?.scrollToIndex({ index: gameIndex, animated: true });
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
      />
    );
  };

  const renderComingSoon = () => (
    <View style={styles.comingSoon}>
      <Text style={styles.comingSoonEmoji}>🚀</Text>
      <Text style={styles.comingSoonTitle}>Coming Soon</Text>
      <Text style={styles.comingSoonText}>Discover new games here</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerBtn} />
        <View style={styles.headerTabs}>
          <TouchableOpacity onPress={() => handleTabPress('explore')} style={styles.headerTab}>
            <Text style={[styles.headerTabText, activeTab === 'explore' && styles.headerTabTextActive]}>Explore</Text>
            {activeTab === 'explore' && <View style={styles.headerTabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleTabPress('foryou')} style={styles.headerTab}>
            <Text style={[styles.headerTabText, activeTab === 'foryou' && styles.headerTabTextActive]}>For You</Text>
            {activeTab === 'foryou' && <View style={styles.headerTabIndicator} />}
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSearch(true)}>
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={horizontalScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleHorizontalScroll}
        contentOffset={{ x: SCREEN_WIDTH, y: 0 }}
      >
        <View style={styles.page}>{renderComingSoon()}</View>
        <View style={styles.page}>{renderFeed()}</View>
      </ScrollView>

      <GameSearchModal visible={showSearch} onClose={() => setShowSearch(false)} onSelectGame={handleSelectGame} />
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
  comingSoon: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  comingSoonEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  comingSoonTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  comingSoonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
  },
});
