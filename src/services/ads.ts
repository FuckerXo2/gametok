// Ad Service for GameTok - Google AdMob Native Ads
import Constants from 'expo-constants';
import MobileAds, { 
  MaxAdContentRating,
  TestIds,
  NativeAd,
  NativeAdEventType
} from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';

// Default ad frequency - will be overridden by remote config
let AD_FREQUENCY = 3;
export const getAdFrequency = () => AD_FREQUENCY;
export { AD_FREQUENCY };

// AdMob Configuration
const ADMOB_APP_ID_IOS = 'ca-app-pub-1961802731817431~8301521567';
const ADMOB_APP_ID_ANDROID = 'ca-app-pub-1961802731817431~XXXXXXXX'; // Android not set up yet

// Native Ad Unit IDs
const NATIVE_AD_UNIT_ID_IOS = 'ca-app-pub-1961802731817431/8986743812';
const NATIVE_AD_UNIT_ID_ANDROID = 'ca-app-pub-1961802731817431/XXXXXXXX'; // Android not set up yet

// Use REAL ads
const USE_TEST_ADS = false;

export const NATIVE_AD_UNIT_ID = USE_TEST_ADS 
  ? TestIds.NATIVE 
  : (Platform.OS === 'ios' ? NATIVE_AD_UNIT_ID_IOS : NATIVE_AD_UNIT_ID_ANDROID);

// Detect environment
const executionEnvironment = Constants.executionEnvironment;
export const isExpoGo = Constants.appOwnership === 'expo' || executionEnvironment === 'expoGo';
export const shouldDisableAds = isExpoGo;

let isInitialized = false;

console.log('[Ads] AdMob Native Ads service initialized');

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

  try {
    console.log('[Ads] Initializing AdMob...');
    
    await MobileAds().initialize();
    
    // Set ad content rating
    await MobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.T,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    
    isInitialized = true;
    console.log('[Ads] AdMob initialized successfully');
    
    return true;
  } catch (error) {
    console.error('[Ads] AdMob initialization failed:', error);
    return false;
  }
};

// ============================================
// NATIVE ADS
// ============================================

export const getNativeAdUnitId = (): string => {
  return NATIVE_AD_UNIT_ID;
};

// ============================================
// STUB FUNCTIONS (for compatibility)
// ============================================

export const loadInterstitial = async (): Promise<boolean> => {
  return isInitialized;
};

export const showInterstitial = async (): Promise<boolean> => {
  return false;
};

export const loadRewardedAd = async (): Promise<boolean> => {
  return false;
};

export const showRewardedAd = async (): Promise<{ rewarded: boolean }> => {
  return { rewarded: false };
};

export const preloadInterstitials = async () => {
  // Native ads are loaded on-demand
};

export const isAdNetworkReady = (): boolean => {
  return isInitialized;
};

export const requestTrackingPermission = async (): Promise<boolean> => {
  // AdMob handles ATT internally
  return true;
};
