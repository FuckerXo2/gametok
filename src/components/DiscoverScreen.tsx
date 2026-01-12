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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { users, messages as messagesApi, feed } from '../services/api';
import { UserProfileModal } from './UserProfileModal';
import { Avatar } from './Avatar';
import { GameSearchModal } from './GameSearchModal';
import { FriendRequestsScreen } from './FriendRequestsScreen';
import { ShareProfileCard } from './ShareProfileCard';

const GAMES_HOST = 'https://gametok-games.pages.dev';

// Game thumbnails - actual game screenshots
const GAME_THUMBNAILS: Record<string, string> = {
  '2048': `${GAMES_HOST}/thumbnails/2048.png`,
  '2048-v2': `${GAMES_HOST}/thumbnails/2048-v2.png`,
  'tetris': `${GAMES_HOST}/thumbnails/tetris.png`,
  'hextris': `${GAMES_HOST}/thumbnails/hextris-v2.png`,
  'hextris-v2': `${GAMES_HOST}/thumbnails/hextris-v2.png`,
  'pacman': `${GAMES_HOST}/thumbnails/pacman.png`,
  'snake-io': `${GAMES_HOST}/thumbnails/snake-io.png`,
  'flappy-bird': `${GAMES_HOST}/thumbnails/flappy-bird.png`,
  'doodle-jump': `${GAMES_HOST}/thumbnails/doodle-jump.png`,
  'breakout': `${GAMES_HOST}/thumbnails/breakout.png`,
  'pong': `${GAMES_HOST}/thumbnails/pong.png`,
  'space-invaders': `${GAMES_HOST}/thumbnails/space-invaders.png`,
  'fruit-slicer': `${GAMES_HOST}/thumbnails/fruit-slicer.png`,
  'geometry-dash': `${GAMES_HOST}/thumbnails/geometry-dash.png`,
  'crossy-road': `${GAMES_HOST}/thumbnails/crossy-road.png`,
  'piano-tiles': `${GAMES_HOST}/thumbnails/piano-tiles.png`,
  'memory-match': `${GAMES_HOST}/thumbnails/memory-match.png`,
  'tic-tac-toe': `${GAMES_HOST}/thumbnails/tic-tac-toe.png`,
  'connect4': `${GAMES_HOST}/thumbnails/connect4.png`,
  'bubble-pop': `${GAMES_HOST}/thumbnails/bubble-pop.png`,
  'ball-bounce': `${GAMES_HOST}/thumbnails/ball-bounce.png`,
  'basketball-3d': `${GAMES_HOST}/thumbnails/basketball-3d.png`,
  'block-blast': `${GAMES_HOST}/thumbnails/block-blast.png`,
  'color-match': `${GAMES_HOST}/thumbnails/color-match.png`,
  'simon-says': `${GAMES_HOST}/thumbnails/simon-says.png`,
  'number-tap': `${GAMES_HOST}/thumbnails/number-tap.png`,
  'tower-blocks-3d': `${GAMES_HOST}/thumbnails/tower-blocks-3d.png`,
  'asteroids': `${GAMES_HOST}/thumbnails/asteroids.png`,
  'whack-a-mole': `${GAMES_HOST}/thumbnails/whack-a-mole.png`,
  'aim-trainer': `${GAMES_HOST}/thumbnails/aim-trainer.png`,
  'racer': `${GAMES_HOST}/thumbnails/racer.png`,
  'hyperspace': `${GAMES_HOST}/thumbnails/hyperspace.png`,
  'towermaster': `${GAMES_HOST}/thumbnails/towermaster.png`,
  'chess': `${GAMES_HOST}/thumbnails/chess.png`,
  'rock-paper-scissors': `${GAMES_HOST}/thumbnails/rock-paper-scissors.png`,
  'tap-tap-dash': `${GAMES_HOST}/thumbnails/tap-tap-dash.png`,
  'basketball': `${GAMES_HOST}/thumbnails/basketball.png`,
  'stack-ball': `${GAMES_HOST}/thumbnails/ball-bounce.png`, // fallback
};

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

