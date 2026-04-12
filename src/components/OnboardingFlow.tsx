import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  TextInput,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Text as SvgText, Rect, G, Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  ZoomIn,
  BounceIn,
  Easing,
} from 'react-native-reanimated';

import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { users, auth as authApi } from '../services/api';
import { Avatar } from './Avatar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Ensure dimensions are valid
const safeWidth = SCREEN_WIDTH || 375;
const safeHeight = SCREEN_HEIGHT || 812;

type OnboardingStep = 'welcome' | 'credentials' | 'username' | 'profile';

const STEP_ORDER: OnboardingStep[] = ['welcome', 'credentials', 'username', 'profile'];

const GAME_GENRES = [
  { id: 'pvp', name: 'PvP', icon: 'flash-outline' as const, color: '#FF4757' },
  { id: 'party', name: 'Party', icon: 'people-outline' as const, color: '#FF6B81' },
  { id: 'strategy', name: 'Strategy', icon: 'bulb-outline' as const, color: '#7C4DFF' },
  { id: 'racing', name: 'Racing', icon: 'car-sport-outline' as const, color: '#FF9F43' },
  { id: 'casual', name: 'Casual', icon: 'happy-outline' as const, color: '#2ED573' },
  { id: 'puzzle', name: 'Puzzle', icon: 'extension-puzzle-outline' as const, color: '#1E90FF' },
  { id: 'arcade', name: 'Arcade', icon: 'game-controller-outline' as const, color: '#FFA502' },
  { id: 'simulation', name: 'Simulation', icon: 'globe-outline' as const, color: '#3742FA' },
  { id: 'card', name: 'Card', icon: 'copy-outline' as const, color: '#5F27CD' },
  { id: 'board', name: 'Board', icon: 'grid-outline' as const, color: '#10AC84' },
  { id: 'action', name: 'Action', icon: 'rocket-outline' as const, color: '#EE5A24' },
  { id: 'sports', name: 'Sports', icon: 'football-outline' as const, color: '#0984E3' },
];

const SPRING_CONFIG = { damping: 15, stiffness: 150, mass: 0.8 };

// ──────────────────────────────────────────────
// Floating Particle (welcome screen background)
// ──────────────────────────────────────────────
const FloatingParticle: React.FC<{ emoji: string; delay: number; startX: number; startY: number }> = ({ emoji, delay, startX, startY }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.4, { duration: 800 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: startX, top: startY }, animStyle]}>
      <Text style={{ fontSize: 28 }}>{emoji}</Text>
    </Animated.View>
  );
};

const PARTICLES = [
  { emoji: '🎮', x: safeWidth * 0.1, y: safeHeight * 0.12, delay: 0 },
  { emoji: '🕹️', x: safeWidth * 0.75, y: safeHeight * 0.08, delay: 300 },
  { emoji: '🏆', x: safeWidth * 0.85, y: safeHeight * 0.25, delay: 600 },
  { emoji: '⚡', x: safeWidth * 0.05, y: safeHeight * 0.3, delay: 200 },
  { emoji: '🎯', x: safeWidth * 0.6, y: safeHeight * 0.18, delay: 500 },
  { emoji: '🔥', x: safeWidth * 0.3, y: safeHeight * 0.06, delay: 400 },
];

// ──────────────────────────────────────────────
// Progress Bar
// ──────────────────────────────────────────────
const ProgressBar: React.FC<{ currentStep: number; totalSteps: number }> = ({ currentStep, totalSteps }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring((currentStep + 1) / totalSteps, { damping: 20, stiffness: 90 });
  }, [currentStep]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.track}>
        <Animated.View style={[progressStyles.fill, barStyle]}>
          <LinearGradient
            colors={['#a855f7', '#ec4899']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
};

const progressStyles = StyleSheet.create({
  container: { paddingHorizontal: 24, paddingTop: 8 },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
});

