import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  Switch,
  Alert,
  Linking,
  Image,
  Dimensions,
  RefreshControl,
  StyleSheet,
  Share,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAuthScreen } from '../../App';
import { auth, likes as likesApi, users as usersApi } from '../services/api';
import { resolveGameThumbnail } from '../utils/thumbnails';
import { AddFriendsScreen } from './AddFriendsScreen';
import { GamePlayerModal } from './GamePlayerModal';
import type { Orientation } from '../constants/orientation';
import { EditProfileModal } from './EditProfileModal';
import { Avatar } from './Avatar';
import { FollowListModal } from './FollowListModal';
import { UserProfileModal } from './UserProfileModal';

// V2 design tokens — kept inline so this screen is self-contained.
const PURPLE = '#a855f7';
const PURPLE_DEEP = '#7c3aed';
const CYAN = '#22d3ee';
const GOLD = '#f59e0b';
const TEXT = '#ffffff';
const TEXT_MUTED = '#9a9aa8';
const TEXT_DIM = '#6b6b78';
const BG = '#000000';
const SURFACE = '#0e0e14';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 12;
const GRID_GAP = 4;
const TILE_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * 2) / 3;
const TILE_HEIGHT = TILE_WIDTH * 1.34;

interface Game {
  id: string;
  name: string;
  thumbnail?: string;
  plays?: number;
  embedUrl?: string;
  /** 'portrait' (default) or 'landscape' — GameSurface rotates the latter. */
  orientation?: Orientation | null;
}

const getThumbnailUrl = (game: Game) => {
  return resolveGameThumbnail(game.thumbnail, game.id, game);
};

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

type ProfileContentTab = 'created' | 'played' | 'liked';

