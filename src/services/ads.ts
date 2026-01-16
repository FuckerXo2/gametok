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

// Default ad frequency - will be overridden by remote config
let AD_FREQUENCY = 3; // Show ad after every 3 games (default)

// Getter function to always get current value
export const getAdFrequency = () => AD_FREQUENCY;
export { AD_FREQUENCY }; // For backward compatibility

// Remote config cache
let remoteConfig: { adFrequency: number; maintenanceMode: boolean } | null = null;

// Detect iOS simulator (ads SDK crashes on iOS 26.x simulator due to WebKit bug)
const isIOSSimulator = Platform.OS === 'ios' && !Constants.isDevice;

// Fetch remote config from backend
export const fetchRemoteConfig = async () => {
  try {
    const API_URL = 'https://gametok-backend-production.up.railway.app';
    const response = await fetch(`${API_URL}/api/config`);
    if (response.ok) {
      remoteConfig = await response.json();
      if (remoteConfig?.adFrequency) {
        AD_FREQUENCY = remoteConfig.adFrequency;
        console.log('[Ads] Remote config loaded, ad frequency:', AD_FREQUENCY);
      }
      return remoteConfig;
    }
  } catch (error) {
    console.log('[Ads] Failed to fetch remote config, using defaults');
  }
  return null;
};

// Check if we're in Expo Go (native modules not available)
// Expo Go has appOwnership === 'expo', dev builds have undefined
export const isExpoGo = Constants.appOwnership === 'expo';

// Check if ads should be disabled (Expo Go or iOS simulator)
export const shouldDisableAds = isExpoGo || isIOSSimulator;

// Track if ATT has been requested
let attRequested = false;

// Request App Tracking Transparency permission
// This should be called early in app lifecycle, before any tracking occurs
export const requestTrackingPermission = async (): Promise<string> => {
  if (attRequested) {
    console.log('[ATT] Already requested');
    return 'already-requested';
  }
  
  if (Platform.OS !== 'ios') {
    console.log('[ATT] Not iOS, skipping');
    return 'not-ios';
  }
  
  if (isExpoGo) {
    console.log('[ATT] Running in Expo Go, skipping');
    return 'expo-go';
  }
  
  try {
    const { requestTrackingPermissionsAsync, getTrackingPermissionsAsync } = await import('expo-tracking-transparency');
    
    // Check current status first
    const { status: currentStatus } = await getTrackingPermissionsAsync();
    console.log('[ATT] Current status:', currentStatus);
    
    // Only request if not determined yet
    if (currentStatus === 'undetermined') {
      // Small delay to ensure app is fully loaded (helps on iPad)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { status } = await requestTrackingPermissionsAsync();
      console.log('[ATT] Permission requested, status:', status);
      attRequested = true;
      return status;
    }
    
    attRequested = true;
    return currentStatus;
  } catch (error: any) {
    console.log('[ATT] Error requesting permission:', error?.message || error);
    attRequested = true;
    return 'error';
  }
};

// Initialize Mobile Ads SDK
export const initializeAds = async () => {
  // Fetch remote config first (non-blocking, with timeout)
  try {
    await Promise.race([
      fetchRemoteConfig(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
  } catch (e) {
    console.log('[Ads] Remote config fetch timed out or failed, using defaults');
  }
  
  // Skip initialization in Expo Go - native modules not available
  if (isExpoGo) {
    console.log('[Ads] Running in Expo Go - ads disabled, showing placeholders');
    return true; // Return true so ad slots still show (as placeholders)
  }

  // Skip initialization on iOS simulator - WebKit crashes on iOS 26.x
  if (isIOSSimulator) {
    console.log('[Ads] Running on iOS simulator - ads disabled to prevent WebKit crash');
    return true;
  }

  try {
    // Request tracking permission on iOS first (required for personalized ads)
    if (Platform.OS === 'ios') {
      await requestTrackingPermission();
    }

    // Dynamic import to avoid crash in Expo Go
    const { default: mobileAds, MaxAdContentRating } = await import('react-native-google-mobile-ads');
    
    // Configure and initialize ads with timeout to prevent blocking
    const initPromise = (async () => {
      try {
        await mobileAds().setRequestConfiguration({
          maxAdContentRating: MaxAdContentRating.PG,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        });
        await mobileAds().initialize();
      } catch (innerError) {
        console.log('[Ads] Inner init error (non-fatal):', innerError);
      }
    })();

    await Promise.race([
      initPromise,
      new Promise((resolve) => setTimeout(resolve, 10000)) // Don't reject, just resolve after timeout
    ]);

    console.log('[Ads] Mobile Ads SDK initialized');
    return true;
  } catch (error) {
    console.log('[Ads] Failed to initialize (non-fatal):', error);
    // Return true anyway - app should work without ads
    return true;
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
