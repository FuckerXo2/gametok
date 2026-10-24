// The player's avatar, owned items and TokBux, shared by every screen that shows them.
// Signed in: the GameTok account is the truth (backend src/avatar-router.js); this phone keeps a copy so the
// avatar shows at once and offline. Signed out: the avatar lives on this phone only, and only free items.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { avatarAccount } from '../services/api';
import { AVATAR_ITEMS, AvatarRecord, normalizeAvatar } from './catalog';

const KEY = 'gametok.avatar.v1';
const SHOT_KEY = 'gametok.avatar.headshotFor';   // the look the profile picture was last made from

export interface AvatarAccount {
  avatar: AvatarRecord;
  owned: string[];
  tokbux: number;
  prices: Record<string, number>;     // the server's; the app's catalog prices until it has answered
  signedIn: boolean;
}

let current: AvatarAccount | null = null;
const listeners = new Set<(a: AvatarAccount) => void>();
const emit = () => listeners.forEach((l) => l(current!));
const set = (patch: Partial<AvatarAccount>) => { current = { ...current!, ...patch }; emit(); };

const loaded = AsyncStorage.getItem(KEY)
  .then((s) => normalizeAvatar(s ? JSON.parse(s) : null))
  .catch(() => normalizeAvatar(null))
  .then((avatar) => {
    current = { avatar, owned: [], tokbux: 0, prices: Object.fromEntries(AVATAR_ITEMS.map((i) => [i.id, i.price])), signedIn: false };
    emit();
    return syncAvatar();
  });

// paid items this record wears that aren't owned: taken off
function onlyOwned(r: AvatarRecord, owned: string[], prices: Record<string, number>): AvatarRecord {
  let out = r;
  for (const item of AVATAR_ITEMS) if (item.isWorn?.(out) && item.takeOff && (prices[item.id] ?? item.price) > 0 && !owned.includes(item.id)) out = item.takeOff(out);
  return out;
}

// Pull the account's avatar (call again after signing in or out). A first sign-in uploads this phone's avatar.
export async function syncAvatar() {
  try {
    const me = await avatarAccount.me();
    if (me.avatar) {
      set({ avatar: normalizeAvatar(me.avatar), owned: me.owned, tokbux: me.tokbux, prices: me.prices, signedIn: true });
      AsyncStorage.setItem(KEY, JSON.stringify(current!.avatar)).catch(() => {});
    } else {
      const avatar = onlyOwned(current!.avatar, me.owned, me.prices);
      set({ avatar, owned: me.owned, tokbux: me.tokbux, prices: me.prices, signedIn: true });
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

// Spend TokBux on an item. Resolves to an error message, or null when it's theirs.
export async function buyItem(itemId: string): Promise<string | null> {
  if (!current?.signedIn) return 'Sign in to buy items';
  try {
    const me = await avatarAccount.buy(itemId);
    set({ owned: me.owned, tokbux: me.tokbux, prices: me.prices });
    return null;
  } catch (e: any) {
    if (e?.code === 'NOT_ENOUGH_TOKBUX') return e.message;
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
