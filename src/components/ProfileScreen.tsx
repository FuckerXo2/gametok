import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
  Linking,
  Image,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Animated,
  Easing,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { auth, savedGames as savedGamesApi, gamification } from '../services/api';
import { AddFriendsScreen } from './AddFriendsScreen';
import { EditProfileModal } from './EditProfileModal';
import { Avatar } from './Avatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const TILE_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
const GAMES_HOST = 'https://gametok-games.pages.dev';

interface Game {
  id: string;
  name: string;
  thumbnail?: string;
}

interface GamificationStats {
  points: { balance: number; lifetimeEarned: number };
  streak: { current: number; longest: number; lastClaimDate: string | null; multiplier: number };
  level: { current: number; xp: number; currentXp: number; xpForNextLevel: number; progress: number };
}

const getThumbnailUrl = (game: Game) => {
  if (game.thumbnail) return game.thumbnail;
  return `${GAMES_HOST}/thumbnails/${game.id}.png`;
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// Level Ring
const LevelRing: React.FC<{ level: number; progress: number; size?: number }> = ({ level, progress, size = 36 }) => {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <SvgGradient id="lvlGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#a855f7" />
            <Stop offset="100%" stopColor="#06b6d4" />
          </SvgGradient>
        </Defs>
        <Circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth} fill="transparent" />
        <AnimatedCircle cx={size/2} cy={size/2} r={radius} stroke="url(#lvlGrad)" strokeWidth={strokeWidth} fill="transparent" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} rotation="-90" origin={`${size/2}, ${size/2}`} />
      </Svg>
      <Text style={styles.levelNum}>{level}</Text>
    </View>
  );
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [savedGamesList, setSavedGamesList] = useState<Game[]>([]);
  
  // Social stats from user object
  const [socialStats, setSocialStats] = useState({
    followers: user?.followers?.length || 0,
    following: user?.following?.length || 0,
    gamesPlayed: user?.gamesPlayed || 0,
  });

  const username = isAuthenticated ? user?.username : 'guest';
  const displayName = isAuthenticated ? user?.displayName : '';
  const avatar = isAuthenticated ? user?.avatar : null;
  const bio = isAuthenticated ? user?.bio : '';

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingStats(true);
    
    try {
      const [statsRes, savedRes] = await Promise.all([
        gamification.getStats(),
        user?.id ? savedGamesApi.userSaved(user.id) : Promise.resolve({ games: [] }),
      ]);
      setStats(statsRes);
      setSavedGamesList(savedRes.games || []);
      
      // Update social stats from user object
      setSocialStats({
        followers: user?.followers?.length || 0,
        following: user?.following?.length || 0,
        gamesPlayed: user?.gamesPlayed || 0,
      });
    } catch (e) {
      console.log('Failed to fetch data:', e);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  };

  const renderGameTile = ({ item }: { item: Game }) => (
    <TouchableOpacity style={styles.gameTile} activeOpacity={0.9}>
      <Image 
        source={{ uri: getThumbnailUrl(item) }} 
        style={styles.gameThumbnail}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: '#000', paddingTop: insets.top }]}>
        <View style={styles.notLoggedIn}>
          <View style={styles.notLoggedInIconWrap}>
            <Ionicons name="person" size={40} color="#a855f7" />
          </View>
          <Text style={styles.notLoggedInTitle}>Your Profile</Text>
          <Text style={styles.notLoggedInSubtitle}>Sign in to connect with friends and track your gaming journey</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor="#a855f7" />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowAddFriends(true)}>
              <Ionicons name="person-add-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerUsername}>@{username}</Text>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSettings(true)}>
              <Ionicons name="menu-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Profile Info */}
          <View style={styles.profileInfo}>
            <TouchableOpacity onPress={() => setShowEditProfile(true)} activeOpacity={0.9}>
              <View style={styles.avatarContainer}>
                <Avatar uri={avatar} size={86} />
                {/* Level badge */}
                <View style={styles.levelBadge}>
                  <LevelRing level={stats?.level.current || 1} progress={stats?.level.progress || 0} size={32} />
                </View>
              </View>
            </TouchableOpacity>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem} onPress={() => setShowFollowers(true)}>
                <Text style={styles.statNumber}>{formatNumber(socialStats.followers)}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.statItem} onPress={() => setShowFollowing(true)}>
                <Text style={styles.statNumber}>{formatNumber(socialStats.following)}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </TouchableOpacity>
              
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{formatNumber(savedGamesList.length)}</Text>
                <Text style={styles.statLabel}>Saved</Text>
              </View>
            </View>
          </View>

          {/* Name & Bio */}
          <View style={styles.nameSection}>
            <Text style={styles.displayName}>{displayName || username}</Text>
            {bio ? <Text style={styles.bio}>{bio}</Text> : null}
            
            {/* Coins & Streak inline */}
            <View style={styles.badgesRow}>
              <View style={styles.coinBadge}>
                <FontAwesome5 name="coins" size={12} color="#ffd60a" />
                <Text style={styles.coinText}>{formatNumber(stats?.points.balance || 0)}</Text>
              </View>
              {(stats?.streak.current || 0) > 0 && (
                <View style={styles.streakBadge}>
                  <Ionicons name="flame" size={14} color="#f97316" />
                  <Text style={styles.streakText}>{stats?.streak.current} day streak</Text>
                </View>
              )}
            </View>
          </View>

          {/* Edit Profile Button */}
          <TouchableOpacity style={styles.editProfileBtn} onPress={() => setShowEditProfile(true)}>
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Saved Games Section */}
        <View style={styles.savedSection}>
          <View style={styles.savedHeader}>
            <Ionicons name="bookmark" size={18} color="#fff" />
            <Text style={styles.savedTitle}>Saved Games</Text>
          </View>
          
          {savedGamesList.length === 0 ? (
            <View style={styles.emptyTab}>
              <Ionicons name="bookmark-outline" size={48} color="#333" />
              <Text style={styles.emptyTabText}>No saved games yet</Text>
            </View>
          ) : (
            <FlatList
              data={savedGamesList}
              renderItem={renderGameTile}
              keyExtractor={item => item.id}
              numColumns={NUM_COLUMNS}
              scrollEnabled={false}
              contentContainerStyle={styles.gamesGrid}
            />
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      <AddFriendsScreen visible={showAddFriends} onClose={() => setShowAddFriends(false)} />
      <EditProfileModal visible={showEditProfile} onClose={() => setShowEditProfile(false)} />

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismiss} onPress={() => setShowSettings(false)} activeOpacity={1} />
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.modalItem} onPress={() => { setShowSettings(false); setShowEditProfile(true); }}>
                <Ionicons name="person-outline" size={22} color="#fff" />
                <Text style={styles.modalItemText}>Edit Profile</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalItem} onPress={() => { setShowSettings(false); setShowAddFriends(true); }}>
                <Ionicons name="person-add-outline" size={22} color="#fff" />
                <Text style={styles.modalItemText}>Find Friends</Text>
              </TouchableOpacity>

              <View style={styles.modalDivider} />
              
              <View style={styles.modalItem}>
                <Ionicons name={isDark ? "moon" : "sunny-outline"} size={22} color="#fff" />
                <Text style={styles.modalItemText}>Dark Mode</Text>
                <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#444', true: '#a855f7' }} thumbColor="#fff" style={{ marginLeft: 'auto' }} />
              </View>

              <View style={styles.modalDivider} />
              
              <TouchableOpacity style={styles.modalItem} onPress={() => Linking.openURL('mailto:gametokapp@gmail.com')}>
                <Ionicons name="mail-outline" size={22} color="#fff" />
                <Text style={styles.modalItemText}>Contact Us</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalItem} onPress={() => Linking.openURL('https://gametok-landing.pages.dev/privacy.html')}>
                <Ionicons name="shield-outline" size={22} color="#fff" />
                <Text style={styles.modalItemText}>Privacy Policy</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalItem} onPress={() => Linking.openURL('https://gametok-landing.pages.dev/terms.html')}>
                <Ionicons name="document-text-outline" size={22} color="#fff" />
                <Text style={styles.modalItemText}>Terms of Service</Text>
              </TouchableOpacity>

              <View style={styles.modalDivider} />

              <TouchableOpacity style={styles.modalItem} onPress={() => { setShowSettings(false); logout(); }}>
                <Ionicons name="log-out-outline" size={22} color="#ef4444" />
                <Text style={[styles.modalItemText, { color: '#ef4444' }]}>Log Out</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalItem} onPress={() => {
                Alert.alert('Delete Account', 'Are you sure? This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: async () => {
                    try { await auth.deleteAccount(); setShowSettings(false); logout(); } 
                    catch { Alert.alert('Error', 'Failed to delete account.'); }
                  }}
                ]);
              }}>
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
                <Text style={[styles.modalItemText, { color: '#ef4444' }]}>Delete Account</Text>
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
  container: { flex: 1 },
  scrollView: { flex: 1 },
  
  // Header
  header: { paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerUsername: { color: '#fff', fontSize: 16, fontWeight: '700' },
  
  // Profile Info
  profileInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatarContainer: { position: 'relative' },
  levelBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#000', borderRadius: 20, padding: 2 },
  levelNum: { color: '#fff', fontSize: 11, fontWeight: '800' },
  
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: 20 },
  statItem: { alignItems: 'center' },
  statNumber: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#888', fontSize: 12, marginTop: 2 },
  
  // Name & Bio
  nameSection: { marginBottom: 16 },
  displayName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bio: { color: '#aaa', fontSize: 14, marginTop: 4, lineHeight: 20 },
  
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  coinBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,214,10,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  coinText: { color: '#ffd60a', fontSize: 13, fontWeight: '700' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(249,115,22,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  streakText: { color: '#f97316', fontSize: 13, fontWeight: '600' },
  
  // Edit Profile Button
  editProfileBtn: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#333' },
  editProfileText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  
  // Saved Games Section
  savedSection: { marginTop: 16 },
  savedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  savedTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  
  // Games Grid
  gamesGrid: { paddingHorizontal: 1 },
  gameTile: { width: TILE_SIZE, height: TILE_SIZE, margin: GRID_GAP / 2 },
  gameThumbnail: { width: '100%', height: '100%', backgroundColor: '#111' },
  
  // Empty states
  emptyTab: { alignItems: 'center', paddingVertical: 60 },
  emptyTabText: { color: '#444', fontSize: 14, marginTop: 12 },
  
  notLoggedIn: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  notLoggedInIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(168,85,247,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  notLoggedInTitle: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  notLoggedInSubtitle: { color: '#666', fontSize: 15, textAlign: 'center', lineHeight: 22 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  modalContainer: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 20, maxHeight: '70%' },
  modalHandle: { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginVertical: 12 },
  modalItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  modalItemText: { color: '#fff', fontSize: 16 },
  modalDivider: { height: 1, backgroundColor: '#222', marginVertical: 4 },
});
