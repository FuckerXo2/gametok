import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_SIZE = (SCREEN_WIDTH - 4) / 3;

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
  const [activeTab, setActiveTab] = useState<'games' | 'liked' | 'saved'>('games');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="person-add-outline" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.username}>@gamer_2024</Text>
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
        <View style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'games' && styles.tabActive]}
            onPress={() => setActiveTab('games')}
          >
            <Ionicons 
              name="game-controller" 
              size={22} 
              color={activeTab === 'games' ? '#fff' : '#666'} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'liked' && styles.tabActive]}
            onPress={() => setActiveTab('liked')}
          >
            <Ionicons 
              name="heart" 
              size={22} 
              color={activeTab === 'liked' ? '#fff' : '#666'} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
            onPress={() => setActiveTab('saved')}
          >
            <Ionicons 
              name="bookmark" 
              size={22} 
              color={activeTab === 'saved' ? '#fff' : '#666'} 
            />
          </TouchableOpacity>
        </View>

        {/* Games Grid */}
        <View style={styles.gamesGrid}>
          {USER_GAMES.map((item) => (
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
          ))}
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
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#fff',
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
});
