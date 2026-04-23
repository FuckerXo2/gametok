import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  PanResponder,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ResizeMode, Video } from 'expo-av';
import { useAuth } from '../context/AuthContext';
import { useAuthScreen, useDeepLink, useNavigation } from '../../App';
import { UserProfileModal } from './UserProfileModal';
import { API_URL, feed, games as gamesApi, search as searchApi, users } from '../services/api';

const PRIMARY_TABS = ['Explore', 'Games', 'Horror', 'Quiz', 'Roleplay'] as const;
const API_ORIGIN = API_URL.replace(/\/api$/, '');
const CDN_ORIGIN = 'https://games.gametok.co';
const SIGNAL_PULSES = [
  { id: 'pulse-1', label: 'Search heat', value: '0', tone: '#8B5CF6' },
  { id: 'pulse-2', label: 'Creators rising', value: '0', tone: '#3B82F6' },
  { id: 'pulse-3', label: 'Games popping', value: '0', tone: '#F59E0B' },
];
const CHART_COLUMNS = [
  {
    title: 'Top Searches',
    eyebrow: 'What everyone is typing',
    icon: 'search',
    colors: ['#2B3458', '#1C223A'] as const,
    rows: [],
  },
  {
    title: 'Top Creators',
    eyebrow: 'People setting the tone',
    icon: 'sparkles',
    colors: ['#55328A', '#2A1747'] as const,
    rows: [],
  },
  {
    title: 'Top Games',
    eyebrow: 'What the feed can’t stop pushing',
    icon: 'trending-up',
    colors: ['#314A80', '#1D294A'] as const,
    rows: [],
  },
];

const createHeroSlots = (prefix: string, colors: Array<readonly [string, string]>) =>
  colors.map((pair, index) => ({
    id: `${prefix}-hero-${index + 1}`,
    title: '',
    subtitle: '',
    colors: pair,
  }));

