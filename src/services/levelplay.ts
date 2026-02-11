// LevelPlay (ironSource) Ad Service
import {
  LevelPlay,
  LevelPlayInitRequest,
  LevelPlayInitListener,
  LevelPlayInitError,
  LevelPlayConfiguration,
  LevelPlayInterstitialAd,
  LevelPlayInterstitialAdListener,
  LevelPlayRewardedAd,
  LevelPlayRewardedAdListener,
  LevelPlayAdError,
  LevelPlayAdInfo,
  LevelPlayReward,
} from 'unity-levelplay-mediation';

// ironSource App Key
const APP_KEY = '2504ecd05';

let isInitialized = false;
let interstitialAd: LevelPlayInterstitialAd | null = null;
let rewardedAd: LevelPlayRewardedAd | null = null;

// Callbacks for rewarded ads
let onRewardCallback: ((reward: LevelPlayReward) => void) | null = null;

// Initialize LevelPlay SDK
export const initializeLevelPlay = async (): Promise<boolean> => {
  if (isInitialized) {
    console.log('[LevelPlay] Already initialized');
    return true;
  }

  return new Promise((resolve) => {
    // Enable test suite and debug logging
    LevelPlay.setMetaData('is_test_suite', ['enable']);
    LevelPlay.setAdaptersDebug(true);
    
    const initListener: LevelPlayInitListener = {
      onInitFailed: (error: LevelPlayInitError) => {
        console.log('[LevelPlay] Init failed:', error.errorMessage);
        resolve(false);
      },
      onInitSuccess: (configuration: LevelPlayConfiguration) => {
        console.log('[LevelPlay] Init success');
        isInitialized = true;
        resolve(true);
      },
    };

    const initRequest = LevelPlayInitRequest.builder(APP_KEY).build();
    LevelPlay.init(initRequest, initListener);
  });
};

// Interstitial Ads
const interstitialListener: LevelPlayInterstitialAdListener = {
  onAdLoaded: (adInfo: LevelPlayAdInfo) => {
    console.log('[LevelPlay] Interstitial loaded');
  },
  onAdLoadFailed: (error: LevelPlayAdError) => {
    console.log('[LevelPlay] Interstitial load failed:', error.errorMessage);
    // Retry after delay
    setTimeout(loadInterstitial, 30000);
  },
  onAdDisplayed: (adInfo: LevelPlayAdInfo) => {
    console.log('[LevelPlay] Interstitial displayed');
  },
  onAdDisplayFailed: (error: LevelPlayAdError, adInfo: LevelPlayAdInfo) => {
    console.log('[LevelPlay] Interstitial display failed:', error.errorMessage);
  },
  onAdClicked: (adInfo: LevelPlayAdInfo) => {
    console.log('[LevelPlay] Interstitial clicked');
  },
  onAdClosed: (adInfo: LevelPlayAdInfo) => {
    console.log('[LevelPlay] Interstitial closed');
    // Reload for next time
    loadInterstitial();
  },
  onAdInfoChanged: (adInfo: LevelPlayAdInfo) => {},
};

export const loadInterstitial = () => {
  if (!isInitialized) return;
  
  try {
    interstitialAd = new LevelPlayInterstitialAd('DefaultInterstitial');
    interstitialAd.setListener(interstitialListener);
    interstitialAd.loadAd();
  } catch (e) {
    console.log('[LevelPlay] Error loading interstitial:', e);
  }
};

export const showInterstitial = async (): Promise<boolean> => {
  if (!interstitialAd) {
    console.log('[LevelPlay] No interstitial ad loaded');
    loadInterstitial();
    return false;
  }

  try {
    const isReady = await interstitialAd.isAdReady();
    if (isReady) {
      interstitialAd.showAd();
      return true;
    } else {
      console.log('[LevelPlay] Interstitial not ready');
      loadInterstitial();
      return false;
    }
  } catch (e) {
    console.log('[LevelPlay] Error showing interstitial:', e);
    return false;
  }
};

// Rewarded Ads
const rewardedListener: LevelPlayRewardedAdListener = {
  onAdLoaded: (adInfo: LevelPlayAdInfo) => {
    console.log('[LevelPlay] Rewarded loaded');
  },
  onAdLoadFailed: (error: LevelPlayAdError) => {
    console.log('[LevelPlay] Rewarded load failed:', error.errorMessage);
    setTimeout(loadRewarded, 30000);
  },
  onAdDisplayed: (adInfo: LevelPlayAdInfo) => {
    console.log('[LevelPlay] Rewarded displayed');
  },
  onAdDisplayFailed: (error: LevelPlayAdError, adInfo: LevelPlayAdInfo) => {
    console.log('[LevelPlay] Rewarded display failed:', error.errorMessage);
  },
  onAdClicked: (adInfo: LevelPlayAdInfo) => {
    console.log('[LevelPlay] Rewarded clicked');
  },
  onAdClosed: (adInfo: LevelPlayAdInfo) => {
    console.log('[LevelPlay] Rewarded closed');
    loadRewarded();
  },
  onAdRewarded: (reward: LevelPlayReward, adInfo: LevelPlayAdInfo) => {
    console.log('[LevelPlay] User rewarded:', reward);
    if (onRewardCallback) {
      onRewardCallback(reward);
      onRewardCallback = null;
    }
  },
  onAdInfoChanged: (adInfo: LevelPlayAdInfo) => {},
};

export const loadRewarded = () => {
  if (!isInitialized) return;
  
  try {
    rewardedAd = new LevelPlayRewardedAd('DefaultRewardedVideo');
    rewardedAd.setListener(rewardedListener);
    rewardedAd.loadAd();
  } catch (e) {
    console.log('[LevelPlay] Error loading rewarded:', e);
  }
};

export const showRewarded = async (onReward?: (reward: LevelPlayReward) => void): Promise<boolean> => {
  if (!rewardedAd) {
    console.log('[LevelPlay] No rewarded ad loaded');
    loadRewarded();
    return false;
  }

  try {
    const isReady = await rewardedAd.isAdReady();
    if (isReady) {
      onRewardCallback = onReward || null;
      rewardedAd.showAd();
      return true;
    } else {
      console.log('[LevelPlay] Rewarded not ready');
      loadRewarded();
      return false;
    }
  } catch (e) {
    console.log('[LevelPlay] Error showing rewarded:', e);
    return false;
  }
};

// Check if ads are ready
export const isInterstitialReady = async (): Promise<boolean> => {
  if (!interstitialAd) return false;
  try {
    return await interstitialAd.isAdReady();
  } catch {
    return false;
  }
};

export const isRewardedReady = async (): Promise<boolean> => {
  if (!rewardedAd) return false;
  try {
    return await rewardedAd.isAdReady();
  } catch {
    return false;
  }
};

// Launch test suite for debugging ad integration
export const launchTestSuite = () => {
  if (isInitialized) {
    LevelPlay.launchTestSuite();
  } else {
    console.log('[LevelPlay] Cannot launch test suite - not initialized');
  }
};
