# Selling TokBux: what's set up

No middleman: the app buys through expo-iap (Apple / Google directly), and the backend checks every purchase itself
(backend `src/tokbux-store.js`) before adding TokBux. Revenue shows on the backend's `/admin/revenue` page.
Product IDs are the same everywhere: `tokbux_80`, `tokbux_500`, `tokbux_1200`, `tokbux_3000`, `tokbux_8500`.
Each gives exactly that many TokBux (the backend decides, not the store).

## Done
- **Apple**: the five consumables, with prices and review screenshots (`gametok-backend/scripts/setup-tokbux-appstore.mjs`).
  Bank, tax (W-8BEN) and the Paid Apps agreement are submitted.
- **Google**: the five one-time products, active in 174 countries (`gametok-backend/scripts/setup-tokbux-play.mjs`),
  through the service account `revenuecat@gametok1` (invited in Play Console; its key is
  `gametok-backend/play-service-account.json`, never committed).

## Left
1. **Apple Paid Apps agreement**: wait for it to turn *Active* (until then purchases don't load on iPhone).
   Also apply to the **App Store Small Business Program** (15% instead of 30% under $1M a year; not automatic).
2. **Apple refunds**: App Store Connect → the app → App Information → **App Store Server Notifications**, Version 2,
   Production and Sandbox URL:
   `https://gametok-backend-267787411422.us-central1.run.app/api/tokbux/apple-notifications`
3. **Google payments profile**: Play Console → Settings → Payments profile (bank + tax), if not done.
4. **The backend's Play key**: the live backend reads the service account from the secret `play-service-account`
   (env `PLAY_SERVICE_ACCOUNT`); see the commands in the backend's commit or ask me.
5. **Testers**: Apple → Users and Access → Sandbox → a test Apple ID; Google → Settings → License testing → your Gmail.
6. **Build 2.2.0** for both stores (expo-iap is native), test a purchase with the testers, release.
7. Once 2.2.0 is live in **both** stores, force the update (and set the App Store link):
   ```sql
   UPDATE app_config SET value = '2.2.0' WHERE key IN ('min_version_ios', 'min_version_android');
   UPDATE app_config SET value = 'https://apps.apple.com/app/id<your app id>' WHERE key = 'store_url_ios';
   ```
