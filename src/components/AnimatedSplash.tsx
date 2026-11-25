import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Image, Easing, Dimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const splashImage = require('../../assets/splash.png');
const iconImage = require('../../assets/icon.png');

interface AnimatedSplashProps {
  isReady?: boolean;
  onAnimationComplete: () => void;
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onAnimationComplete }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const bgScale = useRef(new Animated.Value(1)).current;
  const bgOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const animationStarted = useRef(false);

  useEffect(() => {
    if (imageLoaded && !animationStarted.current) {
      animationStarted.current = true;
      setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
        runAnimation();
      }, 50);
    }
  }, [imageLoaded]);

  // Fallback timeout in case image load event is delayed
  useEffect(() => {
    const fallback = setTimeout(() => {
      if (!animationStarted.current) {
        animationStarted.current = true;
        SplashScreen.hideAsync().catch(() => {});
        runAnimation();
      }
    }, 1500);
    return () => clearTimeout(fallback);
  }, []);

  const runAnimation = () => {
    // Phase 1: Background collage zooms in and fades out
    Animated.parallel([
      Animated.timing(bgScale, {
        toValue: 1.2,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bgOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Phase 2: GameTOK logo bounces in
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 4,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Phase 3: Hold briefly then fade out to reveal the home feed
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(logoOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onAnimationComplete();
        });
      });
    });
  };

  return (
    <View style={styles.container}>
      <Animated.Image
        source={splashImage}
        style={[
          styles.background,
          {
            opacity: bgOpacity,
            transform: [{ scale: bgScale }],
          },
        ]}
        resizeMode="cover"
        onLoad={() => setImageLoaded(true)}
      />

      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image
          source={iconImage}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  logoContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
});
