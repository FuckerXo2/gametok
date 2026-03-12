import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Modal,
  TextInput,
  FlatList,
  Image,
  StatusBar,
} from 'react-native';
import Animated, { FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useAuthScreen, useNavigation } from '../../App';
import { LoopsColors, SemanticColors } from '../constants/LoopsColors';
import { FontStyles } from '../constants/LoopsFonts';
import { multiplayer, users, messages as messagesApi, feed, stories as storiesApi, games as gamesApi } from '../services/api';
import { Avatar } from './Avatar';
import { UserProfileModal } from './UserProfileModal';
import { SlideRightModal } from './SlideRightModal';
import { StoryViewer } from './StoryViewer';
import { AnimatedButton } from './AnimatedButton';
import { GameLoadingScreen } from './GameLoadingScreen';
import * as ImagePicker from 'expo-image-picker';
import { getGameUrl, R2_BASE_URL, startGameDownload, subscribeToProgress, DownloadProgress } from '../services/gameDownloader';

const GAMES_HOST = 'https://gametok-games.pages.dev';

// Script to hide Godot/OpenPigeon's built-in loading screen
const GODOT_LOADER_HIDE_SCRIPT = `
(function() {
  if (window._godotLoaderHidden) return;
  window._godotLoaderHidden = true;
  
  const hideLoaders = () => {
    // Godot-specific loading elements
    const selectors = [
      '#status', '#status-progress', '#status-progress-inner', '#status-indeterminate',
      '#status-notice', '.godot-loader', '.godot-splash', '[class*="godot-"]',
      '.loading-screen', '.splash-screen', '#loading', '#splash',
      '.progress-bar', '.loading-bar', '.loader', '.preloader',
      '[id*="loading"]', '[id*="splash"]', '[class*="loading"]', '[class*="splash"]',
    ];
    
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;';
      });
    });
    
    // Also hide any element with "loading" or "progress" in its text
    document.querySelectorAll('div, span, p').forEach(el => {
      const text = el.textContent?.toLowerCase() || '';
      if ((text.includes('loading') || text.includes('progress')) && el.children.length === 0) {
        el.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important;';
      }
    });
  };
  
  // Inject CSS to hide loaders
  const style = document.createElement('style');
  style.textContent = \`
    #status, #status-progress, #status-progress-inner, #status-indeterminate,
    #status-notice, .godot-loader, .godot-splash, .loading-screen, .splash-screen,
    #loading, #splash, .progress-bar, .loading-bar, .loader, .preloader,
    [id*="loading"], [id*="splash"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
    html, body {
      background: #000 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    canvas {
      width: 100vw !important;
      height: 100vh !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
    }
  \`;
  document.head.appendChild(style);
  
  // Run immediately and repeatedly
  hideLoaders();
  setInterval(hideLoaders, 100);
  setTimeout(hideLoaders, 0);
  setTimeout(hideLoaders, 50);
  setTimeout(hideLoaders, 200);
  setTimeout(hideLoaders, 500);
  setTimeout(hideLoaders, 1000);
  setTimeout(hideLoaders, 2000);
})();
true;
`;

// Script to detect when game is actually ready (canvas rendering)
const GAME_READY_SCRIPT = `
(function() {
  if (window._gameReadyActive) return;
  window._gameReadyActive = true;
  
  let gameReady = false;
  const startTime = Date.now();
  
  const notifyReady = () => {
    if (gameReady) return;
    // Minimum 2 seconds to let game initialize
    if (Date.now() - startTime < 2000) {
      setTimeout(notifyReady, 2000 - (Date.now() - startTime));
      return;
    }
    gameReady = true;
    try {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'GAME_READY' }));
    } catch(e) {}
  };
  
  // Check for WebGL canvas activity
  const checkCanvas = () => {
    const canvases = document.querySelectorAll('canvas');
    for (const canvas of canvases) {
      if (canvas.width > 100 && canvas.height > 100) {
        const ctx = canvas.getContext('webgl') || canvas.getContext('webgl2');
        if (ctx) {
          setTimeout(notifyReady, 1500);
          return true;
        }
      }
    }
    return false;
  };
  
  // Poll for canvas
  const interval = setInterval(() => {
    if (checkCanvas() || gameReady) {
      clearInterval(interval);
    }
  }, 200);
  
  // Fallback: mark ready after 8 seconds max
  setTimeout(() => {
    if (!gameReady) notifyReady();
  }, 8000);
})();
true;
`;

