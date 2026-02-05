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
  Animated,
  Easing,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
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

interface Game { id: string; name: string; thumbnail?: string; }
interface GamificationStats {
  points: { balance: number; lifetimeEarned: number };
  streak: { current: number; longest: number; lastClaimDate: string | null; multiplier: number };
  level: { current: number; xp: number; currentXp: number; xpForNextLevel: number; progress: number };
}

const getThumbnailUrl = (game: Game) => game.thumbnail || `${GAMES_HOST}/thumbnails/${game.id}.png`;
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const LevelRing: React.FC<{ level: number; progress: number; size?: number; textColor: string }> = ({ level, progress, size = 36, textColor }) => {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  useEffect(() => {
    Animated.timing(animatedProgress, { toValue: progress, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress]);

  const strokeDashoffset = animatedProgress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <SvgGradient id="lvlGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#a855f7" />
            <Stop offset="100%" stopColor="#06b6d4" />
          </SvgGradient>
        </Defs>
        <Circle cx={size/2} cy={size/2} r={radius} stroke="rgba(128,128,128,0.2)" strokeWidth={strokeWidth} fill="transparent" />
        <AnimatedCircle cx={size/2} cy={size/2} r={radius} stroke="url(#lvlGrad)" strokeWidth={strokeWidth} fill="transparent" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} rotation="-90" origin={`${size/2}, ${size/2}`} />
      </Svg>
      <Text style={{ color: textColor, fontSize: 11, fontWeight: '800' }}>{level}</Text>
    </View>
  );
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);


export const ProfileScreen: React.FC<{ isActive?: boolean }> = ({ isActive }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
        fetchData(true);
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
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(168,85,247,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
          <Ionicons name="person" size={40} color="#a855f7" />
        </View>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>Your Profile</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>Sign in to connect with friends and track your gaming journey</Text>
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
              <View style={{ position: 'relative' }}>
                <Avatar uri={avatar} size={86} />
                <View style={{ position: 'absolute', bottom: -4, right: -4, backgroundColor: colors.background, borderRadius: 20, padding: 2 }}>
                  <LevelRing level={stats?.level.current || 1} progress={stats?.level.progress || 0} size={32} textColor={colors.text} />
                </View>
              </View>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,214,10,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
                <FontAwesome5 name="coins" size={12} color="#ffd60a" />
                <Text style={{ color: '#ffd60a', fontSize: 13, fontWeight: '700' }}>{formatNumber(stats?.points.balance || 0)}</Text>
              </View>
              {(stats?.streak.current || 0) > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(249,115,22,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
                  <Ionicons name="flame" size={14} color="#f97316" />
                  <Text style={{ color: '#f97316', fontSize: 13, fontWeight: '600' }}>{stats?.streak.current} day streak</Text>
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
                  { text: 'Delete', style: 'destructive', onPress: async () => {
                    try { await auth.deleteAccount(); setShowSettings(false); logout(); } 
                    catch { Alert.alert('Error', 'Failed to delete account.'); }
                  }}
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
