// Play orientation — the creator's compulsory choice in the Forge, and the one fact that decides
// how a game is both generated and displayed.
//
// The app is portrait-locked at the OS level and stays that way. A landscape game is played by
// rotating the WebView's *content* 90° inside the portrait feed card, so the player turns the phone
// while the OS never does. The game itself is simply laid out at a landscape size from its first
// frame and needs no rotation handling of its own.
//
// Mirrors gametok-backend/src/ai-engine/orientation.js — keep the two in step.

export type Orientation = 'portrait' | 'landscape';

export const DEFAULT_ORIENTATION: Orientation = 'portrait';

export function normalizeOrientation(value: unknown): Orientation {
  return String(value || '').trim().toLowerCase() === 'landscape' ? 'landscape' : DEFAULT_ORIENTATION;
}

export function isLandscape(value: unknown): boolean {
  return normalizeOrientation(value) === 'landscape';
}

/** Copy for the Forge picker. `glyph` is an Ionicons name. */
export const ORIENTATION_OPTIONS: Array<{
  key: Orientation;
  label: string;
  sub: string;
  glyph: 'phone-portrait-outline' | 'phone-landscape-outline';
}> = [
  {
    key: 'portrait',
    label: 'Portrait',
    sub: 'Tall screen',
    glyph: 'phone-portrait-outline',
  },
  {
    key: 'landscape',
    label: 'Landscape',
    sub: 'Wide screen',
    glyph: 'phone-landscape-outline',
  },
];
