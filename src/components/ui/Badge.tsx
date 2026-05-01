import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, type } from '../../theme';

type BadgeTone = 'purple' | 'pink' | 'cyan' | 'amber' | 'lime';

interface BadgeProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
}

const tones: Record<BadgeTone, { bg: string; border: string; fg: string }> = {
  purple: { bg: 'rgba(168,85,247,0.14)', border: 'rgba(168,85,247,0.4)', fg: '#d8b4fe' },
  pink: { bg: 'rgba(236,72,153,0.14)', border: 'rgba(236,72,153,0.4)', fg: '#f9a8d4' },
  cyan: { bg: 'rgba(34,211,238,0.14)', border: 'rgba(34,211,238,0.4)', fg: '#67e8f9' },
  amber: { bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.4)', fg: '#fcd34d' },
  lime: { bg: 'rgba(132,204,22,0.14)', border: 'rgba(132,204,22,0.4)', fg: '#bef264' },
};

export const Badge: React.FC<BadgeProps> = ({ label, icon, tone = 'purple', style }) => {
  const t = tones[tone];
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: t.bg, borderColor: t.border },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={13} color={t.fg} style={{ marginRight: 4 }} />}
      <Text style={[styles.label, { color: t.fg }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: type.size.small,
    fontWeight: '600',
  },
});

export { tones as badgeTones };
