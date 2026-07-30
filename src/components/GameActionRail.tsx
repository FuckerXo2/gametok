// GameActionRail — the like / comment / share / remix rail that sits down the right edge of a game.
//
// This used to exist only inside HomeScreen, which is why a game opened from explore, a profile, or
// another user's profile came up with nothing but a close button. The three animated buttons are
// shared with HomeScreen (it imports them from here and keeps its own feed-scroll animation and
// styles), while `GameActionRail` is the self-contained version for GamePlayerModal: it owns its own
// like state, comments sheet and share sheet, so a host only has to render it.
//
// Remix is opt-in via `onRemix`. Remixing needs the host to be able to route into the create tab
// with a fresh draft, and not every host can, so the button is only drawn when a handler is given —
// better a missing button than a dead one.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LoopsColors } from '../constants/LoopsColors';
import { likes as likesApi } from '../services/api';
import { CommentsModal } from './CommentsModal';
import { ShareSheet } from './ShareSheet';

const formatCount = (count: number): string => {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
};

/** The tap bounce every rail button shares. */
const useBounce = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const bounce = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.7, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1.2, friction: 3, tension: 40, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }),
    ]).start();
  };
  return { scale, bounce };
};

export const AnimatedLikeButton = ({
  isLiked,
  onPress,
  likeCount,
  styles,
}: {
  isLiked: boolean;
  onPress: (e: any) => void;
  likeCount: number;
  styles: any;
}) => {
  const { scale, bounce } = useBounce();

  const handlePress = (e: any) => {
    bounce();
    onPress(e);
  };

  return (
    <TouchableOpacity style={styles.actionButton} onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name="heart" size={35} color={isLiked ? LoopsColors.mainPink : LoopsColors.white} />
      </Animated.View>
      <Text style={styles.actionCount}>{formatCount(likeCount)}</Text>
    </TouchableOpacity>
  );
};

export const AnimatedShareButton = ({
  onPress,
  shareCount,
  styles,
}: {
  onPress: (e: any) => void;
  shareCount: number;
  styles: any;
}) => {
  const { scale, bounce } = useBounce();

  const handlePress = (e: any) => {
    onPress(e);
    bounce();
  };

  return (
    <TouchableOpacity style={styles.actionButton} onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name="arrow-redo" size={32} color={LoopsColors.white} />
      </Animated.View>
      <Text style={styles.actionCount}>{formatCount(shareCount)}</Text>
    </TouchableOpacity>
  );
};

export const AnimatedCommentButton = ({
  onPress,
  commentCount,
  styles,
}: {
  onPress: (e: any) => void;
  commentCount: number;
  styles: any;
}) => {
  const { scale, bounce } = useBounce();

  const handlePress = (e: any) => {
    onPress(e);
    bounce();
  };

  return (
    <TouchableOpacity style={styles.actionButton} onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name="chatbubble-outline" size={32} color={LoopsColors.white} />
      </Animated.View>
      <Text style={styles.actionCount}>{formatCount(commentCount)}</Text>
    </TouchableOpacity>
  );
};

interface GameActionRailProps {
  gameId: string;
  gameName: string;
  /** Seeds the heart count before the server answers. */
  initialLikeCount?: number;
  /** Shown next to the share glyph; the app has no real share counter yet. */
  shareCount?: number;
  /** Provide to draw the Remix button. Omit and it isn't rendered. */
  onRemix?: () => void;
  /** Extra offset from the bottom, for hosts with their own bottom chrome. */
  bottomOffset?: number;
}

export const GameActionRail = ({
  gameId,
  gameName,
  initialLikeCount = 0,
  shareCount = 0,
  onRemix,
  bottomOffset = 24,
}: GameActionRailProps) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Ask the server whether this game is already liked, so the heart isn't wrong on open.
  useEffect(() => {
    let mounted = true;
    setLiked(false);
    setLikeCount(initialLikeCount);
    if (!gameId) return;
    (async () => {
      try {
        const res: any = await likesApi.check([gameId]);
        if (!mounted) return;
        // POST /api/likes/check answers { likedGameIds: string[] } — [] when signed out.
        setLiked(Array.isArray(res?.likedGameIds) && res.likedGameIds.includes(gameId));
      } catch {
        // Non-fatal — the heart just starts empty and still toggles.
      }
    })();
    return () => {
      mounted = false;
    };
  }, [gameId, initialLikeCount]);

  const handleLike = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((n) => n + (wasLiked ? -1 : 1));

    try {
      const result: any = await likesApi.toggle(gameId);
      if (typeof result?.likeCount === 'number') setLikeCount(result.likeCount);
      if (typeof result?.liked === 'boolean') setLiked(result.liked);
    } catch {
      // Revert so the rail never shows a like the server rejected.
      setLiked(wasLiked);
      setLikeCount((n) => n + (wasLiked ? 1 : -1));
    }
  };

  const openSheet = (setter: (v: boolean) => void) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setter(true);
  };

  return (
    <>
      <View style={[styles.actionButtons, { bottom: bottomOffset }]}>
        <AnimatedLikeButton isLiked={liked} likeCount={likeCount} onPress={handleLike} styles={styles} />
        <AnimatedCommentButton onPress={() => openSheet(setShowComments)} commentCount={0} styles={styles} />
        <AnimatedShareButton onPress={() => openSheet(setShowShare)} shareCount={shareCount} styles={styles} />
        {onRemix ? (
          <TouchableOpacity
            style={styles.actionButton}
            activeOpacity={0.9}
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              onRemix();
            }}
          >
            <Ionicons name="git-branch" size={30} color={LoopsColors.white} />
            <Text style={styles.actionCount}>Remix</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <CommentsModal
        visible={showComments}
        onClose={() => setShowComments(false)}
        gameId={gameId}
        gameName={gameName}
      />

      <ShareSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        gameId={gameId}
        gameName={gameName}
      />
    </>
  );
};

const styles = StyleSheet.create({
  actionButtons: {
    position: 'absolute',
    right: 8,
    alignItems: 'center',
    zIndex: 10,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 18,
  },
  actionCount: {
    color: LoopsColors.white,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