const createCardSlots = (prefix: string, count: number, accents: string[]) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-slot-${index + 1}`,
    title: '',
    subtitle: '',
    accent: accents[index % accents.length] || '#1B2334',
  }));

const TAB_WORLDS = {
  Explore: {
    cardLabel: 'For you',
    accent: '#FFFFFF',
    accentSoft: 'rgba(255,255,255,0.14)',
    modeBannerBg: '#101010',
    modeBannerBorder: 'rgba(255,255,255,0.06)',
    chips: ['Trending', 'For You', 'Brainrot', 'Casual', '67 Energy', 'Meme', 'NPC Core', 'Satisfying'],
    defaultChip: 'For You',
    chipDescriptions: {
      'For You': 'A handpicked mix of weird tools, sticky loops, and interactive internet culture.',
      Brainrot: 'Fast, chaotic, highly shareable picks that feel born from the feed itself.',
      Casual: 'Lightweight worlds with low friction, clean hooks, and easy replay.',
      '67 Energy': 'Loud, fast, overstimulating ideas with meme gravity and no hesitation.',
      Meme: 'Formats, reactions, absurd punchlines, and content that understands internet language.',
      'NPC Core': 'Fake systems, weird characters, and uncanny roleplay energy.',
      Satisfying: 'Pattern toys, tactile loops, and experiences that feel good immediately.',
      Trending: 'A live read on what the culture is doing right now.',
    },
    heroes: createHeroSlots('explore', [
      ['#203A43', '#2C5364'] as const,
      ['#241E4E', '#0F3460'] as const,
      ['#1E1E1E', '#090909'] as const,
    ]),
    sections: [
      {
        title: "We're Obsessed",
        cards: createCardSlots('explore-obsessed', 3, ['#2A3142', '#2E3E52', '#1E2C40']),
      },
      {
        title: 'Blowing Up',
        cards: createCardSlots('explore-blowing-up', 3, ['#18283A', '#6E6047', '#182236']),
      },
    ],
    discoverTitle: 'Discover More',
    grid: createCardSlots('explore-grid', 4, ['#3A272B', '#2A2A2A', '#3B332D', '#403129']),
  },
  Games: {
    cardLabel: 'Playable',
    accent: '#F97316',
    accentSoft: 'rgba(249,115,22,0.18)',
    modeBannerBg: '#16110D',
    modeBannerBorder: 'rgba(249,115,22,0.18)',
    chips: ['For You', 'Arcade', 'Boss Rush', 'Cozy', 'Chaotic', 'Speedrun', 'Simulator'],
    defaultChip: 'For You',
    chipDescriptions: {
      'For You': 'Game picks with stronger loops, clearer mechanics, and the most replay pressure.',
      Arcade: 'Tighter systems, visible score gravity, and simple mechanics done confidently.',
      'Boss Rush': 'Combat-heavy picks with stronger pressure and clearer win states.',
      Cozy: 'Softer pacing, friendlier staging, and lower-stress loops.',
      Chaotic: 'Messier, louder, higher-energy games that still keep their hook readable.',
      Speedrun: 'Fast restart loops, timer pressure, and skill expression up front.',
      Simulator: 'Role fantasy first: drive it, run it, manage it, or break it.',
    },
    heroes: createHeroSlots('games', [
      ['#30003C', '#0F101D'] as const,
      ['#16314A', '#0A1724'] as const,
    ]),
    sections: [
      {
        title: "Everyone's Playing",
        cards: createCardSlots('games-playing', 3, ['#25324A', '#3A3649', '#273D43']),
      },
      {
        title: 'Deep Cuts',
        cards: createCardSlots('games-deep-cuts', 3, ['#1C2438', '#514A36', '#222F49']),
      },
    ],
    discoverTitle: 'More Games',
    grid: createCardSlots('games-grid', 4, ['#533331', '#3A272B', '#493040', '#403129']),
  },
  Horror: {
    cardLabel: 'Unsettling',
    accent: '#EF4444',
    accentSoft: 'rgba(239,68,68,0.16)',
    modeBannerBg: '#140B0C',
    modeBannerBorder: 'rgba(239,68,68,0.16)',
    chips: ['For You', 'Found Footage', 'Cursed Feed', 'Psychological', 'Paranormal', 'Escape', 'Night Shift'],
    defaultChip: 'For You',
    chipDescriptions: {
      'For You': 'The strongest horror picks with the cleanest first-frame dread.',
      'Found Footage': 'Glitch, camcorder, and fake-evidence horror with rougher texture.',
      'Cursed Feed': 'Social interfaces, fake posts, and horror born inside a scrolling system.',
      Psychological: 'Minimal, typography-first, mood-heavy experiences that get under your skin.',
      Paranormal: 'Ghosts, rituals, hauntings, and ambient supernatural tension.',
      Escape: 'Pressure, locked spaces, clues, and survival through interaction.',
      'Night Shift': 'Late-night jobs, strange customers, and the feeling that something is off.',
    },
    heroes: createHeroSlots('horror', [
      ['#181818', '#050505'] as const,
      ['#260B0C', '#090909'] as const,
    ]),
    sections: [
      {
        title: 'For You',
        cards: createCardSlots('horror-for-you', 3, ['#1D1214', '#1E2734', '#281E1A']),
      },
      {
        title: 'Late Night Finds',
        cards: createCardSlots('horror-late-night', 3, ['#24090A', '#1E2028', '#2B1E18']),
      },
    ],
    discoverTitle: 'More Horror',
    grid: createCardSlots('horror-grid', 4, ['#21273B', '#3B3025', '#29312C', '#2D1A14']),
  },
  Quiz: {
    cardLabel: 'Challenge',
    accent: '#22C55E',
    accentSoft: 'rgba(34,197,94,0.16)',
    modeBannerBg: '#0D1511',
    modeBannerBorder: 'rgba(34,197,94,0.16)',
    chips: ['For You', 'Trivia', 'Geography', 'Anime', 'Brain Tease', 'Impossible', 'School Break'],
    defaultChip: 'For You',
    chipDescriptions: {
      'For You': 'The sharpest quiz loops with the best answer hierarchy and replay pull.',
      Trivia: 'Straight-up answer games that stay readable and feel rewarding to clear.',
      Geography: 'Maps, flags, places, and location-based pattern recognition.',
      Anime: 'Character cards, fandom recall, and quiz energy built for obsessed players.',
      'Brain Tease': 'Puzzles that make you pause, think twice, and still want another go.',
      Impossible: 'Bait answers, fake logic, and frustration engineered to be funny.',
      'School Break': 'Quick, social, pass-the-phone quiz energy with low commitment.',
    },
    heroes: createHeroSlots('quiz', [
      ['#11233C', '#0A101C'] as const,
      ['#1C4E58', '#10202A'] as const,
    ]),
    sections: [
      {
        title: 'Sharpest Picks',
        cards: createCardSlots('quiz-sharpest', 3, ['#2A5863', '#514348', '#24405B']),
      },
      {
        title: 'Study Break',
        cards: createCardSlots('quiz-study-break', 3, ['#3E405A', '#4B5B32', '#263A4B']),
      },
    ],
    discoverTitle: 'More Quiz',
    grid: createCardSlots('quiz-grid', 4, ['#2A5863', '#252E58', '#4D5166', '#34526A']),
  },
  Roleplay: {
    cardLabel: 'Story',
    accent: '#EC4899',
    accentSoft: 'rgba(236,72,153,0.16)',
    modeBannerBg: '#170D14',
    modeBannerBorder: 'rgba(236,72,153,0.16)',
    chips: ['Recommend', 'Immersive Worlds', 'Boyfriend', 'Girlfriend', 'Romance', 'Drama', 'Fantasy'],
    defaultChip: 'Recommend',
    chipDescriptions: {
      Recommend: 'The strongest character worlds, poster covers, and emotional hooks right now.',
      'Immersive Worlds': 'Larger universes with stronger atmosphere and better world identity.',
      Boyfriend: 'Character-first fantasy with direct emotional attention and stronger persona hooks.',
      Girlfriend: 'Playful, intense, and aesthetic relationship-driven scenarios.',
      Romance: 'Cleaner chemistry, longing, and emotionally sticky scene writing.',
      Drama: 'Higher stakes, conflict, secrets, and bigger social tension.',
      Fantasy: 'Mythic settings, magical aesthetics, and larger-than-life roleplay worlds.',
    },
    heroes: createHeroSlots('roleplay', [
      ['#6A2B56', '#1A1829'] as const,
      ['#1F514A', '#132326'] as const,
    ]),
    sections: [
      {
        title: 'Recommend',
        cards: createCardSlots('roleplay-recommend', 3, ['#315C55', '#4A3846', '#5A3852']),
      },
      {
        title: 'Immersive Worlds',
        cards: createCardSlots('roleplay-immersive', 3, ['#4B2530', '#3C4B63', '#43324D']),
      },
    ],
    discoverTitle: 'More Roleplay',
    grid: createCardSlots('roleplay-grid', 4, ['#315C55', '#4A3846', '#4B2530', '#5A3852']),
  },
} as const;

const getSeedFromText = (value: string) =>
  value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

const getPreviewLabel = (activeTab: (typeof PRIMARY_TABS)[number], activeChip: string) => {
  switch (activeTab) {
    case 'Horror':
      return 'Preview';
    case 'Quiz':
      return 'Playable';
    case 'Roleplay':
      return 'Episode';
    default:
      return 'Game';
  }
};

type ExploreMediaKind = 'image' | 'video' | 'fallback';

type ExploreCardRecord = {
  id: string;
  gameId?: string;
  title: string;
  subtitle: string;
  accent: string;
  creator?: string;
  likes: string;
  plays: string;
  mediaKind: ExploreMediaKind;
  imageUrl?: string;
  videoUrl?: string;
};

type ExploreSectionRecord = {
  title: string;
  cards: ExploreCardRecord[];
};

type ExploreHeroRecord = {
  id: string;
  gameId?: string;
  title: string;
  subtitle: string;
  colors: readonly [string, string];
  creator?: string;
  likes: string;
  plays: string;
  mediaKind: ExploreMediaKind;
  imageUrl?: string;
  videoUrl?: string;
};

type ExploreWorldRecord = {
  cardLabel: string;
  accent: string;
  accentSoft: string;
  modeBannerBg: string;
  modeBannerBorder: string;
  chips: readonly string[];
  defaultChip: string;
  chipDescriptions: Record<string, string>;
  heroes: ExploreHeroRecord[];
  sections: ExploreSectionRecord[];
  discoverTitle: string;
  grid: ExploreCardRecord[];
};

type ExploreGameRecord = {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;
  previewVideoUrl?: string;
  preview_video_url?: string;
  videoUrl?: string;
  video_url?: string;
  color?: string;
  category?: string;
  subcategory?: string;
  primaryTab?: string;
  interactionType?: string;
  classificationTags?: string[];
  discoveryChips?: string[];
  plays?: number;
  createdAt?: string;
  recentActivityCount?: number;
  recentActivityScore?: number;
  recentScoreEvents?: number;
  recentUniqueScorers?: number;
  discoverScore?: number;
  creatorDisplayName?: string | null;
  creatorUsername?: string | null;
};

type ExploreFeedActivityRecord = {
  game?: Partial<ExploreGameRecord> & { id?: string };
  createdAt?: string;
  user?: { id?: string };
};

type ExploreRowMode =
  | 'featured'
  | 'rising'
  | 'evergreen'
  | 'sleepers'
  | 'fresh'
  | 'niche'
  | 'worldbuilding';

type ExploreRowIntent = {
  mode: ExploreRowMode;
  lane?: ExploreLaneBucketKey;
  keywords?: readonly string[];
};

type ExploreLaneBucketKey = 'rising' | 'fresh' | 'sleepers' | 'evergreen' | 'featured' | 'worldbuilding';

type ExploreLaneBuckets = Record<ExploreLaneBucketKey, ExploreGameRecord[]>;

type ExploreCreatorRecord = {
  id: string;
  username: string;
  displayName?: string | null;
  avatar?: string | null;
};

type ExploreSearchTab = 'All' | 'Creators' | 'Games';

type ExploreSearchTopic = {
  id: string;
  label: string;
  meta: string;
  hot?: boolean;
  rawCount?: number;
};

type SearchProfileUser = {
  id: string;
  username: string;
  displayName?: string;
  avatar: string | null;
  bio?: string;
  status: string;
  isOnline: boolean;
  isFriend: boolean;
};

type TrendingSummaryResponse = {
  tab: (typeof PRIMARY_TABS)[number];
  pulses?: {
    searchHeat?: number;
    creatorsRising?: number;
    gamesPopping?: number;
  };
  topSearches?: Array<{
    query: string;
    normalizedQuery?: string;
    count: number;
  }>;
  topCreators?: Array<{
    id: string;
    username: string;
    displayName?: string | null;
    avatar?: string | null;
    gameCount?: number;
    totalPlays?: number;
    recentActivityScore?: number;
  }>;
  topGames?: Array<{
    game: ExploreGameRecord;
    recentActivityScore?: number;
    discoverScore?: number;
    risingScore?: number;
  }>;
};

type TrendingChartRow = {
  label: string;
  meta?: string;
  action?: () => void;
};

type TrendingChallengeRecord = {
  title: string;
  subtitle: string;
  action?: () => void;
  thumbColors: string[];
};

type TrendingDetailMode = 'searches' | 'creators' | 'games' | 'topGames' | null;

type TopGamesResponse = {
  tab: (typeof PRIMARY_TABS)[number];
  games: Array<{
    rank: number;
    score: number;
    game: ExploreGameRecord;
  }>;
};

type ExploreDiscoverDebugResponse = {
  tab: (typeof PRIMARY_TABS)[number];
  count: number;
  games: Array<{
    game: ExploreGameRecord;
    scores: Record<string, number>;
    ranks: Record<string, number>;
    laneMemberships: string[];
    signals: Record<string, unknown>;
  }>;
};

const WORLD_CATEGORY_HINTS = {
  Explore: ['arcade', 'simulation', 'puzzle', 'story', 'io', 'creative', 'tool', 'music', 'drawing'],
  Games: ['action', 'arcade', 'runner', 'shooter', 'simulation', 'driving', 'sports', 'platformer', 'racing'],
  Horror: ['horror', 'scary', 'creepy', 'escape', 'dark', 'haunted', 'monster', 'ghost', 'survival'],
  Quiz: ['quiz', 'puzzle', 'education', 'word', 'trivia', 'memory', 'geography', 'math'],
  Roleplay: ['dress', 'girls', 'story', 'simulation', 'beauty', 'social', 'romance', 'anime', 'dating', 'fashion'],
} as const;

const inferSemanticCategory = (game: ExploreGameRecord) => {
  const rawSubcategory = (game.subcategory || '').toLowerCase().trim();
  if (rawSubcategory) {
    return rawSubcategory;
  }

  const rawCategory = (game.category || '').toLowerCase().trim();
  if (rawCategory && rawCategory !== 'ai-remix') {
    return rawCategory;
  }

  const primaryTab = String(game.primaryTab || '').trim();
  if (primaryTab === 'Horror') return 'horror';
  if (primaryTab === 'Quiz') return 'quiz';
  if (primaryTab === 'Roleplay') return 'roleplay';
  if (primaryTab === 'Games') return 'arcade';

  const tagText = Array.isArray(game.classificationTags) ? game.classificationTags.join(' ') : '';
  const interactionType = String(game.interactionType || '');
  const text = `${game.name || ''} ${game.description || ''} ${tagText} ${interactionType} ${rawSubcategory}`.toLowerCase();
  const bestMatch = Object.entries(WORLD_CATEGORY_HINTS)
    .filter(([world]) => world !== 'Explore')
    .map(([world, keywords]) => ({
      world,
      score: countKeywordHits(text, keywords),
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (!bestMatch || bestMatch.score === 0) {
    return rawCategory || 'creative';
  }

  switch (bestMatch.world) {
    case 'Games':
      return 'arcade';
    case 'Horror':
      return 'horror';
    case 'Quiz':
      return 'quiz';
    case 'Roleplay':
      return 'roleplay';
    default:
      return rawCategory || 'creative';
  }
};

const getCreatorLabel = (game?: ExploreGameRecord) => {
  const username = game?.creatorUsername?.trim();
  if (!username) return '';
  return username.startsWith('@') ? username : `@${username}`;
};

const formatCompactCount = (value?: number) => {
  const safe = Number(value || 0);
  if (!Number.isFinite(safe) || safe <= 0) return '0';
  if (safe >= 1000000) return `${(safe / 1000000).toFixed(safe >= 10000000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (safe >= 1000) return `${(safe / 1000).toFixed(safe >= 100000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `${safe}`;
};

const formatSearchCount = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${value}`;
};

const formatPulseCount = (value: number) => {
  const compact = formatSearchCount(value);
  return value >= 1000 ? `${compact}+` : compact;
};

const prettifySearchTerm = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const buildSearchGameCard = (game: ExploreGameRecord): ExploreCardRecord => {
  const imageUrl = getGameThumbnail(game);
  const videoUrl = getGamePreviewVideo(game);
  const supportingText =
    game.description?.trim() ||
    game.subcategory?.replace(/[_-]+/g, ' ') ||
    game.category?.replace(/[_-]+/g, ' ') ||
    'Playable world';

  return {
    id: `search-game:${game.id}`,
    gameId: game.id,
    title: game.name,
    subtitle: supportingText,
    accent: game.color || '#1B2334',
    creator: getCreatorLabel(game),
    likes: '',
    plays: formatCompactCount(game.plays),
    mediaKind: videoUrl ? 'video' : imageUrl ? 'image' : 'fallback',
    imageUrl,
    videoUrl,
  };
};

const buildExploreCard = (
  activeTab: (typeof PRIMARY_TABS)[number],
  activeChip: string,
  card: {
    id: string;
    title: string;
    subtitle: string;
    accent: string;
  },
): ExploreCardRecord => ({
  ...card,
  likes: '0',
  plays: '0',
  mediaKind: 'fallback',
});

const buildExploreHero = (
  activeTab: (typeof PRIMARY_TABS)[number],
  hero: {
    id: string;
    title: string;
    subtitle: string;
    colors: readonly [string, string];
  },
): ExploreHeroRecord => ({
  ...hero,
  likes: '0',
  plays: '0',
  mediaKind: 'fallback',
});

const buildWorldRecord = (
  activeTab: (typeof PRIMARY_TABS)[number],
  activeChip: string,
  world: (typeof TAB_WORLDS)[typeof PRIMARY_TABS[number]],
): ExploreWorldRecord => ({
  ...world,
  heroes: world.heroes.map((hero) => buildExploreHero(activeTab, hero)),
  sections: world.sections.map((section) => ({
    ...section,
    cards: section.cards.map((card) => buildExploreCard(activeTab, activeChip, card)),
  })),
  grid: world.grid.map((card) => buildExploreCard(activeTab, activeChip, card)),
});

const buildSlotKey = (scope: string, sourceId: string, index: number) => `${scope}:${sourceId}:${index}`;

const resolveMediaUrl = (value: string | undefined, fallbackOrigin: string) => {
  if (!value) return undefined;
  if (value.startsWith('http') || value.startsWith('data:')) return value;
  if (value.startsWith('/')) return `${API_ORIGIN}${value}`;
  return `${fallbackOrigin}/${value.replace(/^\/+/, '')}`;
};

const getGameThumbnail = (game: ExploreGameRecord) =>
  resolveMediaUrl(game.thumbnail || game.thumbnailUrl || game.thumbnail_url, CDN_ORIGIN) || `${CDN_ORIGIN}/thumbnails/${game.id}.png`;

const getGamePreviewVideo = (game: ExploreGameRecord) =>
  resolveMediaUrl(game.previewVideoUrl || game.preview_video_url || game.videoUrl || game.video_url, API_ORIGIN);

const WORLD_KEYWORDS = {
  Horror: [
    'horror',
    'scary',
    'haunted',
    'ghost',
    'monster',
    'zombie',
    'dark',
    'night',
    'escape',
    'creepy',
    'survival',
    'demon',
    'fear',
  ],
  Quiz: [
    'quiz',
    'trivia',
    'puzzle',
    'word',
    'brain',
    'guess',
    'geo',
    'map',
    'math',
    'school',
    'memory',
    'answer',
    'atlas',
  ],
  Roleplay: [
    'story',
    'romance',
    'date',
    'love',
    'boyfriend',
    'girlfriend',
    'fashion',
    'dress',
    'makeup',
    'princess',
    'anime',
    'school',
    'episode',
    'fantasy',
    'simulation',
  ],
} as const;

const CHIP_KEYWORDS = {
  Explore: {
    'For You': ['creative', 'arcade', 'simulation', 'tool', 'puzzle'],
    Brainrot: ['crazy', 'weird', 'funny', 'meme', 'cat', 'fruit', 'io', 'chaos'],
    Casual: ['casual', 'arcade', 'hypercasual', 'tap', 'idle'],
    '67 Energy': ['speed', 'rush', 'fast', 'run', 'chaos', 'action'],
    Meme: ['meme', 'funny', 'cat', 'brainrot', 'joke'],
    'NPC Core': ['story', 'simulation', 'dress', 'date', 'character'],
    Satisfying: ['puzzle', 'match', 'idle', 'slice', 'merge', 'sort'],
  },
  Games: {
    'For You': ['action', 'arcade', 'puzzle', 'racing', 'simulation'],
    Arcade: ['arcade', 'io', 'runner', 'retro', 'hypercasual'],
    'Boss Rush': ['action', 'shooter', 'combat', 'fight', 'war', 'survival'],
    Cozy: ['idle', 'farm', 'merge', 'decorate', 'dress', 'puzzle'],
    Chaotic: ['crazy', 'chaos', 'fight', 'battle', 'rush'],
    Speedrun: ['run', 'runner', 'speed', 'dash', 'parkour', 'jump'],
    Simulator: ['simulation', 'simulator', 'drive', 'car', 'truck', 'tycoon', 'manage'],
  },
  Horror: {
    'For You': ['horror', 'escape', 'dark', 'night'],
    'Found Footage': ['camera', 'footage', 'survival', 'escape'],
    'Cursed Feed': ['story', 'social', 'weird', 'meme', 'dark'],
    Psychological: ['puzzle', 'brain', 'dark', 'story', 'mystery'],
    Paranormal: ['ghost', 'haunted', 'monster', 'demon'],
    Escape: ['escape', 'survival', 'puzzle', 'maze'],
    'Night Shift': ['night', 'survival', 'manager', 'shop', 'simulation'],
  },
  Quiz: {
    'For You': ['quiz', 'trivia', 'puzzle', 'word'],
    Trivia: ['quiz', 'trivia', 'guess', 'answer'],
    Geography: ['geo', 'map', 'country', 'flag'],
    Anime: ['anime', 'character', 'dress', 'story'],
    'Brain Tease': ['puzzle', 'brain', 'logic', 'memory'],
    Impossible: ['brain', 'puzzle', 'trick', 'hard'],
    'School Break': ['quiz', 'casual', 'word', 'trivia'],
  },
  Roleplay: {
    Recommend: ['story', 'romance', 'fashion', 'anime'],
    'Immersive Worlds': ['story', 'fantasy', 'simulation', 'world'],
    Boyfriend: ['boyfriend', 'date', 'romance', 'love'],
    Girlfriend: ['girlfriend', 'date', 'romance', 'love'],
    Romance: ['romance', 'love', 'story', 'date'],
    Drama: ['story', 'school', 'episode', 'simulation'],
    Fantasy: ['fantasy', 'princess', 'magic', 'anime', 'story'],
  },
} as const;

const CHIP_CLASSIFIER_HINTS = {
  Explore: {
    'For You': ['interactive', 'playful', 'creative', 'experimental'],
    Brainrot: ['absurd', 'chaotic', 'meme', 'brainrot'],
    Casual: ['casual', 'lightweight', 'cozy', 'quick'],
    '67 Energy': ['fast', 'adrenaline', 'arcade', 'chaotic'],
    Meme: ['meme', 'funny', 'absurd', 'shitpost'],
    'NPC Core': ['character', 'social', 'story', 'roleplay'],
    Satisfying: ['satisfying', 'pattern', 'drawing_tool', 'music_toy', 'puzzle'],
  },
  Games: {
    'For You': ['playable', 'loop', 'interactive', 'arcade_loop'],
    Arcade: ['arcade_loop', 'arcade', 'score', 'reflex'],
    'Boss Rush': ['combat', 'boss', 'enemy', 'action'],
    Cozy: ['cozy', 'gentle', 'soft', 'relaxing'],
    Chaotic: ['chaotic', 'adrenaline', 'action', 'wild'],
    Speedrun: ['speed', 'runner', 'dash', 'timed'],
    Simulator: ['simulator', 'simulation', 'sandbox', 'driving', 'management'],
  },
  Horror: {
    'For You': ['horror', 'dark', 'psychological', 'horror_vignette'],
    'Found Footage': ['found-footage', 'camera', 'glitch', 'surveillance'],
    'Cursed Feed': ['feed', 'social', 'text-based', 'ui-horror'],
    Psychological: ['psychological', 'choice-based', 'text-based', 'mind-bending'],
    Paranormal: ['ghost', 'haunted', 'paranormal', 'supernatural'],
    Escape: ['escape', 'survival', 'locked-room', 'puzzle'],
    'Night Shift': ['night-shift', 'late-night', 'workplace', 'shift'],
  },
  Quiz: {
    'For You': ['quiz', 'trivia', 'brain', 'quiz_challenge'],
    Trivia: ['trivia', 'question-based', 'facts'],
    Geography: ['geography', 'country', 'map', 'atlas'],
    Anime: ['anime', 'fandom', 'character'],
    'Brain Tease': ['brain', 'logic', 'puzzle', 'memory'],
    Impossible: ['impossible', 'trick', 'hard', 'bait'],
    'School Break': ['casual', 'social', 'quick', 'classroom'],
  },
  Roleplay: {
    Recommend: ['story', 'character', 'social', 'roleplay_story'],
    'Immersive Worlds': ['world', 'fantasy', 'immersive', 'universe'],
    Boyfriend: ['boyfriend', 'dating', 'romance', 'male-lead'],
    Girlfriend: ['girlfriend', 'dating', 'romance', 'female-lead'],
    Romance: ['romance', 'love', 'chemistry', 'dating'],
    Drama: ['drama', 'conflict', 'school', 'episode'],
    Fantasy: ['fantasy', 'magic', 'mythic', 'princess'],
  },
} as const;

const CHIP_SUBCATEGORY_MATCHES = {
  Explore: {
    'For You': ['creative_tool', 'experimental', 'casual', 'satisfying'],
    Brainrot: ['brainrot', 'meme'],
    Casual: ['casual', 'satisfying'],
    '67 Energy': ['brainrot', 'arcade', 'runner'],
    Meme: ['meme', 'brainrot'],
    'NPC Core': ['immersive_world', 'romance', 'boyfriend', 'girlfriend'],
    Satisfying: ['satisfying', 'creative_tool'],
  },
  Games: {
    'For You': ['arcade', 'runner', 'racing', 'simulator', 'platformer', 'shooter'],
    Arcade: ['arcade', 'runner', 'platformer'],
    'Boss Rush': ['shooter', 'platformer'],
    Cozy: ['casual', 'simulator'],
    Chaotic: ['brainrot', 'arcade', 'runner', 'shooter'],
    Speedrun: ['runner', 'platformer', 'racing'],
    Simulator: ['simulator', 'racing'],
  },
  Horror: {
    'For You': ['psychological', 'paranormal', 'escape', 'cursed_feed'],
    'Found Footage': ['found_footage'],
    'Cursed Feed': ['cursed_feed'],
    Psychological: ['psychological'],
    Paranormal: ['paranormal'],
    Escape: ['escape'],
    'Night Shift': ['night_shift'],
  },
  Quiz: {
    'For You': ['trivia', 'geography', 'anime', 'word', 'memory', 'impossible'],
    Trivia: ['trivia'],
    Geography: ['geography'],
    Anime: ['anime'],
    'Brain Tease': ['memory', 'impossible', 'word'],
    Impossible: ['impossible'],
    'School Break': ['trivia', 'anime'],
  },
  Roleplay: {
    Recommend: ['romance', 'immersive_world', 'fantasy'],
    'Immersive Worlds': ['immersive_world', 'fantasy'],
    Boyfriend: ['boyfriend'],
    Girlfriend: ['girlfriend'],
    Romance: ['romance'],
    Drama: ['school_drama'],
    Fantasy: ['fantasy'],
  },
} as const;

const ROW_INTENTS = {
  Explore: {
    "We're Obsessed": { mode: 'featured', lane: 'featured', keywords: ['creative_tool', 'experimental', 'meme', 'brainrot'] },
    'Blowing Up': { mode: 'rising', lane: 'rising', keywords: ['arcade', 'satisfying', 'brainrot', 'casual'] },
    'Discover More': { mode: 'fresh', lane: 'fresh', keywords: ['creative_tool', 'experimental', 'satisfying'] },
  },
  Games: {
    "Everyone's Playing": { mode: 'rising', lane: 'rising', keywords: ['arcade', 'runner', 'racing', 'simulator', 'platformer', 'shooter'] },
    'Deep Cuts': { mode: 'sleepers', lane: 'sleepers', keywords: ['arcade', 'platformer', 'simulator', 'shooter'] },
    'More Games': { mode: 'fresh', lane: 'fresh', keywords: ['arcade', 'runner', 'racing', 'simulator'] },
  },
  Horror: {
    'For You': { mode: 'featured', lane: 'featured', keywords: ['psychological', 'paranormal', 'escape', 'cursed_feed'] },
    'Late Night Finds': { mode: 'niche', lane: 'sleepers', keywords: ['found_footage', 'cursed_feed', 'night_shift', 'paranormal'] },
    'More Horror': { mode: 'fresh', lane: 'fresh', keywords: ['psychological', 'paranormal', 'escape', 'found_footage'] },
  },
  Quiz: {
    'Sharpest Picks': { mode: 'featured', lane: 'featured', keywords: ['trivia', 'geography', 'anime', 'memory'] },
    'Study Break': { mode: 'sleepers', lane: 'sleepers', keywords: ['anime', 'trivia', 'word', 'memory'] },
    'More Quiz': { mode: 'fresh', lane: 'fresh', keywords: ['trivia', 'geography', 'anime', 'impossible'] },
  },
  Roleplay: {
    Recommend: { mode: 'featured', lane: 'featured', keywords: ['romance', 'fantasy', 'immersive_world', 'school_drama'] },
    'Immersive Worlds': { mode: 'worldbuilding', lane: 'worldbuilding', keywords: ['immersive_world', 'fantasy'] },
    'More Roleplay': { mode: 'fresh', lane: 'fresh', keywords: ['romance', 'boyfriend', 'girlfriend', 'fantasy'] },
  },
} as const satisfies Record<(typeof PRIMARY_TABS)[number], Record<string, ExploreRowIntent>>;

const HERO_LANE_BY_TAB = {
  Explore: 'rising',
  Games: 'rising',
  Horror: 'featured',
  Quiz: 'featured',
  Roleplay: 'worldbuilding',
} as const satisfies Record<(typeof PRIMARY_TABS)[number], ExploreLaneBucketKey>;

const EMPTY_LANE_BUCKETS: ExploreLaneBuckets = {
  rising: [],
  fresh: [],
  sleepers: [],
  evergreen: [],
  featured: [],
  worldbuilding: [],
};

const logDiscoverDebugSummary = (
  tab: (typeof PRIMARY_TABS)[number],
  debugData: ExploreDiscoverDebugResponse,
) => {
  const topByLane = (lane: ExploreLaneBucketKey) =>
    debugData.games
      .filter((entry) => entry.laneMemberships.includes(lane))
      .sort((a, b) => (a.ranks?.[lane] || 9999) - (b.ranks?.[lane] || 9999))
      .slice(0, 3)
      .map((entry) => ({
        name: entry.game.name,
        subcategory: entry.game.subcategory || entry.game.category || null,
        score: entry.scores?.[lane] || 0,
        rank: entry.ranks?.[lane] || null,
      }));

  console.log(`[ExploreDebug] ${tab}`, {
    heroLane: HERO_LANE_BY_TAB[tab],
    rising: topByLane('rising'),
    fresh: topByLane('fresh'),
    sleepers: topByLane('sleepers'),
    evergreen: topByLane('evergreen'),
    featured: topByLane('featured'),
    worldbuilding: topByLane('worldbuilding'),
  });
};

const countKeywordHits = (haystack: string, keywords: readonly string[]) =>
  keywords.reduce((count, keyword) => count + (haystack.includes(keyword) ? 1 : 0), 0);

const getActivityWeight = (createdAt?: string) => {
  if (!createdAt) return 1;
  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) return 1;
  const ageHours = Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60));
  if (ageHours <= 6) return 8;
  if (ageHours <= 24) return 6;
  if (ageHours <= 72) return 4;
  if (ageHours <= 168) return 2;
  return 1;
};

