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
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { messages as messagesApi, users } from '../services/api';
import { Avatar } from './Avatar';
import { UserProfileModal } from './UserProfileModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
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

interface Message {
  id: string;
  text: string;
  senderId: string;
  isMe: boolean;
  createdAt: string;
  gameShare?: {
    id: string;
    name: string;
    icon: string;
    color: string;
    thumbnail?: string;
    description?: string;
  } | null;
}

interface Story {
  id: string;
  user: string;
  avatar: string | null;
  hasNew: boolean;
  game: string;
  score: number;
}

interface Follower {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

const STORIES: Story[] = [
  { id: '1', user: 'gamer_pro', avatar: null, hasNew: true, game: 'Stack Ball', score: 2450 },
  { id: '2', user: 'ninja_master', avatar: null, hasNew: true, game: 'Fruit Slicer', score: 1890 },
  { id: '3', user: 'speedrunner', avatar: null, hasNew: true, game: 'Stack Ball', score: 3200 },
  { id: '4', user: 'casual_gamer', avatar: null, hasNew: false, game: 'Fruit Slicer', score: 980 },
  { id: '5', user: 'champion99', avatar: null, hasNew: true, game: 'Stack Ball', score: 4100 },
];

export const InboxScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const gameWebViewRef = useRef<WebView>(null);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [progress, setProgress] = useState(0);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedStoryUser, setSelectedStoryUser] = useState<{
    id: string;
    username: string;
    avatar: string | null;
    status: string;
    isOnline: boolean;
    isFriend: boolean;
  } | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [newFollowers, setNewFollowers] = useState<Follower[]>([]);
  const [showActivityModal, setShowActivityModal] = useState(false);
  
  // Game modal state
  const [playingGame, setPlayingGame] = useState<{
    id: string;
    name: string;
    icon: string;
    color: string;
  } | null>(null);
  const [gameLoaded, setGameLoaded] = useState(false);
  const [gameScore, setGameScore] = useState(0);

  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    
    try {
      const data = await messagesApi.getConversations();
      setConversations(data.conversations || []);
    } catch (error) {
      console.log('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  const fetchFollowers = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    
    try {
      const data = await users.pendingRequests(user.id);
      // API returns array directly
      setNewFollowers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log('Failed to fetch pending requests:', error);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    fetchConversations();
    fetchFollowers();
  }, [fetchConversations, fetchFollowers]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConversations();
    fetchFollowers();
  };

  const handleStoryPress = (story: Story) => {
    setViewingStory(story);
    setProgress(0);
    
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setViewingStory(null);
          return 0;
        }
        return p + 2;
      });
    }, 100);
  };

  const openChat = async (conversation: Conversation) => {
    setSelectedChat(conversation);
    setLoadingChat(true);
    setChatMessages([]);
    
    try {
      const data = await messagesApi.getConversation(conversation.user.id);
      setChatMessages(data.messages || []);
    } catch (error) {
      console.log('Failed to load chat:', error);
    } finally {
      setLoadingChat(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedChat || sendingMessage) return;
    
    setSendingMessage(true);
    const text = messageText.trim();
    setMessageText('');
    
    try {
      const data = await messagesApi.send({
        recipientId: selectedChat.user.id,
        text,
      });
      
      setChatMessages(prev => [...prev, data.message]);
    } catch (error) {
      console.log('Failed to send message:', error);
      setMessageText(text); // Restore on error
    } finally {
      setSendingMessage(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  // Render a game share card in chat
  const renderGameShareCard = (gameShare: NonNullable<Message['gameShare']>, isMe: boolean) => (
    <View style={[styles.gameShareCard, { backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : colors.surface }]}>
      <View style={styles.gameShareHeader}>
        <View style={[styles.gameShareIconBg, { backgroundColor: gameShare.color || '#FF8E53' }]}>
          <Text style={styles.gameShareIcon}>{gameShare.icon}</Text>
        </View>
        <View style={styles.gameShareInfo}>
          <Text style={[styles.gameShareName, { color: isMe ? '#fff' : colors.text }]}>{gameShare.name}</Text>
          <Text style={[styles.gameShareLabel, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>Tap to play</Text>
        </View>
        <View style={[styles.gameSharePlayBtn, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : colors.primary }]}>
          <Ionicons name="play" size={16} color="#fff" />
        </View>
      </View>
    </View>
  );

  // Filter conversations based on search
  const filteredConversations = searchQuery.trim() 
    ? conversations.filter(c => 
        c.user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.user.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="person-add-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Chat</Text>
        <TouchableOpacity>
          <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      {showSearch ? (
        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search chats..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); }}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity 
          style={[styles.searchBar, { backgroundColor: colors.surface }]}
          onPress={() => setShowSearch(true)}
        >
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <Text style={[styles.searchText, { color: colors.textSecondary }]}>Search</Text>
        </TouchableOpacity>
      )}

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* Stories Section */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesContent}
        >
          {STORIES.map((story) => (
            <TouchableOpacity 
              key={story.id} 
              style={styles.storyItem}
              onPress={() => handleStoryPress(story)}
            >
              {story.hasNew ? (
                <LinearGradient
                  colors={['#FF6B6B', '#FF8E53', '#FFC107']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.storyGradientRing}
                >
                  <View style={[styles.storyAvatarInner, { backgroundColor: colors.background }]}>
                    <Avatar uri={story.avatar} size={52} />
                  </View>
                </LinearGradient>
              ) : (
                <View style={[styles.storyAvatarRing, { backgroundColor: colors.surface }]}>
                  <Avatar uri={story.avatar} size={52} />
                </View>
              )}
              <Text style={[styles.storyUsername, { color: colors.text }]} numberOfLines={1}>
                {story.user}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Activity Row - New Followers */}
        {newFollowers.length > 0 && (
          <TouchableOpacity 
            style={[styles.activityRow, { borderBottomColor: colors.border }]}
            onPress={() => setShowActivityModal(true)}
          >
            <View style={[styles.activityIcon, { backgroundColor: '#00AAFF' }]}>
              <Ionicons name="people" size={20} color="#fff" />
            </View>
            <View style={styles.activityContent}>
              <Text style={[styles.activityTitle, { color: colors.text }]}>New followers</Text>
              <Text style={[styles.activityPreview, { color: colors.textSecondary }]} numberOfLines={1}>
                {newFollowers[0]?.displayName || newFollowers[0]?.username} started following you
                {newFollowers.length > 1 ? ` +${newFollowers.length - 1} more` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Chats List */}
        <View style={styles.chatsSection}>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No chats yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Start a conversation with friends!
              </Text>
            </View>
          ) : filteredConversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No results for "{searchQuery}"
              </Text>
            </View>
          ) : (
            filteredConversations.map((chat) => (
              <TouchableOpacity 
                key={chat.id} 
                style={styles.chatItem}
                onPress={() => openChat(chat)}
              >
                <Avatar uri={chat.user.avatar} size={52} style={styles.chatAvatar} />
                <View style={styles.chatContent}>
                  <View style={styles.chatHeader}>
                    <Text style={[styles.chatUser, { color: colors.text }]}>
                      {chat.user.displayName || chat.user.username}
                    </Text>
                    {chat.streak > 0 && (
                      <View style={styles.streakBadge}>
                        <Text style={styles.streakText}>🔥 {chat.streak}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.chatMessageRow}>
                    <Text 
                      style={[
                        styles.chatMessage, 
                        { color: colors.textSecondary },
                        chat.lastMessage && !chat.lastMessage.isRead && styles.chatMessageUnread
                      ]}
                      numberOfLines={1}
                    >
                      {chat.lastMessage?.text || 'Start chatting'}
                    </Text>
                    {chat.lastMessage && (
                      <Text style={[styles.chatTime, { color: colors.textSecondary }]}>
                        · {formatTime(chat.lastMessage.createdAt)}
                      </Text>
                    )}
                  </View>
                </View>
                {chat.lastMessage && !chat.lastMessage.isRead && (
                  <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Story Viewer Modal */}
      <Modal
        visible={viewingStory !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setViewingStory(null)}
      >
        {viewingStory && (
          <View style={[styles.storyViewer, { paddingTop: insets.top, backgroundColor: '#000' }]}>
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${progress}%` }]} />
            </View>

            <View style={styles.storyHeader}>
              <TouchableOpacity style={styles.storyHeaderLeft} onPress={() => {
                setViewingStory(null);
                setSelectedStoryUser({
                  id: viewingStory.id,
                  username: viewingStory.user,
                  avatar: viewingStory.avatar,
                  status: 'GAMETOK USER',
                  isOnline: true,
                  isFriend: false,
                });
                setShowUserProfile(true);
              }}>
                <Avatar uri={viewingStory.avatar} size={36} style={styles.storyHeaderAvatar} />
                <Text style={styles.storyHeaderUser}>{viewingStory.user}</Text>
                <Text style={styles.storyHeaderTime}>2h</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setViewingStory(null)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.storyContentView}>
              <View style={styles.storyGameCard}>
                <Text style={styles.storyGameIcon}>
                  {viewingStory.game === 'Stack Ball' ? '🎱' : '🍉'}
                </Text>
                <Text style={styles.storyGameName}>{viewingStory.game}</Text>
                <View style={styles.storyScoreBox}>
                  <Text style={styles.storyScoreLabel}>NEW HIGH SCORE</Text>
                  <Text style={[styles.storyScoreValue, { color: colors.accent }]}>
                    {viewingStory.score?.toLocaleString()}
                  </Text>
                </View>
                <TouchableOpacity style={[styles.storyPlayBtn, { backgroundColor: colors.primary }]}>
                  <Text style={styles.storyPlayText}>Play Now</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.storyFooter, { paddingBottom: insets.bottom || 20 }]}>
              <TouchableOpacity style={styles.storyReplyBtn}>
                <Text style={styles.storyReplyText}>Send message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.storyShareBtn}>
                <Ionicons name="paper-plane-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* Chat Modal */}
      <Modal
        visible={selectedChat !== null}
        animationType="slide"
        onRequestClose={() => setSelectedChat(null)}
      >
        {selectedChat && (
          <View style={[styles.chatModal, { paddingTop: insets.top, backgroundColor: colors.background }]}>
            {/* Chat Header */}
            <View style={[styles.chatModalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setSelectedChat(null)}>
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.chatModalUser}
                onPress={() => {
                  setSelectedStoryUser({
                    id: selectedChat.user.id,
                    username: selectedChat.user.username,
                    avatar: selectedChat.user.avatar || null,
                    status: 'GAMETOK USER',
                    isOnline: false,
                    isFriend: false,
                  });
                  setShowUserProfile(true);
                }}
              >
                <Avatar uri={selectedChat.user.avatar} size={40} style={styles.chatModalAvatar} />
                <View>
                  <Text style={[styles.chatModalUsername, { color: colors.text }]}>
                    {selectedChat.user.displayName || selectedChat.user.username}
                  </Text>
                  {selectedChat.streak > 0 && (
                    <Text style={[styles.chatModalStreak, { color: colors.textSecondary }]}>
                      🔥 {selectedChat.streak} day streak
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                Alert.alert('Options', '', [
                  { text: 'Report User', onPress: () => Alert.alert('Report User', 'Why are you reporting this user?', [
                    { text: 'Spam', onPress: () => Alert.alert('Reported', 'Thank you for your report.') },
                    { text: 'Inappropriate', onPress: () => Alert.alert('Reported', 'Thank you for your report.') },
                    { text: 'Harassment', onPress: () => Alert.alert('Reported', 'Thank you for your report.') },
                    { text: 'Cancel', style: 'cancel' },
                  ])},
                  { text: 'Block User', style: 'destructive', onPress: () => Alert.alert('Block', `Block ${selectedChat.user.username}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Block', style: 'destructive', onPress: () => Alert.alert('Blocked', 'User has been blocked.') },
                  ])},
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}>
                <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Chat Messages */}
            {loadingChat ? (
              <View style={styles.chatLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <FlatList
                data={chatMessages}
                keyExtractor={(item) => item.id}
                style={styles.chatMessages}
                contentContainerStyle={styles.chatMessagesContent}
                inverted={false}
                renderItem={({ item }) => {
                  // Use gameShare data from backend
                  if (item.gameShare) {
                    return (
                      <TouchableOpacity 
                        style={[
                          item.isMe ? styles.sentBubble : styles.receivedBubble,
                          { backgroundColor: item.isMe ? colors.primary : colors.surface, padding: 0, overflow: 'hidden' }
                        ]}
                        activeOpacity={0.8}
                        onPress={() => {
                          // Open game in modal
                          setPlayingGame({
                            id: item.gameShare!.id,
                            name: item.gameShare!.name,
                            icon: item.gameShare!.icon,
                            color: item.gameShare!.color,
                          });
                          setGameLoaded(false);
                          setGameScore(0);
                        }}
                      >
                        {renderGameShareCard(item.gameShare, item.isMe)}
                      </TouchableOpacity>
                    );
                  }
                  
                  return (
                    <View style={[
                      item.isMe ? styles.sentBubble : styles.receivedBubble,
                      { backgroundColor: item.isMe ? colors.primary : colors.surface }
                    ]}>
                      <Text style={[styles.bubbleText, { color: item.isMe ? '#fff' : colors.text }]}>
                        {item.text}
                      </Text>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyChat}>
                    <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>
                      Say hi! 👋
                    </Text>
                  </View>
                }
              />
            )}

            {/* Chat Input */}
            <View style={[styles.chatInputArea, { paddingBottom: insets.bottom || 16, borderTopColor: colors.border }]}>
              <TouchableOpacity style={styles.chatInputIcon}>
                <Ionicons name="camera" size={28} color={colors.primary} />
              </TouchableOpacity>
              <View style={[styles.chatInputBox, { backgroundColor: colors.surface }]}>
                <TextInput
                  style={[styles.chatInput, { color: colors.text }]}
                  placeholder="Send a chat"
                  placeholderTextColor={colors.textSecondary}
                  value={messageText}
                  onChangeText={setMessageText}
                  onSubmitEditing={sendMessage}
                  returnKeyType="send"
                />
                <TouchableOpacity>
                  <Ionicons name="happy-outline" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={styles.chatInputIcon} 
                onPress={sendMessage}
                disabled={!messageText.trim() || sendingMessage}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons 
                  name={messageText.trim() ? "send" : "mic-outline"} 
                  size={28} 
                  color={messageText.trim() ? colors.primary : colors.text} 
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* User Profile Modal */}
      <UserProfileModal
        visible={showUserProfile}
        onClose={() => setShowUserProfile(false)}
        user={selectedStoryUser}
      />

      {/* Activity Modal - New Followers */}
      <Modal
        visible={showActivityModal}
        animationType="slide"
        onRequestClose={() => setShowActivityModal(false)}
      >
        <View style={[styles.activityModal, { paddingTop: insets.top, backgroundColor: colors.background }]}>
          <View style={[styles.activityModalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowActivityModal(false)}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.activityModalTitle, { color: colors.text }]}>Activity</Text>
            <View style={{ width: 28 }} />
          </View>

          <FlatList
            data={newFollowers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.activityList}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.activityItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setShowActivityModal(false);
                  setSelectedStoryUser({
                    id: item.id,
                    username: item.username,
                    avatar: item.avatar || null,
                    status: 'STARTED FOLLOWING YOU',
                    isOnline: false,
                    isFriend: false,
                  });
                  setShowUserProfile(true);
                }}
              >
                <Avatar uri={item.avatar} size={48} />
                <View style={styles.activityItemContent}>
                  <Text style={[styles.activityItemName, { color: colors.text }]}>
                    {item.displayName || item.username}
                  </Text>
                  <Text style={[styles.activityItemText, { color: colors.textSecondary }]}>
                    started following you
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[styles.followBackBtn, { backgroundColor: colors.primary }]}
                  onPress={async (e) => {
                    e.stopPropagation();
                    try {
                      await users.follow(item.id);
                    } catch (error) {
                      console.log('Follow error:', error);
                    }
                  }}
                >
                  <Text style={styles.followBackText}>Follow</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyActivity}>
                <Text style={[styles.emptyActivityText, { color: colors.textSecondary }]}>
                  No new followers yet
                </Text>
              </View>
            }
          />
        </View>
      </Modal>

      {/* Game Player Modal */}
      <Modal
        visible={playingGame !== null}
        animationType="slide"
        onRequestClose={() => setPlayingGame(null)}
      >
        {playingGame && (
          <View style={styles.gameModal}>
            <StatusBar hidden />
            
            {/* Game WebView */}
            <WebView
              ref={gameWebViewRef}
              source={{ uri: `${GAMES_HOST}/${playingGame.id}/` }}
              style={styles.gameWebView}
              scrollEnabled={false}
              bounces={false}
              onLoadEnd={() => {
                setGameLoaded(true);
                // Auto-start the game
                gameWebViewRef.current?.injectJavaScript(`
                  if (window.startGame) window.startGame();
                  if (window.start) window.start();
                  true;
                `);
              }}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'gameOver') {
                    setGameScore(data.score);
                  } else if (data.type === 'score') {
                    setGameScore(data.score);
                  }
                } catch (e) {}
              }}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
            />

            {/* Loading overlay */}
            {!gameLoaded && (
              <View style={styles.gameLoadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.gameLoadingText}>Loading {playingGame.name}...</Text>
              </View>
            )}

            {/* Close button */}
            <TouchableOpacity 
              style={[styles.gameCloseBtn, { top: insets.top + 10 }]}
              onPress={() => setPlayingGame(null)}
            >
              <BlurView intensity={50} tint="dark" style={styles.gameCloseBtnBlur}>
                <Ionicons name="close" size={24} color="#fff" />
              </BlurView>
            </TouchableOpacity>

            {/* Score display */}
            {gameScore > 0 && (
              <View style={[styles.gameScoreBadge, { top: insets.top + 10 }]}>
                <Text style={styles.gameScoreText}>{gameScore}</Text>
              </View>
            )}

            {/* Game info bar at bottom */}
            <View style={[styles.gameInfoBar, { paddingBottom: insets.bottom + 10 }]}>
              <View style={[styles.gameInfoIcon, { backgroundColor: playingGame.color }]}>
                <Text style={styles.gameInfoEmoji}>{playingGame.icon}</Text>
              </View>
              <Text style={styles.gameInfoName}>{playingGame.name}</Text>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
  },
  searchText: {
    marginLeft: 8,
    fontSize: 15,
    flex: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
  },
  storiesContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 64,
  },
  storyAvatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  storyGradientRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  storyAvatarInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatar: {
    flex: 1,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatarText: {
    fontSize: 26,
  },
  storyUsername: {
    fontSize: 11,
    textAlign: 'center',
  },
  chatsSection: {
    paddingTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chatAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatAvatarText: {
    fontSize: 24,
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatUser: {
    fontSize: 15,
    fontWeight: '600',
  },
  streakBadge: {
    marginLeft: 8,
  },
  streakText: {
    fontSize: 12,
  },
  chatMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  chatMessage: {
    fontSize: 13,
    flex: 1,
  },
  chatMessageUnread: {
    fontWeight: '600',
  },
  chatTime: {
    fontSize: 12,
    marginLeft: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
  },
  storyViewer: {
    flex: 1,
  },
  progressContainer: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 8,
    marginTop: 8,
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  storyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyHeaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  storyHeaderAvatarText: {
    fontSize: 18,
  },
  storyHeaderUser: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  storyHeaderTime: {
    color: '#888',
    fontSize: 13,
  },
  storyContentView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  storyGameCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  storyGameIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  storyGameName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  storyScoreBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  storyScoreLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  storyScoreValue: {
    fontSize: 48,
    fontWeight: '800',
  },
  storyPlayBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  storyPlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  storyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  storyReplyBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  storyReplyText: {
    color: '#888',
    fontSize: 14,
  },
  storyShareBtn: {
    padding: 8,
  },
  chatModal: {
    flex: 1,
  },
  chatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  chatModalUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  chatModalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  chatModalAvatarText: {
    fontSize: 20,
  },
  chatModalUsername: {
    fontSize: 16,
    fontWeight: '600',
  },
  chatModalStreak: {
    fontSize: 12,
  },
  chatLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatMessages: {
    flex: 1,
  },
  chatMessagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyChatText: {
    fontSize: 16,
  },
  receivedBubble: {
    alignSelf: 'flex-start',
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    marginBottom: 8,
  },
  sentBubble: {
    alignSelf: 'flex-end',
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    marginBottom: 8,
  },
  bubbleText: {
    fontSize: 15,
  },
  chatInputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 0.5,
  },
  chatInputIcon: {
    padding: 4,
  },
  chatInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  chatInput: {
    flex: 1,
    fontSize: 15,
    marginRight: 8,
  },
  // Activity Row styles
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  activityPreview: {
    fontSize: 13,
  },
  // Activity Modal styles
  activityModal: {
    flex: 1,
  },
  activityModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  activityModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  activityList: {
    paddingVertical: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  activityItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityItemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  activityItemText: {
    fontSize: 13,
    marginTop: 1,
  },
  followBackBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followBackText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyActivity: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyActivityText: {
    fontSize: 15,
  },
  // Game Share Card styles
  gameShareCard: {
    padding: 12,
    borderRadius: 16,
    minWidth: 200,
  },
  gameShareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gameShareIconBg: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  gameShareIcon: {
    fontSize: 24,
  },
  gameShareInfo: {
    flex: 1,
  },
  gameShareName: {
    fontSize: 15,
    fontWeight: '700',
  },
  gameShareLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  gameSharePlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Game Player Modal styles
  gameModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  gameWebView: {
    flex: 1,
  },
  gameLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameLoadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  gameCloseBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 100,
  },
  gameCloseBtnBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  gameScoreBadge: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 100,
  },
  gameScoreText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  gameInfoBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  gameInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  gameInfoEmoji: {
    fontSize: 18,
  },
  gameInfoName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
