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

const MULTIPLAYER_GAMES = [
  'tic-tac-toe', 'connect4', 'chess', 'rock-paper-scissors', 'pong',
  'tetris', '2048', 'flappy-bird', 'pacman', 'fruit-slicer',
  'piano-tiles', 'doodle-jump', 'geometry-dash', 'endless-runner',
  'crossy-road', 'breakout', 'ball-bounce', 'whack-a-mole', 'aim-trainer',
  'reaction-time', 'color-match', 'memory-match', 'tap-tap-dash',
  'number-tap', 'bubble-pop', 'simon-says', 'basketball', 'golf-putt',
  'snake-io', 'asteroids', 'space-invaders', 'missile-game', 'hexgl',
  'racer', 'run3', 'clumsy-bird', 'hextris', 'tower-game',
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface GameCardProps {
  game: {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    category?: string;
  };
  gameUrl: string;
  isActive: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({ game, gameUrl, isActive }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const playingWebViewRef = useRef<WebView>(null);
  
  const [score, setScore] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 500) + 50);
  const [commentCount, setCommentCount] = useState(Math.floor(Math.random() * 200) + 20);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [gameLoading, setGameLoading] = useState(true);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  
  const heartScale = useRef(new Animated.Value(1)).current;
  const isMultiplayerGame = MULTIPLAYER_GAMES.includes(game.id);

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

  const handlePlay = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPlaying(true);
    setGameLoading(true);
  }, []);

  const handlePause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPauseMenu(true);
    playingWebViewRef.current?.injectJavaScript(`
      if (window.gamePause) window.gamePause();
      if (window.pause) window.pause();
      true;
    `);
  }, []);

  const handleResume = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPauseMenu(false);
    playingWebViewRef.current?.injectJavaScript(`
      if (window.gameResume) window.gameResume();
      if (window.resume) window.resume();
      true;
    `);
  }, []);

  const handleRestart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowPauseMenu(false);
    setScore(0);
    playingWebViewRef.current?.reload();
  }, []);

  const handleExit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPauseMenu(false);
    setIsPlaying(false);
  }, []);

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
      await Share.share({ message: `Playing ${game.name} on GameTok! 🎮` });
    } catch (e) {}
  }, [game.name]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // PREVIEW - Live game running in background
  const renderPreview = () => (
    <View style={styles.container}>
      {/* Live Game Preview - Full Screen */}
      {isActive && (
        <WebView
          ref={webViewRef}
          source={{ uri: gameUrl }}
          style={styles.previewWebView}
          scrollEnabled={false}
          bounces={false}
          onLoadEnd={() => setPreviewLoaded(true)}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          pointerEvents="none"
        />
      )}
      
      {/* Dark overlay for readability */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
        locations={[0, 0.5, 1]}
        style={styles.overlay}
        pointerEvents="none"
      />

      {/* Loading state */}
      {!previewLoaded && isActive && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {/* Game Info - Bottom */}
      <View style={[styles.gameInfo, { paddingBottom: insets.bottom + 90 }]}>
        <View style={styles.gameHeader}>
          <View style={styles.gameTitleRow}>
            <Text style={styles.gameName}>{game.name}</Text>
            {isMultiplayerGame && (
              <View style={styles.multiplayerBadge}>
                <Ionicons name="people" size={12} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.gameDescription} numberOfLines={2}>{game.description}</Text>
        </View>

        {/* Play Button */}
        <View style={styles.playSection}>
          <TouchableOpacity style={styles.playButton} onPress={handlePlay} activeOpacity={0.9}>
            <LinearGradient
              colors={['#ff2d55', '#ff375f']}
              style={styles.playButtonGradient}
            >
              <Ionicons name="play" size={28} color="#fff" />
              <Text style={styles.playButtonText}>PLAY</Text>
            </LinearGradient>
          </TouchableOpacity>

          {isMultiplayerGame && (
            <TouchableOpacity 
              style={styles.multiplayerBtn} 
              onPress={() => setShowMultiplayer(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="people" size={22} color="#fff" />
              <Text style={styles.multiplayerBtnText}>1v1</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Side Actions */}
      <View style={[styles.sideActions, { bottom: insets.bottom + 100 }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowLeaderboard(true)}>
          <View style={styles.actionIcon}>
            <Ionicons name="trophy" size={28} color="#FFD700" />
          </View>
          <Text style={styles.actionLabel}>Rank</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
          <Animated.View style={[styles.actionIcon, { transform: [{ scale: heartScale }] }]}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={30} color={isLiked ? '#ff2d55' : '#fff'} />
          </Animated.View>
          <Text style={styles.actionLabel}>{formatNumber(likeCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments(true)}>
          <View style={styles.actionIcon}>
            <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
          </View>
          <Text style={styles.actionLabel}>{formatNumber(commentCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowShareModal(true)}>
          <View style={styles.actionIcon}>
            <Ionicons name="paper-plane" size={24} color="#fff" />
          </View>
          <Text style={styles.actionLabel}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Score badge if has score */}
      {score > 0 && (
        <View style={[styles.scoreBadge, { top: insets.top + 10 }]}>
          <Ionicons name="trophy" size={14} color="#FFD700" />
          <Text style={styles.scoreBadgeText}>{formatNumber(score)}</Text>
        </View>
      )}
    </View>
  );

  // FULLSCREEN GAME
  const renderGame = () => (
    <Modal visible={isPlaying} animationType="fade" statusBarTranslucent onRequestClose={handlePause}>
      <View style={styles.gameContainer}>
        <StatusBar hidden />
        
        {gameLoading && (
          <View style={styles.gameLoadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.gameLoadingText}>Loading {game.name}...</Text>
          </View>
        )}
        
        <WebView
          ref={playingWebViewRef}
          source={{ uri: gameUrl }}
          style={styles.gameWebView}
          scrollEnabled={false}
          bounces={false}
          onMessage={handleMessage}
          onLoadEnd={() => setGameLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
        
        {/* Pause Button */}
        <TouchableOpacity 
          style={[styles.pauseBtn, { top: insets.top + 10 }]} 
          onPress={handlePause}
        >
          <BlurView intensity={50} tint="dark" style={styles.pauseBtnBlur}>
            <Ionicons name="pause" size={20} color="#fff" />
          </BlurView>
        </TouchableOpacity>

        {/* Live Score */}
        {score > 0 && (
          <View style={[styles.liveScore, { top: insets.top + 10 }]}>
            <Text style={styles.liveScoreText}>{formatNumber(score)}</Text>
          </View>
        )}

        {/* Pause Menu */}
        {showPauseMenu && (
          <View style={styles.pauseOverlay}>
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.pauseMenu}>
              <Text style={styles.pauseTitle}>PAUSED</Text>
              <Text style={styles.pauseGameName}>{game.name}</Text>
              
              {score > 0 && (
                <View style={styles.pauseScoreBox}>
                  <Text style={styles.pauseScoreLabel}>Score</Text>
                  <Text style={styles.pauseScoreValue}>{formatNumber(score)}</Text>
                </View>
              )}

              <TouchableOpacity style={styles.pauseMenuBtn} onPress={handleResume}>
                <LinearGradient colors={['#22c55e', '#16a34a']} style={styles.pauseMenuBtnGradient}>
                  <Ionicons name="play" size={22} color="#fff" />
                  <Text style={styles.pauseMenuBtnText}>Resume</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.pauseMenuBtn} onPress={handleRestart}>
                <View style={[styles.pauseMenuBtnGradient, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <Ionicons name="refresh" size={22} color="#fff" />
                  <Text style={styles.pauseMenuBtnText}>Restart</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.pauseMenuBtn} onPress={handleExit}>
                <View style={[styles.pauseMenuBtnGradient, { backgroundColor: 'rgba(255,59,48,0.3)' }]}>
                  <Ionicons name="exit-outline" size={22} color="#ff3b30" />
                  <Text style={[styles.pauseMenuBtnText, { color: '#ff3b30' }]}>Exit</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );

  return (
    <>
      {renderPreview()}
      {renderGame()}
      
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
    backgroundColor: '#000',
  },
  
  // Preview
  previewWebView: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  
  // Game Info
  gameInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 70,
    paddingHorizontal: 16,
  },
  gameHeader: {
    marginBottom: 16,
  },
  gameTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gameName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  multiplayerBadge: {
    backgroundColor: '#ff2d55',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gameDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  // Play Section
  playSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    flex: 1,
  },
  playButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  playButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  multiplayerBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  multiplayerBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  
  // Side Actions
  sideActions: {
    position: 'absolute',
    right: 8,
    alignItems: 'center',
    gap: 20,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  // Score Badge
  scoreBadge: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  scoreBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  
  // Game Container
  gameContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  gameWebView: {
    flex: 1,
  },
  gameLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    zIndex: 10,
  },
  gameLoadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  
  // Pause Button
  pauseBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
  },
  pauseBtnBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  
  // Live Score
  liveScore: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  liveScoreText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  
  // Pause Menu
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  pauseMenu: {
    width: '80%',
    maxWidth: 320,
    alignItems: 'center',
  },
  pauseTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 4,
  },
  pauseGameName: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    marginBottom: 24,
  },
  pauseScoreBox: {
    alignItems: 'center',
    marginBottom: 30,
  },
  pauseScoreLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  pauseScoreValue: {
    fontSize: 48,
    fontWeight: '800',
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
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  pauseMenuBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default GameCard;