export const ProfileScreen: React.FC<{ isActive?: boolean }> = ({ isActive }) => {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { showAuthScreen, showLoginScreen } = useAuthScreen();

  const [showAddFriends, setShowAddFriends] = useState(false);
  const [playingGame, setPlayingGame] = useState<Game | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [createdGamesList, setCreatedGamesList] = useState<Game[]>([]);
  const [playedGamesList, setPlayedGamesList] = useState<Game[]>([]);
  const [likedGamesList, setLikedGamesList] = useState<Game[]>([]);
  const [profileTab, setProfileTab] = useState<ProfileContentTab>('created');
  const [socialStats, setSocialStats] = useState({ followers: 0, following: 0, likes: 0 });
  const [followModalConfig, setFollowModalConfig] = useState<{ visible: boolean; tab: 'followers' | 'following' }>({
    visible: false,
    tab: 'followers',
  });
  const [selectedProfileUser, setSelectedProfileUser] = useState<any>(null);
  // User tapped in the follow list, held until that modal has fully closed so
  // we never present two native modals at once (iOS drops the second one).
  const pendingProfileUserRef = useRef<any>(null);
  const lastFetchRef = useRef<number>(0);

  const username = user?.username || 'guest';
  const displayName = user?.displayName || username;
  const avatar = user?.avatar || null;
  const bio = user?.bio || '';
  const isVerified = Boolean(user?.verified);

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isActive && isAuthenticated && !refreshing) {
      const now = Date.now();
      if (now - lastFetchRef.current > 5000) {
        setTimeout(() => fetchData(true), 500);
      }
    }
  }, [isActive]);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [createdRes, playedRes, likedRes, userRes] = await Promise.allSettled([
        user?.id ? usersApi.created(user.id) : Promise.resolve({ games: [] }),
        user?.id ? usersApi.played(user.id) : Promise.resolve({ games: [] }),
        user?.id ? likesApi.userLikes(user.id) : Promise.resolve({ games: [] }),
        user?.id ? usersApi.get(user.id) : Promise.resolve({ stats: { followers: 0, following: 0, likes: 0 } }),
      ]);

      if (createdRes.status === 'fulfilled') setCreatedGamesList(createdRes.value?.games || []);
      if (playedRes.status === 'fulfilled') setPlayedGamesList(playedRes.value?.games || []);
      if (likedRes.status === 'fulfilled') setLikedGamesList(likedRes.value?.games || []);
      if (userRes.status === 'fulfilled' && userRes.value?.stats) {
        setSocialStats({
          followers: userRes.value.stats.followers || 0,
          following: userRes.value.stats.following || 0,
          likes: userRes.value.stats.likes || userRes.value.stats.totalLikes || 0,
        });
      }
      lastFetchRef.current = Date.now();
    } catch (e) {
      console.log('[Profile] fetch failed:', e);
    } finally {
      setRefreshing(false);
    }
  };

  // Play in place, the way explore does. This used to call openSharedGame + setActiveTab('home'),
  // which threw the user out of their profile and into the feed just to play one game.
  const openProfileGame = (game: Game) => {
    setPlayingGame(game);
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

  const activeList = useMemo(() => {
    if (profileTab === 'created') return createdGamesList;
    if (profileTab === 'played') return playedGamesList;
    return likedGamesList;
  }, [profileTab, createdGamesList, playedGamesList, likedGamesList]);

  if (!isAuthenticated) {
    return <UnauthenticatedPreview onSignUp={showAuthScreen} onLogIn={showLoginScreen} insets={insets} />;
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={TEXT} />
        }
      >
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.topIconBtn} onPress={() => setShowAddFriends(true)} hitSlop={6}>
            <Ionicons name="person-add-outline" size={19} color={TEXT} />
          </Pressable>
          <View style={styles.topUsernameWrap}>
            <Text style={styles.topUsername}>@{username}</Text>
            {isVerified ? <VerifiedDot size={16} /> : null}
          </View>
          <Pressable style={styles.topIconBtn} onPress={() => setShowSettings(true)} hitSlop={6}>
            <Ionicons name="menu-outline" size={22} color={TEXT} />
          </Pressable>
        </View>

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatarBorder}>
            <Avatar uri={avatar} userId={user?.id} size={140} />
          </View>
        </View>

        {/* Display name */}
        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.handle}>@{username}</Text>

        {/* Bio */}
        {bio ? <Text style={styles.bio}>{bio}</Text> : null}

        {/* Badge row */}
        <View style={styles.badgeRow}>
          <BadgePill icon="sparkles" label="Creator" tint={PURPLE} />
          <BadgePill icon="game-controller" label="Game Builder" tint={CYAN} />
          <BadgePill icon="ribbon" label="Early Access" tint={GOLD} />
        </View>

        {/* Stat row (4 columns, no card) */}
        <View style={styles.statsRow}>
          <StatCol
            value={socialStats.following}
            label="Following"
            onPress={() => setFollowModalConfig({ visible: true, tab: 'following' })}
          />
          <StatCol
            value={socialStats.followers}
            label="Followers"
            onPress={() => setFollowModalConfig({ visible: true, tab: 'followers' })}
          />
          <StatCol value={createdGamesList.length} label="Created" />
          <StatCol value={socialStats.likes} label="Likes" />
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable style={styles.editBtn} onPress={() => setShowEditProfile(true)}>
            <Text style={styles.editBtnText}>Edit profile</Text>
          </Pressable>
          <Pressable style={styles.shareBtn} onPress={handleShareProfile}>
            <Ionicons name="arrow-up-outline" size={15} color={PURPLE} style={{ marginRight: 6 }} />
            <Text style={styles.shareBtnText}>Share profile</Text>
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <ProfileTab
            label="CREATED"
            icon="grid-outline"
            isActive={profileTab === 'created'}
            onPress={() => setProfileTab('created')}
          />
          <ProfileTab
            label="PLAYED"
            icon="play-circle-outline"
            isActive={profileTab === 'played'}
            onPress={() => setProfileTab('played')}
          />
          <ProfileTab
            label="LIKED"
            icon="heart-outline"
            isActive={profileTab === 'liked'}
            onPress={() => setProfileTab('liked')}
          />
        </View>
        <View style={styles.tabUnderlineTrack} />

        {/* Grid */}
        {activeList.length === 0 ? (
          <EmptyState tab={profileTab} />
        ) : (
          <View style={styles.grid}>
            {activeList.map((g) => (
              <GameTile key={g.id} game={g} onPress={() => openProfileGame(g)} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Fullscreen player — the exact component explore uses. */}
      <GamePlayerModal game={playingGame} onClose={() => setPlayingGame(null)} />

      {/* Modals */}
      <AddFriendsScreen visible={showAddFriends} onClose={() => setShowAddFriends(false)} />
      <EditProfileModal visible={showEditProfile} onClose={() => setShowEditProfile(false)} />

      <FollowListModal
        visible={followModalConfig.visible}
        onClose={() => setFollowModalConfig({ ...followModalConfig, visible: false })}
        userId={user?.id || ''}
        username={username}
        initialTab={followModalConfig.tab}
        onUserPress={(profileUser) => {
          pendingProfileUserRef.current = { ...profileUser, isFriend: false };
          setFollowModalConfig({ ...followModalConfig, visible: false });
        }}
        onClosed={() => {
          if (pendingProfileUserRef.current) {
            setSelectedProfileUser(pendingProfileUserRef.current);
            pendingProfileUserRef.current = null;
          }
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

      {/* Settings sheet */}
      <Modal
        visible={showSettings}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowSettings(false)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetGrabber} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <SheetItem
                icon="person-outline"
                label="Edit Profile"
                onPress={() => {
                  setShowSettings(false);
                  setShowEditProfile(true);
                }}
              />
              <SheetItem
                icon="person-add-outline"
                label="Find Friends"
                onPress={() => {
                  setShowSettings(false);
                  setShowAddFriends(true);
                }}
              />
              <View style={styles.sheetDivider} />
              <View style={styles.sheetSwitchRow}>
                <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={20} color={TEXT} />
                <Text style={styles.sheetItemLabel}>Dark Mode</Text>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#ccc', true: PURPLE_DEEP }}
                  thumbColor="#fff"
                  style={{ marginLeft: 'auto' }}
                />
              </View>
              <View style={styles.sheetDivider} />
              <SheetItem
                icon="mail-outline"
                label="Contact Us"
                onPress={() => Linking.openURL('mailto:info@gametok.com')}
              />
              <SheetItem
                icon="shield-outline"
                label="Privacy Policy"
                onPress={() => Linking.openURL('https://gametok.co/privacy.html')}
              />
              <SheetItem
                icon="document-text-outline"
                label="Terms of Service"
                onPress={() => Linking.openURL('https://gametok.co/terms.html')}
              />
              <View style={styles.sheetDivider} />
              <SheetItem
                icon="log-out-outline"
                label="Log Out"
                tone="danger"
                onPress={() => {
                  setShowSettings(false);
                  logout();
                }}
              />
              <SheetItem
                icon="trash-outline"
                label="Delete Account"
                tone="danger"
                onPress={() => {
                  Alert.alert('Delete Account', 'Are you sure? This cannot be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await auth.deleteAccount();
                          setShowSettings(false);
                          logout();
                        } catch {
                          Alert.alert('Error', 'Failed to delete account.');
                        }
                      },
                    },
                  ]);
                }}
              />
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// --- Sub-components ---------------------------------------------------------

const VerifiedDot: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <View style={{ justifyContent: 'center', alignItems: 'center' }}>
    <MaterialIcons name="verified" size={size} color={PURPLE} />
  </View>
);

