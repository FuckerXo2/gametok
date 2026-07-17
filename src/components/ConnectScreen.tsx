import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { CustomImage as Image } from './CustomImage';
import Animated, { FadeInUp, FadeInRight, useSharedValue, useAnimatedStyle, withSpring, withDelay } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useAuthScreen, useNavigation, useDeepLink } from '../../App';
import { LoopsColors, SemanticColors } from '../constants/LoopsColors';
import { FontStyles } from '../constants/LoopsFonts';
import { users, messages as messagesApi, feed, stories as storiesApi, games as gamesApi, ai as aiApi } from '../services/api';
import { Avatar } from './Avatar';
import { UserProfileModal } from './UserProfileModal';
import { SlideRightModal } from './SlideRightModal';
import { StoryViewer } from './StoryViewer';
import * as ImagePicker from 'expo-image-picker';
import { resolveGameThumbnail } from '../utils/thumbnails';
const BRAND_PURPLE = '#A855F7';

const resolveSharedGameThumbnail = (thumbnail?: string | null, gameId?: string) => {
  return resolveGameThumbnail(thumbnail, gameId);
};

type InboxLane = 'chats' | 'requests' | 'activity';
type InboxMode = 'messages' | 'activity';

interface Conversation {
  id: string;
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  lastMessage?: {
    id: string;
    text: string;
    createdAt: string;
    isFromMe: boolean;
    isRead: boolean;
    isUnread: boolean;
    gameShare?: {
      id: string;
      name: string;
      thumbnail?: string;
      color?: string;
    } | null;
  };
  streak: number;
}

