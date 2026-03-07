import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useAuthScreen } from '../../App';
import { messages as messagesApi, users, feed, games as gamesApi, stories as storiesApi } from '../services/api';
import { Avatar } from './Avatar';
import { UserProfileModal } from './UserProfileModal';
import { StoryViewer } from './StoryViewer';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAMES_HOST = 'https://gametok-games.pages.dev';

interface Conversation {
  id: string;
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  lastMessage?: {
    text: string;
    createdAt: string;
    isRead: boolean;
  };
  streak: number;
}

interface UserItem {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  isFollowing?: boolean;
}

interface ActivityItem {
  id: string;
  type: 'follow' | 'like' | 'comment' | 'score' | 'playing';
  user: UserItem;
  game?: { id: string; name: string; thumbnail?: string };
  score?: number;
  text?: string;
  createdAt: string;
}

interface LivePlayer {
  user: UserItem;
  game: { id: string; name: string; thumbnail?: string; color?: string };
  score?: number;
}

export const InboxScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const { showAuthScreen, showLoginScreen } = useAuthScreen();
  const { socket, onlineUsers } = useSocket();

  // Tab state
  const [activeTab, setActiveTab] = useState<'activity' | 'messages'>('activity');

  // Activity state
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserItem[]>([]);
  const [livePlayers, setLivePlayers] = useState<LivePlayer[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  // Messages state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Profile modal
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);

  // Pending requests
  const [pendingCount, setPendingCount] = useState(0);

  const [refreshing, setRefreshing] = useState(false);

  // Stories state
  const [storyUsers, setStoryUsers] = useState<any[]>([]);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState(0);
  const [creatingStory, setCreatingStory] = useState(false);

  // Fetch activity feed
  const fetchActivity = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await feed.activity(30);
      setActivity(data.activity || []);
    } catch (e) {
      console.log('Activity fetch error:', e);
    }
  }, [isAuthenticated]);

  // Fetch suggested users (people you may know)
  const fetchSuggested = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      // Use global feed to find active users
      const data = await feed.global(20);
      const uniqueUsers: Record<string, UserItem> = {};
      (data.activity || []).forEach((item: ActivityItem) => {
        if (item.user && item.user.id !== user?.id && !uniqueUsers[item.user.id]) {
          uniqueUsers[item.user.id] = item.user;
        }
      });
      setSuggestedUsers(Object.values(uniqueUsers).slice(0, 10));
    } catch (e) {
      console.log('Suggested fetch error:', e);
    }
  }, [isAuthenticated, user?.id]);

  // Fetch live players (simulated - people currently playing)
  const fetchLivePlayers = useCallback(async () => {
    try {
      const gamesData = await gamesApi.list(20, 0);
      const gamesList = gamesData.games || [];

      // Get global activity to find recent players
      const activityData = await feed.global(30);
      const recentPlayers: LivePlayer[] = [];

      (activityData.activity || []).forEach((item: ActivityItem) => {
        if (item.type === 'playing' || item.game) {
          const game = item.game || gamesList[Math.floor(Math.random() * gamesList.length)];
          if (game && item.user && item.user.id !== user?.id) {
            // Use game's thumbnail from DB, or fallback to CDN for our own games
            const thumbnail = game.thumbnail || `${GAMES_HOST}/thumbnails/${game.id}.png`;
            recentPlayers.push({
              user: item.user,
              game: {
                id: game.id,
                name: game.name,
                thumbnail,
                color: '#a855f7',
              },
              score: item.score,
            });
          }
        }
      });

      setLivePlayers(recentPlayers.slice(0, 4));
    } catch (e) {
      console.log('Live players fetch error:', e);
    }
  }, [user?.id]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated) {
      setLoadingMessages(false);
      return;
    }
    try {
      const data = await messagesApi.getConversations();
      setConversations(data.conversations || []);
    } catch (e) {
      console.log('Conversations fetch error:', e);
    } finally {
      setLoadingMessages(false);
    }
  }, [isAuthenticated]);

  // Fetch pending count
  const fetchPendingCount = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const data = await users.pendingCount(user.id);
      setPendingCount(data.count || 0);
    } catch (e) { }
  }, [isAuthenticated, user?.id]);

  // Fetch stories
  const fetchStories = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await storiesApi.list();
      setStoryUsers(data.stories || []);
    } catch (e) {
      console.log('Stories fetch error:', e);
    }
  }, [isAuthenticated]);

  // Create story from camera/gallery
  const createStory = async () => {
    try {
      setCreatingStory(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        // For now, use the local URI - in production you'd upload to a CDN
        const mediaUrl = result.assets[0].uri;
        await storiesApi.create(mediaUrl, 'image');
        await fetchStories();
      }
    } catch (e) {
      console.log('Create story error:', e);
    } finally {
      setCreatingStory(false);
    }
  };

  // Open story viewer
  const openStory = (index: number) => {
    setStoryViewerIndex(index);
    setShowStoryViewer(true);
  };

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoadingActivity(true);
      await Promise.all([
        fetchActivity(),
        fetchSuggested(),
        fetchLivePlayers(),
        fetchConversations(),
        fetchPendingCount(),
        fetchStories(),
      ]);
      setLoadingActivity(false);
    };
    load();
  }, [fetchActivity, fetchSuggested, fetchLivePlayers, fetchConversations, fetchPendingCount, fetchStories]);

  // Socket.io messaging listener
  useEffect(() => {
    if (!socket) return;

    const handleReceive = (msg: any) => {
      // msg format: { id, senderId, receiverId, text, createdAt, gameId }

      // If we are currently chatting with the sender, append instantly
      if (selectedChat && selectedChat.user.id === msg.senderId) {
        setChatMessages(prev => [...prev, {
          id: msg.id,
          text: msg.text,
          createdAt: msg.createdAt,
          isMe: false,
          gameShare: msg.gameId ? { id: msg.gameId } : null
        }]);
      }

      // Either way, fetch conversations so the latest message jumps to the top
      fetchConversations();
    };

    socket.on('chat:receive', handleReceive);
    return () => {
      socket.off('chat:receive', handleReceive);
    };
  }, [socket, selectedChat, fetchConversations]);

  // Search effect
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const data = await users.search(searchQuery);
        setSearchResults(data.users || []);
      } catch (e) { }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchActivity(),
      fetchSuggested(),
      fetchLivePlayers(),
      fetchConversations(),
      fetchPendingCount(),
      fetchStories(),
    ]);
    setRefreshing(false);
  };

  const openChat = async (conversation: Conversation) => {
    setSelectedChat(conversation);
    setLoadingChat(true);
    try {
      const data = await messagesApi.getConversation(conversation.user.id);
      setChatMessages(data.messages || []);
    } catch (e) { }
    setLoadingChat(false);
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedChat) return;
    const text = messageText.trim();
    setMessageText('');
    try {
      const data = await messagesApi.send({ recipientId: selectedChat.user.id, text });

      if (socket && data.message) {
        socket.emit('chat:message', {
          to: selectedChat.user.id,
          text: data.message.text,
          id: data.message.id,
          createdAt: data.message.createdAt,
          gameId: data.message.gameShare?.id || null
        });
      }

      setChatMessages(prev => [...prev, data.message]);
      fetchConversations(); // pull it to top
    } catch (e) {
      setMessageText(text);
    }
  };

  const openUserProfile = (userItem: UserItem) => {
    setSelectedUser(userItem);
    setShowUserProfile(true);
  };

  const followUser = async (userId: string) => {
    try {
      await users.follow(userId);
      // Update UI
      setSuggestedUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, isFollowing: true } : u
      ));
    } catch (e) { }
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(diff / 86400000)}d`;
  };

  // Auth gate
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Connect</Text>
        </View>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.authGate}>
            <Ionicons name="people" size={64} color="rgba(255,255,255,0.3)" />
            <Text style={styles.authTitle}>Join the community</Text>
            <Text style={styles.authSubtitle}>Connect with players, see who's playing, and chat with friends</Text>
            <TouchableOpacity style={styles.authBtn} onPress={showAuthScreen}>
              <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.authBtnGradient}>
                <Text style={styles.authBtnText}>Sign Up</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={showLoginScreen}>
              <Text style={styles.authLogin}>Already have an account? Log in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Connect</Text>
        {pendingCount > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>{pendingCount}</Text>
          </View>
        )}
      </View>

      {/* Search Bar */}
      <TouchableOpacity
        style={[styles.searchBar, { backgroundColor: colors.surface }]}
        onPress={() => setShowSearch(true)}
      >
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <Text style={[styles.searchPlaceholder, { color: colors.textSecondary }]}>Find people</Text>
      </TouchableOpacity>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'activity' && styles.tabActive]}
          onPress={() => setActiveTab('activity')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'activity' ? colors.text : colors.textSecondary }]}>
            Activity
          </Text>
          {activeTab === 'activity' && <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'messages' && styles.tabActive]}
          onPress={() => setActiveTab('messages')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'messages' ? colors.text : colors.textSecondary }]}>
            Messages
          </Text>
          {activeTab === 'messages' && <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
      </View>

      {activeTab === 'activity' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {loadingActivity ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : (
            <>
              {/* Playing Now Section */}
              {livePlayers.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.liveIndicator}>
                      <View style={styles.liveDot} />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>Playing Now</Text>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveScroll}>
                    {livePlayers.map((player, i) => (
                      <TouchableOpacity
                        key={`${player.user.id}-${i}`}
                        style={[styles.liveCard, { backgroundColor: colors.surface }]}
                        onPress={() => openUserProfile(player.user)}
                      >
                        <Image
                          source={{ uri: player.game.thumbnail }}
                          style={styles.liveGameBg}
                          blurRadius={3}
                        />
                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.liveGradient}>
                          <Avatar uri={player.user.avatar} size={36} style={styles.liveAvatar} />
                          <Text style={styles.liveUsername} numberOfLines={1}>
                            {player.user.displayName || player.user.username}
                          </Text>
                          <Text style={styles.liveGame} numberOfLines={1}>{player.game.name}</Text>
                          <TouchableOpacity style={styles.livePlayBtn}>
                            <Ionicons name="play" size={12} color="#fff" />
                            <Text style={styles.livePlayText}>Play</Text>
                          </TouchableOpacity>
                        </LinearGradient>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* People You May Know */}
              {suggestedUsers.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: 16 }]}>
                    People You May Know
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedScroll}>
                    {suggestedUsers.map((person) => (
                      <View key={person.id} style={[styles.suggestedCard, { backgroundColor: colors.surface }]}>
                        <TouchableOpacity onPress={() => openUserProfile(person)}>
                          <Avatar uri={person.avatar} size={60} />
                        </TouchableOpacity>
                        <Text style={[styles.suggestedName, { color: colors.text }]} numberOfLines={1}>
                          {person.displayName || person.username}
                        </Text>
                        <Text style={[styles.suggestedUsername, { color: colors.textSecondary }]} numberOfLines={1}>
                          @{person.username}
                        </Text>
                        <TouchableOpacity
                          style={[styles.followBtn, person.isFollowing && styles.followingBtn]}
                          onPress={() => followUser(person.id)}
                        >
                          <Text style={[styles.followBtnText, person.isFollowing && { color: colors.textSecondary }]}>
                            {person.isFollowing ? 'Following' : 'Follow'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        /* Messages Tab */
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {loadingMessages ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : (
            <>
              {/* Stories Row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.storiesRow}
              >
                {/* Add Story */}
                <TouchableOpacity style={styles.storyItem} onPress={createStory} disabled={creatingStory}>
                  <View style={[styles.addStoryCircle, { backgroundColor: colors.surface }]}>
                    {creatingStory ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="add" size={28} color={colors.primary} />
                    )}
                  </View>
                  <Text style={[styles.storyUsername, { color: colors.textSecondary }]}>Add story</Text>
                </TouchableOpacity>

                {/* Real stories from API */}
                {storyUsers.map((storyUser, index) => (
                  <TouchableOpacity
                    key={storyUser.user.id}
                    style={styles.storyItem}
                    onPress={() => openStory(index)}
                  >
                    <LinearGradient
                      colors={storyUser.hasUnviewed ? ['#f472b6', '#a855f7', '#6366f1'] : ['#666', '#444']}
                      style={styles.storyRing}
                    >
                      <View style={[styles.storyAvatarContainer, { backgroundColor: colors.background }]}>
                        <Avatar uri={storyUser.user.avatar} size={56} />
                      </View>
                    </LinearGradient>
                    <Text style={[styles.storyUsername, { color: colors.text }]} numberOfLines={1}>
                      {storyUser.user.username}
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Fallback: show suggested users if no stories */}
                {storyUsers.length === 0 && suggestedUsers.slice(0, 6).map((person) => (
                  <TouchableOpacity key={person.id} style={styles.storyItem} onPress={() => openUserProfile(person)}>
                    <View style={[styles.noStoryRing, { borderColor: colors.border }]}>
                      <Avatar uri={person.avatar} size={56} />
                    </View>
                    <Text style={[styles.storyUsername, { color: colors.textSecondary }]} numberOfLines={1}>
                      {person.username}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Fixed Sections like TikTok */}
              <TouchableOpacity style={[styles.inboxSection, { borderBottomColor: colors.border }]}>
                <View style={[styles.inboxSectionIcon, { backgroundColor: '#10b981' }]}>
                  <Ionicons name="people" size={22} color="#fff" />
                </View>
                <View style={styles.inboxSectionContent}>
                  <Text style={[styles.inboxSectionTitle, { color: colors.text }]}>New followers</Text>
                  <Text style={[styles.inboxSectionSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {activity.filter(a => a.type === 'follow').length > 0
                      ? `${activity.filter(a => a.type === 'follow')[0]?.user?.username || 'Someone'} started following you`
                      : 'See your new followers here'}
                  </Text>
                </View>
                {activity.filter(a => a.type === 'follow').length > 0 && (
                  <View style={styles.inboxBadge}>
                    <Text style={styles.inboxBadgeText}>{activity.filter(a => a.type === 'follow').length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.inboxSection, { borderBottomColor: colors.border }]}>
                <View style={[styles.inboxSectionIcon, { backgroundColor: '#ec4899' }]}>
                  <Ionicons name="heart" size={22} color="#fff" />
                </View>
                <View style={styles.inboxSectionContent}>
                  <Text style={[styles.inboxSectionTitle, { color: colors.text }]}>Activity</Text>
                  <Text style={[styles.inboxSectionSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {activity.filter(a => a.type === 'like' || a.type === 'comment').length > 0
                      ? `${activity.filter(a => a.type === 'like' || a.type === 'comment')[0]?.user?.username || 'Someone'} liked your content`
                      : 'See notifications here'}
                  </Text>
                </View>
                {activity.filter(a => a.type === 'like' || a.type === 'comment').length > 0 && (
                  <View style={styles.inboxBadge}>
                    <Text style={styles.inboxBadgeText}>{activity.filter(a => a.type === 'like' || a.type === 'comment').length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.inboxSection, { borderBottomColor: colors.border }]}>
                <View style={[styles.inboxSectionIcon, { backgroundColor: '#6366f1' }]}>
                  <Ionicons name="notifications" size={22} color="#fff" />
                </View>
                <View style={styles.inboxSectionContent}>
                  <Text style={[styles.inboxSectionTitle, { color: colors.text }]}>System notifications</Text>
                  <Text style={[styles.inboxSectionSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    Account updates and announcements
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Message Threads */}
              {conversations.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  {conversations.map((chat) => (
                    <TouchableOpacity
                      key={chat.id}
                      style={[styles.chatItem, { borderBottomColor: colors.border }]}
                      onPress={() => openChat(chat)}
                    >
                      <View>
                        <Avatar uri={chat.user.avatar} size={52} />
                        {onlineUsers.includes(chat.user.id) && (
                          <View style={{
                            position: 'absolute', bottom: 2, right: 2,
                            width: 14, height: 14, borderRadius: 7,
                            backgroundColor: '#22c55e', borderWidth: 2, borderColor: colors.background
                          }} />
                        )}
                      </View>
                      <View style={styles.chatContent}>
                        <View style={styles.chatHeader}>
                          <Text style={[styles.chatUsername, { color: colors.text }]}>
                            {chat.user.displayName || chat.user.username}
                          </Text>
                          {chat.streak > 0 && (
                            <Text style={styles.streakBadge}>🔥 {chat.streak}</Text>
                          )}
                        </View>
                        <Text style={[styles.chatPreview, { color: colors.textSecondary }]} numberOfLines={1}>
                          {chat.lastMessage?.text || 'Start chatting'}
                        </Text>
                      </View>
                      <View style={styles.chatMeta}>
                        {chat.lastMessage && (
                          <Text style={[styles.chatTime, { color: colors.textSecondary }]}>
                            {formatTime(chat.lastMessage.createdAt)}
                          </Text>
                        )}
                        {chat.lastMessage && !chat.lastMessage.isRead && (
                          <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {conversations.length === 0 && (
                <View style={styles.emptyMessages}>
                  <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No messages yet</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Start a conversation with someone!
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Search Modal */}
      <Modal visible={showSearch} animationType="slide">
        <View style={[styles.searchModal, { paddingTop: insets.top, backgroundColor: colors.background }]}>
          <View style={styles.searchModalHeader}>
            <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); }}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={[styles.searchModalInput, { backgroundColor: colors.surface }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search people..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {searching ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : searchQuery.length < 2 ? (
            <View style={styles.searchHint}>
              <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.searchHintText, { color: colors.textSecondary }]}>
                Search for people by username
              </Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.searchHint}>
              <Ionicons name="person-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.searchHintText, { color: colors.textSecondary }]}>
                No users found for "{searchQuery}"
              </Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.searchResult, { borderBottomColor: colors.border }]}
                  onPress={() => { setShowSearch(false); openUserProfile(item); }}
                >
                  <Avatar uri={item.avatar} size={48} />
                  <View style={styles.searchResultContent}>
                    <Text style={[styles.searchResultName, { color: colors.text }]}>
                      {item.displayName || item.username}
                    </Text>
                    <Text style={[styles.searchResultUsername, { color: colors.textSecondary }]}>
                      @{item.username}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>

      {/* Chat Modal */}
      <Modal visible={!!selectedChat} animationType="slide">
        {selectedChat && (
          <View style={[styles.chatModal, { paddingTop: insets.top, backgroundColor: colors.background }]}>
            <View style={[styles.chatModalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setSelectedChat(null)}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chatModalUser}
                onPress={() => openUserProfile(selectedChat.user)}
              >
                <Avatar uri={selectedChat.user.avatar} size={36} />
                <Text style={[styles.chatModalUsername, { color: colors.text }]}>
                  {selectedChat.user.displayName || selectedChat.user.username}
                </Text>
              </TouchableOpacity>
              <View style={{ width: 24 }} />
            </View>

            {loadingChat ? (
              <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
            ) : (
              <FlatList
                data={chatMessages}
                keyExtractor={(item) => item.id}
                style={styles.chatMessagesList}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => {
                  const cleanText = item.text?.replace(/\[(?:GAME|CHALLENGE):[^\]]+\]\s*/, '') || '';
                  const hasGameShare = !!item.gameShare;
                  const thumbUri = item.gameShare?.thumbnail
                    ? (item.gameShare.thumbnail.startsWith('http') ? item.gameShare.thumbnail : `${GAMES_HOST}${item.gameShare.thumbnail}`)
                    : null;

                  if (hasGameShare) {
                    return (
                      <View style={[
                        { maxWidth: '70%', marginBottom: 10 },
                        item.isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }
                      ]}>
                        <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: item.gameShare.color || '#333' }}>
                          {thumbUri ? (
                            <Image
                              source={{ uri: thumbUri }}
                              style={{ width: '100%', aspectRatio: 1, backgroundColor: item.gameShare.color || '#333' }}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={{ width: '100%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: item.gameShare.color || '#333' }}>
                              <Ionicons name="game-controller" size={40} color="rgba(255,255,255,0.5)" />
                            </View>
                          )}
                          <View style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            paddingHorizontal: 12, paddingVertical: 10,
                            backgroundColor: 'rgba(0,0,0,0.55)',
                          }}>
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                              {item.gameShare.name}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                              <Ionicons name="play-circle" size={14} color="rgba(255,255,255,0.9)" />
                              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, marginLeft: 4, fontWeight: '500' }}>
                                Tap to play
                              </Text>
                            </View>
                          </View>
                        </View>
                        {cleanText ? (
                          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4, marginLeft: 4 }}>
                            {cleanText}
                          </Text>
                        ) : null}
                      </View>
                    );
                  }

                  return (
                    <View style={[
                      styles.messageBubble,
                      item.isMe ? styles.myMessage : styles.theirMessage,
                      { backgroundColor: item.isMe ? colors.primary : colors.surface }
                    ]}>
                      <Text style={[styles.messageText, { color: item.isMe ? '#fff' : colors.text }]}>
                        {cleanText}
                      </Text>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyChatHint}>
                    <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>
                      Say hi! 👋
                    </Text>
                  </View>
                }
              />
            )}

            <View style={[styles.chatInputArea, { paddingBottom: insets.bottom || 16, borderTopColor: colors.border }]}>
              <View style={[styles.chatInputBox, { backgroundColor: colors.surface }]}>
                <TextInput
                  style={[styles.chatInput, { color: colors.text }]}
                  placeholder="Message..."
                  placeholderTextColor={colors.textSecondary}
                  value={messageText}
                  onChangeText={setMessageText}
                  onSubmitEditing={sendMessage}
                />
              </View>
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: messageText.trim() ? colors.primary : colors.surface }]}
                onPress={sendMessage}
                disabled={!messageText.trim()}
              >
                <Ionicons name="send" size={20} color={messageText.trim() ? '#fff' : colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* User Profile Modal */}
      <UserProfileModal
        visible={showUserProfile}
        onClose={() => setShowUserProfile(false)}
        user={selectedUser ? {
          id: selectedUser.id,
          username: selectedUser.username,
          avatar: selectedUser.avatar || null,
          status: 'GAMETOK USER',
          isOnline: false,
          isFriend: false,
        } : null}
      />

      {/* Story Viewer */}
      <StoryViewer
        visible={showStoryViewer}
        onClose={() => setShowStoryViewer(false)}
        storyUsers={storyUsers}
        initialUserIndex={storyViewerIndex}
      />
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  pendingBadge: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pendingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  searchPlaceholder: {
    fontSize: 15,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabActive: {},
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: 60,
    borderRadius: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#a855f7',
  },
  liveScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  liveCard: {
    width: 140,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
  },
  liveGameBg: {
    ...StyleSheet.absoluteFillObject,
  },
  liveGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  liveAvatar: {
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#a855f7',
  },
  liveUsername: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  liveGame: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  livePlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  livePlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  suggestedScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  suggestedCard: {
    width: 130,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginRight: 12,
  },
  suggestedName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  suggestedUsername: {
    fontSize: 12,
    marginTop: 2,
  },
  followBtn: {
    backgroundColor: '#a855f7',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 12,
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  followBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    lineHeight: 20,
  },
  activityUsername: {
    fontWeight: '600',
  },
  activityTime: {
    fontSize: 12,
    marginTop: 4,
  },
  activityGameThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  emptyMessages: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatUsername: {
    fontSize: 15,
    fontWeight: '600',
  },
  streakBadge: {
    fontSize: 12,
  },
  chatPreview: {
    fontSize: 14,
    marginTop: 2,
  },
  chatMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  chatTime: {
    fontSize: 12,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  authGate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  authTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
  },
  authSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  authBtn: {
    marginTop: 32,
    borderRadius: 24,
    overflow: 'hidden',
  },
  authBtnGradient: {
    paddingHorizontal: 48,
    paddingVertical: 14,
  },
  authBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  authLogin: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 16,
  },
  searchModal: {
    flex: 1,
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchModalInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  searchHint: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  searchHintText: {
    fontSize: 14,
    marginTop: 12,
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
  },
  searchResultUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  chatModal: {
    flex: 1,
  },
  chatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  chatModalUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  chatModalUsername: {
    fontSize: 16,
    fontWeight: '600',
  },
  chatMessagesList: {
    flex: 1,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  emptyChatHint: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyChatText: {
    fontSize: 16,
  },
  chatInputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  chatInputBox: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  chatInput: {
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inboxSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  inboxSectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inboxSectionContent: {
    flex: 1,
  },
  inboxSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  inboxSectionSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  inboxBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  inboxBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  storiesRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  storyItem: {
    alignItems: 'center',
    width: 72,
    marginRight: 4,
  },
  addStoryCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    borderStyle: 'dashed',
  },
  storyRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyUsername: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  noStoryRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default InboxScreen;
