import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  ScrollView, 
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

const TRENDING_GAMES = [
  { id: 'pacman', name: 'Pac-Man', plays: '2.4M', icon: '🟡', color: '#FFFF00' },
  { id: 'fruit-slicer', name: 'Fruit Slicer', plays: '1.8M', icon: '🍉', color: '#ff6b6b' },
  { id: 'helix-jump', name: 'Helix Jump', plays: '3.1M', icon: '🌀', color: '#00d4aa' },
  { id: 'color-switch', name: 'Color Switch', plays: '890K', icon: '🔴', color: '#ff9500' },
];

const CATEGORIES = [
  { name: 'Arcade', icon: '🕹️', count: 234 },
  { name: 'Puzzle', icon: '🧩', count: 156 },
  { name: 'Action', icon: '⚡', count: 189 },
  { name: 'Casual', icon: '🎯', count: 312 },
];

export const DiscoverScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search games"
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
            {CATEGORIES.map((cat, index) => (
              <TouchableOpacity key={index} style={styles.categoryCard}>
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text style={styles.categoryName}>{cat.name}</Text>
                <Text style={styles.categoryCount}>{cat.count} games</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Trending */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔥 Trending Now</Text>
          <View style={styles.gamesGrid}>
            {TRENDING_GAMES.map((game, index) => (
              <TouchableOpacity key={index} style={styles.gameCard}>
                <View style={[styles.gameCardImage, { backgroundColor: game.color }]}>
                  <Text style={styles.gameCardIcon}>{game.icon}</Text>
                </View>
                <Text style={styles.gameCardName}>{game.name}</Text>
                <View style={styles.gameCardStats}>
                  <Ionicons name="play" size={12} color="#999" />
                  <Text style={styles.gameCardPlays}>{game.plays}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Hashtags */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Hashtags</Text>
          <View style={styles.hashtagsContainer}>
            {['#highscore', '#gaming', '#challenge', '#viral', '#newgame', '#speedrun'].map((tag, i) => (
              <TouchableOpacity key={i} style={styles.hashtag}>
                <Text style={styles.hashtagText}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  categoriesScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  categoryCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 100,
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  categoryName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryCount: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gameCard: {
    width: CARD_WIDTH,
    marginBottom: 16,
  },
  gameCardImage: {
    width: '100%',
    height: CARD_WIDTH * 1.2,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameCardIcon: {
    fontSize: 48,
  },
  gameCardName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  gameCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  gameCardPlays: {
    color: '#999',
    fontSize: 12,
    marginLeft: 4,
  },
  hashtagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  hashtag: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  hashtagText: {
    color: '#fff',
    fontSize: 14,
  },
});
