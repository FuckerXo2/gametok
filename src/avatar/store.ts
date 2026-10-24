// The saved avatar record, shared by every screen that shows it.
// Saved on the phone for now; moving it to the player's account is the next step (see games/avatar-editor/BRIEF.md).
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AvatarRecord, normalizeAvatar } from './catalog';

const KEY = 'gametok.avatar.v1';

let current: AvatarRecord | null = null;
const listeners = new Set<(r: AvatarRecord) => void>();
const loaded = AsyncStorage.getItem(KEY)
  .then((s) => { current = normalizeAvatar(s ? JSON.parse(s) : null); })
  .catch(() => { current = normalizeAvatar(null); })
  .then(() => listeners.forEach((l) => l(current!)));

export function saveAvatar(r: AvatarRecord) {
  current = r;
  listeners.forEach((l) => l(r));
  AsyncStorage.setItem(KEY, JSON.stringify(r)).catch(() => {});
}

// null until the saved record has been read
export function useAvatar(): AvatarRecord | null {
  const [r, setR] = useState(current);
  useEffect(() => {
    listeners.add(setR);
    loaded.then(() => setR(current));
    return () => { listeners.delete(setR); };
  }, []);
  return r;
}
