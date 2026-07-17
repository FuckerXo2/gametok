import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ImageBackground,
  Dimensions,
  RefreshControl,
  TextInput,
  Modal,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import { useAuthScreen, useNavigation } from '../../App';
import { API_URL, games as gamesApi, users as usersApi } from '../services/api';
import { Avatar } from './Avatar';
import { UserProfileModal } from './UserProfileModal';
import { GameLoadingScreen } from './GameLoadingScreen';
import { resolveGameThumbnail } from '../utils/thumbnails';

const PURPLE = '#a855f7';
const PURPLE_DEEP = '#7c3aed';
const BG = '#000000';
const TEXT = '#ffffff';
const TEXT_MUTED = '#9a9aa8';
const TEXT_DIM = '#6b6b78';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZ_PAD = 16;
const HERO_WIDTH = SCREEN_WIDTH - HORIZ_PAD * 2;
const GAMES_HOST = 'https://games.gametok.co';
const API_ORIGIN = API_URL.replace(/\/api$/, '');

const GAMETOK_BG = require('../../assets/gametok_bg.png');
const DREAM_FORGE_HERO = require('../../assets/dream-forge-hero.png');

const TABS = ['For You', 'Games', 'Horror', 'Quiz', 'Roleplay'] as const;
type ExploreTab = (typeof TABS)[number];
type NonForYouTab = Exclude<ExploreTab, 'For You'>;

const TAB_CATEGORY_CHIPS: Record<NonForYouTab, Array<{ label: string; keywords: string[] }>> = {
  Games: [
    { label: 'Recommend', keywords: [] },
    { label: 'Action', keywords: ['action', 'battle', 'fight', 'combat', 'adventure'] },
    { label: 'Arcade', keywords: ['arcade', 'runner', 'classic', 'neon'] },
    { label: 'Racing', keywords: ['race', 'racing', 'drive', 'drift', 'car'] },
    { label: 'Puzzle', keywords: ['puzzle', 'brain', 'logic'] },
    { label: 'Casual', keywords: ['casual', 'cozy', 'simple'] },
    { label: 'Sports', keywords: ['sport', 'football', 'soccer', 'basketball'] },
  ],
  Horror: [
    { label: 'Recommend', keywords: [] },
    { label: 'Psychological', keywords: ['psychological', 'watched', 'mind'] },
    { label: 'Survival', keywords: ['survival', 'escape', 'run'] },
    { label: 'Mystery', keywords: ['mystery', 'detective', 'secret'] },
    { label: 'Dark', keywords: ['dark', 'night', 'shadow'] },
    { label: 'Short Scares', keywords: ['short', 'scare', 'ghost', 'haunted'] },
  ],
  Quiz: [
    { label: 'Recommend', keywords: [] },
    { label: 'Brain Teasers', keywords: ['brain', 'puzzle', 'logic'] },
    { label: 'Trivia', keywords: ['trivia', 'quiz', 'question'] },
    { label: 'Party', keywords: ['party', 'friends', 'group'] },
    { label: 'Guess', keywords: ['guess', 'who', 'what'] },
    { label: 'Challenge', keywords: ['challenge', 'test', 'score'] },
  ],
  Roleplay: [
    { label: 'Recommend', keywords: [] },
    { label: 'Immersive Worlds', keywords: ['world', 'immersive', 'open'] },
    { label: 'Fantasy', keywords: ['fantasy', 'magic', 'kingdom'] },
    { label: 'Anime', keywords: ['anime', 'naruto', 'school'] },
    { label: 'Social Rooms', keywords: ['social', 'room', 'friends'] },
  ],
};

const TAB_COPY: Record<ExploreTab, {
  pill: string;
  icon: keyof typeof Ionicons.glyphMap;
  line1: string;
  line2: string;
  subtitle: string;
  cta: string;
  sectionTitles: string[];
  keywords: string[];
}> = {
  'For You': {
    pill: 'Dream Forge',
    icon: 'sparkles',
    line1: 'Make a playable',
    line2: 'world.',
    subtitle: 'You imagine it. We build it.',
    cta: 'Create Now',
    sectionTitles: ['Trending Now 🔥', 'Made For You'],
    keywords: [],
  },
  Games: {
    pill: 'Instant Play',
    icon: 'game-controller',
    line1: 'Jump into',
    line2: 'games.',
    subtitle: 'Fast rounds. Big worlds.',
    cta: 'Play Now',
    sectionTitles: ['Trending Games', 'New Games', 'Arcade Picks'],
    keywords: ['game', 'arcade', 'race', 'runner', 'survival', 'battle', 'parkour'],
  },
  Horror: {
    pill: 'Horror Picks',
    icon: 'moon',
    line1: 'Play something',
    line2: 'haunted.',
    subtitle: 'Short scares. Dark stories.',
    cta: 'Enter',
    sectionTitles: ['Psychological Horror', 'Short Scares', 'Mystery Worlds'],
    keywords: ['horror', 'scary', 'haunted', 'ghost', 'nightmare', 'dark', 'mystery', 'watched'],
  },
  Roleplay: {
    pill: 'Live Worlds',
    icon: 'people',
    line1: 'Start a',
    line2: 'story.',
    subtitle: 'Join rooms. Build lore.',
    cta: 'Join World',
    sectionTitles: ['Active Roleplays', 'Fantasy Worlds', 'Social Rooms'],
    keywords: ['roleplay', 'rp', 'story', 'world', 'city', 'school', 'fantasy', 'anime'],
  },
  Quiz: {
    pill: 'Quiz Rush',
    icon: 'help-circle',
    line1: 'Test your',
    line2: 'friends.',
    subtitle: 'Quick questions. Big bragging rights.',
    cta: 'Start Quiz',
    sectionTitles: ['Trending Quizzes', 'Party Quiz', 'Guess The Game'],
    keywords: ['quiz', 'trivia', 'question', 'guess', 'test', 'challenge'],
  },
};

