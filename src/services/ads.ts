// AdMob Service for GameTok
// NOTE: react-native-google-mobile-ads does NOT work in Expo Go
// It requires a development build (npx expo run:ios or EAS build)
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Ad Unit IDs
export const AD_UNIT_IDS = {
  NATIVE: 'ca-app-pub-1961802731817431/8986743812',
  // Test IDs for development - switch to real ones in production
  NATIVE_TEST: 'ca-app-pub-3940256099942544/3986624511',
};

// Use test ads in development
const isDev = __DEV__;
export const NATIVE_AD_UNIT_ID = isDev ? AD_UNIT_IDS.NATIVE_TEST : AD_UNIT_IDS.NATIVE;

// Ad frequency - show ad every N items
export const AD_FREQUENCY = 3; // Show ad after every 3 games

// Check if we're in Expo Go (native modules not available)
// Expo Go has appOwnership === 'expo', dev builds have undefined
export const isExpoGo = Constants.appOwnership === 'expo';

// Initialize Mobile Ads SDK
export const initializeAds = async () => {
  // Skip initialization in Expo Go - native modules not available
  if (isExpoGo) {
    console.log('[Ads] Running in Expo Go - ads disabled, showing placeholders');
    return true; // Return true so ad slots still show (as placeholders)
  }

  try {
    // Dynamic import to avoid crash in Expo Go
    const { default: mobileAds, MaxAdContentRating } = await import('react-native-google-mobile-ads');
    const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');

    // Request tracking permission on iOS (required for personalized ads)
    if (Platform.OS === 'ios') {
      const { status } = await requestTrackingPermissionsAsync();
      console.log('[Ads] Tracking permission status:', status);
    }

    // Configure ads
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });

    // Initialize the SDK
    await mobileAds().initialize();
    console.log('[Ads] Mobile Ads SDK initialized');
    return true;
  } catch (error) {
    console.error('[Ads] Failed to initialize:', error);
    return false;
  }
};

// Helper to insert ads into feed
export const insertAdsIntoFeed = <T>(items: T[], adFrequency: number = AD_FREQUENCY): (T | { isAd: true })[] => {
  const result: (T | { isAd: true })[] = [];
  
  items.forEach((item, index) => {
    result.push(item);
    // Insert ad after every N items (but not at the very start)
    if ((index + 1) % adFrequency === 0 && index > 0) {
      result.push({ isAd: true });
    }
  });
  
  return result;
};
