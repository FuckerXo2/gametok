import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Modal,
  Animated,
  PanResponder,
  Dimensions,
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
  gifUrl?: string;
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
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifPickerVisible, setGifPickerVisible] = useState(false);
  const [selectedGifUrl, setSelectedGifUrl] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const gifSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const panY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          onClose();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      panY.setValue(0);
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


  const fetchGifs = useCallback(async (query = '') => {
    setGifLoading(true);
    try {
      const GIPHY_API_KEY = 'SwEhCBr38RpeNNffpxmtsZK9Umum8edV';
      const endpoint = query.trim() ? 'search' : 'trending';
      const qParam = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : '';
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/${endpoint}?api_key=${GIPHY_API_KEY}&limit=18&rating=pg-13${qParam}`
      );
      const data = await response.json();
      const formatted = (data?.data || []).map((item: any) => ({
        id: item.id,
        url: item.images?.fixed_width?.url || item.images?.original?.url,
        preview: item.images?.fixed_width_small?.url || item.images?.fixed_width?.url,
      })).filter((item: any) => item.url);
      setGifResults(formatted);
    } catch (e) {
      console.warn('Failed to load GIFs for comments:', e);
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!gifPickerVisible) return;
    if (gifSearchTimeoutRef.current) clearTimeout(gifSearchTimeoutRef.current);
    gifSearchTimeoutRef.current = setTimeout(() => {
      fetchGifs(gifQuery);
    }, 250);
    return () => {
      if (gifSearchTimeoutRef.current) clearTimeout(gifSearchTimeoutRef.current);
    };
  }, [gifQuery, gifPickerVisible, fetchGifs]);

  const openGifPicker = () => {
    setGifPickerVisible(true);
    if (!gifResults.length) fetchGifs('');
  };

  const handlePost = async () => {
    if ((!newComment.trim() && !selectedGifUrl) || posting || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPosting(true);
    Keyboard.dismiss();

    try {
      const result = await commentsApi.create(gameId, newComment.trim(), selectedGifUrl || undefined);
      if (result.comment) {
        setCommentsList(prev => [result.comment, ...prev]);
      }
      setNewComment('');
      setSelectedGifUrl(null);
      setGifPickerVisible(false);
      setGifQuery('');
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
        <Avatar uri={item.avatar} userId={item.userId} size={40} />
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
          {!!item.gifUrl && (
            <Image source={{ uri: item.gifUrl }} style={styles.commentGif} resizeMode="cover" />
          )}
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
      setSelectedGifUrl(null);
      setGifPickerVisible(false);
      setGifQuery('');
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <View style={styles.sheetWrapper} pointerEvents="box-none">
          <Animated.View style={[styles.sheet, { backgroundColor: colors.surface, transform: [{ translateY: panY }] }]}>
            <View style={styles.sheetHandleWrap} {...panResponder.panHandlers}>
            <View style={styles.sheetHandle} />
          </View>
          {/* Header */}
          <View style={styles.header} {...panResponder.panHandlers}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtnHeader}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>
              {commentsList.length} {commentsList.length === 1 ? 'comment' : 'comments'}
            </Text>
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
          <View style={[styles.inputWrap, { paddingBottom: insets.bottom + 10, borderTopColor: colors.border }]}>
            {user ? (
              <>
                {selectedGifUrl && (
                  <View style={[styles.selectedGifCard, { backgroundColor: colors.background }]}>
                    <Image source={{ uri: selectedGifUrl }} style={styles.selectedGifImage} resizeMode="cover" />
                    <TouchableOpacity style={styles.removeGifBtn} onPress={() => setSelectedGifUrl(null)}>
                      <Ionicons name="close-circle" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                )}

                {gifPickerVisible && (
                  <View style={[styles.gifPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={styles.gifPanelHeader}>
                      <Text style={[styles.gifPanelTitle, { color: colors.text }]}>GIFs</Text>
                      <TouchableOpacity onPress={() => setGifPickerVisible(false)}>
                        <Ionicons name="close" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.gifSearchInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                      placeholder="Search GIFs"
                      placeholderTextColor={colors.textSecondary}
                      value={gifQuery}
                      onChangeText={setGifQuery}
                    />
                    {gifLoading ? (
                      <View style={styles.gifLoadingWrap}>
                        <ActivityIndicator color={colors.primary} />
                      </View>
                    ) : (
                      <FlatList
                        data={gifResults}
                        keyExtractor={(item) => item.id}
                        numColumns={3}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.gifGrid}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={styles.gifTile}
                            onPress={() => {
                              setSelectedGifUrl(item.url);
                              setGifPickerVisible(false);
                            }}
                          >
                            <Image source={{ uri: item.preview || item.url }} style={styles.gifTileImage} resizeMode="cover" />
                          </TouchableOpacity>
                        )}
                      />
                    )}
                  </View>
                )}

                <View style={styles.inputContainer}>
                  <Avatar uri={user.avatar} userId={user.id} size={34} />
                  <View style={styles.inputComposer}>
                    <TextInput
                      ref={inputRef}
                      style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                      placeholder="Add a comment or GIF..."
                      placeholderTextColor={colors.textSecondary}
                      value={newComment}
                      onChangeText={setNewComment}
                      multiline
                      maxLength={500}
                    />
                    <TouchableOpacity style={styles.gifBtn} onPress={openGifPicker}>
                      <Ionicons name="images-outline" size={18} color={colors.textSecondary} />
                      <Text style={[styles.gifBtnText, { color: colors.textSecondary }]}>GIF</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={handlePost}
                    disabled={(!newComment.trim() && !selectedGifUrl) || posting}
                    style={[
                      styles.postBtn,
                      {
                        backgroundColor: (newComment.trim() || selectedGifUrl) ? colors.primary : 'rgba(255,255,255,0.08)',
                      },
                    ]}
                  >
                    {posting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons
                        name="arrow-up"
                        size={18}
                        color={(newComment.trim() || selectedGifUrl) ? '#FFF' : colors.textSecondary}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={[styles.loginPrompt, { color: colors.textSecondary }]}>
                Log in to comment
              </Text>
            )}
          </View>
        </Animated.View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};


const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetWrapper: {
    flex: 1,
    paddingTop: SCREEN_HEIGHT * 0.35,
  },
  sheet: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#555',
  },
  header: {
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#3A3A3C',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  closeBtnHeader: {
    position: 'absolute',
    left: 16,
    top: 10,
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
    paddingBottom: 10,
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
  commentGif: {
    width: 180,
    height: 180,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: '#111',
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
  inputWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 0.5,
    gap: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  inputComposer: {
    flex: 1,
    gap: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    fontSize: 14,
    minHeight: 46,
    maxHeight: 104,
  },
  gifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  gifBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  postBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  postText: {
    fontSize: 14,
    fontWeight: '700',
  },
  selectedGifCard: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'flex-start',
  },
  selectedGifImage: {
    width: 132,
    height: 132,
  },
  removeGifBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  gifPanel: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    maxHeight: 270,
  },
  gifPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gifPanelTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  gifSearchInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  gifLoadingWrap: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gifGrid: {
    gap: 8,
  },
  gifTile: {
    flex: 1,
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  gifTileImage: {
    width: '100%',
    aspectRatio: 1,
  },
  loginPrompt: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 12,
  },
});

export default CommentsModal;
