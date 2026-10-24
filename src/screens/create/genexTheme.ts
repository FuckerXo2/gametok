// Genex Design System Tokens for GameTok Mobile
// Matches genex-desktop-dev/src/renderer/theme.css and design/genex/README.md

export const genexColors = {
  background: '#0e0d0f',
  sidebar: '#0b0b0d',
  card: '#141416',
  popover: '#19191b',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  
  // Genex signature indigo accent
  accent: '#3c44c4',
  accentFill: '#3c44c4',
  accentTint: 'rgba(60, 68, 196, 0.18)',
  accentHover: '#4a57d9',
  
  // Foreground / text
  foreground: '#dee0e2',
  mutedForeground: '#a8a9ac',
  dimForeground: '#6e6f73',
  ghostForeground: '#45464a',
  
  // Semantic status
  success: '#22c55e',
  warning: '#f59e0b',
  destructive: '#f08287',
  
  // Controls
  controlQuiet: '#1b1c1d',
  controlQuietEdge: '#29292b',
  composer: '#141416',
  composerPanel: '#19191b',
} as const;

export const genexRadii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  card: 16,
  button: 11,
  pill: 999,
} as const;

export const genexSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;