const buildActivityMetricsMap = (activity: ExploreFeedActivityRecord[]) => {
  const metrics = new Map<string, { count: number; score: number; users: Set<string> }>();

  for (const item of activity) {
    const gameId = String(item?.game?.id || '').trim();
    if (!gameId) continue;

    const entry = metrics.get(gameId) || { count: 0, score: 0, users: new Set<string>() };
    entry.count += 1;
    entry.score += getActivityWeight(item?.createdAt);
    const userId = String(item?.user?.id || '').trim();
    if (userId) {
      entry.users.add(userId);
      entry.score += 1;
    }
    metrics.set(gameId, entry);
  }

  return metrics;
};

const applyActivityMetricsToGames = (
  games: ExploreGameRecord[],
  activityMetrics: Map<string, { count: number; score: number; users: Set<string> }>,
) =>
  games.map((game) => {
    const metrics = activityMetrics.get(game.id);
    if (!metrics) {
      return {
        ...game,
        recentActivityCount: game.recentActivityCount || 0,
        recentActivityScore: game.recentActivityScore || 0,
      };
    }

    return {
      ...game,
      recentActivityCount: Math.max(game.recentActivityCount || 0, metrics.count),
      recentActivityScore: Math.max(game.recentActivityScore || 0, metrics.score + metrics.users.size),
    };
  });

const buildTrendingGamesFromActivity = (
  activity: ExploreFeedActivityRecord[],
  gamesById: Map<string, ExploreGameRecord>,
) => {
  const activityMetrics = buildActivityMetricsMap(activity);
  const trendingById = new Map<string, ExploreGameRecord>();

  for (const item of activity) {
    const gameId = String(item?.game?.id || '').trim();
    if (!gameId || trendingById.has(gameId)) continue;

    const enriched = gamesById.get(gameId);
    const game = item.game || {};
    const metrics = activityMetrics.get(gameId);

    trendingById.set(gameId, {
      id: gameId,
      name: enriched?.name || game.name || 'Untitled',
      description: enriched?.description,
      thumbnail: enriched?.thumbnail || game.thumbnail,
      thumbnailUrl: enriched?.thumbnailUrl || game.thumbnailUrl,
      thumbnail_url: enriched?.thumbnail_url || game.thumbnail_url,
      previewVideoUrl: enriched?.previewVideoUrl || game.previewVideoUrl,
      preview_video_url: enriched?.preview_video_url || game.preview_video_url,
      videoUrl: enriched?.videoUrl || game.videoUrl,
      video_url: enriched?.video_url || game.video_url,
      color: enriched?.color || game.color,
      category: enriched?.category,
      subcategory: enriched?.subcategory,
      primaryTab: enriched?.primaryTab,
      interactionType: enriched?.interactionType,
      classificationTags: enriched?.classificationTags,
      discoveryChips: enriched?.discoveryChips,
      plays: enriched?.plays,
      createdAt: enriched?.createdAt,
      recentActivityCount: metrics?.count || enriched?.recentActivityCount || 0,
      recentActivityScore: metrics?.score ? metrics.score + metrics.users.size : enriched?.recentActivityScore || 0,
      recentScoreEvents: enriched?.recentScoreEvents,
      recentUniqueScorers: enriched?.recentUniqueScorers,
      discoverScore: enriched?.discoverScore,
    });
  }

  return Array.from(trendingById.values()).sort((a, b) => {
    const activityDelta = (b.recentActivityScore || 0) - (a.recentActivityScore || 0);
    if (activityDelta !== 0) return activityDelta;
    const countDelta = (b.recentActivityCount || 0) - (a.recentActivityCount || 0);
    if (countDelta !== 0) return countDelta;
    return (b.plays || 0) - (a.plays || 0);
  });
};

const getGameAgeHours = (game: ExploreGameRecord) => {
  if (!game.createdAt) return null;
  const timestamp = Date.parse(game.createdAt);
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60));
};

const getFreshnessScore = (game: ExploreGameRecord) => {
  const ageHours = getGameAgeHours(game);
  if (ageHours === null) return 0;
  if (ageHours <= 24) return 12;
  if (ageHours <= 72) return 9;
  if (ageHours <= 168) return 5;
  return 0;
};

const getMomentumScore = (game: ExploreGameRecord) => {
  const plays = game.plays || 0;
  const ageHours = getGameAgeHours(game);
  const playPressure = Math.min(14, Math.round(plays / 18000));
  const activityPressure = Math.min(
    20,
    Math.round((game.recentActivityScore || 0) * 1.5) +
      (game.recentActivityCount || 0) +
      Math.min(8, game.recentScoreEvents || 0) +
      Math.min(6, game.recentUniqueScorers || 0),
  );
  if (ageHours === null) return playPressure + activityPressure;
  if (ageHours <= 72) return playPressure + activityPressure + 8;
  if (ageHours <= 168) return playPressure + activityPressure + 4;
  return playPressure + activityPressure;
};

const getEvergreenScore = (game: ExploreGameRecord) => {
  const plays = game.plays || 0;
  const ageHours = getGameAgeHours(game);
  const base = Math.min(16, Math.round(plays / 30000));
  if (ageHours === null) return base;
  return ageHours >= 168 ? base + 4 : base;
};

const qualifiesForHero = (
  activeTab: (typeof PRIMARY_TABS)[number],
  game: ExploreGameRecord,
) => {
  const plays = game.plays || 0;
  const recentScoreEvents = game.recentScoreEvents || 0;
  const recentUniqueScorers = game.recentUniqueScorers || 0;
  const recentActivityScore = game.recentActivityScore || 0;

  if (activeTab === 'Explore' || activeTab === 'Games') {
    return plays >= 3000 && recentScoreEvents >= 3 && recentUniqueScorers >= 2 && recentActivityScore >= 12;
  }

  return plays >= 1500 && (recentScoreEvents >= 2 || recentActivityScore >= 10);
};

const getClassifierSignalText = (game: ExploreGameRecord) => {
  const tags = Array.isArray(game.classificationTags)
    ? game.classificationTags.map((tag) => String(tag || '').trim().toLowerCase())
    : [];
  const interactionType = String(game.interactionType || '').trim().toLowerCase().replace(/_/g, '-');
  const category = String(game.category || '').trim().toLowerCase();
  const subcategory = String(game.subcategory || '').trim().toLowerCase();
  const primaryTab = String(game.primaryTab || '').trim().toLowerCase();

  return [primaryTab, category, subcategory, interactionType, ...tags].filter(Boolean).join(' ');
};

const getWorldScore = (
  activeTab: (typeof PRIMARY_TABS)[number],
  activeChip: string,
  game: ExploreGameRecord,
) => {
  const category = inferSemanticCategory(game);
  const subcategory = String(game.subcategory || '').toLowerCase();
  const primaryTab = String(game.primaryTab || '').toLowerCase();
  const name = (game.name || '').toLowerCase();
  const description = (game.description || '').toLowerCase();
  const tagText = Array.isArray(game.classificationTags) ? game.classificationTags.join(' ').toLowerCase() : '';
  const interactionType = String(game.interactionType || '').toLowerCase();
  const haystack = `${name} ${category} ${subcategory} ${description} ${tagText} ${interactionType} ${primaryTab}`;
  const classifierSignals = getClassifierSignalText(game);
  const chipKeywords =
    activeTab in CHIP_KEYWORDS
      ? (CHIP_KEYWORDS[activeTab as keyof typeof CHIP_KEYWORDS] as Record<string, readonly string[]>)[activeChip] || []
      : [];
  const chipClassifierHints =
    activeTab in CHIP_CLASSIFIER_HINTS
      ? (CHIP_CLASSIFIER_HINTS[activeTab as keyof typeof CHIP_CLASSIFIER_HINTS] as Record<string, readonly string[]>)[activeChip] || []
      : [];
  const chipSubcategoryMatches =
    activeTab in CHIP_SUBCATEGORY_MATCHES
      ? (CHIP_SUBCATEGORY_MATCHES[activeTab as keyof typeof CHIP_SUBCATEGORY_MATCHES] as Record<string, readonly string[]>)[activeChip] || []
      : [];
  const discoveryChipMatches = Array.isArray(game.discoveryChips)
    ? game.discoveryChips.filter((chip) => String(chip || '').trim().toLowerCase() === activeChip.toLowerCase()).length
    : 0;
  const playsScore = game.plays ? Math.min(8, Math.round(game.plays / 50000)) : 0;
  const discoverScore = game.discoverScore ? Math.min(18, Math.round(game.discoverScore / 10)) : 0;
  const chipScore = countKeywordHits(haystack, chipKeywords) * 3;
  const classifierChipScore = countKeywordHits(classifierSignals, chipClassifierHints) * 6;
  const subcategoryScore = chipSubcategoryMatches.includes(subcategory) ? 12 : 0;
  const discoveryChipScore = discoveryChipMatches > 0 ? 14 : 0;
  const explicitTabBoost =
    (activeTab === 'Games' && primaryTab === 'games') ||
    (activeTab === 'Horror' && primaryTab === 'horror') ||
    (activeTab === 'Quiz' && primaryTab === 'quiz') ||
    (activeTab === 'Roleplay' && primaryTab === 'roleplay')
      ? 8
      : 0;
  const hasExplicitPrimaryTab = ['games', 'horror', 'quiz', 'roleplay'].includes(primaryTab);
  const activeTabKey = activeTab.toLowerCase();

  if (activeTab !== 'Explore' && hasExplicitPrimaryTab && primaryTab !== activeTabKey) {
    return -100;
  }

  switch (activeTab) {
    case 'Games':
      return explicitTabBoost + discoveryChipScore + subcategoryScore + chipScore + classifierChipScore + playsScore + discoverScore + countKeywordHits(haystack, ['action', 'arcade', 'runner', 'shooter', 'simulation']) * 2;
    case 'Horror':
      return (
        explicitTabBoost +
        discoveryChipScore +
        subcategoryScore +
        classifierChipScore +
        discoverScore +
        countKeywordHits(haystack, WORLD_KEYWORDS.Horror) * 4 +
        chipScore +
        (/horror|escape|survival|paranormal|haunted/.test(category) ? 5 : 0) +
        playsScore
      );
    case 'Quiz':
      return (
        explicitTabBoost +
        discoveryChipScore +
        subcategoryScore +
        classifierChipScore +
        discoverScore +
        countKeywordHits(haystack, WORLD_KEYWORDS.Quiz) * 4 +
        chipScore +
        (/quiz|puzzle|education|word|trivia/.test(category) ? 5 : 0) +
        playsScore
      );
    case 'Roleplay':
      return (
        explicitTabBoost +
        discoveryChipScore +
        subcategoryScore +
        classifierChipScore +
        discoverScore +
        countKeywordHits(haystack, WORLD_KEYWORDS.Roleplay) * 4 +
        chipScore +
        (/dress|girls|story|simulation|beauty|social/.test(category) ? 5 : 0) +
        playsScore
      );
    default:
      return discoveryChipScore + subcategoryScore + chipScore + classifierChipScore + playsScore + discoverScore + countKeywordHits(haystack, ['arcade', 'simulation', 'puzzle', 'story', 'io']) * 2;
  }
};

const getGameHaystack = (game: ExploreGameRecord) => {
  const category = inferSemanticCategory(game);
  const primaryTab = String(game.primaryTab || '').toLowerCase();
  const name = (game.name || '').toLowerCase();
  const description = (game.description || '').toLowerCase();
  const tagText = Array.isArray(game.classificationTags) ? game.classificationTags.join(' ').toLowerCase() : '';
  const interactionType = String(game.interactionType || '').toLowerCase();
  const discoveryChips = Array.isArray(game.discoveryChips) ? game.discoveryChips.join(' ').toLowerCase() : '';
  return `${name} ${category} ${description} ${tagText} ${interactionType} ${primaryTab} ${discoveryChips}`;
};

const getRowIntent = (
  activeTab: (typeof PRIMARY_TABS)[number],
  sectionTitle: string,
): ExploreRowIntent => {
  const explicitIntent = ROW_INTENTS[activeTab][sectionTitle as keyof (typeof ROW_INTENTS)[typeof activeTab]];
  if (explicitIntent) {
    return explicitIntent;
  }

  const normalized = sectionTitle.toLowerCase();
  if (/playing|blowing up|trending|obsessed/.test(normalized)) return { mode: 'rising' };
  if (/deep cuts|late night|study break/.test(normalized)) return { mode: 'sleepers' };
  if (/immersive/.test(normalized)) return { mode: 'worldbuilding' };
  if (/more|discover/.test(normalized)) return { mode: 'fresh' };
  if (/for you|recommend|sharpest/.test(normalized)) return { mode: 'featured' };
  return { mode: 'featured' };
};

const scoreGameForSection = (
  activeTab: (typeof PRIMARY_TABS)[number],
  activeChip: string,
  game: ExploreGameRecord,
  sectionTitle: string,
  card: Pick<ExploreCardRecord, 'title' | 'subtitle'>,
  laneBucketSets?: Record<ExploreLaneBucketKey, Set<string>>,
) => {
  const baseScore = getWorldScore(activeTab, activeChip, game);
  if (baseScore < 0) return baseScore;

  const haystack = getGameHaystack(game);
  const sectionText = `${sectionTitle} ${card.title} ${card.subtitle}`.toLowerCase();
  const plays = game.plays || 0;
  const sectionKeywordScore = countKeywordHits(haystack, sectionText.split(/[^a-z0-9]+/).filter((token) => token.length > 2)) * 2;
  const freshnessScore = getFreshnessScore(game);
  const momentumScore = getMomentumScore(game);
  const evergreenScore = getEvergreenScore(game);
  const rowIntent = getRowIntent(activeTab, sectionTitle);
  const subcategory = String(game.subcategory || '').toLowerCase();
  const rowKeywordBoost = rowIntent.keywords?.includes(subcategory) ? 12 : 0;
  const laneModeBoost =
    rowIntent.lane === 'rising' && laneBucketSets?.rising.has(game.id)
      ? 16
      : rowIntent.lane === 'fresh' && laneBucketSets?.fresh.has(game.id)
        ? 16
      : rowIntent.lane === 'sleepers' && laneBucketSets?.sleepers.has(game.id)
          ? 14
          : rowIntent.lane === 'evergreen' && laneBucketSets?.evergreen.has(game.id)
            ? 14
            : rowIntent.lane === 'featured' && laneBucketSets?.featured.has(game.id)
              ? 16
              : rowIntent.lane === 'worldbuilding' && laneBucketSets?.worldbuilding.has(game.id)
                ? 18
            : 0;

  let modeScore = 0;

  switch (rowIntent.mode) {
    case 'rising':
      modeScore += Math.min(28, momentumScore + Math.round((game.discoverScore || 0) / 14));
      modeScore += Math.round(freshnessScore / 2);
      break;
    case 'evergreen':
      modeScore += evergreenScore * 2 + Math.min(8, Math.round(plays / 70000));
      break;
    case 'sleepers':
      modeScore += Math.max(0, evergreenScore - Math.round(freshnessScore / 2));
      modeScore += plays > 0 ? Math.max(0, 12 - Math.min(12, Math.round(plays / 35000))) : 5;
      break;
    case 'fresh':
      modeScore += freshnessScore * 2 + Math.min(10, Math.round(momentumScore / 3));
      break;
    case 'niche':
      modeScore += Math.round(momentumScore / 2) + Math.max(0, 8 - Math.min(8, Math.round(plays / 50000)));
      break;
    case 'worldbuilding':
      modeScore += evergreenScore + countKeywordHits(haystack, ['story', 'world', 'fantasy', 'character', 'dialogue', 'episode']) * 3;
      break;
    case 'featured':
    default:
      modeScore += Math.min(14, Math.round(momentumScore / 2)) + Math.round(freshnessScore / 2);
      break;
  }

  return baseScore + sectionKeywordScore + rowKeywordBoost + laneModeBoost + modeScore;
};

