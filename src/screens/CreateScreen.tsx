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
  InputAccessoryView,
  Keyboard,
  Image,
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
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// =============================================
// TYPES
// =============================================
type DreamPhase = 'idle' | 'generating' | 'preview';
type StudioTab = 'create' | 'drafts' | 'templates';

interface DraftItem {
  id: string;
  title: string;
  prompt: string;
  thumbnail?: string;
  created_at: string;
}

const DRAFT_GRADIENTS: [string, string][] = [
  ['#FF6B35', '#F7931E'],
  ['#8B5CF6', '#6D28D9'],
  ['#06B6D4', '#0891B2'],
  ['#EC4899', '#DB2777'],
  ['#10B981', '#059669'],
  ['#F59E0B', '#D97706'],
];

const DRAFT_ICONS: any[] = [
  'game-controller',
  'rocket',
  'flash',
  'planet',
  'diamond',
  'cube',
];

const getTimeAgo = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `Created ${diffMins}m ago`;
  if (diffHours < 24) return `Created ${diffHours}h ago`;
  if (diffDays === 1) return 'Created 1 day ago';
  return `Created ${diffDays} days ago`;
};

interface CreateScreenProps {
  isActive: boolean;
  onClose: () => void;
}

// =============================================
// GENRE CHIP DATA
// =============================================
const GENRE_CHIPS = [
  { 
    icon: 'walk', 
    iconColor: '#a855f7', 
    label: 'Platformer', 
    prompts: [
      'A fast-paced platformer with wall-jumping and coin collecting',
      'A neon cyberpunk platformer where you double jump over laser pits',
      'A cute pixel art platformer with bouncing mushrooms and clouds',
      'A gravity-flipping platformer where touching the ceiling is survival'
    ] 
  },
  { 
    icon: 'extension-puzzle', 
    iconColor: '#25F4EE', 
    label: 'Puzzle', 
    prompts: [
      'A relaxing color-matching puzzle game with chain combos',
      'A physics-based puzzle where you draw lines to guide a falling ball',
      'A tetris-like falling block puzzle with exploding rows',
      'A brain teasing sliding tile puzzle with ice mechanics'
    ] 
  },
  { 
    icon: 'rocket', 
    iconColor: '#FF6B9D', 
    label: 'Space', 
    prompts: [
      'A space shooter with asteroid dodging and laser cannons',
      'An infinite space runner dodging alien ships in hyperspace',
      'A zero-gravity physics game where you thrust to land on moons',
      'A top-down roguelite space shooter with bouncing lasers'
    ] 
  },
  { 
    icon: 'flash', 
    iconColor: '#FFA726', 
    label: 'Battle', 
    prompts: [
      'An arena battle game with waves of enemies and power-ups',
      'A 1v1 auto-battler where you place knights and wizards',
      'A frantic top-down bullet hell game with huge boss fights',
      'A magic casting battle simulator against hordes of slimes'
    ] 
  },
  { 
    icon: 'basketball', 
    iconColor: '#a855f7', 
    label: 'Sports', 
    prompts: [
      'A basketball dunk contest game with physics-based throws',
      'A top-down arcade soccer game where you slide tackle and shoot',
      'An extreme downhill snowboarding game dodging pine trees',
      'A mini-golf game with portals, windmills, and bouncy walls'
    ] 
  },
  { 
    icon: 'skull', 
    iconColor: '#FF3B30', 
    label: 'Survival', 
    prompts: [
      'A zombie survival game where you defend a base with traps',
      'A vampire-survivors style endless horde runner with auto-attacks',
      'A harsh winter survival clicker where you manage a campfire',
      'An asteroid mining survival game where oxygen is running out'
    ] 
  },
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
  const cancelRef = useRef<(() => void) | null>(null);

  // Core state
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<DreamPhase>('idle');
  const [activeHtml, setActiveHtml] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [gameTitle, setGameTitle] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Studio tab state
  const [studioTab, setStudioTab] = useState<StudioTab>('create');
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);

  // Animations
  const orbPulse = useSharedValue(1);
  const orbRotation = useSharedValue(0);

  // Fetch drafts when screen becomes active or tab switches to drafts
  const fetchDrafts = useCallback(async () => {
    try {
      setDraftsLoading(true);
      const res = await ai.drafts() as any;
      if (res?.drafts) {
        setDrafts(res.drafts);
      }
    } catch (e) {
      console.error('Failed to fetch drafts:', e);
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      fetchDrafts();
    }
  }, [isActive, fetchDrafts]);

  useEffect(() => {
    if (studioTab === 'drafts') {
      fetchDrafts();
    }
  }, [studioTab, fetchDrafts]);

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
  const handleGenreSelect = (genrePrompts: string[]) => {
    const randomPrompt = genrePrompts[Math.floor(Math.random() * genrePrompts.length)];
    setPrompt(randomPrompt);
  };

  const handleDream = async () => {
    if (!prompt.trim() || phase === 'generating') return;
    setPhase('generating');
    setErrorMsg(null);

    try {
      const { promise, cancel } = ai.dream(prompt);
      cancelRef.current = cancel;
      const res = await promise as any;
      cancelRef.current = null;
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
      cancelRef.current = null;
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        // User cancelled — no error message needed
        return;
      }
      console.error('AI Generation Error', error);
      setErrorMsg(error.message || 'Something went wrong');
      setPhase('idle');
    }
  };

  const handleCancel = () => {
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    setPhase('idle');
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
      handleCancel();
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
          <Pressable style={styles.closeBtn} onPress={handleRegenerate}>
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
            mixedContentMode="always"
            allowUniversalAccessFromFileURLs={true}
            allowFileAccessFromFileURLs={true}
            onError={(e) => console.log('WebView Error:', e.nativeEvent)}
            onHttpError={(e) => console.log('WebView HTTP Error:', e.nativeEvent)}
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
          <Pressable style={styles.closeBtn} onPress={handleCancel}>
            <Ionicons name="close" size={22} color="#FFF" />
          </Pressable>
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

          {/* Cancel button */}
          <Pressable
            style={({ pressed }) => [
              styles.cancelBtn,
              pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
            ]}
            onPress={handleCancel}
          >
            <Ionicons name="stop-circle-outline" size={18} color="#FF6B6B" style={{ marginRight: 6 }} />
            <Text style={styles.cancelBtnText}>Stop Generation</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ======================
  // RENDER: IDLE (PROMPT INPUT)
  // ======================
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Full-screen pure purple-to-blue gradient for Create, solid black for Drafts */}
      {studioTab !== 'drafts' && (
        <LinearGradient
          colors={['rgba(88,28,135,0.4)', 'rgba(30,58,138,0.3)', 'rgba(10,20,50,0.1)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* Header — changes based on active tab */}
      {studioTab === 'create' ? (
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="#E0E0E0" />
          </Pressable>
          <Text style={styles.headerTitle}>Create your game</Text>
          <View style={{ width: 38 }} />
        </View>
      ) : studioTab === 'drafts' ? (
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="#E0E0E0" />
          </Pressable>
          <Text style={styles.headerTitle}>Your Draft</Text>
          <Pressable style={{ paddingHorizontal: 4 }}>
            <Text style={{ color: '#FF453A', fontSize: 15, fontWeight: '600' }}>Delete</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="#E0E0E0" />
          </Pressable>
          <Text style={styles.headerTitle}>Templates</Text>
          <View style={{ width: 38 }} />
        </View>
      )}

      {/* ============================== */}
      {/* TAB: CREATE                    */}
      {/* ============================== */}
      {studioTab === 'create' && (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* === MAIN INPUT CARD === */}
          <Animated.View entering={FadeInUp.delay(100).duration(400)}>
            <View style={styles.inputCard}>
              <LinearGradient
                colors={['rgba(168,85,247,0.4)', 'rgba(37,244,238,0.2)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.inputGlowBorder}
              />

              {/* Text input area */}
              <TextInput
                ref={inputRef}
                style={styles.mainInput}
                placeholder="Describe your dream game..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                maxLength={500}
                value={prompt}
                onChangeText={setPrompt}
                textAlignVertical="top"
                inputAccessoryViewID="gametok-done"
              />

              {/* Bottom row inside input — surprise me + send */}
              <View style={styles.inputBottomRow}>
                <Pressable
                  style={styles.surpriseBtn}
                  onPress={() => {
                    const surprises = [
                      'A hypnotic infinite runner where you dodge falling emoji meteors in space',
                      'An addictive tower stacking game with physics and chain-reaction explosions',
                      'A satisfying color-matching puzzle game with chain combos and confetti',
                      'A zombie office survival game where you throw staplers at undead coworkers',
                      'A neon rhythm game where you tap beats falling through a cyberpunk city',
                      'A cat vs laser pointer chase game with ragdoll physics',
                    ];
                    setPrompt(surprises[Math.floor(Math.random() * surprises.length)]);
                  }}
                >
                  <Ionicons name="sparkles" size={16} color="#a855f7" style={styles.surpriseEmoji as any} />
                  <Text style={styles.surpriseText}>Surprise me</Text>
                </Pressable>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {prompt.length > 0 && <Text style={styles.charCount}>{prompt.length}</Text>}
                  <Pressable
                    style={[styles.sendBtn, !prompt.trim() && { opacity: 0.3 }]}
                    onPress={handleDream}
                    disabled={!prompt.trim()}
                  >
                    <Ionicons name="arrow-up" size={20} color="#FFF" />
                  </Pressable>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* === MEDIA TOOLBAR === */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
              <Pressable style={styles.mediaBtn}>
                <View style={[styles.mediaIcon, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
                  <Ionicons name="images-outline" size={26} color="#a855f7" />
                </View>
                <Text style={styles.mediaLabel}>Images</Text>
              </Pressable>
              <Pressable style={styles.mediaBtn}>
                <View style={[styles.mediaIcon, { backgroundColor: 'rgba(37,244,238,0.12)' }]}>
                  <Ionicons name="musical-notes-outline" size={26} color="#25F4EE" />
                </View>
                <Text style={styles.mediaLabel}>Sounds</Text>
              </Pressable>
              <Pressable style={styles.mediaBtn}>
                <View style={[styles.mediaIcon, { backgroundColor: 'rgba(255,107,157,0.12)' }]}>
                  <Ionicons name="happy-outline" size={26} color="#FF6B9D" />
                </View>
                <Text style={styles.mediaLabel}>Memes</Text>
              </Pressable>
              <Pressable style={styles.mediaBtn}>
                <View style={[styles.mediaIcon, { backgroundColor: 'rgba(255,167,38,0.12)' }]}>
                  <Ionicons name="sparkles-outline" size={26} color="#FFA726" />
                </View>
                <Text style={styles.mediaLabel}>Make Image</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>

          {/* === NEED IDEAS? SECTION === */}
          <Animated.View entering={FadeInUp.delay(300).duration(400)}>
            <View style={styles.ideasGrid}>
              {GENRE_CHIPS.map((chip) => (
                <Pressable
                  key={chip.label}
                  style={({ pressed }) => [styles.ideaPill, pressed && { transform: [{ scale: 0.95 }] }]}
                  onPress={() => handleGenreSelect(chip.prompts)}
                >
                  <Ionicons name={chip.icon as any} size={15} color={chip.iconColor} />
                  <Text style={styles.ideaLabel}>{chip.label}</Text>
                </Pressable>
              ))}
            </View>
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
        </ScrollView>
      </KeyboardAvoidingView>
      )}

      {/* ============================== */}
      {/* TAB: DRAFTS                    */}
      {/* ============================== */}
      {studioTab === 'drafts' && (
        <View style={{ flex: 1 }}>
          {/* Draft count */}
          <Text style={styles.draftCountLabel}>{drafts.length} drafts</Text>

          {draftsLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color="#a855f7" />
            </View>
          ) : drafts.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Ionicons name="folder-open-outline" size={48} color="#333" />
              <Text style={{ color: '#555', fontSize: 16, fontWeight: '600' }}>No drafts yet</Text>
              <Text style={{ color: '#444', fontSize: 13 }}>Games you generate will appear here</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.draftsGrid}
              showsVerticalScrollIndicator={false}
            >
              {drafts.map((draft, index) => (
                <Pressable
                  key={draft.id}
                  style={({ pressed }) => [styles.draftCard, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                  onPress={async () => {
                    try {
                      const res = await ai.getDraft(draft.id) as any;
                      if (res?.draft?.html_payload) {
                        setActiveHtml(res.draft.html_payload);
                        setActiveDraftId(res.draft.id);
                        setGameTitle(res.draft.title || 'Untitled Game');
                        setPhase('preview');
                      }
                    } catch (e) {
                      console.error('Failed to open draft:', e);
                    }
                  }}
                >
                  {/* Thumbnail */}
                  <View style={styles.draftThumbnail}>
                    {draft.thumbnail ? (
                      <Image
                        source={{ uri: draft.thumbnail }}
                        style={StyleSheet.absoluteFillObject}
                        resizeMode="cover"
                      />
                    ) : (
                      <>
                        <LinearGradient
                          colors={DRAFT_GRADIENTS[index % DRAFT_GRADIENTS.length]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFillObject}
                        />
                        <Ionicons
                          name={DRAFT_ICONS[index % DRAFT_ICONS.length]}
                          size={44}
                          color="rgba(255,255,255,0.35)"
                        />
                      </>
                    )}
                    {/* Completed badge */}
                    <View style={styles.draftBadge}>
                      <Text style={styles.draftBadgeText}>Completed</Text>
                    </View>
                  </View>

                  {/* Info */}
                  <Text style={styles.draftTitle} numberOfLines={1}>
                    {draft.title || 'Untitled Game'}
                  </Text>
                  <Text style={styles.draftDate}>{getTimeAgo(draft.created_at)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* ============================== */}
      {/* TAB: TEMPLATES (placeholder)   */}
      {/* ============================== */}
      {studioTab === 'templates' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Ionicons name="color-wand-outline" size={48} color="#333" />
          <Text style={{ color: '#555', fontSize: 16, fontWeight: '600' }}>Coming Soon</Text>
          <Text style={{ color: '#444', fontSize: 13 }}>Pre-built game templates to remix</Text>
        </View>
      )}

      {/* === BOTTOM TAB BAR === */}
      <View style={{ width: '100%', alignItems: 'center', paddingBottom: Math.max(insets.bottom, 12) }}>
        <View style={styles.bottomTabs}>
          <Pressable
            style={[styles.bottomTab, studioTab === 'create' && styles.bottomTabActive]}
            onPress={() => setStudioTab('create')}
          >
            <Ionicons name={studioTab === 'create' ? 'home' : 'home-outline'} size={20} color={studioTab === 'create' ? '#FFF' : '#888'} />
            <Text style={[styles.bottomTabLabel, studioTab === 'create' && styles.bottomTabLabelActive]}>Create</Text>
          </Pressable>
          <Pressable
            style={[styles.bottomTab, studioTab === 'drafts' && styles.bottomTabActive]}
            onPress={() => setStudioTab('drafts')}
          >
            <Ionicons name={studioTab === 'drafts' ? 'cube' : 'cube-outline'} size={20} color={studioTab === 'drafts' ? '#FFF' : '#888'} />
            <Text style={[styles.bottomTabLabel, studioTab === 'drafts' && styles.bottomTabLabelActive]}>Drafts{drafts.length > 0 ? ` (${drafts.length})` : ''}</Text>
          </Pressable>
          <Pressable
            style={[styles.bottomTab, studioTab === 'templates' && styles.bottomTabActive]}
            onPress={() => setStudioTab('templates')}
          >
            <Ionicons name={studioTab === 'templates' ? 'copy' : 'copy-outline'} size={20} color={studioTab === 'templates' ? '#FFF' : '#888'} />
            <Text style={[styles.bottomTabLabel, studioTab === 'templates' && styles.bottomTabLabelActive]}>Templates</Text>
          </Pressable>
        </View>
      </View>

      {/* === iOS KEYBOARD DONE BAR === */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="gametok-done">
          <View style={styles.accessoryBar}>
            <View style={{ flexDirection: 'row', gap: 16, paddingLeft: 8 }}>
              <Ionicons name="chevron-up" size={24} color="#666" />
              <Ionicons name="chevron-down" size={24} color="#666" />
            </View>
            <Pressable onPress={() => Keyboard.dismiss()} style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
              <Text style={styles.accessoryDoneText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#08080C',
    zIndex: 99999,
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
  headerTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E1E22',
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 140,
    flexGrow: 1,
  },

  // === MAIN INPUT CARD ===
  inputCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)',
    backgroundColor: '#0E0E14',
  },
  inputGlowBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  inputInner: {
    padding: 20,
    paddingTop: 24,
  },
  mainInput: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 26,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  inputBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  surpriseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  surpriseEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  surpriseText: {
    color: '#BBB',
    fontSize: 13,
    fontWeight: '600',
  },
  charCount: {
    color: '#555',
    fontSize: 13,
    fontWeight: '700',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a855f7',
  },

  mediaRow: {
    gap: 12,
    paddingBottom: 20,
    paddingRight: 20,
  },
  mediaBtn: {
    alignItems: 'center',
    gap: 8,
    width: 85,
  },
  mediaIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  mediaLabel: {
    color: '#CCC',
    fontSize: 12,
    fontWeight: '700',
  },

  // === NEED IDEAS SECTION ===
  ideasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
    paddingHorizontal: 32,
  },
  ideaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  ideaEmoji: {
    fontSize: 16,
  },
  ideaLabel: {
    color: '#CCC',
    fontSize: 13,
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

  // === FIXED BOTTOM BAR ===
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'rgba(8,8,12,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  generateBtn: {
    height: 58,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a855f7',
    shadowOpacity: 0.3,
    shadowRadius: 16,
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
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(255,107,107,0.25)',
    backgroundColor: 'rgba(255,107,107,0.06)',
  },
  cancelBtnText: {
    color: '#FF6B6B',
    fontSize: 15,
    fontWeight: '700',
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

  // === KEYBOARD ACCESSORY ===
  accessoryBar: {
    backgroundColor: '#1E1E20',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  accessoryDoneText: {
    color: '#0A84FF',
    fontSize: 16,
    fontWeight: '600',
  },



  // === BOTTOM TAB BAR ===
  bottomTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '92%',
    backgroundColor: '#161618',
    borderRadius: 40,
    padding: 6,
    justifyContent: 'space-between',
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 34,
    gap: 4,
  },
  bottomTabActive: {
    backgroundColor: '#2C2C2E',
  },
  bottomTabLabel: {
    color: '#777',
    fontSize: 10,
    fontWeight: '600',
  },
  bottomTabLabelActive: {
    color: '#FFF',
  },

  // === DRAFTS TAB ===
  draftCountLabel: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  draftsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 20,
  },
  draftCard: {
    width: (SCREEN_WIDTH - 16 * 2 - 12) / 2,
    marginBottom: 4,
  },
  draftThumbnail: {
    width: '100%',
    aspectRatio: 0.85,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  draftBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  draftBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  draftTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  draftDate: {
    color: '#777',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
});
