import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { ai, API_URL, getToken } from "../services/api";
import { WishStudioScreen } from "./WishStudioScreen";
import {
  cancelLocalNotification,
  scheduleCookingNotification,
  scheduleGameReadyNotification,
} from "../services/notifications";
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useAuthScreen } from "../../App";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Audio, ResizeMode, Video } from "expo-av";
import { VideoThumb } from "../components/VideoThumb";
import {
  palette as pal,
  spacing as sp,
  radii as rad,
  type as typo,
} from "../theme/tokens";
import { ForgeDefenseGame } from "../components/ForgeDefenseGame";
import { Avatar } from "../components/Avatar";
import {
  ORIENTATION_OPTIONS,
  normalizeOrientation,
  DEFAULT_ORIENTATION,
  type Orientation,
} from "../constants/orientation";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PREVIEW_BASE_URL = "https://games.gametok.co";
const GAMETOK_BG = require("../../assets/gametok_bg.png");

// =============================================
// TYPES
// =============================================
// No "preview" phase: the finished game lives in the Wish studio's Preview tab,
// never in a second editor of its own. Publish is an overlay, not a phase.
type DreamPhase = "idle" | "refining" | "generating";
type StudioTab = "create" | "drafts";

interface DraftItem {
  id: string;
  title: string;
  prompt: string;
  thumbnail?: string;
  /** Snake-case straight off the ai_games row — /ai/drafts returns raw rows. */
  orientation?: string | null;
  created_at: string;
}

interface GameSpec {
  title: string;
  description: string;
  features: string[];
}

const DRAFT_GRADIENTS: [string, string][] = [
  ["#FF6B35", "#F7931E"],
  ["#8B5CF6", "#6D28D9"],
  ["#06B6D4", "#0891B2"],
  ["#EC4899", "#DB2777"],
  ["#10B981", "#059669"],
  ["#F59E0B", "#D97706"],
];

const DRAFT_ICONS: any[] = [
  "game-controller",
  "rocket",
  "flash",
  "planet",
  "diamond",
  "cube",
];

const getTimeAgo = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `Created ${diffMins}m ago`;
  if (diffHours < 24) return `Created ${diffHours}h ago`;
  if (diffDays === 1) return "Created 1 day ago";
  return `Created ${diffDays} days ago`;
};

const getDraftThumbnail = (draft?: { thumbnail?: string | null } | null) => {
  const thumbnail = draft?.thumbnail?.trim();
  return thumbnail ? thumbnail : null;
};

const toTitleCase = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((word) =>
      word ? `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}` : "",
    )
    .join(" ");

const getEditRefinementTitle = (instructions: string) => {
  const cleaned = instructions
    .replace(/^(please\s+)?(can you\s+)?(could you\s+)?/i, "")
    .replace(/^(make|add|include|put|bring|restore)\s+/i, "")
    .replace(/\b(back|again)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const titleBase = cleaned || instructions.trim() || "Update";
  return toTitleCase(
    titleBase.length > 34 ? `${titleBase.slice(0, 31).trim()}...` : titleBase,
  );
};

const needsEditClarification = (instructions: string) =>
  /\bbackground\b/i.test(instructions) &&
  !/\b(neon|city|space|forest|sky|night|day|dark|light|image|photo|video|animated|pixel|cartoon|gradient|room|street|ocean|desert)\b/i.test(
    instructions,
  );

const buildEditRefinementSpec = (instructions: string): GameSpec => ({
  title: getEditRefinementTitle(instructions),
  description: instructions,
  features: [
    "Keep the current game and controls intact.",
    "Apply this change cleanly without changing the core loop.",
    "Make the update feel intentional on mobile.",
  ],
});

const buildFallbackEditIntent = (instructions: string): EditIntent => ({
  summary: getEditRefinementTitle(instructions),
  finalInstruction: instructions,
  needsClarification: needsEditClarification(instructions),
  question: needsEditClarification(instructions)
    ? "What kind of background should I add?"
    : null,
  suggestions: needsEditClarification(instructions)
    ? EDIT_BACKGROUND_CHOICES.map((choice) => choice.label)
    : [],
  confidence: needsEditClarification(instructions) ? "medium" : "high",
});

const EDIT_BACKGROUND_CHOICES = [
  {
    label: "Original",
    value:
      "Use the original background style if recoverable; otherwise recreate a matching background that feels like it was always there.",
  },
  {
    label: "Neon",
    value: "Use a vivid neon background with strong contrast and mobile-friendly readability.",
  },
  {
    label: "Space",
    value: "Use a space background with depth, stars, and subtle motion.",
  },
  {
    label: "City",
    value: "Use a city background that matches the current game mood.",
  },
  {
    label: "Surprise me",
    value: "Choose the best background direction for the current game and make it feel intentional.",
  },
];

interface CreateScreenProps {
  isActive: boolean;
  onClose: () => void;
  openDraftId?: string | null;
  onDraftOpened?: () => void;
}

const PENDING_CREATE_JOB_KEY = "createScreenPendingDreamJob";
const PENDING_CREATE_JOB_MAX_AGE_MS = 6 * 60 * 60 * 1000;

type PendingDreamJobStatus =
  | "idle"
  | "queued"
  | "running"
  | "failed"
  | "canceled";

type PendingDreamJob = {
  jobId: string;
  prompt: string;
  labsMode: boolean;
  /** Carried so a resumed or retried job rebuilds in the shape the creator chose. */
  orientation: Orientation;
  savedAt: string;
  status: PendingDreamJobStatus;
  progress: number | null;
  phase: string | null;
  statusMessage: string | null;
  error?: string | null;
};

type PendingEditRequest = {
  draftId: string;
  instructions: string;
  newAsset?: { key: string; base64: string };
  attachments: StructuredAttachment[];
};

type EditIntent = {
  summary: string;
  finalInstruction: string;
  needsClarification: boolean;
  question?: string | null;
  suggestions: string[];
  confidence?: "high" | "medium" | "low";
};

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
  | "hero"
  | "background"
  | "overlay"
  | "panel"
  | "prop"
  | "bgm"
  | "sfx"
  | "reference";

const isMissingLocalFileDreamError = (message: string) =>
  /could not read the local image|no such file or directory|os error 2/i.test(
    message,
  );

const normalizePendingDreamStatus = (status?: string): PendingDreamJobStatus => {
  if (status === "failed" || status === "error") return "failed";
  if (status === "canceled") return "canceled";
  if (status === "queued") return "queued";
  if (status === "idle" || status === "complete") return "idle";
  return "running";
};

const makePendingDreamJob = (payload: {
  jobId: string;
  prompt?: string;
  labsMode?: boolean;
  orientation?: Orientation;
  savedAt?: string;
  status?: string;
  progress?: number | null;
  phase?: string | null;
  statusMessage?: string | null;
  error?: string | null;
}): PendingDreamJob => ({
  jobId: payload.jobId,
  prompt: payload.prompt || "",
  labsMode: Boolean(payload.labsMode),
  orientation: normalizeOrientation(payload.orientation),
  savedAt: payload.savedAt || new Date().toISOString(),
  status: normalizePendingDreamStatus(payload.status || "queued"),
  progress:
    typeof payload.progress === "number"
      ? Math.max(0, Math.min(100, payload.progress))
      : null,
  phase: payload.phase || null,
  statusMessage: payload.statusMessage || null,
  error: payload.error || null,
});

const parsePendingDreamJobs = (rawPending: string | null): PendingDreamJob[] => {
  if (!rawPending) return [];
  try {
    const parsed = JSON.parse(rawPending);
    const rawJobs = Array.isArray(parsed) ? parsed : parsed?.jobs || [parsed];
    return rawJobs
      .filter((job: any) => job?.jobId)
      .map((job: any) => makePendingDreamJob(job))
      .filter((job: PendingDreamJob) => {
        const savedAtTime = new Date(job.savedAt).getTime();
        return (
          savedAtTime &&
          !Number.isNaN(savedAtTime) &&
          Date.now() - savedAtTime <= PENDING_CREATE_JOB_MAX_AGE_MS
        );
      });
  } catch {
    return [];
  }
};

// =============================================
// GENRE CHIP DATA
// =============================================
const GENRE_CHIPS = [
  {
    icon: "walk",
    iconColor: "#a855f7",
    label: "Platformer",
    prompts: [
      "Create an immersive, high-speed 2D cyberpunk platformer where you control a rogue ninja. The player must fluidly double-jump over glowing lava pits, wall-jump between glass skyscrapers, and dash through laser barriers. Include a robust particle system with neon sparks whenever the ninja lands, a scoring multiplier for consecutive jumps, and a dynamic camera that smooth-scrolls based on velocity. The UI should have a sleek, glassmorphic HUD showing health, score, and a combo meter.",
      "Build a brutally challenging 2D precision platformer set in a haunted, pixelated dungeon. The physics must feel tight and responsive like Celeste. The map is filled with crumbling platforms, swinging pendulums, and ghost enemies that chase you if you stay still for too long. Add satisfying screen-shake effects on hard impacts, a timer tracking milliseconds for speedrunners, and hidden collectibles tucked away in secret corners. Use soft, eerie lighting effects around the player.",
      "Design a 3D gravity-flipping platformer where the player can tap the screen to invert gravity instantly. The levels should consist of mirrored architecture where the ceiling is just as treacherous as the floor, featuring dual threats like spikes on the bottom and acid on top. The game loop must smoothly transition gravity with a 180-degree camera flip, leaving a trail of glowing dust behind the player. Include a chill synthwave background track.",
    ],
  },
  {
    icon: "extension-puzzle",
    iconColor: "#25F4EE",
    label: "Puzzle",
    prompts: [
      'Program a highly polished, addictive 2D color-matching puzzle game similar to Candy Crush but with a unique twist: the board is a perfect circle and the tiles fall toward the center. When chains of 4 or more are matched, trigger absolute chaos with massive particle explosions, cascading combos, and satisfying "POP" sound effects. Implement a multiplier system that ramps up exponentially, screen-shakes for mega clears, and a sleek modern UI with floating UI text.',
      "Create a complex, 2D physics-based contraption puzzle where the player uses their finger to draw rigid lines, bouncy trampolines, and acceleration ramps. The goal is to safely guide a fragile, rolling glass egg into a woven basket. The egg must shatter realistically if it hits the ground too hard. Include dynamic 2D lighting, a beautifully painted sunset background, and physics materials (friction, restitution) that feel incredibly intuitive to the touch.",
      "Develop a brain-teasing 3D sliding-block puzzle set on a frictionless ice rink. The player controls a small penguin block that slides continuously until it hits a wall or an obstacle. Design intricate mazes with teleporters, breakable ice walls, and buttons that toggle gates on and off. The aesthetics must be a relaxing winter wonderland with falling snowflakes, smooth icy reflections, and soft ambient wind sound effects.",
    ],
  },
  {
    icon: "rocket",
    iconColor: "#FF6B9D",
    label: "Space",
    prompts: [
      "Develop an intense, retro 80s arcade 2D vertical space shooter with bullet hell mechanics. The player controls a heavily armed starship facing endless, procedurally generated waves of alien fighter swarms. The ship can pick up power-ups perfectly bouncing around the screen to upgrade to spread-shots, homing lasers, and a giant screen-clearing plasma bomb. Add extreme screen-bloom for the lasers, thumping synth music, and giant boss fights at every wave 10.",
      "Create a mesmerizing, high-speed endless runner set entirely within a fully 3D geometric hyperspace tunnel. The player must rotate 360 degrees around the inner wall of the tunnel to dodge rapidly approaching crimson laser grids and floating asteroids. The speed should progressively increase until it becomes a blur of motion. Integrate a heavy electronic dance music visualizer effect where the colors of the tunnel pulse according to the implicit beat of the music.",
      "Code a highly realistic 3D physics simulation where the player pilots a lunar excursion module. You must manage a limited fuel supply while perfectly balancing left, right, and main thrusters to achieve a soft touchdown on randomized, jagged lunar terrain. Include variable gravity, realistic inertia, completely custom particle physics for the thruster exhaust bouncing off the terrain, and a retro CRT monitor aesthetic for the heads-up display.",
    ],
  },
  {
    icon: "flash",
    iconColor: "#FFA726",
    label: "Battle",
    prompts: [
      'Build a chaotic, physics-driven 3D auto-battler set on a grand strategy grid. The player drops different units—heavy knights, rapid-fire archers, and area-of-effect wizards—onto the battlefield before pressing "BATTLE". The armies then charge into hundreds of green goblins with hilarious ragdoll physics and huge sweeping attacks. The screen should be filled with floating damage numbers, sword clashes, fireball explosions, and intense screenshake for critical hits.',
      "Create a frantic, fast-paced 3D arena survival game where time only moves when the player moves, similar to SUPERHOT. The player is trapped in a minimalist white void and must dodge incoming slow-motion red bullets while throwing katanas and shooting back at enemies. The entire aesthetic should be extremely stark: brilliant white background, stark black geometry, and vibrant crimson for enemies and their attacks. Include slow-mo sound effects and dramatic camera zooming.",
      "Design a 2D top-down rogue-lite magical combat game. The player is a wizard who can combine elements: drawing a circle casts a protective earth shield, while swiping casts a blazing fire wall. Survive against endless waves of bouncing slime monsters that split into smaller ones when killed. The game needs highly juicy game feel—heavy hit-stop on impacts, massive colorful spells, smooth player dashing, and a combo counter that rewards aggressive playstyles.",
    ],
  },
  {
    icon: "flame",
    iconColor: "#EF4444",
    label: "Action",
    prompts: [
      "Build a fast, stylish 3D third-person character-action brawler where the player dashes, dodges, and chains melee combos into air-launcher juggles against relentless waves of robotic enemies. Nail the game feel with responsive hit-stop on every strike, screen-shake on heavy hits, slow-mo finishers, and glowing slash trails carving through the air. Add a rising style meter that ranks combos from D to S, chunky impact sound design, particle sparks on every clash, and a dramatic camera that snaps in for the final blow.",
      "Create a punchy 2D side-scrolling run-and-gun where the player sprints, slides, and dual-wields guns through a crumbling neon industrial base swarming with enemies. Bullets fly in every direction, explosions rip through the screen, and precise dashes dodge incoming fire in a blaze of muzzle flashes and shell casings. Pile on heavy screenshake, chunky pixel-art explosions, a combo multiplier for kill streaks without taking damage, a driving rock soundtrack, and a boss at the end of each stretch that fills half the screen.",
      "Design a frantic 3D top-down twin-stick shooter where the player strafes and blasts through neon arenas overrun by glowing enemy swarms. One stick moves, the other aims, as the player unleashes spread shots, rockets, and a screen-clearing overdrive that detonates everything. Amp the spectacle with bloom-soaked lasers, satisfying enemy pop-and-shatter effects, floating combo numbers, thumping electronic beats, and escalating waves that flood the arena until the screen is pure chaos.",
    ],
  },
  {
    icon: "compass",
    iconColor: "#22D3EE",
    label: "Adventure",
    prompts: [
      "Build a charming 3D exploration adventure set in a vibrant low-poly world where the player roams open meadows, climbs ruins, and solves environmental puzzles to collect scattered relics. Reward curiosity with hidden paths, gentle platforming, and glowing collectibles that chime as they're gathered. Wrap it in soft stylized lighting, a soothing orchestral soundtrack, drifting ambient particles, and a floaty, satisfying jump—capturing that cozy sense of wonder as a new area opens up over the hill.",
      "Create a 2D top-down Zelda-style adventure where the player explores an interconnected world of dungeons, swinging a sword, bombing cracked walls, and collecting tools that unlock new areas. Fill it with secret rooms, block-pushing puzzles, heart pickups, and menacing bosses that guard each dungeon's treasure. Use crisp pixel-art, satisfying sword-slash effects and screen-shake on hits, chiming item-get fanfares, and a lush overworld packed with the thrill of discovering what's behind the next locked door.",
      "Design a moody 2D metroidvania where the player explores a vast, interconnected underground kingdom, unlocking abilities—double-jump, wall-cling, dash—that open previously unreachable paths. Backtrack through atmospheric, hand-painted biomes, battle tricky enemies with tight combat, and uncover shortcuts and hidden upgrades. Add fluid movement, a haunting ambient score, glowing save points, satisfying ability-unlock moments, and the addictive pull of a map slowly filling in as every secret corner is finally revealed.",
    ],
  },
  {
    icon: "basketball",
    iconColor: "#FB923C",
    label: "Sports",
    prompts: [
      "Build a hyper-satisfying 3D arcade basketball dunk contest where the player drags to aim the arc, flicks to launch, and taps mid-air to trigger spinning trick dunks. Every slam should shatter the rim with a thunderous screenshake, explode the crowd into cheering particles, and freeze into a slow-motion replay for stylish finishes. Add a style multiplier that rewards backboard bounces and buzzer-beaters, thumping stadium bass, and a glossy scoreboard that rains confetti on a new high score.",
      "Create a fast, 2D top-down arcade soccer game built entirely around one-touch flow. The player slide-tackles to steal, curves shots with a flick, and threads one-touch passes to break the defense. Goals detonate with a net-ripping screenshake, a slow-mo camera push, and a roaring crowd, while the ball leaves a glowing motion trail on powerful strikes. Keep the pitch clean and vibrant with sharp lighting, snappy player animations, and an escalating combo meter for keep-away streaks.",
      "Design an extreme 3D downhill snowboarding game where the player carves at breakneck speed down an endless, procedurally generated mountain. Weave between pine trees, launch off cliffs, and tap to spin grabs and flips that stack a trick multiplier. The sense of speed must be intense—motion-blur, spraying snow particles, and a camera that pulls back as you accelerate. Add crunchy carving audio, a wipeout ragdoll on crashes, and glowing gates that reward tight lines.",
    ],
  },
  {
    icon: "skull",
    iconColor: "#FF3B30",
    label: "Survival",
    prompts: [
      "Build an explosive 2D top-down vampire-survivors style horde survivor where the player only moves while weapons auto-fire at a screen-filling swarm of monsters. Every few levels the player picks from randomized upgrades—spread shots, orbiting blades, chain lightning—that stack into absurd, screen-clearing builds. Enemies pour in by the hundreds, drop glowing XP gems, and burst into satisfying particle showers. Pile on heavy screenshake, floating damage numbers, a tense escalating soundtrack, and a menacing boss that crashes in every few minutes.",
      "Create a tense 3D first-person zombie survival game where the player fortifies a compound by day and holds the line through relentless night hordes. Board up windows, place turrets and spike traps with scavenged resources, then aim down the sights as waves of undead claw through the barricades with chunky ragdoll deaths. Add a dynamic day-night cycle, flickering muzzle-flash lighting, blood-splatter particles, escalating wave sizes, and a nerve-shredding countdown before each night that ramps the tension.",
      "Design a bleak 2D frozen-wasteland survival game about managing a single dying campfire. The player rations scavenged wood, food, and warmth while a brutal blizzard closes in and the temperature meter ticks down. Every choice—venture out for supplies or huddle by the flame—risks frostbite and starvation, with the screen frosting over and audio muffling as the cold bites. Use a muted, painterly art style, howling wind ambience, drifting snow, and a warm firelight glow that shrinks as fuel runs low.",
    ],
  },
  {
    icon: "car-sport",
    iconColor: "#38BDF8",
    label: "Racing",
    prompts: [
      "Create an adrenaline-pumping 3D first-person neon drifting game set on rain-slicked city streets at midnight. The player feathers the throttle and taps to initiate long, smoky drifts through hairpin turns, chaining them for a score multiplier as reactive neon signs streak past in a blur. Nail the game feel with tight arcade handling, tire-smoke particles, boost pads that slam the FOV wider, and a pulsing synthwave soundtrack. Add glowing drift trails, screen-warping speed lines, and a combo meter that roars as the chain climbs.",
      "Build a slick 2D top-down arcade racer where the player rips around tight neon city circuits from a bird's-eye view, weaving through traffic and throwing the car into long power-slides around every corner. Chain drifts to bank boost, then unleash it in a burst of speed-lines and light streaks. Reward tight racing lines with a rising combo multiplier, punish clips with a satisfying spin-out, and wrap it in a glowing top-down skyline, thumping bass, tire-smoke trails, and reactive light that smears across the asphalt as you fly past.",
      "Design a blistering 3D anti-gravity pod racer that screams through a glowing tube-track suspended in the sky. The craft banks and barrel-rolls around impossible curves as the player dodges energy gates and slams through boost rings for speed. Push the sense of velocity to a blur—warping starfield backdrops, a widening FOV on boost, and neon light-trails peeling off the pod. Add a driving electronic soundtrack, a heat-building boost meter, and a photo-finish camera that snaps to slow-mo across the line.",
    ],
  },
  {
    icon: "flashlight",
    iconColor: "#A78BFA",
    label: "Horror",
    prompts: [
      "Create a heart-pounding 3D first-person horror escape where the player is trapped in a pitch-black abandoned hospital overrun by shambling undead, armed only with a flickering flashlight and a dwindling battery. Creep through corridors searching for keys and exits while the beam reveals lurching silhouettes just before they lunge. Crank the dread with directional whispering audio, sudden jump-scares, a pounding heartbeat that spikes when the dead draw near, and a battery meter that plunges you into terrifying darkness when it dies.",
      "Design a terrifying 3D stealth-horror game where a relentless monster stalks the player through a fog-drenched forest at night. The player must move silently—every sprint, snapped twig, or dropped flashlight beam draws the creature closer—while gathering the items needed to escape. Build unbearable tension with a proximity heartbeat, a listening mechanic that visualizes sound, blood-freezing chase sequences when spotted, and a grainy, desaturated aesthetic where the monster is only ever half-glimpsed at the edge of the dark.",
      "Build a claustrophobic 2D zombie-horde shooter set in the flickering dark of a barricaded subway station. Ammo is scarce, so every shot counts as rotting hands smash through boarded windows from all sides and the player pivots to hold each breach. Amp the horror with muzzle-flash lighting that strobes the darkness, gushing gore particles, a rising groan of the swarm, and heart-stopping moments when the lights cut out and you fire blindly toward the shuffling silhouettes.",
    ],
  },
  {
    icon: "construct",
    iconColor: "#F59E0B",
    label: "Builder",
    prompts: [
      "Create a delightfully chaotic 2D contraption builder where the player snaps together ramps, launchers, fans, and bumpers to guide a bouncing ball into a distant goal. Hit 'GO' to watch the whole Rube-Goldberg machine spring to life with satisfying physics, then tweak and retry when it hilariously overshoots. Add juicy impact sounds, colorful particle bursts at every bounce, a slow-mo finish as the ball drops into the cup, and a sandbox with just enough moving parts to make each solution feel like a tiny triumph.",
      "Build a 2D physics-driven bridge-construction puzzle where the player draws beams and supports across a chasm, then sends a heavy vehicle rolling over to test it. Watch the structure flex, groan, and buckle under real stress as joints strain to their limit—triumphant when it holds, gloriously catastrophic when it snaps and plunges into the ravine. Include a live stress-color overlay, satisfying creaks and crashes, a slow-mo collapse camera, and a limited budget of materials that turns every build into a clever balancing act.",
      "Design a 3D physics sandbox tower-stacking game where the player hoists and balances wildly mismatched blocks—crates, barrels, wobbling furniture—to build the tallest possible tower before it topples. Each piece swings on a crane and must be dropped with careful timing as the whole structure sways in the wind. Reward height with escalating tension, add a teetering wobble meter, crunchy wooden physics, a slow-mo collapse when it all comes crashing down, and a bright, playful art style that makes the inevitable disaster feel joyful.",
    ],
  },
  {
    icon: "shield-half",
    iconColor: "#34D399",
    label: "Tower Defense",
    prompts: [
      "Create a polished 2D tower-defense game where the player places cannons, frost towers, and lightning coils along a winding path to stop endless waves of marching goblins from reaching the gate. Upgrade towers mid-battle, watch enemies freeze, burn, and shatter with juicy particle effects, and feel the weight of each critical hit with satisfying screenshake and floating damage numbers. Add escalating boss waves, a golden coin economy, a speed-up button for confident runs, and a vibrant, readable board where every tower's range glows on hover.",
      "Build a fast, arcadey 2D tower-defense twist where the player draws mazes out of turrets to force a snaking horde of robots down the longest possible kill-corridor. Combine tower types for elemental synergies—shock plus oil ignites chains of explosions—while a relentless wave counter climbs. Pile on crunchy explosions, glowing bullet tracers, satisfying wave-clear fanfares, escalating armored enemies, and a rising-intensity soundtrack that peaks during the boss rush at every tenth wave.",
      "Design a 3D hero tower-defense hybrid where the player both places defensive towers and directly controls a powerful hero unit dashing across the battlefield to plug gaps in the line. Rally the towers against swarming undead while unleashing the hero's screen-clearing ultimate at the perfect moment. Add loot drops that upgrade the hero between waves, chunky hit-stop on big hits, glowing ability effects, escalating night waves under a blood moon, and a satisfying gold-and-XP economy that fuels an ever-stronger defense.",
    ],
  },
  {
    icon: "trending-up",
    iconColor: "#FBBF24",
    label: "Idle",
    prompts: [
      "Build an insanely satisfying idle clicker where every tap on a giant glowing crystal spews a fountain of coins and floating numbers. Spend earnings on auto-miners, multipliers, and prestige upgrades that make the numbers explode from hundreds to quadrillions. Nail the dopamine with escalating tap-particle showers, a rising 'ka-ching' pitch as income grows, screen-filling number pop-ups, and that irresistible loop of watching your per-second income tick ever upward even while idle. Add a prestige reset that trades progress for permanent, game-warping multipliers.",
      "Create an addictive incremental empire builder where the player starts with a single lemonade stand and compounds it into a sprawling business tycoon. Reinvest profits into new shops, hire managers to automate income, and unlock upgrades that multiply everything. Keep the loop juicy with satisfying cash-register sounds, animated money flying into the bank, milestone celebrations with confetti, and unlockable prestige currency that resets the world for exponential gains. Every purchase should feel like the numbers are about to break the screen.",
      "Design a cosmic idle game where the player grows a tiny spark into an entire galaxy, one exponential upgrade at a time. Tap to birth stars, then automate with orbital harvesters and dark-matter multipliers that push the counter into absurd, name-defying numbers. Wrap it in a mesmerizing deep-space aesthetic with glowing particle nebulae, a soothing ambient soundtrack, gentle number-pop feedback, and a prestige 'big bang' reset that trades your universe for permanent power. The joy is watching everything snowball while you barely lift a finger.",
    ],
  },
  {
    icon: "finger-print",
    iconColor: "#F472B6",
    label: "One-Tap",
    prompts: [
      "Create an instantly addictive one-tap arcade game where a single tap flaps a tiny glowing creature upward through an endless gauntlet of neon obstacles. The controls are dead simple but the challenge is brutally precise—one wrong tap and it's over, daring you into just one more try. Add buttery-smooth physics, a satisfying flap sound, particle trails, a snappy score pop on every gap cleared, escalating speed, and a slick, minimalist neon aesthetic with a screen-flash and gentle screenshake on each near-miss.",
      "Build a hyper-minimalist one-tap reflex game where a ball bounces automatically and a single tap makes it switch direction or jump to dodge an endless stream of oncoming spikes. The pace ramps relentlessly until it's a pure test of rhythm and nerve. Keep it stark and gorgeous—clean geometric shapes, a single bold accent color, smooth easing on every bounce, a satisfying click on each tap, and a combo-driven color shift that intensifies the deeper the run goes. Punish failure with an instant, snappy restart that begs for another go.",
      "Design a slick one-tap endless game where a rolling shape auto-runs across a zig-zagging path and each tap makes it leap between platforms floating over a void. Mistime it and you plummet, but nail the rhythm and the tempo climbs into a hypnotic flow state. Add smooth camera easing, a satisfying landing thud, trailing particle wisps, a pulsing minimalist soundtrack that syncs to your jumps, and a clean color palette that gradually shifts as your score climbs—making every long run feel like a mesmerizing performance.",
    ],
  },
];

// =============================================
// GENERATING PHASE STEPS
// =============================================
const GENERATION_STEPS = [
  { icon: "code-slash", text: "Writing game logic..." },
  { icon: "cube", text: "Compiling physics engine..." },
  { icon: "color-palette", text: "Rendering world..." },
  { icon: "musical-notes", text: "Generating audio..." },
];

const COOKING_STATUS_LINES = [
  "Wizard is scribbling the game rules...",
  "Knight is keeping the forge safe...",
  "Teaching the zombies how to lose...",
  "Sanding the rough edges off the fun...",
];

const chunkIntoRows = <T,>(items: T[], rowCount: number) =>
  Array.from({ length: rowCount }, (_, rowIndex) =>
    items.filter((_, index) => index % rowCount === rowIndex),
  );

const ATTACHMENT_ROLE_OPTIONS: Record<
  string,
  Array<{ role: AttachmentRole; label: string }>
> = {
  image: [
    { role: "hero", label: "Hero" },
    { role: "background", label: "Background" },
    { role: "overlay", label: "Overlay" },
    { role: "panel", label: "Panel" },
    { role: "prop", label: "Prop" },
    { role: "reference", label: "Reference" },
  ],
  video: [
    { role: "background", label: "Background" },
    { role: "panel", label: "Panel" },
    { role: "overlay", label: "Overlay" },
    { role: "reference", label: "Reference" },
  ],
  bgm: [
    { role: "bgm", label: "BGM" },
    { role: "reference", label: "Reference" },
  ],
  sfx: [
    { role: "sfx", label: "SFX" },
    { role: "reference", label: "Reference" },
  ],
};

// Plain-language one-liner for each role, shown under the chips so the labels
// aren't a vocabulary test.
const ROLE_DESCRIPTIONS: Record<AttachmentRole, string> = {
  hero: "The main character or star object of the game.",
  background: "Fills the whole screen behind the game.",
  overlay: "Pops up on top — a meme, sticker, or reaction.",
  panel: "Shown inside a screen, TV, card, or frame.",
  prop: "An object the player grabs, uses, or collects.",
  reference: "Inspiration for the style — not shown directly.",
  bgm: "Plays as looping background music.",
  sfx: "Plays as a sound effect at key moments.",
};

// =============================================
// STEP INDICATOR COMPONENT (for generation phase)
// =============================================
const StepIndicator = ({
  step,
  isActive,
  isComplete,
}: {
  step: (typeof GENERATION_STEPS)[0];
  isActive: boolean;
  isComplete: boolean;
}) => {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[
        styles.stepRow,
        isActive && { opacity: 1 },
        isComplete && { opacity: 0.4 },
      ]}
    >
      <View
        style={[
          styles.stepDot,
          isActive && {
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            shadowOpacity: 0.8,
            shadowRadius: 8,
          },
          isComplete && { backgroundColor: "#2ECC71" },
        ]}
      >
        {isComplete ? (
          <Ionicons name="checkmark" size={10} color="#FFF" />
        ) : (
          isActive && <ActivityIndicator size="small" color="#FFF" />
        )}
      </View>
      <Text
        style={[
          styles.stepText,
          isActive && { color: "#FFF", fontWeight: "700" },
        ]}
      >
        {step.text}
      </Text>
    </Animated.View>
  );
};

