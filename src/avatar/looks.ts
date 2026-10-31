// Saved looks (Me > Customize > Avatars, like Roblox's outfits): a look the player put together and named. Kept on the
// account (backend GET/PUT /api/avatar/looks), so they follow the player to any phone; this phone keeps a copy (shown
// at once) and the pictures (a look picked on another phone gets its picture the first time it's worn here).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { lookKey, type AvatarRecord } from './catalog';
import { avatarAccount } from '../services/api';

export interface SavedLook { id: string; name: string; look: AvatarRecord; picture: string | null }

export const MAX_LOOKS = 24;
const keyOf = (userId: string | null | undefined) => `savedLooks:${userId || 'guest'}`;
const named = (ls: any[]): SavedLook[] => ls.map((l, n) => ({ ...l, name: l.name || `Look ${ls.length - n}`, picture: l.picture ?? null }));

// two looks are the same look when they wear the same things on the same body (the other body's look aside)
export const sameLook = (a: AvatarRecord, b: AvatarRecord) => lookKey(a) === lookKey(b);

export function useSavedLooks(userId: string | null | undefined) {
  const [looks, setLooks] = useState<SavedLook[]>([]);
  const current = useRef<SavedLook[]>([]);
  const keep = (next: SavedLook[]) => { current.current = next; setLooks(next); AsyncStorage.setItem(keyOf(userId), JSON.stringify(next)).catch(() => {}); };
  const upload = (next: SavedLook[]) => {
    if (!userId) return;
    avatarAccount.saveLooks(next.map(({ id, name, look }) => ({ id, name, look }))).catch(() => {});
  };
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(keyOf(userId)).then(async (v) => {
      const here = named(JSON.parse(v || '[]'));
      if (!live) return;
      current.current = here; setLooks(here);
      if (!userId) return;
      // the account's are the looks; this phone adds their pictures. Looks only ever kept on this phone (before
      // the account kept them) go up to it
      const { looks: there } = await avatarAccount.looks();
      if (!live || !Array.isArray(there)) return;
      if (!there.length && here.length) { upload(here); return; }
      const pics = new Map(here.map((l) => [l.id, l.picture]));
      keep(there.map((l: SavedLook) => ({ ...l, picture: pics.get(l.id) ?? null })));
    }).catch(() => {});
    return () => { live = false; };
  }, [userId]);
  const change = (next: SavedLook[]) => { keep(next); upload(next); };
  return {
    looks,
    save: (look: AvatarRecord, name: string, picture: string | null) =>
      change([{ id: String(Date.now()), name, look: { ...look, other: undefined }, picture }, ...current.current].slice(0, MAX_LOOKS)),
    rename: (id: string, name: string) => change(current.current.map((l) => (l.id === id ? { ...l, name } : l))),
    remove: (id: string) => change(current.current.filter((l) => l.id !== id)),
    // the look's picture: taken when it's worn here (one saved on another phone has none until then)
    picture: (id: string, picture: string) => keep(current.current.map((l) => (l.id === id ? { ...l, picture } : l))),
  };
}
