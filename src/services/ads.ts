// Ad Service for GameTok - LevelPlay (ironSource) Only
import Constants from 'expo-constants';
import { 
  initializeLevelPlay, 
  showInterstitial as showLevelPlayInterstitial,
  showRewarded as showLevelPlayRewarded,
  isInterstitialReady,
  isRewardedReady,
} from './levelplay';

// Default ad frequency - will be overridden by remote config
let AD_FREQUENCY = 3;
export const getAdFrequency = () => AD_FREQUENCY;
export { AD_FREQUENCY };

// Detect environment
const executionEnvironment = Constants.executionEnvironment as string;
export const isExpoGo = Constants.appOwnership === 'expo' || executionEnvironment === 'expoGo';
export const shouldDisableAds = isExpoGo;

let isInitialized = false;
let levelPlayInitialized = false;

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

  // Initialize LevelPlay for all ad types (native, interstitial, rewarded)
  try {
    console.log('[Ads] Initializing LevelPlay...');
    levelPlayInitialized = await initializeLevelPlay();
    console.log('[Ads] LevelPlay initialized:', levelPlayInitialized);
  } catch (error) {
    console.error('[Ads] LevelPlay initialization failed:', error);
  }

  isInitialized = true;
  return levelPlayInitialized;
};

// ============================================
// INTERSTITIAL ADS (LevelPlay)
// ============================================

export const loadInterstitial = async (): Promise<boolean> => {
  // LevelPlay auto-loads after showing
  return levelPlayInitialized;
};

export const showInterstitial = async (): Promise<boolean> => {
  if (!levelPlayInitialized) {
    console.log('[Ads] LevelPlay not initialized');
    return false;
  }
  return await showLevelPlayInterstitial();
};

// ============================================
// REWARDED ADS (LevelPlay)
// ============================================

export const loadRewardedAd = async (): Promise<boolean> => {
  return levelPlayInitialized;
};

export const showRewardedAd = async (): Promise<{ rewarded: boolean }> => {
  if (!levelPlayInitialized) {
    console.log('[Ads] LevelPlay not initialized');
    return { rewarded: false };
  }
  
  return new Promise((resolve) => {
    showLevelPlayRewarded((reward) => {
      resolve({ rewarded: true });
    }).then((shown) => {
      if (!shown) {
        resolve({ rewarded: false });
      }
    });
  });
};

export const preloadInterstitials = async () => {
  // LevelPlay handles preloading automatically
};

export const isAdNetworkReady = (): boolean => {
  return isInitialized && levelPlayInitialized;
};

export const requestTrackingPermission = async (): Promise<boolean> => {
  return true;
};
