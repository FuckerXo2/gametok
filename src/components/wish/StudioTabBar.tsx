// StudioTabBar — history · Wish · Preview · settings.
// Preview pulses a dot when the game becomes ready while the user is on Wish.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, radii, spacing, type as t } from '../../theme/tokens';
import type { StudioTab } from './wishTypes';

interface Props {
  active: StudioTab;
  onSelect: (tab: StudioTab) => void;
  onHistory: () => void;
  onSettings: () => void;
  previewHasNews: boolean;
}

const TabPill = ({
  label,
  active,
  onPress,
  showDot,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  showDot?: boolean;
}) => (
  <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
    <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    {showDot && <View style={styles.dot} />}
  </Pressable>
);

export const StudioTabBar = ({ active, onSelect, onHistory, onSettings, previewHasNews }: Props) => (
  <View style={styles.bar}>
    <Pressable onPress={onHistory} style={styles.iconBtn}>
      <Ionicons name="time-outline" size={22} color={palette.textMuted} />
    </Pressable>

    <View style={styles.pills}>
      <TabPill label="Forge" active={active === 'wish'} onPress={() => onSelect('wish')} />
      <TabPill
        label="Preview"
        active={active === 'preview'}
        onPress={() => onSelect('preview')}
        showDot={previewHasNews && active !== 'preview'}
      />
    </View>

    <Pressable onPress={onSettings} style={styles.iconBtn}>
      <Ionicons name="settings-outline" size={22} color={palette.textMuted} />
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    // Give the bar a surface so it reads as a control strip, not icons on black.
    backgroundColor: palette.black,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.glassWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pills: {
    flexDirection: 'row',
    gap: spacing.xs,
    // Segmented track so Forge/Preview read as one toggle.
    backgroundColor: palette.glassWhite,
    borderRadius: radii.pill,
    padding: 4,
  },
  pill: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
  },
  pillActive: { backgroundColor: palette.text },
  pillText: {
    color: palette.textMuted,
    fontSize: t.size.body,
    fontFamily: t.family.semibold,
  },
  pillTextActive: { color: palette.black },
  dot: {
    position: 'absolute',
    top: 6,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.purple,
  },
});
