import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';

const TOKBUX_IMAGE = require('../../assets/ui/tokbux/tokbux_token.png');

interface TokBuxIconProps {
  size?: number;
  style?: ViewStyle;
}

export const TokBuxIcon: React.FC<TokBuxIconProps> = ({ size = 18, style }) => {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }, style]}>
      <Image
        source={TOKBUX_IMAGE}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({});
