import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  ImageBackground,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  StatusBar,
  Share,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { messages as messagesApi, users, moderation, feed, games as gamesApi, stories as storiesApi } from '../services/api';
import { Avatar } from './Avatar';
import { ReportModal } from './ReportModal';
import { FollowListModal } from './FollowListModal';
import { SlideRightModal } from './SlideRightModal';
import { AnimatedButton } from './AnimatedButton';
import { useAuth } from '../context/AuthContext';

interface UserProfile {
  id: string;
  username: string;
  displayName?: string;
  avatar: string | null;
  bio?: string;
  status: string;
  isOnline: boolean;
  isFriend: boolean;
}

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onFriendStatusChange?: (userId: string, isFriend: boolean) => void;
}

interface ChatMessage {
  id: string;
  text: string;
  isMe: boolean;
  createdAt: string;
  gameShare?: {
    id: string;
    name: string;
    thumbnail?: string;
    icon?: string;
    color?: string;
  };
}

const GAMES_HOST = 'https://games.gametok.co';

const SUGGESTED_FRIENDS: any[] = [];
const PROFILE_GRID_GAP = 2;
const PROFILE_GRID_SIZE = (Dimensions.get('window').width - PROFILE_GRID_GAP * 4) / 3;

const formatCompactNumber = (value?: number | null) => {
  if (typeof value !== 'number') return '—';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ visible, onClose, user, onFriendStatusChange }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user: currentUser } = useAuth();
  const [isAdded, setIsAdded] = useState(user?.isFriend ?? false);
  const [isMutual, setIsMutual] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [userStats, setUserStats] = useState<{ followers: number; following: number; level: number; streak: number } | null>(null);
  const [userGames, setUserGames] = useState<any[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(true);
  const [followModalConfig, setFollowModalConfig] = useState<{ visible: boolean, tab: 'followers' | 'following' }>({ visible: false, tab: 'followers' });
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [nestedUser, setNestedUser] = useState<any>(null);

  const [playingGame, setPlayingGame] = useState<any | null>(null);
  const [gameLoaded, setGameLoaded] = useState(false);

  const isCurrentMe = currentUser?.id === user?.id;

  // Update isAdded when user changes or modal opens
  React.useEffect(() => {
    if (user) {
      setIsAdded(user.isFriend);
      setIsMutual(false);
      setLoadingFollow(true);
    }
  }, [user?.id, user?.isFriend, visible]);

  // Fetch real user stats when modal opens
  React.useEffect(() => {
    if (visible && user?.id) {
      setUserStats(null);
      users.get(user.id).then((res: any) => {
        if (res?.stats) {
          setUserStats({
            followers: res.stats.followers || 0,
            following: res.stats.following || 0,
            level: res.stats.level || 1,
            streak: res.stats.streak || 0,
          });
        }
        // Update follow status from backend
        if (res?.isFollowing !== undefined) {
          setIsAdded(res.isFollowing);
          setIsMutual(res.isMutual || false);
        }
      }).catch(() => { }).finally(() => setLoadingFollow(false));

      setLoadingGames(true);
      import('../services/api').then(({ likes }) => {
        likes.userLikes(user.id).then((res: any) => {
          if (res?.games) {
            setUserGames(res.games);
          }
        }).catch(() => { }).finally(() => setLoadingGames(false));
      });
    }
  }, [visible, user?.id]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleReport = () => {
    setShowReportModal(true);
  };

  const handleBlock = () => {
    setShowBlockConfirm(true);
  };

  const shareProfile = async () => {
    if (!user) return;
    try {
      await Share.share({
        message: `Check out @${user.username} on GameTok: https://games.gametok.co/u/${user.username}`,
      });
    } catch (error) {
      console.log('Failed to share profile:', error);
    }
  };

  const confirmBlockAction = async () => {
    try {
      await moderation.block(user!.id);
      setShowBlockConfirm(false);
      onClose();
    } catch (error: any) {
      console.log('Failed to block user:', error);
      setShowBlockConfirm(false);
    }
  };

  const showOptions = () => {
    setShowOptionsModal(true);
  };

  if (!user) return null;

  const handleAdd = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      const result = await users.follow(user.id);
      setIsAdded(result.following);
      setIsMutual(result.isMutual || false);

      // Update follower count visually
      if (userStats) {
        // If we just followed them (and weren't before), add 1. If we unfollowed, subtract 1.
        if (result.following && !isAdded) {
          setUserStats({ ...userStats, followers: userStats.followers + 1 });
        } else if (!result.following && isAdded) {
          setUserStats({ ...userStats, followers: Math.max(0, userStats.followers - 1) });
        }
      }

      // Notify parent component of the change
      onFriendStatusChange?.(user.id, result.following);
    } catch (error) {
      console.log('Follow/unfollow error:', error);
    } finally {
      setIsToggling(false);
    }
  };

  const openChat = async () => {
    setShowChat(true);
    setLoadingChat(true);
    try {
      const data = await messagesApi.getConversation(user.id);
      setChatMessages(data.messages || []);
    } catch (error) {
      console.log('Failed to load chat:', error);
    } finally {
      setLoadingChat(false);
    }
  };

  const closeChat = () => {
    setShowChat(false);
    setChatMessages([]);
    setMessageText('');
  };

  const sendMessage = async () => {
    if (!messageText.trim() || sendingMessage) return;

    setSendingMessage(true);
    const text = messageText.trim();
    setMessageText('');

    try {
      const data = await messagesApi.send({
        recipientId: user.id,
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

  // Chat Modal
  if (showChat) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={closeChat}>
        <KeyboardAvoidingView
          style={[styles.chatContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Chat Header */}
          <View style={[styles.chatHeader, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={closeChat}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.chatHeaderUser}>
              <Avatar uri={user.avatar} size={36} style={styles.chatHeaderAvatar} />
              <Text style={[styles.chatHeaderUsername, { color: colors.text }]}>
                {user.displayName || user.username}
              </Text>
            </View>
            <TouchableOpacity>
              <Ionicons name="call-outline" size={24} color={colors.text} />
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
              renderItem={({ item }) => {
                const cleanText = item.text?.replace(/\[(?:GAME|CHALLENGE):[^\]]+\]\s*/, '') || '';
                const hasGameShare = !!(item as any).gameShare;
                const gameShare = (item as any).gameShare;
                const thumbUri = gameShare?.thumbnail
                  ? (gameShare.thumbnail.startsWith('http') ? gameShare.thumbnail : `${GAMES_HOST}${gameShare.thumbnail}`)
                  : null;

                if (hasGameShare) {
                  return (
                    <View style={[
                      { maxWidth: '70%', marginBottom: 10 },
                      item.isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }
                    ]}>
                      <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: gameShare.color || '#333' }}>
                        {thumbUri ? (
                          <Image
                            source={{ uri: thumbUri }}
                            style={{ width: '100%', aspectRatio: 1, backgroundColor: gameShare.color || '#333' } as any}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={{ width: '100%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: gameShare.color || '#333' }}>
                            <Ionicons name="game-controller" size={40} color="rgba(255,255,255,0.5)" />
                          </View>
                        )}
                        <View style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          paddingHorizontal: 12, paddingVertical: 10,
                          backgroundColor: 'rgba(0,0,0,0.55)',
                        }}>
                          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                            {gameShare.name}
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
                    item.isMe ? styles.sentBubble : styles.receivedBubble,
                    { backgroundColor: item.isMe ? colors.primary : colors.surface }
                  ]}>
                    <Text style={[styles.bubbleText, { color: item.isMe ? '#fff' : colors.text }]}>
                      {cleanText}
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
            <View style={[styles.chatInputBox, { backgroundColor: colors.surface }]}>
              <TextInput
                style={[styles.chatInput, { color: colors.text }]}
                placeholder="Send a message..."
                placeholderTextColor={colors.textSecondary}
                value={messageText}
                onChangeText={setMessageText}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
              />
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.primary }]}
              onPress={sendMessage}
              disabled={!messageText.trim() || sendingMessage}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <SlideRightModal visible={visible} onClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.profileShell, { paddingTop: insets.top + 10 }]}>
            <View style={styles.profileTopBar}>
              <TouchableOpacity style={[styles.topIconButton, { backgroundColor: colors.surface }]} onPress={onClose} activeOpacity={0.85}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.topUsername, { color: colors.text }]}>@{user.username}</Text>
              <TouchableOpacity style={[styles.topIconButton, { backgroundColor: colors.surface }]} onPress={showOptions} activeOpacity={0.85}>
                <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.heroCard}>
              <LinearGradient
                colors={isDark ? ['rgba(168,85,247,0.18)', 'rgba(0,229,255,0.08)', 'rgba(255,255,255,0.02)'] : ['rgba(168,85,247,0.16)', 'rgba(0,229,255,0.12)', 'rgba(0,0,0,0.03)']}
                style={[styles.heroGlow, { borderColor: colors.border }]}
              >
                <View style={[styles.orbLarge, { backgroundColor: isDark ? 'rgba(168,85,247,0.14)' : 'rgba(168,85,247,0.12)' }]} />
                <View style={[styles.orbSmall, { backgroundColor: isDark ? 'rgba(37,244,238,0.1)' : 'rgba(37,244,238,0.14)' }]} />
                <View style={[styles.heroNoiseLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />

                <View style={styles.avatarHitbox}>
                  <View style={[styles.avatarRing, { borderColor: colors.primary }]}>
                    <Avatar uri={user.avatar} size={98} />
                  </View>
                  {user.isOnline && <View style={styles.onlineDot} />}
                </View>

                <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
                  {user.displayName || user.username}
                </Text>
                <Text style={[styles.handleText, { color: colors.textSecondary }]}>@{user.username}</Text>
                <Text style={[styles.bioText, { color: user.bio ? colors.text : colors.textSecondary }]} numberOfLines={3}>
                  {user.bio || 'GameTok player with strange taste and a sharp scroll instinct.'}
                </Text>

                <View style={[styles.vibeRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderColor: colors.border }]}>
                  <View style={[styles.vibeChip, { backgroundColor: 'rgba(255,214,10,0.14)' }]}>
                    <Ionicons name="trophy-outline" size={13} color="#ffd60a" />
                    <Text style={[styles.vibeChipText, { color: colors.text }]}>Level {userStats?.level ?? 1}</Text>
                  </View>
                  <View style={[styles.vibeChip, { backgroundColor: 'rgba(249,115,22,0.16)' }]}>
                    <Ionicons name="flame-outline" size={13} color="#f97316" />
                    <Text style={[styles.vibeChipText, { color: colors.text }]}>{userStats?.streak ?? 0} day streak</Text>
                  </View>
                </View>

                <View style={[styles.statsRow, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.5)' }]}>
                  <TouchableOpacity style={styles.statItem} onPress={() => setFollowModalConfig({ visible: true, tab: 'following' })}>
                    <Text style={[styles.statNumber, { color: colors.text }]}>{formatCompactNumber(userStats?.following)}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Following</Text>
                  </TouchableOpacity>
                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                  <TouchableOpacity style={styles.statItem} onPress={() => setFollowModalConfig({ visible: true, tab: 'followers' })}>
                    <Text style={[styles.statNumber, { color: colors.text }]}>{formatCompactNumber(userStats?.followers)}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Followers</Text>
                  </TouchableOpacity>
                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: colors.text }]}>{formatCompactNumber(userGames.length)}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Liked</Text>
                  </View>
                </View>

                {isCurrentMe ? (
                  <View style={styles.profileActions}>
                    <TouchableOpacity
                      style={[styles.primaryAction, { backgroundColor: colors.text }]}
                      onPress={() => Alert.alert('Notice', 'Go to the Profile tab to edit your profile.')}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.primaryActionText, { color: colors.background }]}>Edit profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.secondaryAction, { borderColor: colors.border, backgroundColor: colors.surface }]}
                      onPress={shareProfile}
                      activeOpacity={0.9}
                    >
                      <Ionicons name="arrow-redo-outline" size={17} color={colors.text} />
                      <Text style={[styles.secondaryActionText, { color: colors.text }]}>Share</Text>
                    </TouchableOpacity>
                  </View>
                ) : loadingFollow ? (
                  <View style={styles.profileActions}>
                    <View style={[styles.primaryAction, { backgroundColor: colors.surface }]}>
                      <ActivityIndicator size="small" color={colors.textSecondary} />
                    </View>
                    <View style={[styles.secondaryAction, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                      <ActivityIndicator size="small" color={colors.textSecondary} />
                    </View>
                  </View>
                ) : (
                  <View style={styles.profileActions}>
                    <AnimatedButton
                      style={[styles.primaryAction, { backgroundColor: isAdded ? colors.text : colors.primary }]}
                      onPress={isAdded ? openChat : handleAdd}
                      disabled={isToggling}
                    >
                      {isToggling ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <View style={styles.actionContent}>
                          <Ionicons name={isAdded ? 'chatbubble-outline' : 'person-add'} size={16} color="#fff" />
                          <Text style={styles.primaryActionLabel}>{isAdded ? 'Message' : 'Follow'}</Text>
                        </View>
                      )}
                    </AnimatedButton>

                    <TouchableOpacity
                      style={[styles.secondaryAction, { borderColor: colors.border, backgroundColor: colors.surface }]}
                      onPress={isAdded ? shareProfile : openChat}
                      activeOpacity={0.9}
                    >
                      <Ionicons name={isAdded ? 'arrow-redo-outline' : 'game-controller-outline'} size={17} color={colors.text} />
                      <Text style={[styles.secondaryActionText, { color: colors.text }]}>{isAdded ? 'Share' : 'Challenge'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </LinearGradient>
            </View>
          </View>

          <View style={styles.contentIntro}>
            <Text style={[styles.contentEyebrow, { color: colors.textSecondary }]}>THEIR TASTE</Text>
            <Text style={[styles.contentHeading, { color: colors.text }]}>Liked Games</Text>
            <Text style={[styles.contentBlurb, { color: colors.textSecondary }]}>
              Games they kept around because something about them hit.
            </Text>
          </View>

          {loadingGames ? (
            <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
          ) : userGames.length > 0 ? (
            <View style={styles.gameGrid}>
              {userGames.map(game => {
                const thumbUri = game.thumbnail
                  ? (game.thumbnail.startsWith('http') ? game.thumbnail : `${GAMES_HOST}${game.thumbnail}`)
                  : null;
                return (
                  <TouchableOpacity
                    key={game.id}
                    style={styles.gameTile}
                    onPress={() => {
                      setPlayingGame({ id: game.id, name: game.name, color: game.color || '#a855f7' });
                      setGameLoaded(false);
                    }}
                    activeOpacity={0.9}
                  >
                    {thumbUri ? (
                      <Image source={{ uri: thumbUri }} style={[styles.gameTileImage, { backgroundColor: game.color || colors.surface }]} />
                    ) : (
                      <View style={[styles.gameTileImage, styles.gameTileFallback, { backgroundColor: game.color || colors.surface }]}>
                        <Ionicons name="game-controller" size={32} color="rgba(255,255,255,0.5)" />
                      </View>
                    )}
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.8)']} style={styles.gameTileOverlay}>
                      <Text style={styles.gameTileTitle} numberOfLines={2}>{game.name}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="heart-outline" size={32} color={colors.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No liked games yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Their favorites have not landed here yet.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Options Modal */}
      <Modal visible={showOptionsModal} transparent animationType="slide" onRequestClose={() => setShowOptionsModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowOptionsModal(false)}>
          <View style={{ backgroundColor: colors.background, overflow: 'hidden', paddingBottom: insets.bottom || 20 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: 12, marginBottom: 12 }} />

            {isAdded && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.surface, marginBottom: 1 }}
                onPress={() => { setShowOptionsModal(false); handleAdd(); }}
              >
                <Ionicons name="person-remove-outline" size={24} color="#ef4444" style={{ marginRight: 16 }} />
                <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>Unfollow @{user.username}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.surface, marginBottom: 1 }}
              onPress={() => { setShowOptionsModal(false); handleReport(); }}
            >
              <Ionicons name="flag-outline" size={24} color={colors.text} style={{ marginRight: 16 }} />
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Report User</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.surface }}
              onPress={() => { setShowOptionsModal(false); handleBlock(); }}
            >
              <Ionicons name="ban-outline" size={24} color="#ef4444" style={{ marginRight: 16 }} />
              <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>Block User</Text>
            </TouchableOpacity>

            <View style={{ height: 8, backgroundColor: colors.background, marginTop: 4, marginBottom: 4 }} />

            <TouchableOpacity
              style={{ padding: 16, backgroundColor: colors.surface, alignItems: 'center', paddingBottom: (insets.bottom || 20) + 16 }}
              onPress={() => setShowOptionsModal(false)}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Block Confirm Modal */}
      <Modal visible={showBlockConfirm} transparent animationType="fade" onRequestClose={() => setShowBlockConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, width: '100%', overflow: 'hidden' }}>
            <View style={{ padding: 24, paddingBottom: 16, alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(239, 68, 68, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="ban" size={24} color="#ef4444" />
              </View>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>Block @{user.username}?</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                Are you sure you want to block this user? They won't be able to message you, challenge you, or see your profile.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 16, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.border }} onPress={() => setShowBlockConfirm(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 16, alignItems: 'center' }} onPress={confirmBlockAction}>
                <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '700' }}>Block</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        userId={user.id}
        username={user.username}
        contentType="profile"
      />

      <FollowListModal
        visible={followModalConfig.visible}
        onClose={() => setFollowModalConfig({ ...followModalConfig, visible: false })}
        userId={user.id}
        username={user.username}
        initialTab={followModalConfig.tab}
        onUserPress={(profileUser) => {
          setFollowModalConfig({ ...followModalConfig, visible: false });
          setNestedUser({ ...profileUser, isFriend: false });
        }}
      />

      {nestedUser && (
        <UserProfileModal
          visible={!!nestedUser}
          onClose={() => setNestedUser(null)}
          user={nestedUser}
        />
      )}

      {/* Game Playing Modal */}
      <Modal visible={playingGame !== null} animationType="slide" onRequestClose={() => setPlayingGame(null)}>
        {playingGame && (
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <StatusBar hidden />
            <WebView
              source={{ uri: `${GAMES_HOST}/${playingGame.id}/` }}
              style={{ flex: 1 }}
              scrollEnabled={false}
              bounces={false}
              onLoadEnd={() => setGameLoaded(true)}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowsAirPlayForMediaPlayback={false}
            />
            {!gameLoaded && (
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: playingGame.color, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 16 }}>Loading {playingGame.name}...</Text>
              </View>
            )}
            <TouchableOpacity
              style={{ position: 'absolute', right: 16, top: insets.top + 10, zIndex: 100 }}
              onPress={() => { setPlayingGame(null); setGameLoaded(false); }}
            >
              <BlurView intensity={50} tint="dark" style={{ width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                <Ionicons name="close" size={24} color="#fff" />
              </BlurView>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

    </SlideRightModal>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1 },
  profileShell: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  profileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  topIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topUsername: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroCard: {
    borderRadius: 34,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  heroGlow: {
    alignItems: 'center',
    borderRadius: 34,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 26,
    paddingBottom: 22,
    position: 'relative',
  },
  orbLarge: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -30,
    top: -24,
  },
  orbSmall: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    left: -18,
    bottom: 56,
  },
  heroNoiseLine: {
    position: 'absolute',
    width: 160,
    height: 1,
    top: 86,
    right: 28,
    opacity: 0.75,
  },
  avatarHitbox: {
    marginBottom: 12,
    position: 'relative',
  },
  avatarRing: {
    padding: 5,
    borderWidth: 2,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  onlineDot: {
    position: 'absolute',
    right: 6,
    bottom: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#4CD964',
    borderWidth: 3,
    borderColor: '#000',
  },
  displayName: {
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.8,
    maxWidth: '90%',
    textAlign: 'center',
  },
  handleText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 13,
    textAlign: 'center',
    maxWidth: 300,
  },
  vibeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  vibeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  vibeChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginBottom: 18,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    opacity: 0.8,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  profileActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  primaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '900',
  },
  primaryActionLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryAction: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '800',
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contentIntro: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  contentEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  contentHeading: {
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 4,
  },
  contentBlurb: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 280,
  },
  gameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 5,
    paddingTop: 4,
    paddingBottom: 14,
  },
  gameTile: {
    width: PROFILE_GRID_SIZE,
    height: PROFILE_GRID_SIZE,
    margin: PROFILE_GRID_GAP / 2,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  gameTileImage: {
    width: '100%',
    height: '100%',
  },
  gameTileFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameTileOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  gameTileTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 15,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 2 },
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 34,
    paddingTop: 48,
    paddingBottom: 90,
  },
  emptyIconBubble: {
    width: 78,
    height: 78,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  headerSection: { height: 380 },
  absoluteTopButtons: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 100
  },
  coverImage: { flex: 1, justifyContent: 'flex-end' },
  topButtons: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, zIndex: 10 },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  topRight: { flexDirection: 'row', gap: 8 },
  profileOverlay: { paddingHorizontal: 16, paddingBottom: 16 },
  avatarContainer: { marginBottom: 8, position: 'relative', alignSelf: 'flex-start' },
  avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarEmoji: { fontSize: 32 },
  onlineIndicator: { position: 'absolute', bottom: 2, left: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#4CD964', borderWidth: 2, borderColor: '#fff' },
  userInfo: { marginBottom: 12 },
  username: { color: '#fff', fontSize: 16, fontWeight: '600' },
  statusText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2, textTransform: 'uppercase' },
  bio: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginBottom: 12, lineHeight: 20 },
  actionButtons: { flexDirection: 'row', gap: 8 },
  addButtonSmall: { flex: 1, height: 40, borderRadius: 20, backgroundColor: '#FF8E53', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  addedButton: { backgroundColor: 'rgba(255,255,255,0.2)' },
  addButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  chatBtn: { flex: 1, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  chatBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  content: { flex: 1, paddingTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', paddingHorizontal: 16, marginBottom: 16 },
  friendsScroll: { paddingHorizontal: 12, gap: 8 },
  friendCard: { width: 110, paddingVertical: 16, paddingHorizontal: 12, borderRadius: 16, alignItems: 'center', marginHorizontal: 4 },
  dismissBtn: { position: 'absolute', top: 8, right: 8 },
  friendAvatarContainer: { position: 'relative', marginBottom: 8 },
  friendAvatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  friendEmoji: { fontSize: 28 },
  friendOnlineDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#4CD964', borderWidth: 2, borderColor: '#fff' },
  friendName: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  friendStatus: { fontSize: 9, textAlign: 'center', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  friendAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  friendAddBtnText: { fontSize: 13, fontWeight: '600' },
  // Chat styles
  chatContainer: { flex: 1 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 0.5 },
  chatHeaderUser: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  chatHeaderAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  chatHeaderAvatarText: { fontSize: 18 },
  chatHeaderUsername: { fontSize: 16, fontWeight: '600' },
  chatLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chatMessages: { flex: 1 },
  chatMessagesContent: { padding: 16, flexGrow: 1 },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyChatText: { fontSize: 16 },
  receivedBubble: { alignSelf: 'flex-start', maxWidth: '75%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderBottomLeftRadius: 4, marginBottom: 8 },
  sentBubble: { alignSelf: 'flex-end', maxWidth: '75%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderBottomRightRadius: 4, marginBottom: 8 },
  bubbleText: { fontSize: 15 },
  chatInputArea: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, borderTopWidth: 0.5, gap: 8 },
  chatInputBox: { flex: 1, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  chatInput: { fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});