const BadgePill: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; tint: string }> = ({
  icon,
  label,
  tint,
}) => (
  <View style={[badgeStyles.pill, { borderColor: `${tint}55` }]}>
    <Ionicons name={icon} size={13} color={tint} />
    <Text style={[badgeStyles.label, { color: TEXT }]}>{label}</Text>
  </View>
);

const badgeStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});

const StatCol: React.FC<{ value: number; label: string; onPress?: () => void }> = ({ value, label, onPress }) => {
  const Wrapper: any = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={statColStyles.col}>
      <Text style={statColStyles.value}>{formatCount(value)}</Text>
      <Text style={statColStyles.label}>{label}</Text>
    </Wrapper>
  );
};

const statColStyles = StyleSheet.create({
  col: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0, // Prevent flex overflow
  },
  value: {
    color: TEXT,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
    minHeight: 28, // Fixed height to prevent layout shift
  },
  label: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.1,
    minHeight: 16, // Fixed height to prevent layout shift
  },
});

const ProfileTab: React.FC<{
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  onPress: () => void;
}> = ({ label, icon, isActive, onPress }) => (
  <Pressable 
    style={[tabStyles.tab, isActive && tabStyles.tabActive]} 
    onPress={onPress}
  >
    <Ionicons name={icon} size={16} color={isActive ? TEXT : TEXT_DIM} />
    <Text style={[tabStyles.label, { color: isActive ? TEXT : TEXT_DIM }]}>{label}</Text>
  </Pressable>
);

const tabStyles = StyleSheet.create({
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#333333',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.0,
  },
});

const GameTile: React.FC<{ game: Game; onPress: () => void }> = ({ game, onPress }) => (
  <Pressable style={[tileStyles.tile, { width: TILE_WIDTH, height: TILE_HEIGHT }]} onPress={onPress}>
    <Image source={{ uri: getThumbnailUrl(game) }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
    <LinearGradient
      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
      locations={[0, 0.5, 1]}
      style={StyleSheet.absoluteFillObject}
    />
    <View style={tileStyles.body}>
      <Text style={tileStyles.title} numberOfLines={1}>
        {game.name}
      </Text>
      {typeof game.plays === 'number' ? (
        <View style={tileStyles.playsRow}>
          <Ionicons name="play" size={9} color="rgba(255,255,255,0.85)" />
          <Text style={tileStyles.playsText}>{formatCount(game.plays || 0)}</Text>
        </View>
      ) : null}
    </View>
  </Pressable>
);

const tileStyles = StyleSheet.create({
  tile: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a1a22',
  },
  body: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
  },
  title: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 4,
  },
  playsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  playsText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 10,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 4,
  },
});