interface Follower {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  isMe: boolean;
  createdAt: string;
}

interface ChatUser {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

interface FriendActivity {
  id: string;
  type: string;
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  game: {
    id: string;
    name: string;
    icon: string;
    thumbnail?: string;
    color?: string;
  };
  score: number;
  createdAt: string;
}

interface PlayingGame {
  id: string;
  name: string;
  icon: string;
  thumbnail?: string;
  color?: string;
}

// Game Icon component - shows actual game screenshot
const GameIcon: React.FC<{ gameId: string; color?: string; size?: number }> = ({ 
  gameId, color = '#FF8E53', size = 52 
}) => {
  const [imageError, setImageError] = useState(false);
  const thumbnailUrl = GAME_THUMBNAILS[gameId];
  
  if (thumbnailUrl && !imageError) {
    return (
      <Image 
        source={{ uri: thumbnailUrl }}
        style={{ 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          backgroundColor: '#1a1a2e',
        }}
        resizeMode="cover"
        onError={() => setImageError(true)}
      />
    );
  }
  
  // Fallback - simple colored circle with initial
  const initial = gameId.split('-')[0].charAt(0).toUpperCase();
  return (
    <View style={{ 
      width: size, 
      height: size, 
      borderRadius: size / 2, 
      backgroundColor: color,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: '#fff' }}>{initial}</Text>
    </View>
  );
};

const SUGGESTED_FRIENDS: any[] = [];

export const DiscoverScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const gameWebViewRef = useRef<WebView>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedUsers, setAddedUsers] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showGameSearch, setShowGameSearch] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [followedBack, setFollowedBack] = useState<Set<string>>(new Set());
  
  // Friends activity state
  const [friendsActivity, setFriendsActivity] = useState<FriendActivity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [isGlobalActivity, setIsGlobalActivity] = useState(false);
  
  // Chat modal state
  const [chatUser, setChatUser] = useState<ChatUser | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Game modal state
  const [playingGame, setPlayingGame] = useState<PlayingGame | null>(null);
  const [gameLoaded, setGameLoaded] = useState(false);

  // Fetch friends activity (recent scores) - falls back to global if no friends activity
  const fetchFriendsActivity = useCallback(async () => {
    if (!isAuthenticated) {
      // Not logged in - show empty
      setFriendsActivity([]);
      setIsGlobalActivity(true);
      setLoadingActivity(false);
      return;
    }
    try {
      const data = await feed.activity(10);
      if (data.activity && data.activity.length > 0) {
        setFriendsActivity(data.activity);
        setIsGlobalActivity(false);
      } else {
        // No friends activity, fetch global
        const globalData = await feed.global(10);
        if (globalData.activity && globalData.activity.length > 0) {
          setFriendsActivity(globalData.activity);
        } else {
          // No global activity either, show empty
          setFriendsActivity([]);
        }
        setIsGlobalActivity(true);
      }
    } catch (error) {
      console.log('Failed to fetch friends activity:', error);
      // Try global as fallback
      try {
        const globalData = await feed.global(10);
        if (globalData.activity && globalData.activity.length > 0) {
          setFriendsActivity(globalData.activity);
        } else {
          setFriendsActivity([]);
        }
        setIsGlobalActivity(true);
      } catch (e) {
        console.log('Failed to fetch global activity:', e);
        setFriendsActivity([]);
        setIsGlobalActivity(true);
      }
    } finally {
      setLoadingActivity(false);
    }
  }, [isAuthenticated]);

  // Fetch pending requests (people who added you but you haven't added back)
  const fetchFollowers = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const [requestsData, countData] = await Promise.all([
        users.pendingRequests(user.id),
        users.pendingCount(user.id)
      ]);
      setFollowers(Array.isArray(requestsData) ? requestsData : []);
      setPendingCount(countData.count || 0);
    } catch (error) {
      console.log('Failed to fetch pending requests:', error);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    fetchFollowers();
    fetchFriendsActivity();
  }, [fetchFollowers, fetchFriendsActivity]);

  // Format time ago
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'yesterday';
    return `${days}d ago`;
  };

  // Open chat with a user
  const openChat = async (chatUserData: ChatUser) => {
    setChatUser(chatUserData);
    setLoadingChat(true);
    setChatMessages([]);
    setShowRequests(false); // Close friend requests screen
    
    try {
      const data = await messagesApi.getConversation(chatUserData.id);
      setChatMessages(data.messages || []);
    } catch (error) {
      console.log('Failed to load chat:', error);
    } finally {
      setLoadingChat(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !chatUser || sendingMessage) return;
    
    setSendingMessage(true);
    const text = messageText.trim();
    setMessageText('');
    
    try {
      const data = await messagesApi.send({
        recipientId: chatUser.id,
        text,
      });
      
      setChatMessages(prev => [...prev, data.message]);
    } catch (error) {
      console.log('Failed to send message:', error);
      setMessageText(text);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFollowBack = async (userId: string) => {
    try {
      await users.follow(userId);
      setFollowedBack(prev => new Set([...prev, userId]));
    } catch (error) {
      console.log('Follow back error:', error);
    }
  };

  const handleFriendStatusChange = (userId: string, isFriend: boolean) => {
    if (isFriend) {
      setAddedUsers(prev => new Set([...prev, userId]));
    } else {
      setAddedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const openUserProfile = (user: { id: string; name: string; avatar: string | null; reason?: string; online: boolean }) => {
    setSelectedUser({
      id: user.id,
      username: user.name,
      avatar: user.avatar,
      status: user.reason || 'RECENTLY JOINED',
      isOnline: user.online,
      isFriend: false,
    });
    setShowUserProfile(true);
  };

  // Search when query changes
  useEffect(() => {
    const search = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const data = await users.search(searchQuery.trim());
        setSearchResults(data.users || []);
      } catch (error) {
        console.log('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleAdd = async (userId: string) => {
    try {
      await users.follow(userId);
      setAddedUsers(prev => new Set([...prev, userId]));
    } catch (error) {
      console.log('Follow error:', error);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Find Friends</Text>
          <TouchableOpacity onPress={() => setShowAddOptions(true)}>
            <Ionicons name="person-add-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by username"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); Keyboard.dismiss(); }}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Results */}
        {searchQuery.length >= 2 ? (
          <View style={styles.searchResults}>
            {isSearching ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : searchResults.length === 0 ? (
            <Text style={[styles.noResults, { color: colors.textSecondary }]}>
              No users found for "{searchQuery}"
            </Text>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.userRow, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setSelectedUser({
                      id: item.id,
                      username: item.username,
                      displayName: item.displayName,
                      avatar: item.avatar,
                      status: 'GAMETOK USER',
                      isOnline: false,
                      isFriend: addedUsers.has(item.id),
                    });
                    setShowUserProfile(true);
                  }}
                >
                  <Avatar uri={item.avatar} size={48} style={styles.userAvatar} />
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>
                      {item.displayName || item.username}
                    </Text>
                    <Text style={[styles.userHandle, { color: colors.textSecondary }]}>
                      @{item.username}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.addBtn,
                      addedUsers.has(item.id)
                        ? { backgroundColor: colors.surface }
                        : { backgroundColor: colors.primary }
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (!addedUsers.has(item.id)) handleAdd(item.id);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {addedUsers.has(item.id) ? (
                      <Ionicons name="checkmark" size={18} color={colors.textSecondary} />
                    ) : (
                      <Text style={styles.addBtnText}>Add</Text>
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Friend Requests Row - same style as Inbox activity */}
          <TouchableOpacity 
            style={[styles.activityRow, { borderBottomColor: colors.border }]}
            onPress={() => setShowRequests(true)}
          >
            <View style={[styles.activityIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="people" size={20} color="#fff" />
            </View>
            <View style={styles.activityContent}>
              <Text style={[styles.activityTitle, { color: colors.text }]}>Friend Requests</Text>
              {pendingCount > 0 && (
                <Text style={[styles.activityPreview, { color: colors.textSecondary }]} numberOfLines={1}>
                  You have new requests
                </Text>
              )}
            </View>
            {pendingCount > 0 && (
              <View style={[styles.activityBadge, { backgroundColor: '#FF3B30' }]}>
                <Text style={styles.activityBadgeText}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Activity Feed - Clean rows */}
          {loadingActivity ? (
            <ActivityIndicator style={{ marginVertical: 30 }} color={colors.primary} />
          ) : friendsActivity.length > 0 ? (
            friendsActivity.slice(0, 6).map((item) => {
              const isRecent = (new Date().getTime() - new Date(item.createdAt).getTime()) < 300000; // 5 mins
              return (
                <TouchableOpacity 
                  key={item.id} 
                  style={[styles.activityRow, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    openChat({
                      id: item.user.id,
                      username: item.user.username,
                      displayName: item.user.displayName,
                      avatar: item.user.avatar,
                    });
                  }}
                >
                  <Avatar uri={item.user.avatar} size={48} />
                  <View style={styles.activityRowContent}>
                    <Text style={[styles.activityRowName, { color: colors.text }]}>
                      {item.user.displayName || item.user.username}
                    </Text>
                    <Text style={[styles.activityRowStatus, { color: colors.textSecondary }]}>
                      {isRecent ? 'playing' : `played ${formatTimeAgo(item.createdAt)}`} · {item.game.name}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.activityRowGame}
                    onPress={(e) => {
                      e.stopPropagation();
                      setPlayingGame({
                        id: item.game.id,
                        name: item.game.name,
                        icon: item.game.icon,
                        thumbnail: item.game.thumbnail,
                        color: item.game.color,
                      });
                    }}
                  >
                    <View style={styles.gameThumbWrapper}>
                      <GameIcon 
                        gameId={item.game.id} 
                        color={item.game.color} 
                        size={52}
                      />
                      {isRecent && <View style={styles.liveIndicator} />}
                    </View>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          ) : null}

          {/* Suggested Friends */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Suggested</Text>
            {SUGGESTED_FRIENDS.map((friend) => (
              <TouchableOpacity 
                key={friend.id} 
                style={[styles.friendRow, { borderBottomColor: colors.border }]}
                onPress={() => openUserProfile(friend)}
              >
                <View style={styles.friendLeft}>
                  <View style={styles.friendAvatarWrap}>
                    <Avatar uri={friend.avatar} size={48} />
                    {friend.online && <View style={styles.onlineDot} />}
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={[styles.friendName, { color: colors.text }]}>{friend.name}</Text>
                    <Text style={[styles.friendReason, { color: colors.textSecondary }]}>
                      {friend.reason}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.addFriendBtn, { backgroundColor: colors.primary }]}>
                  <Ionicons name="person-add" size={18} color="#fff" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* User Profile Modal */}
      <UserProfileModal
        visible={showUserProfile}
        onClose={() => setShowUserProfile(false)}
        user={selectedUser}
        onFriendStatusChange={handleFriendStatusChange}
      />

      {/* Game Search Modal */}
      <GameSearchModal
        visible={showGameSearch}
        onClose={() => setShowGameSearch(false)}
        onSelectGame={() => setShowGameSearch(false)}
      />

      {/* Friend Requests Screen */}
      {showRequests && (
        <View style={StyleSheet.absoluteFill}>
          <FriendRequestsScreen
            visible={showRequests}
            onClose={() => {
              setShowRequests(false);
              fetchFollowers(); // Refresh count when closing
            }}
            onOpenChat={openChat}
          />
        </View>
      )}

      {/* Chat Modal */}
      <Modal
        visible={chatUser !== null}
        animationType="slide"
        onRequestClose={() => setChatUser(null)}
      >
        {chatUser && (
          <View style={[styles.chatModal, { paddingTop: insets.top, backgroundColor: colors.background }]}>
            {/* Chat Header */}
            <View style={[styles.chatModalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setChatUser(null)}>
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.chatModalUser}>
                <Avatar uri={chatUser.avatar} size={40} />
                <Text style={[styles.chatModalUsername, { color: colors.text }]}>
                  {chatUser.displayName || chatUser.username}
                </Text>
              </View>
              <View style={{ width: 28 }} />
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
                renderItem={({ item }) => (
                  <View style={[
                    item.isMe ? styles.sentBubble : styles.receivedBubble,
                    { backgroundColor: item.isMe ? colors.primary : colors.surface }
                  ]}>
                    <Text style={[styles.bubbleText, { color: item.isMe ? '#fff' : colors.text }]}>
                      {item.text}
                    </Text>
                  </View>
                )}
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
              <View style={[styles.chatInputBox, { backgroundColor: colors.surface }]}>
                <TextInput
                  style={[styles.chatInput, { color: colors.text }]}
                  placeholder="Send a message"
                  placeholderTextColor={colors.textSecondary}
                  value={messageText}
                  onChangeText={setMessageText}
                  onSubmitEditing={sendMessage}
                  returnKeyType="send"
                />
              </View>
              <TouchableOpacity 
                style={styles.chatSendBtn} 
                onPress={sendMessage}
                disabled={!messageText.trim() || sendingMessage}
              >
                <Ionicons 
                  name="send" 
                  size={24} 
                  color={messageText.trim() ? colors.primary : colors.textSecondary} 
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
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
              source={{ uri: playingGame.embedUrl 
                ? `${playingGame.embedUrl}?gd_sdk_referrer_url=${encodeURIComponent(GAMES_HOST)}`
                : `${GAMES_HOST}/${playingGame.id}/` 
              }}
              style={styles.gameWebView}
              scrollEnabled={false}
              bounces={false}
              onLoadEnd={() => {
                setGameLoaded(true);
                gameWebViewRef.current?.injectJavaScript(`
                  if (window.startGame) window.startGame();
                  if (window.start) window.start();
                  true;
                `);
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
              onPress={() => {
                setPlayingGame(null);
                setGameLoaded(false);
              }}
            >
              <BlurView intensity={50} tint="dark" style={styles.gameCloseBtnBlur}>
                <Ionicons name="close" size={24} color="#fff" />
              </BlurView>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      {/* Share Profile Card */}
      <ShareProfileCard
        visible={showAddOptions}
        onClose={() => setShowAddOptions(false)}
      />
      </View>
    </TouchableWithoutFeedback>
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
    fontSize: 24,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
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
  activityBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  activityBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  browseGamesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 14,
    borderRadius: 14,
  },
  browseGamesIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  browseGamesText: {
    flex: 1,
  },
  browseGamesTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  browseGamesSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loader: {
    marginTop: 40,
  },
  noResults: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarEmoji: {
    fontSize: 24,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
  },
  userHandle: {
    fontSize: 13,
    marginTop: 1,
  },
  addBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  // Activity Row Styles (clean, minimal)
  activityRowContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityRowName: {
    fontSize: 15,
    fontWeight: '600',
  },
  activityRowStatus: {
    fontSize: 13,
    marginTop: 2,
  },
  activityRowGame: {
    position: 'relative',
  },
  gameThumbWrapper: {
    position: 'relative',
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'visible',
  },
  gameThumbCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameIconEmoji: {
    fontSize: 20,
  },
  liveIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#000',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  friendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  friendEmoji: {
    fontSize: 24,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#fff',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '600',
  },
  friendReason: {
    fontSize: 13,
    marginTop: 1,
  },
  addFriendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  addedBackBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  addBackBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Add Options Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 34,
    paddingHorizontal: 16,
  },
  optionsHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(128,128,128,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Chat Modal Styles
  chatModal: {
    flex: 1,
  },
  chatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  chatModalUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatModalUsername: {
    fontSize: 16,
    fontWeight: '600',
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
    gap: 8,
  },
  sentBubble: {
    alignSelf: 'flex-end',
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    alignSelf: 'flex-start',
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
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
  chatInputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
    gap: 10,
  },
  chatInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  chatInput: {
    flex: 1,
    fontSize: 16,
  },
  chatSendBtn: {
    padding: 4,
  },
  // Game Modal Styles
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