const getSectionDiversityKey = (game: ExploreGameRecord) => {
  const semanticCategory = inferSemanticCategory(game);
  const interactionType = String(game.interactionType || '').trim().toLowerCase();
  const primaryTab = String(game.primaryTab || '').trim().toLowerCase();
  return `${primaryTab}|${semanticCategory}|${interactionType}`;
};

const mergeLiveGamesIntoWorld = (
  world: ExploreWorldRecord,
  activeTab: (typeof PRIMARY_TABS)[number],
  liveGames: ExploreGameRecord[],
  trendingGames: ExploreGameRecord[],
  activeChip: string,
  laneBuckets?: ExploreLaneBuckets,
) => {
  const sourceGames = activeChip === 'Trending' && trendingGames.length ? trendingGames : liveGames;
  if (!sourceGames.length) return world;

  const ranked = sourceGames
    .map((game) => ({
      game,
      score: getWorldScore(activeTab, activeChip, game),
    }))
    .sort((a, b) => b.score - a.score);

  const minimumScore = activeTab === 'Explore' ? 1 : 3;
  const matching = ranked.filter((entry) => entry.score >= minimumScore).map((entry) => entry.game);
  const fallback = activeTab === 'Explore'
    ? (matching.length ? matching : ranked.map((entry) => entry.game))
    : matching;

  const laneGames = Object.values(laneBuckets || EMPTY_LANE_BUCKETS).flat();
  const laneCandidateGames = laneGames.filter((game, index, array) => !!game?.id && array.findIndex((item) => item.id === game.id) === index);
  const allCandidates = [...fallback, ...laneCandidateGames];

  if (!allCandidates.length) return world;

  const availableGames = allCandidates.filter((game, index, array) => !!game?.id && array.findIndex((item) => item.id === game.id) === index);
  const assignedIds = new Set<string>();
  const rowSlots = world.sections.reduce((count, section) => count + section.cards.length, 0) + world.grid.length;
  const laneBucketSets = {
    rising: new Set((laneBuckets?.rising || []).map((game) => game.id)),
    fresh: new Set((laneBuckets?.fresh || []).map((game) => game.id)),
    sleepers: new Set((laneBuckets?.sleepers || []).map((game) => game.id)),
    evergreen: new Set((laneBuckets?.evergreen || []).map((game) => game.id)),
    featured: new Set((laneBuckets?.featured || []).map((game) => game.id)),
    worldbuilding: new Set((laneBuckets?.worldbuilding || []).map((game) => game.id)),
  };

  const claimBestGame = (
    scoreFn: (game: ExploreGameRecord) => number,
    options?: { blockedDiversityKeys?: Set<string>; preferredGames?: ExploreGameRecord[] },
  ) => {
    let bestGame: ExploreGameRecord | undefined;
    let bestScore = -Infinity;
    let fallbackGame: ExploreGameRecord | undefined;
    let fallbackScore = -Infinity;
    const blockedDiversityKeys = options?.blockedDiversityKeys;
    const candidatePool = options?.preferredGames?.length
      ? [
          ...options.preferredGames.filter((game, index, array) => !!game?.id && array.findIndex((item) => item.id === game.id) === index),
          ...availableGames,
        ]
      : availableGames;

    for (const game of candidatePool) {
      if (!game?.id || assignedIds.has(game.id)) continue;
      const score = scoreFn(game);
      if (score > fallbackScore) {
        fallbackScore = score;
        fallbackGame = game;
      }

      const diversityKey = getSectionDiversityKey(game);
      if (blockedDiversityKeys?.has(diversityKey)) continue;

      if (score > bestScore) {
        bestScore = score;
        bestGame = game;
      }
    }

    const pickedGame = bestGame && bestScore >= minimumScore
      ? bestGame
      : fallbackGame && fallbackScore >= minimumScore
        ? fallbackGame
        : undefined;

    if (!pickedGame) return undefined;
    assignedIds.add(pickedGame.id);
    return pickedGame;
  };

  const injectGame = (
    card: ExploreCardRecord,
    sectionTitle: string,
    sectionDiversityKeys: Set<string>,
  ): ExploreCardRecord => {
    const rowIntent = getRowIntent(activeTab, sectionTitle);
    const preferredLaneGames =
      rowIntent.lane === 'rising'
        ? laneBuckets?.rising
        : rowIntent.lane === 'fresh'
          ? laneBuckets?.fresh
          : rowIntent.lane === 'sleepers'
            ? laneBuckets?.sleepers
            : rowIntent.lane === 'evergreen'
              ? laneBuckets?.evergreen
              : rowIntent.lane === 'featured'
                ? laneBuckets?.featured
                : rowIntent.lane === 'worldbuilding'
                  ? laneBuckets?.worldbuilding
              : undefined;
    const game = claimBestGame(
      (candidate) => scoreGameForSection(activeTab, activeChip, candidate, sectionTitle, card, laneBucketSets),
      { blockedDiversityKeys: sectionDiversityKeys, preferredGames: preferredLaneGames },
    );
    if (!game) return card;
    const previewVideoUrl = getGamePreviewVideo(game);
    sectionDiversityKeys.add(getSectionDiversityKey(game));

    return {
      ...card,
      id: game.id,
      gameId: game.id,
      title: game.name,
      subtitle: inferSemanticCategory(game) || card.subtitle,
      accent: game.color || card.accent,
      creator: getCreatorLabel(game),
      likes: '0',
      plays: formatCompactCount(game.plays),
      mediaKind: (previewVideoUrl ? 'video' : 'image') as ExploreMediaKind,
      imageUrl: getGameThumbnail(game),
      videoUrl: previewVideoUrl,
    };
  };

  const preferredHeroLaneGames = (laneBuckets?.[HERO_LANE_BY_TAB[activeTab]] || []).filter((game) =>
    qualifiesForHero(activeTab, game),
  );

  const heroCandidates = preferredHeroLaneGames
    .sort((a, b) => {
      const heroScoreA = getEvergreenScore(a) + Math.round(getMomentumScore(a) / 2) + getFreshnessScore(a);
      const heroScoreB = getEvergreenScore(b) + Math.round(getMomentumScore(b) / 2) + getFreshnessScore(b);
      const heroDelta = heroScoreB - heroScoreA;
      if (heroDelta !== 0) return heroDelta;
      const playDelta = (b.plays || 0) - (a.plays || 0);
      if (playDelta !== 0) return playDelta;
      return getWorldScore(activeTab, activeChip, b) - getWorldScore(activeTab, activeChip, a);
    })
    .filter((game, index, array) => !!game?.id && !assignedIds.has(game.id) && array.findIndex((item) => item.id === game.id) === index);

  const shouldInjectHeroes = heroCandidates.length >= Math.min(world.heroes.length, 2);
  let heroCursor = 0;

  const nextHeroGame = () => {
    if (!shouldInjectHeroes || heroCursor >= heroCandidates.length) return undefined;
    const game = heroCandidates[heroCursor];
    heroCursor += 1;
    return game;
  };

  return {
    ...world,
    heroes: world.heroes.map((hero, index) => {
      const game = nextHeroGame();
      if (!game) return hero;
      const previewVideoUrl = getGamePreviewVideo(game);
      return {
        ...hero,
        id: buildSlotKey('hero', game.id, index),
        gameId: game.id,
        title: game.name,
        subtitle: `${inferSemanticCategory(game)} right now`,
        creator: getCreatorLabel(game),
        likes: '0',
        plays: formatCompactCount(game.plays),
        mediaKind: (previewVideoUrl ? 'video' : 'image') as ExploreMediaKind,
        imageUrl: getGameThumbnail(game),
        videoUrl: previewVideoUrl,
      };
    }),
    sections: world.sections.map((section) => {
      const diversityKeys = new Set<string>();
      return {
        ...section,
        cards: section.cards.map((card, index) => {
          const injected = injectGame(card, section.title, diversityKeys);
          return {
            ...injected,
            id: buildSlotKey(`section:${section.title}`, injected.id, index),
          };
        }),
      };
    }),
    grid: (() => {
      const diversityKeys = new Set<string>();
      return world.grid.map((card, index) => {
      const injected = injectGame(card, world.discoverTitle, diversityKeys);
      return {
        ...injected,
        id: buildSlotKey('grid', injected.id, index),
      };
      });
    })(),
  };
};

const getCardSurfaceTone = (card: { accent: string; mediaKind: ExploreMediaKind; imageUrl?: string }) =>
  card.mediaKind === 'image' && card.imageUrl ? '#0F1117' : card.accent;

type ExploreMediaStageProps = {
  title: string;
  accent: string;
  mediaKind: ExploreMediaKind;
  imageUrl?: string;
  videoUrl?: string;
  previewLabel: string;
  badgeLabel: string;
  badgeTone: string;
  badgeBackground: string;
  fullBleed?: boolean;
  titleOverlay: string;
  subtitleOverlay: string;
  creatorOverlay?: string;
  metricsOverlay: string;
};

const ExploreMediaStage: React.FC<ExploreMediaStageProps> = ({
  title,
  accent,
  mediaKind,
  imageUrl,
  videoUrl,
  fullBleed = false,
  titleOverlay,
  creatorOverlay,
  metricsOverlay,
}) => {
  const seed = getSeedFromText(title);
  const showImage = mediaKind === 'image' && !!imageUrl;
  const motionPreview = mediaKind === 'video';
  const showVideo = motionPreview && !!videoUrl;

  return (
    <View style={[styles.cardMediaArea, fullBleed && styles.cardMediaAreaFullBleed, showImage && styles.cardMediaAreaImage]}>
      {showVideo ? (
        <>
          <Video
            source={{ uri: videoUrl }}
            style={styles.cardMediaImage}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.14)', 'rgba(0,0,0,0.02)', 'rgba(0,0,0,0.46)']}
            style={styles.cardMediaImageOverlay}
          />
        </>
      ) : showImage ? (
        <>
          <Image source={{ uri: imageUrl }} style={styles.cardMediaImage} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.18)', 'rgba(0,0,0,0.02)', 'rgba(0,0,0,0.3)']}
            style={styles.cardMediaImageOverlay}
          />
        </>
      ) : (
        <>
          <LinearGradient
            colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)']}
            style={styles.cardMediaGlow}
          />
          <View
            style={[
              styles.cardMediaOrb,
              {
                backgroundColor: `${accent}33`,
                transform: [
                  { translateX: seed % 36 },
                  { translateY: (seed % 28) - 12 },
                ],
              },
            ]}
          />
          <View
            style={[
              styles.cardMediaPanel,
              {
                backgroundColor: `${accent}1D`,
                transform: [{ rotate: `${(seed % 12) - 6}deg` }],
              },
            ]}
          />
          <View
            style={[
              styles.cardMediaLine,
              {
                backgroundColor: `${accent}55`,
                width: 78 + (seed % 26),
                top: 44 + (seed % 30),
              },
            ]}
          />
          <View
            style={[
              styles.cardMediaLine,
              {
                backgroundColor: 'rgba(255,255,255,0.22)',
                width: 46 + (seed % 18),
                top: 82 + (seed % 22),
                left: 18 + (seed % 16),
              },
            ]}
          />
        </>
      )}

      {motionPreview ? (
        <View style={styles.cardVideoPulse}>
          <Ionicons name="play" size={20} color="#FFF" />
        </View>
      ) : null}

      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.16)', 'rgba(0,0,0,0.84)']}
        style={styles.cardTextOverlay}
      >
        <Text style={styles.cardOverlayTitle} numberOfLines={2}>{titleOverlay}</Text>
        {!!creatorOverlay && (
          <Text style={styles.cardOverlayCreator} numberOfLines={1}>{creatorOverlay}</Text>
        )}
        <Text style={styles.cardOverlayMetrics} numberOfLines={1}>{metricsOverlay}</Text>
      </LinearGradient>
    </View>
  );
};

