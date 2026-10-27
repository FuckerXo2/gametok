// GamesHome — the Games tab ("your lobby", design C of gametok/design/games-mocks): your avatar and a greeting at the
// top that follows who's online (nobody: invite; one friend: join them; several: "Join friends" opens the list of
// friends and the game each is in), then Jump back in (your recent games) and For you.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions, RefreshControl, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { CustomImage as Image } from './CustomImage';
import { resolveGameThumbnail } from '../utils/thumbnails';
import { openAccountMenu } from './AccountMenu';
import { AvatarStage } from './AvatarStage';
import { TokBuxIcon } from './TokBuxIcon';
import { Avatar } from './Avatar';
import { useAvatarAccount } from '../avatar/store';
import { DEFAULT_AVATAR } from '../avatar/catalog';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { users as usersApi } from '../services/api';
import { SHOWCASE, SHOWCASE_FRIENDS, SHOWCASE_RECENT } from '../dev/showcase';

const BG = '#0d0a16';
const CARD = '#1b1626';
const TEXT = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.55)';
const PURPLE = '#a855f7';
const GREEN = '#22c55e';
const PAD = 16;

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
  activeCategory?: string | null;
  onCategory?: (slug: string | null) => void;
  onOpen: (game: HomeGame) => void;
  onSearch: () => void;
  onFriends: () => void;
  onOpenShop?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

// Built-in catalog so the screen is never empty while the list loads
const DEFAULT_CATALOG: HomeGame[] = [
  {
    id: 'no-rules-fc',
    name: 'No Rules FC',
    description: '5v5 hero football on the streets. No referee, no fouls, every player has a game-changing super move.',
    thumbnail: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/web-games/no-rules-fc/thumb.jpg',
    categories: ['sports', 'action'],
    plays: 87000,
  },
];

interface Friend { id: string; name: string; avatar?: string; status: string; gameId?: string }

