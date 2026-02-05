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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
const TILE_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const GAMES_HOST = 'https://gametok-games.pages.dev';

interface Game {
  id: string;
  name: string;
  thumbnail?: string;
  embedUrl?: string;
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

// Animated Level Ring Component
const LevelRing: React.FC<{ level: number; progress: number; size?: number }> = ({ level, progress, size = 70 }) => {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const strokeWidth = 4;
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

// Streak Flame Component
const StreakFlame: React.FC<{ streak: number; multiplier: number }> = ({ streak, multiplier }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (streak > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [streak]);

  return (
    <Animated.View style={[styles.streakContainer, { transform: [{ scale: pulseAnim }] }]}>
      <Text style={styles.streakEmoji}>🔥</Text>
      <Text style={styles.streakNumber}>{streak}</Text>
      {multiplier > 1 && (
        <View style={styles.multiplierBadge}>
          <Text style={styles.multiplierText}>{multiplier}x</Text>
        </View>
      )}
    </Animated.View>
  );
};

// Daily Check-in Card
const DailyCheckIn: React.FC<{ 
  canClaim: boolean; 
  streak: number; 
  onClaim: () => void;
  loading: boolean;
}> = ({ canClaim, streak, onClaim, loading }) => {
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  
  useEffect(() => {
    if (canClaim) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [canClaim]);

  const bonus = streak >= 365 ? 500 : streak >= 100 ? 250 : streak >= 30 ? 150 : streak >= 7 ? 100 : streak >= 3 ? 75 : 50;

  return (
    <TouchableOpacity 
      onPress={canClaim ? onClaim : undefined} 
      activeOpacity={canClaim ? 0.8 : 1}
      disabled={loading}
    >
      <Animated.View style={[styles.checkInCard, canClaim && { shadowOpacity: glowAnim }]}>
        <LinearGradient
          colors={canClaim ? ['#a855f7', '#6366f1'] : ['#374151', '#1f2937']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.checkInGradient}
        >
          <View style={styles.checkInLeft}>
            <Text style={styles.checkInEmoji}>🎁</Text>
            <View>
              <Text style={styles.checkInTitle}>
                {canClaim ? 'Claim Daily Bonus!' : 'Come back tomorrow!'}
              </Text>
              <Text style={styles.checkInSubtitle}>
                {canClaim ? `+${bonus} points waiting` : `Day ${streak} streak 🔥`}
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
  
  // Gamification state (just for header stats)
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [claimingDaily, setClaimingDaily] = useState(false);
  
  // Saved games
  const [savedGamesList, setSavedGamesList] = useState<Game[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const username = isAuthenticated ? user?.username : 'guest';
  const displayName = isAuthenticated ? user?.displayName : '';
  const avatar = isAuthenticated ? user?.avatar : null;

  const canClaimDaily = () => {
    if (!stats?.streak.lastClaimDate) return true;
    const today = new Date().toISOString().split('T')[0];
    const lastClaim = new Date(stats.streak.lastClaimDate).toISOString().split('T')[0];
    return lastClaim !== today;
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      fetchSavedGames();
    }
  }, [isAuthenticated]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const statsRes = await gamification.getStats();
      setStats(statsRes);
    } catch (e) {
      console.log('Failed to fetch stats:', e);
    } finally {
      setLoadingStats(false);
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
      Alert.alert('🎉 Daily Bonus!', `+${result.pointsEarned} points\n+${result.xpEarned} XP\n\nStreak: ${result.streak.current} days!`);
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
      <View style={styles.tileOverlay}>
        <Ionicons name="game-controller" size={12} color="#fff" />
        <Text style={styles.tileCount}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: '#000', paddingTop: insets.top }]}>
        <View style={styles.notLoggedIn}>
          <Text style={styles.notLoggedInEmoji}>🎮</Text>
          <Text style={styles.notLoggedInTitle}>Sign in to track your progress</Text>
          <Text style={styles.notLoggedInSubtitle}>Earn points, complete challenges, and unlock rewards!</Text>
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
      >
        {/* Header with stats */}
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f0f23']}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          {/* Top buttons */}
          <View style={styles.topButtons}>
            <TouchableOpacity style={styles.topBtn} onPress={() => setShowAddFriends(true)}>
              <Ionicons name="person-add-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBtn} onPress={() => setShowSettings(true)}>
              <Ionicons name="menu-outline" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Profile row */}
          <View style={styles.profileRow}>
            <Avatar uri={avatar} size={60} />
            <View style={styles.profileInfo}>
              <Text style={styles.displayName}>{displayName || username}</Text>
              <Text style={styles.handle}>@{username}</Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={() => setShowEditProfile(true)}>
              <Ionicons name="pencil" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Stats row: Points, Level, Streak */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statEmoji}>💰</Text>
              <Text style={styles.statValue}>
                {loadingStats ? '...' : (stats?.points.balance || 0).toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>

            <View style={styles.statBox}>
              {loadingStats ? (
                <ActivityIndicator color="#a855f7" />
              ) : (
                <LevelRing 
                  level={stats?.level.current || 1} 
                  progress={stats?.level.progress || 0} 
                  size={60}
                />
              )}
              <Text style={styles.statLabel}>Level</Text>
            </View>

            <View style={styles.statBox}>
              <StreakFlame 
                streak={stats?.streak.current || 0} 
                multiplier={stats?.streak.multiplier || 1}
              />
              <Text style={styles.statLabel}>Streak</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Daily Check-in */}
        <View style={styles.section}>
          <DailyCheckIn 
            canClaim={canClaimDaily()} 
            streak={stats?.streak.current || 0}
            onClaim={handleClaimDaily}
            loading={claimingDaily}
          />
        </View>

        {/* Saved Games */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved Games</Text>
            <Text style={styles.sectionSubtitle}>{savedGamesList.length}</Text>
          </View>
          {loadingSaved ? (
            <ActivityIndicator color="#a855f7" style={{ marginVertical: 20 }} />
          ) : savedGamesList.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bookmark-outline" size={40} color="#666" />
              <Text style={styles.emptyText}>No saved games yet</Text>
              <Text style={styles.emptySubtext}>Tap the bookmark icon on any game to save it</Text>
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
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.settingsContent}>
              <Text style={styles.settingsSectionTitle}>PREFERENCES</Text>
              
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name={isDark ? "moon" : "sunny-outline"} size={22} color="#fff" />
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
              
              <TouchableOpacity 
                style={styles.settingsItem}
                onPress={() => Linking.openURL('mailto:gametokapp@gmail.com')}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="mail-outline" size={22} color="#fff" />
                  <Text style={styles.settingsItemText}>Contact Us</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.settingsItem}
                onPress={() => Linking.openURL('https://gametok-landing.pages.dev/privacy.html')}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="shield-checkmark-outline" size={22} color="#fff" />
                  <Text style={styles.settingsItemText}>Privacy Policy</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.settingsItem}
                onPress={() => Linking.openURL('https://gametok-landing.pages.dev/terms.html')}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="document-text-outline" size={22} color="#fff" />
                  <Text style={styles.settingsItemText}>Terms of Service</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.settingsItem, { marginTop: 24 }]} 
                onPress={() => { setShowSettings(false); logout(); }}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
                  <Text style={[styles.settingsItemText, { color: '#FF3B30' }]}>Log Out</Text>
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
  container: { flex: 1 },
  scrollView: { flex: 1 },
  
  // Header
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  topButtons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  
  // Profile row
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  profileInfo: { flex: 1, marginLeft: 12 },
  displayName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  handle: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  editBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  
  // Stats row
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center', minWidth: 80 },
  statEmoji: { fontSize: 28, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 },
  
  // Level ring
  levelNumber: { color: '#fff', fontSize: 20, fontWeight: '700' },
  
  // Streak
  streakContainer: { alignItems: 'center' },
  streakEmoji: { fontSize: 28 },
  streakNumber: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: -4 },
  multiplierBadge: { position: 'absolute', top: -4, right: -12, backgroundColor: '#f59e0b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  multiplierText: { color: '#000', fontSize: 10, fontWeight: '700' },
  
  // Sections
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sectionSubtitle: { color: '#888', fontSize: 14 },

  // Daily check-in
  checkInCard: { borderRadius: 16, overflow: 'hidden', shadowColor: '#a855f7', shadowOffset: { width: 0, height: 0 }, shadowRadius: 20 },
  checkInGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  checkInLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkInEmoji: { fontSize: 32 },
  checkInTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  checkInSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  claimBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  claimText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  
  // Saved games grid
  gridRow: { gap: GRID_GAP },
  gameTile: { width: TILE_SIZE, height: TILE_SIZE * 1.3, marginBottom: GRID_GAP },
  gameThumbnail: { width: '100%', height: '100%', backgroundColor: '#1a1a1a', borderRadius: 8 },
  tileOverlay: { position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileCount: { color: '#fff', fontSize: 11, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  
  // Empty states
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#888', fontSize: 16, marginTop: 12, fontWeight: '600' },
  emptySubtext: { color: '#666', fontSize: 13, marginTop: 4 },
  
  // Not logged in
  notLoggedIn: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  notLoggedInEmoji: { fontSize: 64, marginBottom: 16 },
  notLoggedInTitle: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  notLoggedInSubtitle: { color: '#888', fontSize: 14, textAlign: 'center' },

  // Settings Modal
  settingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  settingsDismiss: { flex: 1 },
  settingsContainer: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: '#333' },
  settingsTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  settingsContent: { paddingHorizontal: 20 },
  settingsSectionTitle: { color: '#888', fontSize: 12, fontWeight: '600', marginTop: 16, marginBottom: 8, letterSpacing: 0.5 },
  settingsItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#333' },
  settingsItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  settingsItemText: { color: '#fff', fontSize: 16 },
});
