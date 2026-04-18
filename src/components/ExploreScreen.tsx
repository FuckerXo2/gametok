import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
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
import { useAuth } from '../context/AuthContext';
import { useAuthScreen } from '../../App';
import { feed, games as gamesApi } from '../services/api';

const PRIMARY_TABS = ['Explore', 'Games', 'Horror', 'Quiz', 'Roleplay'] as const;
const SIGNAL_PULSES = [
  { id: 'pulse-1', label: 'Search heat', value: '49K+', tone: '#8B5CF6' },
  { id: 'pulse-2', label: 'Creators rising', value: '1.8K', tone: '#3B82F6' },
  { id: 'pulse-3', label: 'Games popping', value: '312', tone: '#F59E0B' },
];

const CHART_COLUMNS = [
  {
    title: 'Top Searches',
    eyebrow: 'What everyone is typing',
    icon: 'search',
    colors: ['#2B3458', '#1C223A'] as const,
    rows: [
      { label: 'roblox', meta: '49K searches' },
      { label: 'minecraft', meta: '44K searches' },
      { label: 'goon', meta: '44K searches' },
      { label: 'ishowspeed', meta: '43K searches' },
      { label: 'poppy playtime', meta: '40K searches' },
    ],
  },
  {
    title: 'Top Creators',
    eyebrow: 'People setting the tone',
    icon: 'sparkles',
    colors: ['#55328A', '#2A1747'] as const,
    rows: [
      { label: 'CookedBro', meta: 'building weird tiny worlds' },
      { label: 'Ospan Iskenderov', meta: 'simple tools and late-night ideas' },
      { label: 'nancy', meta: 'small things with big hooks' },
      { label: 'Sandra Velazquez', meta: 'turning caffeine into features' },
      { label: 'Lucifer sss', meta: 'exploring ideas at 3am' },
    ],
  },
  {
    title: 'Top Games',
    eyebrow: 'What the feed can’t stop pushing',
    icon: 'trending-up',
    colors: ['#314A80', '#1D294A'] as const,
    rows: [
      { label: 'Shut up Meg', meta: '551K plays' },
      { label: 'Trump Trump Escape', meta: '494K plays' },
      { label: 'Good Morning', meta: '415K plays' },
      { label: 'Flappy Hajimi', meta: '388K plays' },
      { label: 'Diddy Calling', meta: '353K plays' },
    ],
  },
];

const CHALLENGES = [
  {
    title: '#Dopamine farming until it hits',
    subtitle: '33 items · 129K played',
  },
  {
    title: '#This felt like a brain hack',
    subtitle: '78 items · 195K played',
  },
];

const SEARCH_QUICK_TERMS = ['horror', 'romance', 'simulator', 'trivia', 'brainrot', 'fantasy'];

