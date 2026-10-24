// Buying TokBux: Apple / Google in-app purchases through RevenueCat. RevenueCat checks the receipt with the store
// and tells the GameTok backend (src/tokbux-store.js there), which adds the TokBux to the account. The app only
// starts the purchase, then waits for the account to show the new balance.
//
// Keys: RevenueCat's public SDK keys (safe in the app). Set EXPO_PUBLIC_REVENUECAT_IOS_KEY /
// EXPO_PUBLIC_REVENUECAT_ANDROID_KEY in gametok/.env before a build; without them the store says "soon".
import { Platform } from 'react-native';
import { getAvatarAccount, syncAvatar } from '../avatar/store';

// store product id (App Store Connect = Google Play) -> TokBux it gives; must match the backend's TOKBUX_PACKS
export const TOKBUX_PACKS: Record<string, number> = { tokbux_500: 500, tokbux_1200: 1200, tokbux_3000: 3000, tokbux_8500: 8500 };

const API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
}) || '';

let Purchases: any = null;
try { Purchases = require('react-native-purchases').default; } catch { /* a build without the native module */ }

let configuredFor: string | null = null;
// Connect RevenueCat as this GameTok user: their purchases are credited to this account.
export async function startPurchases(userId: string | null | undefined) {
  if (!Purchases || !API_KEY || !userId) return;
  try {
    if (!configuredFor) Purchases.configure({ apiKey: API_KEY, appUserID: userId });
    else if (configuredFor !== userId) await Purchases.logIn(userId);
    configuredFor = userId;
  } catch (e) { console.warn('[TokBux] RevenueCat', e); }
}

export interface TokbuxPack { id: string; tokbux: number; price: string; pkg: any }

// The packs on sale, priced by the store in the player's currency. Empty: not on sale on this build.
export async function loadPacks(): Promise<TokbuxPack[]> {
  if (!Purchases || !API_KEY || !configuredFor) return [];
  try {
    const offerings = await Purchases.getOfferings();
    const pkgs: any[] = offerings?.current?.availablePackages || [];
    return pkgs
      .filter((p) => TOKBUX_PACKS[p.product.identifier])
      .map((p) => ({ id: p.product.identifier, tokbux: TOKBUX_PACKS[p.product.identifier], price: p.product.priceString, pkg: p }))
      .sort((a, b) => a.tokbux - b.tokbux);
  } catch (e) {
    console.warn('[TokBux] offerings', e);
    return [];
  }
}

// Buy a pack. Resolves to null when the TokBux are on the account, 'cancelled', or an error message.
export async function buyPack(pack: TokbuxPack): Promise<string | null> {
  const before = getAvatarAccount()?.tokbux ?? 0;
  try {
    await Purchases.purchasePackage(pack.pkg);
  } catch (e: any) {
    if (e?.userCancelled) return 'cancelled';
    return e?.message || 'The purchase did not go through.';
  }
  // the store took the money; the backend adds the TokBux when RevenueCat tells it (usually a few seconds)
  for (let i = 0; i < 15; i++) {
    await syncAvatar();
    if ((getAvatarAccount()?.tokbux ?? 0) >= before + pack.tokbux) return null;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return 'Your TokBux are on the way: they will show up in a moment.';
}
