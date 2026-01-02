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
  Alert,
  Image,
  ImageBackground,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { scores, comments as commentsApi, users, messages as messagesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';
import { MultiplayerModal } from './MultiplayerModal';

// Games that support multiplayer - ALL games with score competition + turn-based
const MULTIPLAYER_GAMES = [
  // Turn-based
  'tic-tac-toe', 'connect4', 'chess', 'rock-paper-scissors',
  // Real-time
  'pong',
  // Score competition (play same game, highest score wins)
  'tetris', '2048', 'flappy-bird', 'pacman', 'fruit-slicer',
  'piano-tiles', 'doodle-jump', 'geometry-dash', 'endless-runner',
  'crossy-road', 'breakout', 'ball-bounce', 'whack-a-mole', 'aim-trainer',
  'reaction-time', 'color-match', 'memory-match', 'tap-tap-dash',
  'number-tap', 'bubble-pop', 'simon-says', 'basketball', 'golf-putt',
  'snake-io', 'asteroids', 'space-invaders', 'missile-game', 'hexgl',
  'racer', 'run3', 'clumsy-bird', 'hextris', 'tower-game',
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Game category configs with unique visual styles
const GAME_CATEGORIES: Record<string, { gradient: string[], accent: string, tag: string }> = {
  arcade: { gradient: ['#667eea', '#764ba2'], accent: '#a855f7', tag: 'ARCADE' },
  puzzle: { gradient: ['#f093fb', '#f5576c'], accent: '#ec4899', tag: 'PUZZLE' },
  action: { gradient: ['#fa709a', '#fee140'], accent: '#f97316', tag: 'ACTION' },
  racing: { gradient: ['#30cfd0', '#330867'], accent: '#06b6d4', tag: 'RACING' },
  strategy: { gradient: ['#a8edea', '#fed6e3'], accent: '#14b8a6', tag: 'STRATEGY' },
  casual: { gradient: ['#ffecd2', '#fcb69f'], accent: '#fb923c', tag: 'CASUAL' },
  retro: { gradient: ['#0f0c29', '#302b63', '#24243e'], accent: '#8b5cf6', tag: 'RETRO' },
  sports: { gradient: ['#11998e', '#38ef7d'], accent: '#22c55e', tag: 'SPORTS' },
};

// Map games to categories
const getGameCategory = (gameId: string): string => {
  const categories: Record<string, string> = {
    'pacman': 'arcade', 'tetris': 'puzzle', 'snake': 'arcade', '2048': 'puzzle',
    'flappy-bird': 'casual', 'fruit-slicer': 'action', 'piano-tiles': 'arcade',
    'hexgl': 'racing', 'browserquest': 'action', 'breakout': 'arcade',
    'geometry-dash': 'action', 'doodle-jump': 'casual', 'crossy-road': 'casual',
    'space-invaders': 'retro', 'asteroids': 'retro', 'pong': 'retro',
    'chess': 'strategy', 'connect4': 'strategy', 'tic-tac-toe': 'strategy',
  };
  return categories[gameId] || 'arcade';
};

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

interface Friend {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

interface GameCardProps {
  game: {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    thumbnail?: string;
    category?: string;
  };
  gameUrl: string;
  isActive: boolean;
}

const FAKE_LEADERBOARD = [
  { id: '1', rank: 1, user: 'speedrunner', avatar: null, score: 12450, isMe: false },
  { id: '2', rank: 2, user: 'gamer_pro', avatar: null, score: 11200, isMe: false },
  { id: '3', rank: 3, user: 'ninja_master', avatar: null, score: 9800, isMe: false },
  { id: '4', rank: 4, user: 'casual_player', avatar: null, score: 8500, isMe: false },
  { id: '5', rank: 5, user: 'you', avatar: null, score: 7200, isMe: true },
  { id: '6', rank: 6, user: 'newbie_2024', avatar: null, score: 5400, isMe: false },
];

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
  const cardScale = useRef(new Animated.Value(1)).current;
  
  // Playing state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  
  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [commentsData, setCommentsData] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Share to chat state
  const [showShareModal, setShowShareModal] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [sendingShare, setSendingShare] = useState(false);
  const [shareMessage, setShareMessage] = useState('');

  // Multiplayer state
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  const isMultiplayerGame = MULTIPLAYER_GAMES.includes(game.id);

  // Get category styling
  const category = getGameCategory(game.id);
  const categoryStyle = GAME_CATEGORIES[category] || GAME_CATEGORIES.arcade;

  useEffect(() => {
    if (showLeaderboard) fetchLeaderboard();
  }, [showLeaderboard, leaderboardTab]);

  useEffect(() => {
    if (showComments) fetchComments();
  }, [showComments]);

  useEffect(() => {
    if (showShareModal) fetchFriends();
  }, [showShareModal]);

  const fetchFriends = async () => {
    if (!user?.id) return;
    setLoadingFriends(true);
    try {
      const data = await users.following(user.id);
      setFriends(data.following || []);
    } catch (e) {
      console.log('Failed to fetch friends:', e);
    } finally {
      setLoadingFriends(false);
    }
  };

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

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const data = await scores.leaderboard(game.id, leaderboardTab, 20);
      if (data.leaderboard && data.leaderboard.length > 0) {
        const formatted = data.leaderboard.map((entry: any, index: number) => ({
          id: entry.userId || String(index),
          rank: index + 1,
          user: entry.username || 'Unknown',
          avatar: entry.avatar || null,
          score: entry.score,
          isMe: entry.userId === user?.id,
        }));
        setLeaderboardData(formatted);
      }
    } catch (e) {}
    finally { setLoadingLeaderboard(false); }
  };

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'gameOver') {
        setScore(data.score);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (data.score > 0) scores.submit(game.id, data.score).catch(() => {});
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

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

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

  // Play/Pause handlers
  const handlePlay = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(cardScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    setIsPlaying(true);
    setIsPaused(false);
  }, []);

  const handlePausePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPauseMenu(true);
    setIsPaused(true);
    // Send pause message to game
    webViewRef.current?.injectJavaScript(`
      if (window.gamePause) window.gamePause();
      if (window.pause) window.pause();
      true;
    `);
  }, []);

  const handleResume = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPauseMenu(false);
    setIsPaused(false);
    // Send resume message to game
    webViewRef.current?.injectJavaScript(`
      if (window.gameResume) window.gameResume();
      if (window.resume) window.resume();
      true;
    `);
  }, []);

  const handleRestart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowPauseMenu(false);
    setIsPaused(false);
    setScore(0);
    webViewRef.current?.reload();
  }, []);

  const handleExit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPauseMenu(false);
    setIsPaused(false);
    setIsPlaying(false);
  }, []);

  const handleOpenLeaderboard = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowLeaderboard(true);
  }, []);

  const handleOpenComments = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowComments(true);
  }, []);

  const handleOpenShareToChat = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowShareModal(true);
    setSelectedFriends([]);
    setShareMessage('');
  }, []);

  const handleOpenMultiplayer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowMultiplayer(true);
  }, []);

  const toggleFriendSelection = useCallback((friendId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFriends(prev => 
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  }, []);

  const handleSendToFriends = async () => {
    if (selectedFriends.length === 0) {
      Alert.alert('Select Friends', 'Please select at least one friend to share with');
      return;
    }
    setSendingShare(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const gameShareText = `Check out ${game.name}!\n${shareMessage ? `"${shareMessage}"` : 'Play it now!'}\n[GAME:${game.id}]`;
      await Promise.all(
        selectedFriends.map(friendId => messagesApi.send({ recipientId: friendId, text: gameShareText }))
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowShareModal(false);
      Alert.alert('Sent!', `Game shared with ${selectedFriends.length} friend${selectedFriends.length > 1 ? 's' : ''}`);
    } catch (e) {
      console.log('Failed to share game:', e);
      Alert.alert('Error', 'Failed to send. Please try again.');
    } finally {
      setSendingShare(false);
    }
  };

  // Preview card - unique per game with gradient backgrounds
  const renderPreview = () => (
    <View style={styles.container}>
      {/* Full screen gradient background */}
      <LinearGradient
        colors={['#0a0a0a', '#1a1a2e', '#0a0a0a']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Animated glow effect */}
      <View style={[styles.glowOrb, { backgroundColor: categoryStyle.accent, top: '15%', left: '5%' }]} />
      <View style={[styles.glowOrb, { backgroundColor: game.color, top: '60%', right: '10%', opacity: 0.2 }]} />

      {/* Main Card */}
      <Animated.View style={[styles.cardWrapper, { transform: [{ scale: cardScale }] }]}>
        <LinearGradient
          colors={categoryStyle.gradient as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gameCard}
        >
          {/* Category Tag */}
          <View style={styles.categoryTag}>
            <Ionicons name="game-controller" size={10} color="#fff" />
            <Text style={styles.categoryTagText}>{categoryStyle.tag}</Text>
          </View>

          {/* Score Badge (if has score) */}
          {score > 0 && (
            <View style={styles.scoreBadge}>
              <Ionicons name="trophy" size={12} color="#FFD700" />
              <Text style={styles.scoreBadgeText}>{formatNumber(score)}</Text>
            </View>
          )}

          {/* Game Visual - Thumbnail or styled letter icon */}
          <View style={styles.gameVisual}>
            {game.thumbnail ? (
              <Image source={{ uri: game.thumbnail }} style={styles.gameThumbnail} resizeMode="cover" />
            ) : (
              <View style={[styles.iconFallback, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={styles.gameIconLetter}>{game.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>

          {/* Game Title */}
          <Text style={styles.gameTitle}>{game.name}</Text>
          <Text style={styles.gameDescription} numberOfLines={2}>{game.description}</Text>

          {/* Play Buttons */}
          <View style={styles.playButtons}>
            <TouchableOpacity style={styles.playButton} onPress={handlePlay} activeOpacity={0.85}>
              <LinearGradient
                colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']}
                style={styles.playButtonGradient}
              >
                <Ionicons name="play" size={22} color="#fff" />
                <Text style={styles.playButtonText}>PLAY</Text>
              </LinearGradient>
            </TouchableOpacity>

            {isMultiplayerGame && (
              <TouchableOpacity style={styles.multiplayerButton} onPress={handleOpenMultiplayer} activeOpacity={0.85}>
                <View style={styles.multiplayerButtonInner}>
                  <Ionicons name="people" size={20} color="#fff" />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="heart" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.statValue}>{formatNumber(likeCount)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="chatbubble" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.statValue}>{formatNumber(commentCount)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="play-circle" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.statValue}>{formatNumber(Math.floor(Math.random() * 50000) + 1000)}</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Side Actions */}
      <View style={styles.sideActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleOpenLeaderboard} activeOpacity={0.8}>
          <View style={[styles.actionBtnBg, { backgroundColor: 'rgba(255,215,0,0.2)' }]}>
            <Ionicons name="trophy" size={24} color="#FFD700" />
          </View>
          <Text style={styles.actionLabel}>Rank</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.8}>
          <Animated.View style={[styles.actionBtnBg, { transform: [{ scale: heartScale }] }]}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={26} color={isLiked ? '#ff2d55' : '#fff'} />
          </Animated.View>
          <Text style={styles.actionLabel}>{formatNumber(likeCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleOpenComments} activeOpacity={0.8}>
          <View style={styles.actionBtnBg}>
            <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
          </View>
          <Text style={styles.actionLabel}>{formatNumber(commentCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
          <View style={styles.actionBtnBg}>
            <Ionicons name="bookmark-outline" size={24} color="#fff" />
          </View>
          <Text style={styles.actionLabel}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleOpenShareToChat} activeOpacity={0.8}>
          <View style={styles.actionBtnBg}>
            <Ionicons name="paper-plane" size={22} color="#fff" />
          </View>
          <Text style={styles.actionLabel}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom hint */}
      <View style={[styles.bottomHint, { paddingBottom: insets.bottom + 80 }]}>
        <Ionicons name="chevron-up" size={16} color="rgba(255,255,255,0.3)" />
        <Text style={styles.hintText}>Swipe for more</Text>
      </View>
    </View>
  );

  // Fullscreen game with pause menu
  const renderGameModal = () => (
    <Modal visible={isPlaying} animationType="fade" statusBarTranslucent onRequestClose={handlePausePress}>
      <View style={styles.gameModal}>
        <StatusBar hidden />
        
        {isLoading && (
          <LinearGradient colors={categoryStyle.gradient as [string, string, ...string[]]} style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading {game.name}...</Text>
          </LinearGradient>
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
        />
        
        {/* Pause Button - Top Left */}
        <TouchableOpacity style={[styles.pauseBtn, { top: insets.top + 10 }]} onPress={handlePausePress} activeOpacity={0.8}>
          <View style={styles.pauseBtnInner}>
            <Ionicons name="pause" size={20} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Score Display - Top Right */}
        {score > 0 && (
          <View style={[styles.liveScore, { top: insets.top + 10 }]}>
            <Text style={styles.liveScoreText}>{formatNumber(score)}</Text>
          </View>
        )}

        {/* Pause Menu Overlay */}
        {showPauseMenu && (
          <View style={styles.pauseOverlay}>
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.pauseMenu}>
              <Text style={styles.pauseTitle}>PAUSED</Text>
              <Text style={styles.pauseGameName}>{game.name}</Text>
              
              {score > 0 && (
                <View style={styles.pauseScoreBox}>
                  <Text style={styles.pauseScoreLabel}>Current Score</Text>
                  <Text style={styles.pauseScoreValue}>{formatNumber(score)}</Text>
                </View>
              )}

              <TouchableOpacity style={styles.pauseMenuBtn} onPress={handleResume} activeOpacity={0.8}>
                <LinearGradient colors={['#22c55e', '#16a34a']} style={styles.pauseMenuBtnGradient}>
                  <Ionicons name="play" size={22} color="#fff" />
                  <Text style={styles.pauseMenuBtnText}>Resume</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.pauseMenuBtn} onPress={handleRestart} activeOpacity={0.8}>
                <View style={[styles.pauseMenuBtnGradient, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <Ionicons name="refresh" size={22} color="#fff" />
                  <Text style={styles.pauseMenuBtnText}>Restart</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.pauseMenuBtn} onPress={handleExit} activeOpacity={0.8}>
                <View style={[styles.pauseMenuBtnGradient, { backgroundColor: 'rgba(255,59,48,0.3)' }]}>
                  <Ionicons name="exit-outline" size={22} color="#ff3b30" />
                  <Text style={[styles.pauseMenuBtnText, { color: '#ff3b30' }]}>Exit Game</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );

  // Leaderboard Modal
  const renderLeaderboardModal = () => (
    <Modal visible={showLeaderboard} animationType="slide" transparent onRequestClose={() => setShowLeaderboard(false)}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalDismiss} onPress={() => setShowLeaderboard(false)} activeOpacity={1} />
        <View style={[styles.leaderboardContainer, { backgroundColor: colors.surface }]}>
          <View style={[styles.leaderboardHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.leaderboardTitle, { color: colors.text }]}>Leaderboard</Text>
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
                      <Text style={styles.leaderboardMedal}>{item.rank === 1 ? '1st' : item.rank === 2 ? '2nd' : '3rd'}</Text>
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
  );

  // Comments Modal
  const renderCommentsModal = () => (
    <Modal visible={showComments} animationType="slide" transparent onRequestClose={() => setShowComments(false)}>
      <View style={styles.commentsModalOverlay}>
        <TouchableOpacity style={styles.commentsModalDismiss} onPress={() => setShowComments(false)} activeOpacity={1} />
        <View style={[styles.commentsContainer, { backgroundColor: colors.surface }]}>
          <View style={[styles.commentsHeader, { borderBottomColor: colors.border }]}>
            <View style={{ width: 60 }} />
            <Text style={[styles.commentsTitle, { color: colors.text }]}>Comments</Text>
            <View style={styles.commentsHeaderRight}>
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
                <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyCommentsText, { color: colors.textSecondary }]}>No comments yet</Text>
                <Text style={[styles.emptyCommentsSubtext, { color: colors.textSecondary }]}>Be the first to comment!</Text>
              </View>
            ) : (
              <FlatList
                data={commentsData}
                keyExtractor={(item) => item.id}
                style={styles.commentsList}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <Avatar uri={item.avatar} size={36} style={styles.commentAvatar} />
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
                    <TouchableOpacity style={styles.commentLikeBtn}>
                      <Ionicons name="heart-outline" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.commentInputArea, { paddingBottom: insets.bottom || 12, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              <Avatar uri={user?.avatar} size={32} style={styles.inputAvatar} />
              <View style={[styles.commentInputBox, { backgroundColor: colors.background }]}>
                <TextInput
                  style={[styles.commentInput, { color: colors.text }]}
                  placeholder="Add a comment..."
                  placeholderTextColor={colors.textSecondary}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={500}
                />
              </View>
              {commentText.trim() ? (
                <TouchableOpacity style={styles.sendCommentBtn} onPress={handlePostComment} disabled={postingComment}>
                  <Ionicons name="arrow-up" size={20} color="#fff" />
                </TouchableOpacity>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );

  // Share Modal
  const renderShareModal = () => (
    <Modal visible={showShareModal} animationType="slide" transparent onRequestClose={() => setShowShareModal(false)}>
      <View style={styles.shareModalOverlay}>
        <TouchableOpacity style={styles.shareModalDismiss} onPress={() => setShowShareModal(false)} activeOpacity={1} />
        <View style={[styles.shareContainer, { backgroundColor: colors.surface }]}>
          <View style={[styles.shareHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowShareModal(false)}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.shareTitle, { color: colors.text }]}>Send to</Text>
            <TouchableOpacity onPress={handleSendToFriends} disabled={selectedFriends.length === 0 || sendingShare}>
              {sendingShare ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.shareSendText, { color: selectedFriends.length > 0 ? colors.primary : colors.textSecondary }]}>Send</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Game Preview */}
          <LinearGradient colors={categoryStyle.gradient as [string, string, ...string[]]} style={styles.shareGamePreview}>
            <Text style={styles.shareGameIcon}>{game.icon}</Text>
            <View style={styles.shareGameInfo}>
              <Text style={styles.shareGameName}>{game.name}</Text>
              <Text style={styles.shareGameDesc} numberOfLines={1}>{game.description}</Text>
            </View>
          </LinearGradient>

          {/* Message Input */}
          <View style={[styles.shareMessageBox, { backgroundColor: colors.background }]}>
            <TextInput
              style={[styles.shareMessageInput, { color: colors.text }]}
              placeholder="Add a message..."
              placeholderTextColor={colors.textSecondary}
              value={shareMessage}
              onChangeText={setShareMessage}
              maxLength={100}
            />
          </View>

          <Text style={[styles.shareSectionTitle, { color: colors.textSecondary }]}>Friends</Text>
          
          {loadingFriends ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : friends.length === 0 ? (
            <View style={styles.emptyFriends}>
              <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyFriendsText, { color: colors.textSecondary }]}>Follow people to share games</Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(item) => item.id}
              style={styles.friendsList}
              contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              renderItem={({ item }) => {
                const isSelected = selectedFriends.includes(item.id);
                return (
                  <TouchableOpacity style={styles.friendItem} onPress={() => toggleFriendSelection(item.id)} activeOpacity={0.7}>
                    <Avatar uri={item.avatar} size={44} />
                    <View style={styles.friendInfo}>
                      <Text style={[styles.friendName, { color: colors.text }]}>{item.displayName || item.username}</Text>
                      <Text style={[styles.friendUsername, { color: colors.textSecondary }]}>@{item.username}</Text>
                    </View>
                    <View style={[styles.friendCheckbox, { borderColor: isSelected ? colors.primary : colors.border }, isSelected && { backgroundColor: colors.primary }]}>
                      {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      {renderPreview()}
      {renderGameModal()}
      {renderLeaderboardModal()}
      {renderCommentsModal()}
      {renderShareModal()}
      
      {/* Multiplayer Modal */}
      <MultiplayerModal
        visible={showMultiplayer}
        gameId={game.id}
        gameName={game.name}
        onClose={() => setShowMultiplayer(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: { 
    width: SCREEN_WIDTH, 
    height: SCREEN_HEIGHT,
    backgroundColor: '#0a0a0a',
  },
  
  // Glow effects
  glowOrb: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.3,
    transform: [{ scale: 2 }],
  },

  // Card
  cardWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingRight: 70,
  },
  gameCard: {
    width: '100%',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 25,
  },
  categoryTag: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  categoryTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1.5,
  },
  scoreBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  scoreBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD700',
  },

  // Game visual
  gameVisual: {
    width: 120,
    height: 120,
    borderRadius: 28,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 20,
  },
  gameThumbnail: {
    width: '100%',
    height: '100%',
  },
  iconFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameIconLetter: {
    fontSize: 52,
    fontWeight: '800',
    color: '#fff',
    opacity: 0.9,
  },

  // Text
  gameTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  gameDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 8,
  },

  // Play buttons
  playButtons: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 20,
    gap: 10,
  },
  playButton: {
    flex: 1,
  },
  playButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  playButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  multiplayerButton: {
    width: 54,
  },
  multiplayerButtonInner: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 14,
  },

  // Side actions
  sideActions: { 
    position: 'absolute', 
    right: 12, 
    bottom: 180, 
    alignItems: 'center',
  },
  actionBtn: { 
    alignItems: 'center', 
    marginBottom: 16,
  },
  actionBtnBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: { 
    fontSize: 11, 
    fontWeight: '600', 
    marginTop: 4, 
    color: '#fff',
  },

  // Bottom hint
  bottomHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },

  // Game modal
  gameModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: { 
    flex: 1, 
    backgroundColor: 'transparent',
  },
  hidden: { 
    opacity: 0,
  },
  loadingOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 5,
  },
  loadingText: { 
    color: '#fff', 
    marginTop: 16, 
    fontSize: 16, 
    fontWeight: '600',
  },

  // Pause button
  pauseBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 100,
  },
  pauseBtnInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Live score
  liveScore: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    zIndex: 100,
  },
  liveScoreText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Pause overlay
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  pauseMenu: {
    width: SCREEN_WIDTH * 0.8,
    backgroundColor: 'rgba(20,20,30,0.95)',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  pauseTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 4,
    marginBottom: 8,
  },
  pauseGameName: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 24,
  },
  pauseScoreBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  pauseScoreLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  pauseScoreValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFD700',
  },
  pauseMenuBtn: {
    width: '100%',
    marginBottom: 12,
  },
  pauseMenuBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
  },
  pauseMenuBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Leaderboard
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'flex-end',
  },
  modalDismiss: { 
    flex: 1,
  },
  leaderboardContainer: { 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    maxHeight: SCREEN_HEIGHT * 0.6, 
    paddingBottom: 40,
  },
  leaderboardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    borderBottomWidth: 0.5,
  },
  leaderboardTitle: { 
    fontSize: 18, 
    fontWeight: '700',
  },
  leaderboardTabs: { 
    flexDirection: 'row', 
    borderBottomWidth: 0.5,
  },
  leaderboardTab: { 
    flex: 1, 
    paddingVertical: 12, 
    alignItems: 'center',
  },
  leaderboardTabActive: { 
    borderBottomWidth: 2, 
    borderBottomColor: '#FFCC00',
  },
  leaderboardTabText: { 
    fontSize: 15, 
    fontWeight: '600',
  },
  leaderboardList: { 
    paddingHorizontal: 16, 
    paddingTop: 8,
  },
  leaderboardItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 8, 
    borderRadius: 12, 
    marginBottom: 4,
  },
  leaderboardRank: { 
    width: 36, 
    alignItems: 'center',
  },
  leaderboardMedal: { 
    fontSize: 14, 
    fontWeight: '800',
    color: '#FFD700',
  },
  leaderboardRankNum: { 
    fontSize: 15, 
    fontWeight: '600',
  },
  leaderboardAvatar: { 
    marginRight: 12,
  },
  leaderboardUser: { 
    flex: 1, 
    fontSize: 15, 
    fontWeight: '600',
  },
  leaderboardScore: { 
    fontSize: 16, 
    fontWeight: '700',
  },

  // Comments
  commentsModalOverlay: { 
    flex: 1, 
    backgroundColor: 'transparent', 
    justifyContent: 'flex-end',
  },
  commentsModalDismiss: { 
    flex: 0.3,
  },
  commentsContainer: { 
    flex: 0.7, 
    borderTopLeftRadius: 16, 
    borderTopRightRadius: 16,
  },
  commentsHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    borderBottomWidth: 0.5,
  },
  commentsHeaderRight: { 
    width: 60, 
    alignItems: 'flex-end',
  },
  commentsTitle: { 
    fontSize: 16, 
    fontWeight: '600',
  },
  commentsContent: { 
    flex: 1,
  },
  commentsList: { 
    flex: 1, 
    paddingHorizontal: 16, 
    paddingTop: 16,
  },
  emptyComments: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyCommentsText: { 
    fontSize: 17, 
    fontWeight: '600',
    marginTop: 16,
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  commentItem: { 
    flexDirection: 'row', 
    marginBottom: 20,
  },
  commentAvatar: { 
    marginRight: 12,
  },
  commentContent: { 
    flex: 1,
  },
  commentUser: { 
    fontSize: 13, 
    fontWeight: '600', 
    marginBottom: 3,
  },
  commentText: { 
    fontSize: 15, 
    lineHeight: 20, 
    marginBottom: 6,
  },
  commentActions: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16,
  },
  commentTime: { 
    fontSize: 12,
  },
  commentReply: { 
    fontSize: 12, 
    fontWeight: '600',
  },
  commentLikeBtn: { 
    paddingLeft: 12, 
    paddingTop: 4,
  },
  commentInputArea: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 12, 
    paddingTop: 10, 
    gap: 10,
    borderTopWidth: 0.5,
  },
  inputAvatar: {},
  commentInputBox: { 
    flex: 1, 
    borderRadius: 20, 
    paddingHorizontal: 14, 
    paddingVertical: 10,
  },
  commentInput: { 
    fontSize: 15, 
    maxHeight: 80,
  },
  sendCommentBtn: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#FE2C55',
    justifyContent: 'center', 
    alignItems: 'center',
  },

  // Share modal
  shareModalOverlay: { 
    flex: 1, 
    backgroundColor: 'transparent', 
    justifyContent: 'flex-end',
  },
  shareModalDismiss: { 
    flex: 0.2,
  },
  shareContainer: { 
    flex: 0.8, 
    borderTopLeftRadius: 16, 
    borderTopRightRadius: 16,
  },
  shareHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    borderBottomWidth: 0.5,
  },
  shareTitle: { 
    fontSize: 16, 
    fontWeight: '600',
  },
  shareSendText: { 
    fontSize: 16, 
    fontWeight: '600',
  },
  shareGamePreview: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    margin: 16, 
    padding: 14, 
    borderRadius: 14,
  },
  shareGameIcon: { 
    fontSize: 32, 
    marginRight: 12,
  },
  shareGameInfo: { 
    flex: 1,
  },
  shareGameName: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#fff', 
    marginBottom: 2,
  },
  shareGameDesc: { 
    fontSize: 13, 
    color: 'rgba(255,255,255,0.75)',
  },
  shareMessageBox: { 
    marginHorizontal: 16, 
    marginBottom: 16, 
    borderRadius: 12, 
    paddingHorizontal: 14, 
    paddingVertical: 12,
  },
  shareMessageInput: { 
    fontSize: 15,
  },
  shareSectionTitle: { 
    fontSize: 12, 
    fontWeight: '700', 
    marginHorizontal: 16, 
    marginBottom: 12, 
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  friendsList: { 
    flex: 1, 
    paddingHorizontal: 16,
  },
  friendItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 10,
  },
  friendInfo: { 
    flex: 1, 
    marginLeft: 12,
  },
  friendName: { 
    fontSize: 15, 
    fontWeight: '600',
  },
  friendUsername: { 
    fontSize: 13, 
    marginTop: 1,
  },
  friendCheckbox: { 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    borderWidth: 2, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  emptyFriends: { 
    alignItems: 'center', 
    paddingTop: 50,
  },
  emptyFriendsText: { 
    fontSize: 14, 
    textAlign: 'center', 
    marginTop: 12,
    paddingHorizontal: 40,
  },
});
