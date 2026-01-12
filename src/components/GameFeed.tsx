import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, 
  FlatList, 
  StyleSheet, 
  Dimensions,
  ViewToken,
  Text,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameCard } from './GameCard';
import { NativeAdCard } from './NativeAdCard';
import { games as gamesApi } from '../services/api';
import { initializeAds, AD_FREQUENCY } from '../services/ads';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  embedUrl?: string;
}

interface FeedGame extends Game {
  uniqueId: string;
  gameUrl: string;
}

type FeedItem = FeedGame | { isAd: true; uniqueId: string };

export const GameFeed: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [games, setGames] = useState<Game[]>(FALLBACK_GAMES);
  const [feedData, setFeedData] = useState<FeedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isGamePlaying, setIsGamePlaying] = useState(false);
  const [adsInitialized, setAdsInitialized] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const feedIndexRef = useRef(0);
  const adCounterRef = useRef(0);

  // Initialize ads
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
    if (games.length > 0 && adsInitialized) {
      const initialFeed = generateFeed(10, 0);
      setFeedData(initialFeed);
      feedIndexRef.current = 10;
    }
  }, [games, adsInitialized]);

  const generateFeed = (count: number, startIndex: number): FeedItem[] => {
    const feed: FeedItem[] = [];
    for (let i = 0; i < count; i++) {
      const game = games[(startIndex + i) % games.length];
      
      let gameUrl = game.embedUrl 
        ? `${game.embedUrl}?gd_sdk_referrer_url=${encodeURIComponent(GAMES_HOST)}`
        : `${GAMES_HOST}/${game.id}/`;
      
      feed.push({
        ...game,
        uniqueId: `${game.id}-${startIndex + i}-${Date.now()}`,
        gameUrl,
      });
      
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
      const newIndex = viewableItems[0].index;
      if (newIndex !== activeIndex) {
        setIsGamePlaying(false);
      }
      setActiveIndex(newIndex);
    }
  }, [activeIndex]);

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
    if ('isAd' in item && item.isAd) {
      return <NativeAdCard isActive={index === activeIndex} />;
    }
    
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading games...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isGamePlaying && (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.headerTitle}>For You</Text>
        </View>
      )}

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
        removeClippedSubviews={false}
        maxToRenderPerBatch={3}
        windowSize={7}
        initialNumToRender={3}
        scrollEnabled={!isGamePlaying}
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
    zIndex: 100,
    alignItems: 'center',
    paddingBottom: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
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
});
