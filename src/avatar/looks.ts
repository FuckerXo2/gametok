// Saved looks (Me > Customize > Avatars, like Roblox's): a look the player put together, with a picture of it, kept
// on this phone per account. Tap one to wear it again.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import type { AvatarRecord } from './catalog';

export interface SavedLook { id: string; look: AvatarRecord; picture: string | null }

const MAX = 24;
const keyOf = (userId: string | null | undefined) => `savedLooks:${userId || 'guest'}`;

export function useSavedLooks(userId: string | null | undefined) {
  const [looks, setLooks] = useState<SavedLook[]>([]);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(keyOf(userId)).then((v) => { if (live) setLooks(JSON.parse(v || '[]')); }).catch(() => {});
    return () => { live = false; };
  }, [userId]);
  const store = (next: SavedLook[]) => { setLooks(next); AsyncStorage.setItem(keyOf(userId), JSON.stringify(next)).catch(() => {}); };
  return {
    looks,
    save: (look: AvatarRecord, picture: string | null) => store([{ id: String(Date.now()), look, picture }, ...looks].slice(0, MAX)),
    remove: (id: string) => store(looks.filter((l) => l.id !== id)),
  };
}
