import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';

// Single 3D default avatar
const DEFAULT_AVATAR = require('../../assets/ui/avatars/avatar_1.webp');

interface AvatarProps {
  uri?: string | null;
  userId?: string; // Kept for API compatibility but not used
  size?: number;
  style?: ViewStyle;
}

/**
 * Avatar component with a simple default fallback.
 */
export const Avatar: React.FC<AvatarProps> = ({ uri, size = 40, style }) => {
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };
  let imageSource: any = DEFAULT_AVATAR;
  if (uri && typeof uri === 'string') {
    imageSource = { uri };
  }

  return (
    <View style={[avatarStyle, styles.container, style]}>
      <Image
        source={imageSource}
        style={[avatarStyle, styles.image]}
        defaultSource={DEFAULT_AVATAR}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#e0e0e0',
  },
  image: {
    backgroundColor: 'transparent',
  },
});
