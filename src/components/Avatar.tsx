import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomImage as Image } from './CustomImage';

// A player's picture: the headshot of their 3D avatar (made by the avatar stage when they save their look,
// stored on the account), or a plain silhouette until they have one.
interface AvatarProps {
  uri?: string | null;
  userId?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export const hasHeadshot = (uri?: string | null) => !!uri && /^https:\/\//i.test(uri);

export const Avatar: React.FC<AvatarProps> = ({ uri, size = 40, style }) => {
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[shape, styles.container, style]}>
      {hasHeadshot(uri) ? (
        <Image source={{ uri: uri! }} style={shape} resizeMode="cover" />
      ) : (
        <Ionicons name="person" size={size * 0.56} color="rgba(255,255,255,0.45)" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2a2440',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
