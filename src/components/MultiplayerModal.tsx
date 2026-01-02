// Multiplayer Game Modal - Handles room creation, waiting, and gameplay
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useMultiplayer } from '../services/multiplayer';
import { Avatar } from './Avatar';

// Game-specific components
import TicTacToeGame from './games/TicTacToeGame';
import Connect4Game from './games/Connect4Game';
import RockPaperScissorsGame from './games/RockPaperScissorsGame';
import ChessGame from './games/ChessGame';
import ScoreCompetitionGame from './games/ScoreCompetitionGame';

// Games URL base
const GAMES_URL = 'https://gametok-games.pages.dev';

// Score competition games
const SCORE_COMPETITION_GAMES = [
  'tetris', '2048', 'snake', 'flappy-bird', 'pacman', 'fruit-slicer',
  'piano-tiles', 'doodle-jump', 'geometry-dash', 'endless-runner',
  'crossy-road', 'breakout', 'ball-bounce', 'whack-a-mole', 'aim-trainer',
  'reaction-time', 'color-match', 'memory-match', 'tap-tap-dash',
  'number-tap', 'bubble-pop', 'simon-says', 'basketball', 'golf-putt',
  'snake-io', 'asteroids', 'space-invaders', 'missile-game', 'hexgl',
  'racer', 'run3', 'clumsy-bird', 'hextris', 'tower-game',
];

interface MultiplayerModalProps {
  visible: boolean;
  gameId: string;
  gameName: string;
  onClose: () => void;
  inviteRoomId?: string;
}

