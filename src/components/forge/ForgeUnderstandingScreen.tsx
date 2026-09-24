import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ForgeOrbView } from './ForgeOrbView';
import { ForgeChecklistCard, DEFAULT_FORGE_STEPS } from './ForgeChecklistCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const FORGE_MASCOT = require('../../../assets/forge/forge_mascot.png');

interface Props {
  prompt?: string;
  activeStep?: number;
  steps?: string[];
  mascotMessage?: string;
  onClose?: () => void;
  onRetry?: () => void;
  errorMessage?: string | null;
  onSelectStep?: (step: number) => void;
}

export const ForgeUnderstandingScreen: React.FC<Props> = ({
  prompt = '',
  activeStep: controlledActiveStep = 2,
  steps = DEFAULT_FORGE_STEPS,
  mascotMessage = 'Exploring a few different directions for your game...',
  onClose,
  onRetry,
  errorMessage,
  onSelectStep,
}) => {
  const insets = useSafeAreaInsets();
  const [internalStep, setInternalStep] = useState(controlledActiveStep);

  // Companion Idle Breathing & Hammer Glow Animations
  const mascotBob = useSharedValue(0);
  const hammerGlow = useSharedValue(0.7);

  useEffect(() => {
    mascotBob.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    hammerGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.55, { duration: 1400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [hammerGlow, mascotBob]);

  const mascotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: mascotBob.value }],
  }));

  const hammerGlowStyle = useAnimatedStyle(() => ({
    opacity: hammerGlow.value,
  }));

  const activeStep = onSelectStep ? controlledActiveStep : internalStep;

  const handleStepPress = (idx: number) => {
    if (onSelectStep) {
      onSelectStep(idx);
    } else {
      setInternalStep(idx);
    }
  };

  return (
    <View style={styles.container}>
      {/* Deep obsidian midnight background matching mockup exactly */}
      <LinearGradient
        colors={['#00050D', '#010814', '#00040A']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Content layout with safe insets */}
      <View style={[styles.inner, { paddingTop: insets.top + 6, paddingBottom: Math.max(insets.bottom, 14) }]}>
        {/* Top Header: gametok brand & actions */}
        <View style={styles.header}>
          <Text style={styles.logoText}>gametok</Text>

          <View style={styles.headerActions}>
            {/* Close button */}
            {onClose && (
              <Pressable
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedBtn]}
                onPress={onClose}
                hitSlop={12}
              >
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Section Title */}
        <View style={styles.titleWrap}>
          <Text style={styles.titleText}>Understanding your idea...</Text>
        </View>

        {/* Main Content Area */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Central Holographic Core & 4 Satellites */}
          <ForgeOrbView />

          {/* Checklist Card */}
          <View style={styles.cardSection}>
            <ForgeChecklistCard
              activeStep={activeStep}
              steps={steps}
              onSelectStep={handleStepPress}
            />
          </View>

          {/* Error Message banner if something went wrong */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              {onRetry && (
                <Pressable style={styles.retryBtn} onPress={onRetry}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </ScrollView>

        {/* Bottom Companion Mascot & Speech Bubble */}
        <View style={styles.mascotRow}>
          {/* Ground Contact Shadow */}
          <View style={styles.groundShadow} pointerEvents="none" />

          {/* Hammer Warm Glow Aura */}
          <Animated.View style={[styles.hammerAura, hammerGlowStyle]} pointerEvents="none" />

          {/* Visor Cyan Glow Aura */}
          <View style={styles.visorAura} pointerEvents="none" />

          {/* Companion Character with living idle breathing animation */}
          <Animated.View style={[styles.mascotWrap, mascotAnimatedStyle]}>
            <Image source={FORGE_MASCOT} style={styles.mascotImage} resizeMode="contain" />
          </Animated.View>

          {/* Speech Bubble */}
          <View style={styles.speechBubble}>
            {/* Bubble Tail pointing left directly to companion */}
            <View style={styles.speechTail} />
            <Text style={styles.speechText} numberOfLines={3}>
              {mascotMessage}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#01060E',
  },
  ambientTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '70%',
    height: 280,
  },
  ambientMidRight: {
    position: 'absolute',
    top: 180,
    right: 0,
    width: '60%',
    height: 340,
  },
  inner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 44,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedBtn: {
    opacity: 0.7,
  },
  titleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  cardSection: {
    width: '100%',
    marginTop: 6,
  },
  errorBox: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    flex: 1,
  },
  retryBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  mascotRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 8,
    position: 'relative',
  },
  groundShadow: {
    position: 'absolute',
    bottom: 2,
    left: 16,
    width: 120,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    transform: [{ scaleX: 1.2 }],
  },
  hammerAura: {
    position: 'absolute',
    bottom: 86,
    left: 14,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.9,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  visorAura: {
    position: 'absolute',
    bottom: 68,
    left: 58,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(103, 232, 249, 0.18)',
    shadowColor: '#67E8F9',
    shadowOpacity: 0.8,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  mascotWrap: {
    width: 148,
    height: 160,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 5,
  },
  mascotImage: {
    width: 148,
    height: 160,
  },
  speechBubble: {
    flex: 1,
    marginLeft: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(14, 21, 38, 0.94)',
    borderWidth: 1.4,
    borderColor: 'rgba(103, 232, 249, 0.28)',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    position: 'relative',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 4,
  },
  speechTail: {
    position: 'absolute',
    bottom: 28,
    left: -10,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: 'transparent',
    borderBottomWidth: 8,
    borderBottomColor: 'transparent',
    borderRightWidth: 11,
    borderRightColor: 'rgba(14, 21, 38, 0.94)',
  },
  speechText: {
    color: '#F8FAFC',
    fontSize: 16.5,
    lineHeight: 24,
    fontWeight: '700',
  },
});
