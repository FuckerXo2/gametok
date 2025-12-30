import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { users } from '../services/api';
import { UserProfileModal } from './UserProfileModal';
import { Avatar } from './Avatar';

interface UserResult {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  followers: number;
}

interface SelectedUser {
  id: string;
  username: string;
  displayName?: string;
  avatar: string | null;
  status: string;
  isOnline: boolean;
  isFriend: boolean;
}

const SUGGESTED_FRIENDS = [
  { id: '1', name: 'gamer_pro', avatar: null, reason: '5 mutual friends', reasonType: 'mutual', online: true },
  { id: '2', name: 'ninja_master', avatar: null, reason: 'Playing Stack Ball 🎱', reasonType: 'playing', online: true },
  { id: '3', name: 'speedrunner', avatar: null, reason: 'From your contacts', reasonType: 'contacts', online: false },
  { id: '4', name: 'casual_gamer', avatar: null, reason: 'Plays similar games', reasonType: 'similar', online: true },
];

const PLAYING_NOW = [
  { id: '1', user: 'gamer_pro', avatar: null, game: 'Stack Ball', gameIcon: '🎱', score: 2450 },
  { id: '2', user: 'speedrunner', avatar: null, game: 'Fruit Slicer', gameIcon: '🍉', score: 1890 },
];

export const DiscoverScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedUsers, setAddedUsers] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);

  const openUserProfile = (user: { id: string; name: string; avatar: string | null; reason?: string; online: boolean }) => {
    setSelectedUser({
      id: user.id,
      username: user.name,
      avatar: user.avatar,
      status: user.reason || 'RECENTLY JOINED',
      isOnline: user.online,
      isFriend: false,
    });
    setShowUserProfile(true);
  };

  // Search when query changes
  useEffect(() => {
    const search = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const data = await users.search(searchQuery.trim());
        setSearchResults(data.users || []);
      } catch (error) {
        console.log('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleAdd = async (userId: string) => {
    try {
      await users.follow(userId);
      setAddedUsers(prev => new Set([...prev, userId]));
    } catch (error) {
      console.log('Follow error:', error);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Find Friends</Text>
        <TouchableOpacity>
          <Ionicons name="qr-code-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by username"
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Results */}
      {searchQuery.length >= 2 ? (
        <View style={styles.searchResults}>
          {isSearching ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : searchResults.length === 0 ? (
            <Text style={[styles.noResults, { color: colors.textSecondary }]}>
              No users found for "{searchQuery}"
            </Text>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.userRow, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setSelectedUser({
                      id: item.id,
                      username: item.username,
                      displayName: item.displayName,
                      avatar: item.avatar,
                      status: 'GAMETOK USER',
                      isOnline: false,
                      isFriend: addedUsers.has(item.id),
                    });
                    setShowUserProfile(true);
                  }}
                >
                  <Avatar uri={item.avatar} size={48} style={styles.userAvatar} />
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>
                      {item.displayName || item.username}
                    </Text>
                    <Text style={[styles.userHandle, { color: colors.textSecondary }]}>
                      @{item.username}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.addBtn,
                      addedUsers.has(item.id)
                        ? { backgroundColor: colors.surface }
                        : { backgroundColor: colors.primary }
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (!addedUsers.has(item.id)) handleAdd(item.id);
                    }}
                  >
                    {addedUsers.has(item.id) ? (
                      <Ionicons name="checkmark" size={18} color={colors.textSecondary} />
                    ) : (
                      <Text style={styles.addBtnText}>Add</Text>
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={[styles.quickAction, { backgroundColor: colors.surface }]}>
              <View style={[styles.quickIcon, { backgroundColor: '#5856D6' }]}>
                <Ionicons name="people" size={22} color="#fff" />
              </View>
              <Text style={[styles.quickLabel, { color: colors.text }]}>Contacts</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.quickAction, { backgroundColor: colors.surface }]}>
              <View style={[styles.quickIcon, { backgroundColor: '#FF9500' }]}>
                <Ionicons name="link" size={22} color="#fff" />
              </View>
              <Text style={[styles.quickLabel, { color: colors.text }]}>Invite</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.quickAction, { backgroundColor: colors.surface }]}>
              <View style={[styles.quickIcon, { backgroundColor: '#34C759' }]}>
                <Ionicons name="share-outline" size={22} color="#fff" />
              </View>
              <Text style={[styles.quickLabel, { color: colors.text }]}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Playing Now */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>🎮 Playing Now</Text>
            {PLAYING_NOW.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={[styles.playingCard, { backgroundColor: colors.surface }]}
              >
                <Avatar uri={item.avatar} size={48} style={styles.playingAvatar} />
                <View style={styles.playingInfo}>
                  <Text style={[styles.playingUser, { color: colors.text }]}>{item.user}</Text>
                  <View style={styles.playingGame}>
                    <Text style={styles.playingGameIcon}>{item.gameIcon}</Text>
                    <Text style={[styles.playingGameName, { color: colors.textSecondary }]}>
                      {item.game}
                    </Text>
                  </View>
                </View>
                <View style={styles.playingScore}>
                  <Text style={[styles.scoreValue, { color: colors.primary }]}>
                    {item.score.toLocaleString()}
                  </Text>
                  <TouchableOpacity style={[styles.challengeBtn, { borderColor: colors.primary }]}>
                    <Text style={[styles.challengeText, { color: colors.primary }]}>Challenge</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Suggested Friends */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Suggested</Text>
            {SUGGESTED_FRIENDS.map((friend) => (
              <TouchableOpacity 
                key={friend.id} 
                style={[styles.friendRow, { borderBottomColor: colors.border }]}
                onPress={() => openUserProfile(friend)}
              >
                <View style={styles.friendLeft}>
                  <View style={styles.friendAvatarWrap}>
                    <Avatar uri={friend.avatar} size={48} />
                    {friend.online && <View style={styles.onlineDot} />}
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={[styles.friendName, { color: colors.text }]}>{friend.name}</Text>
                    <Text style={[styles.friendReason, { color: colors.textSecondary }]}>
                      {friend.reason}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.addFriendBtn, { backgroundColor: colors.primary }]}>
                  <Ionicons name="person-add" size={18} color="#fff" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* User Profile Modal */}
      <UserProfileModal
        visible={showUserProfile}
        onClose={() => setShowUserProfile(false)}
        user={selectedUser}
      />
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loader: {
    marginTop: 40,
  },
  noResults: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarEmoji: {
    fontSize: 24,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
  },
  userHandle: {
    fontSize: 13,
    marginTop: 1,
  },
  addBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  playingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  playingAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playingEmoji: {
    fontSize: 24,
  },
  playingInfo: {
    flex: 1,
  },
  playingUser: {
    fontSize: 15,
    fontWeight: '600',
  },
  playingGame: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  playingGameIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  playingGameName: {
    fontSize: 13,
  },
  playingScore: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  challengeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  challengeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  friendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  friendEmoji: {
    fontSize: 24,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#fff',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '600',
  },
  friendReason: {
    fontSize: 13,
    marginTop: 1,
  },
  addFriendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
