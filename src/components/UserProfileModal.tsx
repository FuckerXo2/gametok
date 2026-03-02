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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { messages as messagesApi, users, moderation } from '../services/api';
import { Avatar } from './Avatar';
import { ReportModal } from './ReportModal';

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

const GAMES_HOST = 'https://gametok-games.pages.dev';

const SUGGESTED_FRIENDS: any[] = [];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ visible, onClose, user, onFriendStatusChange }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [isAdded, setIsAdded] = useState(user?.isFriend ?? false);
  const [isMutual, setIsMutual] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [userStats, setUserStats] = useState<{ followers: number; following: number; level: number; streak: number } | null>(null);

  // Update isAdded when user changes or modal opens
  React.useEffect(() => {
    if (user) {
      setIsAdded(user.isFriend);
      setIsMutual(false);
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
      }).catch(() => { });
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
    Alert.alert(
      'Block User',
      `Are you sure you want to block @${user?.username}? They won't be able to message you or see your profile.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await moderation.block(user!.id);
              Alert.alert('Blocked', `You've blocked @${user?.username}.`);
              onClose();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to block user');
            }
          }
        },
      ]
    );
  };

  const showOptions = () => {
    Alert.alert(
      'Options',
      '',
      [
        { text: 'Report User', onPress: handleReport },
        { text: 'Block User', style: 'destructive', onPress: handleBlock },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  if (!user) return null;

  const handleAdd = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      const result = await users.follow(user.id);
      setIsAdded(result.following);
      setIsMutual(result.isMutual || false);
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

  // Profile Modal
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <TouchableOpacity style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }} onPress={onClose}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>@{user.username}</Text>
              <TouchableOpacity style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }} onPress={showOptions}>
                <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Profile Info Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Avatar uri={user.avatar} size={86} />

              <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: 20 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{userStats?.followers ?? '—'}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Followers</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{userStats?.following ?? '—'}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Following</Text>
                </View>
              </View>
            </View>

            {/* Name & Bio */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{user.displayName || user.username}</Text>
              {user.bio ? <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4, lineHeight: 20 }}>{user.bio}</Text> : (
                <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4 }}>🎮 GameTok Player</Text>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,214,10,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
                  <Ionicons name="trophy" size={12} color="#ffd60a" />
                  <Text style={{ color: '#ffd60a', fontSize: 13, fontWeight: '700' }}>Level {userStats?.level ?? 1}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(249,115,22,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
                  <Ionicons name="flame" size={14} color="#f97316" />
                  <Text style={{ color: '#f97316', fontSize: 13, fontWeight: '600' }}>{userStats?.streak ?? 0} day streak</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: isAdded ? colors.surface : '#a855f7', borderRadius: 8, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: isAdded ? 1 : 0, borderColor: colors.border }}
                onPress={handleAdd}
                disabled={isToggling}
              >
                {isToggling ? (
                  <ActivityIndicator size="small" color={isAdded ? colors.text : '#fff'} />
                ) : (
                  <>
                    <Ionicons name={isAdded ? "checkmark" : "person-add"} size={16} color={isAdded ? colors.text : '#fff'} />
                    <Text style={{ color: isAdded ? colors.text : '#fff', fontSize: 14, fontWeight: '600' }}>
                      {isAdded ? (isMutual ? 'Friends' : 'Following') : 'Follow'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 8, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border }}
                onPress={openChat}
              >
                <Ionicons name="chatbubble-outline" size={16} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Saved Games Section */}
          <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <Ionicons name="grid-outline" size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>Games</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingTop: 2 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                <View key={i} style={{ width: (Dimensions.get('window').width - 4) / 3, aspectRatio: 1, backgroundColor: colors.surface }} />
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        userId={user.id}
        username={user.username}
        contentType="profile"
      />
    </Modal>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1 },
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
