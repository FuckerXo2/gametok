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
import { auth, users as usersApi } from '../services/api';
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

type ProfileContentTab = 'created' | 'played' | 'liked';


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
  const [playedGamesList, setPlayedGamesList] = useState<Game[]>([]);
  const [profileTab, setProfileTab] = useState<ProfileContentTab>('played');
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
      const [playedRes, userRes] = await Promise.all([
        user?.id ? usersApi.played(user.id) : Promise.resolve({ games: [] }),
        user?.id ? usersApi.get(user.id) : Promise.resolve({ stats: { followers: 0, following: 0 } }),
      ]);
      setPlayedGamesList(playedRes.games || []);
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

  const openProfileGame = (game: Game) => {
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
      style={styles.gameTile}
      activeOpacity={0.9}
      onPress={() => openProfileGame(item)}
    >
      <Image source={{ uri: getThumbnailUrl(item) }} style={[styles.gameTileImage, { backgroundColor: colors.surface }]} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.78)']}
        style={styles.gameTileOverlay}
      >
        <Text style={styles.gameTileTitle} numberOfLines={2}>
          {item.name}
        </Text>
      </LinearGradient>
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

    if (playedGamesList.length === 0) {
      return renderEmptyState(
        'play-circle-outline',
        'No played games yet',
        'The games you spend time in will land here automatically.',
      );
    }

    return (
      <FlatList
        data={playedGamesList}
        renderItem={renderGameTile}
        keyExtractor={item => item.id}
        numColumns={NUM_COLUMNS}
        scrollEnabled={false}
        contentContainerStyle={styles.gameGrid}
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
              <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginRight: 20 }}>
                <Ionicons name="person" size={40} color={colors.textSecondary} />
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

            {/* Preview Played Games Grid */}
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Played Games</Text>
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
              <LinearGradient colors={['#2f2f2f', '#161616']} style={{ paddingVertical: 14, alignItems: 'center' }}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={colors.text} />}
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
            <TouchableOpacity onPress={() => setShowEditProfile(true)} activeOpacity={0.9} style={styles.avatarHitbox}>
              <View style={[styles.avatarRing, { borderColor: colors.border }]}>
                <Avatar uri={avatar} size={96} />
              </View>
              <View style={[styles.avatarEditBadge, { backgroundColor: colors.surface, borderColor: colors.background }]}>
                <Ionicons name="pencil" size={13} color={colors.text} />
              </View>
            </TouchableOpacity>

            <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
              {displayName || username}
            </Text>
            <Text style={[styles.handleText, { color: colors.textSecondary }]}>@{username}</Text>
            <Text style={[styles.bioText, { color: bio ? colors.text : colors.textSecondary }]} numberOfLines={3}>
              {bio || 'No bio yet.'}
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
                <Text style={[styles.statNumber, { color: colors.text }]}>{formatNumber(playedGamesList.length)}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Played</Text>
              </View>
            </View>

            <View style={styles.profileActions}>
              <TouchableOpacity
                style={[styles.primaryAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowEditProfile(true)}
                activeOpacity={0.9}
              >
                <Text style={[styles.primaryActionText, { color: colors.text }]}>Edit profile</Text>
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
          </View>
        </View>

        <View style={[styles.tabsShell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[
            { key: 'created', label: 'Created', icon: 'grid-outline' },
            { key: 'played', label: 'Played', icon: 'play-circle-outline' },
            { key: 'liked', label: 'Liked', icon: 'heart-outline' },
          ].map((tab) => {
            const isSelected = profileTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.contentTab,
                  {
                    backgroundColor: isSelected ? (isDark ? 'rgba(255,255,255,0.08)' : '#fff') : 'transparent',
                  },
                ]}
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

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {profileTab === 'created' ? 'Created' : profileTab === 'liked' ? 'Liked' : 'Played'}
          </Text>
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
          setSelectedProfileUser({ ...profileUser, isFriend: false });
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
                <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#ccc', true: '#666' }} thumbColor="#fff" style={{ marginLeft: 'auto' }} />
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
    paddingBottom: 10,
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
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  avatarHitbox: {
    marginBottom: 14,
    position: 'relative',
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
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    maxWidth: '90%',
    textAlign: 'center',
  },
  handleText: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    textAlign: 'center',
    maxWidth: 280,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 18,
    marginBottom: 18,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 21,
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
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryAction: {
    minHeight: 44,
    borderRadius: 16,
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
  tabsShell: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    padding: 3,
    borderRadius: 18,
    borderWidth: 1,
  },
  contentTabs: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  contentTab: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  contentTabText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeTabBar: {
    position: 'absolute',
    bottom: 5,
    width: 22,
    height: 2,
    borderRadius: 2,
  },
  sectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  gameGrid: {
    paddingHorizontal: 5,
    paddingTop: 0,
    paddingBottom: 14,
  },
  gameTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    margin: GRID_GAP / 2,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  gameTileImage: {
    width: '100%',
    height: '100%',
  },
  gameTileOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  gameTileTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 2 },
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 34,
    paddingTop: 48,
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
