# Next Steps for IronSource Native Ads

## What I Just Fixed

1. ✅ Added SKAdNetwork IDs to `Info.plist`
2. ✅ Added privacy/consent settings to LevelPlay initialization
3. ✅ Enhanced error logging in NativeAdView
4. ✅ Created app-ads.txt template

## What You Need to Do Now

### 1. Rebuild the App
```bash
cd gametok
npx expo prebuild --clean
```

Then open in Xcode and build for your device.

### 2. Get Your Publisher ID
1. Go to IronSource dashboard
2. Click your Account/Profile avatar (bottom left)
3. Select "Account"
4. Go to "API" tab
5. Find "Publisher ID" section
6. Copy the ID

### 3. Create app-ads.txt File
1. Open `gametok/app-ads.txt`
2. Replace `yourdomain.com` with your actual domain
3. Replace `YOUR_PUBLISHER_ID` with the ID from step 2
4. Upload to your website root: `https://yourdomain.com/app-ads.txt`

### 4. Update App Store Listing
Make sure your developer website URL is set in:
- App Store Connect > App Information > Support URL
- This URL must host the app-ads.txt file

### 5. Test and Record
1. Launch app on physical iPhone
2. Open Xcode and view console logs
3. Start screen recording (iPhone: Settings > Control Center > Screen Recording)
4. Scroll through games until you see a native ad slot
5. Stop recording
6. Export Xcode console logs (right-click in console > Save)

### 6. Send to Darya
Reply with:
- Screen recording showing the ad request flow
- Xcode console log file
- Mention you've added SKAdNetwork IDs, privacy settings, and app-ads.txt

## Why These Fixes Matter

**SKAdNetwork IDs**: iOS 14+ requires these for ad attribution. Without them, advertisers can't track conversions, so they won't bid on your inventory.

**Privacy Settings**: Ad networks need to know user consent status for GDPR/CCPA compliance. Without it, they may refuse to serve ads.

**App-Ads.txt**: Prevents fraud and unauthorized inventory sales. Many demand-side platforms (DSPs) won't buy inventory without it.

All three together were likely causing the "Mediation No Fill" error.

## Expected Outcome

After these fixes:
- You should see more detailed logs showing exactly why ads fail (if they still do)
- IronSource's internal tool should be able to load test ads
- Fill rate should improve (though may still be low with only IronSource Network)
- Adding Meta Audience Network and Google AdManager will significantly improve fill rate

## If Still No Fill

If you still get "No fill" after these fixes:
1. The issue is likely low demand for your app's inventory
2. Adding Meta and AdManager networks will help
3. You may need to wait for more users/traffic before seeing consistent fill
4. IronSource may need to manually review your account/app
