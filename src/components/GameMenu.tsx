// The in-game menu: a small menu (three-line) button in the game's top-left corner. Tapping it slides a panel in
// from the left, like a console game's pause menu: Resume / Invite friends / Leave game, and the friends who are
// playing this game too. The game stays in view on the right (tapping it resumes). Leaving asks first, so a stray
// tap can't end a match. A landscape game is drawn turned 90° inside the portrait screen (GameSurface), so the
// button and the panel turn with it: they read the right way up while the phone is held sideways.
// (Mock: design/game-menu/options.html, B.)
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Share, Animated, Easing, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const friendsHere: Person[] = [
    ...here.map((f) => ({ id: f.id, name: f.displayName || f.username, avatar: f.avatar, note: 'Friend' })),
  ];

  // the game's own frame: turned like the game (its left edge is the phone's top, where the notch is)
  const frame = landscape
    ? { width: H, height: W, left: (W - H) / 2, top: (H - W) / 2, transform: [{ rotate: '90deg' }] }
    : { width: W, height: H, left: 0, top: 0 };
  const corner = landscape ? { top: 12, left: insets.top + 4 } : { top: insets.top + 8, left: 12 };
  const pad = landscape ? { paddingLeft: insets.top + 8, paddingTop: 16, paddingBottom: 16 }
    : { paddingLeft: 18, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 18 };
  const panelW = (landscape ? 250 : Math.min(300, W * 0.8)) + (landscape ? insets.top : 0);

  // the panel slides in from the left
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (open) Animated.timing(slide, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [open]);

  const show = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setConfirming(false); slide.setValue(0); setOpen(true); };
  const resume = () => Animated.timing(slide, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => setOpen(false));
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
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: slide }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={resume} accessibilityLabel="Resume">
              <LinearGradient colors={['rgba(8,7,14,0.55)', 'rgba(8,7,14,0.1)']} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0 }} style={StyleSheet.absoluteFill} />
            </Pressable>
          </Animated.View>
          <Animated.View style={[styles.panel, pad, { width: panelW, transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-panelW, 0] }) }] }]}>
            <View style={styles.top}>
              <Text style={styles.game} numberOfLines={1}>{gameName}</Text>
              <Pressable onPress={resume} hitSlop={10} accessibilityLabel="Close menu"><Ionicons name="close" size={22} color="#8b8799" /></Pressable>
            </View>

            {confirming ? (
              <>
                <Text style={styles.confirmTitle}>Leave {gameName}?</Text>
                <Text style={styles.confirmSub}>You'll go back to Games.</Text>
                <Pressable style={[styles.item, styles.leaveNow]} onPress={onLeave}>
                  <Ionicons name="exit-outline" size={20} color="#fff" /><Text style={styles.itemText}>Leave</Text>
                </Pressable>
                <Pressable style={styles.item} onPress={() => setConfirming(false)}>
                  <Ionicons name="arrow-back" size={20} color="#fff" /><Text style={styles.itemText}>Stay</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={[styles.item, styles.resume]} onPress={resume}>
                  <Ionicons name="play" size={20} color="#fff" /><Text style={styles.itemText}>Resume</Text>
                </Pressable>
                <Pressable style={styles.item} onPress={invite}>
                  <Ionicons name="person-add-outline" size={20} color="#fff" /><Text style={styles.itemText}>Invite friends</Text>
                </Pressable>
                <Pressable style={styles.item} onPress={() => setConfirming(true)}>
                  <Ionicons name="exit-outline" size={20} color="#fca5a5" /><Text style={[styles.itemText, { color: '#fca5a5' }]}>Leave game</Text>
                </Pressable>
                {friendsHere.length > 0 && (
                  <>
                    <View style={styles.sep} />
                    <Text style={styles.label}>FRIENDS IN HERE</Text>
                    {friendsHere.slice(0, 3).map((p) => (
                      <View key={p.id} style={styles.friend}>
                        <Avatar uri={p.avatar || undefined} size={32} />
                        <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </Animated.View>
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
  panel: {
    position: 'absolute', left: 0, top: 0, bottom: 0, paddingRight: 16, gap: 4,
    backgroundColor: 'rgba(14,12,22,0.95)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  game: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '800' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, height: 46, borderRadius: 12 },
  itemText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  resume: { backgroundColor: '#8b47f0' },
  leaveNow: { backgroundColor: '#dc2626', marginTop: 8 },
  sep: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 8 },
  label: { color: '#8b8799', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginLeft: 4, marginBottom: 4 },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingHorizontal: 4 },
  name: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  confirmTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 4 },
  confirmSub: { color: '#a7a3b5', fontSize: 13, marginTop: 4 },
});
