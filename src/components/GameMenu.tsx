// The in-game menu, like Roblox's: a small menu (three-line) button in the game's top-left corner opens Resume / Invite
// friends / Leave game over the game. Leaving asks first, so a stray tap can't end a match. A landscape game is
// drawn turned 90° inside the portrait screen (GameSurface), so the button and the menu turn with it: they read
// the right way up while the phone is held sideways.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Share, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

export const GameMenu: React.FC<{ gameId: string; gameName: string; landscape: boolean; onLeave: () => void }> = ({
  gameId, gameName, landscape, onLeave,
}) => {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // the game's own frame: turned like the game (its left edge is the phone's top, where the notch is)
  const frame = landscape
    ? { width: H, height: W, left: (W - H) / 2, top: (H - W) / 2, transform: [{ rotate: '90deg' }] }
    : { width: W, height: H, left: 0, top: 0 };
  const corner = landscape ? { top: 12, left: insets.top + 4 } : { top: insets.top + 8, left: 12 };

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
        <Pressable style={styles.backdrop} onPress={resume}>
          <Pressable style={styles.card} onPress={() => {}}>
            {confirming ? (
              <>
                <Text style={styles.title}>Leave {gameName}?</Text>
                <Pressable style={[styles.row, styles.leave]} onPress={onLeave}>
                  <Ionicons name="exit-outline" size={20} color="#fff" /><Text style={styles.rowText}>Leave</Text>
                </Pressable>
                <Pressable style={styles.row} onPress={() => setConfirming(false)}>
                  <Ionicons name="arrow-back" size={20} color="#fff" /><Text style={styles.rowText}>Stay</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.title} numberOfLines={1}>{gameName}</Text>
                <Pressable style={[styles.row, styles.primary]} onPress={resume}>
                  <Ionicons name="play" size={20} color="#fff" /><Text style={styles.rowText}>Resume</Text>
                </Pressable>
                <Pressable style={styles.row} onPress={invite}>
                  <Ionicons name="person-add-outline" size={20} color="#fff" /><Text style={styles.rowText}>Invite friends</Text>
                </Pressable>
                <Pressable style={styles.row} onPress={() => setConfirming(true)}>
                  <Ionicons name="exit-outline" size={20} color="#fca5a5" /><Text style={[styles.rowText, { color: '#fca5a5' }]}>Leave game</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
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
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  card: { width: 300, borderRadius: 20, backgroundColor: '#17131f', padding: 16, gap: 10 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 50, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  primary: { backgroundColor: '#7c3aed' },
  leave: { backgroundColor: '#dc2626' },
  rowText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
