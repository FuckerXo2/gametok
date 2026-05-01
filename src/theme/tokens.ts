// Design tokens for GameTok V2.
// One source of truth for colors, spacing, type, radii, shadows.
// Screens should NOT hard-code hex values; import from here.

export const palette = {
  // surfaces
  black: '#000000',
  ink900: '#0a0a0f',
  ink800: '#101018',
  ink700: '#171723',
  ink600: '#1f1f2e',
  ink500: '#2a2a3c',
  line: 'rgba(255,255,255,0.08)',
  lineStrong: 'rgba(255,255,255,0.16)',

  // brand
  purple: '#a855f7',
  purpleSoft: '#c084fc',
  purpleDeep: '#7c3aed',
  purpleGlow: 'rgba(168,85,247,0.28)',

  // text
  text: '#ffffff',
  textMuted: '#c8c8d6',
  textDim: '#8a8a99',
  textGhost: '#5e5e6e',

  // semantic
  live: '#ef4444',
  online: '#22c55e',
  inGame: '#a855f7',
  warning: '#f59e0b',
  success: '#22c55e',
  danger: '#ef4444',
  verified: '#a855f7',

  // overlays
  scrim: 'rgba(0,0,0,0.55)',
  scrimSoft: 'rgba(0,0,0,0.32)',
  glassWhite: 'rgba(255,255,255,0.06)',
  glassWhiteStrong: 'rgba(255,255,255,0.14)',
} as const;

export const colors = {
  bg: palette.black,
  bgElevated: palette.ink800,
  bgCard: palette.ink700,
  bgChip: palette.glassWhite,
  bgChipActive: palette.purple,

  text: palette.text,
  textMuted: palette.textMuted,
  textDim: palette.textDim,
  textOnPrimary: palette.text,

  border: palette.line,
  borderStrong: palette.lineStrong,

  primary: palette.purple,
  primaryDeep: palette.purpleDeep,
  primaryGlow: palette.purpleGlow,

  live: palette.live,
  online: palette.online,
  inGame: palette.inGame,
  verified: palette.verified,
  success: palette.success,
  danger: palette.danger,

  scrim: palette.scrim,
} as const;

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

export const radii = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 22,
  xxl: 28,
  pill: 999,
} as const;

export const type = {
  family: {
    // Inter, registered via expo-font in app bootstrap. Falls back gracefully.
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    black: 'Inter_800ExtraBold',
  },
  size: {
    micro: 11,
    caption: 12,
    small: 13,
    body: 15,
    bodyLg: 17,
    h3: 20,
    h2: 24,
    h1: 30,
    display: 38,
    hero: 56,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    black: '800',
  } as const,
  letter: {
    tight: -1.2,
    snug: -0.6,
    normal: 0,
    wide: 0.4,
  },
} as const;

export const shadows = {
  none: { shadowColor: 'transparent', shadowOpacity: 0 },
  glow: {
    shadowColor: palette.purple,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  liftSm: {
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
} as const;

export const motion = {
  press: { duration: 110 },
  spring: { damping: 14, stiffness: 220 },
  fade: { duration: 220 },
} as const;

export const layout = {
  screenPadding: spacing.xl,
  rowGap: spacing.lg,
  sectionGap: spacing.xxl,
  bottomNavHeight: 64,
  tabBarFloatingButton: 56,
} as const;

export type Spacing = keyof typeof spacing;
export type Radius = keyof typeof radii;
export type FontFamily = keyof typeof type.family;
export type FontSize = keyof typeof type.size;
