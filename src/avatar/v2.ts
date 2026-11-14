// Avatar v2 (Synty Sidekick) in the app, behind a DEVELOPMENT-ONLY switch while the rest of GameTok still runs on v1.
//
// The app keeps its v1 record (what the server stores and the games read) and carries the v2-only choices beside it in
// `sk` (head, hairstyle, what's worn, item colours). The stage gets toStage(record): a v2 record built from `sk` plus the
// v1 fields that mean the same thing (body = feminine, skin tone, hair colour, the body-type pad = heavy / muscle).
// Heroes (record.character) still go to the stage as v1. The v2 items come from games/avatar-editor's
// assets/sidekick/catalog.json (tools/sidekick_catalog.py), served beside the stage.
// Server: the backend keeps `sk` (gametok-backend cleanAvatar, since 2026-11-13); store.ts also keeps a local copy.
import { AVATAR_HOST } from './host';
import type { AvatarRecord, AvatarItem } from './catalog';

export const AVATAR_V2 = true;
// published: v2/ beside v1/ on R2 (games/avatar-editor/tools/publish_stage.mjs --v2); on the Mac: the folder itself
const V2_HOST = AVATAR_HOST.startsWith('https:') ? `${AVATAR_HOST}/v2` : AVATAR_HOST;

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
    v: 2, head: s.head, hair: s.hair, brows: s.brows, nose: s.nose, ears: s.ears, facial: s.facial,
    skin: V2_TONES[TONE_OF_V1[r.skin] ?? 3], hairColor: (r.hairColor || '#2b1e16').slice(1).toUpperCase(), browColor: '', eyeColor: s.eyeColor,
    body: { fem: r.body === 'Female' ? 100 : 0, size: clamp((width - 1) * 700 - compact * 40, -100, 100), buff: clamp(Math.max(0, shapeX) * 80, 0, 100) },
    height: r.height ?? 1, headScale: r.head ?? 1,
    wear: s.wear, colors: s.colors, expr: 'Neutral',
  };
}

// ---------- the v2 items (fetched once from beside the stage)
interface Colorway { id: string; name: string; channels: Record<string, string> }
interface CatItem { id: string; name: string; kind: Kind; parts: string[]; channels: Record<string, string>; colorways?: Colorway[]; premium?: boolean }
let catalog: { face: Record<string, number>; items: CatItem[]; hairColors?: Record<string, string>; hairNames?: string[] } | null = null;
let loading: Promise<boolean> | null = null;
export const loadV2Catalog = () => (loading ??= fetch(`${V2_HOST}/assets/sidekick/catalog.json?t=${Date.now()}`)
  .then((r) => r.json()).then((c) => { catalog = c; return true; }).catch(() => { loading = null; return false; }));

const PLACE: Record<Kind, Pick<AvatarItem, 'category' | 'tab' | 'sub' | 'focus' | 'icon'>> = {
  top: { category: 'clothing', tab: 'clothing', sub: 'Tops', focus: 'torso', icon: 'shirt-outline' },
  bottom: { category: 'clothing', tab: 'clothing', sub: 'Pants', focus: 'legs', icon: 'walk-outline' },
  shoes: { category: 'shoes', tab: 'clothing', sub: 'Shoes', focus: 'feet', icon: 'footsteps-outline' },
  hands: { category: 'accessories', tab: 'accessories', sub: 'Shoulders', focus: 'torso', icon: 'hand-left-outline' },
  full: { category: 'clothing', tab: 'outfits', sub: '', focus: 'body', icon: 'body-outline' },
};
const NO_WEAR: Record<Kind, null> = { top: null, bottom: null, shoes: null, hands: null, full: null };

