import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  StatusBar,
  Dimensions,
  Image,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAuthScreen } from '../../App';
import { users, feed } from '../services/api';
import { UserProfileModal } from './UserProfileModal';
import { Avatar } from './Avatar';
import { FriendRequestsScreen } from './FriendRequestsScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAMES_HOST = 'https://gametok-games.pages.dev';

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

interface ActivityItem {
  id: string;
  type: string;
  user: { id: string; username: string; displayName?: string; avatar?: string; };
  game: { id: string; name: string; icon: string; thumbnail?: string; color?: string; };
  score: number;
  createdAt: string;
}

interface PlayingGame {
  id: string;
  name: string;
  color: string;
}

// Activity Card - shows user playing a game
const ActivityCard: React.FC<{
  item: ActivityItem;
  onUserPress: () => void;
  onGamePress: () => void;
}> = ({ item, onUserPress, onGamePress }) => {
  const [imageError, setImageError] = useState(false);
  const thumbnailUrl = `${GAMES_HOST}/thumbnails/${item.game.id}.png`;
  const isRecent = (new Date().getTime() - new Date(item.createdAt).getTime()) < 300000;

  return (
    <TouchableOpacity style={styles.activityCard} onPress={onGamePress} activeOpacity={0.9}>
      {!imageError ? (
        <Image source={{ uri: thumbnailUrl }} style={styles.activityCardBg} resizeMode="cover" onError={() => setImageError(true)} />
      ) : (
        <View style={[styles.activityCardBg, { backgroundColor: item.game.color || '#a855f7' }]} />
      )}
      <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']} style={styles.activityCardGradient} />

      <TouchableOpacity style={styles.activityUserRow} onPress={onUserPress} activeOpacity={0.8}>
        <Avatar uri={item.user.avatar} size={28} />
        <Text style={styles.activityUsername} numberOfLines={1}>{item.user.displayName || item.user.username}</Text>
        {isRecent && <View style={styles.liveDot} />}
      </TouchableOpacity>

      {item.score > 0 && (
        <View style={styles.scoreBadge}>
          <Ionicons name="trophy" size={10} color="#ffd60a" />
          <Text style={styles.scoreText}>{item.score.toLocaleString()}</Text>
        </View>
      )}

      <Text style={styles.activityGameName} numberOfLines={1}>{item.game.name}</Text>
    </TouchableOpacity>
  );
};

