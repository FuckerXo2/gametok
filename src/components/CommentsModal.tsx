import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { comments as commentsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Avatar } from './Avatar';

interface Comment {
  id: string;
  text: string;
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  likes: number;
  createdAt: string;
}

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({
  visible,
  onClose,
  gameId,
  gameName,
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [commentsList, setCommentsList] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      loadComments();
    }
  }, [visible, gameId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const result = await commentsApi.list(gameId);
      setCommentsList(result.comments || []);
    } catch (e) {
      console.error('Failed to load comments:', e);
      setCommentsList([]);
    } finally {
      setLoading(false);
    }
  };


  const handlePost = async () => {
    if (!newComment.trim() || posting || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPosting(true);
    Keyboard.dismiss();

    try {
      const result = await commentsApi.create(gameId, newComment.trim());
      if (result.comment) {
        setCommentsList(prev => [result.comment, ...prev]);
      }
      setNewComment('');
    } catch (e) {
      console.error('Failed to post comment:', e);
    } finally {
      setPosting(false);
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
    if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)}w`;
  };

  const renderComment = useCallback(
    ({ item }: { item: Comment }) => (
      <View style={styles.commentItem}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <Avatar uri={item.avatar} userId={item.userId} size={40} />
        )}
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={[styles.username, { color: colors.text }]}>
              {item.displayName || item.username}
            </Text>
            <Text style={[styles.time, { color: colors.textSecondary }]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
          <Text style={[styles.commentText, { color: colors.text }]}>{item.text}</Text>
          <View style={styles.commentActions}>
            <TouchableOpacity style={styles.likeBtn}>
              <Ionicons name="heart-outline" size={14} color={colors.textSecondary} />
              {item.likes > 0 && (
                <Text style={[styles.likeCount, { color: colors.textSecondary }]}>{item.likes}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={[styles.replyBtn, { color: colors.textSecondary }]}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    ),
    [colors]
  );

  useEffect(() => {
    if (!visible) {
      setNewComment('');
      setCommentsList([]);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <Text style={[styles.title, { color: colors.text }]}>
              {commentsList.length} {commentsList.length === 1 ? 'comment' : 'comments'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          <View style={styles.listContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : commentsList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-outline" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No comments yet</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Be the first to comment!
                </Text>
              </View>
            ) : (
              <FlatList
                data={commentsList}
                renderItem={renderComment}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.commentsList}
              />
            )}
          </View>

          {/* Input */}
          <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8, borderTopColor: colors.border }]}>
            {user ? (
              <>
                {user.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.inputAvatar} />
                ) : (
                  <Avatar uri={user.avatar} userId={user.id} size={32} />
                )}
                <TextInput
                  ref={inputRef}
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                  placeholder="Add a comment..."
                  placeholderTextColor={colors.textSecondary}
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  onPress={handlePost}
                  disabled={!newComment.trim() || posting}
                  style={styles.postBtn}
                >
                  {posting ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={[
                      styles.postText,
                      { color: newComment.trim() ? colors.primary : colors.textSecondary }
                    ]}>
                      Post
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <Text style={[styles.loginPrompt, { color: colors.textSecondary }]}>
                Log in to comment
              </Text>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    minHeight: 300,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#3A3A3C',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#5A5A5E',
    borderRadius: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 20,
  },
  listContainer: {
    flex: 1,
    minHeight: 150,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  commentsList: {
    padding: 16,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  avatarTextSmall: {
    fontSize: 12,
    fontWeight: '600',
  },
  commentContent: {
    flex: 1,
    marginLeft: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 13,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
    marginLeft: 8,
  },
  commentText: {
    fontSize: 14,
    marginTop: 2,
    lineHeight: 18,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeCount: {
    fontSize: 12,
  },
  replyBtn: {
    fontSize: 12,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  input: {
    flex: 1,
    marginHorizontal: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 14,
    maxHeight: 80,
  },
  postBtn: {
    paddingHorizontal: 4,
  },
  postText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loginPrompt: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 12,
  },
});

export default CommentsModal;
