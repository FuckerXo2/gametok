// Native screen orientation. The app is portrait; a landscape game locks the phone to landscape (either way round, so it
// flips when the phone is turned over) while it's open, and the OS turns everything with it.
import type { ModalProps } from 'react-native';

let ScreenOrientation: typeof import('expo-screen-orientation') | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ScreenOrientation = require('expo-screen-orientation');
} catch (e) {
  // Gracefully fallback when the native binary does not have ExpoScreenOrientation compiled in
  ScreenOrientation = null;
}

/** For a Modal that can show over a landscape game (an iOS Modal is portrait-only unless told otherwise). */
export const ALL_ORIENTATIONS: ModalProps['supportedOrientations'] = ['portrait', 'landscape-left', 'landscape-right'];

/** Lock the phone. Resolves false when it can't (no native module, or the platform refused). */
async function lock(to: 'portrait' | 'landscape'): Promise<boolean> {
  if (!ScreenOrientation?.lockAsync) return false;
  try {
    await ScreenOrientation.lockAsync(to === 'landscape'
      ? ScreenOrientation.OrientationLock.LANDSCAPE
      : ScreenOrientation.OrientationLock.PORTRAIT_UP);
    return true;
  } catch (e) {
    return false;
  }
}

export const lockToPortrait = () => lock('portrait');
export const lockToLandscape = () => lock('landscape');
