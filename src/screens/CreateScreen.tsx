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
  FlatList,
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
  FadeOutDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ai, API_URL, getToken } from '../services/api';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '../context/ThemeContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// =============================================
// TYPES
// =============================================
type DreamPhase = 'idle' | 'generating' | 'preview' | 'publish';
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
      'A wildly fast-paced platformer where you double jump over lava pits and bounce off walls to collect neon coins while avoiding saw blades.',
      'A cyberpunk platformer set in a dystopian city where you grapple on buildings and escape from pursuit drones.',
      'A cute but brutally difficult pixel art platformer starring a squishy slime trying to escape a cursed dungeon.',
      'A mind-bending platformer where tapping the screen reverses gravity, making you run on the ceiling to dodge spikes.'
    ] 
  },
  { 
    icon: 'extension-puzzle', 
    iconColor: '#25F4EE', 
    label: 'Puzzle', 
    prompts: [
      'A satisfying physics puzzle where you draw bridges and ramps with your finger to guide a fragile egg to a basket.',
      'An addictive color-matching puzzle game with massive chain reaction combos that fill the screen with confetti.',
      'A Tetris-style falling block puzzle but the blocks have jello physics and stack squishily on top of each other.',
      'A clever brain-teaser where you slide ice blocks across a friction-less floor to hit specific targets.'
    ] 
  },
  { 
    icon: 'rocket', 
    iconColor: '#FF6B9D', 
    label: 'Space', 
    prompts: [
      'An intense vertical space shooter where you upgrade your lasers to blast through massive waves of alien bugs.',
      'A high-speed endless runner set in a neon hyperspace tunnel where you dodge asteroid fields and laser barriers.',
      'A realistic physics game where you must perfectly thrust and rotate a lunar lander to touch down safely on uneven terrain.',
      'A twin-stick bullet hell space battle against a giant boss that shoots spirals of colorful plasma blasts.'
    ] 
  },
  { 
    icon: 'flash', 
    iconColor: '#FFA726', 
    label: 'Battle', 
    prompts: [
      'A chaotic auto-battler where you drop medieval knights and wizards onto a grid to fight hoards of green goblins.',
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
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [showCommunityImagesModal, setShowCommunityImagesModal] = useState(false);
  const [communityPhotos, setCommunityPhotos] = useState<any[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<any | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [selectedCommunityImage, setSelectedCommunityImage] = useState<any | null>(null);
  const [attachedAssets, setAttachedAssets] = useState<any[]>([]);
  const [memeTab, setMemeTab] = useState<'gif' | 'stickers'>('gif');
  const [memeSearchQuery, setMemeSearchQuery] = useState('');
  const [isMemeSearching, setIsMemeSearching] = useState(false);
  const [giphyResults, setGiphyResults] = useState<any[]>([]);
  const [giphyStickers, setGiphyStickers] = useState<any[]>([]);
  const [isGiphyLoading, setIsGiphyLoading] = useState(false);
  const [isGiphyLoadingMore, setIsGiphyLoadingMore] = useState(false);
  
  const [showExitConfirm, setShowExitConfirm] = useState<'discard' | 'closeApp' | null>(null);
  const [privacySetting, setPrivacySetting] = useState<'public' | 'play_only' | 'private'>('public');
  const [labsMode, setLabsMode] = useState(false);

  // Audio search state
  const [audioSearchQuery, setAudioSearchQuery] = useState('');
  const [isAudioSearching, setIsAudioSearching] = useState(false);
  const [freesoundBgm, setFreesoundBgm] = useState<any[]>([]);
  const [freesoundSfx, setFreesoundSfx] = useState<any[]>([]);
  const [isFreesoundLoading, setIsFreesoundLoading] = useState(false);
  const [isFreesoundLoadingMore, setIsFreesoundLoadingMore] = useState(false);

  // Studio tab state
  const [studioTab, setStudioTab] = useState<StudioTab>('create');
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

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
    if (studioTab === 'templates') {
      fetchTemplates();
    }
  }, [studioTab, fetchDrafts]);

  const fetchTemplates = useCallback(async () => {
    try {
      setTemplatesLoading(true);
      const res = await ai.templates() as any;
      if (res?.templates) {
        setTemplates(res.templates);
      }
    } catch (e) {
      console.error('Failed to fetch templates:', e);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

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
    let finalPrompt = prompt.trim();
    if (!finalPrompt || phase === 'generating') return;

    if (attachedAssets.length > 0) {
      finalPrompt += `\n\n[USER ATTACHED ASSETS (REQUIRED)]\n`;
      attachedAssets.forEach((a, i) => {
        finalPrompt += `Asset (${i+1}): ${a.instruction}\n`;
      });
    }

    setPhase('generating');
    setErrorMsg(null);

    try {
      const { promise, cancel } = labsMode ? ai.dreamLabs(finalPrompt) : ai.dream(finalPrompt);
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

  /* FREESOUND AUDIO LOADED DYNAMICALLY VIA API */

  /* COMMUNITY VIDEOS LOADED DYNAMICALLY VIA API */

  /* GIPHY ASSETS ARE LOADED DYNAMICALLY VIA API */

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
        else if (type === 'image') setCommunityPhotos(data.assets);
      }
    } catch(err) { console.log(err); }
  };

  const fetchGiphy = async (type: 'gifs' | 'stickers', query: string = '', offset: number = 0) => {
    if (offset === 0) setIsGiphyLoading(true);
    else setIsGiphyLoadingMore(true);
    
    try {
      const endpoint = query.trim() ? 'search' : 'trending';
      const GIPHY_API_KEY = 'SwEhCBr38RpeNNffpxmtsZK9Umum8edV';
      const qParam = query.trim() ? `&q=${encodeURIComponent(query)}` : '';
      const url = `https://api.giphy.com/v1/${type}/${endpoint}?api_key=${GIPHY_API_KEY}&limit=20&offset=${offset}${qParam}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      const formatted = (data.data || []).map((item: any) => ({
        id: item.id,
        url: item.images.fixed_height.url,
      }));

      if (type === 'gifs') {
        setGiphyResults(prev => offset === 0 ? formatted : [...prev, ...formatted]);
      } else {
        setGiphyStickers(prev => offset === 0 ? formatted : [...prev, ...formatted]);
      }
    } catch (error) {
      console.error('Error fetching Giphy:', error);
    } finally {
      setIsGiphyLoading(false);
      setIsGiphyLoadingMore(false);
    }
  };

  const fetchFreesound = async (type: 'bgm' | 'sfx', query: string = '', offset: number = 1) => {
    if (offset === 1) setIsFreesoundLoading(true);
    else setIsFreesoundLoadingMore(true);

    try {
      const FREESOUND_API_KEY = 'mgD2q6sEgb7r8seRdGqRVBgszcAgMqPAzGpHPAkk';
      const actualQuery = query.trim() || (type === 'bgm' ? 'game music loop' : 'game effect UI');
      const filter = type === 'bgm' ? '&filter=duration:[10.0 TO 300.0]' : '&filter=duration:[0.1 TO 15.0]';
      const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(actualQuery)}&token=${FREESOUND_API_KEY}${filter}&fields=id,name,previews,duration&page_size=20&page=${offset}`;

      const response = await fetch(url);
      const data = await response.json();

      const formatted = (data.results || []).map((item: any) => {
         const dur = Math.round(item.duration || 0);
         const mins = Math.floor(dur / 60);
         const secs = dur % 60;
         return {
            id: item.id,
            label: item.name,
            url: item.previews['preview-hq-mp3'] || item.previews['preview-lq-mp3'],
            duration: `${mins < 10 ? '0'+mins : mins}:${secs < 10 ? '0'+secs : secs}`,
            instruction: type === 'bgm' ? `Set the game background music to this URL: ${item.previews['preview-hq-mp3'] || item.previews['preview-lq-mp3']}` : `Add a sound effect using this URL: ${item.previews['preview-hq-mp3'] || item.previews['preview-lq-mp3']}`
         };
      });

      if (type === 'bgm') {
        setFreesoundBgm(prev => offset === 1 ? formatted : [...prev, ...formatted]);
      } else {
        setFreesoundSfx(prev => offset === 1 ? formatted : [...prev, ...formatted]);
      }
    } catch (error) {
      console.error('Error fetching Freesound:', error);
    } finally {
      setIsFreesoundLoading(false);
      setIsFreesoundLoadingMore(false);
    }
  };

  useEffect(() => {
    if (showVideosModal) fetchCommunityAssets('video');
  }, [showVideosModal]);

  useEffect(() => {
    if (showAudioModal) fetchCommunityAssets(audioTab);
  }, [showAudioModal, audioTab]);

  // Pre-load trending Giphy and Freesound results silently in the background
  useEffect(() => {
    fetchGiphy('gifs', '');
    fetchGiphy('stickers', '');
    fetchFreesound('bgm', '');
    fetchFreesound('sfx', '');
  }, []);

  useEffect(() => {
    if (showPhotosModal) {
      fetchCommunityAssets('image');
    }
  }, [showPhotosModal]);

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
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.8,
        });
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
      if (uploadData.success && (uploadData.url || uploadData.asset?.url)) {
        const finalUrl = uploadData.asset?.url || uploadData.url;
        const uploadedItem = { url: finalUrl, type, thumb: finalUrl };
        if (type === 'video') {
          setShowVideosModal(false);
          handleAssetSelect(uploadedItem, `Add a full-screen looping background video: ${finalUrl}`);
        } else if (type === 'bgm' || type === 'sfx') {
          setShowAudioModal(false);
          handleAssetSelect(uploadedItem, `Inject this audio URL into the game: ${finalUrl}`);
        } else if (type === 'image') {
          setShowCommunityImagesModal(false);
          handleAssetSelect(uploadedItem, `Use this image: ${finalUrl}`);
        }
        // Refresh community pool silently so it's ready next time
        fetchCommunityAssets(type);
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
      if (result && ((result as any).base64 || (result as any).imageUrl)) {
        setGeneratedImageUri((result as any).base64 || (result as any).imageUrl);
        // Silently refresh the community image pool, since the backend just added this AI image globally
        fetchCommunityAssets('image');
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

  const handleAssetSelect = (item: any, fallbackInstruction: string) => {
    if (!activeDraftId) {
      if (!attachedAssets.find(a => a.url === item.url)) {
        const newItem = { ...item, instruction: fallbackInstruction };
        setAttachedAssets(prev => [...prev, newItem]);
      }
    } else {
      handleEdit(fallbackInstruction);
    }
  };

  const handleEdit = async (instructionsText: string, newAsset?: { key: string; base64: string }) => {
    const instructions = instructionsText.trim();
    if (!instructions) return;

    if (!activeDraftId) {
      // If the game hasn't been generated yet, append the asset instruction to the prompt text box
      setPrompt(prev => prev + (prev ? '\n' : '') + `[Asset Added: ${instructions}]`);
      return;
    }

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

  const handleIntentClose = (actionType: 'discard' | 'closeApp' = 'closeApp') => {
    if (phase === 'generating') {
      // If generating, don't show exit modal, just drop back to idle/close 
      // (Keep cooking handles the background logic inherently)
      if (actionType === 'closeApp') onClose();
      else setPhase('idle');
      return;
    }
    
    // Check if user has unsaved input or an active preview
    if (activeDraftId || prompt.trim() || attachedAssets.length > 0 || activeHtml) {
      setShowExitConfirm(actionType);
    } else {
      if (actionType === 'closeApp') onClose();
      else handleRegenerate();
    }
  };

  const handleConfirmExit = () => {
    const action = showExitConfirm;
    setShowExitConfirm(null);
    handleRegenerate();
    if (action === 'closeApp') onClose();
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


  const renderSharedModals = () => (
    <>
      {/* === MODIFY MODAL === */}
              <Modal visible={showModifyModal} transparent animationType="fade" onRequestClose={() => setShowModifyModal(false)}>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowModifyModal(false)}>
                  <Animated.View entering={FadeInUp.duration(250)} style={{ width: '100%', maxWidth: 360, backgroundColor: '#141416', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} onStartShouldSetResponder={() => true}>
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
                  <Animated.View entering={FadeInUp.duration(250)} style={{ width: '100%', maxWidth: 360, backgroundColor: '#141416', borderRadius: 28, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} onStartShouldSetResponder={() => true}>
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
                  <Animated.View entering={SlideInDown.duration(250)} style={{ width: '100%', maxHeight: '75%', backgroundColor: '#1C1C1E', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom + 20 }} onStartShouldSetResponder={() => true}>
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
                            style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: activeFeatures[opt.id] ? '#a855f7' : 'rgba(255,255,255,0.1)', justifyContent: 'center', paddingHorizontal: 2 }}
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
                      <Pressable style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: '#a855f7', alignItems: 'center' }} onPress={() => {
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
              <Modal visible={showAudioModal} transparent animationType="fade" onRequestClose={() => { setShowAudioModal(false); setSelectedAudio(null); }}>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }} onPress={() => { setShowAudioModal(false); setSelectedAudio(null); }}>
                  <Animated.View entering={SlideInDown.duration(250)} style={{ width: '100%', height: '75%', backgroundColor: '#1C1C1E', borderTopLeftRadius: 28, borderTopRightRadius: 28 }} onStartShouldSetResponder={() => true}>
                    <View style={{ alignItems: 'center', paddingTop: 12 }}>
                      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                    </View>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                      {isAudioSearching ? (
                        <View style={{ flex: 1, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 12 }}>
                          <Ionicons name="search" size={18} color="#888" />
                          <TextInput
                            style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, color: '#FFF', fontSize: 15 }}
                            placeholder={`Search ${audioTab === 'bgm' ? 'Music' : 'Sound Effects'}...`}
                            placeholderTextColor="#888"
                            autoFocus
                            value={audioSearchQuery}
                            onChangeText={setAudioSearchQuery}
                            onSubmitEditing={() => fetchFreesound(audioTab, audioSearchQuery)}
                            returnKeyType="search"
                          />
                          <Pressable onPress={() => { setIsAudioSearching(false); setAudioSearchQuery(''); fetchFreesound(audioTab, ''); }}>
                             <Text style={{ color: '#a855f7', fontWeight: '600' }}>Cancel</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <>
                          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>{audioTab === 'bgm' ? 'BGM' : 'Sound effects'}</Text>
                          <Pressable 
                            style={{ position: 'absolute', right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
                            onPress={() => setIsAudioSearching(true)}
                          >
                            <Ionicons name="search" size={18} color="#CCC" />
                          </Pressable>
                        </>
                      )}
                    </View>

                    <FlatList
                      style={{ paddingHorizontal: 20, paddingTop: 16 }}
                      data={audioTab === 'bgm' ? freesoundBgm : freesoundSfx}
                      keyExtractor={(item, index) => `${item.id}-${index}`}
                      showsVerticalScrollIndicator={false}
                      onEndReached={() => {
                        const currentLen = audioTab === 'bgm' ? freesoundBgm.length : freesoundSfx.length;
                        const nextPage = Math.floor(currentLen / 20) + 1;
                        if (currentLen > 0 && !isFreesoundLoadingMore && !isFreesoundLoading) {
                          fetchFreesound(audioTab, audioSearchQuery, nextPage);
                        }
                      }}
                      onEndReachedThreshold={0.5}
                      ListHeaderComponent={
                        <Pressable onPress={() => handleAssetUpload(audioTab)} style={{ backgroundColor: '#444', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', marginBottom: 16, alignSelf: 'flex-start', flexDirection: 'row', justifyContent: 'center' }}>
                          <Ionicons name="push-outline" size={18} color="#a855f7" style={{ marginRight: 8 }} />
                          <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>Upload</Text>
                        </Pressable>
                      }
                      renderItem={({ item }) => {
                        const isSelected = selectedAudio && (selectedAudio.url ? selectedAudio.url === item.url : selectedAudio.instruction === item.instruction);
                        return (
                          <Pressable style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }} onPress={() => setSelectedAudio(item)}>
                            <View style={{ flex: 1, paddingRight: 16 }}>
                              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600', marginBottom: 4 }} numberOfLines={1}>{item.label || item.title}</Text>
                              <Text style={{ color: '#666', fontSize: 12 }}>{item.duration || '00:03'}</Text>
                            </View>
                            <Ionicons name="play" size={24} color="#FFF" style={{ marginHorizontal: 16 }} />
                            <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: isSelected ? '#a855f7' : '#777', alignItems: 'center', justifyContent: 'center' }}>
                                {isSelected && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#a855f7' }} />}
                            </View>
                          </Pressable>
                        );
                      }}
                      ListEmptyComponent={
                        isFreesoundLoading ? (
                          <View style={{ width: '100%', height: 200, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator size="large" color="#a855f7" />
                          </View>
                        ) : null
                      }
                      ListFooterComponent={
                        isFreesoundLoadingMore ? (
                          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color="#a855f7" />
                          </View>
                        ) : <View style={{ height: 40 }} />
                      }
                    />

                    <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: '#1C1C1E', gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
                      <Pressable style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: '#555', alignItems: 'center' }} onPress={() => { setSelectedAudio(null); setShowAudioModal(false); }}>
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Cancel</Text>
                      </Pressable>
                      <Pressable 
                        style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: '#a855f7', alignItems: 'center', opacity: selectedAudio ? 1 : 0.5 }} 
                        disabled={!selectedAudio} 
                        onPress={() => { 
                          setShowAudioModal(false); 
                          const fallback = audioTab === 'bgm' ? 'Inject this auto-looping background music: ' : selectedAudio.instruction;
                          const instruction = audioTab === 'bgm' ? fallback + selectedAudio.url : fallback;
                          handleAssetSelect({ ...selectedAudio, type: audioTab }, instruction);
                          setSelectedAudio(null); 
                        }}
                      >
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Select</Text>
                      </Pressable>
                    </View>
                  </Animated.View>
                </Pressable>
              </Modal>
      
              {/* === VIDEOS MODAL === */}
              <Modal visible={showVideosModal} transparent animationType="fade" onRequestClose={() => { setShowVideosModal(false); setSelectedVideo(null); }}>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }} onPress={() => { setShowVideosModal(false); setSelectedVideo(null); }}>
                  <Animated.View entering={SlideInDown.duration(250)} style={{ width: '100%', height: '75%', backgroundColor: '#1C1C1E', borderTopLeftRadius: 28, borderTopRightRadius: 28 }} onStartShouldSetResponder={() => true}>
                    <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 16 }}>
                      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 12 }} />
                      <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>Video</Text>
                    </View>
                    <FlatList
                      style={{ flex: 1 }}
                      data={[{ isUpload: true }, ...communityVideos]}
                      keyExtractor={(item: any, index) => item.isUpload ? 'upload-btn' : `vid-${item.id || index}`}
                      numColumns={3}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: 4 }}
                      columnWrapperStyle={{ gap: 4, marginBottom: 4 }}
                      renderItem={({ item }: any) => {
                        if (item.isUpload) {
                          return (
                            <Pressable onPress={() => handleAssetUpload('video')} style={{ width: '32%', aspectRatio: 0.8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                              {isUploadingAsset ? <ActivityIndicator size="small" color="#a855f7" style={{ marginBottom: 8 }} /> : <Ionicons name="push-outline" size={24} color="#a855f7" style={{ marginBottom: 8 }} />}
                              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Upload</Text>
                              <Text style={{ color: '#666', fontSize: 11, marginTop: 4 }}>(Max 15s)</Text>
                            </Pressable>
                          );
                        }
                        const isSelected = selectedVideo?.url === item.url;
                        return (
                          <Pressable style={{ width: '32%', aspectRatio: 0.8, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }} onPress={() => setSelectedVideo(item)}>
                            <Image source={{ uri: item.thumb || item.thumbnail || 'https://picsum.photos/200/300' }} style={{ width: '100%', height: '100%', opacity: isSelected ? 0.6 : 0.8 }} resizeMode="cover" />
                            <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>{item.duration || '00:15'}</Text>
                            </View>
                            {isSelected && (
                              <View style={[StyleSheet.absoluteFillObject, { borderWidth: 4, borderColor: '#a855f7', borderRadius: 12 }]} />
                            )}
                          </Pressable>
                        );
                      }}
                      ListFooterComponent={
                        <>
                          {communityVideos.length === 0 && (
                            <View style={{ width: '100%', height: 200, alignItems: 'center', justifyContent: 'center' }}>
                              <ActivityIndicator size="large" color="#a855f7" />
                            </View>
                          )}
                          <View style={{ height: 40 }} />
                        </>
                      }
                    />
                    {/* Bottom Action Bar */}
                    <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: '#1C1C1E', gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
                      <Pressable style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: '#555', alignItems: 'center' }} onPress={() => { setSelectedVideo(null); setShowVideosModal(false); }}>
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Cancel</Text>
                      </Pressable>
                      <Pressable 
                        style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: '#a855f7', alignItems: 'center', opacity: selectedVideo ? 1 : 0.5 }} 
                        disabled={!selectedVideo} 
                        onPress={() => { 
                          setShowVideosModal(false); 
                          handleAssetSelect(selectedVideo, 'Add a full-screen looping background video, autoplaying and muted: ' + (selectedVideo.url || ''));
                          setSelectedVideo(null); 
                        }}
                      >
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Select</Text>
                      </Pressable>
                    </View>
                  </Animated.View>
                </Pressable>
              </Modal>

              {/* === COMMUNITY IMAGES MODAL === */}
              <Modal visible={showCommunityImagesModal} transparent animationType="fade" onRequestClose={() => { setShowCommunityImagesModal(false); setSelectedCommunityImage(null); }}>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }} onPress={() => { setShowCommunityImagesModal(false); setSelectedCommunityImage(null); }}>
                  <Animated.View entering={SlideInDown.duration(250)} style={{ width: '100%', height: '75%', backgroundColor: '#1C1C1E', borderTopLeftRadius: 28, borderTopRightRadius: 28 }} onStartShouldSetResponder={() => true}>
                    <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 16 }}>
                      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 12 }} />
                      <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>Images</Text>
                    </View>
                    <FlatList
                      style={{ flex: 1 }}
                      data={[{ isUpload: true }, ...communityPhotos]}
                      keyExtractor={(item: any, index) => item.isUpload ? 'upload-img-btn' : `img-${item.id || index}`}
                      numColumns={3}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: 4 }}
                      columnWrapperStyle={{ gap: 4, marginBottom: 4 }}
                      renderItem={({ item }: any) => {
                        if (item.isUpload) {
                          return (
                            <Pressable onPress={() => handleAssetUpload('image')} style={{ width: '32%', aspectRatio: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                              {isUploadingAsset ? <ActivityIndicator size="small" color="#a855f7" style={{ marginBottom: 8 }} /> : <Ionicons name="push-outline" size={24} color="#a855f7" style={{ marginBottom: 8 }} />}
                              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Upload</Text>
                            </Pressable>
                          );
                        }
                        const isSelected = selectedCommunityImage?.url === item.url;
                        return (
                          <Pressable style={{ width: '32%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }} onPress={() => setSelectedCommunityImage(item)}>
                            <Image source={{ uri: item.thumb || item.thumbnail || item.url }} style={{ width: '100%', height: '100%', opacity: isSelected ? 0.6 : 0.8 }} resizeMode="cover" />
                            {isSelected && (
                              <View style={[StyleSheet.absoluteFillObject, { borderWidth: 4, borderColor: '#a855f7', borderRadius: 12 }]} />
                            )}
                          </Pressable>
                        );
                      }}
                      ListFooterComponent={
                        <>
                          {communityPhotos.length === 0 && (
                            <View style={{ width: '100%', height: 200, alignItems: 'center', justifyContent: 'center' }}>
                              <ActivityIndicator size="large" color="#a855f7" />
                            </View>
                          )}
                          <View style={{ height: 40 }} />
                        </>
                      }
                    />
                    {/* Bottom Action Bar */}
                    <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: '#1C1C1E', gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
                      <Pressable style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: '#555', alignItems: 'center' }} onPress={() => { setSelectedCommunityImage(null); setShowCommunityImagesModal(false); }}>
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Cancel</Text>
                      </Pressable>
                      <Pressable 
                        style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: '#a855f7', alignItems: 'center', opacity: selectedCommunityImage ? 1 : 0.5 }} 
                        disabled={!selectedCommunityImage} 
                        onPress={() => { 
                          setShowCommunityImagesModal(false); 
                          handleAssetSelect(selectedCommunityImage, 'Use this community image asset: ' + (selectedCommunityImage.url || ''));
                          setSelectedCommunityImage(null); 
                        }}
                      >
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Select</Text>
                      </Pressable>
                    </View>
                  </Animated.View>
                </Pressable>
              </Modal>
      
              {/* === PHOTOS MODAL === */}
              <Modal visible={showPhotosModal} transparent animationType="fade" onRequestClose={() => { setShowPhotosModal(false); setSelectedPhoto(null); }}>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }} onPress={() => { setShowPhotosModal(false); setSelectedPhoto(null); }}>
                  <Animated.View entering={SlideInDown.duration(250)} style={{ width: '100%', height: '75%', backgroundColor: '#1C1C1E', borderTopLeftRadius: 28, borderTopRightRadius: 28 }} onStartShouldSetResponder={() => true}>
                    <View style={{ alignItems: 'center', paddingTop: 12 }}>
                      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                    </View>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 }}>
                      {isMemeSearching ? (
                        <View style={{ flex: 1, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 12 }}>
                          <Ionicons name="search" size={18} color="#888" />
                          <TextInput
                            style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, color: '#FFF', fontSize: 15 }}
                            placeholder={`Search ${memeTab === 'gif' ? 'GIFs' : 'Stickers'}...`}
                            placeholderTextColor="#888"
                            autoFocus
                            value={memeSearchQuery}
                            onChangeText={setMemeSearchQuery}
                            onSubmitEditing={() => fetchGiphy(memeTab === 'gif' ? 'gifs' : 'stickers', memeSearchQuery)}
                            returnKeyType="search"
                          />
                          <Pressable onPress={() => { setIsMemeSearching(false); setMemeSearchQuery(''); fetchGiphy(memeTab === 'gif' ? 'gifs' : 'stickers', ''); }}>
                             <Text style={{ color: '#a855f7', fontWeight: '600' }}>Cancel</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <>
                          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>Meme</Text>
                          <Pressable 
                            style={{ position: 'absolute', right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }} 
                            onPress={() => setIsMemeSearching(true)}
                          >
                            <Ionicons name="search" size={18} color="#CCC" />
                          </Pressable>
                        </>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', backgroundColor: '#2C2C2E', borderRadius: 24, alignSelf: 'center', padding: 4, marginBottom: 16 }}>
                      <Pressable 
                        onPress={() => setMemeTab('gif')}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 24, backgroundColor: memeTab === 'gif' ? '#1C1C1E' : 'transparent', borderRadius: 20 }}>
                        <Text style={{ color: memeTab === 'gif' ? '#FFF' : '#CCC', fontSize: 14, fontWeight: memeTab === 'gif' ? '700' : '600' }}>👾  GIF</Text>
                      </Pressable>
                      <Pressable 
                        onPress={() => setMemeTab('stickers')}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 24, backgroundColor: memeTab === 'stickers' ? '#1C1C1E' : 'transparent', borderRadius: 20 }}>
                        <Text style={{ color: memeTab === 'stickers' ? '#FFF' : '#CCC', fontSize: 14, fontWeight: memeTab === 'stickers' ? '700' : '600' }}>🙂  Stickers</Text>
                      </Pressable>
                    </View>
                    
                    <FlatList
                      style={{ flex: 1 }}
                      data={memeTab === 'gif' ? giphyResults : giphyStickers}
                      keyExtractor={(item, index) => `${item.id}-${index}`}
                      numColumns={3}
                      showsVerticalScrollIndicator={false}
                      onEndReached={() => {
                        const currentLen = memeTab === 'gif' ? giphyResults.length : giphyStickers.length;
                        if (currentLen > 0 && !isGiphyLoadingMore && !isGiphyLoading) {
                          fetchGiphy(memeTab === 'gif' ? 'gifs' : 'stickers', memeSearchQuery, currentLen);
                        }
                      }}
                      onEndReachedThreshold={0.5}
                      renderItem={({ item }) => {
                        const isSelected = selectedPhoto?.url === item.url;
                        return (
                          <Pressable 
                            style={{ flex: 1/3, aspectRatio: 1, backgroundColor: '#000' }} 
                            onPress={() => setSelectedPhoto(item)}
                          >
                            <Image source={{ uri: item.url }} style={{ width: '100%', height: '100%', opacity: isSelected ? 0.6 : 1 }} resizeMode="cover" />
                            {isSelected && (
                              <View style={[StyleSheet.absoluteFillObject, { borderWidth: 4, borderColor: '#a855f7' }]} />
                            )}
                          </Pressable>
                        );
                      }}
                      ListEmptyComponent={
                        isGiphyLoading ? (
                          <View style={{ width: '100%', height: 200, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator size="large" color="#a855f7" />
                          </View>
                        ) : null
                      }
                      ListFooterComponent={
                        isGiphyLoadingMore ? (
                          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color="#a855f7" />
                          </View>
                        ) : <View style={{ height: 20 }} />
                      }
                    />
      
                    {/* Bottom Action Bar */}
                    <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: '#1C1C1E', gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
                      <Pressable style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: '#555', alignItems: 'center' }} onPress={() => { setSelectedPhoto(null); setShowPhotosModal(false); }}>
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Cancel</Text>
                      </Pressable>
                      <Pressable 
                        style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: '#a855f7', alignItems: 'center', opacity: selectedPhoto ? 1 : 0.5 }} 
                        disabled={!selectedPhoto} 
                        onPress={() => { 
                          setShowPhotosModal(false); 
                          handleAssetSelect({ url: selectedPhoto.url, type: 'image', thumb: selectedPhoto.url }, `Use image: ${selectedPhoto.url}`);
                          setSelectedPhoto(null); 
                        }}
                      >
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Select</Text>
                      </Pressable>
                    </View>
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
                          <Pressable style={{ flex: 1, borderRadius: 30, overflow: 'hidden' }} onPress={() => { setShowImageModal(false); handleAssetSelect({ url: generatedImageUri, type: 'image', thumb: generatedImageUri }, `Use this AI generated asset image: ${generatedImageUri}`); }}>
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
    </>
  );

  if (!isActive) return null;

  // ======================
  // RENDER: PUBLISH SETTINGS
  // ======================
  if (phase === 'publish' && activeHtml) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.previewTopBar}>
          <Pressable style={styles.closeBtn} onPress={() => setPhase('preview')}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </Pressable>
          <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '700' }}>Publish Game</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false} bounces={false}>
          {/* Game Thumbnail Preview */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <View style={{ width: 180, height: 240, borderRadius: 20, overflow: 'hidden', backgroundColor: '#1E1E1E', shadowColor: '#a855f7', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } }}>
              <WebView
                source={{ html: activeHtml, baseUrl: 'https://gametok.app' }}
                style={{ flex: 1, backgroundColor: '#000' }}
                scrollEnabled={false}
                javaScriptEnabled={true}
                originWhitelist={['*']}
                allowsInlineMediaPlayback={true}
              />
              <View style={{ position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 }}>
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Edit</Text>
                <Ionicons name="create-outline" size={14} color="#FFF" style={{ marginLeft: 4 }} />
              </View>
            </View>
          </View>

          {/* Game Name */}
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 10 }}>Game Name</Text>
          <View style={{ backgroundColor: '#1E1E1E', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
            <TextInput
              style={{ color: '#FFF', fontSize: 16, fontWeight: '500' }}
              placeholder="Enter your game's name"
              placeholderTextColor="#555"
              value={gameTitle}
              onChangeText={setGameTitle}
              maxLength={60}
            />
          </View>

          {/* Privacy Settings */}
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Privacy Settings</Text>
          <View style={{ backgroundColor: '#1E1E1E', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
            {/* Public games */}
            <Pressable 
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}
              onPress={() => setPrivacySetting('public')}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(52,199,89,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <Ionicons name="people" size={20} color="#34C759" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Public games</Text>
                <Text style={{ color: '#888', fontSize: 13, marginTop: 2 }}>Anyone can play and remix</Text>
              </View>
              <View style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: privacySetting === 'public' ? '#34C759' : '#3A3A3C', justifyContent: 'center', padding: 2 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF', alignSelf: privacySetting === 'public' ? 'flex-end' : 'flex-start' }} />
              </View>
            </Pressable>
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 70 }} />

            {/* Public for play only */}
            <Pressable 
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}
              onPress={() => setPrivacySetting('play_only')}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(168,85,247,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <Ionicons name="eye" size={20} color="#a855f7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Public for play only</Text>
                <Text style={{ color: '#888', fontSize: 13, marginTop: 2 }}>Anyone can play but not remix</Text>
              </View>
              <View style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: privacySetting === 'play_only' ? '#34C759' : '#3A3A3C', justifyContent: 'center', padding: 2 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF', alignSelf: privacySetting === 'play_only' ? 'flex-end' : 'flex-start' }} />
              </View>
            </Pressable>
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 70 }} />

            {/* Only me */}
            <Pressable 
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}
              onPress={() => setPrivacySetting('private')}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <Ionicons name="lock-closed" size={20} color="#888" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Only me</Text>
                <Text style={{ color: '#888', fontSize: 13, marginTop: 2 }}>Only visible to me</Text>
              </View>
              <View style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: privacySetting === 'private' ? '#34C759' : '#3A3A3C', justifyContent: 'center', padding: 2 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF', alignSelf: privacySetting === 'private' ? 'flex-end' : 'flex-start' }} />
              </View>
            </Pressable>
          </View>

          {/* Terms text */}
          <Text style={{ color: '#666', fontSize: 13, textAlign: 'center', marginTop: 30, marginBottom: 16 }}>
            By creating a game, you agree to GameTok's <Text style={{ color: '#a855f7' }}>Terms</Text>.
          </Text>

          {/* Post Game Button */}
          <Pressable 
            style={({ pressed }) => [{ backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 30, alignItems: 'center', shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            onPress={handlePublish}
          >
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>Post Game</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ======================
  // RENDER: EXIT CONFIRMATION MODAL (rendered on top of any phase)
  // ======================
  const exitModal = (
    <Modal visible={!!showExitConfirm} transparent animationType="fade" onRequestClose={() => setShowExitConfirm(null)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 340, backgroundColor: '#2C2C2E', borderRadius: 28, padding: 28, alignItems: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '800', marginBottom: 14, textAlign: 'center' }}>Hold up—heading out?</Text>
          <Text style={{ color: '#AAA', fontSize: 15, textAlign: 'center', marginBottom: 28, lineHeight: 22 }}>
            Leaving now means your game creation gets yeeted. Like... gone. Forever. 😬
          </Text>
          <Pressable 
            style={({ pressed }) => [{ width: '100%', backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 24, alignItems: 'center', marginBottom: 10 }, pressed && { opacity: 0.85 }]}
            onPress={() => setShowExitConfirm(null)}
          >
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Fine, I'll Stay</Text>
          </Pressable>
          <Pressable 
            style={({ pressed }) => [{ width: '100%', backgroundColor: '#3A3A3C', paddingVertical: 16, borderRadius: 24, alignItems: 'center' }, pressed && { opacity: 0.85 }]}
            onPress={handleConfirmExit}
          >
            <Text style={{ color: '#FF453A', fontSize: 16, fontWeight: '700' }}>I'm Out</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  if (phase === 'preview' && activeHtml) {
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={[styles.screen, { paddingTop: insets.top }]}
      >
        {/* === TOP BAR === */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.previewTopBar}>
          <Pressable style={styles.closeBtn} onPress={() => handleIntentClose('discard')}>
            <Ionicons name="close" size={22} color="#FFF" />
          </Pressable>
          <View style={{ flexDirection: 'row', backgroundColor: '#2C2C2E', borderRadius: 20, padding: 3 }}>
            <View style={{ paddingVertical: 6, paddingHorizontal: 16, backgroundColor: '#1C1C1E', borderRadius: 18 }}>
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>Preview</Text>
            </View>
          </View>
          <Pressable 
            style={[styles.previewPublishPill, { backgroundColor: colors.primary }]} 
            onPress={() => setPhase('publish')}
          >
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>Next</Text>
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

        {/* === BOTTOM TOOL STRIP & INPUT === */}
        <Animated.View entering={SlideInDown.duration(500)} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
          {/* Media Toolbar Pill */}
          {!keyboardVisible && (
            <Animated.View 
              entering={FadeInDown.duration(300)} 
              exiting={FadeOutDown.duration(200)}
              style={{ backgroundColor: '#1E1E1E', borderRadius: 40, paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}
            >
              {[
                { icon: 'options', label: 'Modify', action: handleModify },
                { icon: 'color-palette-outline', label: 'Colors', action: () => setShowColorsModal(true) },
                { icon: 'image-outline', label: 'Memes', action: () => setShowPhotosModal(true) },
                { icon: 'film-outline', label: 'Videos', action: () => setShowVideosModal(true) },
                { icon: 'musical-notes-outline', label: 'Sounds', action: () => setShowAudioModal(true) },
              ].map((tool, i) => (
                <Pressable key={i} style={{ alignItems: 'center', gap: 6 }} onPress={tool.action}>
                  <Ionicons name={tool.icon as any} size={22} color="#D2CDC5" />
                  <Text style={{ color: '#888', fontSize: 11, fontWeight: '500' }}>{tool.label}</Text>
                </Pressable>
              ))}
            </Animated.View>
          )}

          {/* Chat Input Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={24} color="#FFF" />
            </Pressable>
            
            <View style={{ flex: 1, backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#333', borderRadius: 24, paddingVertical: 6, paddingLeft: 16, paddingRight: 6, flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={{ flex: 1, color: '#FFF', fontSize: 15, paddingVertical: 6 }}
                placeholder="Add some awesome sauce..."
                placeholderTextColor="#666"
                value={prompt}
                onChangeText={setPrompt}
                onSubmitEditing={() => { if(prompt.trim()) { handleEdit(prompt); setPrompt(''); } }}
                returnKeyType="send"
              />
              <Pressable 
                onPress={() => { if(prompt.trim()) { handleEdit(prompt); setPrompt(''); } }}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="arrow-up" size={18} color={prompt.trim() ? '#FFF' : '#666'} />
              </Pressable>
            </View>
          </View>
        </Animated.View>

                {renderSharedModals()}
        {exitModal}
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
          <Text style={styles.genHeaderTitle}>{labsMode ? '⚗️ Labs Engine' : 'DreamStream'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.generatingContainer}>
          {/* Pulsating energy orb */}
          <Animated.View style={[styles.orbOuter, animatedOrbStyle]}>
            <LinearGradient
              colors={labsMode ? ['#34C759', '#00E5FF', '#4CAF50'] : [colors.primary, '#00E5FF', '#B026FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.orbGradient}
            />
          </Animated.View>

          {/* Ambient glow beneath orb */}
          <View style={[styles.orbGlow, { backgroundColor: labsMode ? '#34C759' : colors.primary }]} />

          <Text style={styles.genTitle}>{labsMode ? 'Gemma 4 is cooking...' : 'Building your universe...'}</Text>
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

        {/* Keep cooking in background */}
        <Pressable
          style={{ position: 'absolute', bottom: Math.max(insets.bottom + 12, 30), left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 }}
          onPress={() => {
            // Don't cancel the backend job — just return user to idle
            // The polling mechanism will still pick up the result later
            setPhase('idle');
          }}
        >
          <Text style={{ fontSize: 20, marginRight: 10 }}>🔥</Text>
          <Text style={{ color: '#000', fontSize: 16, fontWeight: '800', flex: 1 }}>Keep cooking in background</Text>
          <Ionicons name="chevron-down-outline" size={18} color="#666" />
        </Pressable>
      </View>
    );
  }

  // ======================
  // RENDER: IDLE (PROMPT INPUT)
  // ======================
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Full-screen purple-to-blue gradient for all tabs */}
      <LinearGradient
        colors={['rgba(88,28,135,0.4)', 'rgba(30,58,138,0.3)', 'rgba(10,20,50,0.1)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header — changes based on active tab */}
      {studioTab === 'create' ? (
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={() => handleIntentClose('closeApp')}>
            <Ionicons name="close" size={20} color="#E0E0E0" />
          </Pressable>
          <Text style={styles.headerTitle}>Create your game</Text>
          <Pressable 
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: labsMode ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: labsMode ? 'rgba(52,199,89,0.3)' : 'transparent' }}
            onPress={() => setLabsMode(prev => !prev)}
          >
            <Text style={{ fontSize: 14, marginRight: 4 }}>⚗️</Text>
            <Text style={{ color: labsMode ? '#34C759' : '#888', fontSize: 12, fontWeight: '700' }}>{labsMode ? 'Gemma 4' : 'Labs'}</Text>
          </Pressable>
        </View>
      ) : studioTab === 'drafts' ? (
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={() => handleIntentClose('closeApp')}>
            <Ionicons name="close" size={20} color="#E0E0E0" />
          </Pressable>
          <Text style={styles.headerTitle}>Your Draft</Text>
          <Pressable style={{ paddingHorizontal: 4 }}>
            <Text style={{ color: '#FF453A', fontSize: 15, fontWeight: '600' }}>Delete</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={() => handleIntentClose('closeApp')}>
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

              {/* Attached Assets Visual Row */}
              {attachedAssets.length > 0 && (
                <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {attachedAssets.map((asset, i) => (
                      <View key={`attached-${i}`} style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', backgroundColor: '#333' }}>
                        <Image source={{ uri: asset.thumb || asset.thumbnail || asset.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        {asset.type?.includes('audio') || asset.type?.includes('bgm') || asset.type?.includes('sfx') ? (
                          <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="musical-notes" size={18} color="#FFF" />
                          </View>
                        ) : null}
                        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 16, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>{i + 1}</Text>
                        </View>
                        <Pressable 
                          onPress={() => setAttachedAssets(prev => prev.filter((_, idx) => idx !== i))} 
                          style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 12, padding: 2 }}
                        >
                          <Ionicons name="close" size={10} color="#FFF" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

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
                      'A hypnotic infinite 3D runner where you dodge falling emoji meteors in a neon synthwave space tunnel, with EDM flashing lights syncing to the impact',
                      'An addictive tower defense game where you place rapid-fire turrets to stop a horde of evolving zombies from reaching the left side of the screen',
                      'A satisfying physics simulation where you slice watermelons like fruit ninja while avoiding bombs that cause the screen to shake',
                      'A zombie office survival game where you drag and throw staplers and coffee mugs at undead coworkers with ragdoll physics',
                      'An intense top-down twin-stick shooter in a neon nightclub where time only moves when you move, letting you dodge bullets matrix-style',
                      'A funny crazy cat vs laser pointer chase game with ridiculous ragdoll physics and meow sounds when it hits objects',
                    ];
                    setPrompt(surprises[Math.floor(Math.random() * surprises.length)]);
                  }}
                >
                  <Ionicons name="sparkles" size={16} color="#a855f7" style={styles.surpriseEmoji as any} />
                  <Text style={styles.surpriseText}>Surprise me</Text>
                </Pressable>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
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
              <Pressable style={styles.mediaBtn} onPress={() => setShowCommunityImagesModal(true)}>
                <View style={[styles.mediaIcon, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
                  <Ionicons name="images-outline" size={26} color="#a855f7" />
                </View>
                <Text style={styles.mediaLabel}>Images</Text>
              </Pressable>
              
              <Pressable style={styles.mediaBtn} onPress={() => setShowVideosModal(true)}>
                <View style={[styles.mediaIcon, { backgroundColor: 'rgba(255,107,157,0.12)' }]}>
                  <Ionicons name="film-outline" size={26} color="#FF6B9D" />
                </View>
                <Text style={styles.mediaLabel}>Videos</Text>
              </Pressable>

              <Pressable style={styles.mediaBtn} onPress={() => { setAudioTab('sfx'); setShowAudioModal(true); }}>
                <View style={[styles.mediaIcon, { backgroundColor: 'rgba(37,244,238,0.12)' }]}>
                  <Ionicons name="volume-high-outline" size={26} color="#25F4EE" />
                </View>
                <Text style={styles.mediaLabel}>Sounds</Text>
              </Pressable>

              <Pressable style={styles.mediaBtn} onPress={() => { setAudioTab('bgm'); setShowAudioModal(true); }}>
                <View style={[styles.mediaIcon, { backgroundColor: 'rgba(120,40,200,0.12)' }]}>
                  <Ionicons name="musical-notes-outline" size={26} color="#A040FF" />
                </View>
                <Text style={styles.mediaLabel}>BGM</Text>
              </Pressable>

              <Pressable style={styles.mediaBtn} onPress={() => setShowPhotosModal(true)}>
                <View style={[styles.mediaIcon, { backgroundColor: 'rgba(255,60,100,0.12)' }]}>
                  <Ionicons name="happy-outline" size={26} color="#FF456A" />
                </View>
                <Text style={styles.mediaLabel}>Memes</Text>
              </Pressable>

              <Pressable style={styles.mediaBtn} onPress={() => setShowImageModal(true)}>
                <View style={[styles.mediaIcon, { backgroundColor: 'rgba(255,200,50,0.12)' }]}>
                  <Ionicons name="sparkles-outline" size={26} color="#FFC832" />
                </View>
                <Text style={styles.mediaLabel}>Make Image</Text>
              </Pressable>

              <Pressable style={styles.mediaBtn} onPress={() => setShowFeaturesModal(true)}>
                <View style={[styles.mediaIcon, { backgroundColor: 'rgba(255,167,38,0.12)' }]}>
                  <Ionicons name="hardware-chip-outline" size={26} color="#FFA726" />
                </View>
                <Text style={styles.mediaLabel}>Feature</Text>
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
          <Animated.View entering={FadeInUp.duration(400)}>
            <Text style={styles.draftCountLabel}>{drafts.length} drafts</Text>
          </Animated.View>

          {drafts.length === 0 ? (
            <Animated.View entering={FadeInUp.delay(100).duration(400)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Ionicons name="folder-open-outline" size={48} color="#333" />
              <Text style={{ color: '#555', fontSize: 16, fontWeight: '600' }}>No drafts yet</Text>
              <Text style={{ color: '#444', fontSize: 13 }}>Games you generate will appear here</Text>
            </Animated.View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.draftsGrid}
              showsVerticalScrollIndicator={false}
            >
              {drafts.map((draft, index) => (
                <Animated.View key={draft.id} entering={FadeInUp.delay(index * 80).duration(400)}>
                  <Pressable
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
                </Animated.View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* ============================== */}
      {/* TAB: TEMPLATES                 */}
      {/* ============================== */}
      {studioTab === 'templates' && (
        <View style={{ flex: 1 }}>
          <Animated.View entering={FadeInUp.duration(400)}>
            <Text style={styles.draftCountLabel}>{templates.length} templates</Text>
          </Animated.View>

          {templates.length === 0 ? (
            <Animated.View entering={FadeInUp.delay(100).duration(400)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Ionicons name="cube-outline" size={48} color="#333" />
              <Text style={{ color: '#555', fontSize: 16, fontWeight: '600' }}>No templates yet</Text>
              <Text style={{ color: '#444', fontSize: 13 }}>Create a game and mark it as a template</Text>
            </Animated.View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.draftsGrid}
              showsVerticalScrollIndicator={false}
            >
              {templates.map((tpl: any, index: number) => (
                <Animated.View key={tpl.id} entering={FadeInUp.delay(index * 80).duration(400)}>
                  <Pressable
                    style={({ pressed }) => [styles.draftCard, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                    onPress={async () => {
                      try {
                        const res = await ai.getTemplate(tpl.id) as any;
                        if (res?.template?.html_payload) {
                          setActiveHtml(res.template.html_payload);
                          setActiveDraftId(tpl.id);
                          setGameTitle(res.template.title || 'Untitled');
                          setPhase('preview');
                        }
                      } catch (e) {
                        Alert.alert('Error', 'Failed to load template');
                      }
                    }}
                  >
                    <View style={styles.draftThumbnail}>
                      {tpl.thumbnail ? (
                        <Image
                          source={{ uri: tpl.thumbnail }}
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
                      <View style={[styles.draftBadge, { backgroundColor: 'rgba(168,85,247,0.85)' }]}>
                        <Text style={styles.draftBadgeText}>Template</Text>
                      </View>
                    </View>
                    <Text style={styles.draftTitle} numberOfLines={1}>
                      {tpl.title || 'Untitled Game'}
                    </Text>
                    <Text style={styles.draftDate}>{tpl.prompt ? tpl.prompt.substring(0, 40) + '...' : 'Tap to remix'}</Text>
                  </Pressable>
                </Animated.View>
              ))}
            </ScrollView>
          )}
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

            {renderSharedModals()}
      {exitModal}
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
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
    backgroundColor: '#1E1E1F',
    borderRadius: 20,
    marginBottom: 8,
    padding: 6,
  },
  draftThumbnail: {
    width: '100%',
    aspectRatio: 0.75, // Taller image like the screenshot
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  draftBadge: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  draftBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  draftTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  draftDate: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
});
