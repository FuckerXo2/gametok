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
  Alert,
  Modal,
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
import { ai, API_URL, getToken } from '../services/api';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
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

  // Modal & UGC state
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUri, setGeneratedImageUri] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imagePromptText, setImagePromptText] = useState('');
  const [showColorsModal, setShowColorsModal] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [showSoundsModal, setShowSoundsModal] = useState(false);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [showVideosModal, setShowVideosModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [audioTab, setAudioTab] = useState<'bgm' | 'sfx'>('bgm');
  const [activeFeatures, setActiveFeatures] = useState<Record<string, boolean>>({});
  const [communityVideos, setCommunityVideos] = useState<any[]>([]);
  const [communityAudios, setCommunityAudios] = useState<any[]>([]);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);

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
    transform: [{ scale: orbPulse.value }, { rotate: `${orbRotation.value}deg` } as any],
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


  // === TOOL OPTIONS ===
  const COLOR_PALETTES = [
    { name: 'Neon', bg: '#000', colors: ['#FF00FF', '#00FFFF', '#39FF14'], instruction: 'Change the entire color scheme to vibrant neon: magenta, cyan, neon green. Use black backgrounds with glow effects.' },
    { name: 'Sunset', bg: '#2A1B38', colors: ['#FF6B6B', '#FF8E53', '#FFD93D'], instruction: 'Change the entire color scheme to warm sunset tones: coral reds, burnt orange, golden yellow.' },
    { name: 'Ocean', bg: '#0F2027', colors: ['#0077B6', '#00B4D8', '#CAF0F8'], instruction: 'Change the color scheme to ocean tones: deep blue, cyan, ice white.' },
    { name: 'Pastel', bg: '#FDFBF7', colors: ['#FFB5E8', '#B5DEFF', '#BAFFC9'], instruction: 'Change the color scheme to soft pastels: pink, baby blue, mint green.' },
    { name: 'Dark Mode', bg: '#0D0D10', colors: ['#E94560', '#A855F7', '#3B82F6'], instruction: 'Change the color scheme to sleek dark mode with neon accents.' },
    { name: 'Retro 80s', bg: '#10002b', colors: ['#F72585', '#7209B7', '#4CC9F0'], instruction: 'Change the color scheme to synthwave retro: hot pink, deep purple, electric blue.' },
  ];

  const OPTIONS_SOUNDS = [
    { label: 'Add Full Sound Effects', icon: 'musical-notes', desc: 'Jumps, scores, collisions, and game over', instruction: 'Add rich sound effects throughout the game. Use window.playSound("jump") for jumps/taps, window.playSound("coin") for scoring, window.playSound("hit") for collisions, and window.playSound("gameover") for game over.' },
    { label: 'Mute Entire Game', icon: 'volume-mute', desc: 'Remove all audio completely', instruction: 'Remove all calls to window.playSound() from the entire game. Make it completely silent.' },
  ];

  const OPTIONS_BGM = [
    { label: 'BGM-gameplay-military-tense', duration: '01:25', url: 'https://cdn.freesound.org/previews/495/495537_495537-lq.mp3' },
    { label: 'BGM-menu-scifi-mysterious', duration: '01:41', url: 'https://cdn.freesound.org/previews/454/454593_454593-lq.mp3' },
    { label: 'BGM-gameplay-modern-exciting', duration: '01:36', url: 'https://cdn.freesound.org/previews/588/588496_588496-lq.mp3' },
    { label: 'BGM-retro-8bit-arcade', duration: '01:53', url: 'https://cdn.freesound.org/previews/251/251461_251461-lq.mp3' },
  ];

  const OPTIONS_VIDEOS = [
    { label: 'Hyperspace', thumb: 'https://picsum.photos/seed/hyper/200/300', url: 'https://cdn.pixabay.com/video/2020/09/20/50531-460875411_tiny.mp4' },
    { label: 'Neon Grid', thumb: 'https://picsum.photos/seed/neon/200/300', url: 'https://cdn.pixabay.com/video/2021/04/16/71239-537446549_tiny.mp4' },
    { label: 'Cloud Flight', thumb: 'https://picsum.photos/seed/cloud/200/300', url: 'https://cdn.pixabay.com/video/2021/08/04/83896-584742491_tiny.mp4' },
    { label: 'Pixel Snow', thumb: 'https://picsum.photos/seed/pixel/200/300', url: 'https://cdn.pixabay.com/video/2019/12/17/30419-380962372_tiny.mp4' },
  ];

  const OPTIONS_FEATURES = [
    { id: 'cam', icon: 'videocam', label: 'Live Camera', desc: 'Streams camera feed as game background.', instruction: 'Add HTML5 camera feed using navigator.mediaDevices.getUserMedia and render it as the game canvas background.' },
    { id: 'mic', icon: 'mic', label: 'Microphone Audio Input', desc: 'Captures mic for voice-driven gameplay.', instruction: 'Use navigator.mediaDevices.getUserMedia for the microphone, extract the volume/frequency, and use it for a core game mechanic.' },
    { id: 'gyro', icon: 'compass', label: 'Tilt / Gyroscope Control', desc: 'Uses phone gyroscope for movement.', instruction: 'Capture deviceorientation events and bind alpha/beta/gamma to player movement instead of touch.' },
    { id: 'haptic', icon: 'radio', label: 'Haptic Feedback', desc: 'Triggers vibrations on key events.', instruction: 'Add navigator.vibrate() calls: short on jump, medium on score, long burst on collision or game over.' },
  ];

  const MODIFY_OPTIONS = [
    { label: 'Add 3 Levels', icon: 'layers', instruction: 'Add 3 progressively harder levels to this game. Each level should increase difficulty.' },
    { label: 'Make it Harder', icon: 'trending-up', instruction: 'Increase the overall difficulty: faster speeds, tighter timing, more obstacles.' },
    { label: 'Make it Easier', icon: 'trending-down', instruction: 'Decrease difficulty: slower speeds, more forgiving timing, fewer obstacles.' },
    { label: 'Add Power-ups', icon: 'flash', instruction: 'Add 3 collectible power-ups: shield, speed boost, and double points.' },
    { label: 'Add Animations', icon: 'sparkles', instruction: 'Add smooth animations: screen shake on collision, particle effects on score, bouncy transitions.' },
  ];

  // === UGC HANDLERS ===
  const fetchCommunityAssets = async (type: string) => {
    try {
      const res = await fetch(`${API_URL}/assets/trending?type=${type}`);
      const data = await res.json();
      if (data.success && data.assets) {
        if (type === 'video') setCommunityVideos(data.assets);
        else if (type === 'bgm' || type === 'sfx') setCommunityAudios(data.assets);
      }
    } catch(err) { console.log(err); }
  };

  useEffect(() => {
    if (showVideosModal) fetchCommunityAssets('video');
  }, [showVideosModal]);

  useEffect(() => {
    if (showAudioModal) fetchCommunityAssets(audioTab);
  }, [showAudioModal, audioTab]);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const handleAssetUpload = async (type: 'video' | 'bgm' | 'sfx' | 'image') => {
    try {
      let result: any;
      if (type === 'video' || type === 'image') {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: type === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      }
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      setIsUploadingAsset(true);
      const asset = result.assets[0];
      const formData = new FormData();
      const fileUri = asset.uri;
      const fileName = fileUri.split('/').pop() || 'upload.mp4';
      formData.append('file', { uri: fileUri, name: fileName, type: 'multipart/form-data' } as any);
      formData.append('type', type);
      formData.append('title', 'Community Upload');
      const token = await getToken();
      const uploadRes = await fetch(`${API_URL}/assets/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      setIsUploadingAsset(false);
      if (uploadData.success) {
        if (type === 'video') {
          setShowVideosModal(false);
          handleEdit(`Add a full-screen looping background video: ${uploadData.url}`);
        } else if (type === 'bgm' || type === 'sfx') {
          setShowAudioModal(false);
          handleEdit(`Inject this audio URL into the game: ${uploadData.url}`);
        }
      } else {
        Alert.alert('Upload Failed', uploadData.error || 'Failed');
      }
    } catch (e) {
      console.log(e);
      setIsUploadingAsset(false);
      Alert.alert('Error', 'Asset upload failed');
    }
  };

  const handleModify = () => setShowModifyModal(true);
  const handleGeneratePhoto = () => setShowImageModal(true);
  const handleSounds = () => setShowSoundsModal(true);
  const submitImageGeneration = async () => {
    if (!imagePromptText.trim()) return;
    setIsGeneratingImage(true);
    try {
      const result = await ai.generateAsset(imagePromptText);
      if (result && (result as any).imageUrl) {
        setGeneratedImageUri((result as any).imageUrl);
      }
    } catch (e) {
      Alert.alert('Error', 'Image generation failed');
    }
    setIsGeneratingImage(false);
  };

  const handleCancel = () => {
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    setPhase('idle');
  };

  const handleEdit = async (instructionsText: string, newAsset?: { key: string; base64: string }) => {
    if (!instructionsText.trim() || !activeDraftId) return;
    const instructions = instructionsText.trim();
    setPhase('generating');
    setErrorMsg(null);

    try {
      const { promise, cancel } = ai.edit(activeDraftId, instructions, newAsset);
      cancelRef.current = cancel;
      const res = await promise as any;
      cancelRef.current = null;
      if (res.success && res.htmlPreview) {
        setActiveHtml(res.htmlPreview);
        setPhase('preview');
      } else {
        throw new Error(res.error || 'Failed to modify game.');
      }
    } catch (err: any) {
      if (err.message !== 'aborted') {
        setErrorMsg(err.message || 'Check your connection and try again.');
        setPhase('idle');
      }
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
      handleCancel();
    } else {
      onClose();
    }
  };

  if (!isActive) return null;

  if (phase === 'preview' && activeHtml) {
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={[styles.screen, { paddingTop: insets.top }]}
      >
        {/* === TOP BAR === */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.previewTopBar}>
          <Pressable style={styles.closeBtn} onPress={handleRegenerate}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </Pressable>
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
            {gameTitle || 'Preview'}
          </Text>
          <Pressable 
            style={[styles.previewPublishPill, { backgroundColor: colors.primary }]} 
            onPress={handlePublish}
          >
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>Publish</Text>
          </Pressable>
        </Animated.View>

        {/* === GAME WEBVIEW === */}
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
          {keyboardVisible && (
            <Pressable style={[StyleSheet.absoluteFill, { zIndex: 999 }]} onPress={() => Keyboard.dismiss()} />
          )}
        </View>

        {/* === BOTTOM TOOL STRIP === */}
        <Animated.View entering={SlideInDown.duration(500)} style={[styles.previewBottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
            {[
              { icon: 'options-outline', label: 'Modify', action: handleModify },
              { icon: 'hardware-chip-outline', label: 'Features', action: () => setShowFeaturesModal(true) },
              { icon: 'musical-notes-outline', label: 'Audio', action: () => setShowAudioModal(true) },
              { icon: 'film-outline', label: 'Videos', action: () => setShowVideosModal(true) },
              { icon: 'color-filter-outline', label: 'Colors', action: () => setShowColorsModal(true) },
              { icon: 'image-outline', label: 'Images', action: handleGeneratePhoto },
            ].map((tool, i) => (
              <Pressable key={i} style={{ alignItems: 'center', gap: 6 }} onPress={tool.action}>
                <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={tool.icon as any} size={22} color="#FFF" />
                </View>
                <Text style={{ color: '#AAA', fontSize: 11, fontWeight: '600' }}>{tool.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {/* === MODIFY MODAL === */}
        <Modal visible={showModifyModal} transparent animationType="fade" onRequestClose={() => setShowModifyModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowModifyModal(false)}>
            <Animated.View entering={FadeInUp.duration(300).springify()} style={{ width: '100%', maxWidth: 360, backgroundColor: '#141416', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} onStartShouldSetResponder={() => true}>
              <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 20 }}>Modify Game</Text>
              {MODIFY_OPTIONS.map((opt, i) => (
                <Pressable key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }} onPress={() => { setShowModifyModal(false); handleEdit(opt.instruction); }}>
                  <Ionicons name={opt.icon as any} size={22} color="#FFF" style={{ marginRight: 14 }} />
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>{opt.label}</Text>
                </Pressable>
              ))}
            </Animated.View>
          </Pressable>
        </Modal>

        {/* === COLORS MODAL === */}
        <Modal visible={showColorsModal} transparent animationType="fade" onRequestClose={() => setShowColorsModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowColorsModal(false)}>
            <Animated.View entering={FadeInUp.duration(300).springify()} style={{ width: '100%', maxWidth: 360, backgroundColor: '#141416', borderRadius: 28, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} onStartShouldSetResponder={() => true}>
              <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 16 }}>Color Palettes</Text>
              <ScrollView style={{ maxHeight: 400 }}>
                {COLOR_PALETTES.map((palette, i) => (
                  <Pressable key={i} style={{ padding: 16, borderRadius: 16, backgroundColor: palette.bg, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} onPress={() => { setShowColorsModal(false); handleEdit(palette.instruction); }}>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                      {palette.colors.map(c => <View key={c} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c }} />)}
                    </View>
                    <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>{palette.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* === FEATURES MODAL === */}
        <Modal visible={showFeaturesModal} transparent animationType="fade" onRequestClose={() => setShowFeaturesModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }} onPress={() => setShowFeaturesModal(false)}>
            <Animated.View entering={SlideInDown.duration(300).springify()} style={{ width: '100%', maxHeight: '80%', backgroundColor: '#1C1C1E', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom + 20 }} onStartShouldSetResponder={() => true}>
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 16 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 12 }} />
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>Feature Setup</Text>
              </View>
              <ScrollView style={{ paddingHorizontal: 20 }}>
                {OPTIONS_FEATURES.map((opt, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                      <Ionicons name={opt.icon as any} size={20} color="#999" />
                    </View>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>{opt.label}</Text>
                      <Text style={{ color: '#888', fontSize: 13, lineHeight: 18 }}>{opt.desc}</Text>
                    </View>
                    <Pressable 
                      onPress={() => setActiveFeatures(prev => ({...prev, [opt.id]: !prev[opt.id]}))}
                      style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: activeFeatures[opt.id] ? '#D97736' : 'rgba(255,255,255,0.1)', justifyContent: 'center', paddingHorizontal: 2 }}
                    >
                      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF', alignSelf: activeFeatures[opt.id] ? 'flex-end' : 'flex-start' }} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, gap: 12 }}>
                <Pressable style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }} onPress={() => setActiveFeatures({})}>
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Clear all</Text>
                </Pressable>
                <Pressable style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: '#D97736', alignItems: 'center' }} onPress={() => {
                  setShowFeaturesModal(false);
                  const activeKeys = Object.keys(activeFeatures).filter(k => activeFeatures[k]);
                  if (activeKeys.length === 0) return;
                  const inst = activeKeys.map(k => OPTIONS_FEATURES.find(o => o.id === k)?.instruction).join(' ');
                  handleEdit(inst);
                }}>
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Apply</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* === AUDIO MODAL === */}
        <Modal visible={showAudioModal} transparent animationType="fade" onRequestClose={() => setShowAudioModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }} onPress={() => setShowAudioModal(false)}>
            <Animated.View entering={SlideInDown.duration(300).springify()} style={{ width: '100%', height: '85%', backgroundColor: '#1C1C1E', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom }} onStartShouldSetResponder={() => true}>
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 12 }} />
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <Pressable onPress={() => setAudioTab('bgm')} style={{ paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: audioTab === 'bgm' ? '#FFF' : 'transparent' }}>
                    <Text style={{ color: audioTab === 'bgm' ? '#FFF' : '#777', fontSize: 16, fontWeight: '700' }}>BGM</Text>
                  </Pressable>
                  <Pressable onPress={() => setAudioTab('sfx')} style={{ paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: audioTab === 'sfx' ? '#FFF' : 'transparent' }}>
                    <Text style={{ color: audioTab === 'sfx' ? '#FFF' : '#777', fontSize: 16, fontWeight: '700' }}>Sound effects</Text>
                  </Pressable>
                </View>
              </View>
              <ScrollView style={{ paddingHorizontal: 20, paddingTop: 10 }}>
                <Pressable onPress={() => handleAssetUpload(audioTab)} style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 16, width: 140, flexDirection: 'row', justifyContent: 'center' }}>
                  <Ionicons name="push-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Upload</Text>
                </Pressable>
                {audioTab === 'bgm' ? (
                  (communityAudios.length > 0 ? communityAudios : OPTIONS_BGM).map((opt: any, i: number) => (
                    <Pressable key={'b'+i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }} onPress={() => { setShowAudioModal(false); handleEdit('Inject this auto-looping background music: ' + opt.url); }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600', marginBottom: 4 }} numberOfLines={1}>{opt.label || opt.title}</Text>
                        <Text style={{ color: '#666', fontSize: 12 }}>{opt.duration || ''}</Text>
                      </View>
                      <Ionicons name="play" size={24} color="#FFF" style={{ marginHorizontal: 16 }} />
                      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#777' }} />
                    </Pressable>
                  ))
                ) : (
                  OPTIONS_SOUNDS.map((opt, i) => (
                    <Pressable key={'s'+i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }} onPress={() => { setShowAudioModal(false); handleEdit(opt.instruction); }}>
                      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                        <Ionicons name={opt.icon as any} size={20} color="#FFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>{opt.label}</Text>
                        <Text style={{ color: '#888', fontSize: 13 }}>{opt.desc}</Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* === VIDEOS MODAL === */}
        <Modal visible={showVideosModal} transparent animationType="fade" onRequestClose={() => setShowVideosModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }} onPress={() => setShowVideosModal(false)}>
            <Animated.View entering={SlideInDown.duration(300).springify()} style={{ width: '100%', height: '80%', backgroundColor: '#1C1C1E', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom }} onStartShouldSetResponder={() => true}>
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 16 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 12 }} />
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>Video</Text>
              </View>
              <ScrollView style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4, gap: 4 }}>
                  <Pressable onPress={() => handleAssetUpload('video')} style={{ width: '32%', aspectRatio: 0.8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    {isUploadingAsset ? <ActivityIndicator size="small" color="#D97736" style={{ marginBottom: 8 }} /> : <Ionicons name="push-outline" size={24} color="#D97736" style={{ marginBottom: 8 }} />}
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Upload</Text>
                    <Text style={{ color: '#666', fontSize: 11, marginTop: 4 }}>(Maximum 15s)</Text>
                  </Pressable>
                  {(communityVideos.length > 0 ? communityVideos : OPTIONS_VIDEOS).map((opt: any, i: number) => (
                    <Pressable key={i} style={{ width: '32%', aspectRatio: 0.8, borderRadius: 12, overflow: 'hidden', marginBottom: 8, backgroundColor: '#000' }} onPress={() => { setShowVideosModal(false); handleEdit('Add a full-screen looping background video, autoplaying and muted: ' + (opt.url || '')); }}>
                      <Image source={{ uri: opt.thumb || opt.thumbnail || 'https://picsum.photos/200/300' }} style={{ width: '100%', height: '100%', opacity: 0.8 }} resizeMode="cover" />
                      <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>00:15</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* === IMAGE MAKER MODAL === */}
        <Modal visible={showImageModal} transparent animationType="fade" onRequestClose={() => { if (!isGeneratingImage) setShowImageModal(false); }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', maxWidth: 380, backgroundColor: '#141416', borderRadius: 28, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(168,85,247,0.15)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(168,85,247,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Ionicons name="sparkles" size={22} color="#a855f7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '800' }}>AI Image Maker</Text>
                </View>
                {!isGeneratingImage && (
                  <Pressable onPress={() => setShowImageModal(false)} hitSlop={12}>
                    <Ionicons name="close-circle" size={30} color="rgba(255,255,255,0.2)" />
                  </Pressable>
                )}
              </View>
              {generatedImageUri ? (
                <View style={{ margin: 16, borderRadius: 16, overflow: 'hidden' }}>
                  <Image source={{ uri: generatedImageUri }} style={{ width: '100%', aspectRatio: 1, backgroundColor: '#000' }} resizeMode="contain" />
                </View>
              ) : isGeneratingImage ? (
                <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 16, aspectRatio: 1.2, backgroundColor: '#0D0D10', alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color="#a855f7" />
                  <Text style={{ color: '#CCC', fontSize: 15, fontWeight: '700', marginTop: 16 }}>Creating your image...</Text>
                </View>
              ) : (
                <View style={{ margin: 16 }}>
                  <TextInput
                    style={{ color: '#FFF', fontSize: 16, backgroundColor: '#0D0D10', borderRadius: 16, padding: 16, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(168,85,247,0.1)' }}
                    placeholder="Describe what you want to create..."
                    placeholderTextColor="#444"
                    value={imagePromptText}
                    onChangeText={setImagePromptText}
                    multiline
                    autoFocus
                  />
                </View>
              )}
              <View style={{ padding: 16, gap: 10 }}>
                {generatedImageUri ? (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable style={{ flex: 1, paddingVertical: 15, borderRadius: 30, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }} onPress={() => { setGeneratedImageUri(null); setImagePromptText(''); }}>
                      <Text style={{ color: '#999', fontWeight: '700', fontSize: 14 }}>Try Again</Text>
                    </Pressable>
                    <Pressable style={{ flex: 1, borderRadius: 30, overflow: 'hidden' }} onPress={() => { setShowImageModal(false); setPrompt(prev => prev + (prev ? '\n' : '') + '[AI Image attached]'); }}>
                      <LinearGradient colors={['#a855f7', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 15, alignItems: 'center', borderRadius: 30 }}>
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>Use This Image</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                ) : !isGeneratingImage ? (
                  <Pressable style={{ borderRadius: 30, overflow: 'hidden' }} onPress={submitImageGeneration} disabled={!imagePromptText.trim()}>
                    <LinearGradient colors={imagePromptText.trim() ? ['#a855f7', '#7c3aed'] : ['#2A2A2D', '#222']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderRadius: 30 }}>
                      <Ionicons name="color-wand" size={18} color={imagePromptText.trim() ? '#FFF' : '#666'} />
                      <Text style={{ color: imagePromptText.trim() ? '#FFF' : '#666', fontWeight: '800', fontSize: 15 }}>Generate Image</Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <Pressable style={{ paddingVertical: 15, borderRadius: 30, borderWidth: 1.5, borderColor: 'rgba(255,59,48,0.2)', alignItems: 'center', backgroundColor: 'rgba(255,59,48,0.06)' }} onPress={() => { setIsGeneratingImage(false); setShowImageModal(false); }}>
                    <Text style={{ color: '#FF6B6B', fontWeight: '700', fontSize: 14 }}>Cancel</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
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
  previewPublishPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
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
