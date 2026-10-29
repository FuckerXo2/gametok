// Buying TokBux: Apple / Google in-app purchases through expo-iap, checked by the GameTok backend itself
// (src/tokbux-store.js there: Apple's signature, or Google's Play API), which adds the TokBux to the account. Only
// then is the purchase finished with the store; one that couldn't be checked yet (offline, signed out) stays
// unfinished and comes back on the next start, so a paid pack is never lost.
import { Platform } from 'react-native';
import { getAvatarAccount, syncAvatar } from '../avatar/store';
import { tokbuxStore } from '../services/api';

// store product id (App Store Connect = Google Play) -> TokBux it gives; must match the backend's TOKBUX_PACKS
export const TOKBUX_PACKS: Record<string, number> = { tokbux_80: 80, tokbux_500: 500, tokbux_1200: 1200, tokbux_3000: 3000, tokbux_8500: 8500 };

// the US prices: shown only in development, where the store isn't connected
const DEV_PRICES: Record<string, string> = { tokbux_80: '$0.99', tokbux_500: '$4.99', tokbux_1200: '$9.99', tokbux_3000: '$19.99', tokbux_8500: '$49.99' };
export const devPrice = (id: string) => (__DEV__ ? DEV_PRICES[id] : undefined);

// Short of TokBux for something: the two smallest packs that cover it (like Roblox's "Buy Robux and item")
export function packsCovering(short: number): string[] {
  return Object.keys(TOKBUX_PACKS).sort((a, b) => TOKBUX_PACKS[a] - TOKBUX_PACKS[b]).filter((id) => TOKBUX_PACKS[id] >= short).slice(0, 2);
}

let IAP: typeof import('expo-iap') | null = null;
try { IAP = require('expo-iap'); } catch { /* a build without the native module */ }

let userId: string | null = null;
let connected: Promise<boolean> | null = null;
// a buyPack() waiting for its purchase to come back from the store
let waiting: { sku: string; done: (r: string | null) => void } | null = null;

// Check a purchase with the backend, then finish it with the store. false: not checked yet (try again later).
async function settle(purchase: any): Promise<boolean> {
  if (__DEV__) console.log('[TokBux] store purchase', purchase.productId, purchase.purchaseState, purchase.id, !!purchase.purchaseToken);
  if (!TOKBUX_PACKS[purchase.productId] || !purchase.purchaseToken) return false;
  if (purchase.purchaseState === 'pending') return false;   // paid later (e.g. cash at a shop): comes back when it's done
  if (!userId) return false;
  try {
    await tokbuxStore.verify(Platform.OS, purchase.productId, purchase.purchaseToken);
  } catch (e: any) {
    // not credited (refused or unreachable): keep it unfinished, so it's checked again on the next start and a paid
    // pack is never lost to a server problem
    console.warn('[TokBux] purchase not credited yet', e?.status, e?.message);
    return false;
  }
  await IAP!.finishTransaction({ purchase, isConsumable: true }).catch((e) => console.warn('[TokBux] finish', e));
  return true;
}

// Connect to the store as this GameTok user: their purchases are credited to this account.
export async function startPurchases(id: string | null | undefined) {
  userId = id || null;
  if (!IAP || !userId) return;
  if (!connected) {
    connected = IAP.initConnection().then(() => true, (e) => { console.warn('[TokBux] store', e); connected = null; return false; });
    if (!(await connected)) return;
    IAP.purchaseUpdatedListener(async (purchase) => {
      const ok = await settle(purchase);
      if (waiting?.sku === purchase.productId) {
        const w = waiting; waiting = null;
        w.done(ok ? null : purchase.purchaseState === 'pending'
          ? 'Your payment is pending: the TokBux will show up once it goes through.'
          : 'Your TokBux are on the way: they will show up in a moment.');
      }
    });
    IAP.purchaseErrorListener((e) => {
      if (__DEV__) console.log('[TokBux] store error', e.code, e.message);
      if (!waiting) return;
      const w = waiting; waiting = null;
      w.done(e.code === IAP!.ErrorCode.UserCancelled ? 'cancelled' : e.message || 'The purchase did not go through.');
    });
  }
  if (!(await connected)) return;
  // purchases paid for but not finished (the app closed, the network dropped): credit them now
  try { const left = await IAP.getAvailablePurchases(); if (__DEV__) console.log('[TokBux] unfinished purchases', left.length); for (const p of left) await settle(p); } catch (e) { console.warn('[TokBux] restore', e); }
}

export interface TokbuxPack { id: string; tokbux: number; price: string }

// The packs on sale, priced by the store in the player's currency. Empty: not on sale on this build.
export async function loadPacks(): Promise<TokbuxPack[]> {
  if (!IAP || !connected || !(await connected)) return [];
  try {
    const products = (await IAP.fetchProducts({ skus: Object.keys(TOKBUX_PACKS), type: 'in-app' })) || [];
    return (products as any[])
      .filter((p) => TOKBUX_PACKS[p.id])
      .map((p) => ({ id: p.id, tokbux: TOKBUX_PACKS[p.id], price: p.displayPrice }))
      .sort((a, b) => a.tokbux - b.tokbux);
  } catch (e) {
    console.warn('[TokBux] products', e);
    return [];
  }
}

// Buy a pack. Resolves to null when the TokBux are on the account, 'cancelled', or a message to show.
export async function buyPack(pack: TokbuxPack): Promise<string | null> {
  if (!IAP || !userId) return 'Sign in to buy TokBux.';
  const before = getAvatarAccount()?.tokbux ?? 0;
  const result = new Promise<string | null>((done) => { waiting = { sku: pack.id, done }; });
  try {
    await IAP.requestPurchase({
      request: { apple: { sku: pack.id, appAccountToken: userId }, google: { skus: [pack.id], obfuscatedAccountId: userId } },
      type: 'in-app',
    });
  } catch (e: any) {
    waiting = null;
    return e?.code === IAP.ErrorCode.UserCancelled ? 'cancelled' : e?.message || 'The purchase did not go through.';
  }
  const err = await result;
  if (err) return err;
  await syncAvatar();
  return (getAvatarAccount()?.tokbux ?? 0) >= before + pack.tokbux ? null : 'Your TokBux are on the way: they will show up in a moment.';
}
