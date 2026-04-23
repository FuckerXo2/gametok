import React from 'react';
import { View, Image, StyleSheet, ViewStyle, ImageSourcePropType } from 'react-native';

// Single 3D default avatar
const DEFAULT_AVATAR = require('../../assets/ui/avatars/avatar_1.webp');
const CREATOR_AVATARS: Record<string, ImageSourcePropType> = {
  light_spiky: require('../../assets/ui/avatars/creator/light_spiky.png'),
  light_wavy: require('../../assets/ui/avatars/creator/light_wavy.png'),
  light_straight: require('../../assets/ui/avatars/creator/light_straight.png'),
  light_buzz: require('../../assets/ui/avatars/creator/light_buzz.png'),
  light_ponytail: require('../../assets/ui/avatars/creator/light_ponytail.png'),
  light_curly: require('../../assets/ui/avatars/creator/light_curly.png'),
  medium_curly: require('../../assets/ui/avatars/creator/medium_curly.png'),
  medium_braids: require('../../assets/ui/avatars/creator/medium_braids.png'),
  medium_bun: require('../../assets/ui/avatars/creator/medium_bun.png'),
  medium_short: require('../../assets/ui/avatars/creator/medium_short.png'),
  medium_wavy: require('../../assets/ui/avatars/creator/medium_wavy.png'),
  medium_fade: require('../../assets/ui/avatars/creator/medium_fade.png'),
  medDark_fade: require('../../assets/ui/avatars/creator/medDark_fade.png'),
  medDark_curly: require('../../assets/ui/avatars/creator/medDark_curly.png'),
  medDark_locs: require('../../assets/ui/avatars/creator/medDark_locs.png'),
  medDark_braids: require('../../assets/ui/avatars/creator/medDark_braids.png'),
  medDark_bob: require('../../assets/ui/avatars/creator/medDark_bob.png'),
  medDark_afro: require('../../assets/ui/avatars/creator/medDark_afro.png'),
  dark_afro: require('../../assets/ui/avatars/creator/dark_afro.png'),
};

export const AVATAR_BACKGROUNDS = ['#F5D558', '#78E0D6', '#F5A3B7', '#B995FF', '#8ED081', '#F4B36A', '#9BB7FF', '#FF8F70'];

export const makeAvatarCreatorUri = (id: string, bg = AVATAR_BACKGROUNDS[0]) => (
  `avatar-creator://${id}?bg=${encodeURIComponent(bg)}`
);

export const AVATAR_PRESETS = [
  { id: 'light_spiky', label: 'Spiky' },
  { id: 'light_wavy', label: 'Wavy' },
  { id: 'light_straight', label: 'Straight' },
  { id: 'light_curly', label: 'Curly' },
  { id: 'medium_bun', label: 'Bun' },
  { id: 'medium_short', label: 'Short' },
  { id: 'medium_wavy', label: 'Wave' },
  { id: 'medium_braids', label: 'Braids' },
  { id: 'medDark_fade', label: 'Fade' },
  { id: 'medDark_curly', label: 'Coils' },
  { id: 'medDark_locs', label: 'Locs' },
  { id: 'medDark_bob', label: 'Bob' },
  { id: 'medDark_afro', label: 'Afro' },
  { id: 'dark_afro', label: 'Cloud' },
].map((preset, index) => ({
  ...preset,
  uri: makeAvatarCreatorUri(preset.id, AVATAR_BACKGROUNDS[index % AVATAR_BACKGROUNDS.length]),
  source: CREATOR_AVATARS[preset.id],
}));

interface AvatarProps {
  uri?: string | null;
  userId?: string; // Kept for API compatibility but not used
  size?: number;
  style?: ViewStyle;
}

export const isSupportedAvatarUri = (uri?: string | null) => {
  if (!uri || typeof uri !== 'string') return false;
  const normalized = uri.trim().toLowerCase();
  return (
    normalized.startsWith('avatar-creator://') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('file://') ||
    normalized.startsWith('data:image/')
  );
};

const parseCreatorAvatar = (uri?: string | null) => {
  if (!uri || !uri.startsWith('avatar-creator://')) return null;
  const raw = uri.replace('avatar-creator://', '');
  const [id, query = ''] = raw.split('?');
  const bgMatch = query.match(/(?:^|&)bg=([^&]+)/);
  const bg = bgMatch ? decodeURIComponent(bgMatch[1]) : '#F5D558';
  const source = CREATOR_AVATARS[id] || null;
  return source ? { id, bg, source } : null;
};

export const getAvatarCreatorConfig = (uri?: string | null) => parseCreatorAvatar(uri);

export const resolveAvatarSource = (uri?: string | null) => {
  const creatorAvatar = parseCreatorAvatar(uri);
  if (creatorAvatar) return creatorAvatar.source;
  return isSupportedAvatarUri(uri) ? { uri: String(uri).trim() } : DEFAULT_AVATAR;
};

/**
 * Avatar component with a simple default fallback.
 */
export const Avatar: React.FC<AvatarProps> = ({ uri, size = 40, style }) => {
  const creatorAvatar = parseCreatorAvatar(uri);
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };
  const imageSource = creatorAvatar?.source || resolveAvatarSource(uri);

  return (
    <View style={[avatarStyle, styles.container, creatorAvatar && { backgroundColor: creatorAvatar.bg }, style]}>
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
