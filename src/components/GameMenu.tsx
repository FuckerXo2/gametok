// The in-game menu, like Roblox's: a small menu (three-line) button in the game's top-left corner. Tapping it blurs
// and dims the whole game: the game's name up top, the people in this game with you (you, then friends playing it),
// and Leave · Invite · Resume along the bottom. Leaving asks first, so a stray tap can't end a match. A landscape
// game is drawn turned 90° inside the portrait screen (GameSurface), so the button and the menu turn with it: they
// read the right way up while the phone is held sideways. (Mock: design/game-menu/mock.html.)
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Share, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Avatar } from './Avatar';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { users as usersApi } from '../services/api';

interface Person { id: string; name: string; avatar?: string | null; note: string }

export const GameMenu: React.FC<{ gameId: string; gameName: string; landscape: boolean; onLeave: () => void }> = ({
  gameId, gameName, landscape, onLeave,
}) => {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { presenceMap, presenceGames } = useSocket();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [following, setFollowing] = useState<any[]>([]);
  const [seed, setSeed] = useState<{ statuses: Record<string, string>; games: Record<string, string> }>({ statuses: {}, games: {} });

  // who you follow and where they are, fetched when the menu opens (then live from the presence socket)
  useEffect(() => {
    if (!open || !user?.id) return;
    (async () => {
      try {
        const list = await usersApi.following(user.id);
        const arr = Array.isArray(list) ? list : list?.users || [];
        setFollowing(arr);
        if (arr.length) { const p = await usersApi.presence(arr.map((f: any) => f.id)); setSeed({ statuses: p.statuses || {}, games: p.games || {} }); }
      } catch { /* offline: just you */ }
    })();
  }, [open, user?.id]);

  const here = following.filter((f) => {
    const status = presenceMap.get(f.id) || seed.statuses[f.id];
    return status === 'in-game' && (presenceGames.get(f.id) || seed.games[f.id]) === gameId;
  });
  const people: Person[] = [
    ...(user ? [{ id: user.id, name: user.displayName || user.username, avatar: (user as any).avatar, note: 'You' }] : []),
    ...here.map((f) => ({ id: f.id, name: f.displayName || f.username, avatar: f.avatar, note: 'Friend' })),
  ];

  // the game's own frame: turned like the game (its left edge is the phone's top, where the notch is)
  const frame = landscape
    ? { width: H, height: W, left: (W - H) / 2, top: (H - W) / 2, transform: [{ rotate: '90deg' }] }
    : { width: W, height: H, left: 0, top: 0 };
  const corner = landscape ? { top: 12, left: insets.top + 4 } : { top: insets.top + 8, left: 12 };
  const pad = landscape ? { paddingLeft: insets.top + 12, paddingRight: insets.bottom + 24, paddingTop: 18, paddingBottom: 18 }
    : { paddingLeft: 18, paddingRight: 18, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 18 };

  const show = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setConfirming(false); setOpen(true); };
  const resume = () => setOpen(false);
  const invite = () => {
    const url = `https://gametok.co/game/${encodeURIComponent(gameId)}`;
    Share.share({ message: `Play ${gameName} with me on GameTok! ${url}` }).catch(() => {});
  };

  return (
    <View style={[styles.frame, frame]} pointerEvents="box-none">
      {!open && (
        <Pressable style={[styles.corner, corner]} onPress={show} hitSlop={10} accessibilityLabel="Game menu">
          <Ionicons name="menu" size={24} color="#fff" />
        </Pressable>
      )}
      {open && (
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(8,7,14,0.55)', 'rgba(8,7,14,0.85)']} style={StyleSheet.absoluteFill} />
          <View style={[styles.menu, pad]}>
            <View style={styles.top}>
              <Pressable style={styles.close} onPress={resume} hitSlop={8} accessibilityLabel="Close menu">
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
              <Text style={styles.game} numberOfLines={1}>{gameName}</Text>
            </View>

            {confirming ? (
              <View style={styles.confirm}>
                <Text style={styles.confirmTitle}>Leave {gameName}?</Text>
                <Text style={styles.confirmSub}>You'll go back to Games.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.label}>IN THIS GAME WITH YOU · {people.length}</Text>
                <View style={[styles.people, !landscape && { flexDirection: 'column' }]}>
                  {people.slice(0, landscape ? 3 : 4).map((p) => (
                    <View key={p.id} style={[styles.person, landscape && { flex: 1 }]}>
                      <Avatar uri={p.avatar || undefined} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.note}>{p.note}</Text>
                      </View>
                    </View>
                  ))}
                  {people.length <= 1 && (
                    <Pressable style={[styles.person, styles.ghost, landscape && { flex: 2 }]} onPress={invite}>
                      <Ionicons name="person-add-outline" size={20} color="#a7a3b5" />
                      <Text style={styles.ghostText}>None of your friends are in here. Invite some?</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}

            <View style={{ flex: 1 }} />
            <View style={styles.actions}>
              {confirming ? (
                <>
                  <Pressable style={styles.btn} onPress={() => setConfirming(false)}>
                    <Ionicons name="arrow-back" size={20} color="#fff" /><Text style={styles.btnText}>Stay</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.leaveNow]} onPress={onLeave}>
                    <Ionicons name="exit-outline" size={20} color="#fff" /><Text style={styles.btnText}>Leave</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable style={styles.btn} onPress={() => setConfirming(true)}>
                    <Ionicons name="exit-outline" size={20} color="#fca5a5" /><Text style={[styles.btnText, { color: '#fca5a5' }]}>Leave</Text>
                  </Pressable>
                  <Pressable style={styles.btn} onPress={invite}>
                    <Ionicons name="person-add-outline" size={20} color="#fff" /><Text style={styles.btnText}>Invite</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.resume]} onPress={resume}>
                    <Ionicons name="play" size={20} color="#fff" /><Text style={styles.btnText}>Resume</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: { position: 'absolute', zIndex: 100 },
  corner: {
    position: 'absolute', width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  menu: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  close: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  game: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  label: { marginTop: 18, marginBottom: 8, color: '#8b8799', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  people: { flexDirection: 'row', gap: 10 },
  person: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  name: { color: '#fff', fontSize: 14, fontWeight: '700' },
  note: { color: '#a7a3b5', fontSize: 11, marginTop: 2 },
  ghost: { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.18)' },
  ghostText: { flex: 1, color: '#a7a3b5', fontSize: 13, fontWeight: '600' },
  confirm: { marginTop: 28 },
  confirmTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  confirmSub: { color: '#a7a3b5', fontSize: 14, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1, height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  resume: { flex: 1.4, backgroundColor: '#8b47f0', borderWidth: 0 },
  leaveNow: { backgroundColor: '#dc2626', borderWidth: 0 },
});