const TRENDING_GRID = [
  { id: 'trend-1', title: 'VELVET ASCENT', subtitle: '@Bongani Sivakuma', accent: '#3A272B' },
  { id: 'trend-2', title: 'surviving dog', subtitle: '@Francisco Mano', accent: '#2A2A2A' },
  { id: 'trend-3', title: 'Cat TV', subtitle: '@doppii', accent: '#3B332D' },
  { id: 'trend-4', title: 'babysit SpongeBob', subtitle: '@Tarius Blyther', accent: '#403129' },
];

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
    heroes: [
      { id: 'hero-1', title: 'SekaiPhone OS', subtitle: 'Immersive worlds with strong identities', colors: ['#203A43', '#2C5364'] as const },
      { id: 'hero-2', title: 'Mirror Draw', subtitle: 'Creative tools that feel alive instantly', colors: ['#241E4E', '#0F3460'] as const },
      { id: 'hero-3', title: 'Void Survey', subtitle: 'Minimal experiences with a strong first frame', colors: ['#1E1E1E', '#090909'] as const },
    ],
    sections: [
      {
        title: "We're Obsessed",
        cards: [
          { id: 'obs-1', title: 'totaly legit.', subtitle: 'Wild interaction toys with strong hooks', accent: '#2A3142' },
          { id: 'obs-2', title: 'fusion unlocked', subtitle: 'Mashup systems and weird generators', accent: '#2E3E52' },
          { id: 'obs-3', title: 'draw your beat', subtitle: 'Creative tools worth replaying', accent: '#1E2C40' },
        ],
      },
      {
        title: 'Blowing Up',
        cards: [
          { id: 'blow-1', title: 'The Toy Box 2', subtitle: 'Satisfying game loops', accent: '#18283A' },
          { id: 'blow-2', title: 'Tap Me!', subtitle: 'One strong mechanic, high replayability', accent: '#6E6047' },
          { id: 'blow-3', title: 'Canvas Symphony', subtitle: 'Tools, rhythm, and pattern builders', accent: '#182236' },
        ],
      },
    ],
    discoverTitle: 'Discover More',
    grid: TRENDING_GRID,
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
    heroes: [
      { id: 'games-1', title: 'Retro Future Night Drive', subtitle: 'Fast loops, dashboard fantasy, and bigger worlds to sink into', colors: ['#30003C', '#0F101D'] as const },
      { id: 'games-2', title: 'Toy Box Arena', subtitle: 'Playable mechanics with strong first-frame hooks', colors: ['#16314A', '#0A1724'] as const },
    ],
    sections: [
      {
        title: "Everyone's Playing",
        cards: [
          { id: 'games-play-1', title: 'Shut up Meg', subtitle: 'Chaotic picks the feed keeps resurfacing', accent: '#25324A' },
          { id: 'games-play-2', title: 'Flappy Hajimi', subtitle: 'Simple loops with meme gravity', accent: '#3A3649' },
          { id: 'games-play-3', title: 'Good Morning', subtitle: 'Low-friction, high-replay game ideas', accent: '#273D43' },
        ],
      },
      {
        title: 'Deep Cuts',
        cards: [
          { id: 'games-cut-1', title: 'boss room', subtitle: 'Stronger mechanics with bolder staging', accent: '#1C2438' },
          { id: 'games-cut-2', title: 'button war', subtitle: 'One mechanic, all commitment', accent: '#514A36' },
          { id: 'games-cut-3', title: 'night runner', subtitle: 'Cleaner skill loops and stronger control fantasy', accent: '#222F49' },
        ],
      },
    ],
    discoverTitle: 'More Games',
    grid: [
      { id: 'game-grid-1', title: 'Orchard Tycoon', subtitle: '@mexico man', accent: '#533331' },
      { id: 'game-grid-2', title: 'VELVET ASCENT', subtitle: '@Bongani Sivakuma', accent: '#3A272B' },
      { id: 'game-grid-3', title: 'KUROMI OBBY', subtitle: '@Pakeeza Arzoo', accent: '#493040' },
      { id: 'game-grid-4', title: 'babysit SpongeBob', subtitle: '@Tarius Blyther', accent: '#403129' },
    ],
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
    heroes: [
      { id: 'horror-1', title: 'Void Survey', subtitle: 'Low light, strong prompts, and unsettling interaction', colors: ['#181818', '#050505'] as const },
      { id: 'horror-2', title: 'TokFeed Report', subtitle: 'Creepy feeds, fake systems, and dangerous little choices', colors: ['#260B0C', '#090909'] as const },
    ],
    sections: [
      {
        title: 'For You',
        cards: [
          { id: 'horror-fy-1', title: 'TokFeed', subtitle: 'Signals, suspicion, and UI horror', accent: '#1D1214' },
          { id: 'horror-fy-2', title: 'Please be careful', subtitle: 'Minimal dread with stronger narrative restraint', accent: '#1E2734' },
          { id: 'horror-fy-3', title: 'The Demon Night', subtitle: 'Poster-like horror cards with dark gravity', accent: '#281E1A' },
        ],
      },
      {
        title: 'Late Night Finds',
        cards: [
          { id: 'horror-late-1', title: 'ghost_id_0x7f', subtitle: 'Glitch aesthetics and cult feed energy', accent: '#24090A' },
          { id: 'horror-late-2', title: 'TRC: The Puzzle', subtitle: 'Single-room unease and staged danger', accent: '#1E2028' },
          { id: 'horror-late-3', title: 'well at midnight', subtitle: 'Textured emptiness and strong first frames', accent: '#2B1E18' },
        ],
      },
    ],
    discoverTitle: 'More Horror',
    grid: [
      { id: 'horror-grid-1', title: 'Shawarma Sentinel', subtitle: 'Please be careful', accent: '#21273B' },
      { id: 'horror-grid-2', title: 'Ran away from diddy', subtitle: '@devlooping', accent: '#3B3025' },
      { id: 'horror-grid-3', title: 'TRC: The Puzzle', subtitle: '@horrorlab', accent: '#29312C' },
      { id: 'horror-grid-4', title: 'The Demon Night', subtitle: '@latefeed', accent: '#2D1A14' },
    ],
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
    heroes: [
      { id: 'quiz-1', title: 'OmniTrivia', subtitle: 'Readable systems, bright cards, and addicting answer loops', colors: ['#11233C', '#0A101C'] as const },
      { id: 'quiz-2', title: 'GeoTouch Atlas', subtitle: 'Maps, categories, and fast pattern recognition', colors: ['#1C4E58', '#10202A'] as const },
    ],
    sections: [
      {
        title: 'Sharpest Picks',
        cards: [
          { id: 'quiz-sharp-1', title: 'GeoTouch Atlas', subtitle: 'Interactive geography and quick recall', accent: '#2A5863' },
          { id: 'quiz-sharp-2', title: 'Impossible 50', subtitle: 'Bait answers and playful frustration', accent: '#514348' },
          { id: 'quiz-sharp-3', title: 'Answer Trivia', subtitle: 'Minimal layouts with strong answer hierarchy', accent: '#24405B' },
        ],
      },
      {
        title: 'Study Break',
        cards: [
          { id: 'quiz-break-1', title: 'Guess the Vocaloid', subtitle: 'Character cards and fan quiz energy', accent: '#3E405A' },
          { id: 'quiz-break-2', title: 'brain test', subtitle: 'Impossible questions with social replay value', accent: '#4B5B32' },
          { id: 'quiz-break-3', title: 'currency duel', subtitle: 'Short loops that still feel designed', accent: '#263A4B' },
        ],
      },
    ],
    discoverTitle: 'More Quiz',
    grid: [
      { id: 'quiz-grid-1', title: 'GeoTouch Atlas', subtitle: '53 playing', accent: '#2A5863' },
      { id: 'quiz-grid-2', title: 'OmniTrivia', subtitle: '54 playing', accent: '#252E58' },
      { id: 'quiz-grid-3', title: 'Project Sekai Guess', subtitle: 'Virtual singers edition', accent: '#4D5166' },
      { id: 'quiz-grid-4', title: 'Japan currency?', subtitle: 'Answer fast', accent: '#34526A' },
    ],
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
    heroes: [
      { id: 'roleplay-1', title: 'Spirit Blossom Festival', subtitle: 'Poster-rich worlds, big emotional tone, strong fantasy staging', colors: ['#6A2B56', '#1A1829'] as const },
      { id: 'roleplay-2', title: 'TRIAD COUPLE', subtitle: 'Character-forward stories with dramatic cover art', colors: ['#1F514A', '#132326'] as const },
    ],
    sections: [
      {
        title: 'Recommend',
        cards: [
          { id: 'role-reco-1', title: 'TRIAD COUPLE', subtitle: 'Character art and dangerous classroom drama', accent: '#315C55' },
          { id: 'role-reco-2', title: 'HIGHSCHOOL NEW FACES', subtitle: 'Romance, tension, and clean cover staging', accent: '#4A3846' },
          { id: 'role-reco-3', title: 'Spirit Blossom', subtitle: 'Big fantasy worlds with poster energy', accent: '#5A3852' },
        ],
      },
      {
        title: 'Immersive Worlds',
        cards: [
          { id: 'role-imm-1', title: 'Championship Bonds', subtitle: 'Fan universes made social and playable', accent: '#4B2530' },
          { id: 'role-imm-2', title: 'academy letters', subtitle: 'Dialogue-first worlds with strong hooks', accent: '#3C4B63' },
          { id: 'role-imm-3', title: 'midnight vow', subtitle: 'Aesthetic roleplay spaces with more depth', accent: '#43324D' },
        ],
      },
    ],
    discoverTitle: 'More Roleplay',
    grid: [
      { id: 'role-grid-1', title: 'TRIAD COUPLE', subtitle: 'A new transfer student arrives', accent: '#315C55' },
      { id: 'role-grid-2', title: 'HIGHSCHOOL NEW FACES', subtitle: 'Rinse and Yuki', accent: '#4A3846' },
      { id: 'role-grid-3', title: 'Hololive: Championship Bonds', subtitle: 'Rivals, teammates, champions', accent: '#4B2530' },
      { id: 'role-grid-4', title: 'Spirit Blossom Festival', subtitle: 'League of Legends', accent: '#5A3852' },
    ],
  },
} as const;

