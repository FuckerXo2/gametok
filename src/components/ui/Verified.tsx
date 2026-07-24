import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme';

interface VerifiedProps {
  size?: number;
}

// Compact verification check used next to display names.
// Single circle, white check glyph. Color matches brand purple.
export const Verified: React.FC<VerifiedProps> = ({ size = 16 }) => {
  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={[styles.check, { fontSize: Math.max(8, size * 0.62) }]}>✓</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  dot: {
    backgroundColor: colors.verified,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    color: '#ffffff',
    fontWeight: '900',
    marginTop: -1,
  },
});