// ──────────────────────────────────────────────
// Animated GameTok Logo
// ──────────────────────────────────────────────
const GameTokLogo: React.FC = () => {
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 100 }));
    opacity.value = withDelay(200, withTiming(1, { duration: 600 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.logoWrapper, animStyle]}>
      <Svg width={280} height={120} viewBox="0 0 280 120">
        <Defs>
          <SvgGradient id="gameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FF6B6B" />
            <Stop offset="50%" stopColor="#FF8E53" />
            <Stop offset="100%" stopColor="#FFC107" />
          </SvgGradient>
          <SvgGradient id="tokGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4ECDC4" />
            <Stop offset="50%" stopColor="#44A08D" />
            <Stop offset="100%" stopColor="#093028" />
          </SvgGradient>
          <SvgGradient id="glowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FF6B6B" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#4ECDC4" stopOpacity="0.8" />
          </SvgGradient>
        </Defs>
        <G transform="translate(10, 35)">
          <Rect x="0" y="15" width="50" height="30" rx="8" fill="url(#gameGrad)" />
          <Rect x="8" y="24" width="12" height="4" rx="1" fill="#fff" opacity="0.9" />
          <Rect x="12" y="20" width="4" height="12" rx="1" fill="#fff" opacity="0.9" />
          <Circle cx="38" cy="26" r="3" fill="#fff" opacity="0.9" />
          <Circle cx="44" cy="32" r="3" fill="#fff" opacity="0.9" />
          <Circle cx="15" cy="38" r="5" fill="#222" />
          <Circle cx="35" cy="38" r="5" fill="#222" />
        </G>
        <SvgText x="70" y="70" fontSize="48" fontWeight="900" fill="url(#gameGrad)" fontFamily="System">GAME</SvgText>
        <SvgText x="195" y="70" fontSize="48" fontWeight="900" fill="url(#tokGrad)" fontFamily="System">TOK</SvgText>
        <Rect x="70" y="80" width="195" height="4" rx="2" fill="url(#glowGrad)" />
      </Svg>
      <Animated.Text
        entering={FadeInDown.delay(800)}
        style={styles.tagline}
      >
        SWIPE • PLAY • COMPETE
      </Animated.Text>
    </Animated.View>
  );
};

