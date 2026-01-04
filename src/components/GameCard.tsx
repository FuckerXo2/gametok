import React, { useRef, useState, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  Dimensions, 
  Text, 
  TouchableOpacity, 
  Animated,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { scores, messages } from '../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MultiplayerModal } from './MultiplayerModal';
import { ShareSheet } from './ShareSheet';

const MULTIPLAYER_GAMES = [
  'tic-tac-toe', 'connect4', 'chess', 'rock-paper-scissors', 'pong',
  'tetris', '2048', 'flappy-bird', 'pacman', 'fruit-slicer',
  'piano-tiles', 'doodle-jump', 'geometry-dash', 'endless-runner',
  'crossy-road', 'breakout', 'ball-bounce', 'whack-a-mole', 'aim-trainer',
  'reaction-time', 'color-match', 'memory-match', 'tap-tap-dash',
  'number-tap', 'bubble-pop', 'simon-says', 'basketball', 'golf-putt',
  'snake-io', 'asteroids', 'space-invaders', 'missile-game', 'hexgl',
  'racer', 'clumsy-bird', 'hextris', 'tower-game',
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
  onPlayingChange?: (isPlaying: boolean) => void;
}

export const GameCard: React.FC<GameCardProps> = ({ game, gameUrl, isActive, onPlayingChange }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  
  const [score, setScore] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 500) + 50);
  const [commentCount] = useState(Math.floor(Math.random() * 200) + 20);
  const [gameLoaded, setGameLoaded] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  
  const heartScale = useRef(new Animated.Value(1)).current;
  const isMultiplayerGame = MULTIPLAYER_GAMES.includes(game.id);
  
  void colors;

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
    onPlayingChange?.(true);
    // Tell the game to start
    webViewRef.current?.injectJavaScript(`
      if (window.startGame) window.startGame();
      if (window.start) window.start();
      if (window.gameStart) window.gameStart();
      true;
    `);
  }, [onPlayingChange]);

  const handleExit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsPlaying(false);
    onPlayingChange?.(false);
    // Reload the game to reset it
    webViewRef.current?.reload();
  }, [onPlayingChange]);

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

  const handleShare = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowShareSheet(true);
  }, []);

  const handleSendToFriend = useCallback(async (friendId: string, gameId: string) => {
    try {
      await messages.send({
        recipientId: friendId,
        gameShare: { gameId },
      });
    } catch (e) {
      console.error('Failed to send game to friend:', e);
    }
  }, []);

  const handleSave = useCallback(() => {
    setIsSaved(prev => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden={isPlaying} />
      
      {/* Single WebView - used for both preview and playing */}
      {isActive && (
        <WebView
          ref={webViewRef}
          source={{ uri: gameUrl }}
          style={styles.webView}
          scrollEnabled={false}
          bounces={false}
          onLoadEnd={() => setGameLoaded(true)}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
      )}
      
      {/* Overlay - only show when NOT playing */}
      {!isPlaying && (
        <>
          {/* Dark overlay for readability */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
            locations={[0, 0.5, 1]}
            style={styles.overlay}
            pointerEvents="none"
          />

          {/* Center Play Button */}
          <TouchableOpacity 
            style={styles.centerPlayOverlay} 
            onPress={handlePlay}
            activeOpacity={0.8}
          >
            <View style={styles.centerPlayButton}>
              <Ionicons name="play" size={32} color="rgba(255,255,255,0.9)" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>

          {/* Loading state */}
          {!gameLoaded && isActive && (
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

            {/* Multiplayer Button */}
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

          {/* Side Actions - TikTok style */}
          <View style={[styles.sideActions, { bottom: insets.bottom + 100 }]}>
            {/* Game icon as "profile" */}
            <View style={styles.actionBtn}>
              <View style={[styles.gameIconCircle, { backgroundColor: game.color }]}>
                <Text style={styles.gameIconEmoji}>{game.icon}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons 
                  name={isLiked ? "heart" : "heart"} 
                  size={35} 
                  color={isLiked ? '#fe2c55' : '#fff'} 
                  style={styles.iconShadow}
                />
              </Animated.View>
              <Text style={styles.actionCount}>{formatNumber(likeCount)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => {}} activeOpacity={0.7}>
              <Ionicons 
                name="chatbubble-ellipses" 
                size={33} 
                color="#fff" 
                style={styles.iconShadow}
              />
              <Text style={styles.actionCount}>{formatNumber(commentCount)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleSave} activeOpacity={0.7}>
              <Ionicons 
                name={isSaved ? "bookmark" : "bookmark-outline"} 
                size={33} 
                color={isSaved ? '#fce300' : '#fff'} 
                style={styles.iconShadow}
              />
              <Text style={styles.actionCount}>{formatNumber(Math.floor(Math.random() * 50) + 10)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
              <Ionicons 
                name="arrow-redo" 
                size={33} 
                color="#fff" 
                style={styles.iconShadow}
              />
              <Text style={styles.actionCount}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Score badge if has score */}
          {score > 0 && (
            <View style={[styles.scoreBadge, { top: insets.top + 10 }]}>
              <Ionicons name="trophy" size={14} color="#FFD700" />
              <Text style={styles.scoreBadgeText}>{formatNumber(score)}</Text>
            </View>
          )}
        </>
      )}

      {/* Playing UI - Close button ABOVE WebView */}
      {isPlaying && (
        <View style={styles.playingOverlay} pointerEvents="box-none">
          <TouchableOpacity 
            style={[styles.closeBtn, { top: insets.top + 10 }]} 
            onPress={handleExit}
          >
            <BlurView intensity={50} tint="dark" style={styles.closeBtnBlur}>
              <Ionicons name="close" size={24} color="#fff" />
            </BlurView>
          </TouchableOpacity>

          {score > 0 && (
            <View style={[styles.liveScore, { top: insets.top + 10 }]}>
              <Text style={styles.liveScoreText}>{formatNumber(score)}</Text>
            </View>
          )}
        </View>
      )}

      <MultiplayerModal
        visible={showMultiplayer}
        gameId={game.id}
        gameName={game.name}
        onClose={() => setShowMultiplayer(false)}
      />

      <ShareSheet
        visible={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        gameId={game.id}
        gameName={game.name}
        gameIcon={game.icon}
        gameColor={game.color}
        onSendToFriend={handleSendToFriend}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  webView: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  centerPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPlayButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
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
  sideActions: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 18,
  },
  actionBtn: {
    alignItems: 'center',
  },
  gameIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    marginBottom: 4,
  },
  gameIconEmoji: {
    fontSize: 22,
  },
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  actionCount: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  playingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  closeBtn: {
    position: 'absolute',
    left: 16,
  },
  closeBtnBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
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
});

export default GameCard;
