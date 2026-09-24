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
import { ForgeChecklistCard } from './ForgeChecklistCard';

const FORGE_MASCOT = require('../../../assets/forge/forge_mascot.png');

export const BUILDING_STEPS = [
  'Gathering and preparing assets...',
  'Building the world...',
  'Setting up gameplay...',
  'Adding audio & effects...',
  'Finalizing your game...',
];

interface Props {
  prompt?: string;
  gameTitle?: string;
  activeStep?: number;
  steps?: string[];
  mascotMessage?: string;
  onClose?: () => void;
  onCookInBackground?: () => void;
}

export const ForgeBuildingScreen: React.FC<Props> = ({
  prompt = '',
  gameTitle = 'Your game',
  activeStep = 1,
  steps = BUILDING_STEPS,
  mascotMessage = "Everything's coming together!\nThis usually takes a few minutes.",
  onClose,
  onCookInBackground,
}) => {
  const insets = useSafeAreaInsets();

  // Step progression: starts at activeStep and smoothly ticks forward
  const [internalStep, setInternalStep] = useState(Math.max(1, activeStep));

  useEffect(() => {
    setInternalStep((prev) => Math.max(prev, activeStep));
  }, [activeStep]);

  useEffect(() => {
    const timer = setInterval(() => {
      setInternalStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 5500);
    return () => clearInterval(timer);
  }, [steps.length]);

  const effectiveStep = Math.max(internalStep, activeStep);

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
        {/* Top Header: gametok brand & close button */}
        <View style={styles.header}>
          <Text style={styles.logoText}>gametok</Text>

          <View style={styles.headerActions}>
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
          <Text style={styles.titleText}>Building your game...</Text>
          <Text style={styles.subtitleText}>Bringing together everything you need.</Text>
        </View>

        {/* Main Content Area */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Central Holographic Core & 6 Satellites (Building Mode) */}
          <ForgeOrbView mode="building" />

          {/* Checklist Card */}
          <View style={styles.cardSection}>
            <ForgeChecklistCard
              activeStep={effectiveStep}
              steps={steps}
            />
          </View>
        </ScrollView>

        {/* Bottom Companion Mascot & Speech Bubble & Cook Button */}
        <View style={styles.mascotRow}>
          {/* Ground Contact Shadow */}
          <View style={styles.groundShadow} pointerEvents="none" />

          {/* Hammer Specular White Glow Aura (Zero Orange) */}
          <Animated.View style={[styles.hammerAura, hammerGlowStyle]} pointerEvents="none" />

          {/* Visor Cyan Glow Aura */}
          <View style={styles.visorAura} pointerEvents="none" />

          {/* Companion Character with living idle breathing animation */}
          <Animated.View style={[styles.mascotWrap, mascotAnimatedStyle]}>
            <Image source={FORGE_MASCOT} style={styles.mascotImage} resizeMode="contain" />
          </Animated.View>

          {/* Right Action Column: Speech Bubble on Top, Cook in Background below */}
          <View style={styles.rightActionCol}>
            {/* Speech Bubble */}
            <View style={styles.speechBubble}>
              <View style={styles.speechTail} />
              <Text style={styles.speechText} numberOfLines={3}>
                {mascotMessage}
              </Text>
            </View>

            {/* Cook in background action button (Zero Orange, Pure White & Dark Frost) */}
            <Pressable
              style={({ pressed }) => [styles.cookBtn, pressed && styles.cookBtnPressed]}
              onPress={onCookInBackground || onClose}
              hitSlop={8}
            >
              <Ionicons name="flame" size={17} color="#FFFFFF" />
              <Text style={styles.cookBtnText}>Cook in background</Text>
            </Pressable>
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
    gap: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ scale: 0.95 }],
  },
  titleWrap: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitleText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14.5,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: -0.2,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  cardSection: {
    paddingHorizontal: 16,
    marginTop: 10,
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
  rightActionCol: {
    flex: 1,
    marginLeft: 8,
    marginBottom: 8,
    gap: 8,
  },
  speechBubble: {
    backgroundColor: 'rgba(14, 21, 38, 0.94)',
    borderWidth: 1.4,
    borderColor: 'rgba(103, 232, 249, 0.28)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: 'relative',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
  speechTail: {
    position: 'absolute',
    bottom: 22,
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
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  cookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cookBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    transform: [{ scale: 0.98 }],
  },
  cookBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
