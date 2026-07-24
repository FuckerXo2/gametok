// BriefCard — Kimi's pitch, spoken into the conversation.
//
// No card chrome, no widget box. The pitch reads as Kimi talking: bold title,
// flowing description with the structural phrase emphasized, open bullets.
// One compact Create pill closes it. (Matches the reference chat aesthetic.)

import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { palette, radii, spacing, type as t, shadows } from '../../theme/tokens';
import type { GameBrief } from './wishTypes';

interface Props {
  brief: GameBrief;
  onCreate: () => void;
  creating?: boolean;
  showTeachLine?: boolean;
}

/** Bold the structural phrase inside the pitch, wherever it appears. */
const Pitch = ({ pitch, structural }: { pitch: string; structural: string }) => {
  const idx = structural ? pitch.toLowerCase().indexOf(structural.toLowerCase()) : -1;
  if (idx < 0) return <Text style={styles.pitch}>{pitch}</Text>;
  return (
    <Text style={styles.pitch}>
      {pitch.slice(0, idx)}
      <Text style={styles.pitchStructural}>{pitch.slice(idx, idx + structural.length)}</Text>
      {pitch.slice(idx + structural.length)}
    </Text>
  );
};

export const BriefCard = ({ brief, onCreate, creating, showTeachLine }: Props) => (
  <View style={styles.wrap}>
    <Text style={styles.name}>{brief.name}</Text>
    <Pitch pitch={brief.pitch} structural={brief.structural} />

    {[...brief.spine, ...brief.flavor].map((line) => (
      <View key={line} style={styles.row}>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.rowText}>{line}</Text>
      </View>
    ))}

    <View style={styles.actions}>
      <Pressable
        onPress={onCreate}
        disabled={creating}
        style={({ pressed }) => [styles.createBtn, pressed && styles.createBtnPressed, creating && styles.createBtnBusy]}
      >
        {creating ? (
          <ActivityIndicator color={palette.text} size="small" />
        ) : (
          <Text style={styles.createText}>Create it</Text>
        )}
      </Pressable>
      {showTeachLine && !creating && (
        <Text style={styles.teachLine}>or just say what to change</Text>
      )}
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg },
  name: {
    color: palette.text,
    fontSize: t.size.h2,
    fontFamily: t.family.bold,
    letterSpacing: t.letter.snug,
    marginBottom: spacing.md,
  },
  pitch: {
    color: palette.text,
    fontSize: t.size.bodyLg,
    fontFamily: t.family.regular,
    lineHeight: 27,
    marginBottom: spacing.lg,
  },
  pitchStructural: { fontFamily: t.family.semibold },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingRight: spacing.lg,
  },
  bullet: {
    color: palette.textMuted,
    fontSize: t.size.bodyLg,
    lineHeight: 25,
  },
  rowText: {
    flex: 1,
    color: palette.textMuted,
    fontSize: t.size.bodyLg,
    fontFamily: t.family.regular,
    lineHeight: 25,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  createBtn: {
    backgroundColor: palette.purple,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.md + 2,
    ...shadows.liftSm,
  },
  createBtnPressed: { backgroundColor: palette.purpleDeep },
  createBtnBusy: { opacity: 0.7 },
  createText: {
    color: palette.text,
    fontSize: t.size.body,
    fontFamily: t.family.bold,
    letterSpacing: t.letter.wide,
  },
  teachLine: {
    flex: 1,
    color: palette.textGhost,
    fontSize: t.size.caption,
    fontFamily: t.family.regular,
  },
});