const thumb = (g: HomeGame) => resolveGameThumbnail(g.thumbnail, g.id, g as any);
const plays = (n?: number) => (!n ? '' : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K plays` : `${n} plays`);

export const GamesHome = ({ games, recentIds, onOpen, onSearch, onFriends, onOpenShop, refreshing, onRefresh }: Props) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const account = useAvatarAccount();
  const { user } = useAuth();
  const { presenceMap, presenceGames } = useSocket();
  const [following, setFollowing] = useState<any[]>([]);
  const [seed, setSeed] = useState<{ statuses: Record<string, string>; games: Record<string, string> }>({ statuses: {}, games: {} });
  const [sheet, setSheet] = useState(false);

  const catalog = useMemo(() => {
    const out = [...games];
    for (const g of DEFAULT_CATALOG) if (!out.some((x) => x.id === g.id)) out.push(g);
    return out;
  }, [games]);
  const byId = (id?: string) => catalog.find((g) => g.id === id);
  const recent = useMemo(() => {
    const r = (SHOWCASE ? SHOWCASE_RECENT : recentIds).map((id) => byId(id)).filter(Boolean) as HomeGame[];
    return r.length ? r : [...catalog].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 6);
  }, [recentIds, catalog]);
  const forYou = useMemo(() => [...catalog].sort((a, b) => (b.plays || 0) - (a.plays || 0)), [catalog]);

  // who you follow, and who of them is on (seeded once, then live from the presence socket)
  const loadFriends = async () => {
    if (!user?.id) return;
    try {
      const list = await usersApi.following(user.id);
      const arr = Array.isArray(list) ? list : list?.users || [];
      setFollowing(arr);
      if (arr.length) {
        const p = await usersApi.presence(arr.map((f: any) => f.id));
        setSeed({ statuses: p.statuses || {}, games: p.games || {} });
      }
    } catch { /* offline: no friends row */ }
  };
  useEffect(() => { loadFriends(); }, [user?.id]);
  const online: Friend[] = useMemo(() => SHOWCASE ? SHOWCASE_FRIENDS : following.map((f: any) => {
    const status = presenceMap.get(f.id) || seed.statuses[f.id] || 'offline';
    const gameId = status === 'in-game' ? presenceGames.get(f.id) || seed.games[f.id] : undefined;
    return { id: f.id, name: f.displayName || f.username, avatar: f.avatar, status, gameId };
  }).filter((f) => f.status === 'online' || f.status === 'in-game')
    .sort((a, b) => Number(!!b.gameId) - Number(!!a.gameId)), [following, presenceMap, presenceGames, seed]);

  const firstName = (user?.displayName || user?.username || '').split(' ')[0];
  const join = (f: Friend) => {
    const g = byId(f.gameId);
    if (!g) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSheet(false);
    onOpen(g);
  };
  const tap = (g: HomeGame) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpen(g); };
  const cell = (width - PAD * 2 - 10) / 2;

  // the greeting follows who's online
  const one = online.length === 1 ? online[0] : null;
  const greeting = !online.length ? (
    <>
      <Text style={styles.greetSub}>None of your friends are on right now</Text>
      <Pressable style={[styles.pill, styles.pillDim]} onPress={onFriends}><Ionicons name="person-add-outline" size={14} color={TEXT} /><Text style={styles.pillText}>Invite friends</Text></Pressable>
    </>
  ) : one ? (
    <>
      <View style={[styles.row, { marginTop: 10, gap: 8 }]}>
        <Avatar uri={one.avatar} size={34} style={styles.onRing} />
        <Text style={styles.greetSub2} numberOfLines={2}><Text style={{ fontWeight: '800', color: TEXT }}>{one.name}</Text>{one.gameId ? ` is in ${byId(one.gameId)?.name ?? 'a game'}` : ' is online'}</Text>
      </View>
      {byId(one.gameId) ? <Pressable style={styles.pill} onPress={() => join(one)}><Text style={styles.pillText}>Join {one.name}</Text></Pressable> : null}
    </>
  ) : (
    <>
      <View style={[styles.row, { marginTop: 10 }]}>
        {online.slice(0, 3).map((f, i) => <Avatar key={f.id} uri={f.avatar} size={30} style={[styles.stack, i > 0 && { marginLeft: -8 }]} />)}
        <Text style={[styles.greetSub2, { marginLeft: 8, color: TEXT, fontWeight: '700' }]}>{online.length} friends online</Text>
      </View>
      <Pressable style={styles.pill} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSheet(true); }}><Text style={styles.pillText}>Join friends</Text></Pressable>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { onRefresh(); loadFriends(); }} tintColor="#fff" />}>
        {/* you */}
        <View style={{ height: insets.top + 286 }}>
          {/* the 3D stage fills the top, the avatar framed on its right */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <AvatarStage style={StyleSheet.absoluteFill} avatar={account?.avatar ?? DEFAULT_AVATAR} look="dark" focus="lobby" passive />
            <LinearGradient colors={['rgba(13,10,22,0)', BG]} style={styles.fade} />
          </View>
          <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
            <Pressable style={styles.round} onPress={openAccountMenu} accessibilityLabel="Menu" hitSlop={6}><Ionicons name="menu" size={22} color={TEXT} /></Pressable>
            <View style={[styles.row, { gap: 10 }]}>
              <Pressable style={styles.round} onPress={onSearch} accessibilityLabel="Search games" hitSlop={6}><Ionicons name="search" size={20} color={TEXT} /></Pressable>
              <Pressable style={styles.tb} onPress={onOpenShop} hitSlop={6}><TokBuxIcon size={24} /><Text style={styles.tbText}>{(account?.tokbux ?? 0).toLocaleString()}</Text></Pressable>
            </View>
          </View>
          <View style={[styles.greet, { top: insets.top + 86 }]}>
            <Text style={styles.hey}>Hey {firstName},{'\n'}ready?</Text>
            {greeting}
          </View>
        </View>

        <Text style={styles.heading}>Jump back in</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAD, gap: 10 }}>
          {recent.map((g) => (
            <Pressable key={g.id} style={{ width: 160 }} onPress={() => tap(g)}>
              <Image source={{ uri: thumb(g) }} style={styles.wide} resizeMode="cover" />
              <Text style={styles.name} numberOfLines={1}>{g.name}</Text>
              {g.plays ? <Text style={styles.meta}>{plays(g.plays)}</Text> : null}
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.heading}>For you</Text>
        <View style={styles.grid}>
          {forYou.map((g) => (
            <Pressable key={g.id} style={{ width: cell }} onPress={() => tap(g)}>
              <Image source={{ uri: thumb(g) }} style={[styles.tall, { height: cell * 0.75 }]} resizeMode="cover" />
              <Text style={styles.name} numberOfLines={1}>{g.name}</Text>
              {g.plays ? <Text style={styles.meta}>{plays(g.plays)}</Text> : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Join friends: who's on, and the game each is in */}
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable style={styles.dim} onPress={() => setSheet(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />
          <Text style={[styles.heading, { marginTop: 4, marginHorizontal: 0 }]}>Friends online</Text>
          {online.map((f) => {
            const g = byId(f.gameId);
            return (
              <View key={f.id} style={[styles.row, styles.friendRow]}>
                <Avatar uri={f.avatar} size={44} style={styles.onRing} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.friendName}>{f.name}</Text>
                  <Text style={styles.meta}>{f.gameId ? `In ${g?.name ?? 'a game'}` : 'Online'}</Text>
                </View>
                {g ? <Image source={{ uri: thumb(g) }} style={styles.friendGame} resizeMode="cover" /> : null}
                {g ? <Pressable style={[styles.pill, { marginTop: 0, marginLeft: 10 }]} onPress={() => join(f)}><Text style={styles.pillText}>Join</Text></Pressable> : null}
              </View>
            );
          })}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  topBar: { position: 'absolute', left: PAD, right: PAD, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  tb: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingVertical: 5, paddingLeft: 5, paddingRight: 12 },
  tbText: { color: TEXT, fontWeight: '800', fontSize: 15 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 60 },
  greet: { position: 'absolute', left: 18, right: '42%' },
  hey: { color: TEXT, fontSize: 28, fontWeight: '900', letterSpacing: -0.6, lineHeight: 31 },
  greetSub: { color: MUTED, fontSize: 14, marginTop: 8 },
  greetSub2: { color: MUTED, fontSize: 13, flexShrink: 1 },
  onRing: { borderWidth: 2, borderColor: GREEN },
  stack: { borderWidth: 2, borderColor: BG },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: PURPLE, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, marginTop: 12 },
  pillDim: { backgroundColor: 'rgba(255,255,255,0.12)' },
  pillText: { color: TEXT, fontWeight: '800', fontSize: 14 },
  heading: { color: TEXT, fontSize: 20, fontWeight: '800', marginHorizontal: PAD, marginTop: 20, marginBottom: 10 },
  wide: { width: 160, height: 96, borderRadius: 14, backgroundColor: CARD },
  tall: { width: '100%', borderRadius: 14, backgroundColor: CARD },
  name: { color: TEXT, fontWeight: '700', fontSize: 14, marginTop: 6 },
  meta: { color: MUTED, fontSize: 12, marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: PAD },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 6 },
  friendRow: { paddingVertical: 10 },
  friendName: { color: TEXT, fontWeight: '800', fontSize: 16 },
  friendGame: { width: 56, height: 36, borderRadius: 8, backgroundColor: BG },
});
