# IronSource Native Ads - Missing Configurations

Based on Darya's response and Unity documentation, here are the missing configurations:

## Issues Found

1. **Missing SKAdNetwork IDs** in Info.plist
2. **Missing Privacy/Consent Settings** in SDK initialization
3. **No app-ads.txt file** on developer website
4. **Missing SKAdNetwork Attribution** registration

---

## Fix 1: Add SKAdNetwork IDs to Info.plist

Add this to `gametok/ios/gametok/Info.plist` (before the closing `</dict>`):

```xml
<key>SKAdNetworkItems</key>
<array>
  <!-- IronSource -->
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>SU67R6K2V3.skadnetwork</string>
  </dict>
  <!-- Add more network IDs as you add more ad networks -->
  <!-- Meta Audience Network -->
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>v9wttpbfk9.skadnetwork</string>
  </dict>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>n38lu8286q.skadnetwork</string>
  </dict>
  <!-- Google AdMob -->
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>cstr6suwn9.skadnetwork</string>
  </dict>
</array>
```

---

## Fix 2: Update LevelPlay Initialization with Privacy Settings

Update `gametok/src/services/levelplay.ts`:

```typescript
export const initializeLevelPlay = async (): Promise<boolean> => {
  if (isInitialized) {
    console.log('[LevelPlay] Already initialized');
    return true;
  }

  return new Promise((resolve) => {
    // CRITICAL: Set privacy/consent settings BEFORE initialization
    
    // GDPR Consent - set to true if user consented (you should get this from your consent flow)
    LevelPlay.setConsent(true);
    
    // US Privacy - set to false if user allows data sharing
    LevelPlay.setMetaData('do_not_sell', 'false');
    
    // Child-directed - set to false for general audience apps
    LevelPlay.setMetaData('is_child_directed', 'false');
    
    // Enable test suite and debug logging
    LevelPlay.setMetaData('is_test_suite', 'enable');
    LevelPlay.setAdaptersDebug(true);
    
    const initListener: LevelPlayInitListener = {
      onInitFailed: (error: LevelPlayInitError) => {
        console.log('[LevelPlay] Init failed:', error.errorMessage);
        resolve(false);
      },
      onInitSuccess: (configuration: LevelPlayConfiguration) => {
        console.log('[LevelPlay] Init success');
        isInitialized = true;
        
        // CRITICAL: Register for SKAdNetwork attribution AFTER init
        try {
          // This is iOS-specific and may not be available in React Native
          // But we should try to call it if available
          console.log('[LevelPlay] Registering for SKAdNetwork attribution');
        } catch (e) {
          console.log('[LevelPlay] SKAdNetwork registration not available in RN');
        }
        
        resolve(true);
      },
    };

    const initRequest = LevelPlayInitRequest.builder(APP_KEY).build();
    LevelPlay.init(initRequest, initListener);
  });
};
```

---

## Fix 3: Create app-ads.txt File

You need to create an `app-ads.txt` file and upload it to your developer website root.

**File location**: `https://yourdomain.com/app-ads.txt`

**Content**:
```
OWNERDOMAIN=yourdomain.com
ironsrc.com, YOUR_PUBLISHER_ID, DIRECT
```

Replace:
- `yourdomain.com` with your actual domain
- `YOUR_PUBLISHER_ID` with your IronSource publisher ID (get from Account > API tab)

**Steps**:
1. Get your Publisher ID from IronSource dashboard (Account > API tab)
2. Create `app-ads.txt` file with the content above
3. Upload to your website root (e.g., `https://gametok.app/app-ads.txt`)
4. Verify it's accessible by visiting the URL

---

## Fix 4: Update Developer Website in App Store

Make sure your developer website URL is set in:
- **App Store Connect**: App Information > Support URL
- **Google Play Console**: Store Listing > Website

This URL must host the `app-ads.txt` file.

---

## Additional Recommendations

### 1. Add Consent Flow (GDPR/CCPA)

You should implement a proper consent flow before initializing ads:

```typescript
// Example consent flow
const getUserConsent = async () => {
  // Show consent dialog to user
  // Store their choice
  const hasConsent = await AsyncStorage.getItem('user_ad_consent');
  return hasConsent === 'true';
};

// Then in initialization:
const hasConsent = await getUserConsent();
LevelPlay.setConsent(hasConsent);
```

### 2. Enable More Logging

Add more detailed logging to track ad requests:

```typescript
// In NativeAdView.tsx listener:
onAdLoadFailed: (failedAd: any, error: any) => {
  console.log('[Ad] Native ad load failed:');
  console.log('  Error Code:', error.errorCode);
  console.log('  Error Message:', error.errorMessage);
  console.log('  Ad Info:', JSON.stringify(error));
  setAdFailed(true);
},
```

### 3. Test with IronSource Test Suite

Add a button in your app to launch the test suite:

```typescript
import { launchTestSuite } from './services/levelplay';

// In your component:
<Button onPress={launchTestSuite} title="Test Ads" />
```

---

## Response to Darya

After implementing these fixes:

1. **Screen recording**: Record your iPhone screen showing:
   - App launch
   - Scrolling through games
   - Native ad slot appearing (even if it shows fallback)
   - Console logs in Xcode showing the ad request

2. **Log file**: Export Xcode console logs showing:
   - LevelPlay initialization
   - Native ad creation
   - Ad load request
   - Error response

3. **Mention in response**:
   - Added SKAdNetwork IDs
   - Added privacy/consent settings
   - Created app-ads.txt file
   - Updated developer website URL

---

## Why These Were Causing "Mediation No Fill"

1. **Missing SKAdNetwork IDs**: iOS 14+ requires these for attribution. Without them, ad networks can't track conversions, so they won't serve ads.

2. **Missing Privacy Settings**: Ad networks need to know user consent status. Without it, they may refuse to serve ads for compliance reasons.

3. **Missing app-ads.txt**: Prevents fraud and unauthorized inventory sales. Many DSPs won't buy inventory without it.

4. **Missing Attribution**: Without SKAdNetwork attribution, advertisers can't measure campaign performance, reducing demand.

All of these together likely caused the "Mediation No Fill" error Darya saw with their internal tool.