// =============================================
// MAIN DREAMSTREAM SCREEN
// =============================================
export const CreateScreen: React.FC<CreateScreenProps> = ({
  isActive,
  onClose,
  openDraftId,
  onDraftOpened,
}) => {
  const { colors, isDark } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const { showAuthScreen } = useAuthScreen();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const remoteCancelRef = useRef<(() => void) | null>(null);
  const detachPendingDreamRef = useRef(false);
  const resumingPendingJobRef = useRef<string | null>(null);
  const cookingNotificationRef = useRef<string | null>(null);
  const completionDataRef = useRef<{
    htmlPreview: string;
    gameUrl?: string;
    draftId: string;
    title: string;
    orientation?: Orientation;
  } | null>(null);
  const webviewRef = useRef<WebView>(null);
  // Template-chip marquee: 3 rows drift horizontally via translateX. Widths are
  // the measured length of ONE copy of a row (each row is rendered twice), and
  // the marquee pauses briefly whenever a chip is touched so it holds still.
  const ideasTx0 = useSharedValue(0);
  const ideasTx1 = useSharedValue(0);
  const ideasTx2 = useSharedValue(0);
  const ideasTx = [ideasTx0, ideasTx1, ideasTx2];
  const ideasLoopWidths = useRef([0, 0, 0]);
  const ideasPauseUntilRef = useRef(0);

  // Game Config Bridge State (Rezona-style)
  const [gameConfig, setGameConfig] = useState<
    Record<
      string,
      { type: string; label: string; value: number; min: number; max: number }
    >
  >({});
  const [editableSlots, setEditableSlots] = useState<
    { id: string; type: string; label: string; src: string }[]
  >([]);
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // Core state
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<DreamPhase>("idle");
  const [activeHtml, setActiveHtml] = useState<string | null>(null);
  const [activeGameUrl, setActiveGameUrl] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftThumbnail, setActiveDraftThumbnail] = useState<
    string | null
  >(null);
  const [pendingEditRequest, setPendingEditRequest] =
    useState<PendingEditRequest | null>(null);
  const [editIntent, setEditIntent] = useState<EditIntent | null>(null);
  const [gameTitle, setGameTitle] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUri, setGeneratedImageUri] = useState<string | null>(
    null,
  );
  const [showImageModal, setShowImageModal] = useState(false);
  const [imagePromptText, setImagePromptText] = useState("");
  const [showColorsModal, setShowColorsModal] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [showSoundsModal, setShowSoundsModal] = useState(false);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [showVideosModal, setShowVideosModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [audioTab, setAudioTab] = useState<"bgm" | "sfx">("bgm");
  const [activeFeatures, setActiveFeatures] = useState<Record<string, boolean>>(
    {},
  );
  const [communityVideos, setCommunityVideos] = useState<any[]>([]);
  // Community video pagination — the pool is large, so load it a page at a time
  // and fetch more as the user scrolls. Refs avoid stale closures in loadVideos.
  const [videosInitialLoading, setVideosInitialLoading] = useState(false);
  const [videosLoadingMore, setVideosLoadingMore] = useState(false);
  const videosOffsetRef = useRef(0);
  const videosHasMoreRef = useRef(true);
  const videosLoadingRef = useRef(false);
  const VIDEOS_PAGE_SIZE = 30;
  // Which video tiles are on screen right now — only those animate (play); the
  // rest show the static cover, so we never spin up 30 players at once.
  const [visibleVideoIds, setVisibleVideoIds] = useState<Set<string>>(new Set());
  const onVideoViewRef = useRef((info: { viewableItems: any[] }) => {
    setVisibleVideoIds(
      new Set(
        info.viewableItems
          .map((v) => v.item?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
  });
  const videoViewConfigRef = useRef({ itemVisiblePercentThreshold: 60 });
  const [communityAudios, setCommunityAudios] = useState<any[]>([]);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [showCommunityImagesModal, setShowCommunityImagesModal] =
    useState(false);
  const [communityPhotos, setCommunityPhotos] = useState<any[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<any | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const audioPreviewRef = useRef<Audio.Sound | null>(null);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const [selectedCommunityImage, setSelectedCommunityImage] = useState<
    any | null
  >(null);
  const [attachedAssets, setAttachedAssets] = useState<StructuredAttachment[]>(
    [],
  );
  // Wish studio handoff: Forge It opens the studio with this brief.
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioPrompt, setStudioPrompt] = useState("");
  // Compulsory: no default. Forge It stays disabled until the creator picks a shape, because
  // orientation cannot be changed after generation — the game is built and verified for one.
  const [orientation, setOrientation] = useState<Orientation | null>(null);
  const [studioOrientation, setStudioOrientation] = useState<Orientation>(DEFAULT_ORIENTATION);
  const [isOpeningDraft, setIsOpeningDraft] = useState(false);
  // ...or with a game that already exists (draft, remix, finished build), in
  // which case the studio skips planning and opens on Preview.
  const [studioGame, setStudioGame] = useState<{
    draftId: string;
    html: string | null;
    gameUrl: string | null;
    title: string;
  } | null>(null);
  const [showAssetIntentModal, setShowAssetIntentModal] = useState(false);
  const [pendingAssetIntent, setPendingAssetIntent] =
    useState<StructuredAttachment | null>(null);
  const [assetIntentRole, setAssetIntentRole] =
    useState<AttachmentRole>("hero");
  const [assetIntentText, setAssetIntentText] = useState("");
  // Video preview in the asset-intent modal starts muted (autoplay), tap to hear.
  const [assetPreviewMuted, setAssetPreviewMuted] = useState(true);
  // The custom-instruction field is collapsed by default — the common path is
  // just "attach as <role>", so most users never need to type anything.
  const [assetIntentShowInstruction, setAssetIntentShowInstruction] =
    useState(false);
  const assetIntentScrollRef = useRef<ScrollView>(null);
  const scrollAssetIntentToEnd = () =>
    setTimeout(
      () => assetIntentScrollRef.current?.scrollToEnd({ animated: true }),
      120,
    );
  const [editingAttachedAssetIndex, setEditingAttachedAssetIndex] = useState<
    number | null
  >(null);
  const [memeTab, setMemeTab] = useState<"gif" | "stickers">("gif");
  const [memeSearchQuery, setMemeSearchQuery] = useState("");
  const [isMemeSearching, setIsMemeSearching] = useState(false);
  const [giphyResults, setGiphyResults] = useState<any[]>([]);
  const [giphyStickers, setGiphyStickers] = useState<any[]>([]);
  const [isGiphyLoading, setIsGiphyLoading] = useState(false);
  const [isGiphyLoadingMore, setIsGiphyLoadingMore] = useState(false);

  const [showExitConfirm, setShowExitConfirm] = useState<
    "discard" | "closeApp" | null
  >(null);
  const [privacySetting, setPrivacySetting] = useState<
    "public" | "play_only" | "private"
  >("public");
  const [labsMode, setLabsMode] = useState(false);

  // Audio search state
  const [audioSearchQuery, setAudioSearchQuery] = useState("");
  const [isAudioSearching, setIsAudioSearching] = useState(false);
  const [freesoundBgm, setFreesoundBgm] = useState<any[]>([]);
  const [freesoundSfx, setFreesoundSfx] = useState<any[]>([]);
  const [isFreesoundLoading, setIsFreesoundLoading] = useState(false);
  const [isFreesoundLoadingMore, setIsFreesoundLoadingMore] = useState(false);

  // Studio tab state
  const [studioTab, setStudioTab] = useState<StudioTab>("create");
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [pendingJobs, setPendingJobs] = useState<PendingDreamJob[]>([]);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [pendingJobStatus, setPendingJobStatus] = useState<
    "idle" | "queued" | "running" | "failed" | "canceled"
  >("idle");
  const [generationProgress, setGenerationProgress] = useState<number | null>(
    null,
  );
  const [generationPhase, setGenerationPhase] = useState<string | null>(null);
  const [generationStatusMessage, setGenerationStatusMessage] = useState<
    string | null
  >(null);
  const [studioBuildTick, setStudioBuildTick] = useState(0);

  // Game spec state
  const [gameSpec, setGameSpec] = useState<GameSpec | null>(null);
  const [isGeneratingSpec, setIsGeneratingSpec] = useState(false);
  const [isRefiningSpecMessage, setIsRefiningSpecMessage] = useState(false);
  const [wishInput, setWishInput] = useState("");
  const [refinementBrief, setRefinementBrief] = useState("");
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: "ai" | "user"; content: string }>
  >([]);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const wishInputRef = useRef<TextInput>(null);
  const refiningScrollRef = useRef<ScrollView>(null);
  const hasAutoScrolledToSpecRef = useRef(false);

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

  const MUTE_WEBVIEW_JS = useMemo(
    () => `
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
  `,
    [],
  );

  // Handle messages from the WebView game
  const showPreviewError = useCallback((message: string) => {
    if (!message) return;
    setErrorMsg(message.length > 180 ? message.slice(0, 177) + "..." : message);
  }, []);

  const handleWebViewMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "GAME_BRIDGE_INIT") {
          if (data.config && Object.keys(data.config).length > 0) {
            setGameConfig(data.config);
            console.log(
              "Bridge: Game config received with",
              Object.keys(data.config).length,
              "params",
            );
          }
          if (data.slots && data.slots.length > 0) {
            setEditableSlots(data.slots);
            console.log(
              "Bridge: Found",
              data.slots.length,
              "editable asset slots",
            );
          }
          setErrorMsg(null);
        } else if (data.type === "BRIDGE_ERROR") {
          showPreviewError(
            `Preview bridge error: ${data.error || "Bridge initialization failed."}`,
          );
        } else if (data.type === "RUNTIME_ERROR") {
          const label = data.kind || "Preview runtime error";
          const detail =
            data.detail || "The generated game failed while running.";
          showPreviewError(`${label}: ${detail}`);
        }
      } catch (e) {
        // Silently ignore non-JSON messages
      }
    },
    [showPreviewError],
  );

  // Send a config update to the running game
  const updateGameConfig = useCallback((key: string, value: number) => {
    setGameConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key], value },
    }));
    webviewRef.current?.postMessage(
      JSON.stringify({
        type: "UPDATE_CONFIG",
        key,
        value,
      }),
    );
  }, []);

  // Swap an editable asset in the running game
  const swapGameAsset = useCallback((slotId: string, newSrc: string) => {
    setEditableSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, src: newSrc } : s)),
    );
    webviewRef.current?.postMessage(
      JSON.stringify({
        type: "SWAP_ASSET",
        slotId,
        newSrc,
      }),
    );
  }, []);

  // Animations
  const orbPulse = useSharedValue(1);
  const orbRotation = useSharedValue(0);
  const studioChipData = GENRE_CHIPS;
  // Each row is duplicated so the translateX marquee can loop seamlessly: when
  // the first copy has scrolled fully out, we snap back to 0 and the second copy
  // is already in the same place. The motion is a transform (not a ScrollView
  // scroll), so it never steals taps from the chips.
  const studioChipRows = chunkIntoRows(studioChipData, 3).map((row) => [
    ...row,
    ...row,
  ]);
  const focusedPendingJob = pendingJobId
    ? pendingJobs.find((job) => job.jobId === pendingJobId)
    : pendingJobs[0] || null;
  const activePendingJobs = pendingJobs.filter(
    (job) => job.status === "queued" || job.status === "running",
  );
  const pendingBuildActive =
    pendingJobStatus === "queued" || pendingJobStatus === "running";
  const pendingBuildCanceled = pendingJobStatus === "canceled";
  const pendingBuildFailed =
    pendingJobStatus === "failed" ||
    Boolean(errorMsg && pendingJobId && phase !== "generating");
  const activeStudioStepIndex =
    pendingJobId && pendingBuildActive
      ? phase === "generating"
        ? activeStep
        : studioBuildTick % GENERATION_STEPS.length
      : 0;
  const activeStudioStep = GENERATION_STEPS[activeStudioStepIndex];
  const activeStudioStatusLine =
    COOKING_STATUS_LINES[studioBuildTick % COOKING_STATUS_LINES.length];
  const activeBuildStatusText = pendingBuildFailed
    ? "Build failed · Tap to fix"
    : pendingBuildCanceled
      ? "Build stopped"
      : pendingBuildActive
        ? `Forging in background · ${generationStatusMessage || activeStudioStep.text}`
        : "No active build";
  const activeDraftFromList = useMemo(
    () =>
      activeDraftId
        ? drafts.find((draft) => draft.id === activeDraftId) || null
        : null,
    [activeDraftId, drafts],
  );

  // Fetch drafts when screen becomes active or tab switches to drafts
  const fetchDrafts = useCallback(async () => {
    if (!isAuthenticated) {
      setDrafts([]);
      setDraftsLoading(false);
      setActiveDraftThumbnail(null);
      return;
    }

    try {
      setDraftsLoading(true);
      const res = (await ai.drafts()) as any;
      if (res?.drafts) {
        setDrafts(res.drafts);
        if (activeDraftId) {
          const activeDraft = res.drafts.find(
            (draft: DraftItem) => draft.id === activeDraftId,
          );
          const thumbnail = getDraftThumbnail(activeDraft);
          if (thumbnail) {
            setActiveDraftThumbnail(thumbnail);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch drafts:", e);
    } finally {
      setDraftsLoading(false);
    }
  }, [activeDraftId, isAuthenticated]);

  useEffect(() => {
    if (isActive && isAuthenticated) {
      fetchDrafts();
    } else {
      webviewRef.current?.injectJavaScript(MUTE_WEBVIEW_JS);
    }
  }, [isActive, isAuthenticated, fetchDrafts, MUTE_WEBVIEW_JS]);

  // Every finished game — a draft, a remix, a build that just landed — opens in
  // the Wish studio's Preview tab. There is no second editor to send it to.
  const openGameInStudio = useCallback(
    (game: {
      draftId: string;
      html: string | null;
      gameUrl: string | null;
      title: string;
      orientation?: Orientation | string | null;
    }) => {
      setActiveDraftId(game.draftId);
      setActiveHtml(game.html);
      setActiveGameUrl(game.gameUrl);
      setGameTitle(game.title);
      setErrorMsg(null);
      setPhase("idle");
      setStudioPrompt("");
      // An existing game brings its OWN orientation — the composer's pick is irrelevant here, and
      // using it would make the studio preview render the game in the wrong box. When the caller
      // has nothing to say (an edit result reopening the game we're already on), keep what we have
      // rather than silently falling back to portrait.
      setStudioOrientation((prev) =>
        game.orientation != null ? normalizeOrientation(game.orientation) : prev,
      );
      setStudioGame(game);
      setStudioOpen(true);
    },
    [],
  );

  // Load a draft straight into the studio (used by the drafts list and by the
  // Remix hand-off from the feed).
  const openDraftInEditor = useCallback(
    async (draftId: string) => {
      setIsOpeningDraft(true);
      try {
        const res = (await ai.getDraft(draftId)) as any;
        if (res?.draft?.html_payload || res?.draft?.game_url) {
          setActiveDraftThumbnail(getDraftThumbnail(res.draft));
          openGameInStudio({
            draftId: res.draft.id,
            html: res.draft.html_payload || null,
            gameUrl: res.draft.game_url || null,
            title: res.draft.title || "Untitled Game",
            orientation: res.draft.orientation,
          });
        }
      } catch (e) {
        console.error("Failed to open draft:", e);
      } finally {
        setIsOpeningDraft(false);
      }
    },
    [openGameInStudio],
  );

  // When the feed hands us a freshly-remixed draft, open it for editing.
  useEffect(() => {
    if (isActive && openDraftId) {
      openDraftInEditor(openDraftId);
      onDraftOpened?.();
    }
  }, [isActive, openDraftId, openDraftInEditor, onDraftOpened]);

  useEffect(() => {
    if (studioTab === "drafts" && isAuthenticated) {
      fetchDrafts();
    }
  }, [studioTab, isAuthenticated, fetchDrafts]);

  useEffect(() => {
    const thumbnail = getDraftThumbnail(activeDraftFromList);
    if (thumbnail) {
      setActiveDraftThumbnail(thumbnail);
    }
  }, [activeDraftFromList]);

  useEffect(() => {
    if (!isAuthenticated || !activeDraftId || (!activeHtml && !activeGameUrl)) {
      setActiveDraftThumbnail(null);
      return;
    }
    if (activeDraftThumbnail) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshActiveDraftThumbnail = async (attempt = 0) => {
      try {
        const res = (await ai.drafts()) as any;
        const nextDrafts = Array.isArray(res?.drafts) ? res.drafts : [];
        if (cancelled) return;

        if (nextDrafts.length > 0) {
          setDrafts(nextDrafts);
        }

        const activeDraft = nextDrafts.find(
          (draft: DraftItem) => draft.id === activeDraftId,
        );
        const thumbnail = getDraftThumbnail(activeDraft);
        if (thumbnail) {
          setActiveDraftThumbnail(thumbnail);
          return;
        }
      } catch (e) {
        console.warn("Failed to refresh active draft thumbnail:", e);
      }

      if (!cancelled && attempt < 5) {
        retryTimer = setTimeout(
          () => refreshActiveDraftThumbnail(attempt + 1),
          1200 + attempt * 700,
        );
      }
    };

    refreshActiveDraftThumbnail();

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [isAuthenticated, activeDraftId, activeHtml, activeDraftThumbnail]);

  const writePendingDreamJobs = useCallback(async (jobs: PendingDreamJob[]) => {
    const activeJobs = jobs.filter((job) => job.status !== "idle");
    setPendingJobs(activeJobs);
    try {
      if (activeJobs.length > 0) {
        await AsyncStorage.setItem(
          PENDING_CREATE_JOB_KEY,
          JSON.stringify({ jobs: activeJobs }),
        );
      } else {
        await AsyncStorage.removeItem(PENDING_CREATE_JOB_KEY);
      }
    } catch (e) {
      console.warn("Failed to persist pending dream jobs:", e);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;
    const hydratePendingDreamJobs = async () => {
      try {
        const rawPending = await AsyncStorage.getItem(PENDING_CREATE_JOB_KEY);
        if (cancelled) return;

        const jobs = parsePendingDreamJobs(rawPending);
        setPendingJobs(jobs);

        if (jobs.length > 0 && !pendingJobId) {
          const job = jobs[0];
          setPendingJobId(job.jobId);
          setPendingJobStatus(job.status === "idle" ? "queued" : job.status);
          setGenerationProgress(job.progress);
          setGenerationPhase(job.phase);
          setGenerationStatusMessage(job.statusMessage);
          if (job.prompt && !prompt.trim()) {
            setPrompt(job.prompt);
          }
        }
      } catch (e) {
        console.warn("Failed to hydrate pending dream jobs:", e);
      }
    };

    hydratePendingDreamJobs();
    return () => {
      cancelled = true;
    };
  }, [isActive]);

  const upsertPendingDreamJob = useCallback(
    async (job: PendingDreamJob) => {
      let nextJobs: PendingDreamJob[] = [];
      setPendingJobs((prev) => {
        const withoutJob = prev.filter((item) => item.jobId !== job.jobId);
        nextJobs = [job, ...withoutJob].slice(0, 3);
        return nextJobs;
      });
      await writePendingDreamJobs(nextJobs);
    },
    [writePendingDreamJobs],
  );

  const removePendingDreamJob = useCallback(
    async (jobId?: string | null) => {
      if (!jobId) return;
      let nextJobs: PendingDreamJob[] = [];
      setPendingJobs((prev) => {
        nextJobs = prev.filter((job) => job.jobId !== jobId);
        return nextJobs;
      });
      if (pendingJobId === jobId) {
        const nextFocusedJob = nextJobs[0] || null;
        setPendingJobId(nextFocusedJob?.jobId || null);
        setPendingJobStatus(nextFocusedJob?.status || "idle");
        setGenerationProgress(nextFocusedJob?.progress || null);
        setGenerationPhase(nextFocusedJob?.phase || null);
        setGenerationStatusMessage(nextFocusedJob?.statusMessage || null);
      }
      await writePendingDreamJobs(nextJobs);
    },
    [pendingJobId, writePendingDreamJobs],
  );

  const clearPendingDreamJob = useCallback(async () => {
    const jobIdToClear = pendingJobId;
    if (jobIdToClear) {
      await removePendingDreamJob(jobIdToClear);
    }
    setPendingJobId((prev) => (prev === jobIdToClear ? null : prev));
    setPendingJobStatus("idle");
    setGenerationProgress(null);
    setGenerationPhase(null);
    setGenerationStatusMessage(null);
    await cancelLocalNotification(cookingNotificationRef.current);
    cookingNotificationRef.current = null;
    try {
      if (!jobIdToClear) {
        await AsyncStorage.removeItem(PENDING_CREATE_JOB_KEY);
        setPendingJobs([]);
      }
    } catch (e) {
      console.warn("Failed to clear pending dream job:", e);
    }
  }, [pendingJobId, removePendingDreamJob]);

  const clearPersistedPendingDreamJob = useCallback(async () => {
    const jobIdToClear = pendingJobId;
    if (jobIdToClear) {
      await removePendingDreamJob(jobIdToClear);
    }
    setPendingJobId((prev) => (prev === jobIdToClear ? null : prev));
    await cancelLocalNotification(cookingNotificationRef.current);
    cookingNotificationRef.current = null;
    try {
      if (!jobIdToClear) {
        await AsyncStorage.removeItem(PENDING_CREATE_JOB_KEY);
        setPendingJobs([]);
      }
    } catch (e) {
      console.warn("Failed to clear persisted pending dream job:", e);
    }
  }, [pendingJobId, removePendingDreamJob]);

  const markPendingDreamJobFailed = useCallback(async (
    message?: string | null,
    jobIdOverride?: string | null,
  ) => {
    const jobIdToMark = jobIdOverride || pendingJobId;
    if (jobIdToMark) {
      const failedPatch = {
        status: "failed" as PendingDreamJobStatus,
        progress: null,
        phase: null,
        statusMessage: null,
        error: message || null,
      };
      setPendingJobs((prev) =>
        prev.map((job) =>
          job.jobId === jobIdToMark ? { ...job, ...failedPatch } : job,
        ),
      );
      try {
        const rawPending = await AsyncStorage.getItem(PENDING_CREATE_JOB_KEY);
        const storedJobs = parsePendingDreamJobs(rawPending);
        const patchedJobs =
          storedJobs.length > 0
            ? storedJobs.map((job) =>
                job.jobId === jobIdToMark ? { ...job, ...failedPatch } : job,
              )
            : [
                makePendingDreamJob({
                  jobId: jobIdToMark,
                  prompt,
                  labsMode,
                  status: "failed",
                  error: message || null,
                }),
              ];
        await writePendingDreamJobs(patchedJobs);
      } catch (e) {
        console.warn("Failed to persist failed pending dream job:", e);
      }
    } else {
      await clearPersistedPendingDreamJob();
    }
    setPendingJobStatus("failed");
    setGenerationProgress(null);
    setGenerationPhase(null);
    setGenerationStatusMessage(null);
  }, [
    clearPersistedPendingDreamJob,
    labsMode,
    pendingJobId,
    prompt,
    writePendingDreamJobs,
  ]);

  const applyGenerationStatus = useCallback((status: any) => {
    const statusJobId = status?.jobId || pendingJobId;
    const nextStatus = normalizePendingDreamStatus(status?.status);
    const nextProgress =
      typeof status?.progress === "number"
        ? Math.max(0, Math.min(100, status.progress))
        : null;

    if (statusJobId) {
      const nextJobPatch = {
        status: nextStatus,
        progress: nextProgress,
        phase: typeof status?.phase === "string" ? status.phase : undefined,
        statusMessage:
          typeof status?.statusMessage === "string"
            ? status.statusMessage
            : undefined,
        error: status?.error || undefined,
      };
      setPendingJobs((prev) =>
        prev.map((job) =>
          job.jobId === statusJobId
            ? {
                ...job,
                status: nextJobPatch.status,
                progress:
                  nextJobPatch.progress !== null ? nextJobPatch.progress : job.progress,
                phase:
                  nextJobPatch.phase !== undefined ? nextJobPatch.phase : job.phase,
                statusMessage:
                  nextJobPatch.statusMessage !== undefined
                    ? nextJobPatch.statusMessage
                    : job.statusMessage,
                error: nextJobPatch.error || job.error || null,
              }
            : job,
        ),
      );
      if (nextStatus === "queued" || nextStatus === "running") {
        void AsyncStorage.getItem(PENDING_CREATE_JOB_KEY)
          .then((rawPending) => {
            const storedJobs = parsePendingDreamJobs(rawPending);
            const patchedJobs = storedJobs.map((job) =>
              job.jobId === statusJobId
                ? {
                    ...job,
                    status: nextJobPatch.status,
                    progress:
                      nextJobPatch.progress !== null
                        ? nextJobPatch.progress
                        : job.progress,
                    phase:
                      nextJobPatch.phase !== undefined
                        ? nextJobPatch.phase
                        : job.phase,
                    statusMessage:
                      nextJobPatch.statusMessage !== undefined
                        ? nextJobPatch.statusMessage
                        : job.statusMessage,
                    error: nextJobPatch.error || job.error || null,
                  }
                : job,
            );
            return writePendingDreamJobs(patchedJobs);
          })
          .catch((e) =>
            console.warn("Failed to persist pending dream status:", e),
          );
      }
    }

    if (typeof status?.status === "string") {
      setPendingJobStatus(
        status.status === "error" || status.status === "failed"
          ? "failed"
          : status.status === "canceled"
            ? "canceled"
            : status.status === "complete"
              ? "idle"
              : status.status === "queued"
                ? "queued"
                : "running",
      );
    }
    if (typeof status?.progress === "number") {
      const nextProgress = Math.max(0, Math.min(100, status.progress));
      setGenerationProgress(nextProgress);
      setActiveStep(
        nextProgress >= 88
          ? 3
          : nextProgress >= 68
            ? 2
            : nextProgress >= 35
              ? 1
              : 0,
      );
    }
    if (typeof status?.phase === "string") {
      setGenerationPhase(status.phase);
    }
    if (typeof status?.statusMessage === "string") {
      setGenerationStatusMessage(status.statusMessage);
    }
    if (
      status?.status === "error" ||
      status?.status === "failed" ||
      status?.status === "canceled"
    ) {
      if (statusJobId) {
        void removePendingDreamJob(statusJobId);
      }
      void cancelLocalNotification(cookingNotificationRef.current).then(() => {
        cookingNotificationRef.current = null;
      });
    }
    // Capture completion data so the watchdog can force-transition to preview
    if (
      status?.status === "complete" &&
      (status?.htmlPreview || status?.gameUrl) &&
      status?.draftId
    ) {
      completionDataRef.current = {
        htmlPreview: status.htmlPreview,
        gameUrl: status.gameUrl,
        draftId: status.draftId,
        title: status.title || "Untitled Dream",
        orientation: status.orientation ? normalizeOrientation(status.orientation) : undefined,
      };
    }
  }, [pendingJobId, removePendingDreamJob, writePendingDreamJobs]);

  const armCookingNotification = useCallback(
    async (jobId?: string | null, jobPrompt?: string) => {
      if (!jobId) return;
      await cancelLocalNotification(cookingNotificationRef.current);
      cookingNotificationRef.current = await scheduleCookingNotification(
        jobId,
        jobPrompt,
      );
    },
    [],
  );

  const persistPendingDreamJob = useCallback(
    async (payload: { jobId: string; prompt: string; labsMode: boolean; orientation: Orientation }) => {
      const pendingJob = makePendingDreamJob({
        ...payload,
        status: "queued",
      });
      setPendingJobId(payload.jobId);
      setPendingJobStatus("queued");
      await armCookingNotification(payload.jobId, payload.prompt);
      await upsertPendingDreamJob(pendingJob);
    },
    [armCookingNotification, upsertPendingDreamJob],
  );

  const completePendingDreamJob = useCallback(
    async (title?: string, draftId?: string | null) => {
      const hadCookingStatus = Boolean(cookingNotificationRef.current);
      await clearPendingDreamJob();
      if (hadCookingStatus && draftId) {
        await scheduleGameReadyNotification(draftId, title);
      }
    },
    [clearPendingDreamJob],
  );

  const stopCookingNotificationOnly = useCallback(async () => {
    await cancelLocalNotification(cookingNotificationRef.current);
    cookingNotificationRef.current = null;
  }, []);

  const ensureFallbackSpec = useCallback(
    (sourcePrompt: string) => {
      if (gameSpec) return;
      const cleanedPrompt = sourcePrompt.trim();
      const titleWords = cleanedPrompt
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2)
        .slice(0, 3);
      setGameSpec({
        title: titleWords.length
          ? titleWords
              .map(
                (word) => word[0].toUpperCase() + word.slice(1).toLowerCase(),
              )
              .join(" ")
          : "Retry Build",
        description:
          cleanedPrompt || "Your game build hit an error before it finished.",
        features: [
          "Retry the build with the same prompt.",
          "Keep the idea and attachments intact.",
        ],
      });
    },
    [gameSpec],
  );

  const stopLocalDreamPolling = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    resumingPendingJobRef.current = null;
  }, []);

  const stopRemoteDreamJob = useCallback(async (jobId?: string | null) => {
    if (remoteCancelRef.current) {
      remoteCancelRef.current();
      remoteCancelRef.current = null;
    } else if (jobId) {
      await ai.cancelDreamJob(jobId);
    }
  }, []);

  const formatDreamError = useCallback(
    (error: any, mode: "generate" | "edit" = "generate") => {
      const fallback =
        mode === "edit"
          ? "Could not update the game right now. Please try again."
          : "Could not generate the game right now. Please try again.";

      if (!error) return fallback;

      const message = String(error.message || error);
      if (error.name === "AbortError" || message.includes("aborted")) {
        return null;
      }

      if (error.code === "REQUEST_TIMEOUT" || /timed out/i.test(message)) {
        return mode === "edit"
          ? "The update request took too long to start. Railway may be cold or the AI backend is overloaded. Try again in a moment."
          : "The generation request took too long to start. Railway may be cold or the AI backend is overloaded. Try again in a moment.";
      }

      if (/network request failed/i.test(message)) {
        return "Could not reach the AI backend. Check your connection and try again.";
      }

      return message || fallback;
    },
    [],
  );

  useEffect(() => {
    if (!isActive) return;
    if (studioOpen) return; // a game is already on screen — don't yank it away
    if (phase !== "idle" && phase !== "generating") return;
    if (cancelRef.current) return;
    if (resumingPendingJobRef.current) return;

    let cancelled = false;
    let resumeCancel: (() => void) | null = null;

    const resumePendingDream = async () => {
      let pending: PendingDreamJob | null = null;
      try {
        const rawPending = await AsyncStorage.getItem(PENDING_CREATE_JOB_KEY);
        if (cancelled) return;

        const pendingDreamJobs = parsePendingDreamJobs(rawPending);
        await writePendingDreamJobs(pendingDreamJobs);
        pending =
          pendingDreamJobs.find((job) => job.jobId === pendingJobId) ||
          pendingDreamJobs[0] ||
          null;
        if (!pending?.jobId) return;
        if (resumingPendingJobRef.current === pending.jobId) return;

        resumingPendingJobRef.current = pending.jobId;
        setPendingJobId(pending.jobId);
        setPendingJobStatus("running");
        if (pending.prompt && !prompt.trim()) {
          setPrompt(pending.prompt);
        }
        setErrorMsg(null);

        const { promise, cancel } = ai.resumeDreamJob(pending.jobId, {
          onStatus: (status: any) =>
            applyGenerationStatus({ ...status, jobId: status?.jobId || pending?.jobId }),
        });
        resumeCancel = cancel;
        cancelRef.current = cancel;
        remoteCancelRef.current = null;
        const res = (await promise) as any;
        if (cancelled) return;
        cancelRef.current = null;
        remoteCancelRef.current = null;
        resumingPendingJobRef.current = null;

        if (res.success && (res.htmlPreview || res.gameUrl)) {
          await completePendingDreamJob(
            res.title || "Untitled Dream",
            res.draftId,
          );
          setGameConfig({});
          setEditableSlots([]);
          setActiveDraftThumbnail(getDraftThumbnail(res));
          openGameInStudio({
            draftId: res.draftId,
            html: res.htmlPreview || null,
            gameUrl: res.gameUrl || null,
            title: res.title || "Untitled Dream",
            orientation: res.orientation,
          });
          await fetchDrafts();
        } else {
          const message = res.error || "Generation failed to load preview.";
          if (isMissingLocalFileDreamError(message)) {
            await clearPendingDreamJob();
            setErrorMsg(null);
            setPhase("idle");
            return;
          }
          setErrorMsg(message);
          await markPendingDreamJobFailed(message, pending?.jobId);
          if (phase === "generating") {
            ensureFallbackSpec(pending?.prompt || prompt);
            setPhase("refining");
          }
        }
      } catch (error: any) {
        if (cancelled) return;
        cancelRef.current = null;
        remoteCancelRef.current = null;
        resumingPendingJobRef.current = null;
        const friendlyMessage = formatDreamError(error, "generate");
        if (!friendlyMessage) {
          return;
        }
        const failedPrompt = pending?.prompt || prompt;
        if (failedPrompt && !prompt.trim()) {
          setPrompt(failedPrompt);
        }
        if (isMissingLocalFileDreamError(friendlyMessage)) {
          await clearPendingDreamJob();
          setErrorMsg(null);
          setPhase("idle");
          return;
        }
        setErrorMsg(friendlyMessage);
        await markPendingDreamJobFailed(friendlyMessage, pending?.jobId);
        if (phase === "generating") {
          ensureFallbackSpec(failedPrompt || prompt);
          setPhase("refining");
        }
      }
    };

    resumePendingDream();

    return () => {
      cancelled = true;
      if (resumeCancel) {
        resumingPendingJobRef.current = null;
        cancelRef.current = null;
        remoteCancelRef.current = null;
        resumeCancel();
      }
    };
  }, [
    isActive,
    phase,
    prompt,
    completePendingDreamJob,
    fetchDrafts,
    formatDreamError,
    applyGenerationStatus,
    clearPendingDreamJob,
    ensureFallbackSpec,
    markPendingDreamJobFailed,
    pendingJobId,
    writePendingDreamJobs,
  ]);

  // Orb animation during generation
  useEffect(() => {
    if (phase === "generating") {
      orbPulse.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.9, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      orbRotation.value = withRepeat(
        withTiming(360, { duration: 3000, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      orbPulse.value = withTiming(1);
      orbRotation.value = 0;
    }
  }, [phase]);

  // Step progression during generation
  useEffect(() => {
    if (phase !== "generating") return;
    if (generationProgress !== null) return;
    setActiveStep(0);
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev < GENERATION_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [phase, generationProgress]);

  useEffect(() => {
    if (!pendingJobId || !pendingBuildActive || phase === "generating") return;
    const interval = setInterval(() => {
      setStudioBuildTick((prev) => prev + 1);
    }, 2600);
    return () => clearInterval(interval);
  }, [pendingBuildActive, pendingJobId, phase]);

  // Completion watchdog: if applyGenerationStatus captured completion data
  // but the promise chain hasn't transitioned to preview yet, force it.
  useEffect(() => {
    if (phase !== "generating") {
      // Clear stale completion data when not generating
      completionDataRef.current = null;
      return;
    }
    if (!completionDataRef.current) return;
    const data = completionDataRef.current;
    // Give the normal promise chain 1.5s to handle it first
    const timeout = setTimeout(async () => {
      if (phase !== "generating" || !completionDataRef.current) return;
      console.log(
        "[Watchdog] Force-transitioning to the studio — promise chain may be stuck",
      );
      completionDataRef.current = null;
      try {
        await completePendingDreamJob(data.title, data.draftId);
      } catch (e) {
        /* ignore */
      }
      setGameConfig({});
      setEditableSlots([]);
      setActiveDraftThumbnail(null);
      openGameInStudio({
        draftId: data.draftId,
        html: data.htmlPreview || null,
        gameUrl: data.gameUrl || null,
        title: data.title,
        orientation: data.orientation,
      });
      fetchDrafts().catch(() => {});
    }, 1500);
    return () => clearTimeout(timeout);
  }, [
    phase,
    pendingJobStatus,
    generationProgress,
    completePendingDreamJob,
    fetchDrafts,
    openGameInStudio,
  ]);

  // Drive the chip marquee. Even rows drift left, odd rows drift right; when a
  // copy scrolls fully out we wrap by exactly one loop width for a seamless join.
  useEffect(() => {
    if (studioTab !== "create" || phase !== "idle") return;
    const interval = setInterval(() => {
      if (Date.now() < ideasPauseUntilRef.current) return;
      ideasTx.forEach((tx, rowIndex) => {
        const loopWidth = ideasLoopWidths.current[rowIndex];
        if (!loopWidth) return;
        const direction = rowIndex % 2 === 0 ? -1 : 1;
        const speed = rowIndex === 1 ? 0.5 : 0.75;
        let next = tx.value + direction * speed;
        if (next <= -loopWidth) next += loopWidth;
        else if (next >= 0) next -= loopWidth;
        tx.value = next;
      });
    }, 24);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioTab, phase]);

  const ideasRow0Style = useAnimatedStyle(() => ({
    transform: [{ translateX: ideasTx0.value }],
  }));
  const ideasRow1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: ideasTx1.value }],
  }));
  const ideasRow2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: ideasTx2.value }],
  }));
  const ideasRowStyles = [ideasRow0Style, ideasRow1Style, ideasRow2Style];

  const animatedOrbStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: orbPulse.value },
      { rotate: `${orbRotation.value}deg` } as any,
    ],
  }));

  // ======================
  // HANDLERS
  // ======================
  const handleGenreSelect = (genrePrompts: string[]) => {
    const randomPrompt =
      genrePrompts[Math.floor(Math.random() * genrePrompts.length)];
    setPrompt(randomPrompt);
    setErrorMsg(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleRetryJob = async () => {
    let retryJobId: string | null = null;
    try {
      setErrorMsg(null);
      setPendingJobStatus("running");
      const retryPrompt =
        prompt.trim() ||
        gameSpec?.description ||
        "Create a polished mobile game.";
      setPhase("generating");
      setGenerationProgress(null);
      setGenerationPhase(null);
      setGenerationStatusMessage(null);
      // A retry must rebuild in the same shape as the job it replaces, or a landscape build
      // silently comes back portrait.
      const retryOrientation = normalizeOrientation(
        pendingJobs.find((job) => job.jobId === pendingJobId)?.orientation ?? orientation,
      );
      const retryJob = ai.dream(retryPrompt, [], {
        orientation: retryOrientation,
        onJobStarted: (jobId: string) => {
          retryJobId = jobId;
          persistPendingDreamJob({ jobId, prompt: retryPrompt, labsMode, orientation: retryOrientation });
        },
        onStatus: (status: any) =>
          applyGenerationStatus({ ...status, jobId: status?.jobId || retryJobId }),
      });
      cancelRef.current = retryJob.cancel;
      remoteCancelRef.current = retryJob.cancelRemote;
      const res = (await retryJob.promise) as any;
      cancelRef.current = null;
      remoteCancelRef.current = null;
      if (res.success && (res.draftId || res.htmlPreview || res.gameUrl)) {
        setGenerationProgress(null);
        setGenerationPhase(null);
        setGenerationStatusMessage(null);
        if (res.htmlPreview || res.gameUrl) {
          await completePendingDreamJob(
            res.title || "Untitled Dream",
            res.draftId,
          );
          setGameConfig({});
          setEditableSlots([]);
          setActiveDraftThumbnail(getDraftThumbnail(res));
          openGameInStudio({
            draftId: res.draftId,
            html: res.htmlPreview || null,
            gameUrl: res.gameUrl || null,
            title: res.title || "Untitled Dream",
            orientation: res.orientation,
          });
          await fetchDrafts();
        }
      } else {
        setErrorMsg(res.error || "Generation failed");
        await markPendingDreamJobFailed(
          res.error || "Generation failed",
          retryJobId,
        );
        ensureFallbackSpec(prompt);
        setPhase("refining");
      }
    } catch (error: any) {
      cancelRef.current = null;
      remoteCancelRef.current = null;
      console.error("Retry failed:", error);
      const friendlyMessage =
        formatDreamError(error, "generate") ||
        "Failed to retry. Please try again.";
      await stopCookingNotificationOnly();
      setErrorMsg(friendlyMessage);
      await markPendingDreamJobFailed(friendlyMessage, retryJobId);
      ensureFallbackSpec(prompt);
      setPhase("refining");
    }
  };

  const getPendingJobTitle = useCallback((job: PendingDreamJob) => {
    const cleanedPrompt = job.prompt.trim().replace(/\s+/g, " ");
    return cleanedPrompt.length > 42
      ? `${cleanedPrompt.slice(0, 39)}...`
      : cleanedPrompt || "Untitled build";
  }, []);

  const getPendingJobStatusText = useCallback(
    (job: PendingDreamJob) => {
      if (job.status === "failed") return job.error || "Build failed";
      if (job.status === "canceled") return "Build stopped";
      const progress =
        typeof job.progress === "number" ? `${Math.round(job.progress)}%` : "";
      const detail =
        job.statusMessage ||
        (job.jobId === pendingJobId
          ? generationStatusMessage || activeStudioStep.text
          : "Forging in background");
      return progress ? `${progress} · ${detail}` : detail;
    },
    [activeStudioStep.text, generationStatusMessage, pendingJobId],
  );

  const handleReturnToForge = useCallback(() => {
    if (!pendingJobId) return;
    if (pendingBuildFailed) {
      setPhase("refining");
      return;
    }
    setErrorMsg(null);
    setPendingJobStatus("running");
    setPhase("generating");
  }, [pendingBuildFailed, pendingJobId]);

  const handleOpenPendingJob = useCallback(
    (job: PendingDreamJob) => {
      setPendingJobId(job.jobId);
      setPendingJobStatus(job.status);
      setGenerationProgress(job.progress);
      setGenerationPhase(job.phase);
      setGenerationStatusMessage(job.statusMessage);
      setPrompt((current) => current || job.prompt);
      if (job.status === "failed") {
        setErrorMsg(job.error || "Generation failed");
        setPhase("refining");
        return;
      }
      if (job.status !== "canceled") {
        setErrorMsg(null);
        setPhase("generating");
      }
    },
    [],
  );

  const handleDream = async (promptOverride?: string) => {
    if (!isAuthenticated) {
      showAuthScreen();
      return;
    }

    const finalPrompt = (promptOverride ?? prompt).trim();
    if (phase === "generating") return;
    if (!finalPrompt) {
      setErrorMsg("Write a quick brief first, or tap Surprise me.");
      inputRef.current?.focus();
      return;
    }

    setPhase("generating");
    setErrorMsg(null);
    setGenerationProgress(null);
    setGenerationPhase(null);
    setGenerationStatusMessage(null);
    let dreamJobId: string | null = null;

    try {
      const attachments = attachedAssets.map(
        ({
          type,
          role,
          url,
          thumb,
          thumbnail,
          title,
          label,
          instruction,
          duration,
        }) => ({
          type,
          role,
          url,
          thumb,
          thumbnail,
          title,
          label,
          instruction,
          duration,
        }),
      );
      const dreamOrientation = normalizeOrientation(orientation);
      const onJobStarted = (jobId: string) => {
        dreamJobId = jobId;
        persistPendingDreamJob({ jobId, prompt: finalPrompt, labsMode, orientation: dreamOrientation });
      };
      const { promise, cancel, cancelRemote } = ai.dream(
        finalPrompt,
        attachments,
        {
          orientation: dreamOrientation,
          onJobStarted,
          onStatus: (status: any) =>
            applyGenerationStatus({ ...status, jobId: status?.jobId || dreamJobId }),
        },
      );
      cancelRef.current = cancel;
      remoteCancelRef.current = cancelRemote;
      const res = (await promise) as any;
      cancelRef.current = null;
      remoteCancelRef.current = null;
      detachPendingDreamRef.current = false;
      if (res.success && (res.htmlPreview || res.gameUrl)) {
        await completePendingDreamJob(
          res.title || "Untitled Dream",
          res.draftId,
        );
        setGameConfig({});
        setEditableSlots([]);
        setActiveDraftThumbnail(getDraftThumbnail(res));
        openGameInStudio({
          draftId: res.draftId,
          html: res.htmlPreview || null,
          gameUrl: res.gameUrl || null,
          title: res.title || "Untitled Dream",
        });
        await fetchDrafts();
      } else {
        setErrorMsg(res.error || "Generation failed");
        await markPendingDreamJobFailed(
          res.error || "Generation failed",
          dreamJobId,
        );
        ensureFallbackSpec(finalPrompt);
        setPhase("refining");
      }
    } catch (error: any) {
      cancelRef.current = null;
      remoteCancelRef.current = null;
      const friendlyMessage = formatDreamError(error, "generate");
      if (!friendlyMessage) {
        if (detachPendingDreamRef.current) {
          detachPendingDreamRef.current = false;
          // If we have a spec, go back to refining; otherwise go to idle
          setPhase(gameSpec ? "refining" : "idle");
          return;
        }
        await stopCookingNotificationOnly();
        return;
      }
      detachPendingDreamRef.current = false;
      console.warn("AI Generation Warning:", error?.message || error);
      setErrorMsg(friendlyMessage);
      await markPendingDreamJobFailed(friendlyMessage, dreamJobId);
      ensureFallbackSpec(finalPrompt);
      setPhase("refining");
    }
  };

  const handleDreamComposerPress = async () => {
    if (!isAuthenticated) {
      showAuthScreen();
      return;
    }

    const finalPrompt = prompt.trim();
    if (!finalPrompt) {
      setErrorMsg("Write a quick brief first, or tap Surprise me.");
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    if (!orientation) {
      setErrorMsg("Pick a screen shape — portrait or landscape.");
      return;
    }
    setErrorMsg(null);
    Keyboard.dismiss();

    if (pendingJobId) {
      stopLocalDreamPolling();
    }

    // Forge It hands the brief (and any attached assets) to the Wish studio,
    // where Kimi pitches the game and the user taps "Create it" to build. A new
    // brief is a new game — drop any game the studio was last opened on.
    setStudioGame(null);
    setStudioPrompt(finalPrompt);
    setStudioOrientation(orientation);
    setStudioOpen(true);
    return;

    // Generate game spec
    setPhase("refining");
    setIsGeneratingSpec(true);
    setIsRefiningSpecMessage(false);
    setRefinementBrief(finalPrompt);
    setGameSpec(null);
    setConversationHistory([]);
    setAiMessage(null);
    hasAutoScrolledToSpecRef.current = false;

    try {
      const res = (await ai.generateSpec(finalPrompt)) as any;
      setIsGeneratingSpec(false);

      if (res.success && res.spec) {
        setGameSpec(res.spec);
        const introMessage = `I shaped this into ${res.spec.title}. You can tweak the idea here, or tap Create when it feels right.`;
        setAiMessage(introMessage);
        setConversationHistory([
          { role: "user", content: finalPrompt },
          { role: "ai", content: introMessage },
        ]);
      } else {
        // Show error and stay on refining screen
        Alert.alert("Oops", "Failed to generate game spec. Please try again.", [
          { text: "OK", onPress: () => setPhase("idle") },
        ]);
      }
    } catch (error) {
      console.error("Spec generation failed:", error);
      setIsGeneratingSpec(false);
      // Show error and stay on refining screen
      Alert.alert("Oops", "Spec generation timed out. Please try again.", [
        { text: "OK", onPress: () => setPhase("idle") },
      ]);
    }
  };

  const interpretEditIntent = useCallback(
    async (instructions: string) => {
      const fallbackIntent = buildFallbackEditIntent(instructions);
      try {
        const res = (await ai.interpretEdit({
          instructions,
          gameTitle,
          currentSummary: activeDraftFromList?.prompt || "",
        })) as any;
        return (res?.intent || fallbackIntent) as EditIntent;
      } catch (error) {
        console.warn("Edit interpretation failed:", error);
        return fallbackIntent;
      }
    },
    [activeDraftFromList?.prompt, gameTitle],
  );

  const handleModifySpec = async (modification: string) => {
    const userMessage = modification.trim();
    if (!userMessage || !gameSpec || isRefiningSpecMessage) return;

    const historyBeforeTurn =
      conversationHistory.length > 0
        ? conversationHistory
        : [
            { role: "user" as const, content: refinementBrief || prompt.trim() },
            {
              role: "ai" as const,
              content: `Current concept: ${gameSpec.title}. ${gameSpec.description} Features: ${gameSpec.features.join(", ")}`,
            },
          ];
    const optimisticHistory = [
      ...historyBeforeTurn,
      { role: "user" as const, content: userMessage },
    ];

    setWishInput("");
    setErrorMsg(null);
    setIsRefiningSpecMessage(true);
    setConversationHistory(optimisticHistory);

    if (pendingEditRequest) {
      const combinedInstructions = `${pendingEditRequest.instructions}. ${userMessage}`;
      const intent = await interpretEditIntent(combinedInstructions);
      const responseMessage =
        intent.question ||
        "Perfect. I’ll fold that into the edit.";
      setPendingEditRequest({
        ...pendingEditRequest,
        instructions: intent.finalInstruction || combinedInstructions,
      });
      setRefinementBrief(intent.summary || combinedInstructions);
      setEditIntent(intent);
      setGameSpec(buildEditRefinementSpec(intent.summary || combinedInstructions));
      setAiMessage(responseMessage);
      setConversationHistory([
        ...optimisticHistory,
        { role: "ai", content: responseMessage },
      ]);
      setIsRefiningSpecMessage(false);
      return;
    }

    try {
      const res = (await ai.refineSpec(historyBeforeTurn, userMessage)) as any;
      setIsRefiningSpecMessage(false);

      if (res.success && res.spec) {
        setGameSpec(res.spec);
        const responseMessage =
          res.aiMessage || res.question || "Updated the concept.";
        setAiMessage(responseMessage);
        setConversationHistory([
          ...optimisticHistory,
          { role: "ai", content: responseMessage },
        ]);
      } else {
        setConversationHistory(historyBeforeTurn);
        setErrorMsg(
          res.error || "Could not refine the concept. Please try again.",
        );
      }
    } catch (error: any) {
      console.error("Spec modification failed:", error);
      setIsRefiningSpecMessage(false);
      setConversationHistory(historyBeforeTurn);
      setErrorMsg(
        error?.message || "Could not refine the concept. Please try again.",
      );
    }
  };

  const applyEditRequest = useCallback(
    async (editRequest: PendingEditRequest, finalInstructions: string) => {
      setPhase("generating");
      setErrorMsg(null);

      try {
        const { promise, cancel } = ai.edit(
          editRequest.draftId,
          finalInstructions,
          editRequest.newAsset,
          editRequest.attachments,
        );
        cancelRef.current = cancel;
        const res = (await promise) as any;
        cancelRef.current = null;
        if (res.success && (res.htmlPreview || res.gameUrl)) {
          setActiveDraftThumbnail(
            res.draftId ? getDraftThumbnail(res) : null,
          );
          setPendingEditRequest(null);
          setEditIntent(null);
          openGameInStudio({
            draftId: res.draftId || editRequest.draftId,
            html: res.htmlPreview || null,
            gameUrl: res.gameUrl || null,
            title: gameTitle || "Untitled Game",
            orientation: res.orientation,
          });
          await fetchDrafts();
        } else {
          throw new Error(res.error || "Failed to modify game.");
        }
      } catch (err: any) {
        cancelRef.current = null;
        const friendlyMessage = formatDreamError(err, "edit");
        setErrorMsg(friendlyMessage || "Failed to modify game.");
        setPhase("refining");
      }
    },
    [fetchDrafts, formatDreamError, gameTitle, openGameInStudio],
  );

  const handleStartBuilding = () => {
    if (!gameSpec) return;

    // Build enriched prompt with spec
    const basePrompt = refinementBrief.trim() || prompt;
    const enrichedPrompt = `${basePrompt}

Title: ${gameSpec.title}
Description: ${gameSpec.description}
    Features: ${gameSpec.features.join(", ")}`;

    if (pendingEditRequest) {
      applyEditRequest(
        pendingEditRequest,
        editIntent?.finalInstruction ||
          refinementBrief.trim() ||
          pendingEditRequest.instructions,
      );
      return;
    }

    handleDream(enrichedPrompt);
  };

  const handleBackFromRefinement = () => {
    // Abandoning an edit returns to the game it was an edit of — which now
    // lives in the studio — otherwise back to Dream Forge.
    const editedDraftId = pendingEditRequest?.draftId || activeDraftId;
    const shouldReturnToPreview = Boolean(
      pendingEditRequest && editedDraftId && (activeHtml || activeGameUrl),
    );
    if (shouldReturnToPreview) {
      openGameInStudio({
        draftId: editedDraftId!,
        html: activeHtml,
        gameUrl: activeGameUrl,
        title: gameTitle || "Untitled Game",
      });
    } else {
      setPhase("idle");
    }
    setPendingEditRequest(null);
    setEditIntent(null);
    setRefinementBrief("");
    if (!shouldReturnToPreview) {
      setGameSpec(null);
    }
    setWishInput("");
    setConversationHistory([]);
    setAiMessage(null);
    setIsRefiningSpecMessage(false);
    hasAutoScrolledToSpecRef.current = false;
  };

  // Auto-scroll to Create button when spec is ready
  useEffect(() => {
    if (
      gameSpec &&
      !isGeneratingSpec &&
      phase === "refining" &&
      !hasAutoScrolledToSpecRef.current
    ) {
      hasAutoScrolledToSpecRef.current = true;
      // Small delay to ensure layout is complete
      setTimeout(() => {
        refiningScrollRef.current?.scrollTo({ y: 300, animated: true });
      }, 300);
    }
  }, [gameSpec, isGeneratingSpec, phase]);

  const handleDeleteDraft = (draftId: string, title?: string) => {
    Alert.alert(
      "Delete draft?",
      `Remove ${title || "this draft"} from your drafts? This can’t be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await ai.deleteDraft(draftId);
              setDrafts((prev) => prev.filter((d) => d.id !== draftId));
              if (activeDraftId === draftId) {
                handleRegenerate();
              }
            } catch (e) {
              console.error("Failed to delete draft:", e);
              Alert.alert("Couldn’t delete draft", "Please try again.");
            }
          },
        },
      ],
    );
  };

  // === TOOL OPTIONS ===
  const COLOR_PALETTES = [
    {
      name: "Neon",
      bg: "#000",
      colors: ["#FF00FF", "#00FFFF", "#39FF14"],
      instruction:
        "Change the entire color scheme to vibrant neon: magenta, cyan, neon green. Use black backgrounds with glow effects.",
    },
    {
      name: "Sunset",
      bg: "#2A1B38",
      colors: ["#FF6B6B", "#FF8E53", "#FFD93D"],
      instruction:
        "Change the entire color scheme to warm sunset tones: coral reds, burnt orange, golden yellow.",
    },
    {
      name: "Ocean",
      bg: "#0F2027",
      colors: ["#0077B6", "#00B4D8", "#CAF0F8"],
      instruction:
        "Change the color scheme to ocean tones: deep blue, cyan, ice white.",
    },
    {
      name: "Pastel",
      bg: "#FDFBF7",
      colors: ["#FFB5E8", "#B5DEFF", "#BAFFC9"],
      instruction:
        "Change the color scheme to soft pastels: pink, baby blue, mint green.",
    },
    {
      name: "Dark Mode",
      bg: "#0D0D10",
      colors: ["#E94560", "#A855F7", "#3B82F6"],
      instruction:
        "Change the color scheme to sleek dark mode with neon accents.",
    },
    {
      name: "Retro 80s",
      bg: "#10002b",
      colors: ["#F72585", "#7209B7", "#4CC9F0"],
      instruction:
        "Change the color scheme to synthwave retro: hot pink, deep purple, electric blue.",
    },
  ];

  /* FREESOUND AUDIO LOADED DYNAMICALLY VIA API */

  /* COMMUNITY VIDEOS LOADED DYNAMICALLY VIA API */

  /* GIPHY ASSETS ARE LOADED DYNAMICALLY VIA API */

  const OPTIONS_FEATURES = [
    {
      id: "cam",
      icon: "videocam",
      label: "Live Camera",
      desc: "Streams camera feed as game background.",
      instruction:
        "Add HTML5 camera feed using navigator.mediaDevices.getUserMedia and render it as the game canvas background.",
    },
    {
      id: "mic",
      icon: "mic",
      label: "Microphone Audio Input",
      desc: "Captures mic for voice-driven gameplay.",
      instruction:
        "Use navigator.mediaDevices.getUserMedia for the microphone, extract the volume/frequency, and use it for a core game mechanic.",
    },
    {
      id: "gyro",
      icon: "compass",
      label: "Tilt / Gyroscope Control",
      desc: "Uses phone gyroscope for movement.",
      instruction:
        "Capture deviceorientation events and bind alpha/beta/gamma to player movement instead of touch.",
    },
    {
      id: "haptic",
      icon: "radio",
      label: "Haptic Feedback",
      desc: "Triggers vibrations on key events.",
      instruction:
        "Add navigator.vibrate() calls: short on jump, medium on score, long burst on collision or game over.",
    },
  ];

  const MODIFY_OPTIONS = [
    {
      label: "Add 3 Levels",
      icon: "layers",
      instruction:
        "Add 3 progressively harder levels to this game. Each level should increase difficulty.",
    },
    {
      label: "Make it Harder",
      icon: "trending-up",
      instruction:
        "Increase the overall difficulty: faster speeds, tighter timing, more obstacles.",
    },
    {
      label: "Make it Easier",
      icon: "trending-down",
      instruction:
        "Decrease difficulty: slower speeds, more forgiving timing, fewer obstacles.",
    },
    {
      label: "Add Power-ups",
      icon: "flash",
      instruction:
        "Add 3 collectible power-ups: shield, speed boost, and double points.",
    },
    {
      label: "Add Animations",
      icon: "sparkles",
      instruction:
        "Add smooth animations: screen shake on collision, particle effects on score, bouncy transitions.",
    },
  ];

  // === UGC HANDLERS ===
  // Paginated loader for the community video pool. `reset` starts from page 0
  // (fresh open / prefetch); otherwise it appends the next page (infinite scroll).
  // Falls back gracefully if the backend doesn't paginate (no `hasMore` → one page).
  const loadVideos = useCallback(async (reset = false) => {
    if (videosLoadingRef.current) return;
    if (!reset && !videosHasMoreRef.current) return;
    videosLoadingRef.current = true;
    const offset = reset ? 0 : videosOffsetRef.current;
    if (reset) setVideosInitialLoading(true);
    else setVideosLoadingMore(true);
    try {
      const res = await fetch(
        `${API_URL}/assets/trending?type=video&limit=${VIDEOS_PAGE_SIZE}&offset=${offset}`,
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.assets)) {
        setCommunityVideos((prev) =>
          reset ? data.assets : [...prev, ...data.assets],
        );
        // Warm the RN image cache for this page's covers so the tiles paint
        // instantly instead of downloading each one when they scroll into view.
        data.assets.forEach((a: any) => {
          const cover = a.thumbnail || a.thumb;
          if (cover) Image.prefetch(cover).catch(() => {});
        });
        videosOffsetRef.current = offset + data.assets.length;
        // If the backend omits `hasMore` (old build), assume the one response is
        // the whole list so we don't loop requesting more.
        videosHasMoreRef.current =
          typeof data.hasMore === "boolean"
            ? data.hasMore
            : false;
      }
    } catch (e) {
      // Keep whatever we already have; the user can retry by reopening.
      console.warn("Failed to load videos:", (e as any)?.message || e);
    } finally {
      videosLoadingRef.current = false;
      setVideosInitialLoading(false);
      setVideosLoadingMore(false);
    }
  }, []);

  const fetchCommunityAssets = async (type: string) => {
    try {
      const res = await fetch(`${API_URL}/assets/trending?type=${type}`);
      const data = await res.json();
      if (data.success && data.assets) {
        if (type === "video") setCommunityVideos(data.assets);
        else if (type === "bgm" || type === "sfx")
          setCommunityAudios(data.assets);
        else if (type === "image") setCommunityPhotos(data.assets);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const fetchGiphy = async (
    type: "gifs" | "stickers",
    query: string = "",
    offset: number = 0,
  ) => {
    if (offset === 0) setIsGiphyLoading(true);
    else setIsGiphyLoadingMore(true);

    try {
      const endpoint = query.trim() ? "search" : "trending";
      const GIPHY_API_KEY = "SwEhCBr38RpeNNffpxmtsZK9Umum8edV";
      const qParam = query.trim() ? `&q=${encodeURIComponent(query)}` : "";
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

      if (type === "gifs") {
        setGiphyResults((prev) =>
          offset === 0 ? formatted : [...prev, ...formatted],
        );
      } else {
        setGiphyStickers((prev) =>
          offset === 0 ? formatted : [...prev, ...formatted],
        );
      }
    } catch (error) {
      console.warn("Error fetching Giphy:", error);
    } finally {
      setIsGiphyLoading(false);
      setIsGiphyLoadingMore(false);
    }
  };

  const fetchFreesound = async (
    type: "bgm" | "sfx",
    query: string = "",
    offset: number = 1,
  ) => {
    if (offset === 1) setIsFreesoundLoading(true);
    else setIsFreesoundLoadingMore(true);

    try {
      const FREESOUND_API_KEY = "mgD2q6sEgb7r8seRdGqRVBgszcAgMqPAzGpHPAkk";
      const actualQuery =
        query.trim() || (type === "bgm" ? "game music loop" : "game effect UI");
      const filter =
        type === "bgm"
          ? "&filter=duration:[10.0 TO 300.0]"
          : "&filter=duration:[0.1 TO 15.0]";
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
          url:
            item.previews["preview-hq-mp3"] || item.previews["preview-lq-mp3"],
          duration: `${mins < 10 ? "0" + mins : mins}:${secs < 10 ? "0" + secs : secs}`,
          instruction:
            type === "bgm"
              ? `Set the game background music to this URL: ${item.previews["preview-hq-mp3"] || item.previews["preview-lq-mp3"]}`
              : `Add a sound effect using this URL: ${item.previews["preview-hq-mp3"] || item.previews["preview-lq-mp3"]}`,
        };
      });

      if (type === "bgm") {
        setFreesoundBgm((prev) =>
          offset === 1 ? formatted : [...prev, ...formatted],
        );
      } else {
        setFreesoundSfx((prev) =>
          offset === 1 ? formatted : [...prev, ...formatted],
        );
      }
    } catch (error) {
      console.warn("Error fetching Freesound:", error);
    } finally {
      setIsFreesoundLoading(false);
      setIsFreesoundLoadingMore(false);
    }
  };

  const stopAudioPreview = useCallback(async () => {
    const sound = audioPreviewRef.current;
    audioPreviewRef.current = null;
    setPlayingAudioUrl(null);
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch (err) {
        console.warn("Could not stop audio preview:", err);
      }
    }
  }, []);

  const playAudioPreview = useCallback(
    async (item: any) => {
      const url = item?.url;
      if (!url) return;

      if (playingAudioUrl === url) {
        await stopAudioPreview();
        return;
      }

      await stopAudioPreview();
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true, volume: 1.0 },
        );
        audioPreviewRef.current = sound;
        setPlayingAudioUrl(url);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            stopAudioPreview();
          }
        });
      } catch (err) {
        console.warn("Could not play audio preview:", err);
        setPlayingAudioUrl(null);
      }
    },
    [playingAudioUrl, stopAudioPreview],
  );

  useEffect(() => {
    // Load the first page once and keep it — reopens are instant, more pages
    // stream in on scroll.
    if (showVideosModal && communityVideos.length === 0) loadVideos(true);
  }, [showVideosModal, communityVideos.length, loadVideos]);

  useEffect(() => {
    if (showAudioModal) fetchCommunityAssets(audioTab);
  }, [showAudioModal, audioTab]);

  useEffect(() => {
    if (!showAudioModal) {
      stopAudioPreview();
    }
  }, [showAudioModal, stopAudioPreview]);

  useEffect(() => {
    return () => {
      stopAudioPreview();
    };
  }, [stopAudioPreview]);

  // Pre-load trending Giphy and Freesound results silently in the background
  useEffect(() => {
    fetchGiphy("gifs", "");
    fetchGiphy("stickers", "");
    fetchFreesound("bgm", "");
    fetchFreesound("sfx", "");
  }, []);

  // Warm the community video pool the moment the Create screen is opened (before
  // the user ever taps the video button), so the picker is already populated —
  // and retried on each open if an earlier attempt came back empty.
  useEffect(() => {
    if (isActive && communityVideos.length === 0) loadVideos(true);
  }, [isActive, communityVideos.length, loadVideos]);

  useEffect(() => {
    if (showPhotosModal) {
      fetchCommunityAssets("image");
    }
  }, [showPhotosModal]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => {
        setKeyboardVisible(true);
        setKeyboardHeight(event.endCoordinates?.height || 0);
      },
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      },
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleAssetUpload = async (type: "video" | "bgm" | "sfx" | "image") => {
    try {
      let result: any;
      if (type === "video" || type === "image") {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            type === "video"
              ? ImagePicker.MediaTypeOptions.Videos
              : ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.8,
        });
      }
      if (result.canceled || !result.assets || result.assets.length === 0)
        return;
      setIsUploadingAsset(true);
      const asset = result.assets[0];
      const formData = new FormData();
      const fileUri = asset.uri;
      const fileName = fileUri.split("/").pop() || "upload.mp4";
      formData.append("file", {
        uri: fileUri,
        name: fileName,
        type: "multipart/form-data",
      } as any);
      formData.append("type", type);
      formData.append("title", "Community Upload");
      const token = await getToken();
      const uploadRes = await fetch(`${API_URL}/assets/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      setIsUploadingAsset(false);
      if (uploadData.success && (uploadData.url || uploadData.asset?.url)) {
        const finalUrl = uploadData.asset?.url || uploadData.url;
        const uploadedItem = { url: finalUrl, type, thumb: finalUrl };
        if (type === "video") {
          setShowVideosModal(false);
          handleAssetSelect(
            uploadedItem,
            `Add a full-screen looping background video: ${finalUrl}`,
          );
        } else if (type === "bgm" || type === "sfx") {
          setShowAudioModal(false);
          handleAssetSelect(
            uploadedItem,
            `Inject this audio URL into the game: ${finalUrl}`,
          );
        } else if (type === "image") {
          setShowCommunityImagesModal(false);
          handleAssetSelect(uploadedItem, `Use this image: ${finalUrl}`);
        }
        // Refresh community pool silently so it's ready next time
        fetchCommunityAssets(type);
      } else {
        Alert.alert("Upload Failed", uploadData.error || "Failed");
      }
    } catch (e: any) {
      console.log(e?.message || e);
      setIsUploadingAsset(false);
      Alert.alert("Error", "Asset upload failed");
    }
  };

  const handleGeneratePhoto = () => setShowImageModal(true);
  const handleSounds = () => setShowSoundsModal(true);
  const runCreateAction = useCallback(
    (action: () => void) => {
      if (errorMsg) {
        setErrorMsg(null);
      }
      action();
    },
    [errorMsg],
  );

  const submitImageGeneration = async () => {
    if (!imagePromptText.trim()) return;
    setIsGeneratingImage(true);
    try {
      const result = await ai.generateAsset(imagePromptText);
      if (result && ((result as any).base64 || (result as any).imageUrl)) {
        setGeneratedImageUri(
          (result as any).base64 || (result as any).imageUrl,
        );
        // Silently refresh the community image pool, since the backend just added this AI image globally
        fetchCommunityAssets("image");
      }
    } catch (e) {
      Alert.alert("Error", "Image generation failed");
    }
    setIsGeneratingImage(false);
  };

  const handleCancel = async () => {
    detachPendingDreamRef.current = false;
    const jobIdToCancel = pendingJobId;
    stopLocalDreamPolling();
    if (jobIdToCancel) {
      try {
        await stopRemoteDreamJob(jobIdToCancel);
      } catch (error: any) {
        console.warn(
          "[DreamStream] Backend cancel failed:",
          error?.message || error,
        );
      }
    } else {
      try {
        await stopRemoteDreamJob(null);
      } catch (error: any) {
        console.warn(
          "[DreamStream] Remote cancel failed:",
          error?.message || error,
        );
      }
    }
    await clearPendingDreamJob();
    setPhase("idle");
  };

  const normalizeAttachmentType = (type: string | undefined) => {
    const normalized = String(type || "")
      .trim()
      .toLowerCase();
    switch (normalized) {
      case "photo":
      case "gif":
      case "sticker":
        return "image";
      case "music":
        return "bgm";
      case "audio":
        return "sfx";
      default:
        return normalized || "image";
    }
  };

  const inferAttachmentRole = (type: string): AttachmentRole => {
    switch (normalizeAttachmentType(type)) {
      case "video":
        return "background";
      case "bgm":
        return "bgm";
      case "sfx":
        return "sfx";
      default:
        return "hero";
    }
  };

  const getRoleOptionsForType = (type: string) => {
    return (
      ATTACHMENT_ROLE_OPTIONS[normalizeAttachmentType(type)] ||
      ATTACHMENT_ROLE_OPTIONS.image
    );
  };

  const buildAssetInstruction = (
    attachment: StructuredAttachment,
    role: AttachmentRole,
    note: string,
  ) => {
    const url = attachment.url;
    const title = attachment.title || attachment.label || "selected asset";
    const trimmedNote = note.trim();

    const roleInstruction = (() => {
      switch (role) {
        case "hero":
          return `Use this ${attachment.type} as the main hero object or focal visual in the experience: ${url}`;
        case "background":
          return `Use this ${attachment.type} as the main background or atmospheric scene layer: ${url}`;
        case "overlay":
          return `Use this ${attachment.type} as an overlay, meme, sticker, decal, or reaction layer: ${url}`;
        case "panel":
          return `Use this ${attachment.type} inside a framed panel, screen, card, or in-world display: ${url}`;
        case "prop":
          return `Use this ${attachment.type} as a prop, collectible, ingredient, tool, or object the player interacts with: ${url}`;
        case "bgm":
          return `Use this audio as the main looping background music: ${url}`;
        case "sfx":
          return `Use this audio as a triggered sound effect or moment cue: ${url}`;
        case "reference":
        default:
          return `Use this ${attachment.type} as a style or content reference when building the experience: ${url}`;
      }
    })();

    return trimmedNote
      ? `${roleInstruction}. User note for "${title}": ${trimmedNote}`
      : roleInstruction;
  };

  const toStructuredAttachment = (
    item: any,
    fallbackInstruction: string,
  ): StructuredAttachment => ({
    type: normalizeAttachmentType(item?.type),
    role: inferAttachmentRole(item?.type),
    url: String(item?.url || "").trim(),
    thumb: item?.thumb || item?.thumbnail || item?.url,
    thumbnail: item?.thumbnail || item?.thumb || item?.url,
    title: item?.title || item?.label || "",
    label: item?.label || item?.title || "",
    instruction: String(item?.instruction || fallbackInstruction || "").trim(),
    duration: item?.duration || "",
  });

  const openAssetIntentModal = (
    attachment: StructuredAttachment,
    index: number | null = null,
  ) => {
    const defaultRole = attachment.role || inferAttachmentRole(attachment.type);
    setPendingAssetIntent({ ...attachment, role: defaultRole });
    setAssetIntentRole(defaultRole);
    setAssetIntentText("");
    setAssetPreviewMuted(true);
    setAssetIntentShowInstruction(false);
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
      instruction: buildAssetInstruction(
        pendingAssetIntent,
        assetIntentRole,
        assetIntentText,
      ),
    };

    if (editingAttachedAssetIndex !== null) {
      setAttachedAssets((prev) =>
        prev.map((asset, index) =>
          index === editingAttachedAssetIndex ? finalizedAttachment : asset,
        ),
      );
    } else if (!activeDraftId) {
      setAttachedAssets((prev) => {
        const existingIndex = prev.findIndex(
          (asset) => asset.url === finalizedAttachment.url,
        );
        if (existingIndex >= 0) {
          return prev.map((asset, index) =>
            index === existingIndex ? finalizedAttachment : asset,
          );
        }
        return [...prev, finalizedAttachment];
      });
    } else {
      handleEdit(finalizedAttachment.instruction, undefined, [
        finalizedAttachment,
      ]);
    }

    setShowAssetIntentModal(false);
    setPendingAssetIntent(null);
    setAssetIntentText("");
    setEditingAttachedAssetIndex(null);
  };

  const handleEdit = async (
    instructionsText: string,
    newAsset?: { key: string; base64: string },
    attachments: StructuredAttachment[] = [],
  ) => {
    const instructions = instructionsText.trim();
    if (!instructions) return;

    if (!activeDraftId) {
      if (attachments.length > 0) {
        setAttachedAssets((prev) => {
          const existingUrls = new Set(prev.map((asset) => asset.url));
          const unique = attachments.filter(
            (asset) => asset.url && !existingUrls.has(asset.url),
          );
          return unique.length > 0 ? [...prev, ...unique] : prev;
        });
      }
      setPrompt(
        (prev) =>
          prev + (prev ? "\n" : "") + `[Edit Requested: ${instructions}]`,
      );
      return;
    }

    const editRequest: PendingEditRequest = {
      draftId: activeDraftId,
      instructions,
      newAsset,
      attachments,
    };

    setPendingEditRequest(editRequest);
    setRefinementBrief(instructions);
    setPhase("refining");
    setIsGeneratingSpec(true);
    setIsRefiningSpecMessage(false);
    setGameSpec(null);
    setEditIntent(null);
    setConversationHistory([{ role: "user", content: instructions }]);
    setAiMessage(null);
    setErrorMsg(null);
    hasAutoScrolledToSpecRef.current = false;

    const intent = await interpretEditIntent(instructions);
    setIsGeneratingSpec(false);
    const nextRequest = {
      ...editRequest,
      instructions: intent.finalInstruction || instructions,
    };
    const introMessage =
      intent.question ||
      "I understand the edit. Add details if you want, or apply it now.";
    setPendingEditRequest(nextRequest);
    setEditIntent(intent);
    setRefinementBrief(intent.summary || instructions);
    setGameSpec(buildEditRefinementSpec(intent.summary || instructions));
    setConversationHistory([
      { role: "user", content: instructions },
      { role: "ai", content: introMessage },
    ]);
    setAiMessage(introMessage);
  };

  const handleRegenerate = async () => {
    detachPendingDreamRef.current = false;
    stopLocalDreamPolling();
    await clearPendingDreamJob();
    setPendingEditRequest(null);
    setEditIntent(null);
    setRefinementBrief("");
    setActiveHtml(null);
    setActiveGameUrl(null);
    setActiveDraftId(null);
    setActiveDraftThumbnail(null);
    setGameTitle("");
    setGameConfig({});
    setEditableSlots([]);
    setErrorMsg(null);
    setStudioGame(null);
    setPhase("idle");
  };

  const handleIntentClose = (
    actionType: "discard" | "closeApp" = "closeApp",
  ) => {
    if (phase === "generating") {
      detachPendingDreamRef.current = true;
      stopLocalDreamPolling();
      // Drop local polling but keep the backend job alive and resumable.
      if (actionType === "closeApp") onClose();
      else setPhase("idle");
      return;
    }

    if (pendingJobId) {
      if (actionType === "closeApp") onClose();
      else setPhase("idle");
      return;
    }

    // Nothing live to lose here any more — the game itself lives in the studio,
    // which guards its own exit.
    if (actionType === "closeApp") onClose();
    else handleRegenerate();
  };

  const handleConfirmExit = () => {
    const action = showExitConfirm;
    setShowExitConfirm(null);
    handleRegenerate();
    if (action === "closeApp") onClose();
  };

  const [isPublishing, setIsPublishing] = useState(false);
  // Publish can be reached from the Wish studio or from the draft editor. Back
  // should return where you came from, not strand you in the other one.
  const [publishCameFromStudio, setPublishCameFromStudio] = useState(false);
  // Publish is an overlay, not a phase: swapping phases remounts the whole
  // tree and would wipe the Wish studio's live session.
  const [publishOpen, setPublishOpen] = useState(false);
  // Bumped when returning to the studio, carrying the tab to land on.
  const [studioReopenNonce, setStudioReopenNonce] = useState(0);
  const [studioReopenTab, setStudioReopenTab] = useState<"wish" | "preview">("preview");

  const handlePublish = async () => {
    if (!activeDraftId) {
      Alert.alert("Error", "No draft to publish. Please create a game first.");
      return;
    }
    if (!gameTitle.trim()) {
      Alert.alert(
        "Missing Name",
        "Please give your game a name before posting.",
      );
      return;
    }
    setIsPublishing(true);
    try {
      // Send HTML if we have it (needed for templates that don't exist in ai_games table yet)
      const res = await ai.publish(
        activeDraftId,
        gameTitle.trim(),
        privacySetting,
        activeHtml || undefined,
      );
      if (res.success) {
        console.log("✅ LIVE! Game pushed to Feed:", res.gameId);
        Alert.alert("🎉 Game Posted!", "Your game is now live on GameTOK!", [
          {
            text: "Let's Go",
            onPress: () => {
              // The game shipped — tear down the whole create stack (Publish,
              // the studio behind it, then Dream Forge) so "Let's Go" lands on
              // the feed instead of the studio it was launched from.
              setPublishOpen(false);
              setPublishCameFromStudio(false);
              setStudioOpen(false);
              handleRegenerate();
              onClose();
            },
          },
        ]);
      } else {
        Alert.alert(
          "Publish Failed",
          res.error || "Something went wrong. Please try again.",
        );
      }
    } catch (e: any) {
      console.error("Publish error:", e?.message || e);
      // Not a failure so much as a rule: an untouched remix is just someone else's game.
      if (e?.code === "REMIX_UNCHANGED") {
        Alert.alert(
          "Change something first",
          "This remix is still identical to the original. Tap “Edit game” and make at least one change before posting it as yours.",
        );
      } else {
        Alert.alert(
          "Publish Failed",
          e?.message || "Something went wrong. Please try again.",
        );
      }
    } finally {
      setIsPublishing(false);
    }
  };


  const renderPublishScreen = () => {
    if (!publishOpen || !(activeHtml || activeGameUrl)) return null;
    // One exclusive choice — rendered as radio rows, not three separate toggles.
    const PRIVACY_OPTIONS: Array<{
      key: string;
      label: string;
      sub: string;
      icon: keyof typeof Ionicons.glyphMap;
    }> = [
      { key: "public", label: "Public games", sub: "Anyone can play and remix", icon: "people" },
      { key: "play_only", label: "Public for play only", sub: "Anyone can play but not remix", icon: "eye" },
      { key: "private", label: "Only me", sub: "Only visible to me", icon: "lock-closed" },
    ];

    // Back out of publishing. The studio never closed — it is sitting right
    // behind this modal — so this is a single slide down onto it. Backing out
    // lands on the game preview; only "Edit game" asks for the conversation.
    // (publishCameFromStudio stays set: flipping it would move this modal's
    // mount point mid-dismiss and eat the animation.)
    const leavePublish = (target: "wish" | "preview" = "preview") => {
      setPublishOpen(false);
      if (publishCameFromStudio) {
        setStudioReopenTab(target);
        setStudioReopenNonce((n) => n + 1);
      }
    };

    return (
      <Modal
        visible
        animationType="slide"
        onRequestClose={() => leavePublish("preview")}
        presentationStyle="fullScreen"
      >
      <Animated.View
        entering={FadeIn.duration(260)}
        style={[styles.screen, { paddingTop: insets.top }]}
      >
        <View style={styles.previewTopBar}>
          <Pressable style={styles.closeBtn} onPress={() => leavePublish("preview")}>
            <Ionicons name="chevron-back" size={22} color={pal.text} />
          </Pressable>
          <Text style={styles.pubHeaderTitle}>Publish Game</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: sp.xl, paddingBottom: sp.huge }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Live game preview. The edit affordance sits BELOW the card so it
              never covers the game's own HUD. */}
          <View style={{ alignItems: "center", marginBottom: sp.xxl }}>
            <View
              style={[
                styles.pubPreviewCard,
                studioOrientation === "landscape" && styles.pubPreviewCardLandscape,
              ]}
            >
              <WebView
                source={activeGameUrl ? { uri: activeGameUrl } : { html: activeHtml!, baseUrl: PREVIEW_BASE_URL }}
                style={{ flex: 1, backgroundColor: pal.black }}
                scrollEnabled={false}
                javaScriptEnabled={true}
                originWhitelist={["*"]}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={true}
                setSupportMultipleWindows={false}
                injectedJavaScript={MUTE_WEBVIEW_JS}
              />
            </View>
            <Pressable style={styles.pubEditBtn} onPress={() => leavePublish("wish")} hitSlop={8}>
              <Ionicons name="create-outline" size={15} color={pal.purpleSoft} />
              <Text style={styles.pubEditText}>Edit game</Text>
            </Pressable>
          </View>

          <Text style={styles.pubLabel}>GAME NAME</Text>
          <TextInput
            style={styles.pubInput}
            placeholder="Enter your game's name"
            placeholderTextColor={pal.textGhost}
            value={gameTitle}
            onChangeText={setGameTitle}
            maxLength={60}
          />

          <Text style={styles.pubLabel}>PRIVACY</Text>
          <View style={styles.pubCard}>
            {PRIVACY_OPTIONS.map((opt, index) => {
              const active = privacySetting === opt.key;
              return (
                <React.Fragment key={opt.key}>
                  {index > 0 && <View style={styles.pubDivider} />}
                  <Pressable
                    style={styles.pubRow}
                    onPress={() => setPrivacySetting(opt.key as any)}
                  >
                    <View style={[styles.pubRowIcon, active && styles.pubRowIconActive]}>
                      <Ionicons
                        name={opt.icon}
                        size={19}
                        color={active ? pal.purpleSoft : pal.textDim}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pubRowLabel, active && { color: pal.text }]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.pubRowSub}>{opt.sub}</Text>
                    </View>
                    <View style={[styles.pubRadio, active && styles.pubRadioActive]}>
                      {active && <Ionicons name="checkmark" size={14} color={pal.black} />}
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </View>

          <Text style={styles.pubTerms}>
            By creating a game, you agree to GameTok's{" "}
            <Text style={{ color: pal.purpleSoft }}>Terms</Text>.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.pubPostBtn,
              isPublishing && styles.pubPostBtnDisabled,
              pressed && !isPublishing && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing ? (
              <ActivityIndicator size="small" color={pal.text} />
            ) : (
              <Ionicons name="rocket" size={18} color={pal.text} />
            )}
            <Text style={styles.pubPostText}>
              {isPublishing ? "Posting..." : "Post Game"}
            </Text>
          </Pressable>
        </ScrollView>

      </Animated.View>
      </Modal>
    );
  };

  const renderSharedModals = () => (
    <>
      {/* Reached from the draft editor: Publish presents over the preview. */}
      {!publishCameFromStudio && renderPublishScreen()}
      {/* Forge It → the Wish studio: Kimi pitches, user creates, game goes live. */}
      <WishStudioScreen
        visible={studioOpen}
        onClose={() => setStudioOpen(false)}
        initialPrompt={studioPrompt}
        initialGame={studioGame}
        initialAttachments={attachedAssets}
        initialOrientation={studioOrientation}
        reopenNonce={studioReopenNonce}
        reopenTab={studioReopenTab}
        onRequestPublish={({ draftId, html, gameUrl, title }) => {
          // Hand the studio's finished game to the original Publish Game screen
          // (live preview + privacy settings + Post Game). The studio stays open
          // underneath so Publish slides straight over it — one animation, and
          // Dream Forge never flashes in between.
          setActiveDraftId(draftId);
          setActiveHtml(html);
          setActiveGameUrl(gameUrl);
          if (title) setGameTitle(title);
          setPublishCameFromStudio(true);
          setPublishOpen(true);
        }}
      >
        {/* Reached from the studio: Publish presents over the studio itself. */}
        {publishCameFromStudio && renderPublishScreen()}
      </WishStudioScreen>

      <Modal
        visible={showAssetIntentModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowAssetIntentModal(false);
          setPendingAssetIntent(null);
          setEditingAttachedAssetIndex(null);
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.85)",
              justifyContent: "center",
              alignItems: "center",
              padding: 24,
            }}
            onPress={() => {
              setShowAssetIntentModal(false);
              setPendingAssetIntent(null);
              setEditingAttachedAssetIndex(null);
            }}
          >
          <Animated.View
            entering={FadeInUp.duration(220)}
            style={{
              width: "100%",
              maxWidth: 380,
              maxHeight: "88%",
              backgroundColor: "#141416",
              borderRadius: 28,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
            }}
            onStartShouldSetResponder={() => true}
            onResponderRelease={() => Keyboard.dismiss()}
          >
            <ScrollView
              ref={assetIntentScrollRef}
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ padding: 20 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
            <Text
              style={{
                color: "#FFF",
                fontSize: 20,
                fontWeight: "800",
                textAlign: "center",
              }}
            >
              What should this asset do?
            </Text>
            {pendingAssetIntent && (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    marginTop: 18,
                  }}
                >
                  {pendingAssetIntent.type === "video" ? (
                    // Live, tappable preview — autoplays muted, tap to hear it.
                    <Pressable
                      onPress={() => setAssetPreviewMuted((m) => !m)}
                      style={{
                        width: 96,
                        height: 128,
                        borderRadius: 16,
                        overflow: "hidden",
                        backgroundColor: "#000",
                      }}
                    >
                      <Video
                        source={{ uri: pendingAssetIntent.url }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay
                        isLooping
                        isMuted={assetPreviewMuted}
                        useNativeControls={false}
                      />
                      <View
                        style={{
                          position: "absolute",
                          bottom: 6,
                          right: 6,
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          backgroundColor: "rgba(0,0,0,0.6)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name={assetPreviewMuted ? "volume-mute" : "volume-high"}
                          size={14}
                          color="#FFF"
                        />
                      </View>
                    </Pressable>
                  ) : (
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 16,
                        overflow: "hidden",
                        backgroundColor: "#222",
                      }}
                    >
                      {pendingAssetIntent.type === "bgm" ||
                      pendingAssetIntent.type === "sfx" ? (
                        <View
                          style={{
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons
                            name="musical-notes"
                            size={26}
                            color="#FFF"
                          />
                        </View>
                      ) : (
                        <Image
                          source={{
                            uri:
                              pendingAssetIntent.thumb ||
                              pendingAssetIntent.thumbnail ||
                              pendingAssetIntent.url,
                          }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      )}
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: "#FFF", fontSize: 15, fontWeight: "700" }}
                      numberOfLines={1}
                    >
                      {pendingAssetIntent.title ||
                        pendingAssetIntent.label ||
                        "Selected asset"}
                    </Text>
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.6)",
                        fontSize: 12,
                        marginTop: 4,
                        textTransform: "capitalize",
                      }}
                    >
                      {pendingAssetIntent.type}
                    </Text>
                  </View>
                </View>

                <Text
                  style={{
                    color: "#FFF",
                    fontSize: 14,
                    fontWeight: "700",
                    marginTop: 20,
                    marginBottom: 10,
                  }}
                >
                  Asset role
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}
                >
                  {getRoleOptionsForType(pendingAssetIntent.type).map(
                    (option) => {
                      const active = assetIntentRole === option.role;
                      return (
                        <Pressable
                          key={option.role}
                          onPress={() => setAssetIntentRole(option.role)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 999,
                            backgroundColor: active
                              ? "#a855f7"
                              : "rgba(255,255,255,0.06)",
                            borderWidth: 1,
                            borderColor: active
                              ? "rgba(255,255,255,0.18)"
                              : "rgba(255,255,255,0.08)",
                          }}
                        >
                          <Text
                            style={{
                              color: "#FFF",
                              fontSize: 13,
                              fontWeight: "700",
                            }}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    },
                  )}
                </View>

                <Text
                  style={{
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 13,
                    lineHeight: 18,
                    marginTop: 10,
                  }}
                >
                  {ROLE_DESCRIPTIONS[assetIntentRole]}
                </Text>

                {assetIntentShowInstruction ? (
                  <>
                    <Text
                      style={{
                        color: "#FFF",
                        fontSize: 14,
                        fontWeight: "700",
                        marginTop: 20,
                        marginBottom: 10,
                      }}
                    >
                      Tell the AI what to do with it{" "}
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.4)",
                          fontWeight: "500",
                        }}
                      >
                        (optional)
                      </Text>
                    </Text>
                    <TextInput
                      value={assetIntentText}
                      onChangeText={setAssetIntentText}
                      autoFocus
                      onFocus={scrollAssetIntentToEnd}
                      placeholder="Example: make this the face on the main character, use this as the room background, use this as a meme popup..."
                      placeholderTextColor="rgba(255,255,255,0.28)"
                      multiline
                      style={{
                        minHeight: 80,
                        borderRadius: 18,
                        backgroundColor: "rgba(255,255,255,0.04)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.08)",
                        paddingHorizontal: 14,
                        paddingVertical: 14,
                        color: "#FFF",
                        textAlignVertical: "top",
                        fontSize: 14,
                        lineHeight: 20,
                      }}
                    />
                  </>
                ) : (
                  <Pressable
                    onPress={() => {
                      setAssetIntentShowInstruction(true);
                      scrollAssetIntentToEnd();
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 7,
                      marginTop: 20,
                      paddingVertical: 4,
                    }}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={19}
                      color="#a855f7"
                    />
                    <Text
                      style={{
                        color: "#a855f7",
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      Add specific instructions
                    </Text>
                  </Pressable>
                )}
              </>
            )}
            </ScrollView>

            {/* Buttons pinned below the scroll so they stay above the keyboard. */}
            {pendingAssetIntent && (
              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  paddingHorizontal: 20,
                  paddingTop: 14,
                  paddingBottom: 20,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255,255,255,0.06)",
                }}
              >
                <Pressable
                  style={{
                    flex: 1,
                    paddingVertical: 15,
                    borderRadius: 18,
                    backgroundColor: "#555",
                    alignItems: "center",
                  }}
                  onPress={() => {
                    setShowAssetIntentModal(false);
                    setPendingAssetIntent(null);
                    setEditingAttachedAssetIndex(null);
                  }}
                >
                  <Text
                    style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  style={{
                    flex: 1,
                    paddingVertical: 15,
                    borderRadius: 18,
                    backgroundColor: "#a855f7",
                    alignItems: "center",
                  }}
                  onPress={handleConfirmAssetIntent}
                >
                  <Text
                    style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}
                  >
                    {activeDraftId && editingAttachedAssetIndex === null
                      ? "Apply"
                      : "Attach"}
                  </Text>
                </Pressable>
              </View>
            )}
          </Animated.View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* === MODIFY MODAL === */}
      <Modal
        visible={showModifyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModifyModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
          onPress={() => setShowModifyModal(false)}
        >
          <Animated.View
            entering={FadeInUp.duration(250)}
            style={{
              width: "100%",
              maxWidth: 360,
              backgroundColor: "#141416",
              borderRadius: 28,
              padding: 24,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
            }}
            onStartShouldSetResponder={() => true}
          >
            <Text
              style={{
                color: "#FFF",
                fontSize: 20,
                fontWeight: "800",
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              Modify Game
            </Text>
            {MODIFY_OPTIONS.map((opt, i) => (
              <Pressable
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255,255,255,0.05)",
                }}
                onPress={() => {
                  setShowModifyModal(false);
                  handleEdit(opt.instruction);
                }}
              >
                <Ionicons
                  name={opt.icon as any}
                  size={22}
                  color="#FFF"
                  style={{ marginRight: 14 }}
                />
                <Text
                  style={{ color: "#FFF", fontSize: 15, fontWeight: "600" }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        </Pressable>
      </Modal>

      {/* === COLORS MODAL === */}
      <Modal
        visible={showColorsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowColorsModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
          onPress={() => setShowColorsModal(false)}
        >
          <Animated.View
            entering={FadeInUp.duration(250)}
            style={{
              width: "100%",
              maxWidth: 360,
              backgroundColor: "#141416",
              borderRadius: 28,
              padding: 20,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
            }}
            onStartShouldSetResponder={() => true}
          >
            <Text
              style={{
                color: "#FFF",
                fontSize: 20,
                fontWeight: "800",
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              Color Palettes
            </Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {COLOR_PALETTES.map((palette, i) => (
                <Pressable
                  key={i}
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: palette.bg,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.1)",
                  }}
                  onPress={() => {
                    setShowColorsModal(false);
                    handleEdit(palette.instruction);
                  }}
                >
                  <View
                    style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}
                  >
                    {palette.colors.map((c) => (
                      <View
                        key={c}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: c,
                        }}
                      />
                    ))}
                  </View>
                  <Text
                    style={{ color: "#FFF", fontSize: 16, fontWeight: "700" }}
                  >
                    {palette.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* === FEATURES MODAL === */}
      <Modal
        visible={showFeaturesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFeaturesModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            justifyContent: "flex-end",
          }}
          onPress={() => setShowFeaturesModal(false)}
        >
          <Animated.View
            entering={SlideInDown.duration(250)}
            style={{
              width: "100%",
              maxHeight: "75%",
              backgroundColor: "#1C1C1E",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingBottom: insets.bottom + 20,
            }}
            onStartShouldSetResponder={() => true}
          >
            <View
              style={{
                alignItems: "center",
                paddingTop: 12,
                paddingBottom: 16,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "rgba(255,255,255,0.3)",
                  marginBottom: 12,
                }}
              />
              <Text style={{ color: "#FFF", fontSize: 18, fontWeight: "700" }}>
                Feature Setup
              </Text>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }}>
              {OPTIONS_FEATURES.map((opt, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(255,255,255,0.05)",
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: "rgba(255,255,255,0.05)",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 16,
                    }}
                  >
                    <Ionicons name={opt.icon as any} size={20} color="#999" />
                  </View>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text
                      style={{
                        color: "#FFF",
                        fontSize: 16,
                        fontWeight: "600",
                        marginBottom: 4,
                      }}
                    >
                      {opt.label}
                    </Text>
                    <Text
                      style={{ color: "#888", fontSize: 13, lineHeight: 18 }}
                    >
                      {opt.desc}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      setActiveFeatures((prev) => ({
                        ...prev,
                        [opt.id]: !prev[opt.id],
                      }))
                    }
                    style={{
                      width: 50,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: activeFeatures[opt.id]
                        ? "#a855f7"
                        : "rgba(255,255,255,0.1)",
                      justifyContent: "center",
                      paddingHorizontal: 2,
                    }}
                  >
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: "#FFF",
                        alignSelf: activeFeatures[opt.id]
                          ? "flex-end"
                          : "flex-start",
                      }}
                    />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <View
              style={{
                flexDirection: "row",
                paddingHorizontal: 20,
                paddingTop: 16,
                gap: 12,
              }}
            >
              <Pressable
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  alignItems: "center",
                }}
                onPress={() => setActiveFeatures({})}
              >
                <Text
                  style={{ color: "#FFF", fontSize: 16, fontWeight: "700" }}
                >
                  Clear all
                </Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 20,
                  backgroundColor: "#a855f7",
                  alignItems: "center",
                }}
                onPress={() => {
                  setShowFeaturesModal(false);
                  const activeKeys = Object.keys(activeFeatures).filter(
                    (k) => activeFeatures[k],
                  );
                  if (activeKeys.length === 0) return;
                  const inst = activeKeys
                    .map(
                      (k) =>
                        OPTIONS_FEATURES.find((o) => o.id === k)?.instruction,
                    )
                    .join(" ");
                  handleEdit(inst);
                }}
              >
                <Text
                  style={{ color: "#FFF", fontSize: 16, fontWeight: "700" }}
                >
                  Apply
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* === AUDIO MODAL === */}
      <Modal
        visible={showAudioModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowAudioModal(false);
          setSelectedAudio(null);
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            justifyContent: "flex-end",
          }}
          onPress={() => {
            setShowAudioModal(false);
            setSelectedAudio(null);
          }}
        >
          <Animated.View
            entering={SlideInDown.duration(250)}
            style={{
              width: "100%",
              height: "75%",
              backgroundColor: "#1C1C1E",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
            }}
            onStartShouldSetResponder={() => true}
          >
            <View style={{ alignItems: "center", paddingTop: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "rgba(255,255,255,0.3)",
                }}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255,255,255,0.05)",
              }}
            >
              {isAudioSearching ? (
                <View
                  style={{
                    flex: 1,
                    marginHorizontal: 20,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderRadius: 12,
                    paddingHorizontal: 12,
                  }}
                >
                  <Ionicons name="search" size={18} color="#888" />
                  <TextInput
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      paddingHorizontal: 8,
                      color: "#FFF",
                      fontSize: 15,
                    }}
                    placeholder={`Search ${audioTab === "bgm" ? "Music" : "Sound Effects"}...`}
                    placeholderTextColor="#888"
                    autoFocus
                    value={audioSearchQuery}
                    onChangeText={setAudioSearchQuery}
                    onSubmitEditing={() =>
                      fetchFreesound(audioTab, audioSearchQuery)
                    }
                    returnKeyType="search"
                  />
                  <Pressable
                    onPress={() => {
                      setIsAudioSearching(false);
                      setAudioSearchQuery("");
                      fetchFreesound(audioTab, "");
                    }}
                  >
                    <Text style={{ color: "#a855f7", fontWeight: "600" }}>
                      Cancel
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text
                    style={{ color: "#FFF", fontSize: 18, fontWeight: "700" }}
                  >
                    {audioTab === "bgm" ? "BGM" : "Sound effects"}
                  </Text>
                  <Pressable
                    style={{
                      position: "absolute",
                      right: 20,
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: "rgba(255,255,255,0.1)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onPress={() => setIsAudioSearching(true)}
                  >
                    <Ionicons name="search" size={18} color="#CCC" />
                  </Pressable>
                </>
              )}
            </View>

            <FlatList
              style={{ paddingHorizontal: 20, paddingTop: 16 }}
              data={audioTab === "bgm" ? freesoundBgm : freesoundSfx}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              showsVerticalScrollIndicator={false}
              onEndReached={() => {
                const currentLen =
                  audioTab === "bgm"
                    ? freesoundBgm.length
                    : freesoundSfx.length;
                const nextPage = Math.floor(currentLen / 20) + 1;
                if (
                  currentLen > 0 &&
                  !isFreesoundLoadingMore &&
                  !isFreesoundLoading
                ) {
                  fetchFreesound(audioTab, audioSearchQuery, nextPage);
                }
              }}
              onEndReachedThreshold={0.5}
              ListHeaderComponent={
                <Pressable
                  onPress={() => handleAssetUpload(audioTab)}
                  style={{
                    backgroundColor: "#444",
                    paddingVertical: 12,
                    paddingHorizontal: 24,
                    borderRadius: 12,
                    alignItems: "center",
                    marginBottom: 16,
                    alignSelf: "flex-start",
                    flexDirection: "row",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="push-outline"
                    size={18}
                    color="#a855f7"
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={{ color: "#FFF", fontSize: 15, fontWeight: "700" }}
                  >
                    Upload
                  </Text>
                </Pressable>
              }
              renderItem={({ item }) => {
                const isSelected =
                  selectedAudio &&
                  (selectedAudio.url
                    ? selectedAudio.url === item.url
                    : selectedAudio.instruction === item.instruction);
                return (
                  <Pressable
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: "rgba(255,255,255,0.05)",
                    }}
                    onPress={() => setSelectedAudio(item)}
                  >
                    <View style={{ flex: 1, paddingRight: 16 }}>
                      <Text
                        style={{
                          color: "#FFF",
                          fontSize: 15,
                          fontWeight: "600",
                          marginBottom: 4,
                        }}
                        numberOfLines={1}
                      >
                        {item.label || item.title}
                      </Text>
                      <Text style={{ color: "#666", fontSize: 12 }}>
                        {item.duration || "00:03"}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => playAudioPreview(item)}
                      hitSlop={10}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor:
                          playingAudioUrl === item.url
                            ? "rgba(168,85,247,0.32)"
                            : "rgba(255,255,255,0.08)",
                        alignItems: "center",
                        justifyContent: "center",
                        marginHorizontal: 8,
                      }}
                    >
                      <Ionicons
                        name={playingAudioUrl === item.url ? "pause" : "play"}
                        size={22}
                        color="#FFF"
                      />
                    </Pressable>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isSelected ? "#a855f7" : "#777",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSelected && (
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: "#a855f7",
                          }}
                        />
                      )}
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                isFreesoundLoading ? (
                  <View
                    style={{
                      width: "100%",
                      height: 200,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ActivityIndicator size="large" color="#a855f7" />
                  </View>
                ) : null
              }
              ListFooterComponent={
                isFreesoundLoadingMore ? (
                  <View style={{ paddingVertical: 20, alignItems: "center" }}>
                    <ActivityIndicator size="small" color="#a855f7" />
                  </View>
                ) : (
                  <View style={{ height: 40 }} />
                )
              }
            />

            <View
              style={{
                flexDirection: "row",
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: Math.max(insets.bottom, 16),
                backgroundColor: "#1C1C1E",
                gap: 12,
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.05)",
              }}
            >
              <Pressable
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 20,
                  backgroundColor: "#555",
                  alignItems: "center",
                }}
                onPress={() => {
                  setSelectedAudio(null);
                  setShowAudioModal(false);
                }}
              >
                <Text
                  style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 20,
                  backgroundColor: "#a855f7",
                  alignItems: "center",
                  opacity: selectedAudio ? 1 : 0.5,
                }}
                disabled={!selectedAudio}
                onPress={() => {
                  setShowAudioModal(false);
                  const fallback =
                    audioTab === "bgm"
                      ? "Inject this auto-looping background music: "
                      : selectedAudio.instruction;
                  const instruction =
                    audioTab === "bgm"
                      ? fallback + selectedAudio.url
                      : fallback;
                  handleAssetSelect(
                    { ...selectedAudio, type: audioTab },
                    instruction,
                  );
                  setSelectedAudio(null);
                }}
              >
                <Text
                  style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}
                >
                  Select
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* === VIDEOS MODAL === */}
      <Modal
        visible={showVideosModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowVideosModal(false);
          setSelectedVideo(null);
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            justifyContent: "flex-end",
          }}
          onPress={() => {
            setShowVideosModal(false);
            setSelectedVideo(null);
          }}
        >
          <Animated.View
            entering={SlideInDown.duration(250)}
            style={{
              width: "100%",
              height: "75%",
              backgroundColor: "#1C1C1E",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
            }}
            onStartShouldSetResponder={() => true}
          >
            <View
              style={{
                alignItems: "center",
                paddingTop: 12,
                paddingBottom: 16,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "rgba(255,255,255,0.3)",
                  marginBottom: 12,
                }}
              />
              <Text style={{ color: "#FFF", fontSize: 18, fontWeight: "700" }}>
                Video
              </Text>
            </View>
            <FlatList
              style={{ flex: 1 }}
              data={[{ isUpload: true }, ...communityVideos]}
              keyExtractor={(item: any, index) =>
                item.isUpload ? "upload-btn" : `vid-${item.id || index}`
              }
              numColumns={3}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 4 }}
              columnWrapperStyle={{ gap: 4, marginBottom: 4 }}
              onEndReachedThreshold={0.6}
              onEndReached={() => loadVideos(false)}
              onViewableItemsChanged={onVideoViewRef.current}
              viewabilityConfig={videoViewConfigRef.current}
              renderItem={({ item }: any) => {
                if (item.isUpload) {
                  return (
                    <Pressable
                      onPress={() => handleAssetUpload("video")}
                      style={{
                        width: "32%",
                        aspectRatio: 0.8,
                        backgroundColor: "rgba(255,255,255,0.05)",
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isUploadingAsset ? (
                        <ActivityIndicator
                          size="small"
                          color="#a855f7"
                          style={{ marginBottom: 8 }}
                        />
                      ) : (
                        <Ionicons
                          name="push-outline"
                          size={24}
                          color="#a855f7"
                          style={{ marginBottom: 8 }}
                        />
                      )}
                      <Text
                        style={{
                          color: "#FFF",
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                      >
                        Upload
                      </Text>
                      <Text
                        style={{ color: "#666", fontSize: 11, marginTop: 4 }}
                      >
                        (Max 15s)
                      </Text>
                    </Pressable>
                  );
                }
                const isSelected = selectedVideo?.url === item.url;
                const videoUrl = item.url || item.videoUrl || item.src;
                return (
                  <Pressable
                    style={{
                      width: "32%",
                      aspectRatio: 0.8,
                      borderRadius: 12,
                      overflow: "hidden",
                      backgroundColor: "#000",
                    }}
                    onPress={() => setSelectedVideo(item)}
                  >
                    {videoUrl ? (
                      visibleVideoIds.has(item.id) ? (
                        // On screen → animate. The cover is the poster, so the
                        // tile shows the frame instantly and never flashes black.
                        <Video
                          source={{ uri: videoUrl }}
                          style={{
                            width: "100%",
                            height: "100%",
                            opacity: isSelected ? 0.65 : 1,
                          }}
                          resizeMode={ResizeMode.COVER}
                          shouldPlay
                          isLooping
                          isMuted
                          usePoster
                          posterSource={
                            item.thumbnail || item.thumb
                              ? { uri: item.thumbnail || item.thumb }
                              : undefined
                          }
                          posterStyle={{ resizeMode: "cover" }}
                          useNativeControls={false}
                        />
                      ) : (
                        <VideoThumb
                          uri={videoUrl}
                          poster={item.thumbnail || item.thumb}
                          dimmed={isSelected}
                        />
                      )
                    ) : (
                      <View
                        style={{
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "rgba(255,255,255,0.04)",
                        }}
                      >
                        <Ionicons name="film-outline" size={26} color="#777" />
                      </View>
                    )}
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        top: 6,
                        left: 6,
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: "rgba(0,0,0,0.55)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="play" size={14} color="#FFF" />
                    </View>
                    <View
                      style={{
                        position: "absolute",
                        bottom: 6,
                        right: 6,
                        backgroundColor: "rgba(0,0,0,0.6)",
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: "#FFF",
                          fontSize: 10,
                          fontWeight: "700",
                        }}
                      >
                        {item.duration || "00:15"}
                      </Text>
                    </View>
                    {isSelected && (
                      <View
                        style={[
                          StyleSheet.absoluteFillObject,
                          {
                            borderWidth: 4,
                            borderColor: "#a855f7",
                            borderRadius: 12,
                          },
                        ]}
                      />
                    )}
                  </Pressable>
                );
              }}
              ListFooterComponent={
                <>
                  {communityVideos.length === 0 && videosInitialLoading && (
                    <View
                      style={{
                        width: "100%",
                        height: 200,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ActivityIndicator size="large" color="#a855f7" />
                    </View>
                  )}
                  {communityVideos.length > 0 && videosLoadingMore && (
                    <View
                      style={{
                        width: "100%",
                        paddingVertical: 16,
                        alignItems: "center",
                      }}
                    >
                      <ActivityIndicator size="small" color="#a855f7" />
                    </View>
                  )}
                  <View style={{ height: 40 }} />
                </>
              }
            />
            {/* Bottom Action Bar */}
            <View
              style={{
                flexDirection: "row",
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: Math.max(insets.bottom, 16),
                backgroundColor: "#1C1C1E",
                gap: 12,
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.05)",
              }}
            >
              <Pressable
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 20,
                  backgroundColor: "#555",
                  alignItems: "center",
                }}
                onPress={() => {
                  setSelectedVideo(null);
                  setShowVideosModal(false);
                }}
              >
                <Text
                  style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 20,
                  backgroundColor: "#a855f7",
                  alignItems: "center",
                  opacity: selectedVideo ? 1 : 0.5,
                }}
                disabled={!selectedVideo}
                onPress={() => {
                  setShowVideosModal(false);
                  handleAssetSelect(
                    selectedVideo,
                    "Add a full-screen looping background video, autoplaying and muted: " +
                      (selectedVideo.url || ""),
                  );
                  setSelectedVideo(null);
                }}
              >
                <Text
                  style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}
                >
                  Select
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* === COMMUNITY IMAGES MODAL === */}
      <Modal
        visible={showCommunityImagesModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCommunityImagesModal(false);
          setSelectedCommunityImage(null);
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            justifyContent: "flex-end",
          }}
          onPress={() => {
            setShowCommunityImagesModal(false);
            setSelectedCommunityImage(null);
          }}
        >
          <Animated.View
            entering={SlideInDown.duration(250)}
            style={{
              width: "100%",
              height: "75%",
              backgroundColor: "#1C1C1E",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
            }}
            onStartShouldSetResponder={() => true}
          >
            <View
              style={{
                alignItems: "center",
                paddingTop: 12,
                paddingBottom: 16,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "rgba(255,255,255,0.3)",
                  marginBottom: 12,
                }}
              />
              <Text style={{ color: "#FFF", fontSize: 18, fontWeight: "700" }}>
                Images
              </Text>
            </View>
            <FlatList
              style={{ flex: 1 }}
              data={[{ isUpload: true }, ...communityPhotos]}
              keyExtractor={(item: any, index) =>
                item.isUpload ? "upload-img-btn" : `img-${item.id || index}`
              }
              numColumns={3}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 4 }}
              columnWrapperStyle={{ gap: 4, marginBottom: 4 }}
              renderItem={({ item }: any) => {
                if (item.isUpload) {
                  return (
                    <Pressable
                      onPress={() => handleAssetUpload("image")}
                      style={{
                        width: "32%",
                        aspectRatio: 1,
                        backgroundColor: "rgba(255,255,255,0.05)",
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isUploadingAsset ? (
                        <ActivityIndicator
                          size="small"
                          color="#a855f7"
                          style={{ marginBottom: 8 }}
                        />
                      ) : (
                        <Ionicons
                          name="push-outline"
                          size={24}
                          color="#a855f7"
                          style={{ marginBottom: 8 }}
                        />
                      )}
                      <Text
                        style={{
                          color: "#FFF",
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                      >
                        Upload
                      </Text>
                    </Pressable>
                  );
                }
                const isSelected = selectedCommunityImage?.url === item.url;
                return (
                  <Pressable
                    style={{
                      width: "32%",
                      aspectRatio: 1,
                      borderRadius: 12,
                      overflow: "hidden",
                      backgroundColor: "#000",
                    }}
                    onPress={() => setSelectedCommunityImage(item)}
                  >
                    <Image
                      source={{ uri: item.thumb || item.thumbnail || item.url }}
                      style={{
                        width: "100%",
                        height: "100%",
                        opacity: isSelected ? 0.6 : 0.8,
                      }}
                      resizeMode="cover"
                    />
                    {isSelected && (
                      <View
                        style={[
                          StyleSheet.absoluteFillObject,
                          {
                            borderWidth: 4,
                            borderColor: "#a855f7",
                            borderRadius: 12,
                          },
                        ]}
                      />
                    )}
                  </Pressable>
                );
              }}
              ListFooterComponent={
                <>
                  {communityPhotos.length === 0 && (
                    <View
                      style={{
                        width: "100%",
                        height: 200,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ActivityIndicator size="large" color="#a855f7" />
                    </View>
                  )}
                  <View style={{ height: 40 }} />
                </>
              }
            />
            {/* Bottom Action Bar */}
            <View
              style={{
                flexDirection: "row",
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: Math.max(insets.bottom, 16),
                backgroundColor: "#1C1C1E",
                gap: 12,
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.05)",
              }}
            >
              <Pressable
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 20,
                  backgroundColor: "#555",
                  alignItems: "center",
                }}
                onPress={() => {
                  setSelectedCommunityImage(null);
                  setShowCommunityImagesModal(false);
                }}
              >
                <Text
                  style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 20,
                  backgroundColor: "#a855f7",
                  alignItems: "center",
                  opacity: selectedCommunityImage ? 1 : 0.5,
                }}
                disabled={!selectedCommunityImage}
                onPress={() => {
                  setShowCommunityImagesModal(false);
                  handleAssetSelect(
                    selectedCommunityImage,
                    "Use this community image asset: " +
                      (selectedCommunityImage.url || ""),
                  );
                  setSelectedCommunityImage(null);
                }}
              >
                <Text
                  style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}
                >
                  Select
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* === PHOTOS MODAL === */}
      <Modal
        visible={showPhotosModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPhotosModal(false);
          setSelectedPhoto(null);
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            justifyContent: "flex-end",
          }}
          onPress={() => {
            setShowPhotosModal(false);
            setSelectedPhoto(null);
          }}
        >
          <Animated.View
            entering={SlideInDown.duration(250)}
            style={{
              width: "100%",
              height: "75%",
              backgroundColor: "#1C1C1E",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
            }}
            onStartShouldSetResponder={() => true}
          >
            <View style={{ alignItems: "center", paddingTop: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "rgba(255,255,255,0.3)",
                }}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 16,
              }}
            >
              {isMemeSearching ? (
                <View
                  style={{
                    flex: 1,
                    marginHorizontal: 20,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderRadius: 12,
                    paddingHorizontal: 12,
                  }}
                >
                  <Ionicons name="search" size={18} color="#888" />
                  <TextInput
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      paddingHorizontal: 8,
                      color: "#FFF",
                      fontSize: 15,
                    }}
                    placeholder={`Search ${memeTab === "gif" ? "GIFs" : "Stickers"}...`}
                    placeholderTextColor="#888"
                    autoFocus
                    value={memeSearchQuery}
                    onChangeText={setMemeSearchQuery}
                    onSubmitEditing={() =>
                      fetchGiphy(
                        memeTab === "gif" ? "gifs" : "stickers",
                        memeSearchQuery,
                      )
                    }
                    returnKeyType="search"
                  />
                  <Pressable
                    onPress={() => {
                      setIsMemeSearching(false);
                      setMemeSearchQuery("");
                      fetchGiphy(memeTab === "gif" ? "gifs" : "stickers", "");
                    }}
                  >
                    <Text style={{ color: "#a855f7", fontWeight: "600" }}>
                      Cancel
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text
                    style={{ color: "#FFF", fontSize: 18, fontWeight: "700" }}
                  >
                    Meme
                  </Text>
                  <Pressable
                    style={{
                      position: "absolute",
                      right: 20,
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: "rgba(255,255,255,0.1)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onPress={() => setIsMemeSearching(true)}
                  >
                    <Ionicons name="search" size={18} color="#CCC" />
                  </Pressable>
                </>
              )}
            </View>

            <View
              style={{
                flexDirection: "row",
                backgroundColor: "#2C2C2E",
                borderRadius: 24,
                alignSelf: "center",
                padding: 4,
                marginBottom: 16,
              }}
            >
              <Pressable
                onPress={() => setMemeTab("gif")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 8,
                  paddingHorizontal: 24,
                  backgroundColor:
                    memeTab === "gif" ? "#1C1C1E" : "transparent",
                  borderRadius: 20,
                }}
              >
                <Text
                  style={{
                    color: memeTab === "gif" ? "#FFF" : "#CCC",
                    fontSize: 14,
                    fontWeight: memeTab === "gif" ? "700" : "600",
                  }}
                >
                  👾 GIF
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMemeTab("stickers")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 8,
                  paddingHorizontal: 24,
                  backgroundColor:
                    memeTab === "stickers" ? "#1C1C1E" : "transparent",
                  borderRadius: 20,
                }}
              >
                <Text
                  style={{
                    color: memeTab === "stickers" ? "#FFF" : "#CCC",
                    fontSize: 14,
                    fontWeight: memeTab === "stickers" ? "700" : "600",
                  }}
                >
                  🙂 Stickers
                </Text>
              </Pressable>
            </View>

            <FlatList
              style={{ flex: 1 }}
              data={memeTab === "gif" ? giphyResults : giphyStickers}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              numColumns={3}
              showsVerticalScrollIndicator={false}
              onEndReached={() => {
                const currentLen =
                  memeTab === "gif"
                    ? giphyResults.length
                    : giphyStickers.length;
                if (currentLen > 0 && !isGiphyLoadingMore && !isGiphyLoading) {
                  fetchGiphy(
                    memeTab === "gif" ? "gifs" : "stickers",
                    memeSearchQuery,
                    currentLen,
                  );
                }
              }}
              onEndReachedThreshold={0.5}
              renderItem={({ item }) => {
                const isSelected = selectedPhoto?.url === item.url;
                return (
                  <Pressable
                    style={{
                      flex: 1 / 3,
                      aspectRatio: 1,
                      backgroundColor: "#000",
                    }}
                    onPress={() => setSelectedPhoto(item)}
                  >
                    <Image
                      source={{ uri: item.url }}
                      style={{
                        width: "100%",
                        height: "100%",
                        opacity: isSelected ? 0.6 : 1,
                      }}
                      resizeMode="cover"
                    />
                    {isSelected && (
                      <View
                        style={[
                          StyleSheet.absoluteFillObject,
                          { borderWidth: 4, borderColor: "#a855f7" },
                        ]}
                      />
                    )}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                isGiphyLoading ? (
                  <View
                    style={{
                      width: "100%",
                      height: 200,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ActivityIndicator size="large" color="#a855f7" />
                  </View>
                ) : null
              }
              ListFooterComponent={
                isGiphyLoadingMore ? (
                  <View style={{ paddingVertical: 20, alignItems: "center" }}>
                    <ActivityIndicator size="small" color="#a855f7" />
                  </View>
                ) : (
                  <View style={{ height: 20 }} />
                )
              }
            />

            {/* Bottom Action Bar */}
            <View
              style={{
                flexDirection: "row",
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: Math.max(insets.bottom, 16),
                backgroundColor: "#1C1C1E",
                gap: 12,
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.05)",
              }}
            >
              <Pressable
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 20,
                  backgroundColor: "#555",
                  alignItems: "center",
                }}
                onPress={() => {
                  setSelectedPhoto(null);
                  setShowPhotosModal(false);
                }}
              >
                <Text
                  style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 20,
                  backgroundColor: "#a855f7",
                  alignItems: "center",
                  opacity: selectedPhoto ? 1 : 0.5,
                }}
                disabled={!selectedPhoto}
                onPress={() => {
                  setShowPhotosModal(false);
                  handleAssetSelect(
                    {
                      url: selectedPhoto.url,
                      type: "image",
                      thumb: selectedPhoto.url,
                    },
                    `Use image: ${selectedPhoto.url}`,
                  );
                  setSelectedPhoto(null);
                }}
              >
                <Text
                  style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}
                >
                  Select
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* === IMAGE MAKER MODAL === */}
      <Modal
        visible={showImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isGeneratingImage) setShowImageModal(false);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.9)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 380,
              backgroundColor: "#141416",
              borderRadius: 28,
              overflow: "hidden",
              borderWidth: 1.5,
              borderColor: "rgba(168,85,247,0.15)",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingTop: 22,
                paddingBottom: 6,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "rgba(168,85,247,0.15)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Ionicons name="sparkles" size={22} color="#a855f7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: "#FFF", fontSize: 17, fontWeight: "800" }}
                >
                  AI Image Maker
                </Text>
              </View>
              {!isGeneratingImage && (
                <Pressable
                  onPress={() => setShowImageModal(false)}
                  hitSlop={12}
                >
                  <Ionicons
                    name="close-circle"
                    size={30}
                    color="rgba(255,255,255,0.2)"
                  />
                </Pressable>
              )}
            </View>
            {generatedImageUri ? (
              <View
                style={{ margin: 16, borderRadius: 16, overflow: "hidden" }}
              >
                <Image
                  source={{ uri: generatedImageUri }}
                  style={{
                    width: "100%",
                    aspectRatio: 1,
                    backgroundColor: "#000",
                  }}
                  resizeMode="contain"
                />
              </View>
            ) : isGeneratingImage ? (
              <View
                style={{
                  marginHorizontal: 16,
                  marginTop: 12,
                  marginBottom: 4,
                  borderRadius: 16,
                  aspectRatio: 1.2,
                  backgroundColor: "#0D0D10",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ActivityIndicator size="large" color="#a855f7" />
                <Text
                  style={{
                    color: "#CCC",
                    fontSize: 15,
                    fontWeight: "700",
                    marginTop: 16,
                  }}
                >
                  Creating your image...
                </Text>
              </View>
            ) : (
              <View style={{ margin: 16 }}>
                <TextInput
                  style={{
                    color: "#FFF",
                    fontSize: 16,
                    backgroundColor: "#0D0D10",
                    borderRadius: 16,
                    padding: 16,
                    minHeight: 100,
                    textAlignVertical: "top",
                    borderWidth: 1,
                    borderColor: "rgba(168,85,247,0.1)",
                  }}
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
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    style={{
                      flex: 1,
                      paddingVertical: 15,
                      borderRadius: 30,
                      borderWidth: 1.5,
                      borderColor: "rgba(255,255,255,0.1)",
                      alignItems: "center",
                    }}
                    onPress={() => {
                      setGeneratedImageUri(null);
                      setImagePromptText("");
                    }}
                  >
                    <Text
                      style={{ color: "#999", fontWeight: "700", fontSize: 14 }}
                    >
                      Try Again
                    </Text>
                  </Pressable>
                  <Pressable
                    style={{ flex: 1, borderRadius: 30, overflow: "hidden" }}
                    onPress={() => {
                      setShowImageModal(false);
                      handleAssetSelect(
                        {
                          url: generatedImageUri,
                          type: "image",
                          thumb: generatedImageUri,
                        },
                        `Use this AI generated asset image: ${generatedImageUri}`,
                      );
                    }}
                  >
                    <LinearGradient
                      colors={["#a855f7", "#7c3aed"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        paddingVertical: 15,
                        alignItems: "center",
                        borderRadius: 30,
                      }}
                    >
                      <Text
                        style={{
                          color: "#FFF",
                          fontWeight: "800",
                          fontSize: 14,
                        }}
                      >
                        Use This Image
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              ) : !isGeneratingImage ? (
                <Pressable
                  style={{ borderRadius: 30, overflow: "hidden" }}
                  onPress={submitImageGeneration}
                  disabled={!imagePromptText.trim()}
                >
                  <LinearGradient
                    colors={
                      imagePromptText.trim()
                        ? ["#a855f7", "#7c3aed"]
                        : ["#2A2A2D", "#222"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      paddingVertical: 16,
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 8,
                      borderRadius: 30,
                    }}
                  >
                    <Ionicons
                      name="color-wand"
                      size={18}
                      color={imagePromptText.trim() ? "#FFF" : "#666"}
                    />
                    <Text
                      style={{
                        color: imagePromptText.trim() ? "#FFF" : "#666",
                        fontWeight: "800",
                        fontSize: 15,
                      }}
                    >
                      Generate Image
                    </Text>
                  </LinearGradient>
                </Pressable>
              ) : (
                <Pressable
                  style={{
                    paddingVertical: 15,
                    borderRadius: 30,
                    borderWidth: 1.5,
                    borderColor: "rgba(255,59,48,0.2)",
                    alignItems: "center",
                    backgroundColor: "rgba(255,59,48,0.06)",
                  }}
                  onPress={() => {
                    setIsGeneratingImage(false);
                    setShowImageModal(false);
                  }}
                >
                  <Text
                    style={{
                      color: "#FF6B6B",
                      fontWeight: "700",
                      fontSize: 14,
                    }}
                  >
                    Cancel
                  </Text>
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

  // ======================
  // RENDER: EXIT CONFIRMATION MODAL (rendered on top of any phase)
  // ======================
  const exitModal = (
    <Modal
      visible={!!showExitConfirm}
      transparent
      animationType="fade"
      onRequestClose={() => setShowExitConfirm(null)}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.85)",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 340,
            backgroundColor: "#2C2C2E",
            borderRadius: 28,
            padding: 28,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "#FFF",
              fontSize: 22,
              fontWeight: "800",
              marginBottom: 14,
              textAlign: "center",
            }}
          >
            Leave Dream Forge?
          </Text>
          <Text
            style={{
              color: "#AAA",
              fontSize: 15,
              textAlign: "center",
              marginBottom: 28,
              lineHeight: 22,
            }}
          >
            You have an unfinished draft on this screen. If you leave now, the
            unsent brief and local edits will be discarded.
          </Text>
          <Pressable
            style={({ pressed }) => [
              {
                width: "100%",
                backgroundColor: colors.primary,
                paddingVertical: 16,
                borderRadius: 24,
                alignItems: "center",
                marginBottom: 10,
              },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => setShowExitConfirm(null)}
          >
            <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "700" }}>
              Fine, I'll Stay
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              {
                width: "100%",
                backgroundColor: "#3A3A3C",
                paddingVertical: 16,
                borderRadius: 24,
                alignItems: "center",
              },
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleConfirmExit}
          >
            <Text style={{ color: "#FF453A", fontSize: 16, fontWeight: "700" }}>
              I'm Out
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  // ======================
  // RENDER: REFINING
  // ======================
  const renderRefiningPhase = () => (
      <View
        style={[
          styles.screenWithBottomNav,
          { paddingTop: insets.top, backgroundColor: "#000" },
        ]}
      >
        {/* Header */}
        <View style={styles.headerV2}>
          <View style={styles.headerV2Side}>
            <Pressable
              onPress={handleBackFromRefinement}
              hitSlop={12}
              style={styles.refineExitButton}
            >
              <Ionicons
                name={pendingEditRequest ? "close" : "chevron-back"}
                size={24}
                color="#FFF"
              />
            </Pressable>
          </View>
          <View style={styles.headerV2Center} pointerEvents="none">
            {/* Gradient Dream Forge text */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="sparkles"
                size={24}
                color="#d946ef"
                style={{ marginRight: 8 }}
              />
              <Svg height="40" width="180">
                <Defs>
                  <SvgLinearGradient
                    id="gradRefine"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                  >
                    <Stop offset="0" stopColor="#d946ef" stopOpacity="1" />
                    <Stop offset="0.45" stopColor="#8b5cf6" stopOpacity="1" />
                    <Stop offset="1" stopColor="#3b82f6" stopOpacity="1" />
                  </SvgLinearGradient>
                </Defs>
                <SvgText
                  fill="url(#gradRefine)"
                  fontSize="26"
                  fontWeight="800"
                  x="0"
                  y="28"
                  letterSpacing="-0.3"
                >
                  Dream Forge
                </SvgText>
              </Svg>
            </View>
          </View>
          <View style={[styles.headerV2Side, styles.headerV2SideRight]}></View>
        </View>

        <ScrollView
          ref={refiningScrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 180,
          }}
          showsVerticalScrollIndicator={false}
        >
          {isGeneratingSpec ? (
            <Animated.View
              entering={FadeInUp.duration(400)}
              style={{ alignItems: "center", paddingVertical: 60 }}
            >
              <ActivityIndicator size="large" color="#06b6d4" />
              <Text style={{ color: "#888", fontSize: 15, marginTop: 16 }}>
                {pendingEditRequest ? "Thinking through the edit..." : "Crafting your game..."}
              </Text>
            </Animated.View>
          ) : (
            gameSpec && (
              <Animated.View entering={FadeInUp.duration(600)}>
                {/* Original Prompt Box */}
                <View
                  style={{
                    backgroundColor: "#0a0b16",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 20,
                  }}
                >
                  <Text style={{ color: "#FFF", fontSize: 14, lineHeight: 20 }}>
                    {refinementBrief || prompt}
                  </Text>
                </View>

                <Text style={{ color: "#FFF", fontSize: 16, marginBottom: 20 }}>
                  {pendingEditRequest
                    ? "Before I update it..."
                    : "Ok what do you think of..."}
                </Text>

                {/* Generated Title */}
                <Text
                  style={{
                    color: "#FFF",
                    fontSize: 28,
                    fontWeight: "800",
                    marginBottom: pendingEditRequest ? 16 : 32,
                    letterSpacing: -0.3,
                  }}
                >
                  {pendingEditRequest ? "Apply this edit" : gameSpec.title}
                </Text>

                {/* Description */}
                <Text
                  style={{
                    color: "#CCC",
                    fontSize: 15,
                    lineHeight: 22,
                    marginBottom: 20,
                  }}
                >
                  {pendingEditRequest
                    ? `Edit plan: ${editIntent?.summary || gameSpec.description}`
                    : gameSpec.description}
                </Text>

                {/* Feature Bullets */}
                {!pendingEditRequest && gameSpec.features && gameSpec.features.length > 0 && (
                  <View style={{ marginBottom: 24 }}>
                    {gameSpec.features.map((feature, idx) => (
                      <View
                        key={idx}
                        style={{
                          flexDirection: "row",
                          marginBottom: 12,
                          alignItems: "flex-start",
                        }}
                      >
                        <Text
                          style={{
                            color: "#FFF",
                            fontSize: 16,
                            marginRight: 8,
                            marginTop: -2,
                          }}
                        >
                          •
                        </Text>
                        <Text
                          style={{
                            color: "#CCC",
                            fontSize: 14,
                            lineHeight: 20,
                            flex: 1,
                          }}
                        >
                          {feature}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {pendingEditRequest && aiMessage && !editIntent?.needsClarification && (
                  <View
                    style={{
                      backgroundColor: "rgba(6, 182, 212, 0.1)",
                      borderLeftWidth: 3,
                      borderLeftColor: "#06b6d4",
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 24,
                    }}
                  >
                    <Text
                      style={{
                        color: "#06b6d4",
                        fontSize: 15,
                        lineHeight: 22,
                      }}
                    >
                      {aiMessage}
                    </Text>
                  </View>
                )}

                {pendingEditRequest && editIntent?.needsClarification && (
                  <View style={{ marginBottom: 24 }}>
                    <Text
                      style={{
                        color: "#FFF",
                        fontSize: 17,
                        fontWeight: "800",
                        marginBottom: 12,
                      }}
                    >
                      {editIntent.question || "What should I clarify before applying it?"}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      {(editIntent.suggestions.length > 0
                        ? editIntent.suggestions
                        : EDIT_BACKGROUND_CHOICES.map((choice) => choice.label)
                      ).map((suggestion) => (
                        <Pressable
                          key={suggestion}
                          onPress={() => handleModifySpec(suggestion)}
                          style={({ pressed }) => ({
                            borderRadius: 999,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            backgroundColor: pressed
                              ? "rgba(6,182,212,0.24)"
                              : "rgba(255,255,255,0.08)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.14)",
                          })}
                        >
                          <Text
                            style={{
                              color: "#FFF",
                              fontSize: 13,
                              fontWeight: "800",
                            }}
                          >
                            {suggestion}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {conversationHistory.length > 2 && (
                  <View style={{ marginBottom: 24 }}>
                    {conversationHistory.slice(2).map((message, idx) => (
                      <View
                        key={`${message.role}-${idx}`}
                        style={{
                          alignSelf:
                            message.role === "user" ? "flex-end" : "flex-start",
                          maxWidth: "88%",
                          backgroundColor:
                            message.role === "user"
                              ? "#1f2937"
                              : "rgba(6, 182, 212, 0.1)",
                          borderColor:
                            message.role === "user"
                              ? "#374151"
                              : "rgba(6, 182, 212, 0.35)",
                          borderWidth: 1,
                          borderRadius: 16,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          marginBottom: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: message.role === "user" ? "#FFF" : "#9eeafd",
                            fontSize: 14,
                            lineHeight: 20,
                          }}
                        >
                          {message.content}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Create Button - Inline with content */}
                <Pressable
                  onPress={handleStartBuilding}
                  style={({ pressed }) => ({
                    width: "85%",
                    alignSelf: "center",
                    marginBottom: 24,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <LinearGradient
                    colors={["#06b6d4", "#3b82f6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      paddingVertical: 18,
                      borderRadius: 32,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#FFF",
                        fontSize: 17,
                        fontWeight: "700",
                        letterSpacing: 0.3,
                      }}
                    >
                      {pendingEditRequest ? "Apply Edit" : "Create"}
                    </Text>
                  </LinearGradient>
                </Pressable>

                {/* AI Message */}
                {aiMessage && !errorMsg && !pendingEditRequest && (
                  <View
                    style={{
                      backgroundColor: "rgba(6, 182, 212, 0.1)",
                      borderLeftWidth: 3,
                      borderLeftColor: "#06b6d4",
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 24,
                    }}
                  >
                    <Text
                      style={{
                        color: "#06b6d4",
                        fontSize: 15,
                        lineHeight: 22,
                      }}
                    >
                      {aiMessage}
                    </Text>
                  </View>
                )}

                {/* Error Message with Fix It Button */}
                {errorMsg && (
                  <Animated.View
                    entering={FadeInUp.duration(300)}
                    style={{
                      backgroundColor: "rgba(255, 59, 48, 0.1)",
                      borderLeftWidth: 3,
                      borderLeftColor: "#FF3B30",
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 24,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        marginBottom: 12,
                      }}
                    >
                      <Ionicons
                        name="warning"
                        size={20}
                        color="#FF3B30"
                        style={{ marginRight: 12, marginTop: 2 }}
                      />
                      <Text
                        style={{
                          color: "#FF6B6B",
                          fontSize: 15,
                          lineHeight: 22,
                          flex: 1,
                        }}
                      >
                        {errorMsg}
                      </Text>
                    </View>
                    <Pressable
                      onPress={handleRetryJob}
                      style={({ pressed }) => ({
                        backgroundColor: "#FF3B30",
                        paddingVertical: 12,
                        paddingHorizontal: 20,
                        borderRadius: 12,
                        alignItems: "center",
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: "#FFF",
                          fontSize: 15,
                          fontWeight: "700",
                        }}
                      >
                        Fix It
                      </Text>
                    </Pressable>
                  </Animated.View>
                )}
              </Animated.View>
            )
          )}
        </ScrollView>

        {/* Bottom Input Container - Fixed */}
        {gameSpec && !isGeneratingSpec && (
          <View
            style={{
              position: "absolute",
              bottom: keyboardVisible
                ? Math.max(keyboardHeight - insets.bottom, 0)
                : 0,
              left: 0,
              right: 0,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: Math.max(insets.bottom + 16, 32),
              backgroundColor: "#000",
              minHeight: 180,
            }}
          >
            {/* Large container with input and floating buttons */}
            <View
              style={{
                backgroundColor: "#1a1a1a",
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 12,
                minHeight: 140,
                position: "relative",
              }}
            >
              {/* Tap to wish input at top of container */}
              <TextInput
                ref={wishInputRef}
                value={wishInput}
                onChangeText={setWishInput}
                placeholder={
                  pendingEditRequest
                    ? "Answer or add details..."
                    : "Tap to wish..."
                }
                placeholderTextColor="#666"
                multiline
                style={{
                  color: "#FFF",
                  fontSize: 14,
                  minHeight: 40,
                  paddingRight: 48,
                }}
                editable={!isRefiningSpecMessage}
                onSubmitEditing={() => handleModifySpec(wishInput)}
              />

              {/* Plus button - bottom left inside container */}
              <Pressable
                onPress={() => wishInputRef.current?.focus()}
                style={{
                  position: "absolute",
                  bottom: 16,
                  left: 16,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#000",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="add" size={24} color="#FFF" />
              </Pressable>

              {/* Up arrow - bottom right inside container */}
              <Pressable
                onPress={() => {
                  if (wishInput.trim().length > 0 && !isRefiningSpecMessage) {
                    handleModifySpec(wishInput);
                  } else {
                    refiningScrollRef.current?.scrollTo({
                      y: 0,
                      animated: true,
                    });
                  }
                }}
                style={{
                  position: "absolute",
                  bottom: 16,
                  right: 16,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#3a3a3a",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isRefiningSpecMessage ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="arrow-up" size={20} color="#FFF" />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
  );

  // ======================
  // RENDER: GENERATING
  // ======================
  const renderGeneratingPhase = () => (
      <ForgeDefenseGame
        prompt={prompt}
        activeStep={activeStep}
        labsMode={labsMode}
        onCancel={handleCancel}
        onMinimize={() => setPhase("idle")}
        onRetry={handleRetryJob}
        errorMessage={errorMsg}
        generationSteps={GENERATION_STEPS}
        cookingStatusLines={COOKING_STATUS_LINES}
        generationProgress={generationProgress}
        generationPhase={generationPhase}
        generationStatusMessage={generationStatusMessage}
      />
  );

  // ======================
  // RENDER: IDLE (PROMPT INPUT)
  // ======================
  const renderIdlePhase = () => (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Full-screen background (Removed to ensure perfect black) */}

      {/* V2 Header (mockup): avatar | centered gametok | menu */}
      {studioTab === "create" ? (
        <View style={styles.headerV2}>
          <View style={styles.headerV2Side}>
            <Pressable
              style={[
                styles.headerAvatarWrap,
                { width: 52, height: 52, borderRadius: 26 },
              ]}
              onPress={() => handleIntentClose("closeApp")}
            >
              <Avatar uri={user?.avatar} userId={user?.id} size={52} />
            </Pressable>
          </View>
          <View style={styles.headerV2Center} pointerEvents="none">
            <Text style={[styles.headerLogo, styles.headerLogoGametok]}>
              gametok
            </Text>
          </View>
          <View style={[styles.headerV2Side, styles.headerV2SideRight]}>
            <View style={{ width: 36, height: 36 }} />
          </View>
        </View>
      ) : studioTab === "drafts" ? (
        <View style={styles.headerV2}>
          <View style={styles.headerV2Side}>
            <Pressable
              style={styles.headerMenuBtn}
              onPress={() => setStudioTab("create")}
            >
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
            <Pressable
              style={styles.headerMenuBtn}
              onPress={() => setStudioTab("create")}
            >
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
      {studioTab === "create" && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
          >
            {/* Top hero — matches promo screenshot: sparkle + gradient-style title + subtitle + segmented modes */}
            <Animated.View entering={FadeInUp.duration(360)}>
              <View style={styles.heroV2Wrap}>
                <View
                  style={[
                    styles.heroV2TitleRow,
                    {
                      position: "relative",
                      width: 260,
                      height: 44,
                      alignSelf: "center",
                    },
                  ]}
                >
                  {/* Subtle glow effect behind */}
                  <View
                    pointerEvents="none"
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      height: "100%",
                      position: "absolute",
                    }}
                  >
                    <Text
                      style={[
                        styles.heroV2TitleDream,
                        {
                          color: "transparent",
                          fontSize: 28,
                          textShadowColor: "rgba(168,85,247,0.6)",
                          textShadowRadius: 14,
                        },
                      ]}
                    >
                      ✨ Dream Forge
                    </Text>
                  </View>

                  {/* Gradient text using SVG to avoid native crash from MaskedView */}
                  <View
                    pointerEvents="none"
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      height: "100%",
                    }}
                  >
                    <Ionicons
                      name="sparkles"
                      size={24}
                      color="#d946ef"
                      style={{ marginRight: 8 }}
                    />
                    <Svg height="40" width="180">
                      <Defs>
                        <SvgLinearGradient
                          id="grad"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <Stop
                            offset="0"
                            stopColor="#d946ef"
                            stopOpacity="1"
                          />
                          <Stop
                            offset="0.45"
                            stopColor="#8b5cf6"
                            stopOpacity="1"
                          />
                          <Stop
                            offset="1"
                            stopColor="#3b82f6"
                            stopOpacity="1"
                          />
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
                <Text style={styles.heroV2Subtitle}>
                  Your imagination. Unlocked.
                </Text>
              </View>
            </Animated.View>

            {/* ========== GAME MODE (ONLY MODE NOW) ========== */}
            {/* === MAIN INPUT CARD === */}
            <Animated.View entering={FadeInUp.delay(80).duration(400)}>
              <View style={styles.inputCard}>
                <LinearGradient
                  colors={[
                    "rgba(124,58,237,0.55)",
                    "rgba(168,85,247,0.55)",
                    "rgba(192,132,252,0.4)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.inputGlowBorder}
                />

                <View style={styles.inputCardHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons
                      name="hardware-chip"
                      size={12}
                      color="#C084FC"
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[styles.inputCardEyebrow, { marginBottom: 0 }]}
                    >
                      GAME BRIEF
                    </Text>
                  </View>
                </View>

                {/* Attached Assets Visual Row */}
                {attachedAssets.length > 0 && (
                  <View
                    style={{
                      paddingHorizontal: 16,
                      paddingTop: 16,
                      paddingBottom: 4,
                    }}
                  >
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 10 }}
                    >
                      {attachedAssets.map((asset, i) => (
                        <Pressable
                          key={`attached-${i}`}
                          onPress={() => openAssetIntentModal(asset, i)}
                          style={{ width: 56 }}
                        >
                          <View
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 10,
                              overflow: "hidden",
                              backgroundColor: "#333",
                            }}
                          >
                            <Image
                              source={{
                                uri:
                                  asset.thumb || asset.thumbnail || asset.url,
                              }}
                              style={{ width: "100%", height: "100%" }}
                              resizeMode="cover"
                            />
                            {asset.type?.includes("audio") ||
                            asset.type?.includes("bgm") ||
                            asset.type?.includes("sfx") ? (
                              <View
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  backgroundColor: "rgba(0,0,0,0.4)",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Ionicons
                                  name="musical-notes"
                                  size={18}
                                  color="#FFF"
                                />
                              </View>
                            ) : null}
                            <View
                              style={{
                                position: "absolute",
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: 16,
                                backgroundColor: "rgba(0,0,0,0.7)",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text
                                style={{
                                  color: "#FFF",
                                  fontSize: 10,
                                  fontWeight: "800",
                                }}
                              >
                                {i + 1}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() =>
                                setAttachedAssets((prev) =>
                                  prev.filter((_, idx) => idx !== i),
                                )
                              }
                              style={{
                                position: "absolute",
                                top: 2,
                                right: 2,
                                backgroundColor: "rgba(0,0,0,0.8)",
                                borderRadius: 12,
                                padding: 2,
                              }}
                            >
                              <Ionicons name="close" size={10} color="#FFF" />
                            </Pressable>
                          </View>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: "rgba(255,255,255,0.72)",
                              fontSize: 10,
                              fontWeight: "700",
                              marginTop: 4,
                              textTransform: "capitalize",
                            }}
                          >
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
                    onChangeText={(value) => {
                      setPrompt(value);
                      if (errorMsg) {
                        setErrorMsg(null);
                      }
                    }}
                    textAlignVertical="top"
                    inputAccessoryViewID="gametok-done"
                  />

                  {!prompt.trim() && (
                    <Text style={styles.inputHint}>
                      Write a brief or tap `Surprise me` to seed one.
                    </Text>
                  )}

                  {/*
                    Screen shape — required, and permanent. The game is written AND sandbox-verified
                    for one viewport (390x844 or 844x390), so this can't be changed later; that's
                    why it's a deliberate tap rather than a default the creator can slide past.
                  */}
                  <View style={styles.orientationBlock}>
                    <Text style={styles.orientationLabel}>Screen shape</Text>
                    <View style={styles.orientationRow}>
                      {ORIENTATION_OPTIONS.map((opt) => {
                        const active = orientation === opt.key;
                        return (
                          <Pressable
                            key={opt.key}
                            style={[
                              styles.orientationCard,
                              active && styles.orientationCardActive,
                            ]}
                            onPress={() => {
                              setOrientation(opt.key);
                              if (errorMsg) setErrorMsg(null);
                            }}
                            hitSlop={6}
                          >
                            <Ionicons
                              name={opt.glyph}
                              size={22}
                              color={active ? "#C084FC" : "rgba(255,255,255,0.32)"}
                            />
                            <Text
                              style={[
                                styles.orientationCardLabel,
                                active && styles.orientationCardLabelActive,
                              ]}
                            >
                              {opt.label}
                            </Text>
                            <Text style={styles.orientationCardSub} numberOfLines={2}>
                              {opt.sub}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Bottom row inside input — surprise me + send */}
                  <View style={[styles.inputBottomRow, { zIndex: 99 }]}>
                    <Pressable
                      style={styles.surpriseBtn}
                      onPressIn={() => {
                        const surprises = [
                          "A massive, completely unhinged physics simulation where you control a magnetic wrecking ball. You must swing through fully destructible voxel skyscrapers, causing absolute chaos and frame-dropping levels of particle explosions. The ground should shatter realistically, and the UI should keep a running tally of millions of dollars in property damage with a satisfying slot-machine counter animation.",
                          "An intensely addictive tower defense hybrid set in a microscopic cell. You are defending the nucleus from evolving viruses. Place white blood cell turrets that automatically lock on to enemies. Crucially, the viruses mutate every wave, becoming immune to certain projectile colors, forcing the player to constantly upgrade and swap turret types. Include an incredible liquid-like UI with soft blobs and organic sounds.",
                          "A deeply satisfying game focused purely on game feel and cutting things. Fruits and objects fly across the screen, and the player swipes their finger to slice them accurately in half like Fruit Ninja. However, implement extremely detailed hit-stop, heavy screen shake on critical hits, and physics where the two halves of the object actually fly apart based precisely on the angle of the swipe vector. Add combo tracking and announcer voice text.",
                          "A hyper-stylized neon rhythm game where the map generates purely based on the beat. The player controls a glowing cube racing down an infinite track. Bass hits spawn massive obstacles you have to jump over, while synth notes create speed pads. The camera must pulse and FOV warp aggressively to the beat to make the player feel the music. Keep the neon colors vibrant against an absolute pitch-black background.",
                        ];
                        setPrompt(
                          surprises[
                            Math.floor(Math.random() * surprises.length)
                          ],
                        );
                        setErrorMsg(null);
                        requestAnimationFrame(() => inputRef.current?.focus());
                      }}
                    >
                      <Ionicons
                        name="sparkles"
                        size={16}
                        color="#C084FC"
                        style={styles.surpriseEmoji as any}
                      />
                      <Text style={styles.surpriseText}>Surprise me</Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.sendBtn,
                        (!prompt.trim() || !orientation) && styles.sendBtnIdle,
                      ]}
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

            {pendingJobs.length > 0 && (
              <Animated.View entering={FadeInUp.delay(110).duration(360)}>
                <View style={styles.activeBuildQueue}>
                  <View style={styles.activeBuildQueueHeader}>
                    <Text style={styles.activeBuildQueueTitle}>
                      {activePendingJobs.length > 1
                        ? `${activePendingJobs.length} builds cooking`
                        : "Build queue"}
                    </Text>
                    <Text style={styles.activeBuildQueueMeta}>
                      {pendingJobs.length > 1 ? "Tap one to inspect" : "Live"}
                    </Text>
                  </View>
                  {pendingJobs.map((job) => {
                    const isFocused = job.jobId === focusedPendingJob?.jobId;
                    const isProblem =
                      job.status === "failed" || job.status === "canceled";
                    return (
                      <Pressable
                        key={job.jobId}
                        style={[
                          styles.activeBuildCard,
                          isFocused && styles.activeBuildCardFocused,
                        ]}
                        onPressIn={() => handleOpenPendingJob(job)}
                      >
                        <View
                          style={[
                            styles.activeBuildStatusDot,
                            isProblem && { backgroundColor: "#FF6B6B" },
                          ]}
                        />
                        <View style={styles.activeBuildTextWrap}>
                          <Text
                            style={styles.activeBuildTitleCompact}
                            numberOfLines={1}
                          >
                            {getPendingJobTitle(job)}
                          </Text>
                          <Text
                            style={styles.activeBuildStatusText}
                            numberOfLines={1}
                          >
                            {getPendingJobStatusText(job)}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color="rgba(255,255,255,0.48)"
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
            )}

            {(activeHtml || activeGameUrl) &&
              (() => {
                const currentDraft = activeDraftFromList;
                const thumbnailUri =
                  activeDraftThumbnail || getDraftThumbnail(currentDraft);
                const thumbnailSource = thumbnailUri
                  ? { uri: thumbnailUri }
                  : GAMETOK_BG;
                const displayTitle =
                  gameTitle || currentDraft?.title || "Untitled Game";

                return (
                  <Animated.View entering={FadeInUp.delay(150).duration(400)}>
                    <Pressable
                      style={styles.generatedPreviewCard}
                      onPress={() =>
                        activeDraftId &&
                        openGameInStudio({
                          draftId: activeDraftId,
                          html: activeHtml,
                          gameUrl: activeGameUrl,
                          title: displayTitle,
                        })
                      }
                    >
                      <Image
                        source={thumbnailSource}
                        style={StyleSheet.absoluteFillObject}
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={[
                          "rgba(0,0,0,0.02)",
                          "rgba(0,0,0,0.24)",
                          "rgba(0,0,0,0.82)",
                        ]}
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
                        <View
                          style={[
                            styles.generatedMetaPill,
                            {
                              backgroundColor: "rgba(0,0,0,0.6)",
                              paddingHorizontal: 12,
                            },
                          ]}
                        >
                          <Ionicons
                            name="game-controller"
                            size={13}
                            color="#a855f7"
                          />
                          <Text
                            style={[
                              styles.generatedMetaText,
                              { fontWeight: "700", fontSize: 13 },
                            ]}
                            numberOfLines={1}
                          >
                            {displayTitle}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.generatedMetaPill,
                            { backgroundColor: "rgba(0,0,0,0.6)" },
                          ]}
                        >
                          <Ionicons
                            name="phone-portrait"
                            size={13}
                            color="#FFF"
                          />
                          <Text style={styles.generatedMetaText}>
                            Mobile Playable
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })()}

            {/* === MEDIA TOOLBAR === */}
            <Animated.View entering={FadeInUp.delay(210).duration(400)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                directionalLockEnabled
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.mediaRow}
              >
                <Pressable
                  style={styles.mediaBtn}
                  onPress={() =>
                    runCreateAction(() =>
                      setShowCommunityImagesModal(true),
                    )
                  }
                >
                  <View
                    style={[
                      styles.mediaIcon,
                      { backgroundColor: "rgba(168,85,247,0.12)" },
                    ]}
                  >
                    <Ionicons name="images-outline" size={26} color="#a855f7" />
                  </View>
                  <Text style={styles.mediaLabel}>Images</Text>
                </Pressable>

                <Pressable
                  style={styles.mediaBtn}
                  onPress={() =>
                    runCreateAction(() => setShowVideosModal(true))
                  }
                >
                  <View
                    style={[
                      styles.mediaIcon,
                      { backgroundColor: "rgba(255,107,157,0.12)" },
                    ]}
                  >
                    <Ionicons name="film-outline" size={26} color="#FF6B9D" />
                  </View>
                  <Text style={styles.mediaLabel}>Videos</Text>
                </Pressable>

                <Pressable
                  style={styles.mediaBtn}
                  onPress={() =>
                    runCreateAction(() => {
                      setAudioTab("sfx");
                      setShowAudioModal(true);
                    })
                  }
                >
                  <View
                    style={[
                      styles.mediaIcon,
                      { backgroundColor: "rgba(37,244,238,0.12)" },
                    ]}
                  >
                    <Ionicons
                      name="volume-high-outline"
                      size={26}
                      color="#25F4EE"
                    />
                  </View>
                  <Text style={styles.mediaLabel}>Sounds</Text>
                </Pressable>

                <Pressable
                  style={styles.mediaBtn}
                  onPress={() =>
                    runCreateAction(() => {
                      setAudioTab("bgm");
                      setShowAudioModal(true);
                    })
                  }
                >
                  <View
                    style={[
                      styles.mediaIcon,
                      { backgroundColor: "rgba(120,40,200,0.12)" },
                    ]}
                  >
                    <Ionicons
                      name="musical-notes-outline"
                      size={26}
                      color="#A040FF"
                    />
                  </View>
                  <Text style={styles.mediaLabel}>BGM</Text>
                </Pressable>

                <Pressable
                  style={styles.mediaBtn}
                  onPress={() =>
                    runCreateAction(() => setShowPhotosModal(true))
                  }
                >
                  <View
                    style={[
                      styles.mediaIcon,
                      { backgroundColor: "rgba(255,60,100,0.12)" },
                    ]}
                  >
                    <Ionicons name="happy-outline" size={26} color="#FF456A" />
                  </View>
                  <Text style={styles.mediaLabel}>Memes</Text>
                </Pressable>

                <Pressable
                  style={styles.mediaBtn}
                  onPress={() =>
                    runCreateAction(() => setShowImageModal(true))
                  }
                >
                  <View
                    style={[
                      styles.mediaIcon,
                      { backgroundColor: "rgba(255,200,50,0.12)" },
                    ]}
                  >
                    <Ionicons
                      name="sparkles-outline"
                      size={26}
                      color="#FFC832"
                    />
                  </View>
                  <Text style={styles.mediaLabel}>Make Image</Text>
                </Pressable>

                <Pressable
                  style={styles.mediaBtn}
                  onPress={() =>
                    runCreateAction(() => setShowFeaturesModal(true))
                  }
                >
                  <View
                    style={[
                      styles.mediaIcon,
                      { backgroundColor: "rgba(255,167,38,0.12)" },
                    ]}
                  >
                    <Ionicons
                      name="hardware-chip-outline"
                      size={26}
                      color="#FFA726"
                    />
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
                  <View
                    key={`ideas-row-${rowIndex}`}
                    style={styles.ideasLaneClip}
                    onStartShouldSetResponderCapture={() => {
                      // Freeze the marquee the instant a finger lands so the chip
                      // holds still under the tap.
                      ideasPauseUntilRef.current = Date.now() + 1500;
                      return false;
                    }}
                  >
                    <Animated.View
                      style={[styles.ideasLane, ideasRowStyles[rowIndex]]}
                      onLayout={(e) => {
                        // Row holds two copies of the chips → one loop = half.
                        ideasLoopWidths.current[rowIndex] =
                          e.nativeEvent.layout.width / 2;
                      }}
                    >
                      {row.map((chip, chipIndex) => (
                        <Pressable
                          key={`${chip.label}-${rowIndex}-${chipIndex}`}
                          style={({ pressed }) => [
                            styles.ideaPill,
                            pressed && { transform: [{ scale: 0.96 }] },
                          ]}
                          onPressIn={() => {
                            ideasPauseUntilRef.current = Date.now() + 1500;
                          }}
                          onPress={() => handleGenreSelect(chip.prompts)}
                        >
                          <Ionicons
                            name={chip.icon as any}
                            size={15}
                            color={chip.iconColor}
                          />
                          <Text style={styles.ideaLabel}>{chip.label}</Text>
                        </Pressable>
                      ))}
                    </Animated.View>
                  </View>
                ))}
              </View>
            </Animated.View>

            {/* Error message */}
            {errorMsg && (
              <Animated.View
                entering={FadeIn.duration(300)}
                style={styles.errorBox}
              >
                <Ionicons name="warning" size={16} color="#FF3B30" />
                <Text style={styles.errorText}>{errorMsg}</Text>
                <Pressable
                  onPressIn={() => setErrorMsg(null)}
                  hitSlop={12}
                  style={styles.errorDismissBtn}
                >
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
      {studioTab === "drafts" && (
        <View style={{ flex: 1 }}>
          {/* Draft count */}
          <Animated.View entering={FadeInUp.duration(400)}>
            <Text style={styles.draftCountLabel}>{drafts.length} drafts</Text>
          </Animated.View>

          {drafts.length === 0 ? (
            <Animated.View
              entering={FadeInUp.delay(100).duration(400)}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <Ionicons name="folder-open-outline" size={48} color="#333" />
              <Text style={{ color: "#555", fontSize: 16, fontWeight: "600" }}>
                No drafts yet
              </Text>
              <Text style={{ color: "#444", fontSize: 13 }}>
                Games you generate will appear here
              </Text>
            </Animated.View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.draftsGrid}
              showsVerticalScrollIndicator={false}
            >
              {drafts.map((draft, index) => (
                <Animated.View
                  key={draft.id}
                  entering={FadeInUp.delay(index * 80).duration(400)}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.draftCard,
                      pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                    ]}
                    onPress={() => {
                      setActiveDraftThumbnail(getDraftThumbnail(draft));
                      void openDraftInEditor(draft.id);
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
                        // An unpublished landscape draft's only art is the 844x390 sandbox shot,
                        // and cover-cropping that into a 0.75 box throws most of the frame away.
                        // Letterbox it instead — the grid geometry stays uniform, which reads far
                        // better than a grid of mixed-aspect tiles. (Once published, cover art
                        // generation replaces this with a portrait poster.)
                        <Image
                          source={{ uri: draft.thumbnail }}
                          style={StyleSheet.absoluteFillObject}
                          resizeMode={
                            normalizeOrientation(draft.orientation) === "landscape"
                              ? "contain"
                              : "cover"
                          }
                        />
                      ) : (
                        <>
                          <LinearGradient
                            colors={
                              DRAFT_GRADIENTS[index % DRAFT_GRADIENTS.length]
                            }
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
                      {draft.title || "Untitled Game"}
                    </Text>
                    <Text style={styles.draftDate}>
                      {getTimeAgo(draft.created_at)}
                    </Text>
                  </Pressable>
                </Animated.View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* === BOTTOM TAB BAR === */}
      <View
        style={{
          width: "100%",
          alignItems: "center",
          paddingBottom: Math.max(insets.bottom, 12),
        }}
      >
        <View style={styles.bottomTabs}>
          <Pressable
            style={[
              styles.bottomTab,
              studioTab === "create" && styles.bottomTabActive,
            ]}
            onPress={() => setStudioTab("create")}
          >
            <Ionicons
              name={studioTab === "create" ? "home" : "home-outline"}
              size={20}
              color={studioTab === "create" ? "#FFF" : "#888"}
            />
            <Text
              style={[
                styles.bottomTabLabel,
                studioTab === "create" && styles.bottomTabLabelActive,
              ]}
            >
              Create
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.bottomTab,
              studioTab === "drafts" && styles.bottomTabActive,
            ]}
            onPress={() => setStudioTab("drafts")}
          >
            <Ionicons
              name={studioTab === "drafts" ? "cube" : "cube-outline"}
              size={20}
              color={studioTab === "drafts" ? "#FFF" : "#888"}
            />
            <Text
              style={[
                styles.bottomTabLabel,
                studioTab === "drafts" && styles.bottomTabLabelActive,
              ]}
            >
              Drafts{drafts.length > 0 ? ` (${drafts.length})` : ""}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* === iOS KEYBOARD DONE BAR === */}
      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID="gametok-done">
          <View style={styles.accessoryBar}>
            <View style={{ flexDirection: "row", gap: 16, paddingLeft: 8 }}>
              <Ionicons name="chevron-up" size={24} color="#666" />
              <Ionicons name="chevron-down" size={24} color="#666" />
            </View>
            <Pressable
              onPress={() => Keyboard.dismiss()}
              style={{ paddingVertical: 4, paddingHorizontal: 8 }}
            >
              <Text style={styles.accessoryDoneText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
  // ── One stable shell ───────────────────────────────────────────────────────
  // Phases render as CONTENT inside this shell instead of being early returns.
  // An early return swaps the whole tree, so every phase change unmounted the
  // long-lived siblings below — the Wish studio lives in the shared modals, and
  // that remount wiped its entire session (conversation, brief, built game).
  // The shell carries `styles.screen` (absolute fill + zIndex): CreateScreen is
  // an overlay above the whole app, not a flow-layout child. A plain flex:1
  // wrapper here drops it into App's layout, below the tab bar.
  const showLoading = isOpeningDraft || !!openDraftId;

  return (
    <View style={styles.screen}>
      {showLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#08080C" }}>
          <ActivityIndicator size="large" color="#FF3B30" />
          <Text style={{ color: "#8E8E93", marginTop: 16, fontSize: 16, fontWeight: "600" }}>
            Opening Remix...
          </Text>
        </View>
      ) : phase === "refining"
        ? renderRefiningPhase()
        : phase === "generating"
          ? renderGeneratingPhase()
          : renderIdlePhase()}

      {renderSharedModals()}
      {exitModal}
    </View>
  );
};

const styles = StyleSheet.create({
  // ── V2 mockup styles ───────────────────────────────────────────────────
  headerV2: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
  },
  headerV2Side: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  headerV2SideRight: {
    justifyContent: "flex-end",
  },
  refineExitButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerV2Center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogo: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  headerLogoGametok: {
    textTransform: "lowercase",
  },
  headerMenuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroV2Wrap: {
    paddingTop: 4,
    paddingBottom: 14,
    width: "100%",
    alignItems: "center",
  },
  heroV2TitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  heroV2SparkleIcon: {
    marginRight: 8,
    marginTop: 3,
  },
  heroV2TitleTextWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    flexShrink: 1,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  heroV2TitleDream: {
    color: "#a855f7",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  heroV2TitleForge: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  heroV2Subtitle: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 18,
  },
  modeSwitchV2: {
    flexDirection: "row",
    alignSelf: "stretch",
    marginTop: 12,
    padding: 4,
    borderRadius: 999,
    backgroundColor: "#120b1f",
    borderWidth: 0,
    zIndex: 999,
  },
  modeSwitchV2Tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.001)",
  },
  modeSwitchV2TabActive: {
    backgroundColor: "#4c1d95",
  },
  modeSwitchV2Text: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  modeSwitchV2TextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  // ── Existing styles ─────────────────────────────────────────────────────
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#08080C",
    zIndex: 99999,
  },
  screenWithBottomNav: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 80,
    backgroundColor: "#08080C",
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
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0E1018",
  },
  studioHeroBg: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
    opacity: 0.38,
  },
  studioHeroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  studioBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(13,12,24,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  studioBadgeText: {
    color: "#FFD89B",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  studioLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(20,20,24,0.82)",
    borderWidth: 1,
    borderColor: "rgba(52,199,89,0.18)",
  },
  studioLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#34C759",
  },
  studioLiveText: {
    color: "#D7FFE3",
    fontSize: 11,
    fontWeight: "700",
  },
  studioHeroCopyRow: {
    gap: 4,
  },
  studioHeroTitle: {
    color: "#FFF",
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "800",
    maxWidth: "100%",
  },
  studioHeroSubtitle: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    lineHeight: 17,
    maxWidth: "100%",
  },
  modeSwitchShell: {
    marginTop: 12,
    padding: 4,
    borderRadius: 18,
    backgroundColor: "rgba(13,12,24,0.74)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
  },
  modeSwitchTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 9,
  },
  modeSwitchTabActive: {
    backgroundColor: "rgba(168,85,247,0.22)",
  },
  modeSwitchText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontWeight: "700",
  },
  modeSwitchTextActive: {
    color: "#FFF",
  },
  studioUtilityRow: {
    flexDirection: "row",
    gap: 10,
  },
  yourGamesCard: {
    flex: 1,
    minHeight: 86,
    borderRadius: 24,
    backgroundColor: "rgba(18,18,24,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  utilityLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  utilityLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  utilityValue: {
    color: "#FFF",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  utilityMiniCard: {
    width: 84,
    minHeight: 86,
    borderRadius: 24,
    backgroundColor: "rgba(18,18,24,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  utilityMiniNumber: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "800",
  },
  utilityMiniLabel: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  activeBuildQueue: {
    borderRadius: 18,
    backgroundColor: "rgba(12,12,18,0.9)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.16)",
    padding: 10,
    gap: 8,
    marginBottom: 8,
  },
  activeBuildQueueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  activeBuildQueueTitle: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "900",
  },
  activeBuildQueueMeta: {
    color: "rgba(255,255,255,0.46)",
    fontSize: 11,
    fontWeight: "700",
  },
  activeBuildCard: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  activeBuildCardFocused: {
    backgroundColor: "rgba(168,85,247,0.12)",
    borderColor: "rgba(192,132,252,0.28)",
  },
  activeBuildStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  activeBuildHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  activeBuildEyebrow: {
    color: "#FFBA69",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  activeBuildTitle: {
    color: "#FFF",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    maxWidth: 240,
  },
  activeBuildStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(87,22,130,0.32)",
  },
  activeBuildStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#34C759",
  },
  activeBuildTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  activeBuildTitleCompact: {
    color: "#FFF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  activeBuildStatusText: {
    color: "#F8E8FF",
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 1,
  },
  activeBuildBody: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  activeBuildTimelineRow: {
    marginTop: 14,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activeBuildTimelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(168,85,247,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeBuildTimelineLabel: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  activeBuildTimelineSubtext: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  activeBuildActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  activeBuildActionPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#A855F7",
    paddingHorizontal: 16,
    paddingVertical: 13,
    flex: 1,
  },
  activeBuildActionPrimaryText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },
  activeBuildActionGhost: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  activeBuildActionGhostText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  recentBuildsHeader: {
    marginTop: 2,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  recentBuildsTitle: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "800",
  },
  recentBuildsSubtitle: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 13,
    marginTop: 4,
  },
  recentBuildsLink: {
    color: "#C084FC",
    fontSize: 13,
    fontWeight: "700",
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
    overflow: "hidden",
    backgroundColor: "#15151B",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    justifyContent: "space-between",
  },
  recentBuildOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,8,12,0.16)",
  },
  recentBuildBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(8,8,12,0.74)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  recentBuildBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
  },
  recentBuildName: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 10,
  },
  starterRailHeader: {
    marginTop: 2,
    marginBottom: 10,
  },
  starterRailTitle: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "800",
  },
  starterRailSubtitle: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },

  // === HEADER ===
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700",
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1E1E22",
    alignItems: "center",
    justifyContent: "center",
  },
  draftsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  // === MAIN INPUT CARD ===
  inputCard: {
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#6d28d9",
    backgroundColor: "#0a0514",
  },
  narrativeChatSurface: {
    borderRadius: 22,
    backgroundColor: "#050209",
    borderColor: "rgba(168,85,247,0.34)",
  },
  inputCardHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  narrativeHeaderStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(168,85,247,0.12)",
  },
  narrativeHeaderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#A855F7",
  },
  narrativeHeaderStatusText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "800",
  },
  inputCardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  inputCardEyebrow: {
    color: "#C084FC",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputCardTitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    maxWidth: 240,
  },
  inputCardMetaPill: {
    minWidth: 58,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
  },
  inputCardMetaValue: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
  inputCardMetaLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 1,
  },
  inputGlowBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  inputInner: {
    padding: 20,
    paddingTop: 24,
  },
  mainInput: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 23,
    minHeight: 60,
    textAlignVertical: "top",
  },
  inputHint: {
    marginTop: 10,
    color: "rgba(255,255,255,0.28)",
    fontSize: 13,
    lineHeight: 18,
  },
  narrativeBriefPanel: {
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: "rgba(168,85,247,0.09)",
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.2)",
  },
  narrativeSessionHeader: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7c3aed",
    shadowColor: "#a855f7",
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  narrativeAgentName: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "900",
  },
  narrativeAgentSub: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 2,
  },
  narrativeBriefHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  narrativeBriefIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(168,85,247,0.28)",
  },
  narrativeBriefTitle: {
    flex: 1,
    color: "#FFF",
    fontSize: 14,
    fontWeight: "900",
  },
  narrativeBriefCount: {
    color: "#C084FC",
    fontSize: 12,
    fontWeight: "900",
  },
  narrativeBriefText: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  narrativeChatBox: {
    justifyContent: "flex-start",
    gap: 10,
    paddingTop: 4,
    paddingBottom: 6,
    marginBottom: 2,
  },
  narrativeBubble: {
    maxWidth: "88%",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  narrativeBubbleAi: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderTopLeftRadius: 8,
  },
  narrativeBubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(124,58,237,0.72)",
    borderTopRightRadius: 8,
  },
  narrativeAiDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7c3aed",
    marginTop: 1,
  },
  narrativeBubbleText: {
    flex: 1,
    color: "#FFF",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  narrativeComposer: {
    minHeight: 58,
    borderRadius: 22,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  narrativeInput: {
    flex: 1,
    maxHeight: 110,
    color: "#FFF",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    paddingVertical: 6,
  },
  narrativeSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#a855f7",
  },
  narrativeSendBtnIdle: {
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  narrativeActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },
  narrativeForgeHint: {
    flex: 1,
    color: "rgba(255,255,255,0.46)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  narrativeReferenceDock: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    paddingBottom: 2,
  },
  narrativeReferenceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  narrativeReferenceText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "800",
  },
  narrativeAttachedRow: {
    gap: 8,
    paddingTop: 10,
  },
  narrativeAttachedChip: {
    maxWidth: 140,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 6,
    paddingRight: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  narrativeAttachedThumb: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#21162d",
  },
  narrativeAttachedText: {
    maxWidth: 72,
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  inputBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 0,
  },
  orientationBlock: {
    marginTop: 12,
  },
  orientationLabel: {
    color: "rgba(255,255,255,0.34)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  orientationRow: {
    flexDirection: "row",
    gap: 10,
  },
  orientationCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 4,
  },
  orientationCardActive: {
    borderColor: "rgba(192,132,252,0.55)",
    backgroundColor: "rgba(168,85,247,0.12)",
  },
  orientationCardLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontWeight: "800",
  },
  orientationCardLabelActive: {
    color: "#FFF",
  },
  orientationCardSub: {
    color: "rgba(255,255,255,0.26)",
    fontSize: 11,
    lineHeight: 15,
  },
  surpriseBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 10,
    borderRadius: 12,
  },
  surpriseEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  surpriseText: {
    color: "#BBB",
    fontSize: 13,
    fontWeight: "600",
  },
  charCount: {
    color: "#555",
    fontSize: 13,
    fontWeight: "700",
  },
  sendBtn: {
    minWidth: 110,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#7c3aed",
    shadowColor: "#7c3aed",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  sendBtnIdle: {
    backgroundColor: "rgba(168,85,247,0.32)",
  },
  sendBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },

  mediaRow: {
    gap: 12,
    paddingLeft: 2,
    paddingBottom: 14,
    paddingRight: 20,
  },
  generatedPreviewCard: {
    height: 218,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#101018",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.25)",
    marginBottom: 4,
  },
  generatedBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.62)",
    borderWidth: 1,
    borderColor: "rgba(37,244,238,0.28)",
  },
  generatedBadgeText: {
    color: "#25F4EE",
    fontSize: 11,
    fontWeight: "800",
  },
  generatedPlayBtn: {
    position: "absolute",
    top: 18,
    right: 18,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.46)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  generatedMetaRow: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: "row",
    gap: 8,
  },
  generatedMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.56)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  generatedMetaText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  mediaBtn: {
    alignItems: "center",
    gap: 8,
    width: 85,
  },
  mediaIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  mediaLabel: {
    color: "#CCC",
    fontSize: 12,
    fontWeight: "700",
  },

  // === NEED IDEAS SECTION ===
  ideasLaneStack: {
    gap: 10,
    marginBottom: 20,
  },
  ideasLaneClip: {
    width: "100%",
    overflow: "hidden",
  },
  ideasLane: {
    flexDirection: "row",
    alignSelf: "flex-start",
  },
  ideaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    // Uniform trailing space on EVERY chip (including each copy's last) so the
    // duplicated row is perfectly periodic and the marquee loop has no seam.
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  ideaEmoji: {
    fontSize: 16,
  },
  ideaLabel: {
    color: "#CCC",
    fontSize: 13,
    fontWeight: "600",
  },

  // === ERROR ===
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,59,48,0.08)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.15)",
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: "#FF6B6B",
    fontSize: 13,
    fontWeight: "600",
  },
  errorDismissBtn: {
    width: 44,
    height: 44,
    marginVertical: -12,
    marginRight: -10,
    alignItems: "center",
    justifyContent: "center",
  },

  // === FIXED BOTTOM BAR ===
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "rgba(8,8,12,0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
  },
  generateBtn: {
    height: 58,
    borderRadius: 29,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#a855f7",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  generateBtnText: {
    fontSize: 17,
    fontWeight: "800",
  },

  // === GENERATING PHASE ===
  genHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  genHeaderTitle: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  forgeBackdropGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(255,140,65,0.14)",
    top: SCREEN_HEIGHT * 0.08,
    alignSelf: "center",
  },
  forgeHeaderChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  forgeHeaderChipText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  generatingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  orbOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
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
    position: "absolute",
    opacity: 0.12,
    top: SCREEN_HEIGHT * 0.3,
  },
  genTitle: {
    color: "#FFF",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 8,
    textAlign: "center",
  },
  genSubtitle: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
    maxWidth: "90%",
  },
  promptSnippetCard: {
    width: "100%",
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  promptSnippetLabel: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
  },
  promptSnippetText: {
    color: "#FFF",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  forgeSceneCard: {
    width: "100%",
    height: SCREEN_HEIGHT * 0.38,
    marginTop: 18,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#20130f",
    justifyContent: "flex-end",
    paddingBottom: 22,
  },
  forgeSkyRunes: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    opacity: 0.35,
  },
  forgeRune: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 18,
    fontWeight: "800",
  },
  forgeLanes: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: "16%",
    paddingVertical: "12%",
  },
  forgeLaneLine: {
    width: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
  },
  wizardAura: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    bottom: 34,
    alignSelf: "center",
  },
  wizardStation: {
    position: "absolute",
    bottom: 26,
    alignSelf: "center",
    alignItems: "center",
  },
  wizardEmoji: {
    fontSize: 34,
    marginBottom: 2,
  },
  cauldron: {
    width: 88,
    height: 40,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  cauldronGlow: {
    position: "absolute",
    width: 66,
    height: 18,
    borderRadius: 12,
    backgroundColor: "#FFB860",
    top: 0,
  },
  cauldronPot: {
    width: 74,
    height: 24,
    borderRadius: 14,
    backgroundColor: "#1D2530",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
  },
  enemyDot: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(9,18,7,0.28)",
  },
  enemyFace: {
    color: "#173113",
    fontSize: 11,
    fontWeight: "900",
  },
  knightBody: {
    position: "absolute",
    bottom: "24%",
    marginLeft: -22,
    width: 44,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  knightHelmet: {
    width: 28,
    height: 30,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    borderWidth: 2,
    borderColor: "#94A3B8",
  },
  knightSword: {
    position: "absolute",
    width: 36,
    height: 6,
    borderRadius: 4,
    backgroundColor: "#FDE68A",
    top: 22,
  },
  knightSwordLeft: {
    transform: [{ rotate: "-32deg" }, { translateX: -18 }],
  },
  knightSwordRight: {
    transform: [{ rotate: "28deg" }, { translateX: 18 }],
  },
  knightShield: {
    position: "absolute",
    bottom: -2,
    fontSize: 18,
  },
  forgeHud: {
    position: "absolute",
    top: 16,
    right: 16,
    gap: 10,
  },
  forgeStatPill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "rgba(12,12,18,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  forgeStatLabel: {
    color: "rgba(255,255,255,0.54)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  forgeStatValue: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  laneControlRow: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  laneControlBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  laneControlBtnActive: {
    backgroundColor: "rgba(255,173,92,0.2)",
    borderColor: "rgba(255,200,120,0.45)",
  },
  laneControlText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  laneControlTextActive: {
    color: "#FFF4D4",
  },
  stepsContainer: {
    marginTop: 16,
    width: "100%",
    gap: 16,
  },
  statusCard: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statusEyebrow: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  statusHeadline: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  statusMeta: {
    color: "rgba(255,255,255,0.64)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    opacity: 0.3,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  stepText: {
    color: "#777",
    fontSize: 15,
    fontWeight: "500",
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: "rgba(255,107,107,0.25)",
    backgroundColor: "rgba(255,107,107,0.06)",
  },
  cancelBtnText: {
    color: "#FF6B6B",
    fontSize: 15,
    fontWeight: "700",
  },

  // === PREVIEW PHASE ===
  previewPublishPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  previewTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    zIndex: 10,
  },
  titlePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    maxWidth: SCREEN_WIDTH * 0.6,
  },
  titlePillText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  webviewContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  previewBottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  regenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    paddingHorizontal: 20,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 6,
  },
  regenBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
  publishBtn: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  publishBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
  },

  // === KEYBOARD ACCESSORY ===
  accessoryBar: {
    backgroundColor: "#1E1E20",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  accessoryDoneText: {
    color: "#0A84FF",
    fontSize: 16,
    fontWeight: "600",
  },

  // === BOTTOM TAB BAR ===
  bottomTabs: {
    flexDirection: "row",
    alignItems: "center",
    width: "92%",
    backgroundColor: "#161618",
    borderRadius: 40,
    padding: 6,
    justifyContent: "space-between",
  },
  bottomTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 34,
    gap: 4,
  },
  bottomTabActive: {
    backgroundColor: "#2C2C2E",
  },
  bottomTabLabel: {
    color: "#777",
    fontSize: 10,
    fontWeight: "600",
  },
  bottomTabLabelActive: {
    color: "#FFF",
  },

  // === DRAFTS TAB ===
  draftCountLabel: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "800",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  draftsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 20,
  },
  draftCard: {
    width: (SCREEN_WIDTH - 16 * 2 - 12) / 2,
    backgroundColor: "#1E1E1F",
    borderRadius: 20,
    marginBottom: 8,
    padding: 6,
  },
  draftDeleteBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  draftThumbnail: {
    width: "100%",
    aspectRatio: 0.75, // Taller image like the screenshot
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  draftBadge: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  draftBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  draftTitle: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  draftDate: {
    color: "#888",
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 4,
    paddingBottom: 8,
  },

  // ── Publish Game screen (design-token styled) ─────────────────────────────
  pubHeaderTitle: {
    color: pal.text,
    fontSize: typo.size.bodyLg,
    fontFamily: typo.family.bold,
    letterSpacing: typo.letter.snug,
  },
  pubPreviewCard: {
    width: 180,
    height: 240,
    borderRadius: rad.xl,
    overflow: "hidden",
    backgroundColor: pal.ink700,
    borderWidth: 1,
    borderColor: pal.line,
    shadowColor: pal.purple,
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  // A landscape game gets a landscape card rather than the feed's rotate-the-content treatment:
  // this is a small confirmation preview, and nobody should have to turn their phone sideways to
  // check a thumbnail before posting.
  pubPreviewCardLandscape: {
    width: 300,
    height: 168,
  },
  pubEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: sp.md,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.sm,
    borderRadius: rad.pill,
    backgroundColor: pal.glassWhite,
  },
  pubEditText: {
    color: pal.purpleSoft,
    fontSize: typo.size.small,
    fontFamily: typo.family.semibold,
  },
  pubLabel: {
    color: pal.textDim,
    fontSize: typo.size.micro,
    fontFamily: typo.family.semibold,
    letterSpacing: typo.letter.wide,
    marginBottom: sp.sm,
  },
  pubInput: {
    backgroundColor: pal.ink600,
    borderRadius: rad.md,
    borderWidth: 1,
    borderColor: pal.line,
    color: pal.text,
    fontSize: typo.size.bodyLg,
    fontFamily: typo.family.semibold,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    marginBottom: sp.xxl,
  },
  pubCard: {
    backgroundColor: pal.ink600,
    borderRadius: rad.lg,
    borderWidth: 1,
    borderColor: pal.line,
    overflow: "hidden",
  },
  pubDivider: {
    height: 1,
    backgroundColor: pal.line,
    marginLeft: 62,
  },
  pubRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp.lg,
    paddingVertical: sp.lg,
  },
  pubRowIcon: {
    width: 34,
    height: 34,
    borderRadius: rad.sm,
    backgroundColor: pal.glassWhite,
    alignItems: "center",
    justifyContent: "center",
    marginRight: sp.md,
  },
  pubRowIconActive: {
    backgroundColor: pal.purpleGlow,
  },
  pubRowLabel: {
    color: pal.textMuted,
    fontSize: typo.size.body,
    fontFamily: typo.family.semibold,
  },
  pubRowSub: {
    color: pal.textDim,
    fontSize: typo.size.caption,
    fontFamily: typo.family.regular,
    marginTop: 2,
  },
  pubRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: pal.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  pubRadioActive: {
    backgroundColor: pal.purple,
    borderColor: pal.purple,
  },
  pubTerms: {
    color: pal.textGhost,
    fontSize: typo.size.small,
    fontFamily: typo.family.regular,
    textAlign: "center",
    marginTop: sp.xxxl,
    marginBottom: sp.lg,
  },
  pubPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sp.sm,
    backgroundColor: pal.purple,
    borderRadius: rad.pill,
    paddingVertical: sp.lg,
    shadowColor: pal.purple,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  pubPostBtnDisabled: {
    backgroundColor: pal.ink500,
    shadowOpacity: 0,
  },
  pubPostText: {
    color: pal.text,
    fontSize: typo.size.bodyLg,
    fontFamily: typo.family.bold,
    letterSpacing: typo.letter.snug,
  },
});
