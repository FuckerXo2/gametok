// The player's avatar, owned items and TokBux, shared by every screen that shows them.
// Signed in: the GameTok account is the truth (backend src/avatar-router.js); this phone keeps a copy so the
// avatar shows at once and offline. Signed out: the avatar lives on this phone only, and only free items.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { avatarAccount } from '../services/api';
import { AVATAR_ITEMS, AvatarRecord, ShopItem, normalizeAvatar, setShop } from './catalog';

const KEY = 'gametok.avatar.v1';
const SHOT_KEY = 'gametok.avatar.headshotFor';   // the look the profile picture was last made from
const SHOP_KEY = 'gametok.avatar.shop.v1';        // the server's last list of Shop items

export interface AvatarAccount {
  avatar: AvatarRecord;
  owned: string[];
  tokbux: number;
  prices: Record<string, number>;     // the server's (sale prices included); the app's catalog prices until it has answered
  sales?: Record<string, { price: number; was: number; off: number; until: string }>;   // what's on sale: the crossed-out price
  signedIn: boolean;
  shop?: number;                      // bumped when the Shop's items change (screens re-filter)
}

let current: AvatarAccount | null = null;
const listeners = new Set<(a: AvatarAccount) => void>();
const emit = () => listeners.forEach((l) => l(current!));
const set = (patch: Partial<AvatarAccount>) => { current = { ...current!, ...patch }; emit(); };

// the Shop's items: this phone's last copy at once, then the server's (new items show without an app update)
let lastShop: string | null = null;
const shopLoaded = AsyncStorage.getItem(SHOP_KEY).then((s) => { if (s) { lastShop = s; setShop(JSON.parse(s)); } }).catch(() => {});
export async function syncShop() {
  try {
    const { items } = await avatarAccount.items() as { items: ShopItem[] };
    const json = JSON.stringify(items);
    if (json === lastShop) return;   // nothing new
    lastShop = json;
    if (setShop(items)) {
      AsyncStorage.setItem(SHOP_KEY, json).catch(() => {});
      if (current) set({ shop: (current.shop ?? 0) + 1 });
    }
  } catch {}   // offline: keep what we have
}

// ... and again whenever the app comes back to the front
AppState.addEventListener('change', (st) => { if (st === 'active') syncShop(); });

const loaded = shopLoaded.then(() => AsyncStorage.getItem(KEY))
  .then((s) => normalizeAvatar(s ? JSON.parse(s) : null))
  .catch(() => normalizeAvatar(null))
  .then((avatar) => {
    current = { avatar, owned: [], tokbux: 0, prices: Object.fromEntries(AVATAR_ITEMS.map((i) => [i.id, i.price])), signedIn: false };
    emit();
    syncShop();
    return syncAvatar();
  });

// paid items this record wears that aren't owned: taken off
function onlyOwned(r: AvatarRecord, owned: string[], prices: Record<string, number>): AvatarRecord {
  let out = r;
  for (const item of AVATAR_ITEMS) if (item.isWorn?.(out) && item.takeOff && (prices[item.id] ?? item.price) > 0
    && !owned.some((id) => id === item.id || id === item.ownedAs)) out = item.takeOff(out);
  return out;
}

// Pull the account's avatar (call again after signing in or out). A first sign-in uploads this phone's avatar.
export async function syncAvatar() {
  try {
    const me = await avatarAccount.me();
    if (me.avatar) {
      set({ avatar: normalizeAvatar(me.avatar), owned: me.owned, tokbux: me.tokbux, prices: me.prices, sales: me.sales, signedIn: true });
      AsyncStorage.setItem(KEY, JSON.stringify(current!.avatar)).catch(() => {});
    } else {
      const avatar = onlyOwned(current!.avatar, me.owned, me.prices);
      set({ avatar, owned: me.owned, tokbux: me.tokbux, prices: me.prices, sales: me.sales, signedIn: true });
      avatarAccount.save(avatar).catch(() => {});
    }
  } catch (e: any) {
    if (e?.status === 401) set({ signedIn: false, owned: [], tokbux: 0 });   // otherwise offline: keep what we have
  }
}

let saveT: ReturnType<typeof setTimeout> | null = null;
export function saveAvatar(r: AvatarRecord) {
  set({ avatar: r });
  AsyncStorage.setItem(KEY, JSON.stringify(r)).catch(() => {});
  if (!current!.signedIn) return;
  if (saveT) clearTimeout(saveT);
  saveT = setTimeout(() => { avatarAccount.save(r).catch(() => syncAvatar()); }, 600);   // refused: take the account's
}

// Spend TokBux on an item, at the price the player was shown (if a sale ended meanwhile, the server says so instead of
// charging more). Resolves to an error message, or null when it's theirs.
export async function buyItem(itemId: string, price?: number): Promise<string | null> {
  if (!current?.signedIn) return 'Sign in to buy items';
  try {
    const me = await avatarAccount.buy(itemId, price);
    set({ owned: me.owned, tokbux: me.tokbux, prices: me.prices, sales: me.sales });
    return null;
  } catch (e: any) {
    if (e?.code === 'NOT_ENOUGH_TOKBUX' || e?.code === 'PRICE_CHANGED') { syncAvatar(); return e.message; }
    return 'Could not buy that. Check your connection and try again.';
  }
}

export const getAvatarAccount = () => current;

// The profile picture is a headshot of the avatar: is it out of date for this look?
let shotFor: string | null = null;
const shotLoaded = AsyncStorage.getItem(SHOT_KEY).then((v) => { shotFor = v; }).catch(() => {});
export async function needsHeadshot(r: AvatarRecord, hasPicture: boolean) {
  await shotLoaded;
  return !!current?.signedIn && (!hasPicture || shotFor !== JSON.stringify(r));
}
// Upload it; resolves to the picture's address (or null)
export async function uploadHeadshot(png: string, r: AvatarRecord): Promise<string | null> {
  try {
    const { avatar } = await avatarAccount.headshot(png);
    shotFor = JSON.stringify(r);
    AsyncStorage.setItem(SHOT_KEY, shotFor).catch(() => {});
    return avatar;
  } catch { return null; }
}

// null until this phone's copy has been read
export function useAvatarAccount(): AvatarAccount | null {
  const [a, setA] = useState(current);
  useEffect(() => {
    listeners.add(setA);
    loaded.then(() => setA(current));
    return () => { listeners.delete(setA); };
  }, []);
  return a;
}

export function useAvatar(): AvatarRecord | null {
  return useAvatarAccount()?.avatar ?? null;
}
