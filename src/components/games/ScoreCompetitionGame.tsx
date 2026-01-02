// Score Competition - Both players play same game, highest score wins
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface ScoreCompetitionProps {
  gameId: string;
  gameUrl: string;
  gameName: string;
  gameState: {
    scores: Record<string, number>;
    finished: Record<string, boolean>;
    timeLimit?: number;
    startTime?: number;
  };
  onScoreUpdate: (score: number) => void;
  onGameFinished: () => void;
  myId: string;
  opponentId: string;
  colors: any;
}

const ScoreCompetitionGame: React.FC<ScoreCompetitionProps> = ({
  gameUrl,
  gameName,
  gameState,
  onScoreUpdate,
  onGameFinished,
  opponentId,
  colors,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [myScore, setMyScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(gameState.timeLimit || 60);
  const [gameEnded, setGameEnded] = useState(false);

  const opponentScore = gameState.scores[opponentId] || 0;
  const opponentFinished = gameState.finished[opponentId] || false;
  const iWon = gameEnded && myScore > opponentScore;
  const isDraw = gameEnded && myScore === opponentScore;

  // Timer countdown
  useEffect(() => {
    if (gameState.timeLimit && !gameEnded) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameEnded]);

  const handleTimeUp = () => {
    setGameEnded(true);
    onGameFinished();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'score') {
        setMyScore(data.score);
        onScoreUpdate(data.score);
      } else if (data.type === 'gameOver') {
        setMyScore(data.score);
        onScoreUpdate(data.score);
        setGameEnded(true);
        onGameFinished();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (e) {}
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Game ended overlay
  if (gameEnded && opponentFinished) {
    return (
      <View style={styles.resultContainer}>
        <View style={[styles.resultIcon, { backgroundColor: iWon ? '#22c55e' : isDraw ? '#f59e0b' : '#ef4444' }]}>
          <Ionicons 
            name={iWon ? 'trophy' : isDraw ? 'remove' : 'close'} 
            size={48} 
            color="#fff" 
          />
        </View>
        <Text style={[styles.resultTitle, { color: colors.text }]}>
          {iWon ? 'You Won!' : isDraw ? "It's a Draw!" : 'You Lost'}
        </Text>
        
        <View style={styles.finalScores}>
          <View style={styles.finalScoreBox}>
            <Text style={[styles.finalScoreLabel, { color: colors.textSecondary }]}>Your Score</Text>
            <Text style={[styles.finalScoreValue, { color: '#22c55e' }]}>{myScore}</Text>
          </View>
          <Text style={[styles.vsText, { color: colors.textSecondary }]}>vs</Text>
          <View style={styles.finalScoreBox}>
            <Text style={[styles.finalScoreLabel, { color: colors.textSecondary }]}>Opponent</Text>
            <Text style={[styles.finalScoreValue, { color: '#ef4444' }]}>{opponentScore}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Score header */}
      <View style={[styles.scoreHeader, { backgroundColor: colors.surface }]}>
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>You</Text>
          <Text style={[styles.scoreValue, { color: '#22c55e' }]}>{myScore}</Text>
        </View>
        
        {gameState.timeLimit && (
          <View style={styles.timerBox}>
            <Ionicons name="time-outline" size={20} color={timeLeft < 10 ? '#ef4444' : colors.text} />
            <Text style={[styles.timerText, { color: timeLeft < 10 ? '#ef4444' : colors.text }]}>
              {formatTime(timeLeft)}
            </Text>
          </View>
        )}
        
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Opponent</Text>
          <Text style={[styles.scoreValue, { color: '#ef4444' }]}>
            {opponentFinished ? opponentScore : '...'}
          </Text>
        </View>
      </View>

      {/* Game WebView */}
      <View style={styles.gameContainer}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>Loading {gameName}...</Text>
          </View>
        )}
        
        <WebView
          ref={webViewRef}
          source={{ uri: gameUrl }}
          style={styles.webview}
          scrollEnabled={false}
          bounces={false}
          onMessage={handleMessage}
          onLoadEnd={() => setIsLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
      </View>

      {/* Waiting for opponent */}
      {gameEnded && !opponentFinished && (
        <View style={[styles.waitingBanner, { backgroundColor: colors.surface }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.waitingText, { color: colors.text }]}>
            Waiting for opponent to finish...
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  scoreBox: { alignItems: 'center', minWidth: 80 },
  scoreLabel: { fontSize: 12, marginBottom: 2 },
  scoreValue: { fontSize: 28, fontWeight: '800' },
  timerBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerText: { fontSize: 24, fontWeight: '700' },
  gameContainer: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 10,
  },
  loadingText: { marginTop: 12, fontSize: 16 },
  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    gap: 12,
  },
  waitingText: { fontSize: 15 },
  resultContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  resultIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  resultTitle: { fontSize: 32, fontWeight: '800', marginBottom: 30 },
  finalScores: { flexDirection: 'row', alignItems: 'center', gap: 30 },
  finalScoreBox: { alignItems: 'center' },
  finalScoreLabel: { fontSize: 14, marginBottom: 4 },
  finalScoreValue: { fontSize: 48, fontWeight: '800' },
  vsText: { fontSize: 20, fontWeight: '600' },
});

export default ScoreCompetitionGame;
