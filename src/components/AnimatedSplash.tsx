import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Image, Easing } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

const splashImage = require('../../assets/splash.png');
const iconImage = require('../../assets/icon.png');

interface AnimatedSplashProps {
  onAnimationComplete: () => void;
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onAnimationComplete }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const bgScale = useRef(new Animated.Value(1)).current;
  const bgOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (imageLoaded) {
      // Image is loaded, hide native splash and start animation
      SplashScreen.hideAsync().then(() => {
        runAnimation();
      });
    }
  }, [imageLoaded]);

  const runAnimation = () => {
    // Phase 1: Background zooms in and fades out
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
      // Phase 2: Logo bounces in
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
        // Phase 3: Hold briefly then fade out
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  logoContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 24,
  },
});
