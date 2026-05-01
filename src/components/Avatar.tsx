import React, { useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { createAvatar } from '@dicebear/core';
import type { Options as CoreOptions } from '@dicebear/core';
import {
  create as adventurerCreate,
  meta as adventurerMeta,
  schema as adventurerSchema,
} from '@dicebear/adventurer';
import type { Options as AdventurerOptions } from '@dicebear/adventurer';

/** Client-side style bundle — avoids api.dicebear.com (HTTP 429 when many previews load at once). */
const ADVENTURER_STYLE = {
  create: adventurerCreate,
  meta: adventurerMeta,
  schema: adventurerSchema,
};

type LibOptions = Partial<AdventurerOptions & CoreOptions>;

/** Adventurer 9.x hair — must match schema (no bun*). */
const ADVENTURER_HAIR_VALID = new Set<string>([
  ...Array.from({ length: 26 }, (_, i) => `long${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 19 }, (_, i) => `short${String(i + 1).padStart(2, '0')}`),
]);

const LEGACY_HAIR_MAP: Record<string, string> = {
  bun01: 'short07',
  bun02: 'long08',
};

export const sanitizeAdventurerHair = (hair?: string | null): string => {
  const v = (hair || '').trim();
  if (!v) return 'short01';
  if (LEGACY_HAIR_MAP[v]) return LEGACY_HAIR_MAP[v];
  if (ADVENTURER_HAIR_VALID.has(v)) return v;
  return 'short01';
};

export const DICEBEAR_BACKGROUNDS = [
  '1b1b1f',
  '20262f',
  '2c1f38',
  '1e2e27',
  '312419',
  '4a2338',
  '13343b',
  '4d3428',
];

export const DICEBEAR_SKIN_TONES = ['f2d3b1', 'eac393', 'd08b5b', '9c5a3c', '6b3d2a'];
export const DICEBEAR_HAIR_COLORS = ['2c1b18', '5a3d2b', '8b5e3c', 'd19a66', 'f2d6b3', '8b1e3f', '4c6a92'];
export const DICEBEAR_EYE_OPTIONS = ['variant01', 'variant02', 'variant03', 'variant04', 'variant05', 'variant06', 'variant07', 'variant08'];
export const DICEBEAR_BROW_OPTIONS = ['variant01', 'variant02', 'variant03', 'variant04', 'variant05', 'variant06', 'variant07', 'variant08'];
export const DICEBEAR_MOUTH_OPTIONS = ['variant01', 'variant02', 'variant03', 'variant04', 'variant05', 'variant06', 'variant07', 'variant08'];
export const DICEBEAR_HAIR_OPTIONS = [
  'short01',
  'short02',
  'short03',
  'short04',
  'short05',
  'short06',
  'long01',
  'long02',
  'long03',
  'long04',
];
export const DICEBEAR_ACCESSORY_OPTIONS = ['blank', 'glasses', 'sunglasses'];

interface AvatarProps {
  uri?: string | null;
  userId?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export interface DicebearConfig {
  seed: string;
  bg: string;
  skinColor?: string;
  hairColor?: string;
  eyes?: string;
  eyebrows?: string;
  mouth?: string;
  hair?: string;
  accessory?: string;
}

const hashValue = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const normalizeSeed = (seed?: string | null) => (seed || 'gametok').trim() || 'gametok';

const pickBackground = (seed: string) => DICEBEAR_BACKGROUNDS[hashValue(seed) % DICEBEAR_BACKGROUNDS.length];

const pickOption = (seed: string, options: string[], salt: string) =>
  options[hashValue(`${seed}:${salt}`) % options.length];

const buildDefaultConfig = (seed?: string | null, uri?: string | null): DicebearConfig => {
  const normalizedSeed = normalizeSeed(seed || uri || 'gametok');
  return {
    seed: normalizedSeed,
    bg: pickBackground(normalizedSeed),
    skinColor: pickOption(normalizedSeed, DICEBEAR_SKIN_TONES, 'skin'),
    hairColor: pickOption(normalizedSeed, DICEBEAR_HAIR_COLORS, 'hairColor'),
    eyes: pickOption(normalizedSeed, DICEBEAR_EYE_OPTIONS, 'eyes'),
    eyebrows: pickOption(normalizedSeed, DICEBEAR_BROW_OPTIONS, 'eyebrows'),
    mouth: pickOption(normalizedSeed, DICEBEAR_MOUTH_OPTIONS, 'mouth'),
    hair: pickOption(normalizedSeed, DICEBEAR_HAIR_OPTIONS, 'hair'),
    accessory: pickOption(normalizedSeed, DICEBEAR_ACCESSORY_OPTIONS, 'accessory'),
  };
};

export const makeDicebearAvatarUri = (
  seedOrConfig?: string | DicebearConfig | null,
  bg?: string | null
) => {
  const config =
    typeof seedOrConfig === 'object' && seedOrConfig
      ? {
          ...buildDefaultConfig(seedOrConfig.seed),
          ...seedOrConfig,
          seed: normalizeSeed(seedOrConfig.seed),
          bg: (seedOrConfig.bg || '').trim() || pickBackground(normalizeSeed(seedOrConfig.seed)),
        }
      : {
          ...buildDefaultConfig(seedOrConfig),
          bg: (bg || '').trim() || pickBackground(normalizeSeed(seedOrConfig)),
        };
  const params = new URLSearchParams();
  params.set('bg', config.bg);
  if (config.skinColor) params.set('skinColor', config.skinColor);
  if (config.hairColor) params.set('hairColor', config.hairColor);
  if (config.eyes) params.set('eyes', config.eyes);
  if (config.eyebrows) params.set('eyebrows', config.eyebrows);
  if (config.mouth) params.set('mouth', config.mouth);
  if (config.hair) params.set('hair', sanitizeAdventurerHair(config.hair));
  if (config.accessory) params.set('accessory', config.accessory);
  return `dicebear://${encodeURIComponent(config.seed)}?${params.toString()}`;
};

export const getDicebearConfig = (uri?: string | null): DicebearConfig | null => {
  if (!uri || !uri.startsWith('dicebear://')) return null;
  const raw = uri.replace('dicebear://', '');
  const [encodedSeed, query = ''] = raw.split('?');
  const seed = decodeURIComponent(encodedSeed || 'gametok');
  const params = new URLSearchParams(query);
  const defaults = buildDefaultConfig(seed);
  return {
    seed: normalizeSeed(seed),
    bg: params.get('bg') || defaults.bg,
    skinColor: params.get('skinColor') || defaults.skinColor,
    hairColor: params.get('hairColor') || defaults.hairColor,
    eyes: params.get('eyes') || defaults.eyes,
    eyebrows: params.get('eyebrows') || defaults.eyebrows,
    mouth: params.get('mouth') || defaults.mouth,
    hair: sanitizeAdventurerHair(params.get('hair') || defaults.hair),
    accessory: params.get('accessory') || defaults.accessory,
  };
};

/** Maps stored config → @dicebear/adventurer options (single choice per feature = one-element arrays). */
export function buildAdventurerLibraryOptions(config: DicebearConfig, pixelSize: number): LibOptions {
  const hair = sanitizeAdventurerHair(config.hair);
  const accessory = config.accessory || 'blank';

  const opts: LibOptions = {
    seed: config.seed,
    size: Math.min(256, Math.max(32, pixelSize)),
    radius: 50,
    backgroundColor: [config.bg],
    hairProbability: 100,
    hair: [hair as NonNullable<AdventurerOptions['hair']>[number]],
  };

  if (config.skinColor) opts.skinColor = [config.skinColor];
  if (config.hairColor) opts.hairColor = [config.hairColor];
  if (config.eyes) opts.eyes = [config.eyes as NonNullable<AdventurerOptions['eyes']>[number]];
  if (config.eyebrows) opts.eyebrows = [config.eyebrows as NonNullable<AdventurerOptions['eyebrows']>[number]];
  if (config.mouth) opts.mouth = [config.mouth as NonNullable<AdventurerOptions['mouth']>[number]];

  if (accessory === 'glasses') {
    opts.glasses = ['variant01'];
    opts.glassesProbability = 100;
  } else if (accessory === 'sunglasses') {
    opts.glasses = ['variant02'];
    opts.glassesProbability = 100;
  } else {
    opts.glassesProbability = 0;
  }

  return opts;
}

/** Renders SVG locally — no network, no 429. */
export function dicebearConfigToSvgString(config: DicebearConfig, pixelSize: number): string {
  const opts = buildAdventurerLibraryOptions(config, pixelSize);
  return createAvatar(ADVENTURER_STYLE, opts).toString();
}

function resolveConfig(uri?: string | null, userId?: string | null): DicebearConfig {
  const custom = getDicebearConfig(uri);
  if (custom) return custom;
  return buildDefaultConfig(userId || uri || 'gametok', uri);
}

/** Pixel size passed to DiceBear `size` (sharpness); derived from on-screen size when provided. */
export const resolveAvatarSource = (
  uri?: string | null,
  userId?: string | null,
  displaySize?: number
): { uri: string } => {
  const config = resolveConfig(uri, userId);
  const apiSize =
    displaySize != null ? Math.min(256, Math.max(48, Math.ceil(displaySize * 2))) : 256;
  const svg = dicebearConfigToSvgString(config, apiSize);
  return { uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
};

export const Avatar: React.FC<AvatarProps> = ({ uri, userId, size = 40, style }) => {
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const svgXml = useMemo(() => {
    const config = resolveConfig(uri, userId);
    const pixelSize =
      size != null ? Math.min(256, Math.max(48, Math.ceil(size * 2))) : 256;
    return dicebearConfigToSvgString(config, pixelSize);
  }, [uri, userId, size]);

  return (
    <View style={[avatarStyle, styles.container, style]}>
      <SvgXml xml={svgXml} width={size} height={size} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1b1b1f',
    overflow: 'hidden',
  },
});
