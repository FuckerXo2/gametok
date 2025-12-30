import React, { useState, useCallback, useRef } from 'react';
import { 
  View, 
  FlatList, 
  StyleSheet, 
  Dimensions,
  ViewToken,
  Text,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameCard } from '../components/GameCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const GAMES_HOST = 'https://gametok-games.pages.dev';

const GAMES = [
  {
    id: 'pacman',
    name: 'Pac-Man',
    description: 'Eat dots, avoid ghosts! Classic arcade action 👻',
    icon: '🎱',
    color: '#667eea',
    creator: '@stackmaster',
    sound: 'Original Sound - Gaming Vibes',
  },
  {
    id: 'fruit-slicer',
    name: 'Fruit Slicer',
    description: 'Swipe to slice fruits! Avoid bombs 💣',
    icon: '🍉',
    color: '#ff6b6b',
    creator: '@fruitninja_og',
    sound: 'Slice & Dice - GameBeats',
  },
];

interface FeedGame {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  creator: string;
  sound: string;
  uniqueId: string;
  gameUrl: string;
}

const generateFeed = (count: number, startIndex: number = 0): FeedGame[] => {
  const feed: FeedGame[] = [];
  for (let i = 0; i < count; i++) {
    const game = GAMES[(startIndex + i) % GAMES.length];
    feed.push({
      ...game,
      uniqueId: `${game.id}-${startIndex + i}-${Date.now()}`,
      gameUrl: `${GAMES_HOST}/${game.id}/`,
    });
  }
  return feed;
};

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [feedData, setFeedData] = useState<FeedGame[]>(() => generateFeed(10, 0));
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'following' | 'foryou'>('foryou');
  const flatListRef = useRef<FlatList>(null);
  const feedIndexRef = useRef(10);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const loadMore = useCallback(() => {
    const newGames = generateFeed(5, feedIndexRef.current);
    feedIndexRef.current += 5;
    setFeedData(prev => [...prev, ...newGames]);
  }, []);

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* TikTok-style Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTabs}>
          <TouchableOpacity 
            onPress={() => setActiveTab('following')}
            style={styles.headerTab}
          >
            <Text style={[
              styles.headerTabText, 
              activeTab === 'following' && styles.headerTabTextActive
            ]}>
              Following
            </Text>
            {activeTab === 'following' && <View style={styles.headerTabIndicator} />}
          </TouchableOpacity>
          
          <View style={styles.headerDivider} />
          
          <TouchableOpacity 
            onPress={() => setActiveTab('foryou')}
            style={styles.headerTab}
          >
            <Text style={[
              styles.headerTabText, 
              activeTab === 'foryou' && styles.headerTabTextActive
            ]}>
              For You
            </Text>
            {activeTab === 'foryou' && <View style={styles.headerTabIndicator} />}
          </TouchableOpacity>
        </View>
      </View>

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
        removeClippedSubviews={true}
        maxToRenderPerBatch={2}
        windowSize={3}
        initialNumToRender={1}
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
  headerTabs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  headerTabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 17,
    fontWeight: '600',
  },
  headerTabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  headerTabIndicator: {
    width: 32,
    height: 3,
    backgroundColor: '#fff',
    borderRadius: 2,
    marginTop: 4,
  },
  headerDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 4,
  },
});