export const DiscoverScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const { showAuthScreen, showLoginScreen } = useAuthScreen();
  const gameWebViewRef = useRef<WebView>(null);

  const [activeTab, setActiveTab] = useState<'trending' | 'following'>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [addedUsers, setAddedUsers] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const [globalActivity, setGlobalActivity] = useState<ActivityItem[]>([]);
  const [friendsActivity, setFriendsActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [playingGame, setPlayingGame] = useState<PlayingGame | null>(null);
  const [gameLoaded, setGameLoaded] = useState(false);

  const fetchActivity = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const globalData = await feed.global(20);
      setGlobalActivity(globalData.activity || []);

      if (isAuthenticated) {
        const friendsData = await feed.activity(20);
        setFriendsActivity(friendsData.activity || []);
      }
    } catch (error) {
      console.log('Failed to fetch activity:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  const fetchPendingCount = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const data = await users.pendingCount(user.id);
      setPendingCount(data.count || 0);
    } catch (error) {
      console.log('Failed to fetch pending count:', error);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    fetchActivity();
    fetchPendingCount();
  }, [fetchActivity, fetchPendingCount]);

  useEffect(() => {
    const search = async () => {
      if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
      setIsSearching(true);
      try {
        const data = await users.search(searchQuery.trim());
        setSearchResults(data.users || []);
      } catch (error) { setSearchResults([]); }
      finally { setIsSearching(false); }
    };
    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleAdd = async (userId: string) => {
    if (!isAuthenticated) { showAuthScreen(); return; }
    try {
      await users.follow(userId);
      setAddedUsers(prev => new Set([...prev, userId]));
    } catch (error) { console.log('Follow error:', error); }
  };

  const openGame = (game: { id: string; name: string; color?: string }) => {
    setPlayingGame({ id: game.id, name: game.name, color: game.color || '#a855f7' });
    setGameLoaded(false);
  };

  const openUserProfile = (userData: ActivityItem['user']) => {
    setSelectedUser({
      id: userData.id, username: userData.username, displayName: userData.displayName,
      avatar: userData.avatar || null, status: 'GAMETOK USER', isOnline: false, isFriend: false,
    });
    setShowUserProfile(true);
  };

  const currentActivity = activeTab === 'trending' ? globalActivity : friendsActivity;

  const AuthOverlay = () => (
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
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Connect</Text>
        <TouchableOpacity style={styles.requestsBtn} onPress={() => isAuthenticated ? setShowRequests(true) : showAuthScreen()}>
          <Ionicons name="people" size={22} color={colors.text} />
          {pendingCount > 0 && <View style={styles.requestsBadge}><Text style={styles.requestsBadgeText}>{pendingCount}</Text></View>}
        </TouchableOpacity>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: isSearchFocused ? colors.primary : 'transparent', borderWidth: 1 }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search for people & games"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); Keyboard.dismiss(); }}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableWithoutFeedback>

      {searchQuery.length >= 2 ? (
        <View style={{ flex: 1 }}>
          {isSearching ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : searchResults.length === 0 ? (
            <View style={styles.emptySearch}><Text style={[styles.emptySearchText, { color: colors.textSecondary }]}>No results for "{searchQuery}"</Text></View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.userRow, { borderBottomColor: colors.border }]} onPress={() => { setSelectedUser({ id: item.id, username: item.username, displayName: item.displayName, avatar: item.avatar, status: 'GAMETOK USER', isOnline: false, isFriend: addedUsers.has(item.id) }); setShowUserProfile(true); }}>
                  <Avatar uri={item.avatar} size={48} />
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>{item.displayName || item.username}</Text>
                    <Text style={[styles.userHandle, { color: colors.textSecondary }]}>@{item.username}</Text>
                  </View>
                  <TouchableOpacity style={[styles.addBtn, addedUsers.has(item.id) ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border } : { backgroundColor: colors.primary }]} onPress={(e) => { e.stopPropagation(); if (!addedUsers.has(item.id)) handleAdd(item.id); }}>
                    {addedUsers.has(item.id) ? <Ionicons name="checkmark" size={18} color={colors.textSecondary} /> : <Text style={styles.addBtnText}>Follow</Text>}
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      ) : (
        <>
          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tab, activeTab === 'trending' && styles.tabActive]} onPress={() => setActiveTab('trending')}>
              <Text style={[styles.tabText, activeTab === 'trending' && styles.tabTextActive]}>Trending</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, activeTab === 'following' && styles.tabActive]} onPress={() => { if (!isAuthenticated) { showAuthScreen(); return; } setActiveTab('following'); }}>
              <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>Following</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchActivity(true)} tintColor={colors.primary} />}>
            {loading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
            ) : currentActivity.length === 0 ? (
              <View style={styles.emptyFeed}>
                <Ionicons name={activeTab === 'following' ? 'people-outline' : 'flame-outline'} size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyFeedTitle, { color: colors.text }]}>{activeTab === 'following' ? 'No activity yet' : 'Nothing trending'}</Text>
                <Text style={[styles.emptyFeedText, { color: colors.textSecondary }]}>{activeTab === 'following' ? 'Follow people to see their activity here' : 'Check back later for trending games'}</Text>
              </View>
            ) : (
              <View style={styles.activityGrid}>
                {currentActivity.map((item) => (
                  <ActivityCard key={item.id} item={item} onUserPress={() => openUserProfile(item.user)} onGamePress={() => openGame(item.game)} />
                ))}
              </View>
            )}
          </ScrollView>
        </>
      )}

      <UserProfileModal visible={showUserProfile} onClose={() => setShowUserProfile(false)} user={selectedUser} />

      {showRequests && (
        <View style={StyleSheet.absoluteFill}>
          <FriendRequestsScreen visible={showRequests} onClose={() => { setShowRequests(false); fetchPendingCount(); }} onOpenChat={() => { }} />
        </View>
      )}

      <Modal visible={playingGame !== null} animationType="slide" onRequestClose={() => setPlayingGame(null)}>
        {playingGame && (
          <View style={styles.gameModal}>
            <StatusBar hidden />
            <WebView ref={gameWebViewRef} source={{ uri: `${GAMES_HOST}/${playingGame.id}/` }} style={styles.gameWebView} scrollEnabled={false} bounces={false} onLoadEnd={() => setGameLoaded(true)} javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} allowsAirPlayForMediaPlayback={false} />
            {!gameLoaded && <View style={[styles.gameLoadingOverlay, { backgroundColor: playingGame.color }]}><ActivityIndicator size="large" color="#fff" /><Text style={styles.gameLoadingText}>Loading {playingGame.name}...</Text></View>}
            <TouchableOpacity style={[styles.gameCloseBtn, { top: insets.top + 10 }]} onPress={() => { setPlayingGame(null); setGameLoaded(false); }}>
              <BlurView intensity={50} tint="dark" style={styles.gameCloseBtnBlur}><Ionicons name="close" size={24} color="#fff" /></BlurView>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      {!isAuthenticated && activeTab === 'following' && <AuthOverlay />}
    </View>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#fff' },
  requestsBtn: { position: 'relative', padding: 4 },
  requestsBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#FF3B30', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  requestsBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, gap: 10 },
  searchInput: { flex: 1, fontSize: 15 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  tabActive: { backgroundColor: '#fff', borderColor: '#fff' },
  tabText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  tabTextActive: { color: '#000' },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  activityCard: { width: (SCREEN_WIDTH - 40) / 3, height: (SCREEN_WIDTH - 40) / 3 * 1.4, borderRadius: 12, overflow: 'hidden' },
  activityCardBg: { ...StyleSheet.absoluteFillObject },
  activityCardGradient: { ...StyleSheet.absoluteFillObject },
  activityUserRow: { flexDirection: 'row', alignItems: 'center', gap: 6, position: 'absolute', top: 8, left: 8, right: 8 },
  activityUsername: { color: '#fff', fontSize: 11, fontWeight: '600', flex: 1 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#a855f7' },
  scoreBadge: { position: 'absolute', bottom: 28, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  scoreText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  activityGameName: { position: 'absolute', bottom: 8, left: 8, right: 8, color: '#fff', fontSize: 12, fontWeight: '700' },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600' },
  userHandle: { fontSize: 13, marginTop: 2 },
  addBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emptySearch: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptySearchText: { fontSize: 15 },
  emptyFeed: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyFeedTitle: { fontSize: 18, fontWeight: '700' },
  emptyFeedText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  gameModal: { flex: 1, backgroundColor: '#000' },
  gameWebView: { flex: 1 },
  gameLoadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  gameLoadingText: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 16 },
  gameCloseBtn: { position: 'absolute', right: 16, zIndex: 100 },
  gameCloseBtnBlur: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
});