const EmptyState: React.FC<{ tab: ProfileContentTab }> = ({ tab }) => {
  const config = {
    created: {
      title: 'No published games yet',
      subtitle: 'Tap the create tab to dream a new game into existence.',
      icon: 'sparkles-outline' as const,
    },
    played: {
      title: 'No played games yet',
      subtitle: 'Games you spend time in show up here automatically.',
      icon: 'play-circle-outline' as const,
    },
    liked: {
      title: 'No liked games yet',
      subtitle: 'Tap the heart on any game to save it here.',
      icon: 'heart-outline' as const,
    },
  };
  const c = config[tab];
  return (
    <View style={emptyStyles.root}>
      <View style={emptyStyles.iconBubble}>
        <Ionicons name={c.icon} size={28} color={TEXT_DIM} />
      </View>
      <Text style={emptyStyles.title}>{c.title}</Text>
      <Text style={emptyStyles.subtitle}>{c.subtitle}</Text>
    </View>
  );
};

const emptyStyles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 56,
    paddingBottom: 56,
  },
  iconBubble: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
});

const SheetItem: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}> = ({ icon, label, onPress, tone = 'default' }) => {
  const isDanger = tone === 'danger';
  return (
    <Pressable style={styles.sheetItem} onPress={onPress}>
      <Ionicons name={icon} size={20} color={isDanger ? '#ef4444' : TEXT} />
      <Text style={[styles.sheetItemLabel, { color: isDanger ? '#ef4444' : TEXT }]}>{label}</Text>
    </Pressable>
  );
};

const UnauthenticatedPreview: React.FC<{
  onSignUp: () => void;
  onLogIn: () => void;
  insets: { top: number };
}> = ({ onSignUp, onLogIn, insets }) => (
  <View style={styles.root}>
    <ScrollView contentContainerStyle={{ paddingBottom: 100 }} scrollEnabled={false}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topIconBtn} />
        <Text style={styles.topUsername}>@username</Text>
        <View style={styles.topIconBtn} />
      </View>
      <View style={styles.avatarWrap}>
        <View style={styles.avatarBorder}>
          <View
            style={{
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: SURFACE,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="person" size={64} color={TEXT_DIM} />
          </View>
        </View>
      </View>
      <Text style={styles.displayName}>Your profile</Text>
      <Text style={styles.handle}>@username</Text>
      <Text style={styles.bio}>Sign up to start dreaming and playing games.</Text>
    </ScrollView>
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.authOverlay}>
        <Text style={styles.authTitle}>Sign up to continue</Text>
        <Pressable style={styles.authPrimary} onPress={onSignUp}>
          <Text style={styles.authPrimaryText}>Sign Up</Text>
        </Pressable>
        <Pressable onPress={onLogIn}>
          <Text style={styles.authSecondary}>or log in</Text>
        </Pressable>
      </View>
    </View>
  </View>
);

// --- Styles -----------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  playerRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  playerCloseBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  topIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topUsernameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topUsername: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  avatarWrap: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  avatarBorder: {
    width: 144,
    height: 144,
    borderRadius: 72,
    padding: 3,
    borderWidth: 2,
    borderColor: 'rgba(168,85,247,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PURPLE,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  displayName: {
    color: TEXT,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  handle: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  bio: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 32,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    minHeight: 36, // Fixed height to prevent layout shift
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginTop: 10,
    minHeight: 70, // Fixed height to prevent layout shift
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  editBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  shareBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  shareBtnText: {
    color: PURPLE,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  tabUnderlineTrack: {
    display: 'none',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: GRID_PADDING,
    paddingTop: 6,
    gap: GRID_GAP,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingBottom: 18,
    maxHeight: '70%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sheetGrabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignSelf: 'center',
    marginVertical: 12,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  sheetItemLabel: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '600',
  },
  sheetSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },
  authOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authTitle: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 18,
  },
  authPrimary: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    backgroundColor: PURPLE,
    borderRadius: 999,
  },
  authPrimaryText: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '700',
  },
  authSecondary: {
    color: TEXT_MUTED,
    fontSize: 13,
    marginTop: 16,
  },
});
