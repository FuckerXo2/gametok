import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ImageBackground,
  Modal,
  Switch,
  Alert,
  Linking,
  Image,
  Dimensions,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { auth, likes as likesApi, savedGames as savedGamesApi } from '../services/api';
import { AddFriendsScreen } from './AddFriendsScreen';
import { EditProfileModal } from './EditProfileModal';
import { Avatar } from './Avatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const TILE_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const GAMES_HOST = 'https://gametok-games.pages.dev';

interface Game {
  id: string;
  name: string;
  thumbnail?: string;
  embedUrl?: string;
}

// Get thumbnail URL for a game
const getThumbnailUrl = (game: Game) => {
  if (game.thumbnail) return game.thumbnail;
  return `${GAMES_HOST}/thumbnails/${game.id}.png`;
};

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'liked' | 'saved'>('liked');
  const [likedGames, setLikedGames] = useState<Game[]>([]);
  const [savedGamesList, setSavedGamesList] = useState<Game[]>([]);
  const [loadingLiked, setLoadingLiked] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const username = isAuthenticated ? user?.username : 'guest';
  const displayName = isAuthenticated ? user?.displayName : '';
  const avatar = isAuthenticated ? user?.avatar : null;
  const bio = isAuthenticated ? (user?.bio || '') : '';
  const followers = isAuthenticated ? (user?.followers?.length || 0) : 0;

  // Fetch liked games
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchLikedGames();
      fetchSavedGames();
    }
  }, [isAuthenticated, user?.id]);

  const fetchLikedGames = async () => {
    if (!user?.id) return;
    setLoadingLiked(true);
    try {
      const result = await likesApi.userLikes(user.id);
      setLikedGames(result.games || []);
    } catch (e) {
      console.log('Failed to fetch liked games:', e);
    } finally {
      setLoadingLiked(false);
    }
  };

  const fetchSavedGames = async () => {
    if (!user?.id) return;
    setLoadingSaved(true);
    try {
      const result = await savedGamesApi.userSaved(user.id);
      setSavedGamesList(result.games || []);
    } catch (e) {
      console.log('Failed to fetch saved games:', e);
    } finally {
      setLoadingSaved(false);
    }
  };

  const renderGameTile = ({ item }: { item: Game }) => (
    <TouchableOpacity style={styles.gameTile} activeOpacity={0.8}>
      <Image 
        source={{ uri: getThumbnailUrl(item) }} 
        style={styles.gameThumbnail}
        resizeMode="cover"
      />
      {/* Play count overlay - like TikTok views */}
      <View style={styles.tileOverlay}>
        <Ionicons name="game-controller" size={12} color="#fff" />
        <Text style={styles.tileCount}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = (type: 'liked' | 'saved') => (
    <View style={styles.emptyState}>
      <Ionicons 
        name={type === 'liked' ? 'heart-outline' : 'bookmark-outline'} 
        size={48} 
        color={colors.textSecondary} 
      />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {type === 'liked' ? 'No liked games yet' : 'No saved games yet'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {type === 'liked' 
          ? 'Games you like will appear here' 
          : 'Tap the bookmark to save games'}
      </Text>
    </View>
  );

  const currentGames = activeTab === 'liked' ? likedGames : savedGamesList;
  const isLoading = activeTab === 'liked' ? loadingLiked : loadingSaved;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      {/* Header with background */}
      <View style={styles.headerSection}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800' }}
          style={[styles.coverImage, { paddingTop: insets.top }]}
          resizeMode="cover"
        >
          {/* Top buttons */}
          <View style={styles.topButtons}>
            <TouchableOpacity style={styles.topBtn} onPress={() => setShowAddFriends(true)}>
              <Ionicons name="person-add-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.topRight}>
              <TouchableOpacity style={styles.topBtn} onPress={() => setShowSettings(true)}>
                <Ionicons name="menu-outline" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Profile info overlay */}
          <View style={styles.profileOverlay}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              <Avatar uri={avatar} size={80} />
            </View>
            
            {/* Username */}
            <Text style={styles.displayName}>{displayName || username}</Text>
            <Text style={styles.handle}>@{username}</Text>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{followers}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{likedGames.length}</Text>
                <Text style={styles.statLabel}>Liked</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{savedGamesList.length}</Text>
                <Text style={styles.statLabel}>Saved</Text>
              </View>
            </View>

            {/* Bio */}
            {bio ? <Text style={styles.bio}>{bio}</Text> : null}

            {/* Edit Profile Button */}
            <TouchableOpacity 
              style={styles.editProfileBtn} 
              onPress={() => setShowEditProfile(true)}
            >
              <Text style={styles.editProfileText}>Edit profile</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'liked' && styles.tabActive]}
          onPress={() => setActiveTab('liked')}
        >
          <Ionicons 
            name={activeTab === 'liked' ? 'heart' : 'heart-outline'} 
            size={22} 
            color={activeTab === 'liked' ? colors.text : colors.textSecondary} 
          />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
          onPress={() => setActiveTab('saved')}
        >
          <Ionicons 
            name={activeTab === 'saved' ? 'bookmark' : 'bookmark-outline'} 
            size={22} 
            color={activeTab === 'saved' ? colors.text : colors.textSecondary} 
          />
        </TouchableOpacity>
        
        {/* Active indicator */}
        <View style={[
          styles.tabIndicator, 
          { 
            backgroundColor: colors.text,
            left: activeTab === 'liked' ? '25%' : '75%',
            transform: [{ translateX: -20 }],
          }
        ]} />
      </View>

      {/* Games Grid */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : currentGames.length === 0 ? (
        renderEmptyState(activeTab)
      ) : (
        <FlatList
          data={currentGames}
          renderItem={renderGameTile}
          keyExtractor={item => item.id}
          numColumns={NUM_COLUMNS}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.gridRow}
        />
      )}

      {/* Add Friends Modal */}
      <AddFriendsScreen visible={showAddFriends} onClose={() => setShowAddFriends(false)} />
      
      {/* Edit Profile Modal */}
      <EditProfileModal visible={showEditProfile} onClose={() => setShowEditProfile(false)} />

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <View style={styles.settingsOverlay}>
          <TouchableOpacity style={styles.settingsDismiss} onPress={() => setShowSettings(false)} activeOpacity={1} />
          <View style={[styles.settingsContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.settingsHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.settingsTitle, { color: colors.text }]}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.settingsContent}>
              {/* Account Section */}
              <Text style={[styles.settingsSectionTitle, { color: colors.textSecondary }]}>ACCOUNT</Text>
              
              <TouchableOpacity style={[styles.settingsItem, { borderBottomColor: colors.border }]}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="person-outline" size={22} color={colors.text} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Account</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.settingsItem, { borderBottomColor: colors.border }]}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="lock-closed-outline" size={22} color={colors.text} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Privacy</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Preferences Section */}
              <Text style={[styles.settingsSectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>PREFERENCES</Text>
              
              <View style={[styles.settingsItem, { borderBottomColor: colors.border }]}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name={isDark ? "moon" : "sunny-outline"} size={22} color={colors.text} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Dark Mode</Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#767577', true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>

              {/* Support Section */}
              <Text style={[styles.settingsSectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>SUPPORT</Text>
              
              <TouchableOpacity 
                style={[styles.settingsItem, { borderBottomColor: colors.border }]}
                onPress={() => Linking.openURL('mailto:support@gametok.app')}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="mail-outline" size={22} color={colors.text} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Contact Us</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.settingsItem, { borderBottomColor: colors.border }]}
                onPress={() => Linking.openURL('https://gametok-landing.pages.dev/privacy.html')}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="shield-checkmark-outline" size={22} color={colors.text} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Privacy Policy</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.settingsItem, { borderBottomColor: colors.border }]}
                onPress={() => Linking.openURL('https://gametok-landing.pages.dev/terms.html')}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="document-text-outline" size={22} color={colors.text} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Terms of Service</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Logout */}
              <TouchableOpacity 
                style={[styles.settingsItem, { marginTop: 24 }]} 
                onPress={() => {
                  setShowSettings(false);
                  logout();
                }}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
                  <Text style={[styles.settingsItemText, { color: '#FF3B30' }]}>Log Out</Text>
                </View>
              </TouchableOpacity>

              {/* Delete Account */}
              <TouchableOpacity 
                style={[styles.settingsItem, styles.deleteItem]} 
                onPress={() => {
                  Alert.alert(
                    'Delete Account',
                    'Are you sure? This cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Delete', 
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await auth.deleteAccount();
                            setShowSettings(false);
                            logout();
                          } catch (error) {
                            Alert.alert('Error', 'Failed to delete account.');
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                  <Text style={[styles.settingsItemText, { color: '#FF3B30' }]}>Delete Account</Text>
                </View>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    height: 340,
  },
  coverImage: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRight: {
    flexDirection: 'row',
    gap: 8,
  },
  profileOverlay: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  avatarContainer: {
    marginBottom: 8,
  },
  displayName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  handle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  bio: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 12,
  },
  editProfileBtn: {
    paddingHorizontal: 40,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  editProfileText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    position: 'relative',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabActive: {},
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 40,
    height: 2,
  },
  // Grid
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    paddingTop: GRID_GAP,
  },
  gridRow: {
    gap: GRID_GAP,
  },
  gameTile: {
    width: TILE_SIZE,
    height: TILE_SIZE * 1.3,
    marginBottom: GRID_GAP,
  },
  gameThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  tileOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tileCount: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  // Settings Modal
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  settingsDismiss: {
    flex: 1,
  },
  settingsContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  settingsContent: {
    paddingHorizontal: 20,
  },
  settingsSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  settingsItemText: {
    fontSize: 16,
  },
  deleteItem: {
    borderBottomWidth: 0,
  },
});
