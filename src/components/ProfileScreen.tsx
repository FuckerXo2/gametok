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
const GRID_GAP = 3;
const NUM_COLUMNS = 3;
const TILE_SIZE = (SCREEN_WIDTH - 32 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
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

// Animated Level Ring
const LevelRing: React.FC<{ level: number; progress: number; size?: number }> = ({ level, progress, size = 80 }) => {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress,
      duration: 1000,
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
          <SvgGradient id="levelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#a855f7" />
            <Stop offset="100%" stopColor="#06b6d4" />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#levelGrad)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={styles.levelNumber}>{level}</Text>
    </View>
  );
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Daily Check-in Banner
const DailyCheckIn: React.FC<{ 
  canClaim: boolean; 
  streak: number; 
  bonus: number;
  onClaim: () => void;
  loading: boolean;
}> = ({ canClaim, streak, onClaim, bonus, loading }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (canClaim) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [canClaim]);

  return (
    <TouchableOpacity 
      onPress={canClaim ? onClaim : undefined} 
      activeOpacity={canClaim ? 0.9 : 1}
      disabled={loading}
    >
      <Animated.View style={[styles.checkInCard, { transform: [{ scale: pulseAnim }] }]}>
        <LinearGradient
          colors={canClaim ? ['#a855f7', '#6366f1', '#4f46e5'] : ['#374151', '#1f2937', '#111827']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.checkInGradient}
        >
          <View style={styles.checkInLeft}>
            <View style={styles.checkInIconWrap}>
              <Ionicons name={canClaim ? "gift" : "checkmark-circle"} size={24} color="#fff" />
            </View>
            <View>
              <Text style={styles.checkInTitle}>
                {canClaim ? 'Daily Bonus Ready!' : 'Claimed Today'}
              </Text>
              <Text style={styles.checkInSubtitle}>
                {canClaim ? `+${bonus} coins waiting for you` : `Day ${streak} streak • Come back tomorrow`}
              </Text>
            </View>
          </View>
          {canClaim && (
            loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.claimBadge}>
                <Text style={styles.claimText}>CLAIM</Text>
              </View>
            )
          )}
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [savedGamesList, setSavedGamesList] = useState<Game[]>([]);

  const username = isAuthenticated ? user?.username : 'guest';
  const displayName = isAuthenticated ? user?.displayName : '';
  const avatar = isAuthenticated ? user?.avatar : null;

  const canClaimDaily = () => {
    if (!stats?.streak.lastClaimDate) return true;
    const today = new Date().toISOString().split('T')[0];
    const lastClaim = new Date(stats.streak.lastClaimDate).toISOString().split('T')[0];
    return lastClaim !== today;
  };

  const getDailyBonus = () => {
    const streak = stats?.streak.current || 0;
    if (streak >= 365) return 500;
    if (streak >= 100) return 250;
    if (streak >= 30) return 150;
    if (streak >= 7) return 100;
    if (streak >= 3) return 75;
    return 50;
  };

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
    } catch (e) {
      console.log('Failed to fetch data:', e);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  };

  const handleClaimDaily = async () => {
    setClaimingDaily(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await gamification.claimDaily();
      setStats(prev => prev ? {
        ...prev,
        points: { 
          ...prev.points, 
          balance: prev.points.balance + result.pointsEarned,
          lifetimeEarned: prev.points.lifetimeEarned + result.pointsEarned
        },
        streak: {
          ...prev.streak,
          current: result.streak.current,
          longest: result.streak.longest,
          lastClaimDate: new Date().toISOString(),
          multiplier: result.streak.multiplier
        }
      } : null);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Daily Bonus!', 
        `+${result.pointsEarned} coins\n+${result.xpEarned} XP\n\n${result.streak.current} day streak!`
      );
    } catch (e: any) {
      if (e.message?.includes('Already claimed')) {
        Alert.alert('Already Claimed', 'Come back tomorrow for your next bonus!');
      } else {
        Alert.alert('Error', 'Failed to claim daily bonus');
      }
    } finally {
      setClaimingDaily(false);
    }
  };

  const renderGameTile = ({ item }: { item: Game }) => (
    <TouchableOpacity style={styles.gameTile} activeOpacity={0.8}>
      <Image 
        source={{ uri: getThumbnailUrl(item) }} 
        style={styles.gameThumbnail}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.tileGradient}
      >
        <Text style={styles.tileName} numberOfLines={1}>{item.name}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: '#0a0a0f', paddingTop: insets.top }]}>
        <View style={styles.notLoggedIn}>
          <View style={styles.notLoggedInIconWrap}>
            <Ionicons name="person" size={40} color="#a855f7" />
          </View>
          <Text style={styles.notLoggedInTitle}>Your Profile</Text>
          <Text style={styles.notLoggedInSubtitle}>Sign in to track your progress and save your favorite games</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#0a0a0f' }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor="#a855f7"
          />
        }
      >
        {/* Profile Header */}
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f0f23']}
          style={[styles.header, { paddingTop: insets.top + 12 }]}
        >
          <View style={styles.topButtons}>
            <TouchableOpacity style={styles.topBtn} onPress={() => setShowAddFriends(true)}>
              <Ionicons name="person-add-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBtn} onPress={() => setShowSettings(true)}>
              <Ionicons name="settings-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileSection}>
            <TouchableOpacity onPress={() => setShowEditProfile(true)} activeOpacity={0.9}>
              <View style={styles.avatarWrap}>
                <Avatar uri={avatar} size={90} />
                <View style={styles.editAvatarBadge}>
                  <Ionicons name="pencil" size={12} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
            
            <Text style={styles.displayName}>{displayName || username}</Text>
            <Text style={styles.handle}>@{username}</Text>
          </View>

          <View style={styles.statsRow}>
            {/* Coins */}
            <View style={styles.statCard}>
              <View style={styles.statIconWrap}>
                <FontAwesome5 name="coins" size={20} color="#ffd60a" />
              </View>
              <Text style={styles.statValue}>
                {loadingStats ? '...' : (stats?.points.balance || 0).toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Coins</Text>
            </View>

            {/* Level */}
            <View style={styles.statCard}>
              {loadingStats ? (
                <ActivityIndicator color="#a855f7" />
              ) : (
                <LevelRing 
                  level={stats?.level.current || 1} 
                  progress={stats?.level.progress || 0} 
                  size={56}
                />
              )}
              <Text style={styles.statLabel}>Level</Text>
            </View>

            {/* Streak */}
            <View style={styles.statCard}>
              <View style={styles.streakWrap}>
                <Ionicons name="flame" size={24} color="#f97316" />
                <Text style={styles.streakNum}>{stats?.streak.current || 0}</Text>
              </View>
              <Text style={styles.statLabel}>Streak</Text>
              {(stats?.streak.multiplier || 1) > 1 && (
                <View style={styles.multiplierBadge}>
                  <Text style={styles.multiplierText}>{stats?.streak.multiplier}x</Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Daily Check-in */}
        <View style={styles.section}>
          <DailyCheckIn 
            canClaim={canClaimDaily()} 
            streak={stats?.streak.current || 0}
            bonus={getDailyBonus()}
            onClaim={handleClaimDaily}
            loading={claimingDaily}
          />
        </View>

        {/* Saved Games */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: 'rgba(168,85,247,0.2)' }]}>
                <Ionicons name="bookmark" size={16} color="#a855f7" />
              </View>
              <Text style={styles.sectionTitle}>Saved Games</Text>
            </View>
            <Text style={styles.sectionCount}>{savedGamesList.length}</Text>
          </View>
          
          {loadingStats ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#a855f7" />
            </View>
          ) : savedGamesList.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="bookmark-outline" size={32} color="#666" />
              </View>
              <Text style={styles.emptyTitle}>No saved games yet</Text>
              <Text style={styles.emptySubtext}>Tap the bookmark icon on any game to save it here</Text>
            </View>
          ) : (
            <FlatList
              data={savedGamesList}
              renderItem={renderGameTile}
              keyExtractor={item => item.id}
              numColumns={NUM_COLUMNS}
              scrollEnabled={false}
              columnWrapperStyle={styles.gridRow}
            />
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      <AddFriendsScreen visible={showAddFriends} onClose={() => setShowAddFriends(false)} />
      <EditProfileModal visible={showEditProfile} onClose={() => setShowEditProfile(false)} />

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <View style={styles.settingsOverlay}>
          <TouchableOpacity style={styles.settingsDismiss} onPress={() => setShowSettings(false)} activeOpacity={1} />
          <View style={styles.settingsContainer}>
            <View style={styles.settingsHandle} />
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)} style={styles.settingsClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.settingsContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.settingsSectionTitle}>PREFERENCES</Text>
              
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemLeft}>
                  <View style={[styles.settingsItemIconWrap, { backgroundColor: 'rgba(168,85,247,0.2)' }]}>
                    <Ionicons name={isDark ? "moon" : "sunny-outline"} size={18} color="#a855f7" />
                  </View>
                  <Text style={styles.settingsItemText}>Dark Mode</Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#767577', true: '#a855f7' }}
                  thumbColor="#fff"
                />
              </View>

              <Text style={styles.settingsSectionTitle}>SUPPORT</Text>
              
              <TouchableOpacity style={styles.settingsItem} onPress={() => Linking.openURL('mailto:gametokapp@gmail.com')}>
                <View style={styles.settingsItemLeft}>
                  <View style={[styles.settingsItemIconWrap, { backgroundColor: 'rgba(34,197,94,0.2)' }]}>
                    <Ionicons name="mail-outline" size={18} color="#22c55e" />
                  </View>
                  <Text style={styles.settingsItemText}>Contact Us</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#666" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.settingsItem} onPress={() => Linking.openURL('https://gametok-landing.pages.dev/privacy.html')}>
                <View style={styles.settingsItemLeft}>
                  <View style={[styles.settingsItemIconWrap, { backgroundColor: 'rgba(59,130,246,0.2)' }]}>
                    <Ionicons name="shield-checkmark-outline" size={18} color="#3b82f6" />
                  </View>
                  <Text style={styles.settingsItemText}>Privacy Policy</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#666" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.settingsItem} onPress={() => Linking.openURL('https://gametok-landing.pages.dev/terms.html')}>
                <View style={styles.settingsItemLeft}>
                  <View style={[styles.settingsItemIconWrap, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
                    <Ionicons name="document-text-outline" size={18} color="#f59e0b" />
                  </View>
                  <Text style={styles.settingsItemText}>Terms of Service</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#666" />
              </TouchableOpacity>

              <Text style={styles.settingsSectionTitle}>ACCOUNT</Text>

              <TouchableOpacity style={styles.settingsItem} onPress={() => { setShowSettings(false); logout(); }}>
                <View style={styles.settingsItemLeft}>
                  <View style={[styles.settingsItemIconWrap, { backgroundColor: 'rgba(239,68,68,0.2)' }]}>
                    <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                  </View>
                  <Text style={[styles.settingsItemText, { color: '#ef4444' }]}>Log Out</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsItem} 
                onPress={() => {
                  Alert.alert('Delete Account', 'Are you sure? This cannot be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: async () => {
                      try { await auth.deleteAccount(); setShowSettings(false); logout(); } 
                      catch { Alert.alert('Error', 'Failed to delete account.'); }
                    }}
                  ]);
                }}
              >
                <View style={styles.settingsItemLeft}>
                  <View style={[styles.settingsItemIconWrap, { backgroundColor: 'rgba(239,68,68,0.2)' }]}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </View>
                  <Text style={[styles.settingsItemText, { color: '#ef4444' }]}>Delete Account</Text>
                </View>
              </TouchableOpacity>

              <View style={{ height: 50 }} />
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
  header: { paddingHorizontal: 16, paddingBottom: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  topButtons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  
  // Profile section
  profileSection: { alignItems: 'center', marginBottom: 24 },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  editAvatarBadge: { 
    position: 'absolute', 
    bottom: 0, 
    right: 0, 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    backgroundColor: '#a855f7', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#1a1a2e',
  },
  displayName: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  handle: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  
  // Stats row
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', gap: 12 },
  statCard: { 
    flex: 1, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 20, 
    paddingVertical: 16, 
    alignItems: 'center',
  },
  statIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,214,10,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  levelNumber: { color: '#fff', fontSize: 18, fontWeight: '800' },
  streakWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakNum: { color: '#fff', fontSize: 20, fontWeight: '800' },
  multiplierBadge: { 
    position: 'absolute', 
    top: 8, 
    right: 8, 
    backgroundColor: '#f59e0b', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 8 
  },
  multiplierText: { color: '#000', fontSize: 9, fontWeight: '800' },
  
  // Sections
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIconWrap: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sectionCount: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },

  // Daily check-in
  checkInCard: { borderRadius: 20, overflow: 'hidden' },
  checkInGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  checkInLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  checkInIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  checkInTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  checkInSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  claimBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14 },
  claimText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  
  // Saved games grid
  gridRow: { gap: GRID_GAP },
  gameTile: { width: TILE_SIZE, height: TILE_SIZE * 1.3, marginBottom: GRID_GAP, borderRadius: 12, overflow: 'hidden' },
  gameThumbnail: { width: '100%', height: '100%', backgroundColor: '#1a1a1a' },
  tileGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, paddingTop: 24 },
  tileName: { color: '#fff', fontSize: 11, fontWeight: '600' },
  
  // Empty & loading states
  loadingBox: { height: 150, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 40, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptySubtext: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
  
  // Not logged in
  notLoggedIn: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  notLoggedInIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(168,85,247,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  notLoggedInTitle: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  notLoggedInSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 15, textAlign: 'center', lineHeight: 22 },

  // Settings Modal
  settingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  settingsDismiss: { flex: 1 },
  settingsContainer: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  settingsHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  settingsTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  settingsClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  settingsContent: { paddingHorizontal: 20 },
  settingsSectionTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', marginTop: 20, marginBottom: 12, letterSpacing: 1 },
  settingsItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  settingsItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  settingsItemIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  settingsItemText: { color: '#fff', fontSize: 15, fontWeight: '500' },
});
