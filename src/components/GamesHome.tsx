// GamesHome — the Games tab's main screen, pixel-matched to the official GameTok design.
// Includes TokBux shop integration, featured hero carousel, friends card, and themed rows.

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  RefreshControl,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { CustomImage as Image } from './CustomImage';
import { CATEGORIES, categoryLabel } from '../constants/categories';
import { resolveGameThumbnail } from '../utils/thumbnails';

const BG = '#08080C';
const SURFACE = '#181722';
const TEXT = '#FFFFFF';
const MUTED = '#9A96AA';
const PURPLE = '#8B5CF6';
const YELLOW = '#FFD23F';
const PAD = 16;

const TOKBUX_STORAGE_KEY = 'gametok_user_tokbux_balance';

export interface HomeGame {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  categories?: string[];
  plays?: number;
  createdAt?: string | null;
}

interface Props {
  games: HomeGame[];
  /** Ids of games this player opened recently, newest first. */
  recentIds: string[];
  activeCategory: string | null;
  onCategory: (slug: string | null) => void;
  onOpen: (game: HomeGame) => void;
  onSearch: () => void;
  onFriends: () => void;
  onOpenShop?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

// Built-in catalog so the screen is always populated and looks identical to the mockup
// Built-in catalog: ONLY the two core flagship games
const DEFAULT_CATALOG: HomeGame[] = [
  {
    id: 'gta-lagos',
    name: 'GTA Lagos',
    description: 'Open-world Lagos, from Ojota to Lekki. Hustle, drive, run missions with your crew, and play with everyone online.',
    thumbnail: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/web-games/gta-lagos/thumb.jpg',
    categories: ['action', 'adventure'],
    plays: 98000,
  },
  {
    id: 'no-rules-fc',
    name: 'No Rules FC',
    description: '5v5 hero football on the streets. No referee, no fouls, every player has a game-changing super move.',
    thumbnail: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/web-games/no-rules-fc/thumb.jpg',
    categories: ['sports', 'action'],
    plays: 87000,
  },
];

const thumb = (g: HomeGame) => resolveGameThumbnail(g.thumbnail, g.id, g as any);
const inCat = (g: HomeGame, slug: string) => (g.categories || []).includes(slug);

const ROWS: { slug: string; title: string; shape: 'wide' | 'tall' }[] = [
  { slug: 'racing', title: 'Floor it', shape: 'wide' },
  { slug: 'horror', title: "Don't play alone", shape: 'tall' },
  { slug: 'action', title: 'All action', shape: 'wide' },
  { slug: 'sports', title: 'Game day', shape: 'tall' },
  { slug: 'adventure', title: 'Go explore', shape: 'wide' },
];

export const GamesHome = ({
  games,
  recentIds,
  activeCategory,
  onCategory,
  onOpen,
  onSearch,
  onFriends,
  onOpenShop,
  refreshing,
  onRefresh,
}: Props) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [heroIndex, setHeroIndex] = useState(0);
  const [tokbuxBalance, setTokbuxBalance] = useState(1250);
  const heroW = width - PAD * 2;

