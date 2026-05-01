import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  ViewToken,
  Text,
  ActivityIndicator,
  PanResponder,
  Animated,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameCard } from './GameCard';
import { WebViewPool, WebViewPoolHandle } from './WebViewPool';
import { games as gamesApi } from '../services/api';

const GAMES_HOST = 'https://games.gametok.co';
const SCROLL_ZONE_HEIGHT = 0.25; // Bottom 25% of screen
const SWIPE_THRESHOLD = 50;

const FALLBACK_GAMES = [
  { id: 'pacman', name: 'Pac-Man', description: 'Eat dots!', icon: '🟡', color: '#FFFF00' },
  { id: 'fruit-slicer', name: 'Fruit Slicer', description: 'Slice fruits!', icon: '🍉', color: '#ff6b6b' },
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

// Feed is now just games - ads shown via interstitial
type FeedItem = FeedGame;

export const GameFeed: React.FC = () => {
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const scrollZoneHeight = screenHeight * SCROLL_ZONE_HEIGHT;

  const [games, setGames] = useState<Game[]>(FALLBACK_GAMES);
  const [feedData, setFeedData] = useState<FeedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const flatListRef = useRef<FlatList>(null);
  const feedIndexRef = useRef(0);
  const gamesPlayedRef = useRef(0);
  const activeIndexRef = useRef(0);
  const webViewPoolRef = useRef<WebViewPoolHandle>(null);

  // Scroll to next/prev game
  const goToNext = useCallback(async () => {
    const nextIndex = activeIndexRef.current + 1;
    if (nextIndex < feedData.length) {
      gamesPlayedRef.current += 1;

      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [feedData.length]);

  const goToPrev = useCallback(() => {
    const prevIndex = activeIndexRef.current - 1;
    if (prevIndex >= 0) {
      flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const touchStartY = useRef(0);

  // Edge pan responder - intercepts touches BEFORE they reach the FlatList/WebView
  // but ONLY if the touch starts in the top/bottom 13% and is a swipe.
  const edgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (e) => {
        touchStartY.current = e.nativeEvent.pageY;
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        const isEdge = touchStartY.current > screenHeight * 0.75;
        const isVerticalSwipe = Math.abs(gesture.dy) > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
        return isEdge && isVerticalSwipe;
      },
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        const isEdge = touchStartY.current > screenHeight * 0.75;
        const isVerticalSwipe = Math.abs(gesture.dy) > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
        return isEdge && isVerticalSwipe;
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -SWIPE_THRESHOLD || gesture.vy < -0.5) {
          goToNext();
        } else if (gesture.dy > SWIPE_THRESHOLD || gesture.vy > 0.5) {
          goToPrev();
        }
      }
    })
  ).current;

  useEffect(() => {
    activeIndexRef.current = activeIndex;

    if (webViewPoolRef.current && feedData.length > 0) {
      // Preload current + 3 ahead
      for (let i = 0; i <= 3; i++) {
        const idx = activeIndex + i;
        if (idx < feedData.length) {
          const item = feedData[idx];
          webViewPoolRef.current.preloadGame(item.uniqueId, item.gameUrl);
        }
      }

      const currentItem = feedData[activeIndex];
      if (currentItem) {
        webViewPoolRef.current.setActiveGame(currentItem.uniqueId);
      }
    }
  }, [activeIndex, feedData]);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const data = await gamesApi.list(50);
        if (data.games?.length > 0) {
          const validGames = data.games.filter((g: any) => g.id && g.name);
          if (validGames.length > 0) setGames(validGames);
        }
      } catch (e) {
        console.log('Using fallback games');
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  useEffect(() => {
    if (games.length > 0) {
      setFeedData(generateFeed(10, 0));
      feedIndexRef.current = 10;
    }
  }, [games]);

  const generateFeed = (count: number, startIndex: number): FeedItem[] => {
    const feed: FeedItem[] = [];
    for (let i = 0; i < count; i++) {
      const game = games[(startIndex + i) % games.length];
      const gameUrl = game.embedUrl
        ? `${game.embedUrl}?gd_sdk_referrer_url=${encodeURIComponent(GAMES_HOST)}`
        : `${GAMES_HOST}/${game.id}/`;
      feed.push({ ...game, uniqueId: `${game.id}-${startIndex + i}-${Date.now()}`, gameUrl });
    }
    return feed;
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== activeIndexRef.current) setActiveIndex(newIndex);
    }
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const loadMore = useCallback(() => {
    if (games.length === 0) return;
    const newGames = generateFeed(5, feedIndexRef.current);
    feedIndexRef.current += 5;
    setFeedData(prev => [...prev, ...newGames]);
  }, [games]);

  const renderItem = useCallback(({ item, index }: { item: FeedItem; index: number }) => {
    return (
      <View style={{ height: screenHeight, width: '100%' }}>
        <GameCard
          game={item}
          gameUrl={item.gameUrl}
          isActive={index === activeIndex}
          isPreloading={false}
          useExternalWebView={true}
        />
      </View>
    );
  }, [activeIndex, screenHeight]);

  const keyExtractor = useCallback((item: FeedItem) => item.uniqueId, []);
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: screenHeight, offset: screenHeight * index, index,
  }), [screenHeight]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading games...</Text>
      </View>
    );
  }

  return (
    <Animated.View {...edgePanResponder.panHandlers} style={styles.container} pointerEvents="box-none" collapsable={false}>
      {/* WebView Pool - games render here */}
      <WebViewPool ref={webViewPoolRef} isScrollMode={false} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>For You</Text>
      </View>

      {/* Scroll disabled FlatList tracks items */}
      <FlatList
        ref={flatListRef}
        data={feedData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={screenHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={loadMore}
        onEndReachedThreshold={3}
        getItemLayout={getItemLayout}
        scrollEnabled={false}
        removeClippedSubviews={false}
        maxToRenderPerBatch={3}
        windowSize={7}
        initialNumToRender={3}
      />

      {/* Native gesture zones handle edge swipes via container pointerEvents="box-none" */}

    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingBottom: 8,
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  loadingText: { color: '#fff', marginTop: 12, fontSize: 16 },
});
