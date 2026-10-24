# Selling TokBux: what to set up

The code is done (app 2.2.0, backend, No Rules FC). These are the account steps only you can do.
Product IDs are the same everywhere: `tokbux_500`, `tokbux_1200`, `tokbux_3000`, `tokbux_8500`.
Each gives exactly that many TokBux (the backend decides, not the store).

## 1. Apple (App Store Connect)
1. **Business → Agreements, Tax, and Banking**: the *Paid Apps* agreement must be active (bank + tax filled in).
   Without it, in-app purchases never load.
2. **Your app → Monetization → In-App Purchases → +**, four times, type **Consumable**:
   | Product ID | Name shown | Suggested price |
   |---|---|---|
   | tokbux_500 | 500 TokBux | $4.99 |
   | tokbux_1200 | 1,200 TokBux | $9.99 |
   | tokbux_3000 | 3,000 TokBux | $19.99 |
   | tokbux_8500 | 8,500 TokBux | $49.99 |
   Each needs a description and a review screenshot (a screenshot of the TokBux shop is fine).
3. **Users and Access → Integrations → In-App Purchase → generate a key** (.p8). Download it once; RevenueCat needs it
   (with its Key ID and your Issuer ID).
4. **Users and Access → Sandbox → Testers**: add a test Apple ID, for buying without paying.
5. Note the app's **Apple ID** (a number, App Information page): the "Update GameTok" button needs it.

## 2. Google (Play Console)
1. **Setup → Payments profile**: a merchant account must exist.
2. Upload the 2.2.0 build to a testing track first (Google only lets you create products once a build with billing
   is uploaded).
3. **Monetize → Products → In-app products**: the same four IDs and prices, then activate them.
4. A **service account** for RevenueCat (follow RevenueCat's "Google Play service credentials" guide: Google Cloud
   service account + JSON key, invited in Play Console → Users and permissions with financial access).
5. **Setup → License testing**: add your Gmail, for test purchases.

## 3. RevenueCat (revenuecat.com, free until $2,500/month)
1. Create a project **GameTok**. Add the **App Store app** (bundle `com.olasubomi.gametok`, upload the .p8 from Apple)
   and the **Play Store app** (package `com.olasubomi.gametok`, upload the service account JSON).
2. **Products**: import the four products from both stores.
3. **Offerings**: make the `default` offering *current*, with four packages, one per product
   (each package holds the iOS and Android product of the same ID).
4. **API keys**: copy the two public SDK keys (`appl_…` and `goog_…`). Send them to me, or put them in
   `gametok/.env`:
   ```
   EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_…
   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_…
   ```
5. **Integrations → Webhooks → Add**:
   - URL: `https://gametok-backend-267787411422.us-central1.run.app/api/tokbux/revenuecat`
   - Authorization header: a long random secret. The same value goes on the backend as `REVENUECAT_WEBHOOK_AUTH`
     (Cloud Run service `gametok-backend`). I can make the secret and set it on the backend once you say so;
     then you paste it into RevenueCat.

## 4. Build and release
1. New native builds (EAS) for both stores: the purchase library is native, the current builds can't buy.
2. Test with the sandbox tester / license tester: buy a pack, the TokBux arrive within seconds.
3. Once 2.2.0 is live in **both** stores, tell me and I'll force the update (and set the App Store link):
   ```sql
   UPDATE app_config SET value = '2.2.0' WHERE key IN ('min_version_ios', 'min_version_android');
   UPDATE app_config SET value = 'https://apps.apple.com/app/id<your app id>' WHERE key = 'store_url_ios';
   ```
   From then on, older apps show "Update GameTok", and No Rules FC opened from an old app says the same.
