import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Text,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ai } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// =============================================
// TYPES
// =============================================
type DreamPhase = 'idle' | 'generating' | 'preview';

interface CreateScreenProps {
  isActive: boolean;
  onClose: () => void;
}

// =============================================
// GENRE CHIP DATA
// =============================================
const GENRE_CHIPS = [
  { emoji: '🏃', label: 'Platformer', prompt: 'A fast-paced platformer with wall-jumping and coin collecting' },
  { emoji: '🧩', label: 'Puzzle', prompt: 'A relaxing color-matching puzzle game with chain combos' },
  { emoji: '🚀', label: 'Space', prompt: 'A space shooter with asteroid dodging and laser cannons' },
  { emoji: '⚔️', label: 'Battle', prompt: 'An arena battle game with waves of enemies and power-ups' },
  { emoji: '🏀', label: 'Sports', prompt: 'A basketball dunk contest game with physics-based throws' },
  { emoji: '🧟', label: 'Survival', prompt: 'A zombie survival game where you defend a base with traps' },
];

// =============================================
// GENERATING PHASE STEPS
// =============================================
const GENERATION_STEPS = [
  { icon: 'code-slash', text: 'Writing game logic...' },
  { icon: 'cube', text: 'Compiling physics engine...' },
  { icon: 'color-palette', text: 'Rendering world...' },
  { icon: 'musical-notes', text: 'Generating audio...' },
];

// =============================================
// GENRE CHIP COMPONENT
// =============================================
const GenreChip = ({ emoji, label, onPress, colors }: any) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.genreChip,
        pressed && { transform: [{ scale: 0.95 }], backgroundColor: 'rgba(255,255,255,0.08)' },
      ]}
      onPress={onPress}
    >
      <Text style={styles.genreEmoji}>{emoji}</Text>
      <Text style={styles.genreLabel}>{label}</Text>
    </Pressable>
  );
};

// =============================================
// STEP INDICATOR COMPONENT (for generation phase)
// =============================================
const StepIndicator = ({ step, isActive, isComplete }: { step: typeof GENERATION_STEPS[0]; isActive: boolean; isComplete: boolean }) => {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[styles.stepRow, isActive && { opacity: 1 }, isComplete && { opacity: 0.4 }]}
    >
      <View style={[styles.stepDot, isActive && { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.8, shadowRadius: 8 }, isComplete && { backgroundColor: '#2ECC71' }]}>
        {isComplete ? (
          <Ionicons name="checkmark" size={10} color="#FFF" />
        ) : (
          isActive && <ActivityIndicator size="small" color="#FFF" />
        )}
      </View>
      <Text style={[styles.stepText, isActive && { color: '#FFF', fontWeight: '700' }]}>{step.text}</Text>
    </Animated.View>
  );
};

