import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { getAvatarById } from './AvatarCreator';

// Single 3D default avatar
const DEFAULT_AVATAR = require('../../assets/ui/avatars/avatar_1.webp');

interface AvatarProps {
  uri?: string | null;
  userId?: string; // Kept for API compatibility but not used
  size?: number;
  style?: ViewStyle;
}

/**
 * Avatar component with 3D default avatar
 * Supports:
 * - Regular image URLs (Cloudinary uploads)
 * - avatar-creator:// URIs (created via AvatarCreatorModal)
 * - Falls back to default 3D avatar
 */
export const Avatar: React.FC<AvatarProps> = ({ uri, size = 40, style }) => {
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  // Check if this is a creator avatar
  if (uri && uri.startsWith('avatar-creator://')) {
    try {
      const avatarId = uri.replace('avatar-creator://', '').split('?')[0];
      const params = new URLSearchParams(uri.split('?')[1] || '');
      const bgColor = params.get('bg') ? decodeURIComponent(params.get('bg')!) : '#F5D558';
      const avatar = getAvatarById(avatarId);

      if (avatar) {
        return (
          <View style={[avatarStyle, styles.container, { backgroundColor: bgColor, overflow: 'hidden' }, style]}>
            <Image
              source={avatar.image}
              style={[avatarStyle, styles.image]}
            />
          </View>
        );
      }
    } catch (e) {
      // Fall through to default
    }
  }

  return (
    <View style={[avatarStyle, styles.container, style]}>
      <Image
        source={uri ? { uri } : DEFAULT_AVATAR}
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
