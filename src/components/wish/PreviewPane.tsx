// PreviewPane — the game's home. Three states:
//   empty    → invitation back to the Wish tab
//   building → the build theater: spinner + human-readable beats (no tech leak)
//   ready    → the playable game, full-bleed WebView
//
// Philosophy: the wait should feel like anticipation, not dread. The user never
// sees implementation vocabulary — they see their game coming alive.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  FlatList,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { GameSurface } from '../GameSurface';
import { palette, radii, spacing, type as t } from '../../theme/tokens';
import type { BuildBeat } from './wishTypes';
import { isLandscape, DEFAULT_ORIENTATION, type Orientation } from '../../constants/orientation';

interface Props {
  state: 'empty' | 'building' | 'ready';
  gameName: string | null;
  beats: BuildBeat[];
  html: string | null;
  gameUrl: string | null;
  /** Landscape games are rotated inside the pane, exactly as the feed does it. */
  orientation?: Orientation;
  containerStyle?: StyleProp<ViewStyle>;
  runtime?: 'web' | 'native';
  gameScript?: string | null;
}

const Building = ({ gameName, beats }: { gameName: string | null; beats: BuildBeat[] }) => {
  const pulse = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={palette.purple} />
      {gameName && (
        <Animated.Text style={[styles.buildingName, { opacity: pulse }]}>
          {gameName}
        </Animated.Text>
      )}
      <FlatList
        data={[...beats].slice(-5)}
        keyExtractor={(b) => b.id}
        style={styles.beatList}
        contentContainerStyle={styles.beatContent}
        renderItem={({ item, index }) => {
          const isLatest = index === Math.min(beats.length, 5) - 1;
          return (
            <Text style={[styles.beat, isLatest && styles.beatLatest]}>{item.text}</Text>
          );
        }}
      />
    </View>
  );
};

export const PreviewPane = ({
  state,
  gameName,
  beats,
  html,
  gameUrl,
  orientation = DEFAULT_ORIENTATION,
  containerStyle,
  runtime = 'web',
  gameScript = null,
}: Props) => {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  if (state === 'ready' && (html || gameUrl || gameScript)) {
    return (
      <View
        style={[styles.gameCard, containerStyle]}
        collapsable={false}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setBox((prev) =>
            prev && prev.width === width && prev.height === height ? prev : { width, height },
          );
        }}
      >
        {(() => {
          const cardIsLandscape = isLandscape(orientation) || (html ? /@orientation:\s*landscape|GTA\s*LAGOS|Sunbreak|Downhill|Descent/i.test(html) : false) || Boolean(gameUrl && /gta|lagos|kart|racing|drift|sunbreak|descent/i.test(gameUrl));
          return (!cardIsLandscape || box) && (
            <GameSurface
              orientation={cardIsLandscape ? 'landscape' : orientation}
              box={box}
              source={html ? { html } : { uri: gameUrl as string }}
              style={styles.webview}
              runtime={runtime}
              gameScript={gameScript ?? undefined}
              scrollEnabled={false}
              bounces={false}
              overScrollMode="never"
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
            />
          );
        })()}
      </View>
    );
  }

  if (state === 'building') {
    return <Building gameName={gameName} beats={beats} />;
  }

  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>Nothing here yet</Text>
      <Text style={styles.emptyBody}>Make a wish first — your game shows up here.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    gap: spacing.lg,
  },
  buildingName: {
    color: palette.text,
    fontSize: t.size.h3,
    fontFamily: t.family.bold,
    letterSpacing: t.letter.snug,
  },
  beatList: { maxHeight: 150, alignSelf: 'stretch', flexGrow: 0 },
  beatContent: { alignItems: 'center', gap: spacing.sm },
  beat: {
    color: palette.textGhost,
    fontSize: t.size.small,
    fontFamily: t.family.regular,
  },
  beatLatest: {
    color: palette.textMuted,
    fontFamily: t.family.medium,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: t.size.h3,
    fontFamily: t.family.semibold,
  },
  emptyBody: {
    color: palette.textDim,
    fontSize: t.size.body,
    fontFamily: t.family.regular,
    textAlign: 'center',
  },
  gameCard: {
    flex: 1,
    margin: spacing.md,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: palette.ink900,
    borderWidth: 1,
    borderColor: palette.line,
  },
  webview: { flex: 1, backgroundColor: palette.ink900 },
});