// =============================================
// MAIN DREAMSTREAM SCREEN
// =============================================
export const CreateScreen: React.FC<CreateScreenProps> = ({ isActive, onClose }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  // Core state
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<DreamPhase>('idle');
  const [activeHtml, setActiveHtml] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [gameTitle, setGameTitle] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Animations
  const orbPulse = useSharedValue(1);
  const orbRotation = useSharedValue(0);

  // Reset everything when screen becomes inactive
  useEffect(() => {
    if (!isActive) {
      // Don't wipe state immediately — let the tab system handle hiding
    }
  }, [isActive]);

  // Orb animation during generation
  useEffect(() => {
    if (phase === 'generating') {
      orbPulse.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.9, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      orbRotation.value = withRepeat(
        withTiming(360, { duration: 3000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      orbPulse.value = withTiming(1);
      orbRotation.value = 0;
    }
  }, [phase]);

  // Step progression during generation
  useEffect(() => {
    if (phase !== 'generating') return;
    setActiveStep(0);
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev < GENERATION_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [phase]);

  const animatedOrbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbPulse.value }, { rotate: `${orbRotation.value}deg` }],
  }));

  // ======================
  // HANDLERS
  // ======================
  const handleGenreSelect = (genrePrompt: string) => {
    setPrompt(genrePrompt);
  };

  const handleDream = async () => {
    if (!prompt.trim() || phase === 'generating') return;
    setPhase('generating');
    setErrorMsg(null);

    try {
      const res = await ai.dream(prompt);
      if (res.success && res.htmlPreview) {
        setActiveHtml(res.htmlPreview);
        setActiveDraftId(res.draftId);
        setGameTitle(res.title || 'Untitled Dream');
        setPhase('preview');
      } else {
        setErrorMsg(res.error || 'Generation failed');
        setPhase('idle');
      }
    } catch (error: any) {
      console.error('AI Generation Error', error);
      setErrorMsg(error.message || 'Something went wrong');
      setPhase('idle');
    }
  };

  const handleRegenerate = () => {
    setActiveHtml(null);
    setActiveDraftId(null);
    setGameTitle('');
    setPhase('idle');
  };

  const handlePublish = async () => {
    if (!activeDraftId) return;
    try {
      const res = await ai.publish(activeDraftId);
      if (res.success) {
        console.log('✅ LIVE! Game pushed to Feed:', res.gameId);
        handleRegenerate();
        onClose();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBack = () => {
    if (phase === 'preview') {
      handleRegenerate();
    } else if (phase === 'generating') {
      // Can't cancel mid-generation
    } else {
      onClose();
    }
  };

  if (!isActive) return null;

  // ======================
  // RENDER: GAME PREVIEW
  // ======================
  if (phase === 'preview' && activeHtml) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* Floating top bar with game title */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.previewTopBar}>
          <Pressable style={styles.backBtn} onPress={handleRegenerate}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </Pressable>
          <View style={styles.titlePill}>
            <Ionicons name="game-controller" size={14} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.titlePillText} numberOfLines={1}>{gameTitle}</Text>
          </View>
          <View style={{ width: 40 }} />
        </Animated.View>

        {/* Full-screen WebView */}
        <View style={styles.webviewContainer}>
          <WebView
            source={{ html: activeHtml, baseUrl: 'https://gametok.app' }}
            style={{ flex: 1, backgroundColor: '#000' }}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            bounces={false}
            scrollEnabled={false}
            allowsInlineMediaPlayback={true}
          />
        </View>

        {/* Floating bottom action bar */}
        <Animated.View entering={SlideInDown.duration(500)} style={[styles.previewBottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable style={styles.regenBtn} onPress={handleRegenerate}>
            <Ionicons name="refresh" size={20} color="#FFF" />
            <Text style={styles.regenBtnText}>Retry</Text>
          </Pressable>
          <Pressable style={[styles.publishBtn, { backgroundColor: colors.primary }]} onPress={handlePublish}>
            <Ionicons name="flash" size={18} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.publishBtnText}>Publish to Feed</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  // ======================
  // RENDER: GENERATING
  // ======================
  if (phase === 'generating') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.genHeader}>
          <View style={{ width: 40 }} />
          <Text style={styles.genHeaderTitle}>DreamStream</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.generatingContainer}>
          {/* Pulsating energy orb */}
          <Animated.View style={[styles.orbOuter, animatedOrbStyle]}>
            <LinearGradient
              colors={[colors.primary, '#00E5FF', '#B026FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.orbGradient}
            />
          </Animated.View>

          {/* Ambient glow beneath orb */}
          <View style={[styles.orbGlow, { backgroundColor: colors.primary }]} />

          <Text style={styles.genTitle}>Building your universe...</Text>
          <Text style={styles.genSubtitle}>"{prompt.length > 60 ? prompt.substring(0, 60) + '...' : prompt}"</Text>

          {/* Step indicators */}
          <View style={styles.stepsContainer}>
            {GENERATION_STEPS.map((step, i) => (
              <StepIndicator
                key={i}
                step={step}
                isActive={i === activeStep}
                isComplete={i < activeStep}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ======================
  // RENDER: IDLE (PROMPT INPUT)
  // ======================
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Ambient background glow */}
      <View style={[styles.ambientGlow, { backgroundColor: colors.primary }]} />
      <View style={[styles.ambientGlow2, { backgroundColor: '#00E5FF' }]} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={onClose}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>DreamStream</Text>
        <Pressable style={styles.draftsBtn}>
          <Ionicons name="layers" size={16} color="#FFF" />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero text */}
          <View style={styles.heroContainer}>
            <Text style={styles.heroLine1}>What should</Text>
            <Text style={styles.heroLine1}>we <Text style={[styles.heroAccent, { color: colors.primary }]}>build</Text>?</Text>
            <Text style={styles.heroSub}>
              Describe any game and our AI will build it instantly. No coding needed.
            </Text>
          </View>

          {/* Input card */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(500)}
            style={[
              styles.inputCard,
              prompt.trim().length > 0 && { borderColor: `${colors.primary}60` },
            ]}
          >
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="Describe your dream game..."
              placeholderTextColor="#555"
              multiline
              value={prompt}
              onChangeText={setPrompt}
              textAlignVertical="top"
            />

            {prompt.length > 0 && (
              <Text style={styles.charCount}>{prompt.length}</Text>
            )}
          </Animated.View>

          {/* Error message */}
          {errorMsg && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.errorBox}>
              <Ionicons name="warning" size={16} color="#FF3B30" />
              <Text style={styles.errorText}>{errorMsg}</Text>
              <Pressable onPress={() => setErrorMsg(null)}>
                <Ionicons name="close-circle" size={18} color="#666" />
              </Pressable>
            </Animated.View>
          )}

          {/* Genre suggestion chips */}
          <Text style={styles.sectionLabel}>Quick ideas</Text>
          <View style={styles.genreGrid}>
            {GENRE_CHIPS.map((chip) => (
              <GenreChip
                key={chip.label}
                emoji={chip.emoji}
                label={chip.label}
                colors={colors}
                onPress={() => handleGenreSelect(chip.prompt)}
              />
            ))}
          </View>
        </ScrollView>

        {/* Bottom generate button — always visible */}
        <View style={[styles.bottomAction, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            style={({ pressed }) => [
              styles.generateBtn,
              { backgroundColor: prompt.trim() ? colors.primary : '#1A1A1E' },
              pressed && prompt.trim() && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleDream}
            disabled={!prompt.trim()}
          >
            <Ionicons name="sparkles" size={20} color={prompt.trim() ? '#FFF' : '#555'} style={{ marginRight: 8 }} />
            <Text style={[styles.generateBtnText, { color: prompt.trim() ? '#FFF' : '#555' }]}>
              Generate Game
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

// =============================================
// STYLES
// =============================================
const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0C',
    zIndex: 99999,
  },

  // === AMBIENT GLOWS ===
  ambientGlow: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.08,
  },
  ambientGlow2: {
    position: 'absolute',
    bottom: 100,
    left: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.04,
  },

  // === HEADER ===
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  draftsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // === SCROLL CONTENT ===
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 120,
    flexGrow: 1,
  },

  // === HERO ===
  heroContainer: {
    marginBottom: 28,
  },
  heroLine1: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -1,
    lineHeight: 46,
  },
  heroAccent: {
    fontWeight: '900',
  },
  heroSub: {
    fontSize: 15,
    color: '#7A7A85',
    marginTop: 14,
    fontWeight: '500',
    lineHeight: 22,
    maxWidth: '85%',
  },

  // === INPUT CARD ===
  inputCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 20,
    minHeight: 160,
    marginBottom: 16,
  },
  textInput: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    color: '#444',
    fontSize: 12,
    fontWeight: '600',
  },

  // === ERROR ===
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,59,48,0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.15)',
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '600',
  },

  // === GENRE CHIPS ===
  sectionLabel: {
    color: '#555',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  genreEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  genreLabel: {
    color: '#CCC',
    fontSize: 14,
    fontWeight: '600',
  },

  // === BOTTOM ACTION ===
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: 'rgba(10,10,12,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  generateBtn: {
    height: 58,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  generateBtnText: {
    fontSize: 17,
    fontWeight: '800',
  },

  // === GENERATING PHASE ===
  genHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  genHeaderTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  generatingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  orbOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 12,
  },
  orbGradient: {
    flex: 1,
    borderRadius: 50,
  },
  orbGlow: {
    width: 200,
    height: 200,
    borderRadius: 100,
    position: 'absolute',
    opacity: 0.12,
    top: SCREEN_HEIGHT * 0.3,
  },
  genTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 24,
    textAlign: 'center',
  },
  genSubtitle: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
    maxWidth: '90%',
  },
  stepsContainer: {
    marginTop: 40,
    width: '100%',
    gap: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.3,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  stepText: {
    color: '#777',
    fontSize: 15,
    fontWeight: '500',
  },

  // === PREVIEW PHASE ===
  previewTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    zIndex: 10,
  },
  titlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    maxWidth: SCREEN_WIDTH * 0.6,
  },
  titlePillText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  webviewContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  previewBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    paddingHorizontal: 20,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 6,
  },
  regenBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  publishBtn: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  publishBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
