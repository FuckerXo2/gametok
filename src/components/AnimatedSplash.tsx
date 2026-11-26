// Launch screen C: the star where the native splash left it (same size, same place: app.json imageWidth 140), the
// word PIXIL fading in small at the bottom, then everything fades to the app.
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { PixilStar } from './PixilStar';

interface AnimatedSplashProps {
  isReady?: boolean;
  onAnimationComplete: () => void;
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onAnimationComplete }) => {
  const word = useRef(new Animated.Value(0)).current;
  const all = useRef(new Animated.Value(1)).current;
  const star = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // this view is drawn exactly like the native splash, so hiding that one is seamless
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      Animated.sequence([
        Animated.timing(word, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(550),
        Animated.parallel([
          Animated.timing(star, { toValue: 1.12, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          Animated.timing(all, { toValue: 0, duration: 320, useNativeDriver: true }),
        ]),
      ]).start(() => onAnimationComplete());
    }, 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: all }]} pointerEvents="none">
      <Animated.View style={[styles.center, { transform: [{ scale: star }] }]}>
        <PixilStar size={140} />
      </Animated.View>
      <Animated.Text style={[styles.word, { opacity: word }]   /* (drawn above the safe-area provider: a fixed margin) */}>PIXIL</Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFill, backgroundColor: '#000' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  word: { position: 'absolute', left: 0, right: 0, bottom: 72, textAlign: 'center', color: '#8a8f99', fontSize: 15, fontWeight: '800', letterSpacing: 6 },
});