export const ExploreScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuth();
  const { showAuthScreen, showLoginScreen } = useAuthScreen();
  const { setActiveTab: setRootTab } = useNavigation();
  const { openSharedGame } = useDeepLink();
  const [activeTab, setActiveTab] = useState<(typeof PRIMARY_TABS)[number]>('Explore');
  const [activeChip, setActiveChip] = useState('For You');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [searchTab, setSearchTab] = useState<ExploreSearchTab>('All');
  const [searchCreators, setSearchCreators] = useState<ExploreCreatorRecord[]>([]);
  const [searchGames, setSearchGames] = useState<ExploreGameRecord[]>([]);
  const [trackedSearchTopics, setTrackedSearchTopics] = useState<Array<{ query: string; count?: number }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [trendingDetailMode, setTrendingDetailMode] = useState<TrendingDetailMode>(null);
  const [followLoadingIds, setFollowLoadingIds] = useState<Set<string>>(new Set());
  const [followedCreatorIds, setFollowedCreatorIds] = useState<Set<string>>(new Set());
  const [selectedSearchProfile, setSelectedSearchProfile] = useState<SearchProfileUser | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [incomingHeroIndex, setIncomingHeroIndex] = useState<number | null>(null);
  const [liveGames, setLiveGames] = useState<ExploreGameRecord[]>([]);
  const [trendingGames, setTrendingGames] = useState<ExploreGameRecord[]>([]);
  const [discoverLaneBuckets, setDiscoverLaneBuckets] = useState<ExploreLaneBuckets>(EMPTY_LANE_BUCKETS);
  const [trendingSummary, setTrendingSummary] = useState<TrendingSummaryResponse | null>(null);
  const [topGamesSummary, setTopGamesSummary] = useState<TopGamesResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const heroTranslateX = useRef(new Animated.Value(0)).current;
  const heroOpacity = useRef(new Animated.Value(1)).current;
  const heroIncomingTranslateX = useRef(new Animated.Value(0)).current;
  const heroIncomingOpacity = useRef(new Animated.Value(1)).current;
  const heroAnimatingRef = useRef(false);
  const heroAutoPlayPausedRef = useRef(false);
  const heroResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrackedSearchRef = useRef('');

  const tabWorld = useMemo(() => {
    const shaped = buildWorldRecord(activeTab, activeChip, TAB_WORLDS[activeTab]);
    return mergeLiveGamesIntoWorld(shaped, activeTab, liveGames, trendingGames, activeChip, discoverLaneBuckets);
  }, [activeTab, activeChip, liveGames, trendingGames, discoverLaneBuckets]);
  const visibleHeroes = useMemo(() => tabWorld.heroes.filter((item) => !!item.gameId), [tabWorld.heroes]);
  const heroCount = visibleHeroes.length;
  const safeHeroIndex = heroCount ? ((heroIndex % heroCount) + heroCount) % heroCount : 0;
  const hero = visibleHeroes[safeHeroIndex];
  const incomingHero =
    incomingHeroIndex !== null
      ? visibleHeroes[incomingHeroIndex] || null
      : null;
  const isTrendingView = activeChip === 'Trending';
  const trendingSectionTitle = activeTab === 'Explore' ? 'Trending Right Now' : `${activeTab} Trending`;
  const activeChipDescription = tabWorld.chipDescriptions[activeChip as keyof typeof tabWorld.chipDescriptions] || '';
  const trimmedSearchText = searchQuery.trim();
  const trimmedSearch = trimmedSearchText.toLowerCase();
  const isSearchMode = trimmedSearch.length > 0;
  const showSearchExperience = searchActive || isSearchMode;
  const isExploreEditorialView = activeTab === 'Explore' && !isSearchMode && !isTrendingView;
  const exploreLeadCards = activeTab === 'Explore' ? (tabWorld.sections[0]?.cards ?? []).filter((card) => !!card.gameId) : [];
  const exploreSpotlightCard = exploreLeadCards[0];
  const exploreSecondaryCards =
    activeTab === 'Explore'
      ? [
          ...exploreLeadCards.slice(1, 3),
          ...((tabWorld.sections[1]?.cards ?? []).filter((card) => !!card.gameId).slice(0, 1)),
        ].slice(0, 3)
      : [];
  const exploreRabbitCards =
    activeTab === 'Explore'
      ? [
          ...(tabWorld.sections[1]?.cards ?? []).filter((card) => !!card.gameId),
          ...tabWorld.grid.filter((card) => !!card.gameId).slice(0, 2),
        ].slice(0, 5)
      : [];
  const exploreVisibleGrid = activeTab === 'Explore' ? tabWorld.grid.filter((card) => !!card.gameId) : [];
  const exploreGridLeadCard = exploreVisibleGrid[0];
  const exploreGridCards = exploreVisibleGrid.slice(1);

  const trendingChallengesTitle =
    activeTab === 'Explore' ? 'Trend Missions' : `${activeTab} Missions`;

  const openGameFromExplore = (gameId?: string) => {
    if (!gameId) return;
    openSharedGame(gameId);
    setRootTab('home');
  };

  const activateSearch = () => {
    setSearchActive(true);
  };

  const cancelSearch = () => {
    Keyboard.dismiss();
    setSearchActive(false);
    setSearchQuery('');
    setSearchTab('All');
    setSearchLoading(false);
    setSearchCreators([]);
    setSearchGames([]);
  };

  const handleSearchTopicPress = (label: string) => {
    setSearchActive(true);
    setSearchQuery(label);
    setSearchTab('All');
  };

  const openSearchProfile = (creator: ExploreCreatorRecord) => {
    setSelectedSearchProfile({
      id: creator.id,
      username: creator.username,
      displayName: creator.displayName || undefined,
      avatar: creator.avatar || null,
      bio: '',
      status: '',
      isOnline: false,
      isFriend: followedCreatorIds.has(creator.id),
    });
  };

  const handleFollowCreator = async (creatorId: string) => {
    if (!creatorId || creatorId === user?.id || followedCreatorIds.has(creatorId) || followLoadingIds.has(creatorId)) {
      return;
    }

    setFollowLoadingIds((prev) => new Set(prev).add(creatorId));
    try {
      await users.follow(creatorId);
      setFollowedCreatorIds((prev) => new Set(prev).add(creatorId));
    } catch (error) {
      // Keep this silent for now; search should stay lightweight.
    } finally {
      setFollowLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(creatorId);
        return next;
      });
    }
  };

  const pauseHeroAutoPlay = () => {
    heroAutoPlayPausedRef.current = true;
    if (heroResumeTimeoutRef.current) {
      clearTimeout(heroResumeTimeoutRef.current);
      heroResumeTimeoutRef.current = null;
    }
  };

  const resumeHeroAutoPlaySoon = () => {
    if (heroResumeTimeoutRef.current) {
      clearTimeout(heroResumeTimeoutRef.current);
    }
    heroResumeTimeoutRef.current = setTimeout(() => {
      heroAutoPlayPausedRef.current = false;
      heroResumeTimeoutRef.current = null;
    }, 2600);
  };

  const animateHeroToIndex = (targetIndex: number, direction: 1 | -1) => {
    if (!heroCount || targetIndex === safeHeroIndex || heroAnimatingRef.current) return;
    heroAnimatingRef.current = true;
    setIncomingHeroIndex(targetIndex);
    heroTranslateX.setValue(0);
    heroOpacity.setValue(1);
    heroIncomingTranslateX.setValue(direction > 0 ? 110 : -110);
    heroIncomingOpacity.setValue(0.2);

    Animated.parallel([
      Animated.timing(heroTranslateX, {
        toValue: direction > 0 ? -110 : 110,
        duration: 170,
        useNativeDriver: true,
      }),
      Animated.timing(heroOpacity, {
        toValue: 0,
        duration: 145,
        useNativeDriver: true,
      }),
      Animated.spring(heroIncomingTranslateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 120,
        friction: 12,
      }),
      Animated.timing(heroIncomingOpacity, {
        toValue: 1,
        duration: 170,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setHeroIndex(targetIndex);
      setIncomingHeroIndex(null);
      heroTranslateX.setValue(0);
      heroOpacity.setValue(1);
      heroIncomingTranslateX.setValue(0);
      heroIncomingOpacity.setValue(1);
      heroAnimatingRef.current = false;
    });
  };

  const shiftHero = (direction: 1 | -1) => {
    if (!heroCount) return;
    const nextIndex = (safeHeroIndex + direction + heroCount) % heroCount;
    animateHeroToIndex(nextIndex, direction);
  };

  const heroPanResponder = useMemo(
    () =>
      PanResponder.create({
        onPanResponderGrant: () => {
          pauseHeroAutoPlay();
        },
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 18 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderRelease: (_, gestureState) => {
          resumeHeroAutoPlaySoon();
          if (Math.abs(gestureState.dx) < 42 || Math.abs(gestureState.dx) < Math.abs(gestureState.dy)) {
            return;
          }
          shiftHero(gestureState.dx < 0 ? 1 : -1);
        },
        onPanResponderTerminate: () => {
          resumeHeroAutoPlaySoon();
        },
      }),
    [safeHeroIndex, heroCount],
  );

  const heroAnimatedStyle = {
    opacity: heroOpacity,
    transform: [{ translateX: heroTranslateX }],
  };
  const heroIncomingAnimatedStyle = {
    opacity: heroIncomingOpacity,
    transform: [{ translateX: heroIncomingTranslateX }],
  };

  const renderHeroInner = (item: ExploreHeroRecord, indicatorIndex = safeHeroIndex) => (
    <LinearGradient colors={item.colors} style={styles.heroCard}>
      {item.mediaKind === 'video' && item.videoUrl ? (
        <>
          <Video
            source={{ uri: item.videoUrl }}
            style={styles.heroMedia}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.18)', 'rgba(0,0,0,0.04)', 'rgba(0,0,0,0.72)']}
            style={styles.heroMediaOverlay}
          />
        </>
      ) : item.mediaKind === 'image' && item.imageUrl ? (
        <>
          <Image source={{ uri: item.imageUrl }} style={styles.heroMedia} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.04)', 'rgba(0,0,0,0.76)']}
            style={styles.heroMediaOverlay}
          />
        </>
      ) : null}
      <View style={[styles.heroAccentPill, { backgroundColor: tabWorld.accentSoft, borderColor: tabWorld.accent }]}>
        <View style={[styles.heroAccentDot, { backgroundColor: tabWorld.accent }]} />
        <Text style={[styles.heroAccentText, { color: tabWorld.accent }]}>{activeTab}</Text>
      </View>
      {renderHeroChrome()}
      <Text style={styles.heroClock}>10:16 PM</Text>
      <Text style={styles.heroTitle}>{item.title}</Text>
      <Text style={styles.heroSubtitle}>{item.subtitle}</Text>
      <View style={styles.heroFooter}>
        <View style={styles.heroMetaBlock}>
          {!!item.creator && <Text style={styles.heroMetaCreator}>{item.creator}</Text>}
          <Text style={styles.heroMetaStats}>
            {item.likes} likes · {item.plays} plays
          </Text>
        </View>
        <View style={styles.heroDots}>
          {visibleHeroes.map((dotItem, index) => (
            <TouchableOpacity
              key={dotItem.id}
              activeOpacity={0.85}
              onPress={() => {
                const direction = index >= safeHeroIndex ? 1 : -1;
                animateHeroToIndex(index, direction);
              }}
              style={[styles.heroDotButton, index === indicatorIndex && styles.heroDotButtonActive]}
            >
              <View style={[styles.heroDot, index === indicatorIndex && styles.heroDotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </LinearGradient>
  );

  const getDiscoveryCardStyles = (index: number) => {
    switch (activeTab) {
      case 'Games':
        return [styles.discoveryCard, index === 1 ? styles.discoveryCardTall : styles.discoveryCardWide, styles.discoveryCardGames];
      case 'Horror':
        return [styles.discoveryCard, index === 1 ? styles.discoveryCardHorrorHero : styles.discoveryCardHorrorStandard, styles.discoveryCardHorror];
      case 'Quiz':
        return [styles.discoveryCard, styles.discoveryCardQuizUniform, styles.discoveryCardQuiz];
      case 'Roleplay':
        return [styles.discoveryCard, styles.discoveryCardRoleplayPoster, styles.discoveryCardRoleplay];
      default:
        return [styles.discoveryCard, index === 1 ? styles.discoveryCardTall : styles.discoveryCardWide];
    }
  };

  const getGridCardStyles = (index: number, trendingMode: boolean) => {
    switch (activeTab) {
      case 'Games':
        return [styles.trendingCard, trendingMode ? (index % 2 === 0 ? styles.trendingCardTall : styles.trendingCardShort) : (index % 2 === 0 ? styles.trendingCardShort : styles.trendingCardTall), styles.trendingCardGames];
      case 'Horror':
        return [styles.trendingCard, trendingMode ? (index % 2 === 0 ? styles.trendingCardTall : styles.trendingCardHorrorTall) : styles.trendingCardHorrorTall, styles.trendingCardHorror];
      case 'Quiz':
        return [styles.trendingCard, styles.trendingCardQuizUniform, styles.trendingCardQuiz];
      case 'Roleplay':
        return [styles.trendingCard, styles.trendingCardRoleplayPoster, styles.trendingCardRoleplay];
      default:
        return [styles.trendingCard, trendingMode ? (index % 2 === 0 ? styles.trendingCardTall : styles.trendingCardShort) : (index % 2 === 0 ? styles.trendingCardShort : styles.trendingCardTall)];
    }
  };

  const renderHeroChrome = () => {
    switch (activeTab) {
      case 'Games':
        return (
          <View style={styles.heroChromeRow}>
            <View style={styles.heroGauge}>
              <Text style={styles.heroGaugeLabel}>RPM</Text>
              <Text style={styles.heroGaugeValue}>96,800</Text>
            </View>
            <View style={styles.heroGaugeCenter}>
              <Text style={[styles.heroGaugeCenterText, { color: tabWorld.accent }]}>R</Text>
            </View>
            <View style={styles.heroGauge}>
              <Text style={styles.heroGaugeLabel}>KM/H</Text>
              <Text style={styles.heroGaugeValue}>240</Text>
            </View>
          </View>
        );
      case 'Horror':
        return (
          <View style={styles.heroWarningStrip}>
            <Text style={styles.heroWarningText}>For You</Text>
            <Text style={styles.heroWarningDivider}>|</Text>
            <Text style={styles.heroWarningText}>Low light</Text>
            <Text style={styles.heroWarningDivider}>|</Text>
            <Text style={styles.heroWarningText}>Headphones</Text>
          </View>
        );
      case 'Quiz':
        return (
          <View style={styles.heroQuizPrompt}>
            <Text style={styles.heroQuizCounter}>Q 4/50</Text>
            <Text style={styles.heroQuizCardText}>Answer this question backwards.</Text>
          </View>
        );
      case 'Roleplay':
        return (
          <View style={styles.heroRoleplayBadge}>
            <Text style={styles.heroRoleplayBadgeText}>Episode 1</Text>
            <View style={styles.heroRoleplayDots}>
              <View style={styles.heroRoleplayDot} />
              <View style={styles.heroRoleplayDot} />
              <View style={styles.heroRoleplayDot} />
            </View>
          </View>
        );
      default:
        return (
          <View style={styles.heroExploreStrip}>
            <Text style={styles.heroExploreStripText}>Creative tools</Text>
            <Text style={styles.heroExploreStripDot}>•</Text>
            <Text style={styles.heroExploreStripText}>Interactive worlds</Text>
            <Text style={styles.heroExploreStripDot}>•</Text>
            <Text style={styles.heroExploreStripText}>Late-night ideas</Text>
          </View>
        );
    }
  };

  const getChartCardStyle = () => {
    switch (activeTab) {
      case 'Games':
        return styles.chartCardGames;
      case 'Horror':
        return styles.chartCardHorror;
      case 'Quiz':
        return styles.chartCardQuiz;
      case 'Roleplay':
        return styles.chartCardRoleplay;
      default:
        return null;
    }
  };

  const chartCardTone = getChartCardStyle();
  const radarPulses = [
    {
      ...SIGNAL_PULSES[0],
      label:
        activeTab === 'Games'
          ? 'Mechanics rising'
          : activeTab === 'Horror'
            ? 'Fear spikes'
            : activeTab === 'Quiz'
              ? 'Brain heat'
              : activeTab === 'Roleplay'
                ? 'Ship energy'
                : SIGNAL_PULSES[0].label,
      value: formatPulseCount(trendingSummary?.pulses?.searchHeat || 0),
      tone: tabWorld.accent,
    },
    {
      ...SIGNAL_PULSES[1],
      value: formatPulseCount(trendingSummary?.pulses?.creatorsRising || 0),
    },
    {
      ...SIGNAL_PULSES[2],
      value: formatPulseCount(trendingSummary?.pulses?.gamesPopping || 0),
    },
  ];

  const chartColumns = useMemo(() => {
    const topSearchRows: TrendingChartRow[] = trendingSummary?.topSearches?.length
      ? trendingSummary.topSearches.map((item) => ({
          label: item.query,
          action: () => handleSearchTopicPress(item.query),
        }))
      : [];

    const topCreatorRows: TrendingChartRow[] = trendingSummary?.topCreators?.length
      ? trendingSummary.topCreators.map((item) => ({
          label: item.displayName || item.username,
          action: () =>
            openSearchProfile({
              id: item.id,
              username: item.username,
              displayName: item.displayName || undefined,
              avatar: item.avatar || null,
            }),
        }))
      : [];

    const topGameRows: TrendingChartRow[] = topGamesSummary?.games?.length
      ? topGamesSummary.games.map((item) => ({
          label: item.game.name,
          action: () => openGameFromExplore(item.game.id),
        }))
      : [];

    return [
      { ...CHART_COLUMNS[0], rows: topSearchRows },
      { ...CHART_COLUMNS[1], rows: topCreatorRows },
      { ...CHART_COLUMNS[2], rows: topGameRows },
    ];
  }, [trendingSummary, topGamesSummary, activeTab, tabWorld.accent]);

  const trendingGridCards = useMemo(() => {
    if (trendingSummary?.topGames?.length) {
      return trendingSummary.topGames.map((item) => buildSearchGameCard(item.game));
    }
    return [];
  }, [trendingSummary, tabWorld.grid]);

  const topGameCards = useMemo(() => {
    if (topGamesSummary?.games?.length) {
      return topGamesSummary.games.map((item) => buildSearchGameCard(item.game));
    }
    return [];
  }, [topGamesSummary]);

  const trendingChallengeCards = useMemo<TrendingChallengeRecord[]>(() => {
    const liveSearchChallenges =
      trendingSummary?.topSearches?.slice(0, 2).map((item, index) => ({
        title:
          index === 0
            ? `#Make something for ${item.query}`
            : `#Remix the ${item.query} wave`,
        subtitle: `${formatSearchCount(item.count)} searches · jump into the trend`,
        action: () => handleSearchTopicPress(item.query),
        thumbColors:
          index === 0
            ? ['#5D6B34', '#8E7A40', '#A95A4E', '#4E5E9B']
            : ['#3A5A8F', '#8F4E69', '#4B7A59', '#7A5C3E'],
      })) || [];

    const liveGameChallenges =
      trendingSummary?.topGames?.slice(0, 2).map((item, index) => ({
        title:
          index === 0
            ? `#Beat ${item.game.name} before it cools`
            : `#Can you top ${item.game.name}?`,
        subtitle: `${formatSearchCount(item.game.plays || 0)} plays · open the hot game`,
        action: () => openGameFromExplore(item.game.id),
        thumbColors:
          index === 0
            ? ['#5B3F7A', '#3D6C8F', '#8B5A42', '#556B3D']
            : ['#314A80', '#6D3E6D', '#516B40', '#7A5A3A'],
      })) || [];

    return [...liveSearchChallenges, ...liveGameChallenges].slice(0, 2);
  }, [trendingSummary]);

  const trendingDetailTitle =
    trendingDetailMode === 'searches'
      ? 'Top Searches'
      : trendingDetailMode === 'creators'
        ? 'Top Creators'
        : trendingDetailMode === 'topGames'
          ? 'Top Games'
        : trendingDetailMode === 'games'
          ? trendingSectionTitle
          : '';

  const previewLabel = getPreviewLabel(activeTab, activeChip);

  const searchGameCards = useMemo(() => searchGames.map((game) => buildSearchGameCard(game)), [searchGames]);
  const searchTopTopics = useMemo(() => {
    return trackedSearchTopics.slice(0, 12).map((topic, index) => ({
      id: `tracked:${topic.query}`,
      label: topic.query,
      meta: `${formatSearchCount(topic.count || 0)} searches`,
      hot: index < 3,
      rawCount: topic.count,
    }));
  }, [trackedSearchTopics]);

  const allSearchResultCount = searchCreators.length + searchGames.length;

  useEffect(() => {
    let cancelled = false;

    if (!showSearchExperience) {
      return () => {
        cancelled = true;
      };
    }

    if (trimmedSearch.length < 2) {
      setSearchLoading(false);
      setSearchCreators([]);
      setSearchGames([]);
      return () => {
        cancelled = true;
      };
    }

    setSearchLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const [creatorData, gameData] = await Promise.all([
          users.search(trimmedSearchText),
          gamesApi.search(trimmedSearchText, 24),
        ]);

        if (cancelled) return;
        setSearchCreators(Array.isArray(creatorData?.users) ? creatorData.users : []);
        setSearchGames(Array.isArray(gameData?.games) ? gameData.games : []);
      } catch (error) {
        if (!cancelled) {
          setSearchCreators([]);
          setSearchGames([]);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [showSearchExperience, trimmedSearch, trimmedSearchText]);

  useEffect(() => {
    setHeroIndex(0);
    setActiveChip(tabWorld.defaultChip);
    setTrendingDetailMode(null);
  }, [activeTab]);

  const loadLiveGames = async () => {
    try {
      const [gamesData, feedData] = await Promise.all([
        gamesApi.list(120, 0, { sort: 'discover' }),
        feed.global(40).catch(() => ({ activity: [] })),
      ]);
      const activity = (feedData.activity || []) as ExploreFeedActivityRecord[];
      const allGames = applyActivityMetricsToGames(
        (gamesData.games || []) as ExploreGameRecord[],
        buildActivityMetricsMap(activity),
      );
      setLiveGames(allGames);
      const gamesById = new Map(allGames.map((game) => [game.id, game]));
      setTrendingGames(buildTrendingGamesFromActivity(activity, gamesById));
    } catch (error) {
      setLiveGames([]);
      setTrendingGames([]);
    }
  };

  const loadDiscoverLanes = async (tab: (typeof PRIMARY_TABS)[number]) => {
    try {
      const laneData = await gamesApi.discoverLanes(tab, 12);
      setDiscoverLaneBuckets({
        rising: Array.isArray(laneData?.lanes?.rising) ? laneData.lanes.rising : [],
        fresh: Array.isArray(laneData?.lanes?.fresh) ? laneData.lanes.fresh : [],
        sleepers: Array.isArray(laneData?.lanes?.sleepers) ? laneData.lanes.sleepers : [],
        evergreen: Array.isArray(laneData?.lanes?.evergreen) ? laneData.lanes.evergreen : [],
        featured: Array.isArray(laneData?.lanes?.featured) ? laneData.lanes.featured : [],
        worldbuilding: Array.isArray(laneData?.lanes?.worldbuilding) ? laneData.lanes.worldbuilding : [],
      });
    } catch (error) {
      setDiscoverLaneBuckets(EMPTY_LANE_BUCKETS);
    }
  };

  const loadTrendingSummary = async (tab: (typeof PRIMARY_TABS)[number]) => {
    try {
      const [summary, topGames] = await Promise.all([
        gamesApi.trendingSummary(tab, 5),
        gamesApi.top(tab, 8),
      ]);
      setTrendingSummary(summary);
      setTopGamesSummary(topGames as TopGamesResponse);
    } catch (error) {
      setTrendingSummary(null);
      setTopGamesSummary(null);
    }
  };

  const loadTrendingSearchTopics = async () => {
    try {
      const data = await searchApi.trending(12);
      setTrackedSearchTopics(Array.isArray(data?.topics) ? data.topics : []);
    } catch (error) {
      setTrackedSearchTopics([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadLiveGames(), loadDiscoverLanes(activeTab), loadTrendingSearchTopics(), loadTrendingSummary(activeTab)]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const [gamesData, feedData, trendingSearchData, trendingSummaryData, topGamesData] = await Promise.all([
          gamesApi.list(120, 0, { sort: 'discover' }),
          feed.global(40).catch(() => ({ activity: [] })),
          searchApi.trending(12).catch(() => ({ topics: [] })),
          gamesApi.trendingSummary(activeTab, 5).catch(() => null),
          gamesApi.top(activeTab, 8).catch(() => null),
        ]);
        if (!active) return;
        const activity = (feedData.activity || []) as ExploreFeedActivityRecord[];
        const allGames = applyActivityMetricsToGames(
          (gamesData.games || []) as ExploreGameRecord[],
          buildActivityMetricsMap(activity),
        );
        setLiveGames(allGames);
        const gamesById = new Map(allGames.map((game) => [game.id, game]));
        setTrendingGames(buildTrendingGamesFromActivity(activity, gamesById));
        setTrackedSearchTopics(Array.isArray(trendingSearchData?.topics) ? trendingSearchData.topics : []);
        setTrendingSummary(trendingSummaryData);
        setTopGamesSummary(topGamesData as TopGamesResponse | null);
      } catch (error) {
        if (active) {
          setLiveGames([]);
          setTrendingGames([]);
          setTrackedSearchTopics([]);
          setTrendingSummary(null);
          setTopGamesSummary(null);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    loadDiscoverLanes(activeTab);
    loadTrendingSummary(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!showSearchExperience || trimmedSearch.length < 2) return;
    if (lastTrackedSearchRef.current === trimmedSearch) return;

    lastTrackedSearchRef.current = trimmedSearch;
    searchApi.track(trimmedSearchText, 'explore').catch(() => {});
  }, [showSearchExperience, trimmedSearch, trimmedSearchText]);

  useEffect(() => {
    if (!__DEV__) return;

    let cancelled = false;

    const inspectDiscover = async () => {
      try {
        const debugData = (await gamesApi.discoverDebug(activeTab, 18)) as ExploreDiscoverDebugResponse;
        if (cancelled) return;
        logDiscoverDebugSummary(activeTab, debugData);
      } catch (error) {
        if (!cancelled) {
          console.log(`[ExploreDebug] ${activeTab} debug fetch failed`);
        }
      }
    };

    inspectDiscover();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    if (!heroCount || showSearchExperience || isTrendingView) return;

    const interval = setInterval(() => {
      if (heroAutoPlayPausedRef.current || heroAnimatingRef.current) return;
      const nextIndex = (safeHeroIndex + 1) % heroCount;
      animateHeroToIndex(nextIndex, 1);
    }, 5200);

    return () => {
      clearInterval(interval);
    };
  }, [safeHeroIndex, heroCount, showSearchExperience, isTrendingView]);

  useEffect(() => {
    return () => {
      if (heroResumeTimeoutRef.current) {
        clearTimeout(heroResumeTimeoutRef.current);
      }
    };
  }, []);

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#050505' }]}>
        <View style={styles.header}>
          <Text style={styles.logoTitle}>Explore</Text>
        </View>
        <View style={styles.authGate}>
          <Ionicons name="compass" size={64} color="rgba(255,255,255,0.25)" />
          <Text style={styles.authTitle}>Discover weird interactive worlds</Text>
          <Text style={styles.authSubtitle}>
            Sign up to browse trends, charts, quizzes, horror feeds, and creator rabbit holes.
          </Text>
          <TouchableOpacity style={styles.authPrimary} onPress={showAuthScreen}>
            <Text style={styles.authPrimaryText}>Sign Up</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={showLoginScreen}>
            <Text style={styles.authSecondaryText}>Already have an account? Log in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#050505' }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFFFFF"
            colors={['#FFFFFF']}
            progressBackgroundColor="#111111"
          />
        }
      >
        {showSearchExperience ? (
          <View style={styles.searchExperienceHeader}>
            <View style={styles.searchWrapActiveShell}>
              <Ionicons name="search" size={18} color="rgba(255,255,255,0.52)" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={activateSearch}
                autoFocus={searchActive}
                placeholder="Search creators & games"
                placeholderTextColor="rgba(255,255,255,0.34)"
                style={[styles.searchInput, styles.searchInputActive]}
                returnKeyType="search"
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
                  <Ionicons name="close" size={16} color="#0A0A0A" />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity onPress={cancelSearch} style={styles.searchCancelBtn}>
              <Text style={styles.searchCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.logoTitle}>EXPLORE</Text>
              <TouchableOpacity
                style={[styles.headerIcon, isTrendingView && { borderColor: tabWorld.modeBannerBorder, backgroundColor: tabWorld.modeBannerBg }]}
                onPress={activateSearch}
              >
                <Ionicons name="search" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchWrap, isTrendingView && { backgroundColor: tabWorld.modeBannerBg, borderColor: tabWorld.modeBannerBorder }]}>
              <Ionicons name="search" size={18} color={isTrendingView ? tabWorld.accent : 'rgba(255,255,255,0.5)'} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={activateSearch}
                placeholder="Search creators & games"
                placeholderTextColor={isTrendingView ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.35)'}
                style={[styles.searchInput, isTrendingView && styles.searchInputTrending]}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.primaryTabsRow}>
              {PRIMARY_TABS.map((tab) => {
                const active = tab === activeTab;
                return (
                  <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.primaryTabBtn}>
                    <Text style={[styles.primaryTabText, active && styles.primaryTabTextActive]}>{tab}</Text>
                    {active ? <View style={styles.primaryTabUnderline} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {tabWorld.chips.map((chip) => {
                const active = chip === activeChip;
                return (
                  <TouchableOpacity
                    key={chip}
                    onPress={() => setActiveChip(chip)}
                    style={[
                      styles.chip,
                      active && styles.chipActive,
                      active && { backgroundColor: tabWorld.accent },
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {showSearchExperience ? (
          <View style={styles.searchExperience}>
            {trimmedSearch.length >= 2 ? (
              <>
                <View style={styles.searchSummaryCard}>
                  <View style={styles.searchMetaRow}>
                    <Text style={styles.searchMetaTitle}>Results for “{trimmedSearchText}”</Text>
                    <Text style={styles.searchMetaCount}>{allSearchResultCount} found</Text>
                  </View>
                  <Text style={styles.searchSummaryText}>
                    Search across creators, games, and the ideas people are building right now.
                  </Text>
                </View>

                <View style={styles.searchTabsBar}>
                  {(['All', 'Creators', 'Games'] as ExploreSearchTab[]).map((tab) => {
                    const active = searchTab === tab;
                    return (
                      <TouchableOpacity
                        key={tab}
                        onPress={() => setSearchTab(tab)}
                        style={[styles.searchModeTab, active && styles.searchModeTabActive]}
                      >
                        <Text style={[styles.searchModeTabText, active && styles.searchModeTabTextActive]}>
                          {tab}
                        </Text>
                        {active ? <View style={styles.searchModeTabUnderline} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {searchLoading ? (
                  <View style={styles.searchLoadingState}>
                    <ActivityIndicator size="small" color={tabWorld.accent} />
                    <Text style={styles.searchLoadingText}>Searching the app...</Text>
                  </View>
                ) : allSearchResultCount > 0 ? (
                  <>
                    {(searchTab === 'All' || searchTab === 'Creators') && searchCreators.length > 0 ? (
                      <View style={[styles.section, styles.leadSection]}>
                        <View style={styles.sectionHeader}>
                          <Text style={styles.sectionTitle}>Creators</Text>
                        </View>
                        <View style={styles.creatorResultsList}>
                          {(searchTab === 'Creators' ? searchCreators : searchCreators.slice(0, 4)).map((creator) => {
                            const isSelf = creator.id === user?.id;
                            const isFollowed = followedCreatorIds.has(creator.id);
                            const isFollowBusy = followLoadingIds.has(creator.id);
                            return (
                              <TouchableOpacity key={creator.id} activeOpacity={0.88} onPress={() => openSearchProfile(creator)} style={styles.creatorResultRow}>
                                {creator.avatar ? (
                                  <Image source={{ uri: creator.avatar }} style={styles.creatorAvatar} />
                                ) : (
                                  <View style={styles.creatorAvatarFallback}>
                                    <Text style={styles.creatorAvatarInitial}>
                                      {(creator.username || creator.displayName || '?').charAt(0).toUpperCase()}
                                    </Text>
                                  </View>
                                )}
                                <View style={styles.creatorCopy}>
                                  <Text style={styles.creatorUsername} numberOfLines={1}>
                                    @{creator.username}
                                  </Text>
                                  {!!creator.displayName && creator.displayName !== creator.username ? (
                                    <Text style={styles.creatorDisplayName} numberOfLines={1}>
                                      {creator.displayName}
                                    </Text>
                                  ) : null}
                                </View>
                                <TouchableOpacity
                                  disabled={isSelf || isFollowed || isFollowBusy}
                                  onPress={() => handleFollowCreator(creator.id)}
                                  style={[
                                    styles.followButton,
                                    (isSelf || isFollowed) && styles.followButtonMuted,
                                  ]}
                                >
                                  <Text style={[styles.followButtonText, (isSelf || isFollowed) && styles.followButtonTextMuted]}>
                                    {isSelf ? 'You' : isFollowed ? 'Following' : isFollowBusy ? '...' : 'Follow'}
                                  </Text>
                                </TouchableOpacity>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}

                    {(searchTab === 'All' || searchTab === 'Games') && searchGameCards.length > 0 ? (
                      <View style={[styles.section, styles.leadSection]}>
                        <View style={styles.sectionHeader}>
                          <Text style={styles.sectionTitle}>Games</Text>
                        </View>
                        <View style={styles.searchGrid}>
                          {(searchTab === 'Games' ? searchGameCards : searchGameCards.slice(0, 6)).map((item, index) => (
                            <TouchableOpacity
                              key={item.id}
                              activeOpacity={0.9}
                              onPress={() => openGameFromExplore(item.gameId)}
                              style={[
                                ...getGridCardStyles(index, false),
                                { backgroundColor: getCardSurfaceTone(item) },
                              ]}
                            >
                              <ExploreMediaStage
                                title={item.title}
                                accent={item.accent}
                                mediaKind={item.mediaKind}
                                imageUrl={item.imageUrl}
                                videoUrl={item.videoUrl}
                                previewLabel={previewLabel}
                                badgeLabel="Game"
                                badgeTone={tabWorld.accent}
                                badgeBackground={tabWorld.accentSoft}
                                fullBleed
                                titleOverlay={item.title}
                                subtitleOverlay={item.subtitle}
                                creatorOverlay={item.creator}
                                metricsOverlay={`${item.plays} plays`}
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View style={styles.searchEmptyState}>
                    <Ionicons name="search-outline" size={28} color="rgba(255,255,255,0.34)" />
                    <Text style={styles.searchEmptyTitle}>Nothing matched yet</Text>
                    <Text style={styles.searchEmptyText}>
                      Try a creator username, game title, or a topic like horror, romance, simulator, or trivia.
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <View style={styles.searchSummaryCard}>
                  <View style={styles.searchMetaRow}>
                    <Text style={styles.searchMetaTitle}>Search creators and games</Text>
                  </View>
                  <Text style={styles.searchSummaryText}>
                    Find creators, games, and the trends people are typing into GameTok.
                  </Text>
                </View>

                <View style={[styles.section, styles.leadSection]}>
                  <View style={styles.sectionHeader}>
                    <View>
                      <Text style={styles.sectionTitle}>Top Searches</Text>
                      <Text style={styles.searchSectionEyebrow}>Hot Search Trends</Text>
                    </View>
                  </View>
                  {searchTopTopics.length ? (
                    <View style={styles.searchTrendList}>
                      {searchTopTopics.map((topic) => (
                        <TouchableOpacity key={topic.id} onPress={() => handleSearchTopicPress(topic.label)} style={styles.searchTrendRow}>
                          <View style={styles.searchTrendIconWrap}>
                            <Ionicons
                              name={topic.hot ? 'flame' : 'search'}
                              size={18}
                              color={topic.hot ? '#FB923C' : 'rgba(255,255,255,0.72)'}
                            />
                          </View>
                          <View style={styles.searchTrendCopy}>
                            <Text style={styles.searchTrendLabel}>{topic.label}</Text>
                            <Text style={styles.searchTrendMeta}>{topic.meta}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.searchEmptyState}>
                      <Ionicons name="pulse-outline" size={28} color="rgba(255,255,255,0.34)" />
                      <Text style={styles.searchEmptyTitle}>No search trends yet</Text>
                      <Text style={styles.searchEmptyText}>Trends will appear after people start searching.</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        ) : !isTrendingView ? (
          <View style={[styles.modeBanner, { backgroundColor: tabWorld.modeBannerBg, borderColor: tabWorld.modeBannerBorder }]}>
            <Text style={[styles.modeBannerLabel, { color: tabWorld.accent }]}>{activeChip}</Text>
            <Text style={styles.modeBannerText}>{activeChipDescription}</Text>
          </View>
        ) : null}

        {!showSearchExperience && !isTrendingView && hero ? (
          <View style={styles.heroWrap} {...heroPanResponder.panHandlers}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => openGameFromExplore(hero.gameId)}>
              <View style={styles.heroCardFrame}>
                <Animated.View style={[styles.heroAnimatedStage, heroAnimatedStyle]}>
                  {renderHeroInner(hero, incomingHeroIndex ?? safeHeroIndex)}
                </Animated.View>
                {incomingHero ? (
                  <Animated.View style={[styles.heroAnimatedStage, heroIncomingAnimatedStyle]}>
                    {renderHeroInner(incomingHero, incomingHeroIndex ?? safeHeroIndex)}
                  </Animated.View>
                ) : null}
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {!showSearchExperience && isTrendingView ? (
          <>
            {trendingDetailMode ? (
              <View style={[styles.section, styles.leadSection]}>
                <View style={styles.sectionHeader}>
                  <TouchableOpacity onPress={() => setTrendingDetailMode(null)} style={styles.trendingBackButton}>
                    <Ionicons name="chevron-back" size={18} color="#FFF" />
                  </TouchableOpacity>
                  <Text style={styles.sectionTitle}>{trendingDetailTitle}</Text>
                </View>

                {trendingDetailMode === 'searches' && searchTopTopics.length ? (
                  <View style={styles.searchTrendList}>
                    {searchTopTopics.map((topic) => (
                      <TouchableOpacity key={topic.id} onPress={() => handleSearchTopicPress(topic.label)} style={styles.searchTrendRow}>
                        <View style={styles.searchTrendIconWrap}>
                          <Ionicons
                            name={topic.hot ? 'flame' : 'search'}
                            size={18}
                            color={topic.hot ? '#FB923C' : 'rgba(255,255,255,0.72)'}
                          />
                        </View>
                        <View style={styles.searchTrendCopy}>
                          <Text style={styles.searchTrendLabel}>{topic.label}</Text>
                          <Text style={styles.searchTrendMeta}>{topic.meta}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                {trendingDetailMode === 'searches' && !searchTopTopics.length ? (
                  <View style={styles.searchEmptyState}>
                    <Ionicons name="pulse-outline" size={28} color="rgba(255,255,255,0.34)" />
                    <Text style={styles.searchEmptyTitle}>No search trends yet</Text>
                    <Text style={styles.searchEmptyText}>This fills from real searches once people use Explore search.</Text>
                  </View>
                ) : null}

                {trendingDetailMode === 'creators' && (trendingSummary?.topCreators || []).length ? (
                  <View style={styles.creatorResultsList}>
                    {(trendingSummary?.topCreators || []).map((creator) => {
                      const isSelf = creator.id === user?.id;
                      const isFollowed = followedCreatorIds.has(creator.id);
                      const isFollowBusy = followLoadingIds.has(creator.id);
                      return (
                        <TouchableOpacity
                          key={creator.id}
                          activeOpacity={0.88}
                          onPress={() =>
                            openSearchProfile({
                              id: creator.id,
                              username: creator.username,
                              displayName: creator.displayName || undefined,
                              avatar: creator.avatar || null,
                            })
                          }
                          style={styles.creatorResultRow}
                        >
                          {creator.avatar ? (
                            <Image source={{ uri: creator.avatar }} style={styles.creatorAvatar} />
                          ) : (
                            <View style={styles.creatorAvatarFallback}>
                              <Text style={styles.creatorAvatarInitial}>
                                {(creator.username || creator.displayName || '?').charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View style={styles.creatorCopy}>
                            <Text style={styles.creatorUsername} numberOfLines={1}>
                              @{creator.username}
                            </Text>
                            {!!creator.displayName && creator.displayName !== creator.username ? (
                              <Text style={styles.creatorDisplayName} numberOfLines={1}>
                                {creator.displayName}
                              </Text>
                            ) : null}
                          </View>
                          <TouchableOpacity
                            disabled={isSelf || isFollowed || isFollowBusy}
                            onPress={() => handleFollowCreator(creator.id)}
                            style={[styles.followButton, (isSelf || isFollowed) && styles.followButtonMuted]}
                          >
                            <Text style={[styles.followButtonText, (isSelf || isFollowed) && styles.followButtonTextMuted]}>
                              {isSelf ? 'You' : isFollowed ? 'Following' : isFollowBusy ? '...' : 'Follow'}
                            </Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
                {trendingDetailMode === 'creators' && !(trendingSummary?.topCreators || []).length ? (
                  <View style={styles.searchEmptyState}>
                    <Ionicons name="people-outline" size={28} color="rgba(255,255,255,0.34)" />
                    <Text style={styles.searchEmptyTitle}>No creator heat yet</Text>
                    <Text style={styles.searchEmptyText}>Creators will rank here from real published games and activity.</Text>
                  </View>
                ) : null}

                {trendingDetailMode === 'topGames' && topGameCards.length ? (
                  <View style={styles.trendingGrid}>
                    {topGameCards.map((item, index) => (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.9}
                        onPress={() => openGameFromExplore(item.gameId)}
                        style={[
                          ...getGridCardStyles(index, true),
                          { backgroundColor: getCardSurfaceTone(item) },
                        ]}
                      >
                        <ExploreMediaStage
                          title={item.title}
                          accent={item.accent}
                          mediaKind={item.mediaKind}
                          imageUrl={item.imageUrl}
                          videoUrl={item.videoUrl}
                          previewLabel={previewLabel}
                          badgeLabel="Top Game"
                          badgeTone="#F97316"
                          badgeBackground="rgba(249,115,22,0.16)"
                          fullBleed
                          titleOverlay={item.title}
                          subtitleOverlay={item.subtitle}
                          creatorOverlay={item.creator}
                          metricsOverlay=""
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                {trendingDetailMode === 'topGames' && !topGameCards.length ? (
                  <View style={styles.searchEmptyState}>
                    <Ionicons name="trophy-outline" size={28} color="rgba(255,255,255,0.34)" />
                    <Text style={styles.searchEmptyTitle}>No top games yet</Text>
                    <Text style={styles.searchEmptyText}>This will rank real published games by plays, likes, and saves.</Text>
                  </View>
                ) : null}

                {trendingDetailMode === 'games' && trendingGridCards.length ? (
                  <View style={styles.trendingGrid}>
                    {trendingGridCards.map((item, index) => (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.9}
                        onPress={() => openGameFromExplore(item.gameId)}
                        style={[
                          ...getGridCardStyles(index, true),
                          { backgroundColor: getCardSurfaceTone(item) },
                        ]}
                      >
                        <ExploreMediaStage
                          title={item.title}
                          accent={item.accent}
                          mediaKind={item.mediaKind}
                          imageUrl={item.imageUrl}
                          videoUrl={item.videoUrl}
                          previewLabel={previewLabel}
                          badgeLabel={tabWorld.cardLabel}
                          badgeTone={tabWorld.accent}
                          badgeBackground={tabWorld.accentSoft}
                          fullBleed
                          titleOverlay={item.title}
                          subtitleOverlay={item.subtitle}
                          creatorOverlay={item.creator}
                          metricsOverlay={`${item.likes} likes · ${item.plays}`}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                {trendingDetailMode === 'games' && !trendingGridCards.length ? (
                  <View style={styles.searchEmptyState}>
                    <Ionicons name="game-controller-outline" size={28} color="rgba(255,255,255,0.34)" />
                    <Text style={styles.searchEmptyTitle}>No trending games yet</Text>
                    <Text style={styles.searchEmptyText}>This will populate from real plays and published games.</Text>
                  </View>
                ) : null}
              </View>
            ) : (
            <>
            <View style={[styles.section, styles.leadSection]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>On The Radar</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.signalPulseRow}>
                {radarPulses.map((pulse) => (
                  <View key={pulse.id} style={[styles.signalPulse, { borderColor: `${pulse.tone}55` }]}>
                    <View style={[styles.signalPulseDot, { backgroundColor: pulse.tone }]} />
                    <Text style={styles.signalPulseLabel}>{pulse.label}</Text>
                  </View>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartRow}>
                {chartColumns.map((column) => (
                  <TouchableOpacity
                    key={column.title}
                    activeOpacity={0.92}
                    onPress={() =>
                      setTrendingDetailMode(
                        column.title === 'Top Searches'
                          ? 'searches'
                          : column.title === 'Top Creators'
                            ? 'creators'
                            : 'topGames',
                      )
                    }
                  >
                  <LinearGradient colors={column.colors} style={[styles.chartCard, chartCardTone]}>
                    <View style={styles.chartAccentOrb} />
                    <View style={[styles.chartSignalBar, { backgroundColor: tabWorld.accent }]} />
                    <View style={styles.chartHeader}>
                      <View style={styles.chartHeaderCopy}>
                        <Text style={styles.chartEyebrow}>{column.eyebrow}</Text>
                        <Text style={styles.chartTitle}>{column.title}</Text>
                      </View>
                      <View style={styles.chartIconWrap}>
                        <Ionicons name={column.icon as any} size={14} color="rgba(255,255,255,0.8)" />
                      </View>
                    </View>
                    {column.rows.length ? (
                      column.rows.map((row, index) => (
                        <TouchableOpacity
                          key={row.label}
                          activeOpacity={0.85}
                          onPress={row.action}
                          disabled={!row.action}
                          style={[styles.chartItem, index < column.rows.length - 1 && styles.chartItemBorder]}
                        >
                          <View style={[styles.chartIndexBadge, { backgroundColor: `${tabWorld.accent}22`, borderColor: `${tabWorld.accent}55` }]}>
                            <Text style={[styles.chartIndex, { color: tabWorld.accent }]}>{index + 1}</Text>
                          </View>
                          <View style={styles.chartItemCopy}>
                            <Text style={styles.chartItemText}>{row.label}</Text>
                            {row.meta ? <Text style={styles.chartItemMeta}>{row.meta}</Text> : null}
                          </View>
                          <Ionicons name="arrow-forward" size={12} color="rgba(255,255,255,0.24)" />
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={styles.chartEmptyText}>Waiting for real activity.</Text>
                    )}
                  </LinearGradient>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={[styles.section, styles.compactSection]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{trendingSectionTitle}</Text>
                <TouchableOpacity onPress={() => setTrendingDetailMode('games')}>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
              {trendingGridCards.length ? (
                <View style={styles.trendingGrid}>
                  {trendingGridCards.map((item, index) => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.9}
                      onPress={() => openGameFromExplore(item.gameId)}
                      style={[
                        ...getGridCardStyles(index, true),
                        { backgroundColor: getCardSurfaceTone(item) },
                      ]}
                    >
                      <ExploreMediaStage
                        title={item.title}
                        accent={item.accent}
                        mediaKind={item.mediaKind}
                        imageUrl={item.imageUrl}
                        videoUrl={item.videoUrl}
                        previewLabel={previewLabel}
                        badgeLabel={tabWorld.cardLabel}
                        badgeTone={tabWorld.accent}
                        badgeBackground={tabWorld.accentSoft}
                        fullBleed
                        titleOverlay={item.title}
                        subtitleOverlay={item.subtitle}
                        creatorOverlay={item.creator}
                        metricsOverlay={`${item.likes} likes · ${item.plays}`}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.searchEmptyState}>
                  <Ionicons name="game-controller-outline" size={28} color="rgba(255,255,255,0.34)" />
                  <Text style={styles.searchEmptyTitle}>No trending games yet</Text>
                  <Text style={styles.searchEmptyText}>Published games will show here once they start getting plays.</Text>
                </View>
              )}
            </View>

            {trendingChallengeCards.length ? (
            <View style={[styles.section, styles.compactSection]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>{trendingChallengesTitle}</Text>
                  <Text style={styles.sectionEyebrow}>Search waves and hot games people can jump into now.</Text>
                </View>
                <TouchableOpacity onPress={() => setTrendingDetailMode('searches')}>
                  <Text style={styles.moreText}>More</Text>
                </TouchableOpacity>
              </View>
              {trendingChallengeCards.map((challenge) => (
                <TouchableOpacity key={challenge.title} style={styles.challengeCard} activeOpacity={0.88} onPress={challenge.action}>
                  <View style={styles.challengeHeader}>
                    <Text style={styles.challengeTitle}>{challenge.title}</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                  </View>
                  <Text style={styles.challengeSubtitle}>{challenge.subtitle}</Text>
                  <View style={styles.challengeThumbRow}>
                    {challenge.thumbColors.map((color, index) => (
                      <View key={`${challenge.title}:${index}`} style={[styles.challengeThumb, { backgroundColor: color }]} />
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            ) : null}
            </>
            )}
          </>
        ) : isExploreEditorialView ? (
          <>
            {exploreSpotlightCard ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Editor&apos;s Picks</Text>
                    <Text style={styles.sectionEyebrow}>The strongest weird worlds, tools, and concepts bubbling up right now.</Text>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => openGameFromExplore(exploreSpotlightCard.gameId)}
                  style={[styles.editorialSpotlightCard, { backgroundColor: getCardSurfaceTone(exploreSpotlightCard) }]}
                >
                  <ExploreMediaStage
                    title={exploreSpotlightCard.title}
                    accent={exploreSpotlightCard.accent}
                    mediaKind={exploreSpotlightCard.mediaKind}
                    imageUrl={exploreSpotlightCard.imageUrl}
                    videoUrl={exploreSpotlightCard.videoUrl}
                    previewLabel={previewLabel}
                    badgeLabel="Featured"
                    badgeTone={tabWorld.accent}
                    badgeBackground={tabWorld.accentSoft}
                    fullBleed
                    titleOverlay={exploreSpotlightCard.title}
                    subtitleOverlay={exploreSpotlightCard.subtitle}
                    creatorOverlay={exploreSpotlightCard.creator}
                    metricsOverlay={`${exploreSpotlightCard.likes} likes · ${exploreSpotlightCard.plays}`}
                  />
                </TouchableOpacity>
                <View style={styles.editorialSecondaryGrid}>
                  {exploreSecondaryCards.map((card, index) => (
                    <TouchableOpacity
                      key={card.id}
                      activeOpacity={0.92}
                      onPress={() => openGameFromExplore(card.gameId)}
                      style={[
                        styles.editorialSecondaryCard,
                        index === 0 ? styles.editorialSecondaryCardWide : styles.editorialSecondaryCardTall,
                        { backgroundColor: getCardSurfaceTone(card) },
                      ]}
                    >
                      <ExploreMediaStage
                        title={card.title}
                        accent={card.accent}
                        mediaKind={card.mediaKind}
                        imageUrl={card.imageUrl}
                        videoUrl={card.videoUrl}
                        previewLabel={previewLabel}
                        badgeLabel="Picked"
                        badgeTone={tabWorld.accent}
                        badgeBackground={tabWorld.accentSoft}
                        fullBleed
                        titleOverlay={card.title}
                        subtitleOverlay={card.subtitle}
                        creatorOverlay={card.creator}
                        metricsOverlay={`${card.likes} likes · ${card.plays}`}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Rabbit Holes</Text>
                  <Text style={styles.sectionEyebrow}>Small experiments, strange loops, and ideas worth disappearing into.</Text>
                </View>
                <TouchableOpacity>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.editorialRailRow}>
                {exploreRabbitCards.map((card, index) => (
                  <TouchableOpacity
                    key={card.id}
                    activeOpacity={0.9}
                    onPress={() => openGameFromExplore(card.gameId)}
                    style={[
                      styles.editorialRailCard,
                      index % 3 === 0 ? styles.editorialRailCardTall : styles.editorialRailCardShort,
                      { backgroundColor: getCardSurfaceTone(card) },
                    ]}
                  >
                    <ExploreMediaStage
                      title={card.title}
                      accent={card.accent}
                      mediaKind={card.mediaKind}
                      imageUrl={card.imageUrl}
                      videoUrl={card.videoUrl}
                      previewLabel={previewLabel}
                      badgeLabel="Dive in"
                      badgeTone={tabWorld.accent}
                      badgeBackground={tabWorld.accentSoft}
                      fullBleed
                      titleOverlay={card.title}
                      subtitleOverlay={card.subtitle}
                      creatorOverlay={card.creator}
                      metricsOverlay={`${card.likes} likes · ${card.plays}`}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>{tabWorld.discoverTitle}</Text>
                  <Text style={styles.sectionEyebrow}>Broader discovery once the hero cards have done their job.</Text>
                </View>
                <TouchableOpacity>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
              {exploreGridLeadCard ? (
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => openGameFromExplore(exploreGridLeadCard.gameId)}
                  style={[styles.editorialGridLeadCard, { backgroundColor: getCardSurfaceTone(exploreGridLeadCard) }]}
                >
                  <ExploreMediaStage
                    title={exploreGridLeadCard.title}
                    accent={exploreGridLeadCard.accent}
                    mediaKind={exploreGridLeadCard.mediaKind}
                    imageUrl={exploreGridLeadCard.imageUrl}
                    videoUrl={exploreGridLeadCard.videoUrl}
                    previewLabel={previewLabel}
                    badgeLabel="Keep exploring"
                    badgeTone={tabWorld.accent}
                    badgeBackground={tabWorld.accentSoft}
                    fullBleed
                    titleOverlay={exploreGridLeadCard.title}
                    subtitleOverlay={exploreGridLeadCard.subtitle}
                    creatorOverlay={exploreGridLeadCard.creator}
                    metricsOverlay={`${exploreGridLeadCard.likes} likes · ${exploreGridLeadCard.plays}`}
                  />
                </TouchableOpacity>
              ) : null}
              <View style={styles.trendingGrid}>
                {exploreGridCards.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.9}
                    onPress={() => openGameFromExplore(item.gameId)}
                    style={[
                      ...getGridCardStyles(index, false),
                      { backgroundColor: getCardSurfaceTone(item) },
                    ]}
                  >
                    <ExploreMediaStage
                      title={item.title}
                      accent={item.accent}
                      mediaKind={item.mediaKind}
                      imageUrl={item.imageUrl}
                      videoUrl={item.videoUrl}
                      previewLabel={previewLabel}
                      badgeLabel={tabWorld.cardLabel}
                      badgeTone={tabWorld.accent}
                      badgeBackground={tabWorld.accentSoft}
                      fullBleed
                      titleOverlay={item.title}
                      subtitleOverlay={item.subtitle}
                      creatorOverlay={item.creator}
                      metricsOverlay={`${item.likes} likes · ${item.plays}`}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            {tabWorld.sections.map((section) => {
              const visibleSectionCards = section.cards.filter((card) => !!card.gameId);
              if (!visibleSectionCards.length) return null;

              return (
              <View key={section.title} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <TouchableOpacity>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCardsRow}>
                  {visibleSectionCards.map((card, index) => (
                    <TouchableOpacity
                      key={card.id}
                      activeOpacity={0.9}
                      onPress={() => openGameFromExplore(card.gameId)}
                      style={[
                        ...getDiscoveryCardStyles(index),
                        { backgroundColor: getCardSurfaceTone(card) },
                      ]}
                    >
                      <ExploreMediaStage
                        title={card.title}
                        accent={card.accent}
                        mediaKind={card.mediaKind}
                        imageUrl={card.imageUrl}
                        videoUrl={card.videoUrl}
                        previewLabel={previewLabel}
                        badgeLabel={tabWorld.cardLabel}
                        badgeTone={tabWorld.accent}
                        badgeBackground={tabWorld.accentSoft}
                        fullBleed
                        titleOverlay={card.title}
                        subtitleOverlay={card.subtitle}
                        creatorOverlay={card.creator}
                        metricsOverlay={`${card.likes} likes · ${card.plays}`}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            );
            })}

            {tabWorld.grid.some((item) => !!item.gameId) ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{tabWorld.discoverTitle}</Text>
                <TouchableOpacity>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
              <View style={styles.trendingGrid}>
                {tabWorld.grid.filter((item) => !!item.gameId).map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.9}
                    onPress={() => openGameFromExplore(item.gameId)}
                    style={[
                      ...getGridCardStyles(index, false),
                      { backgroundColor: getCardSurfaceTone(item) },
                    ]}
                  >
                    <ExploreMediaStage
                      title={item.title}
                      accent={item.accent}
                      mediaKind={item.mediaKind}
                      imageUrl={item.imageUrl}
                      videoUrl={item.videoUrl}
                      previewLabel={previewLabel}
                      badgeLabel={tabWorld.cardLabel}
                      badgeTone={tabWorld.accent}
                      badgeBackground={tabWorld.accentSoft}
                      fullBleed
                      titleOverlay={item.title}
                      subtitleOverlay={item.subtitle}
                      creatorOverlay={item.creator}
                      metricsOverlay={`${item.likes} likes · ${item.plays}`}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            ) : (
              <View style={styles.searchEmptyState}>
                <Ionicons name="game-controller-outline" size={28} color="rgba(255,255,255,0.34)" />
                <Text style={styles.searchEmptyTitle}>No games here yet</Text>
                <Text style={styles.searchEmptyText}>Once real published games match this lane, they’ll appear here.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
      <UserProfileModal
        visible={!!selectedSearchProfile}
        onClose={() => setSelectedSearchProfile(null)}
        user={selectedSearchProfile}
        onFriendStatusChange={(userId, isFriend) => {
          setFollowedCreatorIds((prev) => {
            const next = new Set(prev);
            if (isFriend) next.add(userId);
            else next.delete(userId);
            return next;
          });
          setSelectedSearchProfile((prev) => (prev && prev.id === userId ? { ...prev, isFriend } : prev));
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  logoTitle: {
    color: '#FFF',
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 4,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchExperienceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  searchWrapActiveShell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 22,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
  },
  searchInputActive: {
    color: '#FFF',
    fontSize: 15,
  },
  searchCancelBtn: {
    paddingVertical: 8,
  },
  searchCancelText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  searchClearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#0B0B0B',
    fontSize: 14,
    fontWeight: '600',
  },
  searchInputTrending: {
    color: '#FFF',
  },
  searchExperience: {
    paddingTop: 10,
  },
  primaryTabsRow: {
    gap: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  primaryTabBtn: {
    alignItems: 'center',
  },
  primaryTabText: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 16,
    fontWeight: '700',
  },
  primaryTabTextActive: {
    color: '#FFF',
  },
  primaryTabUnderline: {
    width: '100%',
    height: 2,
    borderRadius: 2,
    backgroundColor: '#FFF',
    marginTop: 6,
  },
  chipsRow: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  searchSummaryCard: {
    marginHorizontal: 16,
    marginTop: 2,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  searchMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchMetaTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    marginRight: 12,
  },
  searchMetaCount: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 12,
    fontWeight: '700',
  },
  searchSummaryText: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  searchSuggestionRow: {
    gap: 8,
    paddingTop: 12,
  },
  searchSuggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  searchSuggestionText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  searchTabsBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  searchModeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  searchModeTabText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    fontWeight: '800',
  },
  searchModeTabTextActive: {
    color: '#FF922E',
  },
  searchModeTabUnderline: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: -1,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#FF922E',
  },
  searchModeTabActive: {},
  searchLoadingState: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    paddingVertical: 24,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchLoadingText: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  creatorResultsList: {
    marginHorizontal: 16,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0F0F10',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  creatorResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  creatorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#202020',
  },
  creatorAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#232323',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarInitial: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  creatorCopy: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  creatorUsername: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  creatorDisplayName: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  followButton: {
    minWidth: 92,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF8A2A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  followButtonMuted: {
    backgroundColor: '#232323',
  },
  followButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  followButtonTextMuted: {
    color: 'rgba(255,255,255,0.7)',
  },
  searchTrendList: {
    marginHorizontal: 16,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0F0F10',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  searchTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  trendingBackButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginRight: 10,
  },
  searchTrendIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTrendCopy: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  searchTrendLabel: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  searchSectionEyebrow: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  searchTrendMeta: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  chip: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: '#FFF',
  },
  chipText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#0A0A0A',
  },
  modeBanner: {
    marginHorizontal: 16,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  modeBannerLabel: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  modeBannerText: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  heroWrap: {
    marginHorizontal: 16,
    marginTop: 10,
  },
  heroCardFrame: {
    height: 300,
    borderRadius: 24,
    overflow: 'hidden',
  },
  heroAnimatedStage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroCard: {
    height: '100%',
    borderRadius: 24,
    padding: 22,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heroMedia: {
    ...StyleSheet.absoluteFillObject,
  },
  heroMediaOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroClock: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 24,
    fontWeight: '300',
  },
  heroAccentPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroAccentDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  heroAccentText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroChromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroGauge: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroGaugeLabel: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  heroGaugeValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  heroGaugeCenter: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroGaugeCenterText: {
    fontSize: 20,
    fontWeight: '900',
  },
  heroWarningStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.16)',
  },
  heroWarningText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '700',
  },
  heroWarningDivider: {
    color: 'rgba(239,68,68,0.8)',
    marginHorizontal: 8,
    fontSize: 11,
    fontWeight: '800',
  },
  heroQuizPrompt: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    maxWidth: 250,
  },
  heroQuizCounter: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  heroQuizCardText: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  heroRoleplayBadge: {
    alignSelf: 'flex-start',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroRoleplayBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroRoleplayDots: {
    flexDirection: 'row',
    gap: 5,
  },
  heroRoleplayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  heroExploreStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexWrap: 'wrap',
  },
  heroExploreStripText: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    fontWeight: '700',
  },
  heroExploreStripDot: {
    color: 'rgba(255,255,255,0.34)',
    marginHorizontal: 8,
    fontSize: 12,
    fontWeight: '800',
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 220,
  },
  heroDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroDotButton: {
    paddingVertical: 6,
    paddingHorizontal: 3,
  },
  heroDotButtonActive: {
    transform: [{ scale: 1.02 }],
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroMetaBlock: {
    flex: 1,
  },
  heroMetaCreator: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  heroMetaStats: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  heroDotActive: {
    width: 18,
    backgroundColor: '#FFF',
  },
  section: {
    marginTop: 24,
  },
  leadSection: {
    marginTop: 14,
  },
  compactSection: {
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionEyebrow: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    maxWidth: 280,
    lineHeight: 18,
  },
  moreText: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 13,
    fontWeight: '700',
  },
  horizontalCardsRow: {
    paddingHorizontal: 16,
    paddingRight: 24,
    gap: 12,
  },
  editorialSpotlightCard: {
    marginHorizontal: 16,
    height: 340,
    borderRadius: 24,
    overflow: 'hidden',
  },
  editorialSecondaryGrid: {
    marginTop: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  editorialSecondaryCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  editorialSecondaryCardWide: {
    width: '100%',
    height: 214,
  },
  editorialSecondaryCardTall: {
    width: '48.4%',
    height: 262,
  },
  editorialRailRow: {
    paddingHorizontal: 16,
    paddingRight: 28,
    gap: 12,
  },
  editorialRailCard: {
    width: 220,
    borderRadius: 20,
    overflow: 'hidden',
  },
  editorialRailCardTall: {
    height: 296,
  },
  editorialRailCardShort: {
    height: 244,
  },
  editorialGridLeadCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    height: 250,
    borderRadius: 22,
    overflow: 'hidden',
  },
  discoveryCard: {
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'space-between',
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 14,
  },
  cardMediaArea: {
    flex: 1,
    minHeight: 92,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 14,
    justifyContent: 'space-between',
  },
  cardMediaAreaFullBleed: {
    marginBottom: 12,
    marginHorizontal: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  cardMediaAreaImage: {
    borderColor: 'rgba(255,255,255,0.03)',
    backgroundColor: '#0B0D12',
  },
  cardMediaImage: {
    ...StyleSheet.absoluteFillObject,
  },
  cardMediaImageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cardMediaGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  cardMediaOrb: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    right: -16,
    top: -12,
  },
  cardMediaPanel: {
    position: 'absolute',
    width: 92,
    height: 70,
    borderRadius: 18,
    right: 18,
    bottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardMediaLine: {
    position: 'absolute',
    left: 14,
    height: 4,
    borderRadius: 999,
  },
  cardVideoPulse: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    right: 12,
    top: 12,
    backgroundColor: 'rgba(0,0,0,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  discoveryCardWide: {
    width: 194,
    height: 238,
  },
  discoveryCardTall: {
    width: 194,
    height: 278,
  },
  discoveryCardGames: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  discoveryCardHorror: {
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.18)',
    backgroundColor: '#120E10',
  },
  discoveryCardHorrorStandard: {
    width: 194,
    height: 266,
  },
  discoveryCardHorrorHero: {
    width: 194,
    height: 302,
  },
  discoveryCardQuiz: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#15232A',
  },
  discoveryCardQuizUniform: {
    width: 194,
    height: 234,
  },
  discoveryCardRoleplay: {
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.16)',
    backgroundColor: '#1F1821',
  },
  discoveryCardRoleplayPoster: {
    width: 194,
    height: 316,
  },
  cardTextOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 46,
    paddingBottom: 14,
  },
  cardOverlayTitle: {
    color: '#FFF',
    fontSize: 19,
    lineHeight: 21,
    fontWeight: '900',
  },
  cardOverlayCreator: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 9,
  },
  cardOverlayMetrics: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  chartRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  chartCard: {
    width: 220,
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#263253',
    overflow: 'hidden',
    position: 'relative',
  },
  chartSignalBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.95,
  },
  chartCardGames: {
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.18)',
  },
  chartCardHorror: {
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.18)',
  },
  chartCardQuiz: {
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.18)',
  },
  chartCardRoleplay: {
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.18)',
  },
  searchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    rowGap: 12,
  },
  searchEmptyState: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 24,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  searchEmptyTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
  },
  searchEmptyText: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  signalPulseRow: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 12,
  },
  signalPulse: {
    minWidth: 126,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  signalPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  signalPulseLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    fontWeight: '700',
  },
  signalPulseValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  chartAccentOrb: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    top: -28,
    right: -18,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  chartHeaderCopy: {
    flex: 1,
    marginRight: 10,
  },
  chartEyebrow: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  chartTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  chartIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chartItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  chartItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  chartIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  chartIndex: {
    fontSize: 12,
    fontWeight: '800',
  },
  chartItemCopy: {
    flex: 1,
  },
  chartItemText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  chartItemMeta: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  chartEmptyText: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    paddingTop: 18,
  },
  challengeCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: '#111111',
    padding: 16,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  challengeTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    marginRight: 12,
  },
  challengeSubtitle: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  challengeThumbRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  challengeThumb: {
    width: 60,
    height: 84,
    borderRadius: 10,
  },
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    rowGap: 12,
  },
  trendingCard: {
    width: '48.9%',
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'space-between',
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  trendingCardTall: {
    height: 278,
  },
  trendingCardShort: {
    height: 228,
  },
  trendingCardGames: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  trendingCardHorror: {
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.18)',
    backgroundColor: '#120E10',
  },
  trendingCardHorrorTall: {
    height: 288,
  },
  trendingCardQuiz: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#15232A',
  },
  trendingCardQuizUniform: {
    height: 240,
  },
  trendingCardRoleplay: {
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.16)',
    backgroundColor: '#1F1821',
  },
  trendingCardRoleplayPoster: {
    height: 324,
  },
  authGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  authTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 20,
  },
  authSubtitle: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  authPrimary: {
    marginTop: 28,
    minWidth: 170,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#A855F7',
    alignItems: 'center',
  },
  authPrimaryText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  authSecondaryText: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
  },
});

export default ExploreScreen;
