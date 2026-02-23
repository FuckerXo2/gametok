// Ad Service for GameTok - Google AdMob (Native Ads Only)
import Constants from 'expo-constants';

// Default ad frequency - will be overridden by remote config
let AD_FREQUENCY = 3;
export const getAdFrequency = () => AD_FREQUENCY;
export { AD_FREQUENCY };

// Detect environment
const executionEnvironment = Constants.executionEnvironment as string;
export const isExpoGo = Constants.appOwnership === 'expo' || executionEnvironment === 'expoGo';
export const shouldDisableAds = isExpoGo;

let isInitialized = false;

console.log('[Ads] Ad service initialized');

// ============================================
// REMOTE CONFIG
// ============================================

export const fetchRemoteConfig = async () => {
  try {
    const API_URL = 'https://gametok-backend-production.up.railway.app';
    const response = await fetch(`${API_URL}/api/config`);
    if (response.ok) {
      const config = await response.json();
      if (config?.adFrequency) {
        AD_FREQUENCY = config.adFrequency;
        console.log('[Ads] Remote config loaded, ad frequency:', AD_FREQUENCY);
      }
      return config;
    }
  } catch (error) {
    console.log('[Ads] Failed to fetch remote config, using defaults');
  }
  return null;
};

// ============================================
// MAIN INITIALIZATION
// ============================================

export const initializeAds = async () => {
  if (shouldDisableAds) {
    console.log('[Ads] Running in Expo Go, ads disabled');
    return false;
  }

  if (isInitialized) {
    console.log('[Ads] Already initialized');
    return true;
  }

  // Fetch remote config
  try {
    await Promise.race([
      fetchRemoteConfig(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
  } catch (e) {
    console.log('[Ads] Remote config fetch timed out');
  }

  // Google Mobile Ads initialization is handled by the NativeAdView component
  // No SDK-level init needed here — native ads load on demand

  isInitialized = true;
  console.log('[Ads] Init complete');
  return true;
};

export const isAdNetworkReady = (): boolean => {
  return isInitialized;
};

export const requestTrackingPermission = async (): Promise<boolean> => {
  return true;
};
