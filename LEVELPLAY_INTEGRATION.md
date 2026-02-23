# LevelPlay Native Ads Integration - GameTOK

## App Information
- **App Name**: GameTOK
- **Bundle ID**: com.olasubomi.gametok
- **App Key**: 2504ecd05
- **Platform**: React Native (Bare Workflow)
- **SDK Version**: unity-levelplay-mediation@9.0.0

## Integration Steps

### 1. SDK Initialization

**File**: `gametok/src/services/levelplay.ts`

```typescript
import {
  LevelPlay,
  LevelPlayInitRequest,
  LevelPlayInitListener,
} from 'unity-levelplay-mediation';

const APP_KEY = '2504ecd05';

export const initializeLevelPlay = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    LevelPlay.setAdaptersDebug(true);
    
    const initListener: LevelPlayInitListener = {
      onInitFailed: (error) => {
        console.log('[LevelPlay] Init failed:', error.errorMessage);
        resolve(false);
      },
      onInitSuccess: (configuration) => {
        console.log('[LevelPlay] Init success');
        resolve(true);
      },
    };

    const initRequest = LevelPlayInitRequest.builder(APP_KEY).build();
    LevelPlay.init(initRequest, initListener);
  });
};
```

### 2. Native Ad Component

**File**: `gametok/src/components/NativeAdView.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LevelPlayNativeAd, LevelPlayNativeAdView, LevelPlayTemplateType } from 'unity-levelplay-mediation';

const NativeAdView: React.FC = () => {
  const [nativeAd, setNativeAd] = useState<any>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adFailed, setAdFailed] = useState(false);

  useEffect(() => {
    let ad: any = null;

    const createAd = () => {
      try {
        console.log('[Ad] Creating LevelPlay native ad with placement: Home_Screen');
        
        const listener = {
          onAdLoaded: (loadedAd: any, adInfo: any) => {
            console.log('[Ad] Native ad loaded:', JSON.stringify(adInfo));
            setAdLoaded(true);
            setAdFailed(false);
          },
          onAdLoadFailed: (failedAd: any, error: any) => {
            console.log('[Ad] Native ad load failed:', JSON.stringify(error));
            setAdFailed(true);
          },
          onAdImpression: (impressionAd: any, adInfo: any) => {
            console.log('[Ad] Native ad impression');
          },
          onAdClicked: (clickedAd: any, adInfo: any) => {
            console.log('[Ad] Native ad clicked');
          },
        };

        ad = LevelPlayNativeAd.builder()
          .withPlacement('Home_Screen')
          .withListener(listener)
          .build();

        setNativeAd(ad);
        ad.loadAd();
        
        console.log('[Ad] Native ad load requested');
      } catch (error: any) {
        console.log('[Ad] Error creating native ad:', error?.message || error);
        setAdFailed(true);
      }
    };

    createAd();

    return () => {
      if (ad) {
        try {
          ad.destroyAd();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  if (adFailed) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Ad failed to load</Text>
      </View>
    );
  }

  if (!adLoaded || !nativeAd) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF8E53" />
        <Text style={styles.loadingText}>Loading ad...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LevelPlayNativeAdView
        style={styles.nativeAd}
        nativeAd={nativeAd}
        templateType={LevelPlayTemplateType.Medium}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  nativeAd: {
    width: 300,
    height: 350,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: '#ff0000',
    fontSize: 14,
  },
});

export default NativeAdView;
```

### 3. Ad Service Integration

**File**: `gametok/src/services/ads.ts`

```typescript
import { initializeLevelPlay } from './levelplay';

export const initializeAds = async () => {
  try {
    console.log('[Ads] Initializing LevelPlay...');
    const success = await initializeLevelPlay();
    console.log('[Ads] LevelPlay initialized:', success);
    return success;
  } catch (error) {
    console.error('[Ads] LevelPlay initialization failed:', error);
    return false;
  }
};
```

### 4. App Initialization

**File**: `gametok/src/screens/HomeScreen.tsx`

```typescript
import { initializeAds } from '../services/ads';
import NativeAdView from '../components/NativeAdView';

// In HomeScreen component:
useEffect(() => {
  const init = async () => {
    // Initialize ads SDK
    initializeAds().then(() => {
      console.log('[HomeScreen] Ads SDK initialized');
    }).catch(e => console.log('[HomeScreen] Ads init error:', e));
    
    // ... rest of initialization
  };
  init();
}, []);

// Native ads are inserted in feed every 3 games:
const createFeed = (games: Game[]): FeedItem[] => {
  const result: FeedItem[] = [];
  games.forEach((game, index) => {
    if (index > 0 && index % 3 === 0) {
      result.push({ id: `ad-${index}`, isAd: true });
    }
    result.push({ game, id: game.id, isAd: false });
  });
  return result;
};

// Render native ad in feed:
{item.isAd ? (
  <NativeAdView contentHeight={contentHeight} />
) : (
  // Game content
)}
```

## Steps to Reproduce Native Ad Request

1. **App Launch**: User opens GameTOK app
2. **SDK Init**: LevelPlay SDK initializes with app key `2504ecd05`
3. **Home Screen Load**: User sees game feed
4. **Ad Request**: After scrolling past 3 games, NativeAdView component mounts
5. **Ad Creation**: 
   - `LevelPlayNativeAd.builder()` called
   - Placement: `Home_Screen`
   - Listener attached
   - `loadAd()` called
6. **Expected**: `onAdLoaded` callback with ad
7. **Actual**: `onAdLoadFailed` callback consistently

## Console Logs

```
[Ads] Initializing LevelPlay...
[LevelPlay] Init success
[Ads] LevelPlay initialized: true
[Ad] Creating LevelPlay native ad with placement: Home_Screen
[Ad] Native ad load requested
[Ad] Native ad load failed: {"errorCode": 508, "errorMessage": "No fill"}
```

## Current Configuration

- **Placement Name**: Home_Screen
- **Template Type**: Medium
- **Ad Unit ID**: cics7y8cbgbckqay (visible in dashboard, not used in code)
- **Networks Configured**: IronSource Network only (no external networks yet)
- **Test Mode**: Enabled (`setAdaptersDebug(true)`)

## Issue

Native ads consistently fail to load with "No fill" error. We understand IronSource provides native ads in smaller amounts, but we're getting 0% fill rate.

## Questions

1. Do we need to configure additional settings in the LevelPlay dashboard for the `Home_Screen` placement?
2. Should we add Meta Audience Network or Google AdManager to improve fill rate?
3. Is there a minimum traffic threshold before IronSource serves native ads?
4. Are there any iOS-specific configurations needed in Xcode project?

## Device Information

- **Device**: iPhone (physical device, not simulator)
- **iOS Version**: 17+
- **Build Type**: Release (App Store build)
- **App Version**: 1.2.2 (build 32)

## Additional Files

All integration code is available in our GitHub repository if needed for further review.