const TRENDING_SEARCHES = [
  'dream forge',
  'horror',
  'racing',
  'parkour',
  'quiz',
  'roleplay',
  'neon',
];

interface ExploreGame {
  id: string;
  name: string;
  description?: string;
  embedUrl?: string;
  thumbnail?: string;
  plays?: number;
  likes?: number;
  color?: string;
  category?: string;
  creatorDisplayName?: string | null;
  creatorUsername?: string | null;
}

interface ExploreCreator {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  verified?: boolean;
}

interface HeroSlide {
  id: string;
  title: { line1: string; line2: string; accent: 'first' | 'second' };
  subtitle: string;
  ctaLabel: string;
  ctaIcon: keyof typeof Ionicons.glyphMap;
  ctaTarget: 'create' | 'game';
  pillIcon: keyof typeof Ionicons.glyphMap;
  pillLabel: string;
  imageSource?: any;
  imageUri?: string;
  game?: ExploreGame;
}

const resolveThumbnail = (thumbnail?: string | null, gameId?: string, game?: ExploreGame) => {
  return resolveGameThumbnail(thumbnail, gameId, game);
};

const getGameUrl = (game: ExploreGame) => {
  const rawUrl = game.embedUrl
    ? (game.embedUrl.startsWith('/') ? `${API_ORIGIN}${game.embedUrl}` : game.embedUrl)
    : `${GAMES_HOST}/${game.id}/`;
  const separator = rawUrl.includes('?') ? '&' : '?';
  return `${rawUrl}${separator}gd_sdk_referrer_url=${encodeURIComponent(GAMES_HOST)}`;
};

