import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { messages as messagesApi, users } from '../services/api';
import { Avatar } from './Avatar';

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
}

const SUGGESTED_FRIENDS: any[] = [];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ visible, onClose, user, onFriendStatusChange }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [isAdded, setIsAdded] = useState(user?.isFriend ?? false);
  const [isMutual, setIsMutual] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  // Update isAdded when user changes or modal opens
  React.useEffect(() => {
    if (user) {
      setIsAdded(user.isFriend);
      setIsMutual(false); // Reset mutual status when user changes
    }
  }, [user?.id, user?.isFriend, visible]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleReport = () => {
    Alert.alert(
      'Report User',
      'Why are you reporting this user?',
      [
        { text: 'Spam', onPress: () => Alert.alert('Reported', 'Thank you for your report. We will review this user.') },
        { text: 'Inappropriate Content', onPress: () => Alert.alert('Reported', 'Thank you for your report. We will review this user.') },
        { text: 'Harassment', onPress: () => Alert.alert('Reported', 'Thank you for your report. We will review this user.') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleBlock = () => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${user?.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => Alert.alert('Blocked', 'This user has been blocked.') },
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
      <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0' }]}>
        <View style={styles.headerSection}>
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800' }}
            style={[styles.coverImage, { paddingTop: insets.top }]}
            resizeMode="cover"
          >
            <View style={styles.topButtons}>
              <TouchableOpacity style={styles.topBtn} onPress={onClose}>
                <Ionicons name="chevron-back" size={28} color="#fff" />
              </TouchableOpacity>
              <View style={styles.topRight}>
                <TouchableOpacity style={styles.topBtn}>
                  <Ionicons name="share-outline" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.topBtn} onPress={showOptions}>
                  <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.profileOverlay}>
              <View style={styles.avatarContainer}>
                <Avatar uri={user.avatar} size={64} style={styles.avatar} />
                {user.isOnline && <View style={styles.onlineIndicator} />}
              </View>
              
              <View style={styles.userInfo}>
                <Text style={styles.username}>{user.displayName || user.username}</Text>
                <Text style={styles.statusText}>{user.status}</Text>
              </View>

              {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={[styles.addButtonSmall, isAdded && styles.addedButton]} 
                  onPress={handleAdd}
                  disabled={isToggling}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {isToggling ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name={isAdded ? "checkmark" : "person-add"} size={18} color="#fff" />
                      <Text style={styles.addButtonText}>{isAdded ? (isMutual ? 'Friends' : 'Requested') : 'Add'}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.chatBtn} 
                  onPress={openChat}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="chatbubble" size={16} color="#fff" />
                  <Text style={styles.chatBtnText}>Chat</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ImageBackground>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Find Friends</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendsScroll}>
            {SUGGESTED_FRIENDS.map((friend) => (
              <View key={friend.id} style={[styles.friendCard, { backgroundColor: colors.background }]}>
                <TouchableOpacity style={styles.dismissBtn}>
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <View style={styles.friendAvatarContainer}>
                  <Avatar uri={friend.avatar} size={56} />
                  {friend.online && <View style={styles.friendOnlineDot} />}
                </View>
                <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>{friend.name}</Text>
                <Text style={[styles.friendStatus, { color: colors.textSecondary }]}>{friend.status}</Text>
                <TouchableOpacity style={[styles.friendAddBtn, { borderColor: colors.border }]}>
                  <Ionicons name="person-add-outline" size={16} color={colors.primary} />
                  <Text style={[styles.friendAddBtnText, { color: colors.primary }]}>Add</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { height: 380 },
  coverImage: { flex: 1, justifyContent: 'space-between' },
  topButtons: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
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
