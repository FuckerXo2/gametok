import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

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

interface GameSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectGame: (gameId: string) => void;
}

export const GameSearchModal: React.FC<GameSearchModalProps> = ({ 
  visible, 
  onClose,
  onSelectGame 
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGames = searchQuery.length > 0
    ? ALL_GAMES.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : ALL_GAMES;

  const handleSelectGame = (gameId: string) => {
    onSelectGame(gameId);
    onClose();
    setSearchQuery('');
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Games</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search games"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Categories */}
          {searchQuery.length === 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Categories</Text>
              <View style={styles.categoriesGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity 
                    key={cat.id}
                    style={[styles.categoryCard, { backgroundColor: colors.surface }]}
                  >
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                    <Text style={[styles.categoryName, { color: colors.text }]}>{cat.name}</Text>
                    <Text style={[styles.categoryCount, { color: colors.textSecondary }]}>
                      {cat.count} games
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Games List */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {searchQuery.length > 0 ? 'Results' : 'All Games'}
            </Text>
            
            {filteredGames.length === 0 ? (
              <Text style={[styles.noResults, { color: colors.textSecondary }]}>
                No games found for "{searchQuery}"
              </Text>
            ) : (
              filteredGames.map((game) => (
                <TouchableOpacity
                  key={game.id}
                  style={[styles.gameRow, { borderBottomColor: colors.border }]}
                  onPress={() => handleSelectGame(game.id)}
                >
                  <View style={[styles.gameIcon, { backgroundColor: game.color }]}>
                    <Text style={styles.gameEmoji}>{game.icon}</Text>
                  </View>
                  <View style={styles.gameInfo}>
                    <Text style={[styles.gameName, { color: colors.text }]}>{game.name}</Text>
                    <Text style={[styles.gamePlays, { color: colors.textSecondary }]}>
                      {game.plays} plays
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={[styles.playBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleSelectGame(game.id)}
                  >
                    <Ionicons name="play" size={16} color="#fff" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '31%',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryCount: {
    fontSize: 11,
    marginTop: 2,
  },
  noResults: {
    textAlign: 'center',
    fontSize: 15,
    marginTop: 20,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  gameIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  gameEmoji: {
    fontSize: 26,
  },
  gameInfo: {
    flex: 1,
  },
  gameName: {
    fontSize: 16,
    fontWeight: '600',
  },
  gamePlays: {
    fontSize: 13,
    marginTop: 2,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
