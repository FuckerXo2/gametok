import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  SlideOutDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ai, API_URL, getToken } from '../services/api';
import { cancelLocalNotification, scheduleCookingNotification, scheduleGameReadyNotification } from '../services/notifications';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ForgeDefenseGame } from '../components/ForgeDefenseGame';
import { Avatar } from '../components/Avatar';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GAMETOK_BG = require('../../assets/gametok_bg.png');

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

const PENDING_CREATE_JOB_KEY = 'createScreenPendingDreamJob';

type StructuredAttachment = {
  type: string;
  role: AttachmentRole;
  url: string;
  thumb?: string;
  thumbnail?: string;
  title?: string;
  label?: string;
  instruction: string;
  duration?: string;
};

type AttachmentRole =
  | 'hero'
  | 'background'
  | 'overlay'
  | 'panel'
  | 'prop'
  | 'bgm'
  | 'sfx'
  | 'reference';

// =============================================
// GENRE CHIP DATA
// =============================================
const GENRE_CHIPS = [
  { 
    icon: 'walk', 
    iconColor: '#a855f7', 
    label: 'Platformer', 
    prompts: [
      'Create an immersive, high-speed 2D cyberpunk platformer where you control a rogue ninja. The player must fluidly double-jump over glowing lava pits, wall-jump between glass skyscrapers, and dash through laser barriers. Include a robust particle system with neon sparks whenever the ninja lands, a scoring multiplier for consecutive jumps, and a dynamic camera that smooth-scrolls based on velocity. The UI should have a sleek, glassmorphic HUD showing health, score, and a combo meter.',
      'Build a brutally challenging precision platformer set in a haunted, pixelated dungeon. The physics must feel tight and responsive like Celeste. The map is filled with crumbling platforms, swinging pendulums, and ghost enemies that chase you if you stay still for too long. Add satisfying screen-shake effects on hard impacts, a timer tracking milliseconds for speedrunners, and hidden collectibles tucked away in secret corners. Use soft, eerie lighting effects around the player.',
      'Design a gravity-flipping puzzle platformer where the player can tap the screen to invert gravity instantly. The levels should consist of mirrored architecture where the ceiling is just as treacherous as the floor, featuring dual threats like spikes on the bottom and acid on top. The game loop must smoothly transition gravity with a 180-degree camera flip, leaving a trail of glowing dust behind the player. Include a chill synthwave background track.'
    ] 
  },
  { 
    icon: 'extension-puzzle', 
    iconColor: '#25F4EE', 
    label: 'Puzzle', 
    prompts: [
      'Program a highly polished, addictive color-matching puzzle game similar to Candy Crush but with a unique twist: the board is a perfect circle and the tiles fall toward the center. When chains of 4 or more are matched, trigger absolute chaos with massive particle explosions, cascading combos, and satisfying "POP" sound effects. Implement a multiplier system that ramps up exponentially, screen-shakes for mega clears, and a sleek modern UI with floating UI text.',
      'Create a complex, physics-based contraption puzzle where the player uses their finger to draw rigid lines, bouncy trampolines, and acceleration ramps. The goal is to safely guide a fragile, rolling glass egg into a woven basket. The egg must shatter realistically if it hits the ground too hard. Include dynamic 2D lighting, a beautifully painted sunset background, and physics materials (friction, restitution) that feel incredibly intuitive to the touch.',
      'Develop a brain-teasing sliding tile puzzle set on a frictionless ice rink. The player controls a small penguin block that slides continuously until it hits a wall or an obstacle. Design intricate mazes with teleporters, breakable ice walls, and buttons that toggle gates on and off. The aesthetics must be a relaxing winter wonderland with falling snowflakes, smooth icy reflections, and soft ambient wind sound effects.'
    ] 
  },
  { 
    icon: 'rocket', 
    iconColor: '#FF6B9D', 
    label: 'Space', 
    prompts: [
      'Develop an intense, retro 80s arcade vertical space shooter with bullet hell mechanics. The player controls a heavily armed starship facing endless, procedurally generated waves of alien fighter swarms. The ship can pick up power-ups perfectly bouncing around the screen to upgrade to spread-shots, homing lasers, and a giant screen-clearing plasma bomb. Add extreme screen-bloom for the lasers, thumping synth music, and giant boss fights at every wave 10.',
      'Create a mesmerizing, high-speed endless runner set entirely within a 3D-styled geometric hyperspace tunnel. The player must rotate 360 degrees around the inner wall of the tunnel to dodge rapidly approaching crimson laser grids and floating asteroids. The speed should progressively increase until it becomes a blur of motion. Integrate a heavy electronic dance music visualizer effect where the colors of the tunnel pulse according to the implicit beat of the music.',
      'Code a highly realistic physics simulation where the player pilots a lunar excursion module. You must manage a limited fuel supply while perfectly balancing left, right, and main thrusters to achieve a soft touchdown on randomized, jagged lunar terrain. Include variable gravity, realistic inertia, completely custom particle physics for the thruster exhaust bouncing off the terrain, and a retro CRT monitor aesthetic for the heads-up display.'
    ] 
  },
  { 
    icon: 'flash', 
    iconColor: '#FFA726', 
    label: 'Battle', 
    prompts: [
      'Build a chaotic, physics-driven auto-battler set on a grand strategy grid. The player drops different units—heavy knights, rapid-fire archers, and area-of-effect wizards—onto the battlefield before pressing "BATTLE". The armies then charge into hundreds of green goblins with hilarious ragdoll physics and huge sweeping attacks. The screen should be filled with floating damage numbers, sword clashes, fireball explosions, and intense screenshake for critical hits.',
      'Create a frantic, fast-paced arena survival game where time only moves when the player moves, similar to SUPERHOT. The player is trapped in a minimalist white void and must dodge incoming slow-motion red bullets while throwing katanas and shooting back at enemies. The entire aesthetic should be extremely stark: brilliant white background, stark black geometry, and vibrant crimson for enemies and their attacks. Include slow-mo sound effects and dramatic camera zooming.',
      'Design a top-down rogue-lite magical combat game. The player is a wizard who can combine elements: drawing a circle casts a protective earth shield, while swiping casts a blazing fire wall. Survive against endless waves of bouncing slime monsters that split into smaller ones when killed. The game needs highly juicy game feel—heavy hit-stop on impacts, massive colorful spells, smooth player dashing, and a combo counter that rewards aggressive playstyles.'
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
  {
    icon: 'car-sport',
    iconColor: '#38BDF8',
    label: 'Racing',
    prompts: [
      'A first-person neon drifting game with sharp turns, boost pads, and reactive city lights.',
      'An arcade street racer where you weave through midnight traffic and chain drift combos for score.',
    ],
  },
  {
    icon: 'musical-notes',
    iconColor: '#F472B6',
    label: 'Rhythm',
    prompts: [
      'A rhythm game where the player taps and swipes to a glitchy hyperpop beat while the stage pulses with light.',
      'A musical reaction game where each lane has a different instrument and perfect timing stacks a combo meter.',
    ],
  },
  {
    icon: 'eye',
    iconColor: '#F87171',
    label: 'Horror',
    prompts: [
      'A psychological horror game where each answer changes the room and the player slowly realizes they are being watched.',
      'A low-light survey game with whispering audio, false exits, and escalating tension after each choice.',
    ],
  },
  {
    icon: 'brush',
    iconColor: '#22D3EE',
    label: 'Creative',
    prompts: [
      'A mesmerizing drawing toy where mirrored strokes bloom into glowing kaleidoscope patterns.',
      'A chill visual sandbox where adding particles changes the music and builds generative art in real time.',
    ],
  },
  {
    icon: 'school',
    iconColor: '#C084FC',
    label: 'Quiz',
    prompts: [
      'A fast-paced trivia game with streak bonuses, dramatic reveals, and playful wrong-answer animations.',
      'A weird internet quiz where the questions get stranger the more correct answers you give.',
    ],
  },
  {
    icon: 'construct',
    iconColor: '#F59E0B',
    label: 'Builder',
    prompts: [
      'A toy builder game where the player snaps ramps, platforms, and launchers together to solve chaos puzzles.',
      'A construction sandbox with physics blocks, moving parts, and a goal object that must reach a target zone.',
    ],
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

const COOKING_STATUS_LINES = [
  'Wizard is scribbling the game rules...',
  'Knight is keeping the forge safe...',
  'Teaching the zombies how to lose...',
  'Sanding the rough edges off the fun...',
];

const chunkIntoRows = <T,>(items: T[], rowCount: number) =>
  Array.from({ length: rowCount }, (_, rowIndex) =>
    items.filter((_, index) => index % rowCount === rowIndex)
  );

const ATTACHMENT_ROLE_OPTIONS: Record<string, Array<{ role: AttachmentRole; label: string }>> = {
  image: [
    { role: 'hero', label: 'Hero' },
    { role: 'background', label: 'Background' },
    { role: 'overlay', label: 'Overlay' },
    { role: 'panel', label: 'Panel' },
    { role: 'prop', label: 'Prop' },
    { role: 'reference', label: 'Reference' },
  ],
  video: [
    { role: 'background', label: 'Background' },
    { role: 'panel', label: 'Panel' },
    { role: 'overlay', label: 'Overlay' },
    { role: 'reference', label: 'Reference' },
  ],
  bgm: [
    { role: 'bgm', label: 'BGM' },
    { role: 'reference', label: 'Reference' },
  ],
  sfx: [
    { role: 'sfx', label: 'SFX' },
    { role: 'reference', label: 'Reference' },
  ],
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
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const detachPendingDreamRef = useRef(false);
  const resumingPendingJobRef = useRef<string | null>(null);
  const cookingNotificationRef = useRef<string | null>(null);
  const webviewRef = useRef<WebView>(null);
  const enemyIdRef = useRef(0);
  const ideasScrollRefs = useRef<Array<ScrollView | null>>([]);
  const ideasOffsetRefs = useRef([0, 0, 0]);
  const ideasContentWidthRefs = useRef([0, 0, 0]);
  const ideasPauseUntilRef = useRef(0);

  // Game Config Bridge State (Rezona-style)
  const [gameConfig, setGameConfig] = useState<Record<string, { type: string; label: string; value: number; min: number; max: number }>>({}); 
  const [editableSlots, setEditableSlots] = useState<{ id: string; type: string; label: string; src: string }[]>([]);
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // Core state
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<DreamPhase>('idle');
  const [activeHtml, setActiveHtml] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [gameTitle, setGameTitle] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [knightLane, setKnightLane] = useState(1);
  const [sceneEnemies, setSceneEnemies] = useState<Array<{ id: number; lane: number; depth: number; kind: 'zombie' | 'ghoul' }>>([]);
  const [defeatedEnemies, setDefeatedEnemies] = useState(0);
  const [wizardHeat, setWizardHeat] = useState(24);
  const [swingTick, setSwingTick] = useState(0);
  
  const [showEditor, setShowEditor] = useState(true);
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
  const [attachedAssets, setAttachedAssets] = useState<StructuredAttachment[]>([]);
  const [showAssetIntentModal, setShowAssetIntentModal] = useState(false);
  const [pendingAssetIntent, setPendingAssetIntent] = useState<StructuredAttachment | null>(null);
  const [assetIntentRole, setAssetIntentRole] = useState<AttachmentRole>('hero');
  const [assetIntentText, setAssetIntentText] = useState('');
  const [editingAttachedAssetIndex, setEditingAttachedAssetIndex] = useState<number | null>(null);
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
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [studioBuildTick, setStudioBuildTick] = useState(0);


  // === WEBVIEW BRIDGE (Rezona Architecture) ===
  // This JavaScript is injected into the WebView after the game HTML loads.
  // It reads the <script id="game-config"> block and all data-editable tags,
  // then sends them back to React Native via window.ReactNativeWebView.postMessage.
  const BRIDGE_INJECT_JS = `
    (function() {
      try {
        // 1. Parse game-config block
        var configEl = document.getElementById('game-config');
        var config = {};
        if (configEl) {
          try { config = JSON.parse(configEl.textContent); } catch(e) {}
          // Populate window.gameConfig for the game to read
          window.gameConfig = {};
          for (var k in config) { window.gameConfig[k] = config[k].value; }
        }

        // 2. Find all data-editable asset slots
        var editables = document.querySelectorAll('[data-editable]');
        var slots = [];
        editables.forEach(function(el) {
          slots.push({
            id: el.id,
            type: el.getAttribute('data-editable'),
            label: el.getAttribute('data-label') || el.id,
            src: el.src || ''
          });
        });

        // 3. Send back to React Native
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'GAME_BRIDGE_INIT',
          config: config,
          slots: slots
        }));

        // 4. Listen for asset swap commands from React Native
        window.addEventListener('message', function(event) {
          try {
            var msg = JSON.parse(event.data);
            if (msg.type === 'SWAP_ASSET') {
              var target = document.getElementById(msg.slotId);
              if (target) { target.src = msg.newSrc; }
            } else if (msg.type === 'UPDATE_CONFIG') {
              if (window.gameConfig) {
                window.gameConfig[msg.key] = msg.value;
              }
            }
          } catch(e) {}
        });
      } catch(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'BRIDGE_ERROR', error: e.message }));
      }
    })();
    true;
  `;

  const MUTE_WEBVIEW_JS = useMemo(() => `
    (function() {
      window._gametokActive = false;
      window._gametokMuted = true;
      document.querySelectorAll('audio, video').forEach(function(el) {
        try {
          el.muted = true;
          el.volume = 0;
          el.pause();
        } catch(e) {}
      });
      if (window._audioContexts) {
        window._audioContexts.forEach(function(ctx) {
          try { ctx.suspend(); } catch(e) {}
        });
      }
    })();
    true;
  `, []);

  // Handle messages from the WebView game
  const showPreviewError = useCallback((message: string) => {
    if (!message) return;
    setErrorMsg(message.length > 180 ? message.slice(0, 177) + '...' : message);
  }, []);

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'GAME_BRIDGE_INIT') {
        if (data.config && Object.keys(data.config).length > 0) {
          setGameConfig(data.config);
          console.log('Bridge: Game config received with', Object.keys(data.config).length, 'params');
        }
        if (data.slots && data.slots.length > 0) {
          setEditableSlots(data.slots);
          console.log('Bridge: Found', data.slots.length, 'editable asset slots');
        }
        setErrorMsg(null);
      } else if (data.type === 'BRIDGE_ERROR') {
        showPreviewError(`Preview bridge error: ${data.error || 'Bridge initialization failed.'}`);
      } else if (data.type === 'RUNTIME_ERROR') {
        const label = data.kind || 'Preview runtime error';
        const detail = data.detail || 'The generated game failed while running.';
        showPreviewError(`${label}: ${detail}`);
      }
    } catch (e) {
      // Silently ignore non-JSON messages
    }
  }, [showPreviewError]);

  // Send a config update to the running game
  const updateGameConfig = useCallback((key: string, value: number) => {
    setGameConfig(prev => ({
      ...prev,
      [key]: { ...prev[key], value }
    }));
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'UPDATE_CONFIG',
      key,
      value
    }));
  }, []);

  // Swap an editable asset in the running game
  const swapGameAsset = useCallback((slotId: string, newSrc: string) => {
    setEditableSlots(prev => prev.map(s => s.id === slotId ? { ...s, src: newSrc } : s));
    webviewRef.current?.postMessage(JSON.stringify({
      type: 'SWAP_ASSET',
      slotId,
      newSrc
    }));
  }, []);

  // Animations
  const orbPulse = useSharedValue(1);
  const orbRotation = useSharedValue(0);
  const studioChipData = GENRE_CHIPS;
  const studioChipRows = chunkIntoRows(studioChipData, 3).map((row) => [...row, ...row]);
  const activeStudioStepIndex = pendingJobId ? (phase === 'generating' ? activeStep : studioBuildTick % GENERATION_STEPS.length) : 0;
  const activeStudioStep = GENERATION_STEPS[activeStudioStepIndex];
  const activeStudioStatusLine = COOKING_STATUS_LINES[studioBuildTick % COOKING_STATUS_LINES.length];

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
    } else {
      webviewRef.current?.injectJavaScript(MUTE_WEBVIEW_JS);
    }
  }, [isActive, fetchDrafts, MUTE_WEBVIEW_JS]);

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

  const clearPendingDreamJob = useCallback(async () => {
    setPendingJobId(null);
    await cancelLocalNotification(cookingNotificationRef.current);
    cookingNotificationRef.current = null;
    try {
      await AsyncStorage.removeItem(PENDING_CREATE_JOB_KEY);
    } catch (e) {
      console.warn('Failed to clear pending dream job:', e);
    }
  }, []);

  const armCookingNotification = useCallback(async (jobId?: string | null, jobPrompt?: string) => {
    if (!jobId) return;
    await cancelLocalNotification(cookingNotificationRef.current);
    cookingNotificationRef.current = await scheduleCookingNotification(jobId, jobPrompt);
  }, []);

  const persistPendingDreamJob = useCallback(async (payload: { jobId: string; prompt: string; labsMode: boolean }) => {
    setPendingJobId(payload.jobId);
    await armCookingNotification(payload.jobId, payload.prompt);
    try {
      await AsyncStorage.setItem(
        PENDING_CREATE_JOB_KEY,
        JSON.stringify({
          ...payload,
          savedAt: new Date().toISOString(),
        }),
      );
    } catch (e) {
      console.warn('Failed to persist pending dream job:', e);
    }
  }, [armCookingNotification]);

  const completePendingDreamJob = useCallback(async (title?: string, draftId?: string | null) => {
    const hadCookingStatus = Boolean(cookingNotificationRef.current);
    await clearPendingDreamJob();
    if (hadCookingStatus && draftId) {
      await scheduleGameReadyNotification(draftId, title);
    }
  }, [clearPendingDreamJob]);

  const stopLocalDreamPolling = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    resumingPendingJobRef.current = null;
  }, []);

  const formatDreamError = useCallback((error: any, mode: 'generate' | 'edit' = 'generate') => {
    const fallback = mode === 'edit'
      ? 'Could not update the game right now. Please try again.'
      : 'Could not generate the game right now. Please try again.';

    if (!error) return fallback;

    const message = String(error.message || error);
    if (error.name === 'AbortError' || message.includes('aborted')) {
      return null;
    }

    if (error.code === 'REQUEST_TIMEOUT' || /timed out/i.test(message)) {
      return mode === 'edit'
        ? 'The update request took too long to start. Railway may be cold or the AI backend is overloaded. Try again in a moment.'
        : 'The generation request took too long to start. Railway may be cold or the AI backend is overloaded. Try again in a moment.';
    }

    if (/network request failed/i.test(message)) {
      return 'Could not reach the AI backend. Check your connection and try again.';
    }

    return message || fallback;
  }, []);

  useEffect(() => {
    if (!isActive) return;
    if (phase === 'preview') return;
    if (cancelRef.current) return;
    if (resumingPendingJobRef.current) return;

    let cancelled = false;
    let resumeCancel: (() => void) | null = null;

    const resumePendingDream = async () => {
      try {
        const rawPending = await AsyncStorage.getItem(PENDING_CREATE_JOB_KEY);
        if (!rawPending || cancelled) return;

        const pending = JSON.parse(rawPending);
        if (!pending?.jobId) return;
        if (resumingPendingJobRef.current === pending.jobId) return;

        resumingPendingJobRef.current = pending.jobId;
        setPendingJobId(pending.jobId);
        if (pending.prompt && !prompt.trim()) {
          setPrompt(pending.prompt);
        }
        setPhase('generating');
        setErrorMsg(null);

        const { promise, cancel } = ai.resumeDreamJob(pending.jobId);
        resumeCancel = cancel;
        cancelRef.current = cancel;
        const res = await promise as any;
        if (cancelled) return;
        cancelRef.current = null;
        resumingPendingJobRef.current = null;

        if (res.success && res.htmlPreview) {
          await completePendingDreamJob(res.title || 'Untitled Dream', res.draftId);
          setGameConfig({});
          setEditableSlots([]);
          setActiveHtml(res.htmlPreview);
          setActiveDraftId(res.draftId);
          setGameTitle(res.title || 'Untitled Dream');
          setPhase('preview');
          await fetchDrafts();
        }
      } catch (error: any) {
        if (cancelled) return;
        cancelRef.current = null;
        resumingPendingJobRef.current = null;
        const friendlyMessage = formatDreamError(error, 'generate');
        if (!friendlyMessage) {
          return;
        }
        setErrorMsg(friendlyMessage);
        setPhase('idle');
        await clearPendingDreamJob();
      }
    };

    resumePendingDream();

    return () => {
      cancelled = true;
      if (resumeCancel) {
        resumingPendingJobRef.current = null;
        cancelRef.current = null;
        resumeCancel();
      }
    };
  }, [isActive, phase, prompt, clearPendingDreamJob, completePendingDreamJob, fetchDrafts, formatDreamError]);

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

  useEffect(() => {
    if (!pendingJobId || phase === 'generating') return;
    const interval = setInterval(() => {
      setStudioBuildTick((prev) => prev + 1);
    }, 2600);
    return () => clearInterval(interval);
  }, [pendingJobId, phase]);

  useEffect(() => {
    ideasOffsetRefs.current = [0, 0, 0];
    ideasContentWidthRefs.current = [0, 0, 0];
    ideasScrollRefs.current.forEach((ref) => ref?.scrollTo({ x: 0, animated: false }));
  }, []);

  useEffect(() => {
    if (studioTab !== 'create' || phase !== 'idle') return;
    const interval = setInterval(() => {
      if (Date.now() < ideasPauseUntilRef.current) return;
      ideasScrollRefs.current.forEach((ref, rowIndex) => {
        const loopWidth = ideasContentWidthRefs.current[rowIndex] / 2;
        if (!loopWidth || !ref) return;
        const direction = rowIndex % 2 === 0 ? 1 : -1;
        const speed = rowIndex === 1 ? 0.5 : 0.75;
        let nextOffset = ideasOffsetRefs.current[rowIndex] + direction * speed;

        if (direction === 1 && nextOffset >= loopWidth) {
          nextOffset = 0;
          ref.scrollTo({ x: 0, animated: false });
        } else if (direction === -1 && nextOffset <= 0) {
          nextOffset = loopWidth;
          ref.scrollTo({ x: loopWidth, animated: false });
        } else {
          ref.scrollTo({ x: nextOffset, animated: false });
        }

        ideasOffsetRefs.current[rowIndex] = nextOffset;
      });
    }, 24);
    return () => clearInterval(interval);
  }, [studioTab, phase]);

  useEffect(() => {
    if (phase !== 'generating') return;

    enemyIdRef.current = 0;
    setKnightLane(1);
    setSceneEnemies([]);
    setDefeatedEnemies(0);
    setWizardHeat(24);
    setSwingTick(0);

    const interval = setInterval(() => {
      setSwingTick((prev) => prev + 1);
      setWizardHeat((prev) => Math.max(16, prev - 1));
      setSceneEnemies((prev) => {
        let defeated = 0;
        let slipped = 0;

        let next = prev
          .map((enemy) => ({ ...enemy, depth: enemy.depth + 1 }))
          .filter((enemy) => {
            const inStrikeZone = enemy.depth >= 4 && enemy.depth <= 5 && enemy.lane === knightLane;
            if (inStrikeZone) {
              defeated += 1;
              return false;
            }
            if (enemy.depth > 6) {
              slipped += 1;
              return false;
            }
            return true;
          });

        if (defeated > 0) {
          setDefeatedEnemies((prevDefeated) => prevDefeated + defeated);
          setWizardHeat((prevHeat) => Math.min(100, prevHeat + defeated * 5));
        }

        if (slipped > 0) {
          setWizardHeat((prevHeat) => Math.max(8, prevHeat - slipped * 8));
        }

        if (next.length < 7 && Math.random() < 0.8) {
          next = [
            ...next,
            {
              id: enemyIdRef.current++,
              lane: Math.floor(Math.random() * 3),
              depth: 0,
              kind: Math.random() > 0.72 ? 'ghoul' : 'zombie',
            },
          ];
        }

        return next;
      });
    }, 520);

    return () => clearInterval(interval);
  }, [phase, knightLane]);

  const animatedOrbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbPulse.value }, { rotate: `${orbRotation.value}deg` } as any],
  }));

  // ======================
  // HANDLERS
  // ======================
  const handleGenreSelect = (genrePrompts: string[]) => {
    const randomPrompt = genrePrompts[Math.floor(Math.random() * genrePrompts.length)];
    setPrompt(randomPrompt);
    setErrorMsg(null);
    ideasPauseUntilRef.current = Date.now() + 1200;
    requestAnimationFrame(() => inputRef.current?.focus());
  };


  const handleReturnToForge = useCallback(() => {
    if (!pendingJobId) return;
    setErrorMsg(null);
    setPhase('generating');
  }, [pendingJobId]);

  const handleDream = async (promptOverride?: string) => {
    const finalPrompt = (promptOverride ?? prompt).trim();
    if (phase === 'generating') return;
    if (!finalPrompt) {
      setErrorMsg('Write a quick brief first, or tap Surprise me.');
      inputRef.current?.focus();
      return;
    }

    setPhase('generating');
    setErrorMsg(null);

    try {
      const attachments = attachedAssets.map(({ type, role, url, thumb, thumbnail, title, label, instruction, duration }) => ({
        type,
        role,
        url,
        thumb,
        thumbnail,
        title,
        label,
        instruction,
        duration,
      }));
      const onJobStarted = (jobId: string) => {
        persistPendingDreamJob({ jobId, prompt: finalPrompt, labsMode });
      };
      const { promise, cancel } = labsMode
        ? ai.dreamLabs(finalPrompt, attachments, { onJobStarted })
        : ai.dream(finalPrompt, attachments, { onJobStarted });
      cancelRef.current = cancel;
      const res = await promise as any;
      cancelRef.current = null;
      detachPendingDreamRef.current = false;
      if (res.success && res.htmlPreview) {
        await completePendingDreamJob(res.title || 'Untitled Dream', res.draftId);
        setGameConfig({});
        setEditableSlots([]);
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
      const friendlyMessage = formatDreamError(error, 'generate');
      if (!friendlyMessage) {
        if (detachPendingDreamRef.current) {
          detachPendingDreamRef.current = false;
          setPhase('idle');
          return;
        }
        await clearPendingDreamJob();
        return;
      }
      detachPendingDreamRef.current = false;
      console.warn('AI Generation Warning:', error?.message || error);
      await clearPendingDreamJob();
      setErrorMsg(friendlyMessage);
      setPhase('idle');
    }
  };

  const handleDreamComposerPress = () => {
    const finalPrompt = prompt.trim();
    if (!finalPrompt) {
      setErrorMsg('Write a quick brief first, or tap Surprise me.');
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setErrorMsg(null);
    Keyboard.dismiss();
    requestAnimationFrame(() => handleDream(finalPrompt));
  };

  const handleDeleteDraft = (draftId: string, title?: string) => {
    Alert.alert(
      'Delete draft?',
      `Remove ${title || 'this draft'} from your drafts? This can’t be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ai.deleteDraft(draftId);
              setDrafts(prev => prev.filter(d => d.id !== draftId));
              if (activeDraftId === draftId) {
                handleRegenerate();
              }
            } catch (e) {
              console.error('Failed to delete draft:', e);
              Alert.alert('Couldn’t delete draft', 'Please try again.');
            }
          },
        },
      ]
    );
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
      if (!response.ok) {
        throw new Error(`Giphy API error: ${response.status}`);
      }
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
      console.warn('Error fetching Giphy:', error);
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
      if (!response.ok) {
        throw new Error(`Freesound API error: ${response.status}`);
      }
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
      console.warn('Error fetching Freesound:', error);
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
    } catch (e: any) {
      console.log(e?.message || e);
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

  const handleCancel = async () => {
    detachPendingDreamRef.current = false;
    const jobIdToCancel = pendingJobId;
    stopLocalDreamPolling();
    if (jobIdToCancel) {
      try {
        await ai.cancelDreamJob(jobIdToCancel);
      } catch (error: any) {
        console.warn('[DreamStream] Backend cancel failed:', error?.message || error);
      }
    }
    await clearPendingDreamJob();
    setPhase('idle');
  };

  const normalizeAttachmentType = (type: string | undefined) => {
    const normalized = String(type || '').trim().toLowerCase();
    switch (normalized) {
      case 'photo':
      case 'gif':
      case 'sticker':
        return 'image';
      case 'music':
        return 'bgm';
      case 'audio':
        return 'sfx';
      default:
        return normalized || 'image';
    }
  };

  const inferAttachmentRole = (type: string): AttachmentRole => {
    switch (normalizeAttachmentType(type)) {
      case 'video':
        return 'background';
      case 'bgm':
        return 'bgm';
      case 'sfx':
        return 'sfx';
      default:
        return 'hero';
    }
  };

  const getRoleOptionsForType = (type: string) => {
    return ATTACHMENT_ROLE_OPTIONS[normalizeAttachmentType(type)] || ATTACHMENT_ROLE_OPTIONS.image;
  };

  const buildAssetInstruction = (attachment: StructuredAttachment, role: AttachmentRole, note: string) => {
    const url = attachment.url;
    const title = attachment.title || attachment.label || 'selected asset';
    const trimmedNote = note.trim();

    const roleInstruction = (() => {
      switch (role) {
        case 'hero':
          return `Use this ${attachment.type} as the main hero object or focal visual in the experience: ${url}`;
        case 'background':
          return `Use this ${attachment.type} as the main background or atmospheric scene layer: ${url}`;
        case 'overlay':
          return `Use this ${attachment.type} as an overlay, meme, sticker, decal, or reaction layer: ${url}`;
        case 'panel':
          return `Use this ${attachment.type} inside a framed panel, screen, card, or in-world display: ${url}`;
        case 'prop':
          return `Use this ${attachment.type} as a prop, collectible, ingredient, tool, or object the player interacts with: ${url}`;
        case 'bgm':
          return `Use this audio as the main looping background music: ${url}`;
        case 'sfx':
          return `Use this audio as a triggered sound effect or moment cue: ${url}`;
        case 'reference':
        default:
          return `Use this ${attachment.type} as a style or content reference when building the experience: ${url}`;
      }
    })();

    return trimmedNote
      ? `${roleInstruction}. User note for "${title}": ${trimmedNote}`
      : roleInstruction;
  };

  const toStructuredAttachment = (item: any, fallbackInstruction: string): StructuredAttachment => ({
    type: normalizeAttachmentType(item?.type),
    role: inferAttachmentRole(item?.type),
    url: String(item?.url || '').trim(),
    thumb: item?.thumb || item?.thumbnail || item?.url,
    thumbnail: item?.thumbnail || item?.thumb || item?.url,
    title: item?.title || item?.label || '',
    label: item?.label || item?.title || '',
    instruction: String(item?.instruction || fallbackInstruction || '').trim(),
    duration: item?.duration || '',
  });

  const openAssetIntentModal = (attachment: StructuredAttachment, index: number | null = null) => {
    const defaultRole = attachment.role || inferAttachmentRole(attachment.type);
    setPendingAssetIntent({ ...attachment, role: defaultRole });
    setAssetIntentRole(defaultRole);
    setAssetIntentText('');
    setEditingAttachedAssetIndex(index);
    setShowAssetIntentModal(true);
  };

  const handleAssetSelect = (item: any, fallbackInstruction: string) => {
    const attachment = toStructuredAttachment(item, fallbackInstruction);
    if (!attachment.url) return;
    openAssetIntentModal(attachment, null);
  };

  const handleConfirmAssetIntent = () => {
    if (!pendingAssetIntent?.url) return;

    const finalizedAttachment: StructuredAttachment = {
      ...pendingAssetIntent,
      role: assetIntentRole,
      instruction: buildAssetInstruction(pendingAssetIntent, assetIntentRole, assetIntentText),
    };

    if (editingAttachedAssetIndex !== null) {
      setAttachedAssets(prev => prev.map((asset, index) => (
        index === editingAttachedAssetIndex ? finalizedAttachment : asset
      )));
    } else if (!activeDraftId) {
      setAttachedAssets(prev => {
        const existingIndex = prev.findIndex(asset => asset.url === finalizedAttachment.url);
        if (existingIndex >= 0) {
          return prev.map((asset, index) => (index === existingIndex ? finalizedAttachment : asset));
        }
        return [...prev, finalizedAttachment];
      });
    } else {
      handleEdit(finalizedAttachment.instruction, undefined, [finalizedAttachment]);
    }

    setShowAssetIntentModal(false);
    setPendingAssetIntent(null);
    setAssetIntentText('');
    setEditingAttachedAssetIndex(null);
  };

  const handleEdit = async (
    instructionsText: string,
    newAsset?: { key: string; base64: string },
    attachments: StructuredAttachment[] = []
  ) => {
    const instructions = instructionsText.trim();
    if (!instructions) return;

    if (!activeDraftId) {
      if (attachments.length > 0) {
        setAttachedAssets(prev => {
          const existingUrls = new Set(prev.map(asset => asset.url));
          const unique = attachments.filter(asset => asset.url && !existingUrls.has(asset.url));
          return unique.length > 0 ? [...prev, ...unique] : prev;
        });
      }
      setPrompt(prev => prev + (prev ? '\n' : '') + `[Edit Requested: ${instructions}]`);
      return;
    }

    setPhase('generating');
    setErrorMsg(null);

    try {
      const { promise, cancel } = ai.edit(activeDraftId, instructions, newAsset, attachments);
      cancelRef.current = cancel;
      const res = await promise as any;
      cancelRef.current = null;
      if (res.success && res.htmlPreview) {
        setActiveHtml(res.htmlPreview);
        // CRITICAL: Update the active draft to the NEW version so subsequent edits chain correctly
        if (res.draftId) {
          setActiveDraftId(res.draftId);
        }
        setPhase('preview');
      } else {
        throw new Error(res.error || 'Failed to modify game.');
      }
    } catch (err: any) {
      const friendlyMessage = formatDreamError(err, 'edit');
      if (friendlyMessage) {
        setErrorMsg(friendlyMessage);
        setPhase('preview'); // Stay on preview instead of going to idle — the original game is still playable
      }
    }
  };

  const handleRegenerate = async () => {
    detachPendingDreamRef.current = false;
    stopLocalDreamPolling();
    await clearPendingDreamJob();
    setActiveHtml(null);
    setActiveDraftId(null);
    setGameTitle('');
    setGameConfig({});
    setEditableSlots([]);
    setErrorMsg(null);
    setPhase('idle');
  };

  const handleIntentClose = (actionType: 'discard' | 'closeApp' = 'closeApp') => {
    if (phase === 'generating') {
      detachPendingDreamRef.current = true;
      stopLocalDreamPolling();
      // Drop local polling but keep the backend job alive and resumable.
      if (actionType === 'closeApp') onClose();
      else setPhase('idle');
      return;
    }

    if (pendingJobId) {
      if (actionType === 'closeApp') onClose();
      else setPhase('idle');
      return;
    }
    
    // Only confirm when leaving a live preview / test surface.
    if (phase === 'preview' && (activeDraftId || activeHtml)) {
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

  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    if (!activeDraftId) {
      Alert.alert('Error', 'No draft to publish. Please create a game first.');
      return;
    }
    if (!gameTitle.trim()) {
      Alert.alert('Missing Name', 'Please give your game a name before posting.');
      return;
    }
    setIsPublishing(true);
    try {
      // Send HTML if we have it (needed for templates that don't exist in ai_games table yet)
      const res = await ai.publish(activeDraftId, gameTitle.trim(), privacySetting, activeHtml || undefined);
      if (res.success) {
        console.log('✅ LIVE! Game pushed to Feed:', res.gameId);
        Alert.alert('🎉 Game Posted!', 'Your game is now live on GameTOK!', [
          { text: 'Let\'s Go', onPress: () => { handleRegenerate(); onClose(); } }
        ]);
      } else {
        Alert.alert('Publish Failed', res.error || 'Something went wrong. Please try again.');
      }
    } catch (e: any) {
      console.error('Publish error:', e?.message || e);
      Alert.alert('Publish Failed', e?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsPublishing(false);
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
      <Modal visible={showAssetIntentModal} transparent animationType="fade" onRequestClose={() => { setShowAssetIntentModal(false); setPendingAssetIntent(null); setEditingAttachedAssetIndex(null); }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => { setShowAssetIntentModal(false); setPendingAssetIntent(null); setEditingAttachedAssetIndex(null); }}>
          <Animated.View entering={FadeInUp.duration(220)} style={{ width: '100%', maxWidth: 380, backgroundColor: '#141416', borderRadius: 28, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} onStartShouldSetResponder={() => true}>
            <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
              What should this asset do?
            </Text>
            {pendingAssetIntent && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 16, overflow: 'hidden', backgroundColor: '#222' }}>
                    {pendingAssetIntent.type === 'bgm' || pendingAssetIntent.type === 'sfx' ? (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="musical-notes" size={26} color="#FFF" />
                      </View>
                    ) : (
                      <Image source={{ uri: pendingAssetIntent.thumb || pendingAssetIntent.thumbnail || pendingAssetIntent.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                      {pendingAssetIntent.title || pendingAssetIntent.label || 'Selected asset'}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4, textTransform: 'capitalize' }}>
                      {pendingAssetIntent.type}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700', marginTop: 20, marginBottom: 10 }}>
                  Asset role
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {getRoleOptionsForType(pendingAssetIntent.type).map((option) => {
                    const active = assetIntentRole === option.role;
                    return (
                      <Pressable
                        key={option.role}
                        onPress={() => setAssetIntentRole(option.role)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 999,
                          backgroundColor: active ? '#a855f7' : 'rgba(255,255,255,0.06)',
                          borderWidth: 1,
                          borderColor: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700', marginTop: 20, marginBottom: 10 }}>
                  Tell the AI what to do with it
                </Text>
                <TextInput
                  value={assetIntentText}
                  onChangeText={setAssetIntentText}
                  placeholder="Example: make this the face on the main character, use this as the room background, use this as a meme popup..."
                  placeholderTextColor="rgba(255,255,255,0.28)"
                  multiline
                  style={{
                    minHeight: 110,
                    borderRadius: 18,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    color: '#FFF',
                    textAlignVertical: 'top',
                    fontSize: 14,
                    lineHeight: 20,
                  }}
                />

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                  <Pressable
                    style={{ flex: 1, paddingVertical: 15, borderRadius: 18, backgroundColor: '#555', alignItems: 'center' }}
                    onPress={() => { setShowAssetIntentModal(false); setPendingAssetIntent(null); setEditingAttachedAssetIndex(null); }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={{ flex: 1, paddingVertical: 15, borderRadius: 18, backgroundColor: '#a855f7', alignItems: 'center' }}
                    onPress={handleConfirmAssetIntent}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>
                      {activeDraftId && editingAttachedAssetIndex === null ? 'Apply' : 'Attach'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Animated.View>
        </Pressable>
      </Modal>

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
                mediaPlaybackRequiresUserAction={true}
                injectedJavaScript={MUTE_WEBVIEW_JS}
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
            style={({ pressed }) => [{ backgroundColor: isPublishing ? '#666' : colors.primary, paddingVertical: 18, borderRadius: 30, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }, pressed && !isPublishing && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            onPress={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing && <ActivityIndicator size="small" color="#FFF" />}
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>{isPublishing ? 'Posting...' : 'Post Game'}</Text>
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
          <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '800', marginBottom: 14, textAlign: 'center' }}>Leave Dream Forge?</Text>
          <Text style={{ color: '#AAA', fontSize: 15, textAlign: 'center', marginBottom: 28, lineHeight: 22 }}>
            You have an unfinished draft on this screen. If you leave now, the unsent brief and local edits will be discarded.
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable 
              onPress={() => setShowEditor(!showEditor)} 
              style={{ marginRight: 16, backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 20 }}
            >
              <Ionicons name={showEditor ? "eye-outline" : "eye-off-outline"} size={20} color="#FFF" />
            </Pressable>
            <Pressable 
              style={[styles.previewPublishPill, { backgroundColor: colors.primary }]} 
              onPress={() => setPhase('publish')}
            >
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>Next</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* === GAME WEBVIEW === */}
        <View style={styles.webviewContainer}>
          <WebView
            ref={webviewRef}
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
            injectedJavaScript={BRIDGE_INJECT_JS}
            onLoadStart={() => setErrorMsg(null)}
            onMessage={handleWebViewMessage}
            onError={(e) => {
              console.log('WebView Error: code', e.nativeEvent.code);
              showPreviewError(`Preview WebView failed to load (code ${e.nativeEvent.code}).`);
            }}
            onHttpError={(e) => {
              console.log('WebView HTTP Error: code', e.nativeEvent.statusCode);
              showPreviewError(`Preview HTTP error ${e.nativeEvent.statusCode}.`);
            }}
          />
          {keyboardVisible && (
            <Pressable style={[StyleSheet.absoluteFill, { zIndex: 999 }]} onPress={() => Keyboard.dismiss()} />
          )}
        </View>

        {/* === BOTTOM TOOL STRIP & INPUT === */}
        {showEditor && (
          <Animated.View entering={SlideInDown.duration(500)} exiting={SlideOutDown.duration(300)} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
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
        )}

        {/* === EDIT ERROR TOAST (visible in preview) === */}
        {errorMsg && (
          <Animated.View 
            entering={FadeInDown.duration(300)}
            style={{ position: 'absolute', top: insets.top + 60, left: 16, right: 16, zIndex: 20, backgroundColor: 'rgba(255,59,48,0.95)', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Ionicons name="warning" size={18} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={2}>{errorMsg}</Text>
            <Pressable onPress={() => setErrorMsg(null)}>
              <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </Animated.View>
        )}

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
      <ForgeDefenseGame
        prompt={prompt}
        activeStep={activeStep}
        labsMode={labsMode}
        onCancel={handleCancel}
        onMinimize={() => setPhase('idle')}
        generationSteps={GENERATION_STEPS}
        cookingStatusLines={COOKING_STATUS_LINES}
      />
    );
  }

  // ======================
  // RENDER: IDLE (PROMPT INPUT)
  // ======================
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Full-screen background (Removed to ensure perfect black) */}

      {/* V2 Header (mockup): avatar | centered gametok | menu */}
      {studioTab === 'create' ? (
        <View style={styles.headerV2}>
          <View style={styles.headerV2Side}>
            <Pressable style={[styles.headerAvatarWrap, { width: 52, height: 52, borderRadius: 26 }]} onPress={() => handleIntentClose('closeApp')}>
              <Avatar uri={user?.avatar} userId={user?.id} size={52} />
            </Pressable>
          </View>
          <View style={styles.headerV2Center} pointerEvents="none">
            <Text style={[styles.headerLogo, styles.headerLogoGametok]}>gametok</Text>
          </View>
          <View style={[styles.headerV2Side, styles.headerV2SideRight]}>
            <View style={{ width: 36, height: 36 }} />
          </View>
        </View>
      ) : studioTab === 'drafts' ? (
        <View style={styles.headerV2}>
          <View style={styles.headerV2Side}>
            <Pressable style={styles.headerMenuBtn} onPress={() => setStudioTab('create')}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.headerV2Center} pointerEvents="none">
            <Text style={styles.headerLogo}>Your Drafts</Text>
          </View>
          <View style={[styles.headerV2Side, styles.headerV2SideRight]}>
            <View style={{ width: 36, height: 36 }} />
          </View>
        </View>
      ) : (
        <View style={styles.headerV2}>
          <View style={styles.headerV2Side}>
            <Pressable style={styles.headerMenuBtn} onPress={() => setStudioTab('create')}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.headerV2Center} pointerEvents="none">
            <Text style={styles.headerLogo}>Templates</Text>
          </View>
          <View style={[styles.headerV2Side, styles.headerV2SideRight]}>
            <View style={{ width: 36, height: 36 }} />
          </View>
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
          keyboardShouldPersistTaps="always"
        >
          {/* Top hero — matches promo screenshot: sparkle + gradient-style title + subtitle + segmented modes */}
          <Animated.View entering={FadeInUp.duration(360)}>
            <View style={styles.heroV2Wrap}>
              <View style={[styles.heroV2TitleRow, { position: 'relative', width: 260, height: 44, alignSelf: 'center' }]}>
                {/* Subtle glow effect behind */}
                <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', position: 'absolute' }}>
                  <Text style={[styles.heroV2TitleDream, { color: 'transparent', fontSize: 28, textShadowColor: 'rgba(168,85,247,0.6)', textShadowRadius: 14 }]}>✨ Dream Forge</Text>
                </View>

                {/* Gradient text using SVG to avoid native crash from MaskedView */}
                <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                  <Ionicons name="sparkles" size={24} color="#d946ef" style={{ marginRight: 8 }} />
                  <Svg height="40" width="180">
                    <Defs>
                      <SvgLinearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor="#d946ef" stopOpacity="1" />
                        <Stop offset="0.45" stopColor="#8b5cf6" stopOpacity="1" />
                        <Stop offset="1" stopColor="#3b82f6" stopOpacity="1" />
                      </SvgLinearGradient>
                    </Defs>
                    <SvgText
                      fill="url(#grad)"
                      fontSize="28"
                      fontWeight="800"
                      x="0"
                      y="30"
                      letterSpacing="-0.4"
                    >
                      Dream Forge
                    </SvgText>
                  </Svg>
                </View>
              </View>
              <Text style={styles.heroV2Subtitle}>Your imagination. Unlocked.</Text>
            </View>
          </Animated.View>

          {/* ========== GAME MODE (ONLY MODE NOW) ========== */}
          {/* === MAIN INPUT CARD === */}
          <Animated.View entering={FadeInUp.delay(80).duration(400)}>
            <View style={styles.inputCard}>
              <LinearGradient
                colors={['rgba(124,58,237,0.55)', 'rgba(168,85,247,0.55)', 'rgba(192,132,252,0.4)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.inputGlowBorder}
              />

              <View style={styles.inputCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="hardware-chip" size={12} color="#C084FC" style={{ marginRight: 6 }} />
                  <Text style={[styles.inputCardEyebrow, { marginBottom: 0 }]}>GAME BRIEF</Text>
                </View>
              </View>

              {/* Attached Assets Visual Row */}
              {attachedAssets.length > 0 && (
                <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {attachedAssets.map((asset, i) => (
                      <Pressable key={`attached-${i}`} onPress={() => openAssetIntentModal(asset, i)} style={{ width: 56 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', backgroundColor: '#333' }}>
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
                      <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '700', marginTop: 4, textTransform: 'capitalize' }}>
                        {asset.role}
                      </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.inputCardBody}>
                {/* Text input area */}
                <TextInput
                  ref={inputRef}
                  style={styles.mainInput}
                  placeholder="Make a first person drifting game with night neon roads..."
                  placeholderTextColor="rgba(255,255,255,0.14)"
                  multiline
                  maxLength={500}
                  value={prompt}
                  onChangeText={setPrompt}
                  textAlignVertical="top"
                  inputAccessoryViewID="gametok-done"
                />

                {!prompt.trim() && (
                  <Text style={styles.inputHint}>
                    Write a brief or tap `Surprise me` to seed one.
                  </Text>
                )}

                {/* Bottom row inside input — surprise me + send */}
                <View style={[styles.inputBottomRow, { zIndex: 99 }]}>
                  <Pressable
                    style={styles.surpriseBtn}
                    onPressIn={() => {
                      const surprises = [
                        'A massive, completely unhinged physics simulation where you control a magnetic wrecking ball. You must swing through fully destructible voxel skyscrapers, causing absolute chaos and frame-dropping levels of particle explosions. The ground should shatter realistically, and the UI should keep a running tally of millions of dollars in property damage with a satisfying slot-machine counter animation.',
                        'An intensely addictive tower defense hybrid set in a microscopic cell. You are defending the nucleus from evolving viruses. Place white blood cell turrets that automatically lock on to enemies. Crucially, the viruses mutate every wave, becoming immune to certain projectile colors, forcing the player to constantly upgrade and swap turret types. Include an incredible liquid-like UI with soft blobs and organic sounds.',
                        'A deeply satisfying game focused purely on game feel and cutting things. Fruits and objects fly across the screen, and the player swipes their finger to slice them accurately in half like Fruit Ninja. However, implement extremely detailed hit-stop, heavy screen shake on critical hits, and physics where the two halves of the object actually fly apart based precisely on the angle of the swipe vector. Add combo tracking and announcer voice text.',
                        'A hyper-stylized neon rhythm game where the map generates purely based on the beat. The player controls a glowing cube racing down an infinite track. Bass hits spawn massive obstacles you have to jump over, while synth notes create speed pads. The camera must pulse and FOV warp aggressively to the beat to make the player feel the music. Keep the neon colors vibrant against an absolute pitch-black background.',
                      ];
                      setPrompt(surprises[Math.floor(Math.random() * surprises.length)]);
                      setErrorMsg(null);
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                  >
                    <Ionicons name="sparkles" size={16} color="#C084FC" style={styles.surpriseEmoji as any} />
                    <Text style={styles.surpriseText}>Surprise me</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.sendBtn, !prompt.trim() && styles.sendBtnIdle]}
                    onPressIn={handleDreamComposerPress}
                    hitSlop={14}
                  >
                    <Text style={styles.sendBtnText}>Forge It</Text>
                    <Ionicons name="chevron-forward" size={18} color="#FFF" />
                  </Pressable>
                </View>
              </View>
            </View>
          </Animated.View>

          {pendingJobId && (
            <Animated.View entering={FadeInUp.delay(110).duration(360)}>
              <Pressable style={styles.activeBuildCard} onPressIn={handleReturnToForge}>
                <View style={styles.activeBuildStrip}>
                  <View style={styles.activeBuildStatusDot} />
                  <Text style={styles.activeBuildStatusText}>Forging in background · {activeStudioStep.text}</Text>
                  <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.48)" />
                </View>
              </Pressable>
            </Animated.View>
          )}

          {activeHtml && (
            <Animated.View entering={FadeInUp.delay(150).duration(400)}>
              <Pressable style={styles.generatedPreviewCard} onPress={() => setPhase('preview')}>
                <Image source={GAMETOK_BG} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                <LinearGradient
                  colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.24)', 'rgba(0,0,0,0.82)']}
                  locations={[0, 0.45, 1]}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.generatedBadge}>
                  <Ionicons name="sparkles" size={12} color="#25F4EE" />
                  <Text style={styles.generatedBadgeText}>Generated</Text>
                </View>
                <View style={styles.generatedPlayBtn}>
                  <Ionicons name="play" size={20} color="#FFF" />
                </View>
                <View style={styles.generatedMetaRow}>
                  <View style={styles.generatedMetaPill}>
                    <Ionicons name="game-controller" size={13} color="#a855f7" />
                    <Text style={styles.generatedMetaText}>Racing</Text>
                  </View>
                  <View style={styles.generatedMetaPill}>
                    <Ionicons name="people" size={13} color="#FFF" />
                    <Text style={styles.generatedMetaText}>1-8 Players</Text>
                  </View>
                  <View style={styles.generatedMetaPill}>
                    <Ionicons name="time-outline" size={13} color="#FFF" />
                    <Text style={styles.generatedMetaText}>2-5 min</Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          )}

          {/* === MEDIA TOOLBAR === */}
          <Animated.View entering={FadeInUp.delay(210).duration(400)}>
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
          <Animated.View entering={FadeInUp.delay(270).duration(400)}>
            <View style={styles.starterRailHeader}>
              <Text style={styles.starterRailSubtitle}>
                Fast templates for mechanics-heavy prompts.
              </Text>
            </View>
            <View style={styles.ideasLaneStack}>
              {studioChipRows.map((row, rowIndex) => (
                <ScrollView
                  key={`ideas-row-${rowIndex}`}
                  ref={(ref) => { ideasScrollRefs.current[rowIndex] = ref; }}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  scrollEnabled={false}
                  contentContainerStyle={styles.ideasLane}
                  onTouchStart={() => {
                    ideasPauseUntilRef.current = Date.now() + 1200;
                  }}
                  onContentSizeChange={(width) => {
                    ideasContentWidthRefs.current[rowIndex] = width;
                    if (rowIndex % 2 === 1) {
                      const startX = width / 2;
                      ideasOffsetRefs.current[rowIndex] = startX;
                      ideasScrollRefs.current[rowIndex]?.scrollTo({ x: startX, animated: false });
                    }
                  }}
                >
                  {row.map((chip, chipIndex) => (
                    <Pressable
                      key={`${chip.label}-${rowIndex}-${chipIndex}`}
                      style={({ pressed }) => [styles.ideaPill, pressed && { transform: [{ scale: 0.96 }] }]}
                      onPressIn={() => {
                        ideasPauseUntilRef.current = Date.now() + 1200;
                      }}
                      onPress={() => handleGenreSelect(chip.prompts)}
                    >
                      <Ionicons name={chip.icon as any} size={15} color={chip.iconColor} />
                      <Text style={styles.ideaLabel}>{chip.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
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
                    <Pressable
                      style={styles.draftDeleteBtn}
                      hitSlop={10}
                      onPress={(event) => {
                        event.stopPropagation();
                        handleDeleteDraft(draft.id, draft.title);
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FFF" />
                    </Pressable>

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
                          // Generate a new UUID for the template since sekai_ IDs aren't valid UUIDs
                          const newDraftId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                            const r = Math.random() * 16 | 0;
                            const v = c === 'x' ? r : (r & 0x3 | 0x8);
                            return v.toString(16);
                          });
                          
                          setActiveHtml(res.template.html_payload);
                          setActiveDraftId(newDraftId);
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
  // ── V2 mockup styles ───────────────────────────────────────────────────
  headerV2: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
  },
  headerV2Side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerV2SideRight: {
    justifyContent: 'flex-end',
  },
  headerV2Center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerLogoGametok: {
    textTransform: 'lowercase',
  },
  headerMenuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroV2Wrap: {
    paddingTop: 4,
    paddingBottom: 14,
    width: '100%',
    alignItems: 'center',
  },
  heroV2TitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroV2SparkleIcon: {
    marginRight: 8,
    marginTop: 3,
  },
  heroV2TitleTextWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 1,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  heroV2TitleDream: {
    color: '#a855f7',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroV2TitleForge: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroV2Subtitle: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
  modeSwitchV2: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: 12,
    padding: 4,
    borderRadius: 999,
    backgroundColor: '#120b1f',
    borderWidth: 0,
    zIndex: 999,
  },
  modeSwitchV2Tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.001)',
  },
  modeSwitchV2TabActive: {
    backgroundColor: '#4c1d95',
  },
  modeSwitchV2Text: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  modeSwitchV2TextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  // ── Existing styles ─────────────────────────────────────────────────────
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#08080C',
    zIndex: 99999,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 180,
    flexGrow: 1,
    gap: 12,
  },

  studioHeroCard: {
    minHeight: 146,
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0E1018',
  },
  studioHeroBg: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
    opacity: 0.38,
  },
  studioHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  studioBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(13,12,24,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  studioBadgeText: {
    color: '#FFD89B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  studioLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(20,20,24,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.18)',
  },
  studioLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34C759',
  },
  studioLiveText: {
    color: '#D7FFE3',
    fontSize: 11,
    fontWeight: '700',
  },
  studioHeroCopyRow: {
    gap: 4,
  },
  studioHeroTitle: {
    color: '#FFF',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
    maxWidth: '100%',
  },
  studioHeroSubtitle: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    lineHeight: 17,
    maxWidth: '100%',
  },
  modeSwitchShell: {
    marginTop: 12,
    padding: 4,
    borderRadius: 18,
    backgroundColor: 'rgba(13,12,24,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
  },
  modeSwitchTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 9,
  },
  modeSwitchTabActive: {
    backgroundColor: 'rgba(168,85,247,0.22)',
  },
  modeSwitchText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '700',
  },
  modeSwitchTextActive: {
    color: '#FFF',
  },
  studioUtilityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  yourGamesCard: {
    flex: 1,
    minHeight: 86,
    borderRadius: 24,
    backgroundColor: 'rgba(18,18,24,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  utilityLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  utilityLabel: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  utilityValue: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  utilityMiniCard: {
    width: 84,
    minHeight: 86,
    borderRadius: 24,
    backgroundColor: 'rgba(18,18,24,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  utilityMiniNumber: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
  },
  utilityMiniLabel: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  activeBuildCard: {
    borderRadius: 999,
    backgroundColor: 'rgba(16,16,24,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.16)',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  activeBuildStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activeBuildHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  activeBuildEyebrow: {
    color: '#FFBA69',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  activeBuildTitle: {
    color: '#FFF',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    maxWidth: 240,
  },
  activeBuildStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(87,22,130,0.32)',
  },
  activeBuildStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34C759',
  },
  activeBuildStatusText: {
    color: '#F8E8FF',
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  activeBuildBody: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  activeBuildTimelineRow: {
    marginTop: 14,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeBuildTimelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(168,85,247,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBuildTimelineLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  activeBuildTimelineSubtext: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  activeBuildActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  activeBuildActionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#A855F7',
    paddingHorizontal: 16,
    paddingVertical: 13,
    flex: 1,
  },
  activeBuildActionPrimaryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  activeBuildActionGhost: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  activeBuildActionGhostText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  recentBuildsHeader: {
    marginTop: 2,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  recentBuildsTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
  },
  recentBuildsSubtitle: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 13,
    marginTop: 4,
  },
  recentBuildsLink: {
    color: '#C084FC',
    fontSize: 13,
    fontWeight: '700',
  },
  recentBuildsRow: {
    gap: 12,
    paddingRight: 8,
  },
  recentBuildCard: {
    width: 132,
  },
  recentBuildThumb: {
    height: 158,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#15151B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'space-between',
  },
  recentBuildOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,12,0.16)',
  },
  recentBuildBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(8,8,12,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  recentBuildBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  recentBuildName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  starterRailHeader: {
    marginTop: 2,
    marginBottom: 10,
  },
  starterRailTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
  },
  starterRailSubtitle: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },

  // === HEADER ===
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
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

  // === MAIN INPUT CARD ===
  inputCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#6d28d9',
    backgroundColor: '#0a0514',
  },
  narrativeChatSurface: {
    borderRadius: 22,
    backgroundColor: '#050209',
    borderColor: 'rgba(168,85,247,0.34)',
  },
  inputCardHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  narrativeHeaderStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(168,85,247,0.12)',
  },
  narrativeHeaderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#A855F7',
  },
  narrativeHeaderStatusText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '800',
  },
  inputCardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  inputCardEyebrow: {
    color: '#C084FC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputCardTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    maxWidth: 240,
  },
  inputCardMetaPill: {
    minWidth: 58,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  inputCardMetaValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  inputCardMetaLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 1,
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
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 23,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  inputHint: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.28)',
    fontSize: 13,
    lineHeight: 18,
  },
  narrativeBriefPanel: {
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: 'rgba(168,85,247,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.2)',
  },
  narrativeSessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  narrativeAgentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    shadowColor: '#a855f7',
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  narrativeAgentName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  narrativeAgentSub: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 2,
  },
  narrativeBriefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  narrativeBriefIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.28)',
  },
  narrativeBriefTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  narrativeBriefCount: {
    color: '#C084FC',
    fontSize: 12,
    fontWeight: '900',
  },
  narrativeBriefText: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  narrativeChatBox: {
    justifyContent: 'flex-start',
    gap: 10,
    paddingTop: 4,
    paddingBottom: 6,
    marginBottom: 2,
  },
  narrativeBubble: {
    maxWidth: '88%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  narrativeBubbleAi: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderTopLeftRadius: 8,
  },
  narrativeBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(124,58,237,0.72)',
    borderTopRightRadius: 8,
  },
  narrativeAiDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    marginTop: 1,
  },
  narrativeBubbleText: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  narrativeComposer: {
    minHeight: 58,
    borderRadius: 22,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  narrativeInput: {
    flex: 1,
    maxHeight: 110,
    color: '#FFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    paddingVertical: 6,
  },
  narrativeSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a855f7',
  },
  narrativeSendBtnIdle: {
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  narrativeActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  narrativeForgeHint: {
    flex: 1,
    color: 'rgba(255,255,255,0.46)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  narrativeReferenceDock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    paddingBottom: 2,
  },
  narrativeReferenceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  narrativeReferenceText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '800',
  },
  narrativeAttachedRow: {
    gap: 8,
    paddingTop: 10,
  },
  narrativeAttachedChip: {
    maxWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 6,
    paddingRight: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  narrativeAttachedThumb: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#21162d',
  },
  narrativeAttachedText: {
    maxWidth: 72,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  inputBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 0,
  },
  surpriseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
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
    minWidth: 110,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#7c3aed',
    shadowColor: '#7c3aed',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  sendBtnIdle: {
    backgroundColor: 'rgba(168,85,247,0.32)',
  },
  sendBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },

  mediaRow: {
    gap: 12,
    paddingBottom: 14,
    paddingRight: 20,
  },
  generatedPreviewCard: {
    height: 218,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#101018',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
    marginBottom: 4,
  },
  generatedBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(37,244,238,0.28)',
  },
  generatedBadgeText: {
    color: '#25F4EE',
    fontSize: 11,
    fontWeight: '800',
  },
  generatedPlayBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.46)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generatedMetaRow: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    gap: 8,
  },
  generatedMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  generatedMetaText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
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
  ideasLaneStack: {
    gap: 10,
    marginBottom: 20,
  },
  ideasLane: {
    gap: 12,
    paddingRight: 20,
  },
  ideaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
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
  forgeBackdropGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255,140,65,0.14)',
    top: SCREEN_HEIGHT * 0.08,
    alignSelf: 'center',
  },
  forgeHeaderChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  forgeHeaderChipText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  generatingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 8,
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
    fontSize: 30,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'center',
  },
  genSubtitle: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: '90%',
  },
  promptSnippetCard: {
    width: '100%',
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  promptSnippetLabel: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  promptSnippetText: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  forgeSceneCard: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.38,
    marginTop: 18,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#20130f',
    justifyContent: 'flex-end',
    paddingBottom: 22,
  },
  forgeSkyRunes: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    opacity: 0.35,
  },
  forgeRune: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 18,
    fontWeight: '800',
  },
  forgeLanes: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: '16%',
    paddingVertical: '12%',
  },
  forgeLaneLine: {
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
  },
  wizardAura: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    bottom: 34,
    alignSelf: 'center',
  },
  wizardStation: {
    position: 'absolute',
    bottom: 26,
    alignSelf: 'center',
    alignItems: 'center',
  },
  wizardEmoji: {
    fontSize: 34,
    marginBottom: 2,
  },
  cauldron: {
    width: 88,
    height: 40,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  cauldronGlow: {
    position: 'absolute',
    width: 66,
    height: 18,
    borderRadius: 12,
    backgroundColor: '#FFB860',
    top: 0,
  },
  cauldronPot: {
    width: 74,
    height: 24,
    borderRadius: 14,
    backgroundColor: '#1D2530',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  enemyDot: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(9,18,7,0.28)',
  },
  enemyFace: {
    color: '#173113',
    fontSize: 11,
    fontWeight: '900',
  },
  knightBody: {
    position: 'absolute',
    bottom: '24%',
    marginLeft: -22,
    width: 44,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knightHelmet: {
    width: 28,
    height: 30,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#94A3B8',
  },
  knightSword: {
    position: 'absolute',
    width: 36,
    height: 6,
    borderRadius: 4,
    backgroundColor: '#FDE68A',
    top: 22,
  },
  knightSwordLeft: {
    transform: [{ rotate: '-32deg' }, { translateX: -18 }],
  },
  knightSwordRight: {
    transform: [{ rotate: '28deg' }, { translateX: 18 }],
  },
  knightShield: {
    position: 'absolute',
    bottom: -2,
    fontSize: 18,
  },
  forgeHud: {
    position: 'absolute',
    top: 16,
    right: 16,
    gap: 10,
  },
  forgeStatPill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(12,12,18,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  forgeStatLabel: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  forgeStatValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  laneControlRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  laneControlBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  laneControlBtnActive: {
    backgroundColor: 'rgba(255,173,92,0.2)',
    borderColor: 'rgba(255,200,120,0.45)',
  },
  laneControlText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  laneControlTextActive: {
    color: '#FFF4D4',
  },
  stepsContainer: {
    marginTop: 16,
    width: '100%',
    gap: 16,
  },
  statusCard: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statusEyebrow: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  statusHeadline: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  statusMeta: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
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
    marginTop: 24,
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
  draftDeleteBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
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
