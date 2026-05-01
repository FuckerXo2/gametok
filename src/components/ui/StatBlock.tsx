import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, type } from '../../theme';

interface StatBlockProps {
  value: number | string;
  label: string;
  onPress?: () => void;
  align?: 'left' | 'center';
}

const formatValue = (v: number | string): string => {
  if (typeof v === 'string') return v;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return String(v);
};

export const StatBlock: React.FC<StatBlockProps> = ({ value, label, onPress, align = 'center' }) => {
  const Wrapper: any = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={[styles.col, { alignItems: align === 'center' ? 'center' : 'flex-start' }]}>
      <Text style={styles.value}>{formatValue(value)}</Text>
      <Text style={styles.label}>{label}</Text>
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  col: {
    paddingHorizontal: spacing.sm,
    minWidth: 64,
  },
  value: {
    color: colors.text,
    fontSize: type.size.h3,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  label: {
    color: colors.textDim,
    fontSize: type.size.small,
    marginTop: 2,
    fontWeight: '500',
  },
});
