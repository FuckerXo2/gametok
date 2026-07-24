import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LoopsColors, SemanticColors } from '../constants/LoopsColors';
import { FontStyles } from '../constants/LoopsFonts';

interface Props {
  seconds: number;
}

export const PkCountdown: React.FC<Props> = ({ seconds }) => {
  const scaleAnim = new Animated.Value(0);

  useEffect(() => {
    // Animate countdown number
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.2,
        useNativeDriver: true,
        tension: 50,
        friction: 3
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 3
      })
    ]).start();
  }, [seconds]);

  return (
    <View style={styles.container}>
      <View style={styles.backdrop} />
      <Animated.View style={[styles.countdownCircle, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.countdownText}>{seconds}</Text>
      </Animated.View>
      <Text style={styles.readyText}>Get Ready!</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)'
  },
  countdownCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: LoopsColors.mainPink,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: LoopsColors.mainPink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10
  },
  countdownText: {
    fontSize: 64,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  readyText: {
    ...FontStyles.h3,
    color: SemanticColors.textInverse,
    marginTop: 24
  }
});
