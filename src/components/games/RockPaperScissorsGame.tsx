// Rock Paper Scissors Multiplayer Game
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface RPSGameProps {
  gameState: {
    choices: Record<string, string>;
    round: number;
    scores: Record<string, number>;
    maxRounds: number;
  };
  onMove: (move: { choice: string }) => void;
  isMyTurn: boolean;
  mySymbol: string;
  myId: string;
  opponentId: string;
  colors: any;
}

const CHOICES = [
  { id: 'rock', icon: 'hand-left', label: 'Rock' },
  { id: 'paper', icon: 'document', label: 'Paper' },
  { id: 'scissors', icon: 'cut', label: 'Scissors' },
];

const RockPaperScissorsGame: React.FC<RPSGameProps> = ({
  gameState,
  onMove,
  myId,
  opponentId,
  colors,
}) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const scaleAnim = new Animated.Value(1);

  const myChoice = gameState.choices[myId];
  const opponentChoice = gameState.choices[opponentId];
  const bothChose = myChoice && opponentChoice;

  useEffect(() => {
    if (bothChose) {
      setShowResult(true);
      setTimeout(() => {
        setShowResult(false);
        setSelected(null);
      }, 2000);
    }
  }, [gameState.round]);

  const handleChoice = (choice: string) => {
    if (myChoice) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSelected(choice);
    
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.2, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    
    onMove({ choice });
  };

  const getResultText = () => {
    if (!bothChose) return '';
    if (myChoice === opponentChoice) return "It's a tie!";
    const wins = {
      rock: 'scissors',
      paper: 'rock',
      scissors: 'paper',
    };
    return wins[myChoice as keyof typeof wins] === opponentChoice ? 'You win this round!' : 'You lose this round!';
  };

  return (
    <View style={styles.container}>
      {/* Scores */}
      <View style={styles.scoresRow}>
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>You</Text>
          <Text style={[styles.scoreValue, { color: '#22c55e' }]}>{gameState.scores[myId] || 0}</Text>
        </View>
        <View style={styles.roundBox}>
          <Text style={[styles.roundLabel, { color: colors.textSecondary }]}>Round</Text>
          <Text style={[styles.roundValue, { color: colors.text }]}>{gameState.round}/{gameState.maxRounds}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Opponent</Text>
          <Text style={[styles.scoreValue, { color: '#ef4444' }]}>{gameState.scores[opponentId] || 0}</Text>
        </View>
      </View>

      {/* Result display */}
      {showResult && bothChose && (
        <View style={styles.resultContainer}>
          <View style={styles.choicesReveal}>
            <View style={[styles.revealBox, { backgroundColor: '#22c55e20' }]}>
              <Ionicons name={CHOICES.find(c => c.id === myChoice)?.icon as any} size={40} color="#22c55e" />
            </View>
            <Text style={[styles.vsText, { color: colors.text }]}>VS</Text>
            <View style={[styles.revealBox, { backgroundColor: '#ef444420' }]}>
              <Ionicons name={CHOICES.find(c => c.id === opponentChoice)?.icon as any} size={40} color="#ef4444" />
            </View>
          </View>
          <Text style={[styles.resultText, { color: colors.text }]}>{getResultText()}</Text>
        </View>
      )}

      {/* Choice buttons */}
      {!showResult && (
        <>
          <Text style={[styles.instruction, { color: colors.textSecondary }]}>
            {myChoice ? 'Waiting for opponent...' : 'Make your choice!'}
          </Text>
          <View style={styles.choicesContainer}>
            {CHOICES.map((choice) => (
              <TouchableOpacity
                key={choice.id}
                style={[
                  styles.choiceBtn,
                  { backgroundColor: colors.surface },
                  selected === choice.id && styles.choiceBtnSelected,
                  myChoice && myChoice !== choice.id && styles.choiceBtnDisabled,
                ]}
                onPress={() => handleChoice(choice.id)}
                disabled={!!myChoice}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={choice.icon as any} 
                  size={48} 
                  color={selected === choice.id ? '#667eea' : colors.text} 
                />
                <Text style={[
                  styles.choiceLabel, 
                  { color: selected === choice.id ? '#667eea' : colors.text }
                ]}>
                  {choice.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 20 },
  scoresRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 40, gap: 20 },
  scoreBox: { alignItems: 'center' },
  scoreLabel: { fontSize: 14, marginBottom: 4 },
  scoreValue: { fontSize: 32, fontWeight: '800' },
  roundBox: { alignItems: 'center', paddingHorizontal: 20 },
  roundLabel: { fontSize: 12 },
  roundValue: { fontSize: 18, fontWeight: '700' },
  resultContainer: { alignItems: 'center', marginBottom: 30 },
  choicesReveal: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 20 },
  revealBox: { width: 80, height: 80, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  vsText: { fontSize: 24, fontWeight: '800' },
  resultText: { fontSize: 20, fontWeight: '700' },
  instruction: { fontSize: 18, marginBottom: 30 },
  choicesContainer: { flexDirection: 'row', gap: 16 },
  choiceBtn: { width: 100, height: 120, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 8 },
  choiceBtnSelected: { borderWidth: 3, borderColor: '#667eea' },
  choiceBtnDisabled: { opacity: 0.3 },
  choiceLabel: { fontSize: 14, fontWeight: '600' },
});

export default RockPaperScissorsGame;
