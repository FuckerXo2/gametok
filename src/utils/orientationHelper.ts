let ScreenOrientation: typeof import('expo-screen-orientation') | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ScreenOrientation = require('expo-screen-orientation');
} catch (e) {
  // Gracefully fallback when the native binary does not have ExpoScreenOrientation compiled in
  ScreenOrientation = null;
}

export async function lockToPortrait() {
  if (!ScreenOrientation?.lockAsync) return;
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch (e) {
    // Non-fatal if platform or device doesn't support orientation locking
  }
}

export async function lockToLandscape() {
  if (!ScreenOrientation?.lockAsync) return;
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  } catch (e) {
    // Non-fatal
  }
}

export async function unlockOrientation() {
  if (!ScreenOrientation?.unlockAsync) return;
  try {
    await ScreenOrientation.unlockAsync();
  } catch (e) {
    // Non-fatal
  }
}
