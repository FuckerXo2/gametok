// Ad Service for GameTok - Unity Ads Only
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ============================================
// UNITY ADS CONFIGURATION
// ============================================

export const UNITY_ADS_CONFIG = {
  GAME_ID: '6032839',
  INTERSTITIAL_PLACEMENT: 'Interstitial_iOS', // Default Unity placement
  REWARDED_PLACEMENT: 'Rewarded_iOS',
  BANNER_PLACEMENT: 'Banner_iOS',
  TEST_MODE: __DEV__,
};

// Default ad frequency - will be overridden by remote config
let AD_FREQUENCY = 3;
export const getAdFrequency = () => AD_FREQUENCY;
export { AD_FREQUENCY };

// Detect iOS simulator
const isIOSSimulator = Platform.OS === 'ios' && !Constants.isDevice;
export const isExpoGo = Constants.appOwnership === 'expo';
export const shouldDisableAds = isExpoGo || isIOSSimulator;

// Track initialization state
let unityAdsInitialized = false;
let attRequested = false;

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
// APP TRACKING TRANSPARENCY (iOS)
// ============================================

export const requestTrackingPermission = async (): Promise<string> => {
  if (attRequested) return 'already-requested';
  if (Platform.OS !== 'ios') return 'not-ios';
  if (isExpoGo) return 'expo-go';
  
  try {
    const { requestTrackingPermissionsAsync, getTrackingPermissionsAsync } = 
      await import('expo-tracking-transparency');
    
    const { status: currentStatus } = await getTrackingPermissionsAsync();
    console.log('[ATT] Current status:', currentStatus);
    
    if (currentStatus === 'undetermined') {
      await new Promise(resolve => setTimeout(resolve, 500));
      const { status } = await requestTrackingPermissionsAsync();
      console.log('[ATT] Permission requested, status:', status);
      attRequested = true;
      return status;
    }
    
    attRequested = true;
    return currentStatus;
  } catch (error: any) {
    console.log('[ATT] Error:', error?.message || error);
    attRequested = true;
    return 'error';
  }
};

// ============================================
// UNITY ADS INITIALIZATION
// ============================================

const initializeUnityAds = async (): Promise<boolean> => {
  if (unityAdsInitialized) return true;
  
  try {
    const UnityAds = await import('react-native-unity-ads');
    
    await UnityAds.default.initialize(
      UNITY_ADS_CONFIG.GAME_ID,
      UNITY_ADS_CONFIG.TEST_MODE
    );
    
    unityAdsInitialized = true;
    console.log('[Ads] Unity Ads initialized');
    return true;
  } catch (error) {
    console.log('[Ads] Unity Ads init failed:', error);
    return false;
  }
};

// ============================================
// MAIN INITIALIZATION
// ============================================

export const initializeAds = async () => {
  // Fetch remote config first
  try {
    await Promise.race([
      fetchRemoteConfig(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
  } catch (e) {
    console.log('[Ads] Remote config fetch timed out');
  }
  
  if (shouldDisableAds) {
    console.log('[Ads] Ads disabled (Expo Go or Simulator)');
    return true;
  }

  // Request tracking permission on iOS
  if (Platform.OS === 'ios') {
    await requestTrackingPermission();
  }

  // Initialize Unity Ads
  const success = await initializeUnityAds();
  console.log(`[Ads] Init complete - Unity Ads: ${success}`);
  return success;
};

// ============================================
// INTERSTITIAL ADS
// ============================================

export const loadInterstitial = async (): Promise<boolean> => {
  if (shouldDisableAds || !unityAdsInitialized) return false;
  
  try {
    const UnityAds = await import('react-native-unity-ads');
    await UnityAds.default.load(UNITY_ADS_CONFIG.INTERSTITIAL_PLACEMENT);
    console.log('[Ads] Interstitial loaded');
    return true;
  } catch (error) {
    console.log('[Ads] Failed to load interstitial:', error);
    return false;
  }
};

export const showInterstitial = async (): Promise<boolean> => {
  if (shouldDisableAds || !unityAdsInitialized) return false;
  
  try {
    const UnityAds = await import('react-native-unity-ads');
    await UnityAds.default.show(UNITY_ADS_CONFIG.INTERSTITIAL_PLACEMENT);
    console.log('[Ads] Interstitial shown');
    // Preload next
    loadInterstitial();
    return true;
  } catch (error) {
    console.log('[Ads] Failed to show interstitial:', error);
    return false;
  }
};

// ============================================
// REWARDED ADS
// ============================================

export const loadRewardedAd = async (): Promise<boolean> => {
  if (shouldDisableAds || !unityAdsInitialized) return false;
  
  try {
    const UnityAds = await import('react-native-unity-ads');
    await UnityAds.default.load(UNITY_ADS_CONFIG.REWARDED_PLACEMENT);
    console.log('[Ads] Rewarded ad loaded');
    return true;
  } catch (error) {
    console.log('[Ads] Failed to load rewarded ad:', error);
    return false;
  }
};

export const showRewardedAd = async (): Promise<{ rewarded: boolean }> => {
  if (shouldDisableAds || !unityAdsInitialized) return { rewarded: false };
  
  try {
    const UnityAds = await import('react-native-unity-ads');
    await UnityAds.default.show(UNITY_ADS_CONFIG.REWARDED_PLACEMENT);
    console.log('[Ads] Rewarded ad shown');
    // Preload next
    loadRewardedAd();
    return { rewarded: true };
  } catch (error) {
    console.log('[Ads] Failed to show rewarded ad:', error);
    return { rewarded: false };
  }
};

// ============================================
// HELPERS
// ============================================

export const preloadInterstitials = async () => {
  await loadInterstitial();
};

export const insertAdsIntoFeed = <T>(items: T[], adFrequency: number = AD_FREQUENCY): (T | { isAd: true })[] => {
  const result: (T | { isAd: true })[] = [];
  
  items.forEach((item, index) => {
    result.push(item);
    if ((index + 1) % adFrequency === 0 && index > 0) {
      result.push({ isAd: true });
    }
  });
  
  return result;
};

export const isAdNetworkReady = (): boolean => {
  return unityAdsInitialized;
};