type ModalState = 'menu' | 'creating' | 'waiting' | 'matchmaking' | 'playing' | 'finished';

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  visible,
  gameId,
  gameName,
  onClose,
  inviteRoomId,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isScoreCompetition = SCORE_COMPETITION_GAMES.includes(gameId);
  const {
    connected,
    room,
    gameState,
    currentTurn,
    error,
    opponentScore,
    opponentFinished,
    gameOver,
    isScoreCompetition: isScoreCompetitionMode,
    timeLimit,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    makeMove,
    findMatch,
    updateScore,
    finishGame,
  } = useMultiplayer(user?.id, (user as any)?.token);

  const [modalState, setModalState] = useState<ModalState>('menu');
  const [roomCode, setRoomCode] = useState('');

  // Handle room state changes
  useEffect(() => {
    if (room) {
      if (room.state === 'waiting') {
        setModalState('waiting');
        setRoomCode(room.id);
      } else if (room.state === 'playing') {
        setModalState('playing');
      } else if (room.state === 'finished') {
        setModalState('finished');
      }
    }
  }, [room]);

  // Handle game over from hook
  useEffect(() => {
    if (gameOver) {
      setModalState('finished');
      Haptics.notificationAsync(
        gameOver.winner === user?.id 
          ? Haptics.NotificationFeedbackType.Success 
          : Haptics.NotificationFeedbackType.Error
      );
    }
  }, [gameOver, user?.id]);

  // Handle invite join
  useEffect(() => {
    if (visible && inviteRoomId && connected) {
      joinRoom(inviteRoomId);
    }
  }, [visible, inviteRoomId, connected, joinRoom]);

  const handleClose = useCallback(() => {
    leaveRoom();
    setModalState('menu');
    setRoomCode('');
    onClose();
  }, [leaveRoom, onClose]);

  const handleCreateRoom = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setModalState('creating');
    createRoom(gameId, true);
  }, [createRoom, gameId]);

  const handleFindMatch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setModalState('matchmaking');
    findMatch(gameId);
  }, [findMatch, gameId]);

  const handleReady = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReady(true);
  }, [setReady]);

  const handleShareCode = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Join my ${gameName} game on GameTok! Room code: ${roomCode}`,
      });
    } catch (e) {}
  }, [gameName, roomCode]);

  const handleMove = useCallback((move: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    makeMove(move);
  }, [makeMove]);

  const handlePlayAgain = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setModalState('menu');
    leaveRoom();
  }, [leaveRoom]);

  const isMyTurn = currentTurn === user?.id;
  const opponent = room?.players.find(p => p.id !== user?.id);

  // Render menu screen
  const renderMenu = () => (
    <View style={styles.menuContainer}>
      <Text style={[styles.menuTitle, { color: colors.text }]}>Play {gameName}</Text>
      <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
        Challenge a friend or find a random opponent
      </Text>

      <TouchableOpacity style={styles.menuOption} onPress={handleCreateRoom} activeOpacity={0.8}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.menuOptionGradient}>
          <Ionicons name="people" size={28} color="#fff" />
          <View style={styles.menuOptionText}>
            <Text style={styles.menuOptionTitle}>Play with Friend</Text>
            <Text style={styles.menuOptionDesc}>Create a room and share the code</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuOption} onPress={handleFindMatch} activeOpacity={0.8}>
        <LinearGradient colors={['#f093fb', '#f5576c']} style={styles.menuOptionGradient}>
          <Ionicons name="globe" size={28} color="#fff" />
          <View style={styles.menuOptionText}>
            <Text style={styles.menuOptionTitle}>Find Opponent</Text>
            <Text style={styles.menuOptionDesc}>Match with a random player</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
        </LinearGradient>
      </TouchableOpacity>

      {!connected && (
        <View style={styles.connectingBanner}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.connectingText, { color: colors.textSecondary }]}>
            Connecting to server...
          </Text>
        </View>
      )}
    </View>
  );

  // Render waiting room
  const renderWaiting = () => (
    <View style={styles.waitingContainer}>
      <View style={styles.roomCodeBox}>
        <Text style={styles.roomCodeLabel}>ROOM CODE</Text>
        <Text style={styles.roomCode}>{roomCode}</Text>
        <TouchableOpacity style={styles.shareCodeBtn} onPress={handleShareCode}>
          <Ionicons name="share-outline" size={20} color="#fff" />
          <Text style={styles.shareCodeText}>Share Code</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.playersSection}>
        <Text style={[styles.playersSectionTitle, { color: colors.textSecondary }]}>
          Players ({room?.players.length || 0}/{room?.maxPlayers || 2})
        </Text>
        
        {room?.players.map((player, index) => (
          <View key={player.id} style={[styles.playerRow, { backgroundColor: colors.surface }]}>
            <Avatar uri={null} size={44} />
            <View style={styles.playerInfo}>
              <Text style={[styles.playerName, { color: colors.text }]}>
                {player.id === user?.id ? 'You' : `Player ${index + 1}`}
              </Text>
              <Text style={[styles.playerStatus, { color: player.ready ? '#22c55e' : colors.textSecondary }]}>
                {player.ready ? 'Ready' : 'Not Ready'}
              </Text>
            </View>
            {player.ready && (
              <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
            )}
          </View>
        ))}

        {room && room.players.length < room.maxPlayers && (
          <View style={[styles.playerRow, styles.emptySlot, { borderColor: colors.border }]}>
            <View style={[styles.emptyAvatar, { backgroundColor: colors.background }]}>
              <Ionicons name="person-add" size={20} color={colors.textSecondary} />
            </View>
            <Text style={[styles.waitingText, { color: colors.textSecondary }]}>
              Waiting for opponent...
            </Text>
          </View>
        )}
      </View>

      {room?.players.length === room?.maxPlayers && (
        <TouchableOpacity style={styles.readyBtn} onPress={handleReady} activeOpacity={0.8}>
          <LinearGradient colors={['#22c55e', '#16a34a']} style={styles.readyBtnGradient}>
            <Text style={styles.readyBtnText}>I'm Ready!</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  // Render matchmaking screen
  const renderMatchmaking = () => (
    <View style={styles.matchmakingContainer}>
      <View style={styles.searchingAnimation}>
        <ActivityIndicator size="large" color="#f5576c" />
      </View>
      <Text style={[styles.matchmakingTitle, { color: colors.text }]}>Finding Opponent...</Text>
      <Text style={[styles.matchmakingSubtitle, { color: colors.textSecondary }]}>
        Looking for players in your skill range
      </Text>
      
      <TouchableOpacity 
        style={[styles.cancelBtn, { borderColor: colors.border }]} 
        onPress={handleClose}
        activeOpacity={0.8}
      >
        <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  // Render game screen
  const renderGame = () => {
    if (!gameState || !room) return null;

    const opponentPlayer = room.players.find(p => p.id !== user?.id);

    // Score competition mode
    if (isScoreCompetition || isScoreCompetitionMode) {
      return (
        <ScoreCompetitionGame
          gameId={gameId}
          gameUrl={`${GAMES_URL}/${gameId}`}
          gameName={gameName}
          gameState={{
            scores: gameState.scores || {},
            finished: gameState.finished || {},
            timeLimit: timeLimit || gameState.timeLimit,
            startTime: gameState.startTime,
          }}
          onScoreUpdate={updateScore}
          onGameFinished={() => finishGame(gameState.scores?.[user?.id || ''] || 0)}
          myId={user?.id || ''}
          opponentId={opponentPlayer?.id || ''}
          colors={colors}
        />
      );
    }

    // Turn-based games
    const GameComponent = getGameComponent(gameId);
    if (!GameComponent) {
      return (
        <View style={styles.unsupportedGame}>
          <Text style={[styles.unsupportedText, { color: colors.text }]}>
            Game not yet supported for multiplayer
          </Text>
        </View>
      );
    }

    // Special handling for RPS
    if (gameId === 'rock-paper-scissors') {
      return (
        <View style={styles.gameContainer}>
          <RockPaperScissorsGame
            gameState={gameState as any}
            onMove={handleMove}
            isMyTurn={true}
            mySymbol=""
            myId={user?.id || ''}
            opponentId={opponentPlayer?.id || ''}
            colors={colors}
          />
        </View>
      );
    }

    // Chess
    if (gameId === 'chess') {
      return (
        <View style={styles.gameContainer}>
          <View style={[styles.turnIndicator, { backgroundColor: isMyTurn ? '#22c55e' : colors.surface }]}>
            <Text style={styles.turnText}>
              {isMyTurn ? "Your Turn" : "Opponent's Turn"}
            </Text>
          </View>
          <ChessGame
            gameState={gameState as any}
            onMove={handleMove}
            isMyTurn={isMyTurn}
            mySymbol={gameState.colors?.[user?.id || ''] || 'white'}
            colors={colors}
          />
        </View>
      );
    }

    return (
      <View style={styles.gameContainer}>
        {/* Turn indicator */}
        <View style={[styles.turnIndicator, { backgroundColor: isMyTurn ? '#22c55e' : colors.surface }]}>
          <Text style={styles.turnText}>
            {isMyTurn ? "Your Turn" : "Opponent's Turn"}
          </Text>
        </View>

        {/* Game board */}
        <GameComponent
          gameState={gameState as any}
          onMove={handleMove}
          isMyTurn={isMyTurn}
          mySymbol={gameState.symbols?.[user?.id || ''] || gameState.colors?.[user?.id || ''] || 'X'}
          colors={colors}
        />
      </View>
    );
  };

  // Render game over screen
  const renderFinished = () => {
    const didWin = gameOver?.winner === user?.id;
    const isDraw = gameOver?.winner === null;

    return (
      <View style={styles.finishedContainer}>
        <View style={[styles.resultIcon, { backgroundColor: didWin ? '#22c55e' : isDraw ? '#f59e0b' : '#ef4444' }]}>
          <Ionicons 
            name={didWin ? 'trophy' : isDraw ? 'remove' : 'close'} 
            size={48} 
            color="#fff" 
          />
        </View>
        
        <Text style={[styles.resultTitle, { color: colors.text }]}>
          {didWin ? 'You Won!' : isDraw ? "It's a Draw!" : 'You Lost'}
        </Text>
        
        <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>
          {gameOver?.reason === 'opponent_left' ? 'Opponent left the game' : 
           didWin ? 'Great game!' : isDraw ? 'Well played!' : 'Better luck next time!'}
        </Text>

        {gameOver?.finalScores && (
          <View style={styles.finalScoresRow}>
            <View style={styles.finalScoreItem}>
              <Text style={[styles.finalScoreLabel, { color: colors.textSecondary }]}>You</Text>
              <Text style={[styles.finalScoreValue, { color: '#22c55e' }]}>
                {gameOver.finalScores[user?.id || ''] || 0}
              </Text>
            </View>
            <Text style={[styles.vsText, { color: colors.textSecondary }]}>vs</Text>
            <View style={styles.finalScoreItem}>
              <Text style={[styles.finalScoreLabel, { color: colors.textSecondary }]}>Opponent</Text>
              <Text style={[styles.finalScoreValue, { color: '#ef4444' }]}>
                {Object.entries(gameOver.finalScores).find(([id]) => id !== user?.id)?.[1] || 0}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.finishedActions}>
          <TouchableOpacity style={styles.playAgainBtn} onPress={handlePlayAgain} activeOpacity={0.8}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.playAgainBtnGradient}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.playAgainBtnText}>Play Again</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.exitBtn, { borderColor: colors.border }]} 
            onPress={handleClose}
            activeOpacity={0.8}
          >
            <Text style={[styles.exitBtnText, { color: colors.text }]}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {modalState === 'playing' ? gameName : 'Multiplayer'}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {modalState === 'menu' && renderMenu()}
          {modalState === 'creating' && renderWaiting()}
          {modalState === 'waiting' && renderWaiting()}
          {modalState === 'matchmaking' && renderMatchmaking()}
          {modalState === 'playing' && renderGame()}
          {modalState === 'finished' && renderFinished()}
        </View>

        {/* Error toast */}
        {error && (
          <View style={styles.errorToast}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

// Get game component based on gameId
function getGameComponent(gameId: string) {
  switch (gameId) {
    case 'tic-tac-toe':
      return TicTacToeGame;
    case 'connect4':
      return Connect4Game;
    case 'chess':
      return ChessGame;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Menu
  menuContainer: {
    flex: 1,
    paddingTop: 40,
  },
  menuTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  menuSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 40,
  },
  menuOption: {
    marginBottom: 16,
  },
  menuOptionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
  },
  menuOptionText: {
    flex: 1,
    marginLeft: 16,
  },
  menuOptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  menuOptionDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  connectingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 10,
  },
  connectingText: {
    fontSize: 14,
  },

  // Waiting room
  waitingContainer: {
    flex: 1,
    paddingTop: 20,
  },
  roomCodeBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    padding: 24,
    borderRadius: 16,
    marginBottom: 30,
  },
  roomCodeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#667eea',
    letterSpacing: 2,
    marginBottom: 8,
  },
  roomCode: {
    fontSize: 36,
    fontWeight: '800',
    color: '#667eea',
    letterSpacing: 4,
    marginBottom: 16,
  },
  shareCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  shareCodeText: {
    color: '#fff',
    fontWeight: '600',
  },
  playersSection: {
    marginBottom: 30,
  },
  playersSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  playerStatus: {
    fontSize: 13,
    marginTop: 2,
  },
  emptySlot: {
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  emptyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingText: {
    marginLeft: 12,
    fontSize: 15,
  },
  readyBtn: {
    marginTop: 'auto',
    marginBottom: 40,
  },
  readyBtnGradient: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  readyBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  // Matchmaking
  matchmakingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchingAnimation: {
    marginBottom: 30,
  },
  matchmakingTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  matchmakingSubtitle: {
    fontSize: 15,
    marginBottom: 40,
  },
  cancelBtn: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Game
  gameContainer: {
    flex: 1,
    alignItems: 'center',
  },
  turnIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 20,
  },
  turnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  unsupportedGame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unsupportedText: {
    fontSize: 16,
  },

  // Finished
  finishedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: 16,
    marginBottom: 40,
  },
  finalScoresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    gap: 30,
  },
  finalScoreItem: {
    alignItems: 'center',
  },
  finalScoreLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  finalScoreValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  vsText: {
    fontSize: 18,
    fontWeight: '600',
  },
  finishedActions: {
    width: '100%',
    gap: 12,
  },
  playAgainBtn: {},
  playAgainBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  playAgainBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  exitBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  exitBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Error
  errorToast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#ef4444',
    padding: 14,
    borderRadius: 10,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default MultiplayerModal;
