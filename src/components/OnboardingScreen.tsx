import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ImageBackground,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Text as SvgText, Path, G, Circle, Rect } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Animated SVG Text component
const AnimatedSvg = Animated.createAnimatedComponent(Svg);

// Custom GameTok Logo with SVG
const GameTokLogo = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.logoWrapper, { transform: [{ scale: pulseAnim }] }]}>
      {/* Main Logo SVG */}
      <Svg width={280} height={120} viewBox="0 0 280 120">
        <Defs>
          {/* Gradient for GAME */}
          <SvgGradient id="gameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FF6B6B" />
            <Stop offset="50%" stopColor="#FF8E53" />
            <Stop offset="100%" stopColor="#FFC107" />
          </SvgGradient>
          {/* Gradient for TOK */}
          <SvgGradient id="tokGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4ECDC4" />
            <Stop offset="50%" stopColor="#44A08D" />
            <Stop offset="100%" stopColor="#093028" />
          </SvgGradient>
          {/* Neon glow gradient */}
          <SvgGradient id="glowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FF6B6B" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#4ECDC4" stopOpacity="0.8" />
          </SvgGradient>
        </Defs>

        {/* Controller icon integrated into design */}
        <G transform="translate(10, 35)">
          {/* Controller body */}
          <Rect x="0" y="15" width="50" height="30" rx="8" fill="url(#gameGrad)" />
          {/* D-pad */}
          <Rect x="8" y="24" width="12" height="4" rx="1" fill="#fff" opacity="0.9" />
          <Rect x="12" y="20" width="4" height="12" rx="1" fill="#fff" opacity="0.9" />
          {/* Buttons */}
          <Circle cx="38" cy="26" r="3" fill="#fff" opacity="0.9" />
          <Circle cx="44" cy="32" r="3" fill="#fff" opacity="0.9" />
          {/* Joysticks */}
          <Circle cx="15" cy="38" r="5" fill="#222" />
          <Circle cx="35" cy="38" r="5" fill="#222" />
        </G>

        {/* GAME text */}
        <SvgText
          x="70"
          y="70"
          fontSize="48"
          fontWeight="900"
          fill="url(#gameGrad)"
          fontFamily="System"
        >
          GAME
        </SvgText>

        {/* TOK text */}
        <SvgText
          x="195"
          y="70"
          fontSize="48"
          fontWeight="900"
          fill="url(#tokGrad)"
          fontFamily="System"
        >
          TOK
        </SvgText>

        {/* Underline accent */}
        <Rect x="70" y="80" width="195" height="4" rx="2" fill="url(#glowGrad)" />
      </Svg>

      {/* Tagline */}
      <Text style={styles.tagline}>SWIPE • PLAY • COMPETE</Text>
    </Animated.View>
  );
};

interface OnboardingScreenProps {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  const handleCreateAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete();
  };

  const handleSignIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onComplete();
  };

  return (
    <View style={styles.container}>
      {/* Background Image */}
      <ImageBackground
        source={require('../../assets/gametok_bg.png')}
        style={styles.background}
        resizeMode="cover"
      >
        {/* Gradient overlay - more dramatic */}
        <LinearGradient
          colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)', '#000']}
          locations={[0, 0.3, 0.6, 0.85]}
          style={styles.overlay}
        />
      </ImageBackground>

      {/* Logo - centered in upper portion */}
      <Animated.View 
        style={[
          styles.logoContainer, 
          { 
            top: insets.top + 100,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <GameTokLogo />
      </Animated.View>

      {/* Bottom Section */}
      <Animated.View 
        style={[
          styles.bottomContainer, 
          { 
            paddingBottom: insets.bottom + 24,
            opacity: fadeAnim,
          }
        ]}
      >
        {/* Feature highlights */}
        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🎮</Text>
            <Text style={styles.featureText}>Unlimited Games</Text>
          </View>
          <View style={styles.featureDivider} />
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🏆</Text>
            <Text style={styles.featureText}>Leaderboards</Text>
          </View>
          <View style={styles.featureDivider} />
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>👥</Text>
            <Text style={styles.featureText}>Play w/ Friends</Text>
          </View>
        </View>

        {/* Buttons */}
        <TouchableOpacity 
          style={styles.createButton} 
          onPress={handleCreateAccount}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#FF6B6B', '#FF8E53']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createButtonGradient}
          >
            <Text style={styles.createButtonText}>Get Started</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.signInButton} 
          onPress={handleSignIn}
          activeOpacity={0.8}
        >
          <Text style={styles.signInButtonText}>I already have an account</Text>
        </TouchableOpacity>

        <View style={styles.termsRow}>
          <Text style={styles.termsText}>By continuing, you agree to our </Text>
          <TouchableOpacity>
            <Text style={styles.termsLink}>Terms</Text>
          </TouchableOpacity>
          <Text style={styles.termsText}> & </Text>
          <TouchableOpacity>
            <Text style={styles.termsLink}>Privacy</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  logoContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
  },
  tagline: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 4,
    marginTop: 12,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  featureText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  featureDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  createButton: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 14,
  },
  createButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  signInButton: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  termsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  termsText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  termsLink: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
  },
});