const formatCount = (n?: number) => {
  if (!n && n !== 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const gameMatchesKeywords = (game: ExploreGame, keywords: string[]) => {
  if (keywords.length === 0) return true;
  const haystack = `${game.name || ''} ${game.category || ''}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
};

const rotateGames = (games: ExploreGame[], offset: number) => {
  if (games.length === 0) return games;
  const normalized = offset % games.length;
  return [...games.slice(normalized), ...games.slice(0, normalized)];
};

const cardMetaForTab = (tab: ExploreTab, game: ExploreGame, index: number) => {
  if (tab === 'Horror') {
    return index % 2 === 0 ? '2-5 min' : 'Lights off';
  }
  if (tab === 'Roleplay') {
    return index % 2 === 0 ? `${Math.max(3, ((game.plays || 0) % 9) + 2)} online` : 'Open room';
  }
  if (tab === 'Quiz') {
    return `${8 + (index % 5) * 2} questions`;
  }
  if (tab === 'Games') {
    return formatCount(game.plays || 0);
  }
  return formatCount(game.plays || 0);
};

export const ExploreScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuth();
  const { showAuthScreen } = useAuthScreen();
  const { setActiveTab, searchModalVisible, setSearchModalVisible } = useNavigation();

  const [activeTab, setActiveTabState] = useState<ExploreTab>('For You');
  const [allGames, setAllGames] = useState<ExploreGame[]>([]);
  const [creators, setCreators] = useState<ExploreCreator[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ExploreGame[]>([]);
  const [searchCreators, setSearchCreators] = useState<ExploreCreator[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState<any>(null);
  const [playingGame, setPlayingGame] = useState<ExploreGame | null>(null);
  const [gameLoaded, setGameLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0); // real WebView progress, 0-100
  const [activeCategoryByTab, setActiveCategoryByTab] = useState<Record<NonForYouTab, string>>({
    Games: 'Recommend',
    Horror: 'Recommend',
    Quiz: 'Recommend',
    Roleplay: 'Recommend',
  });
  const heroScrollRef = useRef<ScrollView>(null);
  const playerWebViewRef = useRef<WebView>(null);

  // Filter games by tab
  const filteredGames = useMemo(() => {
    if (activeTab === 'For You') return allGames;
    const lc = activeTab.toLowerCase();
    const keywords = TAB_COPY[activeTab].keywords;
    return allGames.filter((g) => {
      const cat = (g.category || '').toLowerCase();
      const name = (g.name || '').toLowerCase();
      if (activeTab === 'Games') return true;
      return cat.includes(lc) || name.includes(lc) || gameMatchesKeywords(g, keywords);
    });
  }, [allGames, activeTab]);

  const tabGames = filteredGames.length > 0 ? filteredGames : allGames;
  const tabCopy = TAB_COPY[activeTab];
  const activeCategory =
    activeTab === 'For You' ? null : activeCategoryByTab[activeTab as NonForYouTab];
  const categoryChips = activeTab === 'For You' ? [] : TAB_CATEGORY_CHIPS[activeTab as NonForYouTab];
  const activeCategoryConfig = activeCategory
    ? categoryChips.find((chip) => chip.label === activeCategory)
    : undefined;
  const categoryGames = useMemo(() => {
    if (!activeCategoryConfig || activeCategoryConfig.keywords.length === 0) return tabGames;
    const matched = tabGames.filter((game) => gameMatchesKeywords(game, activeCategoryConfig.keywords));
    return matched.length > 0 ? matched : tabGames;
  }, [activeCategoryConfig, tabGames]);

  useEffect(() => {
    setHeroIndex(0);
    heroScrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [activeTab]);

  const loadData = async () => {
    try {
      const [gamesRes, recRes] = await Promise.allSettled([
        gamesApi.list(40, 0, { sort: 'trending' }),
        usersApi.recommended(),
      ]);
      if (gamesRes.status === 'fulfilled') {
        setAllGames(gamesRes.value?.games || []);
      }
      if (recRes.status === 'fulfilled') {
        setCreators(recRes.value?.users || []);
      }
    } catch (err) {
      console.log('[Explore] load failed', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Build hero carousel: Dream Forge promo + top 4 trending games
  const heroSlides = useMemo<HeroSlide[]>(() => {
    const featured = tabGames[0];
    const slides: HeroSlide[] = [
      {
        id: activeTab === 'For You' ? 'dream-forge' : `tab-${activeTab}`,
        title: { line1: tabCopy.line1, line2: tabCopy.line2, accent: 'second' },
        subtitle: tabCopy.subtitle,
        ctaLabel: tabCopy.cta,
        ctaIcon: tabCopy.icon,
        ctaTarget: activeTab === 'For You' || !featured ? 'create' : 'game',
        pillIcon: tabCopy.icon,
        pillLabel: tabCopy.pill,
        imageSource: activeTab === 'For You' ? DREAM_FORGE_HERO : undefined,
        imageUri: activeTab === 'For You' || !featured ? undefined : resolveThumbnail(featured.thumbnail, featured.id, featured),
        game: activeTab === 'For You' ? undefined : featured,
      },
    ];
    tabGames.slice(activeTab === 'For You' ? 0 : 1, activeTab === 'For You' ? 4 : 5).forEach((g) => {
      slides.push({
        id: `game-${g.id}`,
        title: { line1: g.name.split(' ').slice(0, 2).join(' '), line2: g.name.split(' ').slice(2).join(' ') || 'Play now.', accent: 'second' },
        subtitle: g.creatorDisplayName ? `by @${g.creatorDisplayName}` : 'Trending now',
        ctaLabel: 'Play Now',
        ctaIcon: 'play',
        ctaTarget: 'game',
        pillIcon: 'flame',
        pillLabel: 'Trending',
        imageUri: resolveThumbnail(g.thumbnail, g.id, g),
        game: g,
      });
    });
    return slides;
  }, [activeTab, tabCopy, tabGames]);

  const tabSections = useMemo(() => {
    return tabCopy.sectionTitles.map((title, index) => ({
      title,
      games: rotateGames(tabGames, index * 3).slice(0, 8),
    }));
  }, [tabCopy.sectionTitles, tabGames]);

  const topGames = useMemo(() => {
    return [...allGames]
      .sort((a, b) => (b.plays || 0) - (a.plays || 0))
      .slice(0, 6);
  }, [allGames]);

  // Search effect
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchCreators([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const [gameRes, userRes] = await Promise.allSettled([
          gamesApi.search(searchQuery.trim()),
          usersApi.search(searchQuery.trim()),
        ]);
        if (gameRes.status === 'fulfilled') {
          setSearchResults(gameRes.value?.games || []);
        }
        if (userRes.status === 'fulfilled') {
          setSearchCreators(userRes.value?.users || []);
        }
      } catch {}
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const openGame = async (gameOrId: string | ExploreGame) => {
    const existingGame = typeof gameOrId === 'string'
      ? allGames.find((game) => game.id === gameOrId)
      : gameOrId;

    if (existingGame) {
      setPlayingGame(existingGame);
      setGameLoaded(false);
      setLoadProgress(0);
      gamesApi.recordPlay(existingGame.id).catch(() => {});
      return;
    }

    try {
      const data = await gamesApi.get(String(gameOrId));
      const fetchedGame = data?.game || data;
      if (fetchedGame?.id) {
        setPlayingGame(fetchedGame);
        setGameLoaded(false);
        setLoadProgress(0);
        gamesApi.recordPlay(fetchedGame.id).catch(() => {});
      }
    } catch (err) {
      console.log('[Explore] open game failed', err);
    }
  };

  const handleHeroCta = (slide: HeroSlide) => {
    if (slide.ctaTarget === 'create') {
      setActiveTab('create');
    } else if (slide.game) {
      openGame(slide.game.id);
    }
  };

  const goToHero = (index: number) => {
    setHeroIndex(index);
    heroScrollRef.current?.scrollTo({ x: index * HERO_WIDTH, animated: true });
  };

  const currentHero = heroSlides[heroIndex] || heroSlides[0];

    return (
    <View style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />
        }
      >
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.topLogo}>gametok</Text>
          <Pressable style={styles.topIconBtn} onPress={() => setSearchModalVisible(true)} hitSlop={6}>
            <Ionicons name="search" size={19} color={TEXT} />
          </Pressable>
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <Pressable
                key={tab}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setActiveTabState(tab)}
                hitSlop={6}
              >
                {active ? <View style={styles.tabActiveDot} /> : null}
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* For You hero carousel */}
        {activeTab === 'For You' && currentHero ? (
          <View style={styles.heroWrap}>
            <ScrollView
              ref={heroScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={HERO_WIDTH}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / HERO_WIDTH);
                setHeroIndex(Math.max(0, Math.min(nextIndex, heroSlides.length - 1)));
              }}
            >
              {heroSlides.map((slide) => (
                <View key={slide.id} style={styles.heroSlide}>
                  <ImageBackground
                    source={
                      slide.imageSource
                        ? slide.imageSource
                        : slide.imageUri
                          ? { uri: slide.imageUri }
                          : GAMETOK_BG
                    }
                    style={styles.heroCard}
                    imageStyle={styles.heroCardImage}
                    resizeMode="cover"
                  >
                    {/* Dream Forge / Trending pill */}
                    <View style={styles.heroPillWrap}>
                      <LinearGradient
                        colors={['rgba(12,14,30,0.78)', 'rgba(31,18,48,0.72)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.heroPill}
                      >
                        <Ionicons name={slide.pillIcon} size={12} color={PURPLE} />
                        <Text style={styles.heroPillText}>{slide.pillLabel}</Text>
                      </LinearGradient>
                    </View>

                    {/* Title + subtitle + CTA */}
                    <View style={styles.heroBody}>
                      {slide.id === 'dream-forge' ? (
                        <View style={styles.heroDreamTitleBlock}>
                          <Text style={styles.heroDreamTitle}>Make a</Text>
                          <Text style={styles.heroDreamTitle}>playable</Text>
                          <Text style={[styles.heroDreamTitle, styles.heroTitleAccent]}>world.</Text>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.heroTitleLine1}>
                            {slide.title.line1}
                            {slide.title.accent === 'first' ? (
                              <Text style={styles.heroTitleAccent}> {slide.title.line2}</Text>
                            ) : null}
                          </Text>
                          <Text style={styles.heroTitleLine2}>
                            {slide.title.accent === 'second' ? (
                              <Text style={styles.heroTitleAccent}>{slide.title.line2}</Text>
                            ) : (
                              slide.title.line2
                            )}
                          </Text>
                        </>
                      )}
                      {slide.id === 'dream-forge' ? (
                        <View style={styles.heroSubtitleStack}>
                          <Text style={styles.heroSubtitle}>You imagine it.</Text>
                          <Text style={styles.heroSubtitle}>We build it.</Text>
                        </View>
                      ) : (
                        <Text style={styles.heroSubtitle}>{slide.subtitle}</Text>
                      )}
                      <Pressable style={styles.heroCta} onPress={() => handleHeroCta(slide)}>
                        <Ionicons name={slide.ctaIcon} size={15} color={TEXT} />
                        <Text style={styles.heroCtaText}>{slide.ctaLabel}</Text>
                      </Pressable>
                    </View>
                  </ImageBackground>
                </View>
              ))}
            </ScrollView>

            {/* Pagination dots */}
            <View style={styles.heroDots}>
              {heroSlides.map((s, i) => (
                <Pressable key={s.id} onPress={() => goToHero(i)} hitSlop={4}>
                  <View
                              style={[
                      styles.heroDot,
                      i === heroIndex && styles.heroDotActive,
                    ]}
                  />
                </Pressable>
                          ))}
                        </View>
                      </View>
                    ) : null}

        {/* Tab content */}
        {activeTab !== 'For You' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleplayChipRow}>
            {categoryChips.map((chip) => {
              const active = activeCategory === chip.label;
              return (
                <Pressable
                  key={chip.label}
                  style={[styles.roleplayChip, active && styles.roleplayChipActive]}
                  onPress={() =>
                    setActiveCategoryByTab((prev) => ({
                      ...prev,
                      [activeTab as NonForYouTab]: chip.label,
                    }))
                  }
                >
                  <Text style={[styles.roleplayChipText, active && styles.roleplayChipTextActive]}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {activeTab === 'For You' ? (
          tabSections.map((section, sectionIndex) => (
            <React.Fragment key={`${activeTab}-${section.title}`}>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Pressable hitSlop={8}>
                    <Text style={styles.sectionSeeAll}>See all</Text>
                  </Pressable>
                </View>
                {section.games.length === 0 ? (
                  <Text style={styles.sectionEmpty}>No games here yet.</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingRow}>
                    {section.games.map((g, index) => (
                      <Pressable key={`${section.title}-${g.id}`} style={[styles.trendCard, sectionIndex === 1 && styles.trendCardFeatured]} onPress={() => openGame(g.id)}>
                        <Image source={{ uri: resolveThumbnail(g.thumbnail, g.id, g) }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFillObject} />
                        <View style={styles.trendBody}>
                          <Text style={styles.trendTitle} numberOfLines={1}>{g.name}</Text>
                          <View style={styles.trendMetaRow}>
                            <Ionicons name="people" size={10} color="rgba(255,255,255,0.85)" />
                            <Text style={styles.trendMeta}>{cardMetaForTab(activeTab, g, index)}</Text>
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>

              {sectionIndex === 0 && creators.length > 0 ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, styles.sectionTitleInset]}>Popular Creators</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.creatorRow}
                  >
                    {creators.slice(0, 12).map((c) => (
                      <Pressable
                        key={c.id}
                        style={styles.creatorCol}
                        onPress={() =>
                          setSelectedCreator({
                            id: c.id,
                            username: c.username,
                            displayName: c.displayName,
                            avatar: c.avatar,
                            verified: c.verified,
                            isFriend: false,
                          })
                        }
                      >
                        <View style={styles.creatorAvatarWrap}>
                          <Avatar uri={c.avatar} userId={c.id} size={62} />
                        </View>
                        <Text style={styles.creatorHandle} numberOfLines={1}>
                          @{c.username}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </React.Fragment>
          ))
        ) : activeTab === 'Games' ? (
          <View style={styles.section}>
            <View style={styles.catalogGrid}>
              {categoryGames.slice(0, 16).map((g, index) => (
                <Pressable key={`catalog-${g.id}`} style={[styles.feedTile, index % 3 === 0 && styles.feedTileTall]} onPress={() => openGame(g.id)}>
                  <Image source={{ uri: resolveThumbnail(g.thumbnail, g.id, g) }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.82)']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFillObject} />
                  <View style={styles.feedCountPill}>
                    <Ionicons name="heart" size={12} color={TEXT} />
                    <Text style={styles.feedCountText}>{formatCount(g.likes || g.plays || 0)}</Text>
                  </View>
                  <View style={styles.feedTileBody}>
                    <Text style={styles.feedTileTitle} numberOfLines={2}>{g.name}</Text>
                    <View style={styles.feedTileMetaRow}>
                      <Ionicons name={index % 2 === 0 ? 'flash' : 'game-controller'} size={11} color="rgba(255,255,255,0.86)" />
                      <Text style={styles.feedTileMeta}>{cardMetaForTab(activeTab, g, index)}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : activeTab === 'Horror' ? (
          <View style={styles.section}>
            <View style={styles.catalogGrid}>
              {categoryGames.slice(0, 16).map((g, index) => (
                <Pressable key={`horror-${g.id}`} style={[styles.feedTile, styles.horrorTile, index % 4 === 1 && styles.feedTileTall]} onPress={() => openGame(g.id)}>
                  <Image source={{ uri: resolveThumbnail(g.thumbnail, g.id, g) }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  <LinearGradient colors={['rgba(0,0,0,0.18)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.9)']} locations={[0, 0.48, 1]} style={StyleSheet.absoluteFillObject} />
                  <View style={styles.feedCountPill}>
                    <Ionicons name="heart" size={12} color={TEXT} />
                    <Text style={styles.feedCountText}>{formatCount(g.likes || g.plays || 0)}</Text>
                  </View>
                  <View style={styles.feedTileBody}>
                    <Text style={styles.feedTileTitle} numberOfLines={2}>{g.name}</Text>
                    <View style={styles.feedTileMetaRow}>
                      <Ionicons name="moon" size={11} color="#ff4aa2" />
                      <Text style={styles.feedTileMeta}>{cardMetaForTab(activeTab, g, index)}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : activeTab === 'Roleplay' ? (
          <View style={styles.section}>
            <View style={styles.roleplayGrid}>
              {categoryGames.slice(0, 12).map((g, index) => (
                <Pressable key={`room-${g.id}`} style={[styles.roleplayCard, index % 3 === 0 && styles.roleplayCardTall]} onPress={() => openGame(g.id)}>
                  <View style={styles.roleplayImageWrap}>
                    <Image source={{ uri: resolveThumbnail(g.thumbnail, g.id, g) }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    <View style={styles.roleplayViews}>
                      <Ionicons name="eye" size={12} color={TEXT} />
                      <Text style={styles.roleplayViewsText}>{formatCount(g.plays || 0)}</Text>
                    </View>
                  </View>
                  <View style={styles.roleplayBody}>
                    <Text style={styles.roleplayTitle} numberOfLines={2}>{g.name}</Text>
                    <Text style={styles.roleplayDesc} numberOfLines={3}>
                      {index % 2 === 0 ? 'Step into a living world with players already building the story.' : 'Choose a role, meet characters, and shape what happens next.'}
                    </Text>
                    <View style={styles.roleplayTags}>
                      {['Roleplay', index % 2 === 0 ? 'Fantasy' : 'Social'].map((tag) => (
                        <View key={tag} style={styles.roleplayTag}>
                          <Text style={styles.roleplayTagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.catalogGrid}>
              {categoryGames.slice(0, 16).map((g, index) => (
                <Pressable key={`quiz-${g.id}`} style={[styles.feedTile, styles.quizFeedTile]} onPress={() => openGame(g.id)}>
                  <Image source={{ uri: resolveThumbnail(g.thumbnail, g.id, g) }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.04)', 'rgba(0,0,0,0.84)']} locations={[0, 0.52, 1]} style={StyleSheet.absoluteFillObject} />
                  <View style={styles.feedCountPill}>
                    <Ionicons name="heart" size={12} color={TEXT} />
                    <Text style={styles.feedCountText}>{formatCount(g.likes || g.plays || 0)}</Text>
                  </View>
                  <View style={styles.feedTileBody}>
                    <Text style={styles.feedTileTitle} numberOfLines={2}>{g.name}</Text>
                    <View style={styles.feedTileMetaRow}>
                      <Ionicons name="help-circle" size={11} color="rgba(255,255,255,0.86)" />
                      <Text style={styles.feedTileMeta}>{cardMetaForTab(activeTab, g, index)}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      {/* Search modal */}
      <Modal visible={searchModalVisible} animationType="slide" onRequestClose={() => setSearchModalVisible(false)}>
        <View style={[styles.searchModal, { paddingTop: insets.top + 8 }]}>
          <View style={styles.searchHeader}>
            <Pressable onPress={() => { setSearchModalVisible(false); setSearchQuery(''); }} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={TEXT} />
            </Pressable>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search" size={16} color={TEXT_DIM} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search games and creators"
                placeholderTextColor={TEXT_DIM}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                  <Ionicons name="close-circle" size={16} color={TEXT_DIM} />
                </Pressable>
                ) : null}
                  </View>
              </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
            {searchQuery.trim().length === 0 ? (
              <>
                <Text style={styles.searchBigTitle}>Charts</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chartsRow}
                >
                  <View style={styles.topSearchesCard}>
                    <View style={styles.chartCardHeader}>
                      <Text style={styles.chartCardTitle}>Top Searches</Text>
                      <Ionicons name="flash" size={42} color="rgba(255,255,255,0.16)" />
                    </View>
                    {TRENDING_SEARCHES.map((term, index) => (
                      <Pressable
                        key={term}
                        style={styles.topSearchRow}
                        onPress={() => setSearchQuery(term)}
                      >
                        <View style={styles.topSearchIcon}>
                          <Ionicons name="search" size={18} color="rgba(255,255,255,0.78)" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.topSearchTerm}>
                            {term} {index < 3 ? '🔥' : ''}
                          </Text>
                          <Text style={styles.topSearchCount}>
                            {formatCount(49400 - index * 1700)} searches
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.72)" />
                      </Pressable>
                    ))}
                  </View>

                  {creators.length > 0 ? (
                    <View style={styles.topCreatorsCard}>
                      <Text style={styles.chartCardTitle}>Top Creators</Text>
                      {creators.slice(0, 6).map((c, index) => (
                        <Pressable
                          key={`top-${c.id}`}
                          style={styles.topCreatorRow}
                          onPress={() => {
                            setSearchModalVisible(false);
                            setSelectedCreator({
                              id: c.id,
                              username: c.username,
                              displayName: c.displayName,
                              avatar: c.avatar,
                              verified: c.verified,
                              isFriend: false,
                            });
                          }}
                        >
                          <Avatar uri={c.avatar} userId={c.id} size={38} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.topCreatorName} numberOfLines={1}>
                              {c.displayName || c.username}
                            </Text>
                            <Text style={styles.topCreatorSub} numberOfLines={1}>
                              #{index + 1} creator
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </ScrollView>

                {topGames.length > 0 ? (
                  <>
                    <Text style={[styles.searchBigTitle, { marginTop: 24 }]}>Top Games</Text>
                    <View style={styles.searchGamesGrid}>
                      {topGames.map((g, index) => (
                        <Pressable
                          key={`top-game-${g.id}`}
                          style={styles.searchGameCard}
                          onPress={() => {
                            setSearchModalVisible(false);
                            openGame(g.id);
                          }}
                        >
                          <Image
                            source={{ uri: resolveThumbnail(g.thumbnail, g.id, g) }}
                            style={StyleSheet.absoluteFillObject}
                            resizeMode="cover"
                          />
                          <LinearGradient
                            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
                            locations={[0, 0.45, 1]}
                            style={StyleSheet.absoluteFillObject}
                          />
                          <View style={styles.topGameRank}>
                            <Text style={styles.topGameRankText}>#{index + 1}</Text>
                          </View>
                          <View style={styles.searchGameBody}>
                            <Text style={styles.searchGameTitle} numberOfLines={1}>
                              {g.name}
                            </Text>
                            <View style={styles.trendMetaRow}>
                              <Ionicons name="people" size={10} color="rgba(255,255,255,0.85)" />
                              <Text style={styles.trendMeta}>{formatCount(g.plays || 0)}</Text>
                            </View>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}
              </>
            ) : searching ? (
              <Text style={styles.searchHint}>Searching…</Text>
            ) : (
            <>
                {searchCreators.length > 0 ? (
                  <>
                    <Text style={styles.searchSectionTitle}>Creators</Text>
                    {searchCreators.slice(0, 5).map((c) => (
                      <Pressable
                        key={c.id}
                        style={styles.searchCreatorRow}
                        onPress={() => {
                          setSearchModalVisible(false);
                          setSelectedCreator({
                            id: c.id,
                            username: c.username,
                            displayName: c.displayName,
                            avatar: c.avatar,
                            verified: c.verified,
                            isFriend: false,
                          });
                        }}
                      >
                        <Avatar uri={c.avatar} userId={c.id} size={42} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.searchCreatorName}>{c.displayName || c.username}</Text>
                          <Text style={styles.searchCreatorHandle}>@{c.username}</Text>
                      </View>
                      </Pressable>
                    ))}
                  </>
                ) : null}

                {searchResults.length > 0 ? (
                  <>
                    <Text style={[styles.searchSectionTitle, { marginTop: 18 }]}>Games</Text>
                    <View style={styles.searchGamesGrid}>
                      {searchResults.map((g) => (
                        <Pressable
                          key={g.id}
                          style={styles.searchGameCard}
                          onPress={() => {
                            setSearchModalVisible(false);
                            openGame(g.id);
                          }}
                        >
                          <Image
                            source={{ uri: resolveThumbnail(g.thumbnail, g.id, g) }}
                            style={StyleSheet.absoluteFillObject}
                            resizeMode="cover"
                          />
                          <LinearGradient
                            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
                            locations={[0, 0.45, 1]}
                            style={StyleSheet.absoluteFillObject}
                          />
                          <View style={styles.searchGameBody}>
                            <Text style={styles.searchGameTitle} numberOfLines={1}>
                              {g.name}
                            </Text>
                          </View>
                        </Pressable>
                  ))}
                </View>
                  </>
            ) : null}

                {searchResults.length === 0 && searchCreators.length === 0 && !searching ? (
                  <Text style={styles.searchHint}>No results found.</Text>
              ) : null}
              </>
            )}
                </ScrollView>
              </View>
      </Modal>

      {/* Direct game player */}
      <Modal
        visible={!!playingGame}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setPlayingGame(null);
          setGameLoaded(false);
        }}
      >
        <View style={[styles.playerRoot, { backgroundColor: playingGame?.color || '#000' }]}>
          <StatusBar hidden />
          {playingGame ? (
            <WebView
              ref={playerWebViewRef}
              source={{ uri: getGameUrl(playingGame) }}
              style={styles.playerWebView}
              scrollEnabled={false}
              bounces={false}
              overScrollMode="never"
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowsAirPlayForMediaPlayback={false}
              onLoadProgress={({ nativeEvent }) => {
                setLoadProgress(Math.round((nativeEvent.progress || 0) * 100));
              }}
              onLoadEnd={() => {
                setLoadProgress(100);
                setTimeout(() => setGameLoaded(true), 1200);
              }}
            />
          ) : null}

          {!gameLoaded && playingGame ? (
            <View style={StyleSheet.absoluteFill}>
              <GameLoadingScreen
                gameName={playingGame.name}
                gameThumbnail={resolveThumbnail(playingGame.thumbnail, playingGame.id, playingGame)}
                creatorName={playingGame.creatorDisplayName || playingGame.creatorUsername}
                progress={loadProgress}
              />
            </View>
          ) : null}

          <Pressable
            style={[styles.playerCloseBtn, { top: insets.top + 10 }]}
            onPress={() => {
              setPlayingGame(null);
              setGameLoaded(false);
            }}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
      </Modal>

      {/* Auth gate overlay */}
      {!isAuthenticated ? (
        <Pressable
          style={styles.authBlock}
          onPress={showAuthScreen}
        />
      ) : null}

      <UserProfileModal
        visible={!!selectedCreator}
        onClose={() => setSelectedCreator(null)}
        user={selectedCreator}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  playerRoot: {
    flex: 1,
  },
  playerWebView: {
    flex: 1,
    backgroundColor: '#000',
  },
  playerCloseBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HORIZ_PAD,
    paddingBottom: 14,
  },
  topLogo: {
    color: TEXT,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  topIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsScroll: {
    paddingHorizontal: HORIZ_PAD,
    gap: 14,
    paddingBottom: 14,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 0,
    paddingVertical: 7,
    borderRadius: 999,
  },
  tabBtnActive: {
    paddingHorizontal: 11,
    backgroundColor: 'rgba(34,25,52,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.22)',
  },
  tabActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff3fab',
  },
  tabLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  tabLabelActive: {
    color: PURPLE,
    fontWeight: '800',
  },
  heroWrap: {
    paddingHorizontal: HORIZ_PAD,
    marginTop: 6,
  },
  heroSlide: {
    width: HERO_WIDTH,
  },
  heroCard: {
    width: '100%',
    height: Math.min(338, Math.round(HERO_WIDTH * 0.75)),
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1a1a22',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.42)',
  },
  heroCardImage: {
    borderRadius: 22,
  },
  heroPillWrap: {
    position: 'absolute',
    top: 18,
    left: 18,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.42)',
    backgroundColor: 'rgba(8,10,22,0.7)',
  },
  heroPillText: {
    color: PURPLE,
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: -0.15,
  },
  heroBody: {
    position: 'absolute',
    left: 18,
    right: 22,
    bottom: 28,
  },
  heroDreamTitleBlock: {
    marginBottom: 12,
  },
  heroDreamTitle: {
    color: TEXT,
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -1.35,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 3,
  },
  heroTitleLine1: {
    color: TEXT,
    fontFamily: 'Graphik-Bold',
    fontSize: 30,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: -0.85,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  heroTitleLine2: {
    color: TEXT,
    fontFamily: 'Graphik-Bold',
    fontSize: 30,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: -0.85,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
    marginBottom: 7,
  },
  heroTitleAccent: {
    color: PURPLE,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  heroSubtitleStack: {
    marginBottom: 13,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 15,
    backgroundColor: PURPLE,
    alignSelf: 'flex-start',
    shadowColor: PURPLE,
    shadowOpacity: 0.42,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
  },
  heroCtaText: {
    color: TEXT,
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  heroDotActive: {
    width: 18,
    backgroundColor: PURPLE,
  },
  section: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HORIZ_PAD,
    marginBottom: 12,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  sectionTitleInset: {
    paddingHorizontal: HORIZ_PAD,
  },
  sectionEmoji: {
    fontSize: 16,
  },
  sectionSeeAll: {
    color: PURPLE,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionEmpty: {
    color: TEXT_MUTED,
    fontSize: 13,
    paddingHorizontal: HORIZ_PAD,
    paddingVertical: 18,
  },
  trendingRow: {
    paddingHorizontal: HORIZ_PAD,
    gap: 10,
  },
  trendCard: {
    width: 130,
    height: 168,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a1a22',
  },
  trendCardFeatured: {
    width: 148,
    height: 178,
  },
  trendCardQuiz: {
    height: 150,
  },
  trendBody: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
  },
  trendTitle: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  trendMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  trendMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '700',
  },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: HORIZ_PAD,
    alignItems: 'flex-start',
  },
  feedTile: {
    width: (SCREEN_WIDTH - HORIZ_PAD * 2 - 12) / 2,
    height: 246,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#15151c',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  feedTileTall: {
    height: 278,
  },
  horrorTile: {
    backgroundColor: '#07070a',
    borderColor: 'rgba(255,74,162,0.12)',
  },
  quizFeedTile: {
    height: 238,
  },
  feedCountPill: {
    position: 'absolute',
    left: 10,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.44)',
  },
  feedCountText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '900',
  },
  feedTileBody: {
    position: 'absolute',
    left: 12,
    right: 10,
    bottom: 44,
  },
  feedTileTitle: {
    color: TEXT,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    letterSpacing: -0.45,
    marginBottom: 6,
  },
  feedTileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  feedTileMeta: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '800',
  },
  cinemaList: {
    paddingHorizontal: HORIZ_PAD,
    gap: 12,
  },
  cinemaCard: {
    height: 164,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#171720',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.22)',
  },
  cinemaBody: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  cinemaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,74,162,0.28)',
    marginBottom: 8,
  },
  cinemaBadgeText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 10,
    fontWeight: '800',
  },
  cinemaTitle: {
    color: TEXT,
    fontSize: 21,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  roomList: {
    paddingHorizontal: HORIZ_PAD,
    gap: 10,
  },
  roomCard: {
    minHeight: 86,
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  roomThumb: {
    width: 66,
    height: 66,
    borderRadius: 12,
    backgroundColor: '#1a1a22',
  },
  roomInfo: {
    flex: 1,
    minWidth: 0,
  },
  roomTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.25,
  },
  roomMeta: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  roomAvatars: {
    flexDirection: 'row',
    marginTop: 8,
  },
  roomAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
    marginRight: -6,
    borderWidth: 1,
    borderColor: BG,
  },
  roomJoin: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: PURPLE,
  },
  roomJoinText: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '900',
  },
  roleplayChipRow: {
    paddingHorizontal: HORIZ_PAD,
    gap: 10,
    paddingBottom: 16,
  },
  roleplayChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  roleplayChipActive: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  roleplayChipText: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 13,
    fontWeight: '800',
  },
  roleplayChipTextActive: {
    color: TEXT,
  },
  roleplayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: HORIZ_PAD,
    alignItems: 'flex-start',
  },
  roleplayCard: {
    width: (SCREEN_WIDTH - HORIZ_PAD * 2 - 12) / 2,
    minHeight: 330,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#202020',
  },
  roleplayCardTall: {
    minHeight: 360,
  },
  roleplayImageWrap: {
    height: 190,
    backgroundColor: '#15151c',
  },
  roleplayViews: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  roleplayViewsText: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '900',
  },
  roleplayBody: {
    padding: 11,
  },
  roleplayTitle: {
    color: TEXT,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  roleplayDesc: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  roleplayTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  roleplayTag: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.11)',
  },
  roleplayTagText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '800',
  },
  quizGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: HORIZ_PAD,
  },
  quizCard: {
    width: (SCREEN_WIDTH - HORIZ_PAD * 2 - 10) / 2,
    minHeight: 142,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.18)',
  },
  quizIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(168,85,247,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quizTitle: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
    letterSpacing: -0.35,
    minHeight: 34,
  },
  quizMeta: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  quizStart: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: PURPLE,
  },
  quizStartText: {
    color: TEXT,
    fontSize: 11,
    fontWeight: '900',
  },
  creatorRow: {
    paddingHorizontal: HORIZ_PAD,
    gap: 14,
  },
  creatorCol: {
    width: 70,
    alignItems: 'center',
  },
  creatorAvatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  creatorHandle: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  authBlock: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  searchModal: {
    flex: 1,
    backgroundColor: BG,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    color: TEXT,
    fontSize: 14,
  },
  searchBigTitle: {
    color: TEXT,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.55,
    marginBottom: 12,
  },
  chartsRow: {
    gap: 14,
    paddingRight: 16,
  },
  topSearchesCard: {
    width: Math.min(320, SCREEN_WIDTH - 46),
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#202735',
    overflow: 'hidden',
  },
  topCreatorsCard: {
    width: 248,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#332a7c',
  },
  chartCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  chartCardTitle: {
    color: TEXT,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.45,
  },
  topSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
  },
  topSearchIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topSearchTerm: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  topSearchCount: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  topCreatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  topCreatorName: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  topCreatorSub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  searchHint: {
    color: TEXT_MUTED,
    fontSize: 13,
    paddingTop: 24,
  },
  searchSectionTitle: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  searchCreatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  searchCreatorName: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  searchCreatorHandle: {
    color: TEXT_MUTED,
    fontSize: 12,
    marginTop: 2,
  },
  searchGamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  searchGameCard: {
    width: (SCREEN_WIDTH - 32 - 8) / 2,
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a1a22',
  },
  topGameRank: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  topGameRankText: {
    color: TEXT,
    fontSize: 11,
    fontWeight: '900',
  },
  searchGameBody: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
  },
  searchGameTitle: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '800',
  },
});

export default ExploreScreen;
