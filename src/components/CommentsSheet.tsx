import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  Platform,
  Alert,
  ActionSheetIOS,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { comments as commentsApi, moderation } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.65;

interface Comment {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  text: string;
  likes: number;
  liked: boolean;
  createdAt: string;
  replies?: Comment[];
  replyCount?: number;
}

interface CommentsSheetProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
}

// Quick reaction emojis
const QUICK_EMOJIS = ['😂', '😭', '❤️', '😊', '🥰', '😳', '😏', '😅'];

// Format time ago
const timeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
};

// Format count
const formatCount = (count: number): string => {
  if (count >= 1000000) return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return count.toString();
};

export const CommentsSheet: React.FC<CommentsSheetProps> = ({
  visible,
  onClose,
  gameId,
  gameName,
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  // Handle long press on comment - show action sheet
  const handleCommentLongPress = (comment: Comment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const isOwnComment = user?.id === comment.userId;
    
    const options = isOwnComment 
      ? ['Delete Comment', 'Cancel']
      : ['Report Comment', 'Block User', 'Cancel'];
    
    const destructiveIndex = 0;
    const cancelIndex = options.length - 1;

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        destructiveButtonIndex: destructiveIndex,
        cancelButtonIndex: cancelIndex,
      },
      async (buttonIndex) => {
        if (isOwnComment) {
          if (buttonIndex === 0) {
            // Delete
            handleDeleteComment(comment.id);
          }
        } else {
          if (buttonIndex === 0) {
            // Report
            handleReportComment(comment);
          } else if (buttonIndex === 1) {
            // Block
            handleBlockUser(comment);
          }
        }
      }
    );
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await commentsApi.delete(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      setTotalCount(prev => prev - 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Error', 'Failed to delete comment');
    }
  };

  const handleReportComment = (comment: Comment) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Why are you reporting this comment?',
        options: ['Spam', 'Harassment', 'Hate Speech', 'Inappropriate Content', 'Cancel'],
        cancelButtonIndex: 4,
      },
      async (buttonIndex) => {
        const reasons = ['spam', 'harassment', 'hate_speech', 'inappropriate'];
        if (buttonIndex < 4) {
          try {
            await moderation.report(comment.userId, reasons[buttonIndex], comment.text, 'comment', comment.id);
            Alert.alert('Reported', 'Thanks for letting us know. We\'ll review this comment.');
          } catch (e) {
            Alert.alert('Error', 'Failed to submit report');
          }
        }
      }
    );
  };

  const handleBlockUser = async (comment: Comment) => {
    Alert.alert(
      'Block User',
      `Block ${comment.username}? You won't see their comments anymore.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await moderation.block(comment.userId);
              // Remove their comments from view
              setComments(prev => prev.filter(c => c.userId !== comment.userId));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Blocked', `${comment.username} has been blocked`);
            } catch (e) {
              Alert.alert('Error', 'Failed to block user');
            }
          },
        },
      ]
    );
  };

  // Animate bottom section with keyboard
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        Animated.timing(keyboardOffset, {
          toValue: e.endCoordinates.height - insets.bottom,
          duration: Platform.OS === 'ios' ? 250 : 0,
          useNativeDriver: false,
        }).start();
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? 250 : 0,
          useNativeDriver: false,
        }).start();
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);


  // Fetch comments when sheet opens
  useEffect(() => {
    if (visible && gameId) {
      fetchComments();
    }
  }, [visible, gameId]);

  // Animate sheet
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const result = await commentsApi.list(gameId);
      setComments(result.comments || []);
      setTotalCount(result.total || 0);
    } catch (e) {
      console.log('Failed to fetch comments:', e);
      // Mock data for now
      setComments([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleSend = async () => {
    if (!commentText.trim()) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const text = commentText.trim();
    setCommentText('');
    
    // Optimistic update
    const tempComment: Comment = {
      id: `temp-${Date.now()}`,
      userId: 'me',
      username: 'You',
      text,
      likes: 0,
      liked: false,
      createdAt: new Date().toISOString(),
    };
    setComments(prev => [tempComment, ...prev]);
    setTotalCount(prev => prev + 1);
    
    try {
      const result = await commentsApi.create(gameId, text);
      // Replace temp comment with real one
      setComments(prev => prev.map(c => 
        c.id === tempComment.id ? result.comment : c
      ));
    } catch (e) {
      // Remove temp comment on error
      setComments(prev => prev.filter(c => c.id !== tempComment.id));
      setTotalCount(prev => prev - 1);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Optimistic update
    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        return {
          ...c,
          liked: !c.liked,
          likes: c.liked ? c.likes - 1 : c.likes + 1,
        };
      }
      return c;
    }));
    
    try {
      await commentsApi.like(commentId);
    } catch (e) {
      // Revert on error
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          return {
            ...c,
            liked: !c.liked,
            likes: c.liked ? c.likes - 1 : c.likes + 1,
          };
        }
        return c;
      }));
    }
  };

  const handleQuickEmoji = (emoji: string) => {
    setCommentText(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <TouchableOpacity 
      style={styles.commentItem}
      onLongPress={() => handleCommentLongPress(item)}
      delayLongPress={400}
      activeOpacity={0.8}
    >
      {/* Avatar */}
      <View style={styles.avatar}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{item.username[0]?.toUpperCase()}</Text>
          </View>
        )}
      </View>
      
      {/* Content */}
      <View style={styles.commentContent}>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={styles.commentText}>{item.text}</Text>
        <View style={styles.commentMeta}>
          <Text style={styles.timeText}>{timeAgo(item.createdAt)}</Text>
          <TouchableOpacity style={styles.replyButton}>
            <Text style={styles.replyText}>Reply</Text>
          </TouchableOpacity>
        </View>
        
        {/* View replies */}
        {item.replyCount && item.replyCount > 0 && (
          <TouchableOpacity style={styles.viewReplies}>
            <View style={styles.replyLine} />
            <Text style={styles.viewRepliesText}>View {item.replyCount} replies</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Like button */}
      <TouchableOpacity 
        style={styles.likeButton}
        onPress={() => handleLikeComment(item.id)}
      >
        <Ionicons 
          name={item.liked ? 'heart' : 'heart-outline'} 
          size={16} 
          color={item.liked ? '#ff2d55' : '#888'} 
        />
        {item.likes > 0 && (
          <Text style={[styles.likeCount, item.liked && styles.likeCountActive]}>
            {formatCount(item.likes)}
          </Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View 
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            onPress={handleClose}
            activeOpacity={1}
          />
        </Animated.View>
        
        {/* Sheet */}
        <Animated.View 
          style={[
            styles.sheet,
            { 
              height: SHEET_HEIGHT + insets.bottom,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{formatCount(totalCount)} comments</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {/* Comments list */}
          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={item => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No comments yet</Text>
                <Text style={styles.emptySubtext}>Be the first to comment!</Text>
              </View>
            }
          />
          
          {/* Keyboard dim overlay - covers comments when typing */}
          {keyboardVisible && (
            <TouchableOpacity 
              style={[styles.keyboardDim, { opacity: 0.6 }]}
              onPress={() => Keyboard.dismiss()}
              activeOpacity={1}
            />
          )}
          
          {/* Bottom section - moves with keyboard */}
          <Animated.View style={{ marginBottom: keyboardOffset, zIndex: 20 }}>
            {/* Quick emoji bar */}
            <View style={styles.emojiBar}>
              {QUICK_EMOJIS.map((emoji, index) => (
                <TouchableOpacity 
                  key={index}
                  style={styles.emojiButton}
                  onPress={() => handleQuickEmoji(emoji)}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Input area */}
            <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
              <View style={styles.inputRow}>
                {/* User avatar */}
                <View style={styles.inputAvatar}>
                  <Ionicons name="person" size={16} color="#666" />
                </View>
                
                {/* Text input */}
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="Add comment..."
                  placeholderTextColor="#666"
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={500}
                />
                
                {/* Send button */}
                {commentText.trim().length > 0 && (
                  <TouchableOpacity 
                    style={styles.sendButton}
                    onPress={handleSend}
                  >
                    <Ionicons name="arrow-up" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  keyboardDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 1)',
    zIndex: 15,
  },
  sheet: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    zIndex: 10,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  avatar: {
    marginRight: 12,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  commentContent: {
    flex: 1,
  },
  username: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  commentText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  timeText: {
    color: '#666',
    fontSize: 12,
  },
  replyButton: {
    marginLeft: 16,
  },
  replyText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  viewReplies: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  replyLine: {
    width: 24,
    height: 1,
    backgroundColor: '#444',
    marginRight: 8,
  },
  viewRepliesText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  likeButton: {
    alignItems: 'center',
    paddingLeft: 12,
  },
  likeCount: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  likeCountActive: {
    color: '#888',
  },
  emojiBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#333',
  },
  emojiButton: {
    padding: 4,
  },
  emoji: {
    fontSize: 24,
  },
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#333',
    backgroundColor: '#121212',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fe2c55',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
});
