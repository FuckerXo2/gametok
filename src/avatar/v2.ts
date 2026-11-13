// Avatar v2 (Synty Sidekick) in the app, behind a DEVELOPMENT-ONLY switch while the rest of GameTok still runs on v1.
//
// The app keeps its v1 record (what the server stores and the games read) and carries the v2-only choices beside it in
// `sk` (head, hairstyle, what's worn, item colours). The stage gets toStage(record): a v2 record built from `sk` plus the
// v1 fields that mean the same thing (body = feminine, skin tone, hair colour, the body-type pad = heavy / muscle).
// Heroes (record.character) still go to the stage as v1. The v2 items come from games/avatar-editor's
// assets/sidekick/catalog.json (tools/sidekick_catalog.py), served beside the stage.
// Server: cleanAvatar drops `sk`, so on a phone it is kept locally (avatar/store.ts) until the backend learns v2.
import { AVATAR_HOST } from './host';
import type { AvatarRecord, AvatarItem } from './catalog';

export const AVATAR_V2 = __DEV__ && true;

export type Kind = 'top' | 'bottom' | 'shoes' | 'hands' | 'full';
export interface SkLook {
  head: number; hair: number; brows: number; nose: number; ears: number; facial: number;
  eyeColor: string;
  wear: Record<Kind, string | null>;
  colors: Record<string, Record<string, string>>;
}
export const SK_DEFAULT: SkLook = {
  head: 1, hair: 4, brows: 2, nose: 3, ears: 1, facial: 0, eyeColor: '6B4A2E',
  wear: { top: 'street-tee', bottom: 'street-jeans', shoes: 'street-sneakers', hands: null, full: null },
  colors: {},
};
export const skOf = (r: AvatarRecord): SkLook => {
  const s = (r as any).sk || {};
  return { ...SK_DEFAULT, ...s, wear: { ...SK_DEFAULT.wear, ...(s.wear || {}) }, colors: { ...(s.colors || {}) } };
};
const withSk = (r: AvatarRecord, patch: Partial<SkLook>): AvatarRecord => ({ ...r, character: null, sk: { ...skOf(r), ...patch } } as AvatarRecord);

// v1's six skin swatches -> the nearest of v2's eight tones (js/sidekick-core.js SKIN_TONES)
const V2_TONES = ['F6D3B8', 'E8B48E', 'D09A6E', 'AC7C56', '8A5B3C', '6B4430', '4E3024', '35211A'];
const TONE_OF_V1 = [0, 1, 2, 4, 5, 7];

// what the stage draws
export function toStage(r: AvatarRecord | null): any {
  if (!r || !AVATAR_V2 || r.character) return r;
  const s = skOf(r);
  const width = r.width ?? 1, shapeX = r.shapeX ?? 0, compact = r.compact ?? 0;
  const clamp = (v: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, v)));
  return {
    v: 2, head: s.head, hair: s.hair, brows: s.brows, nose: s.nose, ears: s.ears, facial: r.beard ? Math.max(1, s.facial) : s.facial,
    skin: V2_TONES[TONE_OF_V1[r.skin] ?? 3], hairColor: (r.hairColor || '#2b1e16').slice(1).toUpperCase(), browColor: '', eyeColor: s.eyeColor,
    body: { fem: r.body === 'Female' ? 100 : 0, size: clamp((width - 1) * 700 - compact * 40, -100, 100), buff: clamp(Math.max(0, shapeX) * 80, 0, 100) },
    wear: s.wear, colors: s.colors, expr: 'Neutral',
  };
}

// ---------- the v2 items (fetched once from beside the stage)
interface CatItem { id: string; name: string; kind: Kind; parts: string[]; channels: Record<string, string>; premium?: boolean }
let catalog: { face: Record<string, number>; items: CatItem[] } | null = null;
let loading: Promise<boolean> | null = null;
export const loadV2Catalog = () => (loading ??= fetch(`${AVATAR_HOST}/assets/sidekick/catalog.json?t=${Date.now()}`)
  .then((r) => r.json()).then((c) => { catalog = c; return true; }).catch(() => { loading = null; return false; }));

const PLACE: Record<Kind, Pick<AvatarItem, 'category' | 'tab' | 'sub' | 'focus' | 'icon'>> = {
  top: { category: 'clothing', tab: 'clothing', sub: 'Tops', focus: 'torso', icon: 'shirt-outline' },
  bottom: { category: 'clothing', tab: 'clothing', sub: 'Pants', focus: 'legs', icon: 'walk-outline' },
  shoes: { category: 'shoes', tab: 'clothing', sub: 'Shoes', focus: 'feet', icon: 'footsteps-outline' },
  hands: { category: 'accessories', tab: 'accessories', sub: 'Shoulders', focus: 'torso', icon: 'hand-left-outline' },
  full: { category: 'clothing', tab: 'outfits', sub: '', focus: 'body', icon: 'body-outline' },
};
const NO_WEAR: Record<Kind, null> = { top: null, bottom: null, shoes: null, hands: null, full: null };

export function v2Items(): AvatarItem[] {
  if (!catalog) return [];
  const pieces = catalog.items.map((it): AvatarItem => {
    const k = it.kind, id = `sk-${it.id}`;
    return {
      id, name: it.name, price: 0, tint: `#${Object.values(it.channels)[0] ?? 'e2e8f0'}`, ...PLACE[k],
      ...(k === 'full' ? { whole: true } : {}),
      wear: (r) => withSk(r, { wear: k === 'full' ? { ...NO_WEAR, full: it.id } : { ...skOf(r).wear, full: null, [k]: it.id } }),
      isWorn: (r) => !r.character && skOf(r).wear[k] === it.id,
      takeOff: (r) => withSk(r, { wear: { ...skOf(r).wear, [k]: null } }),
    };
  });
  const hairs = Array.from({ length: catalog.face.hair ?? 0 }, (_, i): AvatarItem => ({
    id: `sk-hair-${i + 1}`, name: `Hairstyle ${i + 1}`, price: 0, tint: '#e2e8f0', category: 'hair', tab: 'body', sub: 'Hair', focus: 'head', icon: 'cut-outline',
    wear: (r) => withSk(r, { hair: i + 1 }), isWorn: (r) => !r.character && skOf(r).hair === i + 1, takeOff: (r) => withSk(r, { hair: 0 }),
  }));
  return [...pieces, ...hairs];
}
// the Face editor: v2 heads instead of v1's six face shapes
export function v2Faces(): AvatarItem[] {
  const n = catalog?.face.head ?? 2;
  return Array.from({ length: n }, (_, i): AvatarItem => ({
    id: `sk-head-${i + 1}`, name: `Head ${i + 1}`, price: 0, tint: '#e2e8f0', category: 'body', tab: 'body', sub: 'Face', focus: 'head', icon: 'happy-outline',
    wear: (r) => withSk(r, { head: i + 1 }), isWorn: (r) => skOf(r).head === i + 1,
  }));
}
// item pictures: rendered per v2 item (games/avatar-editor/tools/sk_thumbs.py)
export const v2Thumb = (id: string) => `${AVATAR_HOST}/assets/sidekick/thumbs/${id}.webp`;
