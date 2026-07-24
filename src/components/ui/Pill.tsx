import React from 'react';
import { Pressable, Text, View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, radii, spacing, type } from '../../theme';

interface PillProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md';
  leadingDot?: 'live' | 'online' | 'inGame' | null;
  style?: StyleProp<ViewStyle>;
}

const dotColor = {
  live: colors.live,
  online: colors.online,
  inGame: colors.inGame,
} as const;

export const Pill: React.FC<PillProps> = ({
  label,
  active = false,
  onPress,
  size = 'md',
  leadingDot = null,
  style,
}) => {
  const isInteractive = Boolean(onPress);
  const Wrapper: any = isInteractive ? Pressable : View;
  const padV = size === 'sm' ? spacing.xs : spacing.sm;
  const padH = size === 'sm' ? spacing.md : spacing.lg;

  return (
    <Wrapper
      onPress={onPress}
      style={[
        styles.base,
        {
          backgroundColor: active ? colors.primary : 'rgba(255,255,255,0.06)',
          borderColor: active ? colors.primary : colors.border,
          paddingVertical: padV,
          paddingHorizontal: padH,
        },
        style,
      ]}
    >
      {leadingDot && (
        <View style={[styles.dot, { backgroundColor: dotColor[leadingDot] }]} />
      )}
      <Text
        style={[
          styles.label,
          {
            color: active ? colors.textOnPrimary : colors.textMuted,
            fontSize: size === 'sm' ? type.size.small : type.size.body,
            fontWeight: active ? '700' : '600',
          },
        ]}
      >
        {label}
      </Text>
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    letterSpacing: -0.2,
  },
});
