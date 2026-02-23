Hi Darya,

Thank you for your reply. I've attached the screen recording and log file showing the Native Ad loading process.

After reviewing the documentation links you shared, I've implemented all the missing configurations:

## Configurations Added

### 1. SKAdNetwork IDs (iOS Privacy Settings)
Added SKAdNetwork identifiers to Info.plist for iOS 14+ attribution as per https://docs.unity.com/en-us/grow/levelplay/sdk/react/ios-privacy-settings-configurations

### 2. Privacy/Consent Settings
Implemented all privacy settings before SDK initialization as per https://docs.unity.com/en-us/grow/levelplay/sdk/react/regulation-advanced-settings:
- GDPR consent: `LevelPlay.setConsent(true)`
- CCPA compliance: `LevelPlay.setMetaData('do_not_sell', ['false'])`
- COPPA compliance: `LevelPlay.setMetaData('is_child_directed', ['false'])`

### 3. App-Ads.txt
Created and deployed app-ads.txt as per https://docs.unity.com/en-us/grow/is-ads/user-acquisition/ironsource-exchange/app-ads-txt:
- Publisher ID: 645515
- File location: https://gametok-games.pages.dev/app-ads.txt
- Includes all IronSource authorized resellers

## Test Results

After rebuilding the app with these configurations:
- SDK initializes successfully
- Privacy settings are applied correctly
- Native ad requests still return error 508 ("No fill")

The attached log file shows the complete flow including privacy settings being applied before initialization.

## Question

Since your internal tool also received "Mediation No Fill" with my app key (2504ecd05), and I've now implemented all the configurations from the documentation you shared, is there anything else on my end that could be causing this?

Or is this simply a matter of IronSource Network not having native ad inventory available for my app at this time?

I've also attached the complete integration code (LEVELPLAY_INTEGRATION.md) for your review.

Best regards,
Abiola
