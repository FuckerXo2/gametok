import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
  Linking,
  Image,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAuthScreen, useDeepLink, useNavigation } from '../../App';
import { auth, savedGames as savedGamesApi } from '../services/api';
import { AddFriendsScreen } from './AddFriendsScreen';
import { EditProfileModal } from './EditProfileModal';
import { Avatar } from './Avatar';
import { FollowListModal } from './FollowListModal';
import { UserProfileModal } from './UserProfileModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const TILE_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
const GAMES_HOST = 'https://games.gametok.co';

interface Game { id: string; name: string; thumbnail?: string; }
const getThumbnailUrl = (game: Game) => game.thumbnail || `${GAMES_HOST}/thumbnails/${game.id}.png`;
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

type ProfileContentTab = 'created' | 'saved' | 'liked';


export const ProfileScreen: React.FC<{ isActive?: boolean }> = ({ isActive }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const { showAuthScreen, showLoginScreen } = useAuthScreen();
  const { openSharedGame } = useDeepLink();
  const { setActiveTab } = useNavigation();
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savedGamesList, setSavedGamesList] = useState<Game[]>([]);
  const [profileTab, setProfileTab] = useState<ProfileContentTab>('saved');
  const [socialStats, setSocialStats] = useState({ followers: 0, following: 0 });
  const [followModalConfig, setFollowModalConfig] = useState<{ visible: boolean, tab: 'followers' | 'following' }>({ visible: false, tab: 'followers' });
  const [selectedProfileUser, setSelectedProfileUser] = useState<any>(null);
  const lastFetchRef = useRef<number>(0);



  const username = user?.username || 'guest';
  const displayName = user?.displayName || '';
  const avatar = user?.avatar || null;
  const bio = user?.bio || '';

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated]);

  // Refresh when tab becomes active
  useEffect(() => {
    if (isActive && isAuthenticated && !refreshing) {
      const now = Date.now();
      if (now - lastFetchRef.current > 5000) {
        // Small delay to allow HomeScreen's sync to complete first
        setTimeout(() => {
          fetchData(true);
        }, 500);
      }
    }
  }, [isActive]);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [savedRes, userRes] = await Promise.all([
        user?.id ? savedGamesApi.userSaved(user.id) : Promise.resolve({ games: [] }),
        user?.id ? import('../services/api').then(({ users }) => users.get(user.id)) : Promise.resolve({ stats: { followers: 0, following: 0 } }),
      ]);
      setSavedGamesList(savedRes.games || []);
      if (userRes?.stats) {
        setSocialStats({
          followers: userRes.stats.followers || 0,
          following: userRes.stats.following || 0,
        });
      }
      lastFetchRef.current = Date.now();
    } catch (e) {
      console.log('Failed to fetch data:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const openSavedGame = (game: Game) => {
    openSharedGame(game.id);
    setActiveTab('home');
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Check out @${username} on GameTok: https://games.gametok.co/u/${username}`,
      });
    } catch (e) {
      console.log('Failed to share profile:', e);
    }
  };

  const renderGameTile = ({ item }: { item: Game }) => (
    <TouchableOpacity
      style={{ width: TILE_SIZE, height: TILE_SIZE, margin: GRID_GAP / 2 }}
      activeOpacity={0.9}
      onPress={() => openSavedGame(item)}
    >
      <Image source={{ uri: getThumbnailUrl(item) }} style={{ width: '100%', height: '100%', backgroundColor: colors.surface }} resizeMode="cover" />
    </TouchableOpacity>
  );

  const renderEmptyState = (icon: string, title: string, subtitle: string) => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name={icon as any} size={32} color={colors.textSecondary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
    </View>
  );

  const renderProfileContent = () => {
    if (profileTab === 'created') {
      return renderEmptyState(
        'sparkles-outline',
        'No published games yet',
        'When your own worlds go live, they should sit here first.',
      );
    }

    if (profileTab === 'liked') {
      return renderEmptyState(
        'heart-outline',
        'No liked games yet',
        'The weird stuff you love can live here when likes are wired in.',
      );
    }

    if (savedGamesList.length === 0) {
      return renderEmptyState(
        'bookmark-outline',
        'Your vault is empty',
        'Save a game from the feed and it will land here.',
      );
    }

    return (
      <FlatList
        data={savedGamesList}
        renderItem={renderGameTile}
        keyExtractor={item => item.id}
        numColumns={NUM_COLUMNS}
        scrollEnabled={false}
        contentContainerStyle={{ paddingHorizontal: 1, paddingTop: 2 }}
      />
    );
  };

  if (!isAuthenticated) {
    // Show a preview profile with auth overlay
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Preview Profile Content */}
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} scrollEnabled={false}>
          <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <View style={{ width: 40 }} />
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>@username</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Preview Profile Info */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(168,85,247,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 20 }}>
                <Ionicons name="person" size={40} color="#a855f7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 4 }}>Your Name</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Your bio goes here...</Text>
              </View>
            </View>

            {/* Preview Stats */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>0</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Following</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>0</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Followers</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>0</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Likes</Text>
              </View>
            </View>

            {/* Preview Saved Games Grid */}
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Saved Games</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <View key={i} style={{ width: TILE_SIZE, height: TILE_SIZE, backgroundColor: colors.surface, borderRadius: 4 }} />
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Auth Overlay */}
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 20 }}>Sign up to continue</Text>
            <TouchableOpacity style={{ width: 200, borderRadius: 25, overflow: 'hidden' }} onPress={showAuthScreen} activeOpacity={0.8}>
              <LinearGradient colors={['#a855f7', '#7c3aed']} style={{ paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Sign Up</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={showLoginScreen}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 16 }}>or log in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor="#a855f7" />}
      >
        <View style={[styles.profileShell, { paddingTop: insets.top + 10 }]}>
          <View style={styles.profileTopBar}>
            <TouchableOpacity
              style={[styles.topIconButton, { backgroundColor: colors.surface }]}
              onPress={() => setShowAddFriends(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add-outline" size={21} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.topUsername, { color: colors.text }]}>@{username}</Text>
            <TouchableOpacity
              style={[styles.topIconButton, { backgroundColor: colors.surface }]}
              onPress={() => setShowSettings(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="menu-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.heroCard}>
            <LinearGradient
              colors={isDark ? ['rgba(168,85,247,0.18)', 'rgba(0,229,255,0.08)', 'rgba(255,255,255,0.02)'] : ['rgba(168,85,247,0.16)', 'rgba(0,229,255,0.12)', 'rgba(0,0,0,0.03)']}
              style={[styles.heroGlow, { borderColor: colors.border }]}
            >
              <TouchableOpacity onPress={() => setShowEditProfile(true)} activeOpacity={0.9} style={styles.avatarHitbox}>
                <View style={[styles.avatarRing, { borderColor: colors.primary }]}>
                  <Avatar uri={avatar} size={98} />
                </View>
                <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary }]}>
                  <Ionicons name="pencil" size={13} color="#fff" />
                </View>
              </TouchableOpacity>

              <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
                {displayName || username}
              </Text>
              <Text style={[styles.handleText, { color: colors.textSecondary }]}>@{username}</Text>
              <Text style={[styles.bioText, { color: bio ? colors.text : colors.textSecondary }]} numberOfLines={3}>
                {bio || 'No bio yet. Make this little corner of the internet yours.'}
              </Text>

              <View style={styles.statsRow}>
                <TouchableOpacity style={styles.statItem} onPress={() => setFollowModalConfig({ visible: true, tab: 'following' })}>
                  <Text style={[styles.statNumber, { color: colors.text }]}>{formatNumber(socialStats.following)}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Following</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.statItem} onPress={() => setFollowModalConfig({ visible: true, tab: 'followers' })}>
                  <Text style={[styles.statNumber, { color: colors.text }]}>{formatNumber(socialStats.followers)}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Followers</Text>
                </TouchableOpacity>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: colors.text }]}>{formatNumber(savedGamesList.length)}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Saved</Text>
                </View>
              </View>

              <View style={styles.profileActions}>
                <TouchableOpacity
                  style={[styles.primaryAction, { backgroundColor: colors.text }]}
                  onPress={() => setShowEditProfile(true)}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.primaryActionText, { color: colors.background }]}>Edit profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryAction, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={handleShareProfile}
                  activeOpacity={0.9}
                >
                  <Ionicons name="arrow-redo-outline" size={17} color={colors.text} />
                  <Text style={[styles.secondaryActionText, { color: colors.text }]}>Share</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>

        <View style={[styles.contentTabs, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
          {[
            { key: 'created', label: 'Created', icon: 'grid-outline' },
            { key: 'saved', label: 'Saved', icon: 'bookmark-outline' },
            { key: 'liked', label: 'Liked', icon: 'heart-outline' },
          ].map((tab) => {
            const isSelected = profileTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.contentTab}
                onPress={() => setProfileTab(tab.key as ProfileContentTab)}
                activeOpacity={0.85}
              >
                <Ionicons name={tab.icon as any} size={18} color={isSelected ? colors.text : colors.textSecondary} />
                <Text style={[styles.contentTabText, { color: isSelected ? colors.text : colors.textSecondary }]}>
                  {tab.label}
                </Text>
                {isSelected && <View style={[styles.activeTabBar, { backgroundColor: colors.text }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {renderProfileContent()}
      </ScrollView>

      <AddFriendsScreen visible={showAddFriends} onClose={() => setShowAddFriends(false)} />
      <EditProfileModal visible={showEditProfile} onClose={() => setShowEditProfile(false)} />

      <FollowListModal
        visible={followModalConfig.visible}
        onClose={() => setFollowModalConfig({ ...followModalConfig, visible: false })}
        userId={user?.id || ''}
        username={username}
        initialTab={followModalConfig.tab}
        onUserPress={(profileUser) => {
          setFollowModalConfig({ ...followModalConfig, visible: false });
          setTimeout(() => {
            setSelectedProfileUser({ ...profileUser, isFriend: false });
          }, 300);
        }}
      />

      <UserProfileModal
        visible={!!selectedProfileUser}
        onClose={() => {
          setSelectedProfileUser(null);
          fetchData(true);
        }}
        user={selectedProfileUser}
      />

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowSettings(false)} activeOpacity={1} />
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 20, maxHeight: '70%' }}>
            <View style={{ width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginVertical: 12 }} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 }} onPress={() => { setShowSettings(false); setShowEditProfile(true); }}>
                <Ionicons name="person-outline" size={22} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: 16 }}>Edit Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 }} onPress={() => { setShowSettings(false); setShowAddFriends(true); }}>
                <Ionicons name="person-add-outline" size={22} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: 16 }}>Find Friends</Text>
              </TouchableOpacity>

              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 }}>
                <Ionicons name={isDark ? "moon" : "sunny-outline"} size={22} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: 16 }}>Dark Mode</Text>
                <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#ccc', true: '#a855f7' }} thumbColor="#fff" style={{ marginLeft: 'auto' }} />
              </View>

              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 }} onPress={() => Linking.openURL('mailto:gametokapp@gmail.com')}>
                <Ionicons name="mail-outline" size={22} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: 16 }}>Contact Us</Text>
              </TouchableOpacity>

              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 }} onPress={() => Linking.openURL('https://gametok.co/privacy.html')}>
                <Ionicons name="shield-outline" size={22} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: 16 }}>Privacy Policy</Text>
              </TouchableOpacity>

              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 }} onPress={() => Linking.openURL('https://gametok.co/terms.html')}>
                <Ionicons name="document-text-outline" size={22} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: 16 }}>Terms of Service</Text>
              </TouchableOpacity>

              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 }} onPress={() => { setShowSettings(false); logout(); }}>
                <Ionicons name="log-out-outline" size={22} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: 16 }}>Log Out</Text>
              </TouchableOpacity>

              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 }} onPress={() => {
                Alert.alert('Delete Account', 'Are you sure? This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                      try { await auth.deleteAccount(); setShowSettings(false); logout(); }
                      catch { Alert.alert('Error', 'Failed to delete account.'); }
                    }
                  }
                ]);
              }}>
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: 16 }}>Delete Account</Text>
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
  profileShell: {
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  profileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  topIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topUsername: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroCard: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  heroGlow: {
    alignItems: 'center',
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 20,
  },
  avatarHitbox: {
    marginBottom: 12,
  },
  avatarRing: {
    padding: 4,
    borderWidth: 2,
    borderRadius: 58,
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 2,
    bottom: 5,
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  displayName: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
    maxWidth: '90%',
  },
  handleText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    textAlign: 'center',
    maxWidth: 290,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    marginTop: 20,
    marginBottom: 18,
  },
  statItem: {
    minWidth: 72,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  profileActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  primaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryAction: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '800',
  },
  contentTabs: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  contentTab: {
    flex: 1,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  contentTabText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  activeTabBar: {
    position: 'absolute',
    bottom: 0,
    width: 34,
    height: 3,
    borderRadius: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 34,
    paddingTop: 62,
    paddingBottom: 90,
  },
  emptyIconBubble: {
    width: 78,
    height: 78,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
});