  useEffect(() => {
    AsyncStorage.getItem(TOKBUX_STORAGE_KEY).then((val) => {
      if (val !== null) {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed)) setTokbuxBalance(parsed);
      }
    });
  }, []);

  // Strictly keep ONLY GTA Lagos and No Rules FC
  const effectiveGames = useMemo(() => {
    const isTarget = (id: string, name?: string) =>
      /gta[-_ ]?lagos/i.test(id) ||
      /gta lagos/i.test(name || '') ||
      /no[-_ ]?rules/i.test(id) ||
      /no rules/i.test(name || '');

    const filtered = games.filter((g) => isTarget(g.id, g.name));
    const existingIds = new Set(filtered.map((g) => g.id));
    const merged = [...filtered];

    DEFAULT_CATALOG.forEach((item) => {
      if (!existingIds.has(item.id)) merged.push(item);
    });

    return merged;
  }, [games]);

  const byPlays = useMemo(
    () => [...effectiveGames].sort((a, b) => (b.plays || 0) - (a.plays || 0)),
    [effectiveGames]
  );

  // Featured carousel: GTA Lagos first, No Rules FC second
  const featured = useMemo(() => {
    const gta = effectiveGames.find((g) => /gta/i.test(g.id) || /gta/i.test(g.name));
    const noRules = effectiveGames.find((g) => /no[-_ ]?rules/i.test(g.id) || /no rules/i.test(g.name));
    const list: HomeGame[] = [];
    if (gta) list.push(gta);
    if (noRules && noRules.id !== gta?.id) list.push(noRules);
    return list;
  }, [effectiveGames]);

  const recent = useMemo(
    () =>
      recentIds
        .map((id) => effectiveGames.find((g) => g.id === id))
        .filter(Boolean)
        .slice(0, 10) as HomeGame[],
    [recentIds, effectiveGames]
  );

  const rows = useMemo(() => {
    const shown = new Set(featured.map((g) => g.id));
    const out = ROWS.map((r) => {
      let list = byPlays.filter((g) => inCat(g, r.slug) && !shown.has(g.id)).slice(0, 10);
      if (list.length < 2) {
        // Fallback items in category from default catalog
        const extras = DEFAULT_CATALOG.filter((d) => inCat(d, r.slug) && !shown.has(d.id));
        list = [...list, ...extras].slice(0, 10);
      }
      list.forEach((g) => shown.add(g.id));
      return { ...r, list };
    }).filter((r) => r.list.length >= 1);

    const quick = byPlays
      .filter((g) => (inCat(g, 'arcade') || inCat(g, 'puzzle')) && !shown.has(g.id))
      .slice(0, 12);
    quick.forEach((g) => shown.add(g.id));
    const rest = byPlays.filter((g) => !shown.has(g.id));
    return { themed: out, quick, rest };
  }, [byPlays, featured]);

  const categoryList = useMemo(
    () => (activeCategory ? effectiveGames.filter((g) => inCat(g, activeCategory)) : []),
    [effectiveGames, activeCategory]
  );

  const tile = (width - PAD * 2 - 24) / 3;

  const Grid = ({ list }: { list: HomeGame[] }) => (
    <View style={styles.grid}>
      {list.map((g) => (
        <Pressable
          key={g.id}
          style={{ width: tile }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onOpen(g);
          }}
        >
          <View style={[styles.thumb, { width: tile, height: tile }]}>
            <Image source={{ uri: thumb(g) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </View>
          <Text style={styles.cardName} numberOfLines={1}>
            {g.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const Title = ({ children }: { children: string }) => (
    <Text style={styles.sectionTitle}>{children}</Text>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ paddingBottom: 130 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      {/* 1. Header with Kicker, Title, TokBux button, and Search */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <View>
          <Text style={styles.kicker}>YOUR NEXT FAVORITE</Text>
          <Text style={styles.pageTitle}>
            Games<Text style={styles.pageTitleDot}>.</Text>
          </Text>
        </View>

        <Pressable
          style={styles.iconBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSearch();
          }}
          accessibilityLabel="Search games"
          hitSlop={6}
        >
          <Ionicons name="search" size={20} color={TEXT} />
        </Pressable>
      </View>

      {/* 2. Category Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.categoryRail}
      >
        {[{ slug: null as string | null, label: 'For you' }, ...CATEGORIES].map((c) => {
          const on = activeCategory === c.slug;
          return (
            <Pressable
              key={c.slug || 'for-you'}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onCategory(c.slug);
              }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 3. Featured Hero Carousel */}
      {!activeCategory && featured.length > 0 ? (
        <View>
          <View style={styles.featureHeading}>
            <Text style={styles.featureEyebrow}>PICKED FOR YOU</Text>
            <Text style={styles.featureTitle}>Drop into something good.</Text>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            snapToInterval={heroW + 12}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: PAD, gap: 12 }}
            onMomentumScrollEnd={(e) =>
              setHeroIndex(Math.round(e.nativeEvent.contentOffset.x / (heroW + 12)))
            }
          >
            {featured.map((g, i) => (
              <Pressable
                key={g.id}
                style={[styles.hero, { width: heroW, height: heroW * 1.05 }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onOpen(g);
                }}
              >
                <Image source={{ uri: thumb(g) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <LinearGradient
                  colors={['rgba(8,8,12,0.1)', 'rgba(8,8,12,0.7)', 'rgba(8,8,12,0.98)']}
                  style={styles.heroShade}
                />

                {/* Top Badges */}
                <View style={styles.heroBadges}>
                  <Text style={[styles.badge, { backgroundColor: YELLOW, color: '#14110A' }]}>
                    {i === 0 ? 'FEATURED' : 'POPULAR'}
                  </Text>
                  {g.categories?.[0] ? (
                    <Text style={[styles.badge, styles.badgeDark]}>
                      {categoryLabel(g.categories[0]).toUpperCase()}
                    </Text>
                  ) : null}
                </View>

                {/* Bottom Body */}
                <View style={styles.heroBody}>
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {g.name}
                  </Text>
                  {g.description ? (
                    <Text style={styles.heroDesc} numberOfLines={2}>
                      {g.description}
                    </Text>
                  ) : null}

                  {/* Play Now CTA Button */}
                  <View style={styles.playBtn}>
                    <Ionicons name="play" size={18} color="#000" style={{ marginRight: 6 }} />
                    <Text style={styles.playText}>Play now</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {/* Carousel Dots */}
          <View style={styles.dots}>
            {featured.map((g, i) => (
              <View key={g.id} style={[styles.dot, i === heroIndex && styles.dotActive]} />
            ))}
          </View>
        </View>
      ) : null}

      {/* 4. Continue Playing Row */}
      {!activeCategory && recent.length > 0 ? (
        <View style={styles.section}>
          <Title>Continue playing</Title>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rowScroll}
          >
            {recent.map((g) => (
              <Pressable
                key={g.id}
                style={{ width: 120 }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onOpen(g);
                }}
              >
                <View style={[styles.thumb, { width: 120, height: 120 }]}>
                  <Image source={{ uri: thumb(g) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                </View>
                <Text style={styles.cardName} numberOfLines={1}>
                  {g.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* 5. See Who's Playing (Social / Friends banner) */}
      {!activeCategory ? (
        <Pressable
          style={styles.friends}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onFriends();
          }}
        >
          <View style={styles.friendIcon}>
            <Ionicons name="people" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.friendsTitle}>See who's playing</Text>
            <Text style={styles.friendsSub}>Find your friends and jump into their game.</Text>
          </View>
          <View style={styles.inviteBtn}>
            <Text style={styles.inviteText}>Friends</Text>
          </View>
        </Pressable>
      ) : null}

      {/* 6. Premier Games Showcase */}
      {activeCategory ? (
        <View style={styles.section}>
          {categoryList.length ? (
            <Grid list={categoryList} />
          ) : (
            <Text style={styles.empty}>No games in {categoryLabel(activeCategory)} yet.</Text>
          )}
        </View>
      ) : (
        <View style={styles.section}>
          <Title>Live Games</Title>
          <View style={{ gap: 14 }}>
            {effectiveGames.map((g) => (
              <Pressable
                key={g.id}
                style={styles.showcaseCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onOpen(g);
                }}
              >
                <View style={styles.showcaseThumbWrap}>
                  <Image source={{ uri: thumb(g) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <LinearGradient
                    colors={['transparent', 'rgba(10,8,16,0.92)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.showcaseBadge}>
                    <Text style={styles.showcaseBadgeText}>ONLINE 3D</Text>
                  </View>
                </View>
                <View style={styles.showcaseBody}>
                  <Text style={styles.showcaseTitle}>{g.name}</Text>
                  <Text style={styles.showcaseDesc} numberOfLines={2}>
                    {g.description}
                  </Text>
                  <View style={styles.showcaseFooter}>
                    <View style={styles.showcaseTagRow}>
                      <View style={styles.tagPill}>
                        <Text style={styles.tagText}>
                          {g.id === 'gta-lagos' ? 'Open World' : 'Hero 5v5'}
                        </Text>
                      </View>
                      <View style={styles.tagPill}>
                        <Text style={styles.tagText}>Multiplayer</Text>
                      </View>
                    </View>
                    <View style={styles.showcasePlayBtn}>
                      <Ionicons name="play" size={13} color="#000" style={{ marginRight: 4 }} />
                      <Text style={styles.showcasePlayText}>Play</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    paddingBottom: 14,
  },
  kicker: {
    color: '#8E8A9E',
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  pageTitle: {
    color: TEXT,
    fontSize: 34,
    lineHeight: 38,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -1.2,
  },
  pageTitleDot: {
    color: YELLOW,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tokbuxPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C192E',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#362E56',
    gap: 6,
  },
  tokbuxCoin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokbuxCoinText: {
    color: '#000000',
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    lineHeight: 12,
  },
  tokbuxText: {
    color: YELLOW,
    fontSize: 13,
    fontFamily: 'Inter_800ExtraBold',
  },
  tokbuxAddCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRail: {
    marginBottom: 20,
  },
  chips: {
    gap: 8,
    paddingHorizontal: PAD,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: SURFACE,
  },
  chipOn: {
    backgroundColor: '#FFFFFF',
  },
  chipText: {
    color: '#D4D0E5',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  chipTextOn: {
    color: '#000000',
    fontFamily: 'Inter_800ExtraBold',
  },
  featureHeading: {
    paddingHorizontal: PAD,
    marginBottom: 12,
  },
  featureEyebrow: {
    color: YELLOW,
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1.7,
    marginBottom: 4,
  },
  featureTitle: {
    color: TEXT,
    fontSize: 22,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.4,
  },
  hero: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: '#262335',
  },
  heroShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '75%',
  },
  heroBadges: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  badgeDark: {
    backgroundColor: 'rgba(10,10,14,0.75)',
    color: TEXT,
  },
  heroBody: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    gap: 8,
  },
  heroTitle: {
    color: TEXT,
    fontSize: 30,
    lineHeight: 34,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.8,
  },
  heroDesc: {
    color: '#C6C2D6',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
  },
  playBtn: {
    marginTop: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: {
    color: '#000000',
    fontSize: 16,
    fontFamily: 'Inter_800ExtraBold',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3E3A4F',
  },
  dotActive: {
    width: 24,
    backgroundColor: TEXT,
  },
  section: {
    marginTop: 28,
    paddingHorizontal: PAD,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 22,
    fontFamily: 'Inter_800ExtraBold',
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  seeAll: {
    color: '#B68BFE',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  rowScroll: {
    gap: 12,
    paddingRight: PAD,
  },
  thumb: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: SURFACE,
  },
  cardName: {
    color: TEXT,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    marginTop: 6,
  },
  cardNameBig: {
    color: TEXT,
    fontSize: 15,
    fontFamily: 'Inter_800ExtraBold',
    marginTop: 8,
  },
  friends: {
    marginTop: 26,
    marginHorizontal: PAD,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#19152B',
    borderWidth: 1,
    borderColor: '#292245',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  friendIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7C4DFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsTitle: {
    color: TEXT,
    fontSize: 16,
    fontFamily: 'Inter_800ExtraBold',
  },
  friendsSub: {
    color: '#ACA7C2',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  inviteBtn: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: PURPLE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_800ExtraBold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  showcaseCard: {
    backgroundColor: '#151322',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#26223B',
  },
  showcaseThumbWrap: {
    width: '100%',
    height: 180,
    backgroundColor: '#0F0E18',
    position: 'relative',
  },
  showcaseBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: YELLOW,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  showcaseBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.8,
  },
  showcaseBody: {
    padding: 16,
  },
  showcaseTitle: {
    color: TEXT,
    fontSize: 20,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.4,
  },
  showcaseDesc: {
    color: '#B5B0CC',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
  },
  showcaseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  showcaseTagRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tagPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    color: '#D4D0E6',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  showcasePlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  showcasePlayText: {
    color: '#000000',
    fontSize: 13,
    fontFamily: 'Inter_800ExtraBold',
  },
  empty: {
    color: MUTED,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginTop: 30,
  },
});
