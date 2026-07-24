import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { savedGames as savedGamesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_SIZE = (SCREEN_WIDTH - 4) / 3;

interface Game {
  id: string;
  name: string;
  thumbnail?: string;
  icon?: string;
  color?: string;
  embedUrl?: string;
}

const USER_GAMES = [
  { id: 1, game: 'Stack Ball', score: 1250, icon: '🎱', color: '#667eea', plays: '12.4K' },
  { id: 2, game: 'Fruit Slicer', score: 890, icon: '🍉', color: '#ff6b6b', plays: '8.2K' },
  { id: 3, game: 'Stack Ball', score: 2100, icon: '🎱', color: '#667eea', plays: '45.1K' },
  { id: 4, game: 'Fruit Slicer', score: 1560, icon: '🍉', color: '#ff6b6b', plays: '23.8K' },
  { id: 5, game: 'Stack Ball', score: 780, icon: '🎱', color: '#667eea', plays: '5.6K' },
  { id: 6, game: 'Fruit Slicer', score: 2340, icon: '🍉', color: '#ff6b6b', plays: '67.2K' },
];

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'created' | 'played' | 'liked'>('created');
  const [savedGames, setSavedGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);

  // Load saved games when tab is active
  useEffect(() => {
    if (activeTab === 'liked' && user?.id) {
      loadSavedGames();
    }
  }, [activeTab, user?.id]);

  const loadSavedGames = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const result = await savedGamesApi.userSaved(user.id);
      setSavedGames(result.games || []);
    } catch (e) {
      console.error('Failed to load saved games:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleGamePress = async (game: Game) => {
    // Store the game to play and navigate to home
    await AsyncStorage.setItem('playGameId', game.id);
    // TODO: Navigate to home screen and play this game
    // For now, just log it
    console.log('Play game:', game.name);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="person-add-outline" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.username}>@username</Text>
        <TouchableOpacity>
          <Ionicons name="menu-outline" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>🎮</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <TouchableOpacity style={styles.statItem}>
              <Text style={styles.statNumber}>127</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem}>
              <Text style={styles.statNumber}>10.2K</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem}>
              <Text style={styles.statNumber}>234.5K</Text>
              <Text style={styles.statLabel}>Plays</Text>
            </TouchableOpacity>
          </View>

          {/* Bio */}
          <Text style={styles.bio}>🎮 Gaming enthusiast | High score hunter</Text>
          <Text style={styles.bioLink}>🔗 linktr.ee/gamer2024</Text>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.editButton}>
              <Text style={styles.editButtonText}>Edit profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButton}>
              <Ionicons name="share-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={styles.tab}
            onPress={() => setActiveTab('created')}
          >
            <Ionicons 
              name="grid-outline" 
              size={22} 
              color={activeTab === 'created' ? '#fff' : '#888'} 
            />
            <Text style={[styles.tabText, activeTab === 'created' && styles.tabTextActive]}>CREATED</Text>
            {activeTab === 'created' && <View style={styles.activeTabUnderline} />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.tab}
            onPress={() => setActiveTab('played')}
          >
            <Ionicons 
              name="play-circle-outline" 
              size={22} 
              color={activeTab === 'played' ? '#fff' : '#888'} 
            />
            <Text style={[styles.tabText, activeTab === 'played' && styles.tabTextActive]}>PLAYED</Text>
            {activeTab === 'played' && <View style={styles.activeTabUnderline} />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.tab}
            onPress={() => setActiveTab('liked')}
          >
            <Ionicons 
              name="heart-outline" 
              size={22} 
              color={activeTab === 'liked' ? '#fff' : '#888'} 
            />
            <Text style={[styles.tabText, activeTab === 'liked' && styles.tabTextActive]}>LIKED</Text>
            {activeTab === 'liked' && <View style={styles.activeTabUnderline} />}
          </TouchableOpacity>
        </View>

        {/* Games Grid */}
        <View style={styles.gamesGrid}>
          {activeTab === 'liked' ? (
            loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            ) : savedGames.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="bookmark-outline" size={64} color="#333" />
                <Text style={styles.emptyText}>No saved games yet</Text>
                <Text style={styles.emptySubtext}>Tap the bookmark button on games you want to save</Text>
              </View>
            ) : (
              savedGames.map((game) => (
                <TouchableOpacity 
                  key={game.id} 
                  style={styles.savedGameItem}
                  onPress={() => handleGamePress(game)}
                  activeOpacity={0.8}
                >
                  {game.thumbnail ? (
                    <Image 
                      source={{ uri: game.thumbnail }} 
                      style={styles.savedGameThumbnail}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.savedGameThumbnail, { backgroundColor: game.color || '#667eea' }]}>
                      <Text style={styles.savedGameIcon}>{game.icon || '🎮'}</Text>
                    </View>
                  )}
                  <View style={styles.savedGameOverlay}>
                    <Text style={styles.savedGameName} numberOfLines={2}>{game.name}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )
          ) : (
            USER_GAMES.map((item) => (
              <TouchableOpacity key={item.id} style={styles.gameGridItem}>
                <View style={[styles.gameGridImage, { backgroundColor: item.color }]}>
                  <Text style={styles.gameGridIcon}>{item.icon}</Text>
                  <View style={styles.gameGridScore}>
                    <Text style={styles.gameGridScoreText}>{item.score}</Text>
                  </View>
                </View>
                <View style={styles.gameGridPlays}>
                  <Ionicons name="play" size={12} color="#fff" />
                  <Text style={styles.gameGridPlaysText}>{item.plays}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  username: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  profileInfo: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  avatarText: {
    fontSize: 40,
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: '#999',
    fontSize: 13,
    marginTop: 2,
  },
  bio: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  bioLink: {
    color: '#999',
    fontSize: 14,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#333',
    paddingHorizontal: 40,
    paddingVertical: 10,
    borderRadius: 4,
    marginRight: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  shareButton: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0a0a0a', // very dark background like the pill
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    gap: 4,
  },
  tabText: {
    color: '#888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: '#fff',
  },
  activeTabUnderline: {
    position: 'absolute',
    bottom: -8, // sits right below the text at the edge of the container padding
    width: 24,
    height: 3,
    backgroundColor: '#a855f7',
    borderRadius: 2,
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gameGridItem: {
    width: GRID_SIZE,
    height: GRID_SIZE * 1.4,
    padding: 1,
  },
  gameGridImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  gameGridIcon: {
    fontSize: 36,
  },
  gameGridScore: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gameGridScoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  gameGridPlays: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gameGridPlaysText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  // Saved games styles
  loadingContainer: {
    width: SCREEN_WIDTH,
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    width: SCREEN_WIDTH,
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  savedGameItem: {
    width: GRID_SIZE,
    height: GRID_SIZE * 1.4,
    padding: 1,
  },
  savedGameThumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  savedGameIcon: {
    fontSize: 36,
  },
  savedGameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
  },
  savedGameName: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