interface UserItem {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  isFollowing?: boolean;
  isMutual?: boolean;
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


// Relative time label for a chat row. Module-scope + pure so it stays a
// stable reference (keeps ChatRow's memoization intact).
const formatChatTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(diff / 86400000)}d`;
};

// Memoized conversation row. The inbox re-renders on every socket presence /
// typing event; without memo that re-reconciles the whole (non-virtualized)
// chat list each time — which is what made the inbox hang. With a boolean
// `isOnline` prop + a stable `onOpen`, only rows that actually changed re-render.
type ChatRowProps = {
  chat: Conversation;
  isOnline: boolean;
  animateEntry: boolean;
  entryDelay: number;
  colors: any;
  onOpen: (chat: Conversation) => void;
};
const ChatRow = React.memo(function ChatRow({ chat, isOnline, animateEntry, entryDelay, colors, onOpen }: ChatRowProps) {
  const isUnread = !!chat.lastMessage?.isUnread;
  return (
    <Animated.View entering={animateEntry ? FadeInRight.delay(entryDelay).springify().damping(18) : undefined}>
      <TouchableOpacity style={styles.chatItem} onPress={() => onOpen(chat)}>
        <View>
          <Avatar uri={chat.user.avatar} userId={chat.user.id} size={52} />
          {isOnline && <View style={[styles.onlineDot, { borderColor: colors.background }]} />}
        </View>
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={[styles.chatUsername, { color: colors.text, fontWeight: isUnread ? '700' : '600' }]}>
              {chat.user.displayName}
            </Text>
            {chat.streak > 0 && <Text style={styles.streakBadge}>🔥 {chat.streak}</Text>}
          </View>
          <Text
            style={[
              styles.chatPreview,
              { color: isUnread ? colors.text : colors.textSecondary, fontWeight: isUnread ? '600' : '400' },
            ]}
            numberOfLines={1}
          >
            {chat.lastMessage?.text || 'Start chatting'}
          </Text>
        </View>
        <View style={styles.chatMeta}>
          {chat.lastMessage && (
            <Text style={[styles.chatTime, { color: isUnread ? colors.text : colors.textSecondary, fontWeight: isUnread ? '600' : '400' }]}>
              {formatChatTime(chat.lastMessage.createdAt)}
            </Text>
          )}
          {isUnread && <View style={[styles.unreadDot, { backgroundColor: LoopsColors.color1 }]} />}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// Messages Tab
const MessagesTab: React.FC<{
  initialConversation?: Conversation | null;
  mode?: InboxMode;
  closeOnChatBack?: boolean;
  onClose?: () => void;
}> = ({ initialConversation = null, mode = 'messages', closeOnChatBack = false, onClose }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { chatSocket, onlineUsers, typingUsers, joinConversation, leaveConversation, sendTyping, stopTyping } = useSocket();
  const { openSharedGame } = useDeepLink();
  const { setActiveTab, setPendingDraftId } = useNavigation();
  const insets = useSafeAreaInsets();
  const [remixingGameId, setRemixingGameId] = useState<string | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<UserItem[]>([]);
  const [acceptingRequestIds, setAcceptingRequestIds] = useState<Set<string>>(new Set());
  const [storyUsers, setStoryUsers] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserItem[]>([]);
  const [activeLane, setActiveLane] = useState<InboxLane>(mode === 'activity' ? 'activity' : 'chats');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Chat modal state
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(initialConversation);
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
      // Guard against a request that never settles (no fetch timeout upstream) —
      // without this the whole inbox is stuck on the spinner forever. Race the
      // load against a timeout so `loading` always clears; whatever resolved by
      // then is used, the rest falls back to empty.
      const results = await Promise.race([
        Promise.all([
          messagesApi.getConversations().catch(() => ({ conversations: [] })),
          feed.activity(30).catch(() => ({ activity: [] })),
          storiesApi.list().catch(() => ({ stories: [] })),
          users.following(user?.id || '').catch(() => []),
          users.pendingRequests(user?.id || '').catch(() => []),
        ]),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
      ]);

      if (results) {
        const [convRes, activityRes, storiesRes, followingRes, requestsRes] = results;
        setConversations(Array.isArray(convRes.conversations) ? convRes.conversations : []);
        setActivity(Array.isArray(activityRes.activity) ? activityRes.activity : []);
        setStoryUsers(Array.isArray(storiesRes.stories) ? storiesRes.stories : []);

        const friends = Array.isArray(followingRes) ? followingRes : [];
        const requests = Array.isArray(requestsRes) ? requestsRes.filter((request) => !request.isMutual) : [];
        setSuggestedUsers(friends.slice(0, 6));
        setPendingRequests(requests);
      } else {
        console.warn('[Connect] inbox load timed out; showing what we have');
      }
    } catch (error) {
      console.error('Load messages data error:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Lightweight, debounced refresh of just the conversation previews — used on
  // every incoming socket message instead of reloading all 5 endpoints.
  const convRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleConversationRefresh = useCallback(() => {
    if (convRefreshTimer.current) clearTimeout(convRefreshTimer.current);
    convRefreshTimer.current = setTimeout(async () => {
      try {
        const res = await messagesApi.getConversations();
        setConversations(Array.isArray(res.conversations) ? res.conversations : []);
      } catch (e) {
        console.warn('[Connect] conversation refresh failed', e);
      }
    }, 600);
  }, []);
  useEffect(() => () => {
    if (convRefreshTimer.current) clearTimeout(convRefreshTimer.current);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setActiveLane(mode === 'activity' ? 'activity' : 'chats');
  }, [mode]);

  // Socket.io messaging listener - real-time messages
  useEffect(() => {
    if (!chatSocket) return;

    const handleNewMessage = ({ conversationId, message }: any) => {
      // If we're in this conversation, add the message — but guard against
      // duplicates (our own optimistic add + the server echoing it back).
      if (selectedChat && (selectedChat.id === conversationId || selectedChat.user.id === message.senderId)) {
        setChatMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, {
            id: message.id,
            text: message.text,
            createdAt: message.createdAt,
            isMe: message.senderId === user?.id,
            isRead: false,
            gameShare: message.gameShare || null
          }];
        });
      }
      // Refresh just the conversation previews (debounced), not all 5 endpoints.
      scheduleConversationRefresh();
    };

    const handleMessagesRead = ({ conversationId, messageIds }: any) => {
      if (selectedChat && selectedChat.id === conversationId) {
        setChatMessages(prev => prev.map(msg => 
          messageIds.includes(msg.id) ? { ...msg, isRead: true } : msg
        ));
      }
    };

    chatSocket.on('chat:new_message', handleNewMessage);
    chatSocket.on('chat:messages_read', handleMessagesRead);

    return () => {
      chatSocket.off('chat:new_message', handleNewMessage);
      chatSocket.off('chat:messages_read', handleMessagesRead);
    };
  }, [chatSocket, selectedChat, user?.id, scheduleConversationRefresh]);

  // Join/leave conversation room when chat opens/closes
  useEffect(() => {
    if (selectedChat && chatSocket) {
      joinConversation(selectedChat.id);
      return () => {
        leaveConversation(selectedChat.id);
      };
    }
  }, [selectedChat, chatSocket, joinConversation, leaveConversation]);

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
      } catch (e) {
        console.warn('[Connect] user search failed', e);
        setSearchResults([]);
      }
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
    } catch (e) {
      console.warn('[Connect] open chat failed', e);
    }
    setLoadingChat(false);
  };

  // Stable reference for the memoized ChatRow (openChat is recreated each render).
  const openChatRef = useRef(openChat);
  openChatRef.current = openChat;
  const handleOpenChat = useCallback((c: Conversation) => openChatRef.current(c), []);

  // Start (or resume) a DM with a user we may not have a conversation with yet —
  // used by the "new chat" / search flow. The endpoint creates the conversation
  // if needed and returns it fully-formed.
  const openChatWithUser = async (person: UserItem) => {
    try {
      const data = await messagesApi.getConversation(person.id);
      const conv = data?.conversation;
      openChat({
        id: conv?.id ?? person.id,
        user: {
          id: person.id,
          username: person.username,
          displayName: person.displayName || conv?.user?.display_name || conv?.user?.displayName,
          avatar: person.avatar ?? conv?.user?.avatar,
        },
        streak: conv?.streak ?? 0,
      });
    } catch (e) {
      console.warn('[Connect] start chat failed', e);
    }
  };

  // Message list is rendered inverted, so reverse once here instead of
  // rebuilding the array for every row (that was an O(n²) hang on long chats).
  const reversedMessages = useMemo(() => [...chatMessages].reverse(), [chatMessages]);

  // Play a game shared inside a DM — close the inbox, jump to the feed, and
  // hand the game id to the player via the shared-game deep link.
  const handlePlayShared = (gameId?: string) => {
    if (!gameId) return;
    onClose?.();
    setActiveTab('home');
    openSharedGame(gameId);
  };

  // Remix a shared game: resolve its AI source id from the game record, kick off
  // a remix draft, then drop the user straight into the create/edit flow.
  const handleRemixShared = async (gameId?: string) => {
    if (!gameId || remixingGameId) return;
    setRemixingGameId(gameId);
    try {
      const detail = await gamesApi.get(gameId);
      const game = detail?.game || detail;
      const embed: string | undefined = game?.embedUrl || game?.embed_url;
      const sourceId = embed?.split('/api/ai/play/')[1]?.split(/[?#]/)[0];
      if (!sourceId) {
        Alert.alert('Remix unavailable', "This game can't be remixed.");
        return;
      }
      const res = await aiApi.remixGame(sourceId);
      if (res?.draftId) {
        onClose?.();
        setPendingDraftId(res.draftId);
        setActiveTab('create');
      } else {
        Alert.alert('Remix failed', res?.error || "Couldn't remix this game.");
      }
    } catch (e: any) {
      Alert.alert('Remix failed', e?.message || String(e));
    } finally {
      setRemixingGameId(null);
    }
  };

  const closeChat = () => {
    if (closeOnChatBack && selectedChat) {
      onClose?.();
      return;
    }
    setSelectedChat(null);
  };

  useEffect(() => {
    if (!initialConversation) return;
    openChat(initialConversation);
  }, [initialConversation?.id]);

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedChat) return;
    const text = messageText.trim();
    setMessageText('');
    
    // Stop typing indicator when sending
    stopTyping(selectedChat.id);
    
    try {
      const data = await messagesApi.send({ recipientId: selectedChat.user.id, text });
      setChatMessages(prev => (prev.some(m => m.id === data.message?.id) ? prev : [...prev, data.message]));
      scheduleConversationRefresh();
    } catch (e) {
      setMessageText(text);
    }
  };

  // Handle typing in the input
  const handleTextChange = (text: string) => {
    setMessageText(text);
    if (selectedChat && text.length > 0) {
      sendTyping(selectedChat.id);
    } else if (selectedChat) {
      stopTyping(selectedChat.id);
    }
  };

  const openUserProfile = (userItem: UserItem) => {
    setSelectedUser(userItem);
    setShowUserProfile(true);
  };

  const handleRequestAction = async (person: UserItem) => {
    if (acceptingRequestIds.has(person.id)) return;
    setAcceptingRequestIds((prev) => new Set([...prev, person.id]));
    try {
      if (!person.isMutual) {
        await users.acceptRequest(person.id);
      }
      setPendingRequests((prev) => prev.filter((item) => item.id !== person.id));
      const existingConvo = conversations.find((c) => c.user.id === person.id);
      if (existingConvo) {
        openChat(existingConvo);
      }
    } catch (e) {
      console.log('Request action error:', e);
    } finally {
      setAcceptingRequestIds((prev) => {
        const next = new Set(prev);
        next.delete(person.id);
        return next;
      });
    }
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

  const getActivityCopy = (item: ActivityItem) => {
    const actor = item.user.displayName || item.user.username;
    switch (item.type) {
      case 'follow':
        return `${actor} followed you`;
      case 'like':
        return item.game?.name ? `${actor} liked ${item.game.name}` : `${actor} liked your game`;
      case 'comment':
        return item.text || `${actor} left a comment`;
      case 'score':
        return item.score != null && item.game?.name
          ? `${actor} scored ${item.score} on ${item.game.name}`
          : `${actor} posted a new score`;
      case 'playing':
        return item.game?.name ? `${actor} is playing ${item.game.name}` : `${actor} is playing right now`;
      default:
        return `${actor} did something new`;
    }
  };

  // Only block on the list load when there's no chat already open. A direct
  // chat (opened from a conversation tap or notification) must render its own
  // modal immediately instead of waiting behind the inbox list's 5 fetches.
  if (loading && !selectedChat) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={LoopsColors.color1} size="large" />
      </View>
    );
  }

  const inboxLanes = mode === 'activity'
    ? [{ key: 'activity' as InboxLane, label: 'Activity', count: activity.length }]
    : [
        { key: 'chats' as InboxLane, label: 'Chats', count: conversations.length },
        { key: 'requests' as InboxLane, label: 'Requests', count: pendingRequests.length },
      ];
  const showLaneSwitcher = inboxLanes.length > 1;

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
        {mode === 'messages' ? (
          <Animated.View entering={FadeInRight.delay(50).springify().damping(18)}>
            <TouchableOpacity
              style={[styles.searchBar, { backgroundColor: colors.surface }]}
              onPress={() => setShowSearch(true)}
            >
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <Text style={[styles.searchPlaceholder, { color: colors.textSecondary }]}>Search people and chats</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {showLaneSwitcher ? (
          <Animated.View entering={FadeInRight.delay(100).springify().damping(18)} style={styles.inboxLaneWrap}>
            <View style={[styles.inboxLaneBar, { backgroundColor: colors.surface }]}>
              {inboxLanes.map((lane) => {
                const active = activeLane === lane.key;
                return (
                  <TouchableOpacity
                    key={lane.key}
                    style={[
                      styles.inboxLanePill,
                      active && { backgroundColor: LoopsColors.color1 },
                    ]}
                    onPress={() => setActiveLane(lane.key)}
                  >
                    <Text style={[styles.inboxLaneText, { color: active ? '#fff' : colors.textSecondary }]}>
                      {lane.label}
                    </Text>
                    {lane.count > 0 && (
                      <View style={[styles.inboxLaneBadge, { backgroundColor: active ? 'rgba(255,255,255,0.2)' : 'rgba(168,85,247,0.18)' }]}>
                        <Text style={[styles.inboxLaneBadgeText, { color: active ? '#fff' : LoopsColors.color1 }]}>
                          {lane.count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        ) : null}

        {activeLane === 'chats' && (
          <>
            <Animated.View entering={FadeInRight.delay(120).springify().damping(18)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickAccessRow}
              >
                <TouchableOpacity style={styles.newMessageBtn} onPress={() => setShowSearch(true)}>
                  <View style={[styles.newMessageCircle, { backgroundColor: colors.surface }]}>
                    <Ionicons name="create-outline" size={24} color={LoopsColors.color1} />
                  </View>
                  <Text style={[styles.quickAccessLabel, { color: colors.text }]}>New</Text>
                </TouchableOpacity>

                {suggestedUsers.map((person) => (
                  <TouchableOpacity
                    key={person.id}
                    style={styles.quickAccessItem}
                    onPress={() => {
                      const existingConvo = conversations.find((c) => c.user.id === person.id);
                      if (existingConvo) openChat(existingConvo);
                      else {
                        openChat({
                          id: `new-${person.id}`,
                          user: person,
                          streak: 0,
                        });
                      }
                    }}
                  >
                    <Avatar uri={person.avatar} userId={person.id} size={56} />
                    <Text style={[styles.quickAccessLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                      {person.username}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>

            <Animated.View entering={FadeInRight.delay(150).springify().damping(18)} style={styles.messagesSectionHeader}>
              <Text style={[styles.messagesSectionTitle, { color: colors.text }]}>Recent chats</Text>
              <TouchableOpacity onPress={() => setShowSearch(true)}>
                <Ionicons name="create-outline" size={22} color={colors.text} />
              </TouchableOpacity>
            </Animated.View>

            {conversations.length > 0 ? (
              conversations.map((chat, index) => (
                <ChatRow
                  key={chat.id}
                  chat={chat}
                  isOnline={onlineUsers.includes(chat.user.id)}
                  animateEntry={index < 8}
                  entryDelay={200 + index * 50}
                  colors={colors}
                  onOpen={handleOpenChat}
                />
              ))
            ) : (
              <Animated.View entering={FadeInRight.delay(200).springify().damping(18)} style={styles.emptyMessages}>
                <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No chats yet</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Start a conversation with someone from your circle.
                </Text>
              </Animated.View>
            )}
          </>
        )}

        {activeLane === 'requests' && (
          <>
            <Animated.View entering={FadeInRight.delay(120).springify().damping(18)} style={styles.messagesSectionHeader}>
              <Text style={[styles.messagesSectionTitle, { color: colors.text }]}>Friend requests</Text>
              <TouchableOpacity onPress={() => setShowSearch(true)}>
                <Ionicons name="person-add-outline" size={22} color={colors.text} />
              </TouchableOpacity>
            </Animated.View>

            {pendingRequests.length > 0 ? (
              pendingRequests.map((person, index) => {
                const accepting = acceptingRequestIds.has(person.id);
                return (
                  <Animated.View
                    key={person.id}
                    entering={index < 8 ? FadeInRight.delay(180 + index * 45).springify().damping(18) : undefined}
                  >
                    <View style={styles.requestRow}>
                      <TouchableOpacity style={styles.requestIdentity} onPress={() => openUserProfile(person)}>
                        <Avatar uri={person.avatar} userId={person.id} size={52} />
                        <View style={styles.requestCopy}>
                          <Text style={[styles.chatUsername, { color: colors.text }]}>
                            {person.displayName || person.username}
                          </Text>
                          <Text style={[styles.requestSubtitle, { color: colors.textSecondary }]}>
                            wants to connect and play together
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.requestAction, { backgroundColor: LoopsColors.color1, opacity: accepting ? 0.7 : 1 }]}
                        onPress={() => handleRequestAction(person)}
                        disabled={accepting}
                      >
                        {accepting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.requestActionText}>Accept</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                );
              })
            ) : (
              <Animated.View entering={FadeInRight.delay(180).springify().damping(18)} style={styles.emptyMessages}>
                <Ionicons name="mail-open-outline" size={64} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No requests waiting</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  New follows and friend requests will land here.
                </Text>
              </Animated.View>
            )}
          </>
        )}

        {activeLane === 'activity' && (
          <>
            <Animated.View entering={FadeInRight.delay(120).springify().damping(18)} style={styles.messagesSectionHeader}>
              <Text style={[styles.messagesSectionTitle, { color: colors.text }]}>Recent activity</Text>
              <TouchableOpacity onPress={handleRefresh}>
                <Ionicons name="refresh" size={20} color={colors.text} />
              </TouchableOpacity>
            </Animated.View>

            {activity.length > 0 ? (
              activity.map((item, index) => (
                <Animated.View
                  key={item.id}
                  entering={index < 10 ? FadeInRight.delay(180 + index * 40).springify().damping(18) : undefined}
                >
                  <TouchableOpacity style={styles.activityRow} onPress={() => openUserProfile(item.user)}>
                    <Avatar uri={item.user.avatar} userId={item.user.id} size={48} />
                    <View style={styles.activityCopy}>
                      <Text style={[styles.activityTitle, { color: colors.text }]}>
                        {getActivityCopy(item)}
                      </Text>
                      <Text style={[styles.activityMeta, { color: colors.textSecondary }]}>
                        {formatTime(item.createdAt)}
                        {item.game?.name ? ` · ${item.game.name}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </Animated.View>
              ))
            ) : (
              <Animated.View entering={FadeInRight.delay(180).springify().damping(18)} style={styles.emptyMessages}>
                <Ionicons name="pulse-outline" size={64} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing new yet</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Likes, plays, follows, and score moments will show up here.
                </Text>
              </Animated.View>
            )}
          </>
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
                  onPress={() => { setShowSearch(false); setSearchQuery(''); openChatWithUser(item); }}
                >
                  <Avatar uri={item.avatar} userId={item.id} size={48} />
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
      <SlideRightModal visible={!!selectedChat} onClose={closeChat} instant={closeOnChatBack}>
        {selectedChat && (
          <KeyboardAvoidingView 
            style={[styles.chatModal, { paddingTop: insets.top, backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <View style={[styles.chatModalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={closeChat}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chatModalUser}
                onPress={() => openUserProfile(selectedChat.user)}
              >
                <Avatar uri={selectedChat.user.avatar} userId={selectedChat.user.id} size={48} />
                <View>
                  <Text style={[styles.chatModalUsername, { color: colors.text }]}>
                    {selectedChat.user.displayName || selectedChat.user.username}
                  </Text>
                  {typingUsers.get(selectedChat.id) === selectedChat.user.id && (
                    <Text style={[styles.typingIndicator, { color: LoopsColors.color1 }]}>
                      typing...
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
              <View style={{ width: 24 }} />
            </View>

            {loadingChat ? (
              <ActivityIndicator style={{ flex: 1 }} color={LoopsColors.color1} />
            ) : (
              <FlatList
                data={reversedMessages}
                keyExtractor={(item) => item.id}
                style={styles.chatMessagesList}
                contentContainerStyle={{ padding: 16, flexGrow: 1 }}
                inverted
                renderItem={({ item, index }) => {
                  const cleanText = item.text?.replace(/\[(?:GAME|CHALLENGE):[^\]]+\]\s*/, '') || '';
                  const hasGameShare = !!item.gameShare;
                  const thumbUri = resolveSharedGameThumbnail(item.gameShare?.thumbnail, item.gameShare?.id);

                  // Message grouping - check if previous message (in reversed order) is from same person
                  const prevMsg = reversedMessages[index + 1];
                  const nextMsg = reversedMessages[index - 1];
                  const isFirstInGroup = !prevMsg || prevMsg.isMe !== item.isMe;
                  const isLastInGroup = !nextMsg || nextMsg.isMe !== item.isMe;
                  
                  // Format timestamp
                  const msgTime = new Date(item.createdAt);
                  const timeStr = msgTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  if (hasGameShare) {
                    return (
                      <View style={[
                        { maxWidth: '70%', marginBottom: isLastInGroup ? 12 : 2 },
                        item.isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }
                      ]}>
                        <Pressable
                          onPress={() => handlePlayShared(item.gameShare.id)}
                          style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: item.gameShare.color || '#333' }}
                        >
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
                          </View>
                        </Pressable>
                        {/* Play / Remix actions */}
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            onPress={() => handlePlayShared(item.gameShare.id)}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 12, backgroundColor: LoopsColors.color1 }}
                          >
                            <Ionicons name="play" size={15} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Play</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleRemixShared(item.gameShare.id)}
                            disabled={remixingGameId === item.gameShare.id}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                          >
                            {remixingGameId === item.gameShare.id ? (
                              <ActivityIndicator size="small" color={colors.text} />
                            ) : (
                              <>
                                <Ionicons name="git-branch" size={15} color={colors.text} />
                                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Remix</Text>
                              </>
                            )}
                          </TouchableOpacity>
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
                      { marginBottom: isLastInGroup ? 12 : 2 },
                      item.isMe ? { alignSelf: 'flex-end', alignItems: 'flex-end' } : { alignSelf: 'flex-start', alignItems: 'flex-start' }
                    ]}>
                      <View style={[
                        styles.messageBubble,
                        item.isMe ? styles.myMessage : styles.theirMessage,
                        { backgroundColor: item.isMe ? colors.surface : colors.surface }
                      ]}>
                        <Text style={[styles.messageText, { color: colors.text }]}>
                          {cleanText}
                        </Text>
                      </View>
                      {/* Timestamp + read receipt on last message in group */}
                      {isLastInGroup && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                          <Text style={{ fontSize: 11, color: colors.textSecondary }}>{timeStr}</Text>
                          {item.isMe && (
                            <Ionicons 
                              name={item.isRead ? "checkmark-done" : "checkmark"} 
                              size={14} 
                              color={item.isRead ? LoopsColors.color1 : colors.textSecondary} 
                            />
                          )}
                        </View>
                      )}
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
                  onChangeText={handleTextChange}
                  onSubmitEditing={sendMessage}
                  returnKeyType="send"
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
          </KeyboardAvoidingView>
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
interface FollowingUser {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  verified?: boolean;
}


// ─────────────────────────────────────────────────────────────────────────────
// V2 Connect screen — pixel-faithful to mockups
// ─────────────────────────────────────────────────────────────────────────────

type ConnectFilter = 'foryou';

const CONNECT_PURPLE = '#a855f7';
const CONNECT_BG = '#000000';
const CONNECT_TEXT_MUTED = '#9a9aa8';

export const ConnectScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const { showAuthScreen, showLoginScreen } = useAuthScreen();
  const { presenceMap } = useSocket();
  const { setActiveTab, activeTab, pendingChatUserId, setPendingChatUserId, activityRequestNonce } = useNavigation();
  const { openSharedGame } = useDeepLink();

  const [filter, setFilter] = useState<ConnectFilter>('foryou');
  const [following, setFollowing] = useState<any[]>([]);
  const [recommended, setRecommended] = useState<any[]>([]);
  const [trendingGames, setTrendingGames] = useState<any[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [storyUsers, setStoryUsers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showFriendsPlaying, setShowFriendsPlaying] = useState(false);
  const [inboxMode, setInboxMode] = useState<InboxMode>('messages');
  const [inboxInitialChat, setInboxInitialChat] = useState<Conversation | null>(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserItem[]>([]);
  const [searching, setSearching] = useState(false);

  const loadConnectData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [followingRes, recommendedRes, trendingRes, convRes, storiesRes] = await Promise.allSettled([
        users.following(user.id),
        users.recommended(),
        gamesApi.list(24, 0, { sort: 'trending' }).catch(() => ({ games: [] })),
        messagesApi.getConversations().catch(() => ({ conversations: [] })),
        storiesApi.list().catch(() => ({ stories: [] })),
      ]);

      if (followingRes.status === 'fulfilled') {
        setFollowing(followingRes.value?.users || followingRes.value?.following || []);
      }
      if (recommendedRes.status === 'fulfilled') {
        setRecommended(recommendedRes.value?.users || []);
      }
      if (trendingRes.status === 'fulfilled') {
        setTrendingGames(trendingRes.value?.games || []);
      }
      if (convRes.status === 'fulfilled') {
        setConversations(Array.isArray(convRes.value?.conversations) ? convRes.value.conversations : []);
      }
      if (storiesRes.status === 'fulfilled') {
        setStoryUsers(Array.isArray(storiesRes.value?.stories) ? storiesRes.value.stories : []);
      }
    } catch (err) {
      console.log('[Connect] load failed', err);
    }
  }, [user?.id]);

  useEffect(() => {
    loadConnectData();
  }, [loadConnectData]);

  // Refresh when the user opens the Connect tab so DMs / stories / friends
  // aren't stale (the screen stays mounted, so it otherwise only loads once).
  useEffect(() => {
    if (activeTab === 'connect') loadConnectData();
  }, [activeTab, loadConnectData]);

  // Deep-link from a message notification: open the inbox straight into the
  // sender's DM. Prefer an already-loaded conversation; otherwise resolve it
  // by userId (the endpoint creates the conversation if it doesn't exist yet).
  useEffect(() => {
    if (!pendingChatUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const existing = conversations.find((c) => c.user.id === pendingChatUserId);
        if (existing) {
          setInboxMode('messages');
          setInboxInitialChat(existing);
          setShowInbox(true);
          return;
        }
        const data = await messagesApi.getConversation(pendingChatUserId);
        if (cancelled) return;
        const conv = data?.conversation;
        if (conv?.id) {
          setInboxMode('messages');
          setInboxInitialChat({
            id: conv.id,
            user: {
              id: conv.user?.id ?? pendingChatUserId,
              username: conv.user?.username ?? '',
              displayName: conv.user?.display_name ?? conv.user?.displayName,
              avatar: conv.user?.avatar,
            },
            streak: conv.streak ?? 0,
          });
          setShowInbox(true);
        }
      } catch (e) {
        console.log('[Connect] deep-link chat open failed', e);
      } finally {
        if (!cancelled) setPendingChatUserId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingChatUserId]);

  // Deep-link from a follow / social notification: open the Activity feed.
  useEffect(() => {
    if (!activityRequestNonce) return;
    setInboxMode('activity');
    setInboxInitialChat(null);
    setShowInbox(true);
  }, [activityRequestNonce]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const data = await users.search(query);
        if (!cancelled) {
          setSearchResults(Array.isArray(data?.users) ? data.users : []);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadConnectData();
    setRefreshing(false);
  };

  // Auth gate
  if (!isAuthenticated) {
    return (
      <View style={[connectV3Styles.root, { paddingTop: insets.top }]}>
        <View style={[connectV3Styles.topBar, { paddingTop: 0 }]}>
          <View style={connectV3Styles.topIconBtn} />
          <Text style={connectV3Styles.topTitle}>gametok</Text>
          <View style={connectV3Styles.topIconBtn} />
        </View>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.authGate}>
            <Ionicons name="people" size={64} color="rgba(255,255,255,0.3)" />
            <Text style={styles.authTitle}>Join the community</Text>
            <Text style={styles.authSubtitle}>Play together and chat with friends</Text>
            <TouchableOpacity style={styles.authBtn} onPress={showAuthScreen}>
              <LinearGradient colors={[CONNECT_PURPLE, '#7c3aed']} style={styles.authBtnGradient}>
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

  // Build segments for filter tabs
  const allOnline = following.filter((f) => {
    const s = presenceMap.get(f.id);
    return s === 'online' || s === 'in-game';
  });
  const liveFriend = following.find((f) => presenceMap.get(f.id) === 'in-game');
  const peopleForStories = following.length > 0 ? following : recommended;

  return (
    <View style={connectV3Styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />
        }
      >
        {/* Top bar */}
        <View style={[connectV3Styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable
            style={connectV3Styles.topAvatarWrap}
            onPress={() => setActiveTab('profile')}
            hitSlop={6}
          >
            <Avatar uri={user?.avatar} userId={user?.id} size={32} />
          </Pressable>
          <Text style={connectV3Styles.topTitle}>gametok</Text>
          <Pressable
            style={connectV3Styles.topIconBtn}
            onPress={() => {
              setInboxMode('activity');
              setInboxInitialChat(null);
              setShowInbox(true);
            }}
            hitSlop={6}
          >
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            {conversations.some((c) => c.lastMessage?.isUnread) ? (
              <View style={connectV3Styles.bellDot} />
            ) : null}
          </Pressable>
        </View>

        <Animated.View entering={FadeInRight.delay(50).springify().damping(18)}>
          <TouchableOpacity
            style={[styles.searchBar, { backgroundColor: colors.surface }]}
            onPress={() => setShowSearch(true)}
          >
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <Text style={[styles.searchPlaceholder, { color: colors.textSecondary }]}>Search people and chats</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Stories row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={connectV3Styles.storiesScroll}
        >
          {peopleForStories.slice(0, 12).map((u) => {
            const status = presenceMap.get(u.id);
            const statusLabel =
              status === 'in-game' ? 'In a game' : status === 'online' ? 'Online' : null;
            return (
              <Pressable
                key={u.id}
                style={connectV3Styles.storyCol}
                onPress={() => setSelectedProfileUser(u)}
              >
                <View style={connectV3Styles.storyRing}>
                  <View style={connectV3Styles.storyAvatarFrame}>
                    <Avatar uri={u.avatar} userId={u.id} size={56} />
                  </View>
                  {(status === 'online' || status === 'in-game') ? (
                    <View
                      style={[
                        connectV3Styles.storyDot,
                        status === 'in-game' && { backgroundColor: CONNECT_PURPLE },
                      ]}
                    />
                  ) : null}
                </View>
                <Text style={connectV3Styles.storyName} numberOfLines={1}>
                  {u.displayName || u.username}
                </Text>
                <Text style={connectV3Styles.storyStatus} numberOfLines={1}>
                  {statusLabel || ''}
                </Text>
              </Pressable>
            );
          })}

          {allOnline.length > 12 ? (
            <View style={connectV3Styles.storyCol}>
              <View style={[connectV3Styles.storyAddRing, { backgroundColor: 'rgba(255,255,255,0.06)', borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={connectV3Styles.storyMoreText}>+{allOnline.length - 12}</Text>
              </View>
              <Text style={connectV3Styles.storyName} numberOfLines={1}>+{allOnline.length - 12}</Text>
              <Text style={connectV3Styles.storyStatus}>Online</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* LIVE NOW big card */}
        {liveFriend && trendingGames[0] ? (
          <Pressable
            style={connectV3Styles.liveCard}
            onPress={() => {
              if (trendingGames[0]) {
                openSharedGame(trendingGames[0].id);
                setActiveTab('home');
              }
            }}
          >
            <Image
              source={{
                uri: resolveSharedGameThumbnail(trendingGames[0]?.thumbnail, trendingGames[0]?.id) || '',
              }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={connectV3Styles.liveBadgeWrap}>
              <View style={connectV3Styles.liveBadge}>
                <View style={connectV3Styles.liveBadgeDot} />
                <Text style={connectV3Styles.liveBadgeText}>LIVE NOW</Text>
              </View>
            </View>
            <View style={connectV3Styles.liveBody}>
              <Text style={connectV3Styles.liveTitle} numberOfLines={1}>
                {trendingGames[0]?.name || liveFriend.displayName || liveFriend.username}
              </Text>
              <Text style={connectV3Styles.liveSubtitle}>Custom Room</Text>
              <View style={connectV3Styles.liveBottomRow}>
                <View style={connectV3Styles.liveAvatarStack}>
                  {[liveFriend, ...allOnline.filter((o) => o.id !== liveFriend.id)].slice(0, 3).map((u, i) => (
                    <View
                      key={u.id}
                      style={[connectV3Styles.liveStackAvatar, { marginLeft: i === 0 ? 0 : -10 }]}
                    >
                      <Avatar uri={u.avatar} userId={u.id} size={24} />
                    </View>
                  ))}
                </View>
                <View style={{ flex: 1 }} />
                <Pressable
                  style={connectV3Styles.joinBtn}
                  onPress={() => {
                    if (trendingGames[0]) {
                      openSharedGame(trendingGames[0].id);
                      setActiveTab('home');
                    }
                  }}
                >
                  <Text style={connectV3Styles.joinBtnText}>Join</Text>
                </Pressable>
                <View style={connectV3Styles.liveCapacity}>
                  <Ionicons name="people" size={11} color="#fff" />
                  <Text style={connectV3Styles.liveCapacityText}>
                    {Math.min(allOnline.length + 1, 8)}/8
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        ) : (
          <View style={connectV3Styles.liveCardEmpty}>
            <View style={connectV3Styles.liveCardEmptyDot} />
            <Text style={connectV3Styles.liveCardEmptyTitle}>
              {allOnline.length > 0
                ? `${allOnline.length} ${allOnline.length === 1 ? 'friend is' : 'friends are'} online`
                : 'No friends online yet'}
            </Text>
            <Text style={connectV3Styles.liveCardEmptyBody}>
              We'll show a LIVE banner here when someone you follow is in-game.
            </Text>
          </View>
        )}

        {/* Friends are playing — 3-col grid */}
        <View style={connectV3Styles.section}>
          <View style={connectV3Styles.sectionHeader}>
            <Text style={connectV3Styles.sectionTitle}>Friends are playing</Text>
            <Pressable hitSlop={8} onPress={() => setShowFriendsPlaying(true)}>
              <Text style={connectV3Styles.sectionSeeAll}>See all</Text>
            </Pressable>
          </View>
          {trendingGames.length === 0 ? (
            <Text style={connectV3Styles.sectionEmpty}>No games trending right now.</Text>
          ) : (
            <View style={connectV3Styles.friendsGrid}>
              {trendingGames.slice(0, 3).map((g) => (
                <Pressable
                  key={g.id}
                  style={connectV3Styles.friendsCard}
                  onPress={() => {
                    openSharedGame(g.id);
                    setActiveTab('home');
                  }}
                >
                  {g.thumbnail ? (
                    <Image
                      source={{ uri: resolveSharedGameThumbnail(g.thumbnail, g.id) || '' }}
                      style={StyleSheet.absoluteFillObject}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1a1a22' }]} />
                  )}
                  <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
                    locations={[0, 0.45, 1]}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={connectV3Styles.friendsCardBody}>
                    <Text style={connectV3Styles.friendsCardTitle} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <View style={connectV3Styles.friendsCardMeta}>
                      <View style={connectV3Styles.friendsAvatarStack}>
                        {following.slice(0, 2).map((u, i) => (
                          <View
                            key={u.id}
                            style={[connectV3Styles.friendsStackAvatar, { marginLeft: i === 0 ? 0 : -6 }]}
                          >
                            <Avatar uri={u.avatar} userId={u.id} size={13} />
                          </View>
                        ))}
                      </View>
                      <Text style={connectV3Styles.friendsCount}>
                        {following.length > 0 ? `${Math.min(following.length, 9)} friends` : 'Trending'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Active Conversations preview */}
        <View style={connectV3Styles.section}>
          <View style={connectV3Styles.sectionHeader}>
            <Text style={connectV3Styles.sectionTitle}>Active Conversations</Text>
            <Pressable
              hitSlop={8}
              onPress={() => {
                setInboxMode('messages');
                setInboxInitialChat(null);
                setShowInbox(true);
              }}
            >
              <Text style={connectV3Styles.sectionSeeAll}>See all</Text>
            </Pressable>
          </View>
          {conversations.length === 0 ? (
            <Pressable
              style={connectV3Styles.convoEmpty}
              onPress={() => {
                setInboxMode('messages');
                setInboxInitialChat(null);
                setShowInbox(true);
              }}
            >
              <Ionicons name="chatbubble-outline" size={18} color={CONNECT_TEXT_MUTED} />
              <Text style={connectV3Styles.convoEmptyText}>
                No active chats yet — tap to start one.
              </Text>
            </Pressable>
          ) : (
            conversations.slice(0, 4).map((c) => {
              const last = c.lastMessage;
              const time = last ? formatRelativeTime(last.createdAt) : '';
              const unreadCount = last?.isUnread && !last?.isFromMe ? 1 : 0;
              const status = presenceMap.get(c.user.id);
              return (
                <Pressable
                  key={c.id}
                  style={connectV3Styles.convoRow}
                  onPress={() => {
                    setInboxMode('messages');
                    setInboxInitialChat(c);
                    setShowInbox(true);
                  }}
                >
                  <View style={connectV3Styles.convoAvatarWrap}>
                    <Avatar uri={c.user.avatar} userId={c.user.id} size={46} />
                    {(status === 'online' || status === 'in-game') ? (
                      <View
                        style={[
                          connectV3Styles.convoStatus,
                          status === 'in-game' && { backgroundColor: CONNECT_PURPLE },
                        ]}
                      />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={connectV3Styles.convoName} numberOfLines={1}>
                      {c.user.displayName || c.user.username}
                    </Text>
                    <Text style={connectV3Styles.convoLast} numberOfLines={1}>
                      {last?.text || 'Tap to message'}
                    </Text>
                  </View>
                  <View style={connectV3Styles.convoMeta}>
                    <Text style={connectV3Styles.convoTime}>{time}</Text>
                    {unreadCount > 0 ? (
                      <View style={connectV3Styles.convoBadge}>
                        <Text style={connectV3Styles.convoBadgeText}>{unreadCount}</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* User profile modal */}
      <UserProfileModal
        visible={!!selectedProfileUser}
        onClose={() => setSelectedProfileUser(null)}
        user={selectedProfileUser}
      />

      <SlideRightModal visible={showFriendsPlaying} onClose={() => setShowFriendsPlaying(false)}>
        <View style={[connectV3Styles.fullListModal, { paddingTop: insets.top }]}>
          <View style={connectV3Styles.fullListHeader}>
            <TouchableOpacity onPress={() => setShowFriendsPlaying(false)} style={connectV3Styles.fullListBackBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={connectV3Styles.fullListTitle}>Friends are playing</Text>
            <View style={connectV3Styles.fullListBackBtn} />
          </View>

          {trendingGames.length === 0 ? (
            <View style={connectV3Styles.fullListEmpty}>
              <Ionicons name="game-controller-outline" size={48} color={CONNECT_TEXT_MUTED} />
              <Text style={connectV3Styles.fullListEmptyText}>No games trending right now.</Text>
            </View>
          ) : (
            <FlatList
              data={trendingGames}
              keyExtractor={(item) => item.id}
              contentContainerStyle={connectV3Styles.fullListContent}
              renderItem={({ item }) => (
                <Pressable
                  style={connectV3Styles.fullListRow}
                  onPress={() => {
                    setShowFriendsPlaying(false);
                    openSharedGame(item.id);
                    setActiveTab('home');
                  }}
                >
                  <View style={connectV3Styles.fullListThumb}>
                    {item.thumbnail ? (
                      <Image
                        source={{ uri: resolveSharedGameThumbnail(item.thumbnail, item.id) || '' }}
                        style={StyleSheet.absoluteFillObject}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1a1a22' }]} />
                    )}
                  </View>
                  <View style={connectV3Styles.fullListCopy}>
                    <Text style={connectV3Styles.fullListGameTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={connectV3Styles.fullListGameMeta} numberOfLines={1}>
                      {following.length > 0 ? `${Math.min(following.length, 9)} friends` : 'Trending'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={CONNECT_TEXT_MUTED} />
                </Pressable>
              )}
            />
          )}
        </View>
      </SlideRightModal>

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
                  onPress={() => {
                    setShowSearch(false);
                    setSearchQuery('');
                    setSelectedProfileUser(item);
                  }}
                >
                  <Avatar uri={item.avatar} userId={item.id} size={48} />
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

      {/* Inbox modal — shows the existing MessagesTab */}
      {showInbox ? (
        <View style={connectV3Styles.inboxOverlay}>
          <View style={[connectV3Styles.inboxCard, { paddingTop: insets.top + 8 }]}>
            <View style={connectV3Styles.inboxHeader}>
              <Pressable
                onPress={() => {
                  setShowInbox(false);
                  setInboxInitialChat(null);
                }}
                hitSlop={8}
                style={connectV3Styles.topIconBtn}
              >
                <Ionicons name="chevron-back" size={20} color="#fff" />
              </Pressable>
              <Text style={connectV3Styles.topTitle}>
                {inboxMode === 'activity' ? 'Activity' : 'Inbox'}
              </Text>
              <Pressable
                onPress={() => {
                  setShowInbox(false);
                  setInboxInitialChat(null);
                  setActiveTab('profile');
                }}
                hitSlop={8}
                style={connectV3Styles.topAvatarWrap}
              >
                <Avatar uri={user?.avatar} userId={user?.id} size={36} />
              </Pressable>
            </View>
            <MessagesTab
              initialConversation={inboxInitialChat}
              mode={inboxMode}
              closeOnChatBack={!!inboxInitialChat}
              onClose={() => {
                setShowInbox(false);
                setInboxInitialChat(null);
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
};

const formatRelativeTime = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(diff / 86400000)}d`;
};

const connectV3Styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CONNECT_BG,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  topAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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
  bellDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  topTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
    justifyContent: 'center',
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filterPillActive: {
    backgroundColor: CONNECT_PURPLE,
  },
  filterText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  filterTextActive: {
    color: '#fff',
  },
  storiesScroll: {
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  storyCol: {
    width: 72,
    alignItems: 'center',
  },
  storyAddRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(168,85,247,0.10)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(168,85,247,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  storyRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: 6,
    position: 'relative',
  },
  storyAvatarFrame: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
  },
  storyAvatarImg: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  storyAvatarFallback: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatarInitial: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 17,
  },
  storyDot: {
    position: 'absolute',
    right: 0,
    bottom: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: CONNECT_BG,
  },
  storyMoreText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  storyName: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  storyStatus: {
    color: CONNECT_TEXT_MUTED,
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
    height: 12,
  },
  liveCard: {
    marginHorizontal: 16,
    marginTop: 18,
    height: 200,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0e0e14',
  },
  liveBadgeWrap: {
    position: 'absolute',
    top: 14,
    left: 14,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#ec4899',
  },
  liveBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  liveBody: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  liveTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  liveSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
  },
  liveBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  liveAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveStackAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#000',
  },
  joinBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CONNECT_PURPLE,
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  liveCapacity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  liveCapacityText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  liveCardEmpty: {
    marginHorizontal: 16,
    marginTop: 18,
    padding: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  liveCardEmptyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginBottom: 8,
  },
  liveCardEmptyTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  liveCardEmptyBody: {
    color: CONNECT_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  section: {
    marginTop: 22,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  sectionSeeAll: {
    color: CONNECT_PURPLE,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionEmpty: {
    color: CONNECT_TEXT_MUTED,
    fontSize: 13,
    paddingVertical: 18,
  },
  friendsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  friendsCard: {
    flex: 1,
    aspectRatio: 0.78,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a1a22',
  },
  friendsCardBody: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
  },
  friendsCardTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  friendsCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  friendsAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendsStackAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  friendsCount: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 9,
    fontWeight: '700',
  },
  fullListModal: {
    flex: 1,
    backgroundColor: CONNECT_BG,
  },
  fullListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  fullListBackBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullListTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  fullListContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 36,
  },
  fullListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  fullListThumb: {
    width: 72,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1a1a22',
  },
  fullListCopy: {
    flex: 1,
    minWidth: 0,
  },
  fullListGameTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  fullListGameMeta: {
    color: CONNECT_TEXT_MUTED,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  fullListEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  fullListEmptyText: {
    color: CONNECT_TEXT_MUTED,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  convoEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  convoEmptyText: {
    color: CONNECT_TEXT_MUTED,
    fontSize: 13,
    fontWeight: '500',
  },
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  convoAvatarWrap: {
    position: 'relative',
  },
  convoAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
  },
  convoStatus: {
    position: 'absolute',
    right: 0,
    bottom: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: CONNECT_BG,
  },
  convoName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  convoLast: {
    color: CONNECT_TEXT_MUTED,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  convoMeta: {
    alignItems: 'flex-end',
    gap: 5,
  },
  convoTime: {
    color: CONNECT_TEXT_MUTED,
    fontSize: 11,
    fontWeight: '500',
  },
  convoBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: CONNECT_PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convoBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  inboxOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CONNECT_BG,
    zIndex: 100,
  },
  inboxCard: {
    flex: 1,
    backgroundColor: CONNECT_BG,
  },
  inboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
});

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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 100,
  },
  illustrationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    height: 120,
  },
  avatarCircle: {
    width: 80,
    height: 80,
  },
  avatarLeft: {
    marginRight: -15,
    zIndex: 1,
  },
  avatarRight: {
    marginLeft: -15,
    zIndex: 1,
  },
  avatarInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trophyContainer: {
    zIndex: 2,
    marginTop: -40,
  },
  trophyEmoji: {
    fontSize: 40,
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    marginBottom: 20,
    gap: 6,
  },
  comingSoonBadgeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  notifyPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 24,
    gap: 10,
  },
  notifyPromptText: {
    fontSize: 14,
  },
  comingSoonTitle: {
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
    ...FontStyles.h2,
  },
  comingSoonText: {
    marginTop: 8,
    textAlign: 'center',
    ...FontStyles.body,
    lineHeight: 22,
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
  inboxLaneWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  inboxLaneBar: {
    flexDirection: 'row',
    borderRadius: 18,
    padding: 4,
    gap: 8,
  },
  inboxLanePill: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  inboxLaneText: {
    fontSize: 14,
    fontWeight: '700',
  },
  inboxLaneBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  inboxLaneBadgeText: {
    fontSize: 11,
    fontWeight: '800',
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
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  requestIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestCopy: {
    flex: 1,
  },
  requestSubtitle: {
    marginTop: 2,
    ...FontStyles.bodySmall,
  },
  requestAction: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  requestActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  playLockWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  playLockCard: {
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
  },
  playLockBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  playLockBadgeText: {
    color: '#F6D58C',
    fontSize: 13,
    fontWeight: '700',
  },
  playLockTitle: {
    marginTop: 18,
    color: '#FFF',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  playLockBody: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.74)',
    fontSize: 16,
    lineHeight: 24,
  },
  playLockFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
  },
  playLockFeaturePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  playLockFeatureText: {
    color: '#F5F3FF',
    fontSize: 13,
    fontWeight: '600',
  },
  playLockFooter: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playLockFooterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A855F7',
  },
  playLockFooterText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  activityCopy: {
    flex: 1,
  },
  activityTitle: {
    fontWeight: '600',
    ...FontStyles.body,
  },
  activityMeta: {
    marginTop: 3,
    ...FontStyles.caption,
  },
  emptyMessages: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 28,
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
  typingIndicator: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
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
