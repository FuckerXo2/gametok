# Start.io Integration Guide for GameTOK

## Overview
Start.io is a backup/secondary ad network to complement AdMob. It provides native ads with full UI customization.

---

## Step 1: Create Start.io Account

1. Go to **[Start.io Portal](https://portal.start.io)**
2. Sign up / Log in
3. Navigate to **"My Apps"** tab
4. Click **"Add New App"**
5. Enter your app details:
   - **App Name:** GameTOK
   - **Platform:** iOS (and/or Android)
   - **Package Name:** `com.olasubomi.gametok`
   - **App Store URL:** Your App Store link

6. Copy your **App ID** (you'll need this for integration)

---

## Step 2: Install the React Native SDK

```bash
cd /Users/abiolalimitless/gameidea/gametok
npm install react-native-start-io-sdk
```

### iOS Additional Setup

Add to your `ios/Podfile`:
```ruby
pod 'StartAppSDK'
```

Then run:
```bash
cd ios && pod install && cd ..
```

### Android Additional Setup

Add to `android/app/build.gradle`:
```gradle
dependencies {
    implementation 'com.startapp:inapp-sdk:5.+'
}
```

---

## Step 3: Update Your App IDs

Edit `/src/services/startio.ts` and replace the placeholder values:

```typescript
const STARTIO_APP_ID_IOS = 'YOUR_ACTUAL_IOS_APP_ID';
const STARTIO_APP_ID_ANDROID = 'YOUR_ACTUAL_ANDROID_APP_ID';
```

---

## Step 4: Update app-ads.txt

Add Start.io to your `app-ads.txt` file at `gametok-games.pages.dev`:

```
google.com, pub-1961802731817431, DIRECT, f08c47fec0942fa0
start.io, YOUR_STARTIO_PUBLISHER_ID, DIRECT
```

Find your Start.io Publisher ID in the portal under **App-ads.txt** section.

---

## Step 5: Initialize in App

In your `App.tsx` or main initialization:

```typescript
import { initializeStartio } from './src/services/startio';

// In your app initialization
useEffect(() => {
  const init = async () => {
    await initializeStartio();
  };
  init();
}, []);
```

---

## Step 6: Use as Fallback for AdMob

The recommended approach is to use Start.io as a **fallback** when AdMob fails:

```typescript
// In NativeAdView.tsx
import { loadNativeAd as loadStartioAd } from '../services/startio';

// When AdMob fails, try Start.io
if (adFailed) {
  const startioAd = await loadStartioAd();
  if (startioAd) {
    // Display Start.io native ad
  }
}
```

---

## Benefits of Start.io

| Feature | Details |
|---------|---------|
| ✅ No UI restrictions | Full control over ad appearance |
| ✅ High fill rates | Good for global traffic |
| ✅ Easy integration | Simple React Native SDK |
| ✅ Multiple ad formats | Native, Interstitial, Rewarded |
| ✅ Quick approval | Faster than some networks |

---

## Support

- **Start.io Documentation:** https://support.start.io
- **React Native SDK:** https://github.com/Inocentum-Technologies/react-native-start-io-sdk

---

## ⚠️ Important Notes

1. **Test Mode:** Always use test ads during development
2. **Expo Go:** Start.io won't work in Expo Go - need a development build
3. **app-ads.txt:** Make sure to add Start.io to your app-ads.txt for full monetization
4. **Privacy:** Start.io may show a consent popup - handle appropriately
