import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LoopsColors } from '../constants/LoopsColors';
import { FontStyles } from '../constants/LoopsFonts';
import { resolveAvatarSource } from './Avatar';

interface Props {
  myScore: number;
  opponentScore: number;
  opponent: {
    username: string;
    avatar: string;
  };
}

export const PkOverlay: React.FC<Props> = ({ myScore, opponentScore, opponent }) => {
  return (
    <View style={styles.container}>
      {/* My Score */}
      <View style={[styles.scoreCard, styles.myScore]}>
        <Text style={styles.scoreLabel}>You</Text>
        <Text style={styles.scoreValue}>{myScore}</Text>
      </View>

      {/* VS Indicator */}
      <View style={styles.vsContainer}>
        <Text style={styles.vsText}>VS</Text>
      </View>

      {/* Opponent Score */}
      <View style={[styles.scoreCard, styles.opponentScore]}>
        <Image source={resolveAvatarSource(opponent.avatar)} style={styles.avatar} />
        <Text style={styles.scoreLabel} numberOfLines={1}>{opponent.username}</Text>
        <Text style={styles.scoreValue}>{opponentScore}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1000
  },
  scoreCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 12,
    minWidth: 100,
    alignItems: 'center'
  },
  myScore: {
    borderColor: LoopsColors.primary,
    borderWidth: 2
  },
  opponentScore: {
    borderColor: LoopsColors.error,
    borderWidth: 2
  },
  scoreLabel: {
    ...FontStyles.label,
    color: LoopsColors.textSecondary,
    marginBottom: 4
  },
  scoreValue: {
    ...FontStyles.h2,
    color: LoopsColors.textPrimary
  },
  vsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  vsText: {
    ...FontStyles.button,
    color: LoopsColors.primary
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 4
  }
});
