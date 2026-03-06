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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAuthScreen } from '../../App';
import { auth, savedGames as savedGamesApi, gamification } from '../services/api';
import { AddFriendsScreen } from './AddFriendsScreen';
import { EditProfileModal } from './EditProfileModal';
import { RewardsScreen } from './RewardsScreen';
import { Avatar } from './Avatar';
import { LoopsColors, SemanticColors } from '../constants/LoopsColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const TILE_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
const GAMES_HOST = 'https://gametok-games.pages.dev';

interface Game { id: string; name: string; thumbnail?: string; }
interface GamificationStats {
  points: { balance: number; lifetimeEarned: number; usdValue?: number };
  streak: { current: number; longest: number; lastClaimDate: string | null; multiplier: number };
  level?: { current: number; xp: number; currentXp: number; xpForNextLevel: number; progress: number };
}

const getThumbnailUrl = (game: Game) => game.thumbnail || `${GAMES_HOST}/thumbnails/${game.id}.png`;
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};


export const ProfileScreen: React.FC<{ isActive?: boolean }> = ({ isActive }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const { showAuthScreen, showLoginScreen } = useAuthScreen();
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savedGamesList, setSavedGamesList] = useState<Game[]>([]);
  const lastFetchRef = useRef<number>(0);

  const socialStats = {
    followers: user?.followers?.length || 0,
    following: user?.following?.length || 0,
  };

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
      const [statsRes, savedRes] = await Promise.all([
        gamification.getStats(),
        user?.id ? savedGamesApi.userSaved(user.id) : Promise.resolve({ games: [] }),
      ]);
      setStats(statsRes);
      setSavedGamesList(savedRes.games || []);
      lastFetchRef.current = Date.now();
    } catch (e) {
      console.log('Failed to fetch data:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const renderGameTile = ({ item }: { item: Game }) => (
    <TouchableOpacity style={{ width: TILE_SIZE, height: TILE_SIZE, margin: GRID_GAP / 2 }} activeOpacity={0.9}>
      <Image source={{ uri: getThumbnailUrl(item) }} style={{ width: '100%', height: '100%', backgroundColor: colors.surface }} resizeMode="cover" />
    </TouchableOpacity>
  );

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
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <TouchableOpacity style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowAddFriends(true)}>
              <Ionicons name="person-add-outline" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>@{username}</Text>
            <TouchableOpacity style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowSettings(true)}>
              <Ionicons name="menu-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Profile Info Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity onPress={() => setShowEditProfile(true)} activeOpacity={0.9}>
              <Avatar uri={avatar} size={86} />
            </TouchableOpacity>

            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: 20 }}>
              <TouchableOpacity style={{ alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{formatNumber(socialStats.followers)}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Followers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{formatNumber(socialStats.following)}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Following</Text>
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{formatNumber(savedGamesList.length)}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Saved</Text>
              </View>
            </View>
          </View>

          {/* Name & Bio */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{displayName || username}</Text>
            {bio ? <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4, lineHeight: 20 }}>{bio}</Text> : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: LoopsColors.coinGold + '26', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
                <Image source={require('../../assets/ui/coins/coins_small.png')} style={{ width: 16, height: 16 }} />
                <Text style={{ color: LoopsColors.coinGold, fontSize: 13, fontWeight: '700' }}>{formatNumber(stats?.points.balance || 0)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: LoopsColors.color6 + '26', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
                <Ionicons name="trophy" size={12} color={LoopsColors.color6} />
                <Text style={{ color: LoopsColors.color6, fontSize: 13, fontWeight: '700' }}>Level {stats?.level?.current || 1}</Text>
              </View>
              {(stats?.streak.current || 0) > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: LoopsColors.color2 + '26', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
                  <Ionicons name="flame" size={14} color={LoopsColors.color2} />
                  <Text style={{ color: LoopsColors.color2, fontSize: 13, fontWeight: '600' }}>{stats?.streak.current} day streak</Text>
                </View>
              )}
            </View>
          </View>

          {/* Edit Profile Button */}
          <TouchableOpacity
            style={{ backgroundColor: colors.surface, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: colors.border }}
            onPress={() => setShowEditProfile(true)}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Edit Profile</Text>
          </TouchableOpacity>

          {/* Rewards Vault Entry Button */}
          <TouchableOpacity
            style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}
            onPress={() => setShowRewards(true)}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#1a1a2e', '#16213e', '#0f3460']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: LoopsColors.coinGold + '26', justifyContent: 'center', alignItems: 'center' }}>
                  <FontAwesome5 name="gift" size={20} color={LoopsColors.coinGold} />
                </View>
                <View>
                  <Text style={{ color: LoopsColors.white, fontSize: 15, fontWeight: '800' }}>Rewards Vault</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Text style={{ color: LoopsColors.coinGold, fontSize: 13, fontWeight: '700' }}>
                      {(stats?.points.balance || 0).toLocaleString()} Coins
                    </Text>
                    <Text style={{ color: LoopsColors.white50, fontSize: 12, fontWeight: '600' }}>
                      ≈ ${((stats?.points.usdValue !== undefined && stats.points.usdValue > 0) ? stats.points.usdValue : (stats?.points.balance || 0) / 5667).toFixed(2)} USD
                    </Text>
                  </View>
                </View>
              </View>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: LoopsColors.white10, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="chevron-forward" size={16} color={LoopsColors.white} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Saved Games */}
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
            <Ionicons name="bookmark" size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>Saved Games</Text>
          </View>

          {savedGamesList.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Ionicons name="bookmark-outline" size={48} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 12 }}>No saved games yet</Text>
            </View>
          ) : (
            <FlatList
              data={savedGamesList}
              renderItem={renderGameTile}
              keyExtractor={item => item.id}
              numColumns={NUM_COLUMNS}
              scrollEnabled={false}
              contentContainerStyle={{ paddingHorizontal: 1 }}
            />
          )}
        </View>
      </ScrollView>

      <AddFriendsScreen visible={showAddFriends} onClose={() => setShowAddFriends(false)} />
      <EditProfileModal visible={showEditProfile} onClose={() => setShowEditProfile(false)} />

      {/* Rewards Full Screen Modal */}
      <Modal visible={showRewards} animationType="slide" onRequestClose={() => setShowRewards(false)}>
        <RewardsScreen isActive={showRewards} onClose={() => setShowRewards(false)} />
      </Modal>

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

              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 }} onPress={() => Linking.openURL('https://gametok-landing.pages.dev/privacy.html')}>
                <Ionicons name="shield-outline" size={22} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: 16 }}>Privacy Policy</Text>
              </TouchableOpacity>

              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 }} onPress={() => Linking.openURL('https://gametok-landing.pages.dev/terms.html')}>
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
