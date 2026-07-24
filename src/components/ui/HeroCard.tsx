import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, ImageSourcePropType, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing, type } from '../../theme';

interface HeroCardProps {
  eyebrow?: string;
  eyebrowIcon?: keyof typeof Ionicons.glyphMap;
  title: string;
  highlight?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaIcon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  image?: ImageSourcePropType | string | null;
  variant?: 'gradient' | 'image';
  style?: StyleProp<ViewStyle>;
}

export const HeroCard: React.FC<HeroCardProps> = ({
  eyebrow,
  eyebrowIcon,
  title,
  highlight,
  subtitle,
  ctaLabel = 'Create now',
  ctaIcon = 'sparkles',
  onPress,
  image,
  variant = 'gradient',
  style,
}) => {
  const imageSource: ImageSourcePropType | null =
    typeof image === 'string' ? { uri: image } : (image as ImageSourcePropType) || null;

  return (
    <Pressable onPress={onPress} style={[styles.shadowWrap, style]}>
      <View style={styles.card}>
        {variant === 'image' && imageSource ? (
          <Image source={imageSource} style={StyleSheet.absoluteFillObject} />
        ) : null}
        <LinearGradient
          colors={
            variant === 'image'
              ? ['rgba(5,5,8,0.0)', 'rgba(5,5,8,0.2)', 'rgba(5,5,8,0.85)']
              : ['rgba(168,85,247,0.18)', 'rgba(15,8,30,0.65)', 'rgba(0,0,0,0.95)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {variant === 'gradient' && imageSource ? (
          <Image source={imageSource} style={styles.heroImage} resizeMode="cover" />
        ) : null}
        <View style={styles.body}>
          {eyebrow ? (
            <View style={styles.eyebrow}>
              {eyebrowIcon ? (
                <Ionicons name={eyebrowIcon} size={12} color={colors.text} style={{ marginRight: 4 }} />
              ) : null}
              <Text style={styles.eyebrowText}>{eyebrow}</Text>
            </View>
          ) : null}
          <Text style={styles.title}>
            {title}
            {highlight ? <Text style={styles.highlight}>{highlight}</Text> : null}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {ctaLabel ? (
            <View style={styles.cta}>
              {ctaIcon ? <Ionicons name={ctaIcon} size={14} color={colors.text} style={{ marginRight: 6 }} /> : null}
              <Text style={styles.ctaLabel}>{ctaLabel}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  shadowWrap: {
    marginHorizontal: spacing.xl,
    borderRadius: radii.xl,
    ...shadows.glow,
  },
  card: {
    height: 220,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.bgCard,
  },
  body: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'flex-end',
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(168,85,247,0.55)',
    marginBottom: spacing.md,
  },
  eyebrowText: {
    color: colors.text,
    fontSize: type.size.caption,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  title: {
    color: colors.text,
    fontSize: type.size.h1,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: type.size.h1 + 4,
  },
  highlight: {
    color: colors.primary,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: type.size.body,
    marginTop: spacing.sm,
    fontWeight: '500',
    maxWidth: 320,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    marginTop: spacing.lg,
  },
  ctaLabel: {
    color: colors.text,
    fontSize: type.size.body,
    fontWeight: '700',
  },
  heroImage: {
    position: 'absolute',
    right: -32,
    bottom: -16,
    width: 240,
    height: 240,
    opacity: 0.85,
  },
});