// ──────────────────────────────────────────────
// Genre Chip
// ──────────────────────────────────────────────
const GenreChip: React.FC<{
  genre: typeof GAME_GENRES[0];
  selected: boolean;
  onPress: () => void;
  index: number;
  themeColors: any;
}> = ({ genre, selected, onPress, index, themeColors }) => {
  const chipScale = useSharedValue(1);

  const handlePress = () => {
    chipScale.value = withSequence(
      withTiming(0.9, { duration: 80 }),
      withSpring(1, SPRING_CONFIG)
    );
    onPress();
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: chipScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(14)}
      style={animStyle}
    >
      <TouchableOpacity
        style={[
          genreStyles.chip,
          { backgroundColor: themeColors.surface, borderColor: themeColors.border },
          selected && { backgroundColor: genre.color, borderColor: genre.color },
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Ionicons
          name={genre.icon}
          size={18}
          color={selected ? '#fff' : themeColors.textSecondary}
          style={{ marginRight: 6 }}
        />
        <Text style={[
          genreStyles.chipText,
          { color: selected ? '#fff' : themeColors.text },
        ]}>
          {genre.name}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const genreStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 10,
    marginBottom: 12,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

// ──────────────────────────────────────────────
// Animated Button
// ──────────────────────────────────────────────
const AnimatedButton: React.FC<{
  onPress: () => void;
  disabled?: boolean;
  colors: string[];
  label: string;
  delay?: number;
}> = ({ onPress, disabled, colors: gradColors, label, delay = 0 }) => {
  const btnScale = useSharedValue(1);

  const handlePressIn = () => { btnScale.value = withSpring(0.96, { damping: 15, stiffness: 200 }); };
  const handlePressOut = () => { btnScale.value = withSpring(1, SPRING_CONFIG); };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  // Ensure colors are always valid strings
  const safeColors = gradColors && gradColors.length >= 2 
    ? gradColors.map(c => c || '#333') 
    : ['#a855f7', '#ec4899'];

  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={animStyle}>
      <TouchableOpacity
        style={[styles.primaryButton, disabled && styles.buttonDisabled]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1}
      >
        <LinearGradient
          colors={safeColors}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.gradientButton}
        >
          <Text style={styles.primaryButtonText}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ──────────────────────────────────────────────
// Shake wrapper for errors
// ──────────────────────────────────────────────
const ShakeText: React.FC<{ text: string; visible: boolean }> = ({ text, visible }) => {
  const shakeX = useSharedValue(0);

  useEffect(() => {
    if (visible && text) {
      shakeX.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }
  }, [text, visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  if (!visible || !text) return null;

  return (
    <Animated.View style={animStyle}>
      <Text style={styles.errorText}>{text}</Text>
    </Animated.View>
  );
};

// ══════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════
interface OnboardingFlowProps {
  onComplete: () => void;
  isAuthLoading?: boolean;
  skipIntro?: boolean;
  startWithLogin?: boolean;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  isAuthLoading = false,
  skipIntro = false,
  startWithLogin = false,
}) => {
  const rawInsets = useSafeAreaInsets();
  // Ensure insets are always valid numbers
  const insets = {
    top: rawInsets.top || 0,
    bottom: rawInsets.bottom || 0,
    left: rawInsets.left || 0,
    right: rawInsets.right || 0,
  };
  const { signup, login, loginWithOAuth, user, refreshUser } = useAuth();
  const { colors } = useTheme();

  const [step, setStep] = useState<OnboardingStep>(
    skipIntro ? 'credentials' : 'welcome'
  );
  const [isLogin, setIsLogin] = useState(startWithLogin);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [stepKey, setStepKey] = useState(0); // forces re-render for entering animations

  // Genre selection
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  // Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Username
  const [username, setUsername] = useState('');

  // Profile
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);

  // Check Apple Sign-In
  useEffect(() => {
    const checkApple = async () => {
      const available = await AppleAuthentication.isAvailableAsync();
      setIsAppleAvailable(available);
    };
    checkApple();
    GoogleSignin.configure({
      iosClientId: '690098564284-704g6n4d0ur6audbsgqnd2tnkfranatc.apps.googleusercontent.com',
      webClientId: '690098564284-9j4fj28fiqimjg8c20mn2vtjg6b70qr7.apps.googleusercontent.com',
    });
  }, []);

  // ── Navigation ──
  const goTo = useCallback((nextStep: OnboardingStep) => {
    setError('');
    setStepKey(k => k + 1);
    setStep(nextStep);
  }, []);

  const currentStepIndex = STEP_ORDER.indexOf(step);

  // ── OAuth ──
  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const result = await loginWithOAuth('apple', {
        identityToken: credential.identityToken,
        email: credential.email,
        fullName: credential.fullName,
        user: credential.user,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if ((result as any)?.isNewUser || !(result as any)?.user?.username) {
        goTo('username');
      } else {
        onComplete();
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        setError('Apple Sign-In failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (response.type === 'success' && response.data) {
        const { idToken, user: googleUser } = response.data;
        const result = await loginWithOAuth('google', {
          idToken,
          user: { id: googleUser.id, email: googleUser.email, name: googleUser.name, photo: googleUser.photo },
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if ((result as any)?.isNewUser || !(result as any)?.user?.username) {
          goTo('username');
        } else {
          onComplete();
        }
      }
    } catch (e: any) {
      console.error('[GoogleSignIn] Error:', e.code, e.message, JSON.stringify(e));
      if (e.code === statusCodes.SIGN_IN_CANCELLED) { /* cancelled */ }
      else if (e.code === statusCodes.IN_PROGRESS) { setError('Sign-in already in progress'); }
      else { setError(`Google Sign-In failed: ${e.code || e.message}`); }
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers ──
  const handleCredentialsContinue = async () => {
    if (!email.trim()) { setError('Please enter your email'); return; }
    if (!password.trim() || password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (isLogin) {
      setLoading(true);
      try { await login(email.trim(), password); onComplete(); }
      catch (e: any) { setError(e.message || 'Login failed'); }
      finally { setLoading(false); }
    } else {
      goTo('username');
    }
  };

  const handleUsernameContinue = async () => {
    if (!username.trim() || username.length < 3) { setError('Username must be at least 3 characters'); return; }
    setLoading(true);
    setError('');
    try {
      if (user) {
        await users.update(user.id, { username: username.trim() });
        await refreshUser();
      } else {
        await signup(username.trim(), password, username.trim(), email.trim());
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goTo('profile');
    } catch (e: any) {
      setError(e.message || 'Failed to set username');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileContinue = async () => {
    if (user && (displayName || bio || avatar)) {
      try {
        await users.update(user.id, {
          displayName: displayName || undefined,
          bio: bio || undefined,
          avatar: avatar || undefined,
        });
        await refreshUser();
      } catch (e) { console.error('Failed to update profile:', e); }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete();
  };

  const toggleGenre = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGenres(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // ═══════════════════════════════════════
  // WELCOME SCREEN
  // ═══════════════════════════════════════
  const renderWelcome = () => (
    <View style={styles.stepContainer}>
      <ImageBackground
        source={require('../../assets/gametok_bg.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.88)', '#000']}
          locations={[0, 0.3, 0.6, 0.85]}
          style={styles.overlay}
        />
      </ImageBackground>

      {/* Floating particles */}
      {PARTICLES.map((p, i) => (
        <FloatingParticle key={i} emoji={p.emoji} startX={p.x} startY={p.y} delay={p.delay} />
      ))}

      <View style={[styles.logoContainer, { top: insets.top + 40 }]}>
        <GameTokLogo />
      </View>

      <View style={[styles.welcomeBottom, { paddingBottom: insets.bottom + 20 }]}>
        <Animated.Text entering={FadeInUp.delay(600).springify()} style={styles.signupTitle}>
          Sign up for GameTOK
        </Animated.Text>

        {/* Apple */}
        {isAppleAvailable && (
          <Animated.View entering={FadeInUp.delay(700).springify()}>
            <TouchableOpacity
              style={[styles.authOption, styles.appleButton]}
              onPress={handleAppleSignIn}
              disabled={loading || isAuthLoading}
            >
              <Ionicons name="logo-apple" size={22} color="#fff" />
              <Text style={styles.authOptionText}>Continue with Apple</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Google */}
        <Animated.View entering={FadeInUp.delay(800).springify()}>
          <TouchableOpacity
            style={styles.googleButtonModern}
            onPress={handleGoogleSignIn}
            disabled={loading || isAuthLoading}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" style={{ marginRight: 10 }}>
              <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </Svg>
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Email */}
        <Animated.View entering={FadeInUp.delay(900).springify()}>
          <TouchableOpacity
            style={styles.authOption}
            onPress={() => { setIsLogin(false); goTo('credentials'); }}
            disabled={loading || isAuthLoading}
          >
            <Ionicons name="mail-outline" size={22} color="#fff" />
            <Text style={styles.authOptionText}>Use phone or email</Text>
          </TouchableOpacity>
        </Animated.View>

        {error ? <ShakeText text={error} visible={true} /> : null}

        <Animated.View entering={FadeIn.delay(1000)}>
          <View style={styles.termsRow}>
            <Text style={styles.termsText}>By continuing, you agree to our </Text>
            <TouchableOpacity><Text style={styles.termsLink}>Terms</Text></TouchableOpacity>
            <Text style={styles.termsText}> and </Text>
            <TouchableOpacity><Text style={styles.termsLink}>Privacy Policy</Text></TouchableOpacity>
          </View>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => { setIsLogin(true); goTo('credentials'); }}>
              <Text style={styles.loginLink}>Log in</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  );

  // ═══════════════════════════════════════
  // GENRE SELECTION SCREEN
  // ═══════════════════════════════════════
  const renderGenres = () => (
    <View style={[styles.stepContainer, { backgroundColor: colors.background }]} key={stepKey}>
      <TouchableOpacity style={[styles.backButton, { top: 8 }]} onPress={() => goTo('welcome')}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <ProgressBar currentStep={currentStepIndex} totalSteps={STEP_ORDER.length} />

      <View style={styles.formContainer}>
        <Animated.Text entering={FadeInDown.delay(100).springify()} style={[styles.stepTitle, { color: colors.text }]}>
          Select your game genre
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(200).springify()} style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          Get better game recommendations
        </Animated.Text>

        <View style={genreStyles2.grid}>
          {GAME_GENRES.map((genre, idx) => (
            <GenreChip
              key={genre.id}
              genre={genre}
              selected={selectedGenres.includes(genre.id)}
              onPress={() => toggleGenre(genre.id)}
              index={idx}
              themeColors={colors}
            />
          ))}
        </View>
      </View>

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 24 }]}>
        <AnimatedButton
          onPress={() => goTo('credentials')}
          disabled={false}
          colors={['#a855f7', '#ec4899']}
          label="Next"
          delay={400}
        />
        <TouchableOpacity onPress={() => goTo('credentials')}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ═══════════════════════════════════════
  // CREDENTIALS SCREEN
  // ═══════════════════════════════════════
  const renderCredentials = () => (
    <KeyboardAvoidingView style={[styles.stepContainer, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} key={stepKey}>
      <TouchableOpacity
        style={[styles.backButton, { top: 8 }]}
        onPress={() => goTo(isLogin ? 'welcome' : 'welcome')}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      {!isLogin && <ProgressBar currentStep={currentStepIndex} totalSteps={STEP_ORDER.length} />}

      <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
        <Animated.Text entering={FadeInDown.delay(100).springify()} style={[styles.stepTitle, { color: colors.text }]}>
          {isLogin ? 'Log in' : 'Enter email & password'}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(200).springify()} style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          {isLogin ? 'Enter your email and password' : 'You can always change this later.'}
        </Animated.Text>

        <ShakeText text={error} visible={!!error} />

        <Animated.View entering={FadeInDown.delay(300).springify()} style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(380).springify()} style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </Animated.View>

        {isLogin && (
          <Animated.View entering={FadeIn.delay(450)}>
            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={[styles.forgotPasswordText, { color: colors.textSecondary }]}>Forgot password?</Text>
            </TouchableOpacity>

            <View style={styles.oauthSection}>
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>
              <View style={styles.oauthIconsRow}>
                {isAppleAvailable && (
                  <TouchableOpacity style={[styles.oauthIconButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleAppleSignIn} disabled={loading}>
                    <Ionicons name="logo-apple" size={24} color={colors.text} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.oauthIconButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleGoogleSignIn} disabled={loading}>
                  <Ionicons name="logo-google" size={22} color="#EA4335" />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 24 }]}>
        <AnimatedButton
          onPress={handleCredentialsContinue}
          disabled={!email || !password || loading}
          colors={email && password ? ['#a855f7', '#ec4899'] : [colors.surface, colors.border]}
          label={loading ? 'Please wait...' : 'Next'}
          delay={500}
        />
      </View>
    </KeyboardAvoidingView>
  );

  // ═══════════════════════════════════════
  // USERNAME SCREEN
  // ═══════════════════════════════════════
  const renderUsername = () => (
    <KeyboardAvoidingView style={[styles.stepContainer, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} key={stepKey}>
      <TouchableOpacity style={[styles.backButton, { top: 8 }]} onPress={() => goTo('credentials')}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <ProgressBar currentStep={currentStepIndex} totalSteps={STEP_ORDER.length} />

      <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
        <Animated.Text entering={FadeInDown.delay(100).springify()} style={[styles.stepTitle, { color: colors.text }]}>
          Create username
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(200).springify()} style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          You can always change this later.
        </Animated.Text>

        <ShakeText text={error} visible={!!error} />

        <Animated.View entering={FadeInDown.delay(300).springify()} style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="at" size={20} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Username"
            placeholderTextColor={colors.textSecondary}
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Animated.View>

        <Animated.Text entering={FadeIn.delay(400)} style={[styles.usernameHint, { color: colors.textSecondary }]}>
          Usernames can only contain letters, numbers, and underscores.
        </Animated.Text>
      </ScrollView>

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 24 }]}>
        <AnimatedButton
          onPress={handleUsernameContinue}
          disabled={username.length < 3 || loading}
          colors={username.length >= 3 ? ['#a855f7', '#ec4899'] : [colors.surface, colors.border]}
          label={loading ? 'Creating account...' : 'Sign up'}
          delay={500}
        />
      </View>
    </KeyboardAvoidingView>
  );

  // ═══════════════════════════════════════
  // PROFILE SCREEN
  // ═══════════════════════════════════════
  const renderProfile = () => (
    <KeyboardAvoidingView style={[styles.stepContainer, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} key={stepKey}>
      <ProgressBar currentStep={currentStepIndex} totalSteps={STEP_ORDER.length} />

      <ScrollView contentContainerStyle={styles.profileScroll} keyboardShouldPersistTaps="handled">
        <Animated.Text entering={FadeInDown.delay(100).springify()} style={[styles.stepTitle, { color: colors.text, textAlign: 'center' }]}>
          Set up your profile
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(200).springify()} style={[styles.stepSubtitle, { color: colors.textSecondary, textAlign: 'center' }]}>
          Tell us about yourself
        </Animated.Text>

        <Animated.View entering={ZoomIn.delay(300).springify()}>
          <View style={styles.avatarPicker}>
            <Avatar uri={avatar} size={120} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).springify()} style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Display Name"
            placeholderTextColor={colors.textSecondary}
            value={displayName}
            onChangeText={setDisplayName}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(680).springify()} style={[styles.inputContainer, styles.bioContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, styles.bioInput, { color: colors.text }]}
            placeholder="Bio (optional)"
            placeholderTextColor={colors.textSecondary}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={150}
          />
        </Animated.View>
        <Text style={[styles.charCount, { color: colors.textSecondary }]}>{bio.length}/150</Text>
      </ScrollView>

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 24 }]}>
        <AnimatedButton
          onPress={handleProfileContinue}
          disabled={false}
          colors={['#a855f7', '#ec4899']}
          label="Let's go! 🚀"
          delay={700}
        />
        <TouchableOpacity onPress={onComplete}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip for now</Text>
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <View style={[styles.container, { paddingTop: step === 'welcome' ? 0 : insets.top }]}>
      {step === 'welcome' && renderWelcome()}
      {step === 'credentials' && renderCredentials()}
      {step === 'username' && renderUsername()}
      {step === 'profile' && renderProfile()}
    </View>
  );
};

// ══════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════

const genreStyles2 = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  stepContainer: { flex: 1, backgroundColor: '#000' },

  // Welcome
  background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  overlay: { ...StyleSheet.absoluteFillObject },
  logoContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  logoWrapper: { alignItems: 'center' },
  logoTextContainer: { flexDirection: 'row', alignItems: 'center' },
  logoTextGame: { fontSize: 48, fontWeight: '900', color: '#FF6B6B' },
  logoTextTok: { fontSize: 48, fontWeight: '900', color: '#4ECDC4' },
  tagline: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', letterSpacing: 4, marginTop: 12 },
  welcomeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24 },
  signupTitle: { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 20 },
  authOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 24, height: 48,
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  appleButton: { backgroundColor: '#000', borderColor: '#333' },
  authOptionText: { color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 12 },
  termsRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 16, marginBottom: 16 },
  termsText: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  termsLink: { fontSize: 12, color: '#fff', fontWeight: '600' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  loginText: { fontSize: 15, color: 'rgba(255,255,255,0.6)' },
  loginLink: { fontSize: 15, color: '#a855f7', fontWeight: '600' },

  // Form screens
  backButton: { position: 'absolute', left: 12, zIndex: 10, padding: 10, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  formContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 60 },
  stepTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  stepSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.6)', marginBottom: 24 },
  errorText: { color: '#FF6B6B', fontSize: 14, marginBottom: 16 },

  // Inputs
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a',
    borderRadius: 12, marginBottom: 16, paddingHorizontal: 16, height: 56,
    borderWidth: 1, borderColor: '#333',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#fff' },
  forgotPassword: { alignSelf: 'flex-end' },
  forgotPasswordText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  usernameHint: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: -8 },

  // Profile
  profileScroll: { flexGrow: 1, paddingTop: 40, paddingHorizontal: 24, alignItems: 'center' },
  avatarPicker: { width: 120, height: 120, borderRadius: 60, marginBottom: 20, marginTop: 24 },
  avatarImage: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: {
    width: 120, height: 120, borderRadius: 60, justifyContent: 'center',
    alignItems: 'center', borderWidth: 2, borderStyle: 'dashed',
  },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 36, height: 36,
    borderRadius: 18, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#000',
  },
  createAvatarBtnOnboarding: {
    marginBottom: 24, paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 20, backgroundColor: 'rgba(168,85,247,0.15)',
  },
  createAvatarTextOnboarding: { fontSize: 14, fontWeight: '600', color: '#a855f7', textAlign: 'center' },
  bioContainer: { height: 100, alignItems: 'flex-start', paddingTop: 12 },
  bioInput: { height: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 12, alignSelf: 'flex-end', marginTop: -8, marginBottom: 16 },

  // Bottom actions
  bottomActions: { paddingHorizontal: 24, paddingTop: 16 },
  primaryButton: { height: 52, borderRadius: 26, overflow: 'hidden', marginBottom: 16 },
  gradientButton: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  buttonDisabled: { opacity: 0.5 },
  skipText: { fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },

  // OAuth
  oauthSection: { marginTop: 24 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 16, fontSize: 14 },
  oauthIconsRow: { flexDirection: 'row', justifyContent: 'center' },
  oauthIconButton: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 1, marginHorizontal: 8 },
  googleButtonModern: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: 24, height: 48, marginBottom: 12,
  },
  googleButtonText: { color: '#333', fontSize: 15, fontWeight: '600' },
});

export default OnboardingFlow;