type TabName = 'play' | 'messages';

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

// Animated Tab Button Component
const TabButton: React.FC<{
  label: string;
  icon: string;
  isActive: boolean;
  onPress: () => void;
}> = ({ label, icon, isActive, onPress }) => {
  const scale = useSharedValue(1);
  const { colors } = useTheme();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 12, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 250 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View style={[styles.tabButton, animatedStyle]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[
          styles.tabButtonInner,
          {
            backgroundColor: isActive ? LoopsColors.color1 : colors.surface,
          },
        ]}
      >
        <Ionicons
          name={icon as any}
          size={20}
          color={isActive ? LoopsColors.white : colors.textSecondary}
        />
        <Text
          style={[
            styles.tabButtonText,
            {
              color: isActive ? LoopsColors.white : colors.textSecondary,
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

// Messages Tab
const MessagesTab: React.FC = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const insets = useSafeAreaInsets();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [storyUsers, setStoryUsers] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Chat modal state
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

  // Story viewer
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState(0);
  const [creatingStory, setCreatingStory] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [convRes, activityRes, storiesRes, followingRes] = await Promise.all([
        messagesApi.getConversations().catch(() => ({ conversations: [] })),
        feed.activity(30).catch(() => ({ activity: [] })),
        storiesApi.list().catch(() => ({ stories: [] })),
        users.following(user?.id || '').catch(() => []),
      ]);

      setConversations(convRes.conversations || []);
      setActivity(activityRes.activity || []);
      setStoryUsers(storiesRes.stories || []);

      // Get suggested users from following
      const friends = Array.isArray(followingRes) ? followingRes : [];
      setSuggestedUsers(friends.slice(0, 6));
    } catch (error) {
      console.error('Load messages data error:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Socket.io messaging listener
  useEffect(() => {
    if (!socket) return;

    const handleReceive = (msg: any) => {
      if (selectedChat && selectedChat.user.id === msg.senderId) {
        setChatMessages(prev => [...prev, {
          id: msg.id,
          text: msg.text,
          createdAt: msg.createdAt,
          isMe: false,
          gameShare: msg.gameId ? { id: msg.gameId } : null
        }]);
      }
      loadData();
    };

    socket.on('chat:receive', handleReceive);
    return () => {
      socket.off('chat:receive', handleReceive);
    };
  }, [socket, selectedChat, loadData]);

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
    await loadData();
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
      loadData();
    } catch (e) {
      setMessageText(text);
    }
  };

  const openUserProfile = (userItem: UserItem) => {
    setSelectedUser(userItem);
    setShowUserProfile(true);
  };

  const createStory = async () => {
    try {
      setCreatingStory(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const mediaUrl = result.assets[0].uri;
        await storiesApi.create(mediaUrl, 'image');
        await loadData();
      }
    } catch (e) {
      console.log('Create story error:', e);
    } finally {
      setCreatingStory(false);
    }
  };

  const openStory = (index: number) => {
    setStoryViewerIndex(index);
    setShowStoryViewer(true);
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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={LoopsColors.color1} size="large" />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={LoopsColors.color1}
          />
        }
      >
        {/* Search Bar */}
        <TouchableOpacity
          style={[styles.searchBar, { backgroundColor: colors.surface }]}
          onPress={() => setShowSearch(true)}
        >
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <Text style={[styles.searchPlaceholder, { color: colors.textSecondary }]}>Search messages</Text>
        </TouchableOpacity>

        {/* Quick Access Row - New button + Recent contacts */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickAccessRow}
        >
          {/* New Message Button */}
          <TouchableOpacity style={styles.newMessageBtn} onPress={() => setShowSearch(true)}>
            <View style={[styles.newMessageCircle, { backgroundColor: colors.surface }]}>
              <Ionicons name="create-outline" size={24} color={LoopsColors.color1} />
            </View>
            <Text style={[styles.quickAccessLabel, { color: colors.text }]}>New</Text>
          </TouchableOpacity>

          {/* Recent contacts (plain avatars, no gradient rings) */}
          {suggestedUsers.map((person) => (
            <TouchableOpacity 
              key={person.id} 
              style={styles.quickAccessItem} 
              onPress={() => {
                // Start a chat with this person
                const existingConvo = conversations.find(c => c.user.id === person.id);
                if (existingConvo) {
                  openChat(existingConvo);
                } else {
                  // Create a new conversation object
                  openChat({
                    id: `new-${person.id}`,
                    user: person,
                    streak: 0
                  });
                }
              }}
            >
              <Avatar uri={person.avatar} size={56} />
              <Text style={[styles.quickAccessLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {person.username}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Messages Section Header */}
        <View style={styles.messagesSectionHeader}>
          <Text style={[styles.messagesSectionTitle, { color: colors.text }]}>Messages</Text>
          <TouchableOpacity onPress={() => setShowSearch(true)}>
            <Ionicons name="create-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Message Threads */}
        {conversations.length > 0 ? (
          conversations.map((chat) => (
            <TouchableOpacity
              key={chat.id}
              style={styles.chatItem}
              onPress={() => openChat(chat)}
            >
              <View>
                <Avatar uri={chat.user.avatar} size={52} />
                {onlineUsers.includes(chat.user.id) && (
                  <View style={[styles.onlineDot, { borderColor: colors.background }]} />
                )}
              </View>
              <View style={styles.chatContent}>
                <View style={styles.chatHeader}>
                  <Text style={[styles.chatUsername, { color: colors.text }]}>
                    {chat.user.displayName}
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
                  <View style={[styles.unreadDot, { backgroundColor: LoopsColors.color1 }]} />
                )}
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyMessages}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No messages yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Start a conversation with someone!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Search Modal */}
      <SlideRightModal visible={showSearch} onClose={() => { setShowSearch(false); setSearchQuery(''); }}>
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
            <ActivityIndicator style={{ marginTop: 40 }} color={LoopsColors.color1} />
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
      </SlideRightModal>

      {/* Chat Modal */}
      <SlideRightModal visible={!!selectedChat} onClose={() => setSelectedChat(null)}>
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
              <ActivityIndicator style={{ flex: 1 }} color={LoopsColors.color1} />
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
                      { backgroundColor: item.isMe ? LoopsColors.color1 : colors.surface }
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
                style={[styles.sendBtn, { backgroundColor: messageText.trim() ? LoopsColors.color1 : colors.surface }]}
                onPress={sendMessage}
                disabled={!messageText.trim()}
              >
                <Ionicons name="send" size={20} color={messageText.trim() ? '#fff' : colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SlideRightModal>

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
    </>
  );
};

// Play Together Tab
const PlayTogetherTab: React.FC = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Active matches
  const [activeMatches, setActiveMatches] = useState<any[]>([]);

  // Match history
  const [matchHistory, setMatchHistory] = useState<any[]>([]);

  // Games for multiplayer
  const [games, setGames] = useState<any[]>([]);

  // Direct game playing state
  const [playingGame, setPlayingGame] = useState<{ id: string; name: string; embedUrl?: string } | null>(null);
  const [gameLoaded, setGameLoaded] = useState(false);
  const gameWebViewRef = useRef<WebView>(null);
  
  // Download progress state
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  // Subscribe to download progress
  useEffect(() => {
    const unsubscribe = subscribeToProgress(setDownloadProgress);
    return unsubscribe;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [activeRes, historyRes, gamesRes] = await Promise.all([
        multiplayer.getActiveMatches().catch(() => ({ matches: [] })),
        multiplayer.getMatchHistory(20).catch(() => ({ history: [] })),
        gamesApi.multiplayer(50, 0).catch(() => ({ games: [] })),
      ]);

      setActiveMatches(activeRes.matches || []);
      setMatchHistory(historyRes.history || []);

      // Games from multiplayer endpoint are already filtered to multiplayer-only
      setGames(gamesRes.games || []);
    } catch (error) {
      console.error('Load multiplayer data error:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };
  
  // Get the game URL - uses local if downloaded, otherwise remote R2
  const getGameEmbedUrl = (game: any): string => {
    const gameId = game.id.replace('openpigeon_', '');
    return getGameUrl(gameId);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={LoopsColors.color1} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={LoopsColors.color1}
        />
      }
    >
      {/* Download Progress Banner */}
      {downloadProgress && downloadProgress.isDownloading && (
        <View style={[styles.downloadBanner, { backgroundColor: colors.surface }]}>
          <View style={styles.downloadBannerContent}>
            <ActivityIndicator size="small" color={LoopsColors.color1} />
            <View style={styles.downloadBannerText}>
              <Text style={[styles.downloadBannerTitle, { color: colors.text }]}>
                Installing games...
              </Text>
              <Text style={[styles.downloadBannerSubtitle, { color: colors.textSecondary }]}>
                {downloadProgress.currentFile} • {downloadProgress.progress}%
              </Text>
            </View>
          </View>
          <View style={styles.downloadProgressBar}>
            <View 
              style={[
                styles.downloadProgressFill, 
                { width: `${downloadProgress.progress}%`, backgroundColor: LoopsColors.color1 }
              ]} 
            />
          </View>
        </View>
      )}

      {/* Games Grid */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          🎮 Choose Your Game
        </Text>
        {games.length > 0 ? (
          <View style={styles.gamesGrid}>
            {games.map((game, index) => (
              <Animated.View
                key={game.id}
                entering={FadeInUp.delay(index * 20).springify()}
                style={styles.gameGridItem}
              >
                <TouchableOpacity
                  style={[styles.gameGridCard, { backgroundColor: colors.surface }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPlayingGame({ id: game.id, name: game.name, embedUrl: game.embedUrl });
                    setGameLoaded(false);
                  }}
                >
                  <Image
                    source={{ uri: game.thumbnail?.startsWith('http') 
                      ? game.thumbnail 
                      : (game.thumbnail ? `${GAMES_HOST}${game.thumbnail}` : `${GAMES_HOST}/thumbnails/${game.id}.png`) 
                    }}
                    style={styles.gameGridThumbnail}
                    resizeMode="cover"
                  />
                  <View style={styles.gameGridOverlay}>
                    <Text style={styles.gameGridName} numberOfLines={2}>
                      {game.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyGames}>
            <Ionicons name="game-controller-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyGamesText, { color: colors.textSecondary }]}>
              Multiplayer games coming soon!
            </Text>
            <Text style={[styles.emptyGamesSubtext, { color: colors.textSecondary }]}>
              Run the seeder to add 36 Loops games
            </Text>
          </View>
        )}
      </View>

      {/* Games Arcade Showcase */}
      <View style={styles.arcadeSection}>
        <View style={styles.arcadeHeader}>
          <Text style={[styles.arcadeTitle, { color: colors.text }]}>
            Live Arcade
          </Text>
          <Text style={[styles.arcadeSubtitle, { color: colors.textSecondary }]}>
            Jump into a lobby and challenge anyone online!
          </Text>
        </View>

        {games.length > 0 ? (
          <View style={styles.arcadeGamesGrid}>
            {games.map((game, index) => (
              <Animated.View
                key={game.id}
                entering={FadeInUp.delay(index * 20).springify()}
                style={styles.arcadeGameItem}
              >
                <TouchableOpacity
                  style={[styles.arcadeGameCard, { backgroundColor: colors.surface }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPlayingGame({ id: game.id, name: game.name, embedUrl: game.embedUrl });
                    setGameLoaded(false);
                  }}
                >
                  <Image
                    source={{
                      uri: game.thumbnail?.startsWith('http')
                        ? game.thumbnail
                        : (game.thumbnail
                          ? `https://gametok-backend-production.up.railway.app/games/thumbnails/${game.id}.png`
                          : `${GAMES_HOST}/thumbnails/${game.id}.png`)
                    }}
                    style={styles.arcadeGameThumbnail}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)', '#000']}
                    style={styles.arcadeGameOverlay}
                  >
                    <View style={styles.liveLobbyBadge}>
                      <View style={styles.pulsingDot} />
                      <Text style={styles.liveLobbyText}>Lobby</Text>
                    </View>
                    <Text style={styles.arcadeGameName} numberOfLines={2}>
                      {game.name}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyGamesLobby}>
            <ActivityIndicator color={LoopsColors.color1} size="large" />
            <Text style={[styles.emptyGamesLobbyText, { color: colors.textSecondary }]}>
              Loading Arcade...
            </Text>
          </View>
        )}
      </View>

      {/* Direct Game WebView Modal */}
      <Modal visible={!!playingGame} animationType="slide" presentationStyle="fullScreen">
        <View style={gameStyles.gameModal}>
          <StatusBar hidden />
          <WebView
            ref={gameWebViewRef}
            source={{ uri: playingGame ? getGameEmbedUrl(playingGame) : '' }}
            style={gameStyles.gameWebView}
            scrollEnabled={false}
            bounces={false}
            injectedJavaScript={GODOT_LOADER_HIDE_SCRIPT + GAME_READY_SCRIPT}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'GAME_READY') {
                  setGameLoaded(true);
                }
              } catch (e) {}
            }}
            onLoadEnd={() => {
              // Inject scripts again after load to ensure they run
              gameWebViewRef.current?.injectJavaScript(GODOT_LOADER_HIDE_SCRIPT);
            }}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={['*']}
            allowFileAccess
            allowUniversalAccessFromFileURLs
          />
          {!gameLoaded && playingGame && (
            <GameLoadingScreen
              gameName={playingGame.name}
              gameThumbnail={playingGame.embedUrl ? undefined : `${GAMES_HOST}/thumbnails/${playingGame.id}.png`}
            />
          )}
          <TouchableOpacity 
            style={[gameStyles.gameCloseBtn, { top: insets.top + 10 }]} 
            onPress={() => { setPlayingGame(null); setGameLoaded(false); }}
          >
            <BlurView intensity={80} tint="dark" style={gameStyles.gameCloseBtnBlur}>
              <Ionicons name="close" size={24} color="#fff" />
            </BlurView>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
};

const gameStyles = StyleSheet.create({
  gameModal: { flex: 1, backgroundColor: '#000' },
  gameWebView: { flex: 1 },
  gameCloseBtn: { 
    position: 'absolute', 
    right: 16, 
    zIndex: 100 
  },
  gameCloseBtnBlur: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    overflow: 'hidden' 
  },
});

export const ConnectScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const { showAuthScreen, showLoginScreen } = useAuthScreen();
  const { pendingChatUserId } = useNavigation();

  const [activeTab, setActiveTab] = useState<TabName>('messages');

  // Switch to messages tab if coming from a notification
  useEffect(() => {
    if (pendingChatUserId) {
      setActiveTab('messages');
    }
  }, [pendingChatUserId]);

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
            <Text style={styles.authSubtitle}>
              Play together and chat with friends
            </Text>
            <TouchableOpacity style={styles.authBtn} onPress={showAuthScreen}>
              <LinearGradient
                colors={[LoopsColors.color1, '#7c3aed']}
                style={styles.authBtnGradient}
              >
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
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabSwitcher, { backgroundColor: colors.surface }]}>
        <TabButton
          label="Play Together"
          icon="game-controller"
          isActive={activeTab === 'play'}
          onPress={() => setActiveTab('play')}
        />
        <TabButton
          label="Messages"
          icon="chatbubbles"
          isActive={activeTab === 'messages'}
          onPress={() => setActiveTab('messages')}
        />
      </View>

      {/* Tab Content */}
      {activeTab === 'play' ? (
        <PlayTogetherTab />
      ) : (
        <MessagesTab />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  downloadBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
  },
  downloadBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  downloadBannerText: {
    flex: 1,
  },
  downloadBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  downloadBannerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  downloadProgressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  downloadProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontWeight: '700',
    ...FontStyles.h3,
  },
  tabSwitcher: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 4,
    borderRadius: 12,
    gap: 8,
  },
  tabButton: {
    flex: 1,
  },
  tabButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  tabButtonText: {
    fontWeight: '600',
    ...FontStyles.buttonSmall,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 16,
    ...FontStyles.h4,
  },
  quickMatchRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickMatchCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  quickMatchGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quickMatchIcon: {
    marginBottom: 12,
  },
  quickMatchEmoji: {
    fontSize: 48,
  },
  quickMatchLabel: {
    fontWeight: '800',
    color: LoopsColors.white,
    marginBottom: 4,
    ...FontStyles.h3,
  },
  quickMatchSubtext: {
    color: LoopsColors.white80,
    ...FontStyles.caption,
  },
  comingSoonContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  comingSoonTitle: {
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
    ...FontStyles.h3,
  },
  comingSoonText: {
    marginTop: 8,
    textAlign: 'center',
    ...FontStyles.body,
  },
  featureList: {
    marginTop: 32,
    gap: 16,
    alignSelf: 'stretch',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    ...FontStyles.body,
  },
  authGate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  authTitle: {
    color: LoopsColors.white,
    fontWeight: '700',
    marginTop: 20,
    ...FontStyles.h2,
  },
  authSubtitle: {
    color: LoopsColors.white60,
    textAlign: 'center',
    marginTop: 8,
    ...FontStyles.body,
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
    color: LoopsColors.white,
    fontWeight: '700',
    ...FontStyles.button,
  },
  authLogin: {
    color: LoopsColors.white50,
    marginTop: 16,
    ...FontStyles.caption,
  },
  // Queue Modal
  queueModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  queueCard: {
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    minWidth: 280,
  },
  // Arcade Games UI
  arcadeSection: {
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  arcadeHeader: {
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  arcadeTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  arcadeSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  arcadeGamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  arcadeGameItem: {
    width: '50%',
    padding: 6,
  },
  arcadeGameCard: {
    aspectRatio: 0.85,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  arcadeGameThumbnail: {
    width: '100%',
    height: '100%',
  },
  arcadeGameOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'space-between',
    padding: 12,
  },
  liveLobbyBadge: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  liveLobbyText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  arcadeGameName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  emptyGamesLobby: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyGamesLobbyText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  // Challenge Cards
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 12,
  },
  challengeContent: {
    flex: 1,
  },
  challengeFrom: {
    fontWeight: '600',
    ...FontStyles.body,
  },
  challengeGame: {
    marginTop: 2,
    ...FontStyles.caption,
  },
  challengeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  challengeAccept: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeDecline: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Active Match Cards
  activeMatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  activeMatchInfo: {
    flex: 1,
  },
  activeMatchType: {
    fontWeight: '700',
    ...FontStyles.h4,
  },
  activeMatchStatus: {
    marginTop: 4,
    ...FontStyles.caption,
  },
  activeMatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LoopsColors.color1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 4,
  },
  activeMatchBtnText: {
    color: LoopsColors.white,
    fontWeight: '600',
    ...FontStyles.buttonSmall,
  },
  // Friends List
  friendsScroll: {
    paddingRight: 16,
    gap: 12,
  },
  friendCard: {
    width: 80,
  },
  friendCardInner: {
    alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SemanticColors.success,
    borderWidth: 2,
    borderColor: LoopsColors.white,
  },
  friendName: {
    marginTop: 8,
    textAlign: 'center',
    ...FontStyles.caption,
  },
  // Match History
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 12,
  },
  historyResult: {
    width: 60,
  },
  historyResultText: {
    fontWeight: '700',
    fontSize: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyOpponent: {
    fontWeight: '600',
    ...FontStyles.body,
  },
  historyGame: {
    marginTop: 2,
    ...FontStyles.caption,
  },
  historyReward: {
    alignItems: 'flex-end',
  },
  historyCoins: {
    fontWeight: '700',
    ...FontStyles.body,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
    ...FontStyles.h3,
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    ...FontStyles.body,
  },
  // Messages Tab Styles
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
    ...FontStyles.body,
  },
  // Quick Access Row (New button + recent contacts)
  quickAccessRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 16,
  },
  newMessageBtn: {
    alignItems: 'center',
    width: 64,
  },
  newMessageCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAccessItem: {
    alignItems: 'center',
    width: 64,
  },
  quickAccessLabel: {
    marginTop: 6,
    textAlign: 'center',
    ...FontStyles.caption,
    fontSize: 11,
  },
  // Messages Section Header
  messagesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messagesSectionTitle: {
    fontWeight: '600',
    fontSize: 16,
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
    marginTop: 6,
    textAlign: 'center',
    ...FontStyles.caption,
  },
  noStoryRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
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
    fontWeight: '600',
    ...FontStyles.body,
  },
  inboxSectionSubtitle: {
    marginTop: 2,
    ...FontStyles.bodySmall,
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
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontWeight: '600',
    ...FontStyles.body,
  },
  streakBadge: {
    fontSize: 12,
  },
  chatPreview: {
    marginTop: 2,
    ...FontStyles.bodySmall,
  },
  chatMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  chatTime: {
    ...FontStyles.caption,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  emptyMessages: {
    alignItems: 'center',
    paddingVertical: 60,
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
    ...FontStyles.body,
  },
  searchHint: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  searchHintText: {
    marginTop: 12,
    ...FontStyles.bodySmall,
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
    fontWeight: '600',
    ...FontStyles.body,
  },
  searchResultUsername: {
    marginTop: 2,
    ...FontStyles.caption,
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
    fontWeight: '600',
    ...FontStyles.body,
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
    ...FontStyles.body,
  },
  emptyChatHint: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyChatText: {
    ...FontStyles.body,
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
    ...FontStyles.body,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Games Grid
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gameGridItem: {
    width: '31%',
  },
  gameGridCard: {
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gameGridThumbnail: {
    width: '100%',
    height: '100%',
  },
  gameGridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  gameGridName: {
    color: LoopsColors.white,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyGames: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyGamesText: {
    marginTop: 12,
    textAlign: 'center',
    ...FontStyles.body,
  },
  emptyGamesSubtext: {
    marginTop: 4,
    textAlign: 'center',
    ...FontStyles.caption,
  },
});

export default ConnectScreen;