// Sold by colour, like v1: one item per colourway of each piece (sk-<id>~<colourway>) and per colour of each hairstyle
// (sk-hair-<n>-<Colour>). No colour picker: putting one on sets the piece and its colours together.
const sameColors = (a: Record<string, string> | undefined, b: Record<string, string>) => !!a && Object.keys(b).every((k) => (a[k] || '').toUpperCase() === b[k].toUpperCase());
export function v2Items(): AvatarItem[] {
  if (!catalog) return [];
  const pieces = catalog.items.flatMap((it) => {
    const k = it.kind, ways = it.colorways?.length ? it.colorways : [{ id: 'default', name: '', channels: it.channels }];
    return ways.map((cw, n): AvatarItem => ({
      id: `sk-${it.id}~${cw.id}`, name: ways.length > 1 ? `${it.name} · ${cw.name}` : it.name, price: 0, tint: `#${Object.values(cw.channels)[0] ?? 'e2e8f0'}`, ...PLACE[k],
      ...(k === 'full' ? { whole: true } : {}),
      wear: (r) => {
        const s = skOf(r);
        return withSk(r, { wear: k === 'full' ? { ...NO_WEAR, full: it.id } : { ...s.wear, full: null, [k]: it.id }, colors: { ...s.colors, [it.id]: cw.channels } });
      },
      // worn: this piece in these colours (an old look without its colours saved wears the first colourway)
      isWorn: (r) => { const s = skOf(r); return !r.character && s.wear[k] === it.id && (sameColors(s.colors[it.id], cw.channels) || (!s.colors[it.id] && n === 0)); },
      takeOff: (r) => withSk(r, { wear: { ...skOf(r).wear, [k]: null } }),
    }));
  });
  const colours = Object.entries(catalog.hairColors ?? { Brown: '5A3420' });
  const hairs = Array.from({ length: catalog.face.hair ?? 0 }, (_, i) => colours.map(([cname, hex]): AvatarItem => ({
    id: `sk-hair-${i + 1}-${cname}`, name: `${catalog!.hairNames?.[i] ?? `Hairstyle ${i + 1}`} · ${cname.replace(/([a-z])([A-Z])/g, '$1 $2')}`, price: 0, tint: `#${hex}`,
    category: 'hair', tab: 'body', sub: 'Hair', focus: 'head', icon: 'cut-outline',
    wear: (r) => ({ ...withSk(r, { hair: i + 1 }), hairColor: `#${hex.toLowerCase()}` }),
    isWorn: (r) => !r.character && skOf(r).hair === i + 1 && (r.hairColor || '').toLowerCase() === `#${hex.toLowerCase()}`,
    takeOff: (r) => withSk(r, { hair: 0 }),
  }))).flat();
  return [...pieces, ...hairs];
}
// the Face editor: v2 heads, noses, ears and brows instead of v1's six face shapes (all free; one of each is always on)
const FACE_PARTS: [keyof SkLook & ('head' | 'nose' | 'ears' | 'brows'), string][] = [['head', 'Head'], ['nose', 'Nose'], ['ears', 'Ears'], ['brows', 'Brows']];
// each has its own slot in Customize > Body (ProfileScreen V2_FACE_SLOTS); heads keep v1's 'Face'
export const FACE_SUB = { head: 'Face', nose: 'Nose', ears: 'Ears', brows: 'Brows' } as const;
export function v2Faces(): AvatarItem[] {
  return FACE_PARTS.flatMap(([k, label]) => Array.from({ length: catalog?.face[k] ?? (k === 'head' ? 2 : 0) }, (_, i): AvatarItem => ({
    id: `sk-${k}-${i + 1}`, name: `${label} ${i + 1}`, price: 0, tint: '#e2e8f0', category: 'body', tab: 'body', sub: FACE_SUB[k], focus: 'head', icon: 'happy-outline',
    wear: (r) => withSk(r, { [k]: i + 1 } as Partial<SkLook>), isWorn: (r) => skOf(r)[k] === i + 1,
  })));
}
// beards: the v2 facial hair styles (male only, like v1's beard), coloured with the hair
export function v2Beards(): AvatarItem[] {
  return Array.from({ length: catalog?.face.facial ?? 0 }, (_, i): AvatarItem => ({
    id: `sk-beard-${i + 1}`, name: `Beard ${i + 1}`, price: 0, tint: '#e2e8f0', category: 'hair', tab: 'beards', sub: 'Beards', focus: 'head', icon: 'man-outline', for: 'Male',
    wear: (r) => withSk(r, { facial: i + 1 }), isWorn: (r) => !r.character && skOf(r).facial === i + 1, takeOff: (r) => withSk(r, { facial: 0 }),
  }));
}
// item pictures: rendered per v2 item (games/avatar-editor/tools/sk_thumbs.py)
export const v2Thumb = (id: string) => `${V2_HOST}/assets/sidekick/thumbs/${id}.webp`;