const CREATOR_HANDLES = [
  '@latefeed',
  '@omnitrivia',
  '@playline',
  '@voidcraft',
  '@dreamloop',
  '@nightpatch',
  '@hushlab',
  '@spiralsystem',
];

const CARD_METRICS = [
  { likes: '8.5K', plays: '221K' },
  { likes: '3.2K', plays: '96K' },
  { likes: '1.4K', plays: '58K' },
  { likes: '12K', plays: '401K' },
  { likes: '742', plays: '18K' },
  { likes: '5.9K', plays: '176K' },
];

const getSeedFromText = (value: string) =>
  value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

const getMockCreator = (key: string) => CREATOR_HANDLES[getSeedFromText(key) % CREATOR_HANDLES.length];

const getMockMetrics = (key: string) => CARD_METRICS[getSeedFromText(key) % CARD_METRICS.length];

const getPreviewLabel = (activeTab: (typeof PRIMARY_TABS)[number], activeChip: string) => {
  if (activeChip === 'Trending') return 'Live';

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
  title: string;
  subtitle: string;
  accent: string;
  creator: string;
  likes: string;
  plays: string;
  mediaKind: ExploreMediaKind;
  imageUrl?: string;
};

type ExploreSectionRecord = {
  title: string;
  cards: ExploreCardRecord[];
};

type ExploreHeroRecord = {
  id: string;
  title: string;
  subtitle: string;
  colors: readonly [string, string];
  creator: string;
  likes: string;
  plays: string;
  mediaKind: ExploreMediaKind;
  imageUrl?: string;
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
  thumbnail?: string;
  color?: string;
  category?: string;
  plays?: number;
};

