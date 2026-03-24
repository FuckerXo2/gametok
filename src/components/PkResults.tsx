import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LoopsColors } from '../constants/LoopsColors';
import { FontStyles } from '../constants/LoopsFonts';
import { useAuth } from '../hooks/useAuth';

interface Props {
  matchId: number;
  myScore: number;
  opponentScore: number;
  winner: number | null;
  opponent: {
    id: number;
    username: string;
    avatar: string;
  };
  onClose: () => void;
}

export const PkResults: React.FC<Props> = ({
  myScore,
  opponentScore,
  winner,
  opponent,
  onClose
}) => {
  const { user } = useAuth();
  const isWinner = winner === user?.id;
  const isDraw = myScore === opponentScore;

  const getResultText = () => {
    if (isDraw) return 'Draw!';
    return isWinner ? 'Victory!' : 'Defeat';
  };

  return (
    <View style={styles.container}>
      <View style={styles.backdrop} />
      
      <View style={styles.content}>
        {/* Result Title */}
        <Text style={[
          styles.resultTitle,
          { color: isDraw ? LoopsColors.warning : (isWinner ? LoopsColors.success : LoopsColors.error) }
        ]}>
          {getResultText()}
        </Text>

        {/* Scores */}
        <View style={styles.scoresContainer}>
          {/* My Score */}
          <View style={styles.playerCard}>
            <Image 
              source={{ uri: user?.avatar || 'https://via.placeholder.com/80' }} 
              style={styles.playerAvatar} 
            />
            <Text style={styles.playerName} numberOfLines={1}>You</Text>
            <Text style={styles.playerScore}>{myScore}</Text>
          </View>

          {/* VS */}
          <View style={styles.vsContainer}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          {/* Opponent Score */}
          <View style={styles.playerCard}>
            <Image 
              source={{ uri: opponent.avatar }} 
              style={styles.playerAvatar} 
            />
            <Text style={styles.playerName} numberOfLines={1}>{opponent.username}</Text>
            <Text style={styles.playerScore}>{opponentScore}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)'
  },
  content: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: LoopsColors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center'
  },
  resultTitle: {
    ...FontStyles.h1,
    marginBottom: 32,
    textAlign: 'center'
  },
  scoresContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 32
  },
  playerCard: {
    alignItems: 'center',
    flex: 1
  },
  playerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: LoopsColors.primary
  },
  playerName: {
    ...FontStyles.body,
    color: LoopsColors.textSecondary,
    marginBottom: 8
  },
  playerScore: {
    ...FontStyles.h2,
    color: LoopsColors.textPrimary
  },
  vsContainer: {
    backgroundColor: LoopsColors.background,
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16
  },
  vsText: {
    ...FontStyles.button,
    color: LoopsColors.primary
  },
  actions: {
    width: '100%'
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center'
  },
  primaryButton: {
    backgroundColor: LoopsColors.primary
  },
  buttonText: {
    ...FontStyles.button,
    color: '#FFFFFF'
  }
});
