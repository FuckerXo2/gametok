// GameMenu — the in-game menu, modelled on Roblox's: a small GameTok button in the corner stays
// out of the way while you play; tapping it pauses the game and opens a dim overlay with the game,
// Like / Share / Comments, and big Resume, Restart and Leave buttons. It replaces the old close
// (X) and replay buttons and the like/share rail that sat over the game.

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { likes as likesApi } from '../services/api';
import { CommentsModal } from './CommentsModal';
import { ShareSheet } from './ShareSheet';

const ICON = require('../../assets/icon.png');

const formatCount = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
      : String(n);

const tap = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} };

interface Props {
  gameId: string;
  gameName: string;
  thumbnail?: string | null;
  creatorName?: string | null;
  initialLikeCount?: number;
  /** Called with true when the menu opens and false when it closes, so the host can pause the game. */
  onOpenChange: (open: boolean) => void;
  onRestart: () => void;
  onLeave: () => void;
  onRemix?: () => void;
}

export const GameMenu = ({ gameId, gameName, thumbnail, creatorName, initialLikeCount = 0, onOpenChange, onRestart, onLeave, onRemix }: Props) => {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Whether this game is already liked, so the heart isn't wrong when the menu opens
  useEffect(() => {
    let mounted = true;
    setLiked(false);
    setLikeCount(initialLikeCount);
    likesApi.check([gameId])
      .then((res: any) => { if (mounted) setLiked(Array.isArray(res?.likedGameIds) && res.likedGameIds.includes(gameId)); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [gameId, initialLikeCount]);

  const setMenu = (next: boolean) => { tap(); setOpen(next); onOpenChange(next); };

  const toggleLike = async () => {
    tap();
    const was = liked;
    setLiked(!was); setLikeCount((n) => Math.max(0, n + (was ? -1 : 1)));
    try {
      const r: any = await likesApi.toggle(gameId);
      if (typeof r?.likeCount === 'number') setLikeCount(r.likeCount);
      if (typeof r?.liked === 'boolean') setLiked(r.liked);
    } catch {
      setLiked(was); setLikeCount((n) => Math.max(0, n + (was ? 1 : -1)));
    }
  };

  const top = Math.max(insets.top, 10);
  const left = Math.max(insets.left, 12);

  return (
    <>
      {!open ? (
        <Pressable style={[styles.menuButton, { top, left }]} onPress={() => setMenu(true)} hitSlop={12}>
          <Image source={ICON} style={styles.menuIcon} />
        </Pressable>
      ) : (
        <View style={styles.overlay}>
          <ScrollView
            contentContainerStyle={[styles.sheet, { paddingTop: top + 8, paddingBottom: Math.max(insets.bottom, 16) + 8, paddingLeft: left + 8, paddingRight: Math.max(insets.right, 12) + 8 }]}
            bounces={false}
          >
            <View style={styles.header}>
              <Pressable style={styles.closeBtn} onPress={() => setMenu(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
              <Text style={styles.headerTitle}>Game Menu</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.gameRow}>
              {thumbnail ? <Image source={{ uri: thumbnail }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbEmpty]} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.gameName} numberOfLines={2}>{gameName}</Text>
                {creatorName ? <Text style={styles.creator} numberOfLines={1}>by {creatorName}</Text> : null}
              </View>
            </View>

            <View style={styles.socialRow}>
              <Pressable style={styles.socialBtn} onPress={toggleLike}>
                <Ionicons name={liked ? 'heart' : 'heart-outline'} size={24} color={liked ? '#ff3b6b' : '#fff'} />
                <Text style={styles.socialText}>{formatCount(likeCount)}</Text>
              </Pressable>
              <Pressable style={styles.socialBtn} onPress={() => { tap(); setShowComments(true); }}>
                <Ionicons name="chatbubble-outline" size={22} color="#fff" />
                <Text style={styles.socialText}>Comments</Text>
              </Pressable>
              <Pressable style={styles.socialBtn} onPress={() => { tap(); setShowShare(true); }}>
                <Ionicons name="arrow-redo-outline" size={22} color="#fff" />
                <Text style={styles.socialText}>Share</Text>
              </Pressable>
              {onRemix ? (
                <Pressable style={styles.socialBtn} onPress={() => { tap(); onRemix(); }}>
                  <Ionicons name="sparkles-outline" size={22} color="#fff" />
                  <Text style={styles.socialText}>Remix</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.actions}>
              <Pressable style={[styles.action, styles.leave]} onPress={() => { tap(); onLeave(); }}>
                <Ionicons name="exit-outline" size={20} color="#fff" />
                <Text style={styles.actionText}>Leave</Text>
              </Pressable>
              <Pressable style={[styles.action, styles.restart]} onPress={() => { setMenu(false); onRestart(); }}>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.actionText}>Restart</Text>
              </Pressable>
              <Pressable style={[styles.action, styles.resume]} onPress={() => setMenu(false)}>
                <Ionicons name="play" size={20} color="#000" />
                <Text style={[styles.actionText, { color: '#000' }]}>Resume</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      )}

      <CommentsModal visible={showComments} onClose={() => setShowComments(false)} gameId={gameId} gameName={gameName} />
      <ShareSheet visible={showShare} onClose={() => setShowShare(false)} gameId={gameId} gameName={gameName} />
    </>
  );
};

const styles = StyleSheet.create({
  menuButton: {
    position: 'absolute',
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.85,
  },
  menuIcon: { width: 40, height: 40 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 200,
    backgroundColor: 'rgba(8,8,12,0.95)',
  },
  sheet: { flexGrow: 1, justifyContent: 'center', maxWidth: 560, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  thumb: { width: 72, height: 72, borderRadius: 14, backgroundColor: '#222' },
  thumbEmpty: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  gameName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  creator: { color: '#a1a1aa', fontSize: 14, marginTop: 4 },
  socialRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  socialBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)' },
  socialText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14 },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  leave: { backgroundColor: 'rgba(255,255,255,0.12)' },
  restart: { backgroundColor: 'rgba(255,255,255,0.12)' },
  resume: { backgroundColor: '#fff' },
});
