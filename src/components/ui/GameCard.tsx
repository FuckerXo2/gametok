import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, ImageSourcePropType, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing, type } from '../../theme';

type GameCardSize = 'large' | 'medium' | 'small';

interface GameCardProps {
  title: string;
  cover?: string | ImageSourcePropType | null;
  size?: GameCardSize;
  plays?: number | null;
  liveBadge?: boolean;
  friendsPlaying?: number | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const dims: Record<GameCardSize, { width: number; height: number; titleSize: number }> = {
  large: { width: 220, height: 280, titleSize: 17 },
  medium: { width: 150, height: 200, titleSize: 14 },
  small: { width: 110, height: 150, titleSize: 13 },
};

const formatPlays = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
};

export const GameCard: React.FC<GameCardProps> = ({
  title,
  cover,
  size = 'medium',
  plays = null,
  liveBadge = false,
  friendsPlaying = null,
  onPress,
  style,
}) => {
  const d = dims[size];
  const source: ImageSourcePropType | null =
    typeof cover === 'string' ? { uri: cover } : ((cover as ImageSourcePropType) ?? null);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.shadow,
        { width: d.width },
        style,
      ]}
    >
      <View style={[styles.card, { width: d.width, height: d.height }]}>
        {source ? (
          <Image source={source} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: colors.bgCard },
            ]}
          />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.0)', 'rgba(0,0,0,0.85)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        {liveBadge ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        ) : null}
        <View style={styles.body}>
          <Text style={[styles.title, { fontSize: d.titleSize }]} numberOfLines={2}>
            {title}
          </Text>
          {(plays != null || friendsPlaying != null) && (
            <View style={styles.metaRow}>
              {plays != null && (
                <View style={styles.meta}>
                  <Ionicons name="play" size={11} color={colors.textMuted} />
                  <Text style={styles.metaText}>{formatPlays(plays)}</Text>
                </View>
              )}
              {friendsPlaying != null && (
                <View style={styles.meta}>
                  <Ionicons name="people" size={11} color={colors.textMuted} />
                  <Text style={styles.metaText}>{friendsPlaying} friends</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  shadow: {
    ...shadows.liftSm,
  },
  card: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgCard,
  },
  body: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'flex-end',
  },
  title: {
    color: colors.text,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: type.size.caption,
    fontWeight: '600',
  },
  liveBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.live,
  },
  liveText: {
    color: colors.text,
    fontSize: type.size.micro,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
