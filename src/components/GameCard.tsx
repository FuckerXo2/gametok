import React, { useRef, useState, useCallback, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Dimensions, 
  Text, 
  TouchableOpacity, 
  Share,
  Animated,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { scores, comments as commentsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const FAKE_LEADERBOARD = [
  { id: '1', rank: 1, user: 'speedrunner', avatar: null, score: 12450, isMe: false },
  { id: '2', rank: 2, user: 'gamer_pro', avatar: null, score: 11200, isMe: false },
  { id: '3', rank: 3, user: 'ninja_master', avatar: null, score: 9800, isMe: false },
  { id: '4', rank: 4, user: 'casual_player', avatar: null, score: 8500, isMe: false },
  { id: '5', rank: 5, user: 'you', avatar: null, score: 7200, isMe: true },
  { id: '6', rank: 6, user: 'newbie_2024', avatar: null, score: 5400, isMe: false },
];

interface LeaderboardEntry {
  id: string;
  rank: number;
  user: string;
  avatar: string | null;
  score: number;
  isMe: boolean;
}

interface Comment {
  id: string;
  text: string;
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  likes: number;
  createdAt: string;
}

interface GameCardProps {
  game: {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
  };
  gameUrl: string;
  isActive: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({ game, gameUrl }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [score, setScore] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 500) + 50);
  const [commentCount, setCommentCount] = useState(Math.floor(Math.random() * 200) + 20);
  const [isLoading, setIsLoading] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>(FAKE_LEADERBOARD);
  const [leaderboardTab, setLeaderboardTab] = useState<'global' | 'friends'>('global');
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;
  
  // NEW: Playing state - when true, game is fullscreen
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [commentsData, setCommentsData] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    if (showLeaderboard) {
      fetchLeaderboard();
    }
  }, [showLeaderboard, leaderboardTab]);

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments]);

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const data = await commentsApi.get(game.id);
      setCommentsData(data.comments || []);
      setCommentCount(data.comments?.length || 0);
    } catch (e) {
      console.log('Failed to fetch comments:', e);
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || postingComment) return;
    
    setPostingComment(true);
    const text = commentText.trim();
    setCommentText('');
    
    try {
      const data = await commentsApi.add(game.id, text);
      setCommentsData(prev => [data.comment, ...prev]);
      setCommentCount(prev => prev + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.log('Failed to post comment:', e);
      setCommentText(text);
    } finally {
      setPostingComment(false);
    }
  };

  const handleOpenComments = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowComments(true);
  }, []);

  const formatTimeAgo = (dateStr: string) => {
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

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const data = await scores.leaderboard(game.id, leaderboardTab, 20);
      if (data.leaderboard && data.leaderboard.length > 0) {
        const formatted = data.leaderboard.map((entry: any, index: number) => ({
          id: entry.userId || String(index),
          rank: index + 1,
          user: entry.username || 'Unknown',
          avatar: entry.avatar || '😊',
          score: entry.score,
          isMe: entry.userId === user?.id,
        }));
        setLeaderboardData(formatted);
      }
    } catch (e) {
      // Keep fake data on error
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'gameOver') {
        setScore(data.score);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (data.score > 0) {
          scores.submit(game.id, data.score).catch(() => {});
        }
      } else if (data.type === 'score') {
        setScore(data.score);
      }
    } catch (e) {}
  }, [game.id]);

  const handleLike = useCallback(() => {
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setLikeCount(prev => newLiked ? prev + 1 : prev - 1);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, speed: 50 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 50 }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [isLiked, heartScale]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({ message: `Playing ${game.name} on GameTok! Score: ${score}` });
    } catch (e) {}
  }, [score, game.name]);

  const handleOpenLeaderboard = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowLeaderboard(true);
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // NEW: Handle play button tap
  const handlePlay = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPlaying(true);
  }, []);

  // NEW: Handle close game
  const handleCloseGame = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsPlaying(false);
  }, []);

  // Preview card (shown in feed)
  const renderPreview = () => (
    <View style={[styles.container, { backgroundColor: game.color }]}>
      <View style={styles.previewContent}>
        <Text style={styles.previewIcon}>{game.icon}</Text>
        <Text style={styles.previewName}>{game.name}</Text>
        <Text style={styles.previewDesc}>{game.description}</Text>
        
        <TouchableOpacity style={styles.playButton} onPress={handlePlay} activeOpacity={0.8}>
          <Ionicons name="play" size={32} color="#fff" />
          <Text style={styles.playButtonText}>PLAY</Text>
        </TouchableOpacity>

        {score > 0 && (
          <View style={styles.previewScore}>
            <Text style={styles.previewScoreLabel}>Best Score</Text>
            <Text style={styles.previewScoreValue}>{score}</Text>
          </View>
        )}
      </View>

      {/* Side actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionItem} onPress={handleOpenLeaderboard} activeOpacity={0.8}>
          <Ionicons name="trophy-outline" size={30} color="#fff" />
          <Text style={styles.actionCount}>Top</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionItem} onPress={handleLike} activeOpacity={0.8}>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={32} color={isLiked ? '#ff2d55' : '#fff'} />
          </Animated.View>
          <Text style={styles.actionCount}>{formatNumber(likeCount)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionItem} onPress={handleOpenComments} activeOpacity={0.8}>
          <Ionicons name="chatbubble-ellipses-outline" size={30} color="#fff" />
          <Text style={styles.actionCount}>{formatNumber(commentCount)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionItem} activeOpacity={0.8}>
          <Ionicons name="bookmark-outline" size={30} color="#fff" />
          <Text style={styles.actionCount}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionItem} onPress={handleShare} activeOpacity={0.8}>
          <Ionicons name="arrow-redo" size={30} color="#fff" />
          <Text style={styles.actionCount}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Fullscreen game modal
  const renderGameModal = () => (
    <Modal
      visible={isPlaying}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleCloseGame}
    >
      <View style={styles.gameModal}>
        <StatusBar hidden />
        
        {isLoading && (
          <View style={[styles.loadingContainer, { backgroundColor: game.color }]}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading {game.name}...</Text>
          </View>
        )}
        
        <WebView
          ref={webViewRef}
          source={{ uri: gameUrl }}
          style={[styles.webview, isLoading && styles.hidden]}
          scrollEnabled={false}
          bounces={false}
          onMessage={handleMessage}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          originWhitelist={['*']}
          cacheEnabled={true}
          cacheMode="LOAD_CACHE_ELSE_NETWORK"
          incognito={false}
          thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false}
          allowsBackForwardNavigationGestures={false}
          contentMode="mobile"
          startInLoadingState={false}
        />
        
        {/* Close button - top left */}
        <TouchableOpacity 
          style={[styles.closeButton, { top: insets.top + 10 }]} 
          onPress={handleCloseGame}
          activeOpacity={0.8}
        >
          <View style={styles.closeButtonInner}>
            <Ionicons name="close" size={24} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  return (
    <>
      {renderPreview()}
      {renderGameModal()}
      
      {/* Leaderboard Modal */}
      <Modal visible={showLeaderboard} animationType="slide" transparent onRequestClose={() => setShowLeaderboard(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismiss} onPress={() => setShowLeaderboard(false)} activeOpacity={1} />
          <View style={[styles.leaderboardContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.leaderboardHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.leaderboardTitle, { color: colors.text }]}>🏆 Leaderboard</Text>
              <TouchableOpacity onPress={() => setShowLeaderboard(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={[styles.leaderboardTabs, { borderBottomColor: colors.border }]}>
              <TouchableOpacity 
                style={[styles.leaderboardTab, leaderboardTab === 'global' && styles.leaderboardTabActive]}
                onPress={() => setLeaderboardTab('global')}
              >
                <Text style={[styles.leaderboardTabText, { color: leaderboardTab === 'global' ? colors.primary : colors.textSecondary }]}>Global</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.leaderboardTab, leaderboardTab === 'friends' && styles.leaderboardTabActive]}
                onPress={() => setLeaderboardTab('friends')}
              >
                <Text style={[styles.leaderboardTabText, { color: leaderboardTab === 'friends' ? colors.primary : colors.textSecondary }]}>Friends</Text>
              </TouchableOpacity>
            </View>
            {loadingLeaderboard ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
            ) : (
            <FlatList
              data={leaderboardData}
              keyExtractor={(item) => item.id}
              style={styles.leaderboardList}
              renderItem={({ item }) => (
                <View style={[styles.leaderboardItem, item.isMe && { backgroundColor: 'rgba(255,204,0,0.15)' }]}>
                  <View style={styles.leaderboardRank}>
                    {item.rank <= 3 ? (
                      <Text style={styles.leaderboardMedal}>{item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉'}</Text>
                    ) : (
                      <Text style={[styles.leaderboardRankNum, { color: colors.textSecondary }]}>{item.rank}</Text>
                    )}
                  </View>
                  <Avatar uri={item.avatar} size={40} style={styles.leaderboardAvatar} />
                  <Text style={[styles.leaderboardUser, { color: colors.text }]}>{item.isMe ? 'You' : item.user}</Text>
                  <Text style={[styles.leaderboardScore, { color: colors.primary }]}>{item.score.toLocaleString()}</Text>
                </View>
              )}
            />
            )}
          </View>
        </View>
      </Modal>

      {/* Comments Modal */}
      <Modal visible={showComments} animationType="slide" transparent onRequestClose={() => setShowComments(false)}>
        <View style={styles.commentsModalOverlay}>
          <TouchableOpacity style={styles.commentsModalDismiss} onPress={() => setShowComments(false)} activeOpacity={1} />
          <View style={[styles.commentsContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.commentsHeader, { borderBottomColor: colors.border }]}>
              <View style={{ width: 60 }} />
              <Text style={[styles.commentsTitle, { color: colors.text }]}>Comments</Text>
              <View style={styles.commentsHeaderRight}>
                <TouchableOpacity style={styles.sortBtn}>
                  <Ionicons name="filter-outline" size={22} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowComments(false)}>
                  <Ionicons name="close" size={26} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.commentsContent}>
              {loadingComments ? (
                <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
              ) : commentsData.length === 0 ? (
                <View style={styles.emptyComments}>
                  <View style={[styles.emptyBubble, { borderColor: colors.textSecondary }]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.emptyCommentsText, { color: colors.textSecondary }]}>Start the conversation</Text>
                  <TouchableOpacity style={[styles.emptyCommentBtn, { backgroundColor: colors.background }]}>
                    <Text style={[styles.emptyCommentBtnText, { color: colors.text }]}>Comment</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={commentsData}
                  keyExtractor={(item) => item.id}
                  style={styles.commentsList}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  renderItem={({ item }) => (
                    <View style={styles.commentItem}>
                      <Avatar uri={item.avatar} size={40} style={styles.commentAvatar} />
                      <View style={styles.commentContent}>
                        <Text style={[styles.commentUser, { color: colors.textSecondary }]}>{item.displayName || item.username}</Text>
                        <Text style={[styles.commentText, { color: colors.text }]}>{item.text}</Text>
                        <View style={styles.commentActions}>
                          <Text style={[styles.commentTime, { color: colors.textSecondary }]}>{formatTimeAgo(item.createdAt)}</Text>
                          <TouchableOpacity>
                            <Text style={[styles.commentReply, { color: colors.textSecondary }]}>Reply</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.commentLikeSection}>
                        <TouchableOpacity>
                          <Ionicons name="heart-outline" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                        {item.likes > 0 && (
                          <Text style={[styles.commentLikeCount, { color: colors.textSecondary }]}>{item.likes}</Text>
                        )}
                      </View>
                    </View>
                  )}
                />
              )}
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={[styles.emojiBar, { borderTopColor: colors.border }]}>
                <TouchableOpacity style={styles.emojiGroup} onPress={() => setCommentText(prev => prev + '😂')}>
                  <Text style={styles.emojiGroupText}>😂😂😂</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.emojiGroup} onPress={() => setCommentText(prev => prev + '❤️')}>
                  <Text style={styles.emojiGroupText}>❤️❤️❤️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.emojiGroup} onPress={() => setCommentText(prev => prev + '😭')}>
                  <Text style={styles.emojiGroupText}>😭😭😭</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.emojiGroup} onPress={() => setCommentText(prev => prev + '💔')}>
                  <Text style={styles.emojiGroupText}>💔💔💔</Text>
                </TouchableOpacity>
              </View>
              
              <View style={[styles.commentInputArea, { paddingBottom: insets.bottom || 12, backgroundColor: colors.surface }]}>
                <Avatar uri={user?.avatar} size={32} style={styles.inputAvatar} />
                <View style={[styles.commentInputBox, { backgroundColor: colors.background }]}>
                  <TextInput
                    style={[styles.commentInput, { color: colors.text }]}
                    placeholder="Add comment..."
                    placeholderTextColor={colors.textSecondary}
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                    maxLength={500}
                    autoFocus={commentsData.length === 0 && !loadingComments}
                  />
                  <View style={styles.inputIcons}>
                    <TouchableOpacity style={styles.inputIcon}>
                      <Ionicons name="happy-outline" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.inputIcon}>
                      <Ionicons name="at" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
                {commentText.trim() ? (
                  <TouchableOpacity 
                    style={[styles.sendBtn, { backgroundColor: '#FE2C55' }]}
                    onPress={handlePostComment}
                    disabled={postingComment}
                  >
                    <Ionicons name="arrow-up" size={20} color="#fff" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  
  // Preview styles
  previewContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  previewIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  previewName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  previewDesc: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 40,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 40,
    gap: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  playButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  previewScore: {
    marginTop: 30,
    alignItems: 'center',
  },
  previewScoreLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  previewScoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },

  // Game modal styles
  gameModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: { 
    flex: 1, 
    backgroundColor: 'transparent' 
  },
  hidden: { opacity: 0 },
  loadingContainer: { 
    ...StyleSheet.absoluteFillObject, 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 5 
  },
  loadingText: { 
    color: '#fff', 
    marginTop: 12, 
    fontSize: 16, 
    fontWeight: '600' 
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    zIndex: 100,
  },
  closeButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Actions
  actions: { 
    position: 'absolute', 
    right: 12, 
    bottom: 160, 
    alignItems: 'center' 
  },
  actionItem: { 
    alignItems: 'center', 
    marginBottom: 20 
  },
  actionCount: { 
    fontSize: 12, 
    fontWeight: '600', 
    marginTop: 4, 
    color: '#fff' 
  },

  // Leaderboard styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  leaderboardContainer: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: SCREEN_HEIGHT * 0.6, paddingBottom: 40 },
  leaderboardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 0.5 },
  leaderboardTitle: { fontSize: 18, fontWeight: '700' },
  leaderboardTabs: { flexDirection: 'row', borderBottomWidth: 0.5 },
  leaderboardTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  leaderboardTabActive: { borderBottomWidth: 2, borderBottomColor: '#FFCC00' },
  leaderboardTabText: { fontSize: 15, fontWeight: '600' },
  leaderboardList: { paddingHorizontal: 16, paddingTop: 8 },
  leaderboardItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, marginBottom: 4 },
  leaderboardRank: { width: 32, alignItems: 'center' },
  leaderboardMedal: { fontSize: 22 },
  leaderboardRankNum: { fontSize: 16, fontWeight: '600' },
  leaderboardAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  leaderboardUser: { flex: 1, fontSize: 15, fontWeight: '600' },
  leaderboardScore: { fontSize: 16, fontWeight: '700' },
  
  // Comments styles
  commentsModalOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  commentsModalDismiss: { flex: 0.3 },
  commentsContainer: { flex: 0.7, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  commentsHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 20, width: 60, justifyContent: 'flex-end' },
  sortBtn: { padding: 2 },
  commentsTitle: { fontSize: 15, fontWeight: '600' },
  commentsContent: { flex: 1 },
  commentsList: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  emptyComments: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBubble: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyCommentsText: { fontSize: 16, marginBottom: 20 },
  emptyCommentBtn: { paddingHorizontal: 40, paddingVertical: 12, borderRadius: 4 },
  emptyCommentBtnText: { fontSize: 15, fontWeight: '600' },

  commentItem: { flexDirection: 'row', marginBottom: 20 },
  commentAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  commentContent: { flex: 1 },
  commentUser: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  commentText: { fontSize: 15, lineHeight: 20, marginBottom: 8 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  commentTime: { fontSize: 13 },
  commentReply: { fontSize: 13, fontWeight: '600' },
  commentLikeSection: { alignItems: 'center', paddingLeft: 16, paddingTop: 4 },
  commentLikeCount: { fontSize: 12, marginTop: 4 },
  emojiBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 0.5 },
  emojiGroup: { padding: 4 },
  emojiGroupText: { fontSize: 18 },
  commentInputArea: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, gap: 10 },
  inputAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  commentInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingLeft: 14, paddingRight: 8, paddingVertical: 8 },
  commentInput: { flex: 1, fontSize: 15, maxHeight: 80 },
  inputIcons: { flexDirection: 'row', gap: 4 },
  inputIcon: { padding: 4 },
  sendBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
});