const pickMediaKind = (
  activeTab: (typeof PRIMARY_TABS)[number],
  activeChip: string,
  key: string,
): ExploreMediaKind => {
  const seed = getSeedFromText(`${activeTab}-${activeChip}-${key}`);

  if (activeChip === 'Trending' || activeTab === 'Games' || activeTab === 'Roleplay') {
    return seed % 3 === 0 ? 'video' : 'fallback';
  }

  if (activeTab === 'Quiz') {
    return seed % 4 === 0 ? 'video' : 'fallback';
  }

  return 'fallback';
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
  creator: getMockCreator(card.id),
  ...getMockMetrics(card.id),
  mediaKind: pickMediaKind(activeTab, activeChip, card.id),
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
  creator: getMockCreator(hero.id),
  ...getMockMetrics(hero.id),
  mediaKind: activeTab === 'Games' || activeTab === 'Roleplay' ? 'video' : 'fallback',
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

const getGameThumbnail = (game: ExploreGameRecord) =>
  game.thumbnail || `https://games.gametok.co/thumbnails/${game.id}.png`;

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

const countKeywordHits = (haystack: string, keywords: readonly string[]) =>
  keywords.reduce((count, keyword) => count + (haystack.includes(keyword) ? 1 : 0), 0);

const matchesWorld = (activeTab: (typeof PRIMARY_TABS)[number], game: ExploreGameRecord) => {
  const category = (game.category || '').toLowerCase();
  const name = (game.name || '').toLowerCase();
  const haystack = `${name} ${category}`;

  switch (activeTab) {
    case 'Games':
      return true;
    case 'Horror':
      return (
        countKeywordHits(haystack, WORLD_KEYWORDS.Horror) > 0 ||
        /horror|escape|adventure|action|arcade/.test(category)
      );
    case 'Quiz':
      return (
        countKeywordHits(haystack, WORLD_KEYWORDS.Quiz) > 0 ||
        /quiz|puzzle|education|word|trivia/.test(category)
      );
    case 'Roleplay':
      return (
        countKeywordHits(haystack, WORLD_KEYWORDS.Roleplay) > 0 ||
        /dress|girls|story|simulation|beauty|social/.test(category)
      );
    default:
      return true;
  }
};

const mergeLiveGamesIntoWorld = (
  world: ExploreWorldRecord,
  activeTab: (typeof PRIMARY_TABS)[number],
  liveGames: ExploreGameRecord[],
  trendingGames: ExploreGameRecord[],
  activeChip: string,
) => {
  const sourceGames = activeChip === 'Trending' && trendingGames.length ? trendingGames : liveGames;
  if (!sourceGames.length) return world;

  const matching = sourceGames.filter((game) => matchesWorld(activeTab, game));
  const fallback = matching.length ? matching : sourceGames;
  let cursor = 0;

  const nextGame = () => {
    const game = fallback[cursor % fallback.length];
    cursor += 1;
    return game;
  };

  const injectGame = (card: ExploreCardRecord): ExploreCardRecord => {
    const game = nextGame();
    if (!game) return card;

    return {
      ...card,
      id: game.id,
      title: game.name,
      subtitle: game.category ? game.category : card.subtitle,
      accent: game.color || card.accent,
      likes: game.plays ? `${Math.max(1, Math.round(game.plays / 1200))}K` : card.likes,
      plays: game.plays ? `${Math.max(1, Math.round(game.plays / 1000))}K` : card.plays,
      mediaKind: 'image',
      imageUrl: getGameThumbnail(game),
    };
  };

  return {
    ...world,
    heroes: world.heroes.map((hero, index) => {
      const game = nextGame();
      if (!game) return hero;
      return {
        ...hero,
        id: buildSlotKey('hero', game.id, index),
        title: game.name,
        subtitle: game.category ? `${game.category} right now` : hero.subtitle,
        creator: hero.creator,
        likes: game.plays ? `${Math.max(1, Math.round(game.plays / 1200))}K` : hero.likes,
        plays: game.plays ? `${Math.max(1, Math.round(game.plays / 1000))}K` : hero.plays,
        mediaKind: 'image',
        imageUrl: getGameThumbnail(game),
      };
    }),
    sections: world.sections.map((section) => ({
      ...section,
      cards: section.cards.map((card, index) => {
        const injected = injectGame(card);
        return {
          ...injected,
          id: buildSlotKey(`section:${section.title}`, injected.id, index),
        };
      }),
    })),
    grid: world.grid.map((card, index) => {
      const injected = injectGame(card);
      return {
        ...injected,
        id: buildSlotKey('grid', injected.id, index),
      };
    }),
  };
};

const getCardSurfaceTone = (card: { accent: string; mediaKind: ExploreMediaKind; imageUrl?: string }) =>
  card.mediaKind === 'image' && card.imageUrl ? '#0F1117' : card.accent;

type ExploreMediaStageProps = {
  title: string;
  accent: string;
  mediaKind: ExploreMediaKind;
  imageUrl?: string;
  previewLabel: string;
  badgeLabel: string;
  badgeTone: string;
  badgeBackground: string;
  fullBleed?: boolean;
};

const ExploreMediaStage: React.FC<ExploreMediaStageProps> = ({
  title,
  accent,
  mediaKind,
  imageUrl,
  previewLabel,
  badgeLabel,
  badgeTone,
  badgeBackground,
  fullBleed = false,
}) => {
  const seed = getSeedFromText(title);
  const showImage = mediaKind === 'image' && !!imageUrl;
  const motionPreview = mediaKind === 'video';

  return (
    <View style={[styles.cardMediaArea, fullBleed && styles.cardMediaAreaFullBleed, showImage && styles.cardMediaAreaImage]}>
      {showImage ? (
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

      <View style={styles.cardMediaHeader}>
        <View style={[styles.cardTopPill, { backgroundColor: badgeBackground, borderColor: badgeTone }]}>
          <Text style={[styles.cardTopPillText, { color: badgeTone }]}>{badgeLabel}</Text>
        </View>
        <View style={styles.cardPreviewBadge}>
          <Ionicons name={motionPreview ? 'play' : 'image'} size={10} color="#FFF" />
          <Text style={styles.cardPreviewBadgeText}>{previewLabel}</Text>
        </View>
      </View>
    </View>
  );
};

export const ExploreScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const { showAuthScreen, showLoginScreen } = useAuthScreen();
  const [activeTab, setActiveTab] = useState<(typeof PRIMARY_TABS)[number]>('Explore');
  const [activeChip, setActiveChip] = useState('For You');
  const [searchQuery, setSearchQuery] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);
  const [liveGames, setLiveGames] = useState<ExploreGameRecord[]>([]);
  const [trendingGames, setTrendingGames] = useState<ExploreGameRecord[]>([]);

  const tabWorld = useMemo(() => {
    const shaped = buildWorldRecord(activeTab, activeChip, TAB_WORLDS[activeTab]);
    return mergeLiveGamesIntoWorld(shaped, activeTab, liveGames, trendingGames, activeChip);
  }, [activeTab, activeChip, liveGames, trendingGames]);
  const hero = useMemo(() => tabWorld.heroes[heroIndex % tabWorld.heroes.length], [heroIndex, tabWorld]);
  const isTrendingView = activeChip === 'Trending';
  const trendingSectionTitle = activeTab === 'Explore' ? 'Trending Right Now' : `${activeTab} Trending`;
  const activeChipDescription = tabWorld.chipDescriptions[activeChip as keyof typeof tabWorld.chipDescriptions] || '';
  const trimmedSearch = searchQuery.trim().toLowerCase();
  const isSearchMode = trimmedSearch.length > 0;

  const radarEyebrow =
    activeTab === 'Explore'
      ? 'A live read on what the culture is doing right now.'
      : `A live read on what ${activeTab.toLowerCase()} culture is doing right now.`;

  const trendingChallengesTitle =
    activeTab === 'Explore' ? 'Challenges' : `${activeTab} Challenges`;

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

  const renderTrendingPulseLabel = () => {
    switch (activeTab) {
      case 'Games':
        return 'Mechanics rising';
      case 'Horror':
        return 'Fear spikes';
      case 'Quiz':
        return 'Brain heat';
      case 'Roleplay':
        return 'Ship energy';
      default:
        return 'Search heat';
    }
  };

  const radarPulses = [
    { ...SIGNAL_PULSES[0], label: renderTrendingPulseLabel(), tone: tabWorld.accent },
    SIGNAL_PULSES[1],
    SIGNAL_PULSES[2],
  ];

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
  const previewLabel = getPreviewLabel(activeTab, activeChip);

  const searchResults = useMemo(() => {
    if (!trimmedSearch) return [];

    const worldItems = [
      ...tabWorld.sections.flatMap((section) =>
        section.cards.map((card) => ({
          id: `${section.title}-${card.id}`,
          title: card.title,
          subtitle: card.subtitle,
          accent: card.accent,
          creator: card.creator,
          likes: card.likes,
          plays: card.plays,
          mediaKind: card.mediaKind,
          imageUrl: card.imageUrl,
          source: section.title,
        })),
      ),
      ...tabWorld.grid.map((item) => ({
        id: `grid-${item.id}`,
        title: item.title,
        subtitle: item.subtitle,
        accent: item.accent,
        creator: item.creator,
        likes: item.likes,
        plays: item.plays,
        mediaKind: item.mediaKind,
        imageUrl: item.imageUrl,
        source: tabWorld.discoverTitle,
      })),
      ...tabWorld.heroes.map((item) => ({
        id: `hero-${item.id}`,
        title: item.title,
        subtitle: item.subtitle,
        accent: item.colors[0],
        creator: item.creator,
        likes: item.likes,
        plays: item.plays,
        mediaKind: item.mediaKind,
        imageUrl: item.imageUrl,
        source: `${activeTab} Hero`,
      })),
    ];

    const matches = worldItems.filter((item) => {
      const haystack = `${item.title} ${item.subtitle} ${item.source}`.toLowerCase();
      return haystack.includes(trimmedSearch);
    });

    return matches.slice(0, 12);
  }, [trimmedSearch, tabWorld, activeTab]);

  useEffect(() => {
    setHeroIndex(0);
    setActiveChip(tabWorld.defaultChip);
  }, [activeTab]);

  useEffect(() => {
    let active = true;

    const loadLiveGames = async () => {
      try {
        const [gamesData, feedData] = await Promise.all([
          gamesApi.list(60, 0),
          feed.global(40).catch(() => ({ activity: [] })),
        ]);
        if (!active) return;
        setLiveGames((gamesData.games || []) as ExploreGameRecord[]);

        const dedupedTrending = new Map<string, ExploreGameRecord>();
        for (const item of feedData.activity || []) {
          const game = item?.game;
          if (!game?.id || dedupedTrending.has(game.id)) continue;
          dedupedTrending.set(game.id, {
            id: game.id,
            name: game.name,
            thumbnail: game.thumbnail,
            color: game.color,
            plays: undefined,
          });
        }
        setTrendingGames(Array.from(dedupedTrending.values()));
      } catch (error) {
        if (active) {
          setLiveGames([]);
          setTrendingGames([]);
        }
      }
    };

    loadLiveGames();

    return () => {
      active = false;
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <Text style={styles.logoTitle}>EXPLORE</Text>
          <TouchableOpacity style={[styles.headerIcon, isTrendingView && { borderColor: tabWorld.modeBannerBorder, backgroundColor: tabWorld.modeBannerBg }]}>
            <Ionicons name="search" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchWrap, isTrendingView && { backgroundColor: tabWorld.modeBannerBg, borderColor: tabWorld.modeBannerBorder }]}>
          <Ionicons name="search" size={18} color={isTrendingView ? tabWorld.accent : 'rgba(255,255,255,0.5)'} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={isTrendingView ? `Search ${activeTab.toLowerCase()} trends...` : 'Search your favorite games...'}
            placeholderTextColor={isTrendingView ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.35)'}
            style={[styles.searchInput, isTrendingView && styles.searchInputTrending]}
          />
          {isTrendingView ? (
            <View style={[styles.searchLiveBadge, { backgroundColor: tabWorld.accentSoft, borderColor: tabWorld.modeBannerBorder }]}>
              <View style={[styles.searchLiveDot, { backgroundColor: tabWorld.accent }]} />
              <Text style={[styles.searchLiveText, { color: tabWorld.accent }]}>Live</Text>
            </View>
          ) : null}
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

        {isSearchMode ? (
          <View style={styles.searchSummaryCard}>
            <View style={styles.searchMetaRow}>
              <Text style={styles.searchMetaTitle}>Results for “{searchQuery.trim()}”</Text>
              <Text style={styles.searchMetaCount}>{searchResults.length} found</Text>
            </View>
            <Text style={styles.searchSummaryText}>
              Searching across {activeTab.toLowerCase()} heroes, sections, and discovery picks.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.searchSuggestionRow}>
              {SEARCH_QUICK_TERMS.map((term) => (
                <TouchableOpacity
                  key={term}
                  onPress={() => setSearchQuery(term)}
                  style={[styles.searchSuggestionChip, { borderColor: tabWorld.modeBannerBorder, backgroundColor: tabWorld.modeBannerBg }]}
                >
                  <Text style={[styles.searchSuggestionText, { color: tabWorld.accent }]}>
                    {term}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : !isTrendingView ? (
          <View style={[styles.modeBanner, { backgroundColor: tabWorld.modeBannerBg, borderColor: tabWorld.modeBannerBorder }]}>
            <Text style={[styles.modeBannerLabel, { color: tabWorld.accent }]}>{activeChip}</Text>
            <Text style={styles.modeBannerText}>{activeChipDescription}</Text>
          </View>
        ) : null}

        {isTrendingView ? (
          <View style={[styles.trendingStatusBar, { backgroundColor: tabWorld.modeBannerBg, borderColor: tabWorld.modeBannerBorder }]}>
            <View style={styles.trendingStatusLeft}>
              <View style={[styles.trendingStatusDot, { backgroundColor: tabWorld.accent }]} />
              <Text style={[styles.trendingStatusLabel, { color: tabWorld.accent }]}>{activeTab} live</Text>
            </View>
            <Text style={styles.trendingStatusMeta}>Updated now</Text>
            <Text style={styles.trendingStatusDivider}>•</Text>
            <Text style={styles.trendingStatusMeta}>Signals + charts</Text>
          </View>
        ) : null}

        {!isSearchMode && !isTrendingView ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => setHeroIndex((current) => current + 1)} style={styles.heroWrap}>
            <LinearGradient colors={hero.colors} style={styles.heroCard}>
              <View style={[styles.heroAccentPill, { backgroundColor: tabWorld.accentSoft, borderColor: tabWorld.accent }]}>
                <View style={[styles.heroAccentDot, { backgroundColor: tabWorld.accent }]} />
                <Text style={[styles.heroAccentText, { color: tabWorld.accent }]}>{activeTab}</Text>
              </View>
              {renderHeroChrome()}
              <Text style={styles.heroClock}>10:16 PM</Text>
              <Text style={styles.heroTitle}>{hero.title}</Text>
              <Text style={styles.heroSubtitle}>{hero.subtitle}</Text>
              <View style={styles.heroFooter}>
                <View style={styles.heroMetaBlock}>
                  <Text style={styles.heroMetaCreator}>{hero.creator}</Text>
                  <Text style={styles.heroMetaStats}>
                    {hero.likes} likes · {hero.plays} plays
                  </Text>
                </View>
                <View style={styles.heroDots}>
                  {tabWorld.heroes.map((item, index) => (
                    <View key={item.id} style={[styles.heroDot, index === heroIndex % tabWorld.heroes.length && styles.heroDotActive]} />
                  ))}
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}

        {isSearchMode ? (
          <View style={[styles.section, styles.leadSection]}>
            {searchResults.length > 0 ? (
              <View style={styles.searchGrid}>
                {searchResults.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.9}
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
                      previewLabel={previewLabel}
                      badgeLabel={item.source}
                      badgeTone={tabWorld.accent}
                      badgeBackground={tabWorld.accentSoft}
                      fullBleed
                    />
                    <View style={styles.trendingCardFooter}>
                      <Text style={styles.trendingCardTitle}>{item.title}</Text>
                      <Text style={styles.trendingCardSubtitle}>{item.subtitle}</Text>
                      <View style={styles.cardMetricsRow}>
                        <Text style={styles.cardCreatorText}>{item.creator}</Text>
                        <Text style={styles.cardMetricsText}>
                          {item.likes} likes · {item.plays}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.searchEmptyState}>
                <Ionicons name="search-outline" size={28} color="rgba(255,255,255,0.34)" />
                <Text style={styles.searchEmptyTitle}>Nothing matched yet</Text>
                <Text style={styles.searchEmptyText}>
                  Try a title, vibe, creator name, or mode like horror, romance, simulator, or trivia.
                </Text>
              </View>
            )}
          </View>
        ) : isTrendingView ? (
          <>
            <View style={[styles.section, styles.leadSection]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>On The Radar</Text>
                  <Text style={styles.sectionEyebrow}>{radarEyebrow}</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.signalPulseRow}>
                {radarPulses.map((pulse) => (
                  <View key={pulse.id} style={[styles.signalPulse, { borderColor: `${pulse.tone}55` }]}>
                    <View style={[styles.signalPulseDot, { backgroundColor: pulse.tone }]} />
                    <Text style={styles.signalPulseLabel}>{pulse.label}</Text>
                    <Text style={[styles.signalPulseValue, { color: pulse.tone }]}>{pulse.value}</Text>
                  </View>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartRow}>
                {CHART_COLUMNS.map((column) => (
                  <LinearGradient key={column.title} colors={column.colors} style={[styles.chartCard, chartCardTone]}>
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
                    {column.rows.map((row, index) => (
                      <View key={row.label} style={[styles.chartItem, index < column.rows.length - 1 && styles.chartItemBorder]}>
                        <View style={[styles.chartIndexBadge, { backgroundColor: `${tabWorld.accent}22`, borderColor: `${tabWorld.accent}55` }]}>
                          <Text style={[styles.chartIndex, { color: tabWorld.accent }]}>{index + 1}</Text>
                        </View>
                        <View style={styles.chartItemCopy}>
                          <Text style={styles.chartItemText}>{row.label}</Text>
                          <Text style={styles.chartItemMeta}>{row.meta}</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={12} color="rgba(255,255,255,0.24)" />
                      </View>
                    ))}
                  </LinearGradient>
                ))}
              </ScrollView>
            </View>

            <View style={[styles.section, styles.compactSection]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{trendingSectionTitle}</Text>
                <TouchableOpacity>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
              <View style={styles.trendingGrid}>
                {tabWorld.grid.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.9}
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
                      previewLabel={previewLabel}
                      badgeLabel={tabWorld.cardLabel}
                      badgeTone={tabWorld.accent}
                      badgeBackground={tabWorld.accentSoft}
                      fullBleed
                    />
                    <View style={styles.trendingCardFooter}>
                      <Text style={styles.trendingCardTitle}>{item.title}</Text>
                      <Text style={styles.trendingCardSubtitle}>{item.subtitle}</Text>
                      <View style={styles.cardMetricsRow}>
                        <Text style={styles.cardCreatorText}>{item.creator}</Text>
                        <Text style={styles.cardMetricsText}>
                          {item.likes} likes · {item.plays}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.section, styles.compactSection]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{trendingChallengesTitle}</Text>
                <TouchableOpacity>
                  <Text style={styles.moreText}>More</Text>
                </TouchableOpacity>
              </View>
              {CHALLENGES.map((challenge) => (
                <TouchableOpacity key={challenge.title} style={styles.challengeCard}>
                  <View style={styles.challengeHeader}>
                    <Text style={styles.challengeTitle}>{challenge.title}</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                  </View>
                  <Text style={styles.challengeSubtitle}>{challenge.subtitle}</Text>
                  <View style={styles.challengeThumbRow}>
                    <View style={[styles.challengeThumb, { backgroundColor: '#56753A' }]} />
                    <View style={[styles.challengeThumb, { backgroundColor: '#86824A' }]} />
                    <View style={[styles.challengeThumb, { backgroundColor: '#B9764D' }]} />
                    <View style={[styles.challengeThumb, { backgroundColor: '#4C5E8D' }]} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            {tabWorld.sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <TouchableOpacity>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCardsRow}>
                  {section.cards.map((card, index) => (
                    <TouchableOpacity
                      key={card.id}
                      activeOpacity={0.9}
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
                        previewLabel={previewLabel}
                        badgeLabel={tabWorld.cardLabel}
                        badgeTone={tabWorld.accent}
                        badgeBackground={tabWorld.accentSoft}
                        fullBleed
                      />
                      <View style={styles.discoveryCardFooter}>
                        <Text style={styles.discoveryCardTitle}>{card.title}</Text>
                        <Text style={styles.discoveryCardSubtitle}>{card.subtitle}</Text>
                        <View style={styles.cardMetricsRow}>
                          <Text style={styles.cardCreatorText}>{card.creator}</Text>
                          <Text style={styles.cardMetricsText}>
                            {card.likes} likes · {card.plays}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ))}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{tabWorld.discoverTitle}</Text>
                <TouchableOpacity>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
              <View style={styles.trendingGrid}>
                {tabWorld.grid.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.9}
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
                      previewLabel={previewLabel}
                      badgeLabel={tabWorld.cardLabel}
                      badgeTone={tabWorld.accent}
                      badgeBackground={tabWorld.accentSoft}
                      fullBleed
                    />
                    <View style={styles.trendingCardFooter}>
                      <Text style={styles.trendingCardTitle}>{item.title}</Text>
                      <Text style={styles.trendingCardSubtitle}>{item.subtitle}</Text>
                      <View style={styles.cardMetricsRow}>
                        <Text style={styles.cardCreatorText}>{item.creator}</Text>
                        <Text style={styles.cardMetricsText}>
                          {item.likes} likes · {item.plays}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
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
  searchLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 10,
  },
  searchLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  searchLiveText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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
    marginTop: 10,
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
  trendingStatusBar: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendingStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  trendingStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  trendingStatusLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  trendingStatusMeta: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
  },
  trendingStatusDivider: {
    color: 'rgba(255,255,255,0.28)',
    marginHorizontal: 8,
    fontSize: 12,
    fontWeight: '800',
  },
  heroWrap: {
    marginHorizontal: 16,
    marginTop: 10,
  },
  heroCard: {
    height: 300,
    borderRadius: 24,
    padding: 22,
    justifyContent: 'space-between',
    overflow: 'hidden',
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
    gap: 6,
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
  cardMediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  cardVideoPulse: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  discoveryCardWide: {
    width: 180,
    height: 210,
  },
  discoveryCardTall: {
    width: 180,
    height: 250,
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
    width: 180,
    height: 240,
  },
  discoveryCardHorrorHero: {
    width: 180,
    height: 270,
  },
  discoveryCardQuiz: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#15232A',
  },
  discoveryCardQuizUniform: {
    width: 180,
    height: 214,
  },
  discoveryCardRoleplay: {
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.16)',
    backgroundColor: '#1F1821',
  },
  discoveryCardRoleplayPoster: {
    width: 180,
    height: 278,
  },
  cardTopPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  cardTopPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardPreviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardPreviewBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  discoveryCardFooter: {
    paddingHorizontal: 14,
    gap: 4,
  },
  discoveryCardTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  discoveryCardSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  cardMetricsRow: {
    marginTop: 9,
    gap: 3,
  },
  cardCreatorText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  cardMetricsText: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 10,
    fontWeight: '700',
  },
  chartRow: {
    paddingHorizontal: 16,
    gap: 12,
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
    width: '48.2%',
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'space-between',
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 14,
  },
  trendingCardTall: {
    height: 236,
  },
  trendingCardShort: {
    height: 188,
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
    height: 238,
  },
  trendingCardQuiz: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#15232A',
  },
  trendingCardQuizUniform: {
    height: 208,
  },
  trendingCardRoleplay: {
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.16)',
    backgroundColor: '#1F1821',
  },
  trendingCardRoleplayPoster: {
    height: 278,
  },
  trendingCardFooter: {
    paddingHorizontal: 14,
    gap: 4,
  },
  trendingCardTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  trendingCardSubtitle: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    fontWeight: '600',
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
