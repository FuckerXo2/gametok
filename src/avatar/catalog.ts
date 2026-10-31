// The player's avatar: a small JSON record (what they wear), and the items that change it.
// The 3D side lives in games/avatar-editor (js/avatar-core.js) and is shown through AvatarStage.
// Item ids match the files there: hair/<Hair_*>.glb, parts/<Set>_<suffix>.glb.
import type { Ionicons } from '@expo/vector-icons';
import { AVATAR_HOST } from './host';

export type Slot = 'head' | 'top' | 'arms' | 'legs' | 'feet' | 'acc';

export interface AvatarRecord {
  body: 'Male' | 'Female';
  skin: number;
  face?: number;                       // 0..5: games/avatar-editor/js/face.js FACES
  height?: number;                     // body size, 1 = default: 0.9..1.1 (head 0.9..1.15)
  width?: number;
  head?: number;
  shapeX?: number;                     // Body Type triangle: -1 curvy .. 1 broad (sets body)
  compact?: number;                    // ... and 0..1 toward its bottom corner (a smaller build)
  hair: string | null;
  character?: string | null;           // a whole character worn instead (characters/<id>.glb); the rest is kept for later
  beard: boolean;
  hairColor: string;
  fit: boolean;
  parts: Record<Slot, string | null>;
  colors: Record<Slot, string>;
  other?: AvatarRecord;                // the look of their other body: male and female each keep their own (switching swaps them)
}

export const DEFAULT_AVATAR: AvatarRecord = {
  body: 'Male', skin: 3, face: 0, hair: 'Hair_Buzzed', beard: false, hairColor: '#5a3420', fit: true,
  parts: { head: null, top: 'Street_TeeWhite', arms: null, legs: 'Street_JeansBlue', feet: 'Street_SneakersWhite', acc: null },
  colors: { head: '#ffffff', top: '#ffffff', arms: '#ffffff', legs: '#ffffff', feet: '#ffffff', acc: '#ffffff' },
};

// the starter look for each body, picked when the account is made (onboarding): boy or girl
export const STARTER_AVATARS: Record<AvatarRecord['body'], AvatarRecord> = {
  Male: DEFAULT_AVATAR,
  Female: { ...DEFAULT_AVATAR, body: 'Female', hair: 'Hair_SimpleParted', parts: { ...DEFAULT_AVATAR.parts }, colors: { ...DEFAULT_AVATAR.colors } },
};

// a look's identity: what it wears on what body, in any field order (the other body's look aside); two looks are the
// same look when these match
export function lookKey(r: AvatarRecord): string {
  const norm = (v: any): any => (Array.isArray(v) ? v.map(norm) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).filter((k) => v[k] !== undefined && v[k] !== null && k !== 'other').sort().map((k) => [k, norm(v[k])])) : v);
  return JSON.stringify(norm(r));
}

export function normalizeAvatar(r: any): AvatarRecord {
  const d = DEFAULT_AVATAR;
  if (!r || typeof r !== 'object') return { ...d, parts: { ...d.parts }, colors: { ...d.colors } };
  return { ...d, ...r, hairColor: nearestHair(r.hairColor), parts: { ...d.parts, ...(r.parts || {}) }, colors: { ...d.colors, ...(r.colors || {}) } };
}

// a hair colour from before they were fixed (any colour went): the nearest one sold now (hair is sold by colour)
export function nearestHair(hex: unknown): string {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return DEFAULT_AVATAR.hairColor;
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  const sold = AVATAR_ITEMS.filter((i) => i.id.startsWith('hair-')).map((i) => i.tint);
  if (!sold.length) return hex;
  return sold.reduce((best, h) => {
    const d = (x: string) => { const [R, G, B] = rgb(x); return (R - r) ** 2 + (G - g) ** 2 + (B - b) ** 2; };
    return d(h) < d(best) ? h : best;
  });
}

export type Category = 'all' | 'body' | 'hair' | 'clothing' | 'shoes' | 'accessories';
export type Focus = 'body' | 'head' | 'torso' | 'legs' | 'feet' | 'lobby';

// Me screen tabs, laid out like Roblox's Marketplace: a tab, then sub-tabs inside it (a sub-tab shows only where it
// has items: the Shop never shows your build, skin or face, they're free). Outfits are whole looks (Roblox's
// Avatars); their pieces are also sold one by one in the other tabs.
export type Tab = 'all' | 'avatars' | 'outfits' | 'body' | 'beards' | 'clothing' | 'accessories';
export const TABS: { id: Tab; label: string; subs: string[] }[] = [
  { id: 'all', label: 'All', subs: [] },
  { id: 'avatars', label: 'Avatars', subs: [] },   // whole characters (a superhero skin)
  { id: 'outfits', label: 'Outfits', subs: [] },   // looks made of the items below
  { id: 'body', label: 'Hair', subs: [] },   // (body shape, face, skin: the Me screen's editors)
  { id: 'beards', label: 'Beards', subs: [] },
  { id: 'clothing', label: 'Clothing', subs: ['Tops', 'T-Shirts', 'Jackets', 'Sweaters', 'Shirts', 'Pants', 'Shorts', 'Skirts', 'Shoes'] },
  { id: 'accessories', label: 'Accessories', subs: ['Hats', 'Shoulders'] },
];

// item pictures, rendered from the 3D files (games/avatar-editor/tools/thumbs.html; faces: tools/faces.html, one
// per build, shown on the wearer's)
export const thumbOf = (item: AvatarItem, body: AvatarRecord['body'] = 'Male') =>
  item.id.startsWith('skin-') ? null : `${AVATAR_HOST}/assets/thumbs/${item.id}${item.id.startsWith('face-') ? `-${body}` : ''}.webp${item.pic ? `?v=${item.pic}` : ''}`;

export interface AvatarItem {
  id: string;
  name: string;
  category: Exclude<Category, 'all'>;
  price: number;                       // Toks; 0 = starter item, everyone owns it
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;                        // thumbnail colour until we render real item thumbnails
  focus: Focus;
  wear?: (r: AvatarRecord) => AvatarRecord;
  isWorn?: (r: AvatarRecord) => boolean;
  takeOff?: (r: AvatarRecord) => AvatarRecord;
  tab: Exclude<Tab, 'all'>;
  sub: string;
  pieces?: string[];                   // an outfit: the item ids it's made of (wearing it puts on all of them)
  whole?: boolean;                     // shown on the whole avatar (an outfit, a character), not on its own
  pic?: number;                        // its picture's version (a new picture shows at once; phones keep them a day)
  ownedAs?: string;                    // also owned by whoever bought this older id (a hair from before colours: every colour of it)
  for?: AvatarRecord['body'];          // made for this body: shown only to avatars of it (none: for everyone)
  retired?: boolean;                   // not sold any more: shown only to whoever owns it
  alsoTab?: Exclude<Tab, 'all'>;       // shown under a second tab too (a floor-length cloak: Jackets and Outfits)
}

// an item made for the other body is left out of the Shop and Customize
export const fitsBody = (i: AvatarItem, body?: AvatarRecord['body']) => !i.for || !body || i.for === body;

const SKIN_SWATCHES = ['#f2cfb3', '#dcae8a', '#b98258', '#8a5536', '#6a3e26', '#46281a'];
const SKIN_NAMES = ['Fair', 'Light', 'Tan', 'Brown', 'Dark', 'Deep'];
const FACE_NAMES = ['Classic', 'Strong', 'Slim', 'Round', 'Sharp', 'Soft'];   // js/face.js FACES, in order
export const COLOR_SWATCHES = ['#ffffff', '#2b2b33', '#e9e4da', '#d8344a', '#ff8a2b', '#ffd23f', '#2fd38a', '#3fd0ff', '#3f5bff', '#b04cff', '#ff5fb7'];

const withPart = (r: AvatarRecord, slot: Slot, set: string | null): AvatarRecord => ({ ...r, parts: { ...r.parts, [slot]: set } });

// The Shop's items come from the server (backend src/avatar-items.js, GET /api/avatar/items), so new ones need no
// app update. An item is data; what wearing it does comes from its kind (see that file). SHOP_FALLBACK: a copy of the
// list, shown until the server has answered once (then this phone keeps the last answer, avatar/store.ts).
// Refresh it now and then:  curl -s <API_URL>/avatar/items > gametok/src/avatar/shop-fallback.json
export interface ShopItem {
  id: string; name: string; price: number; kind: 'part' | 'hair' | 'beard' | 'outfit' | 'character';
  tab: Exclude<Tab, 'all'>; sub: string; category: AvatarItem['category']; focus: Focus;
  slot?: Slot; set?: string; clears?: Slot[]; plain?: boolean;   // part
  hair?: string; hairColor?: string;                             // hair
  parts?: Partial<Record<Slot, string>>;                         // outfit
  character?: string;                                            // character
  ownedAs?: string;
  pic?: number;
  for?: 'male' | 'female';
  retired?: boolean; alsoTab?: Exclude<Tab, 'all'>;
}
const ICONS: Record<string, AvatarItem['icon']> = { character: 'person-outline', hair: 'cut-outline', beard: 'man-outline', outfit: 'body-outline', top: 'shirt-outline',
  arms: 'hand-left-outline', legs: 'walk-outline', feet: 'footsteps-outline', head: 'person-circle-outline', acc: 'shield-outline' };
const SLOT_NAMES: Slot[] = ['head', 'top', 'arms', 'legs', 'feet', 'acc'];
const WHITE = { top: '#ffffff', arms: '#ffffff', legs: '#ffffff', feet: '#ffffff' };

// what wearing it does; null: an item this app doesn't understand (a newer kind): left out of the Shop
function toItem(d: ShopItem): AvatarItem | null {
  if (!d || typeof d.id !== 'string' || typeof d.price !== 'number' || !TABS.some((t) => t.id === d.tab)) return null;
  // who it's for: as the server says, else by its set's name (the original outfits: Male_Peasant, Female_Ranger, ...)
  const named = [d.set, ...Object.values(d.parts ?? {})].find((n) => /^(Male|Female)_/.test(n ?? ''));
  const forBody: AvatarRecord['body'] | undefined = d.for === 'female' ? 'Female' : d.for === 'male' ? 'Male' : named ? (named.startsWith('Female_') ? 'Female' : 'Male') : d.kind === 'beard' ? 'Male' : undefined;
  const base = { id: d.id, name: d.name, price: d.price, category: d.category, focus: d.focus, tab: d.tab, sub: d.sub, ownedAs: d.ownedAs, pic: d.pic, for: forBody, retired: d.retired, alsoTab: d.alsoTab,
    tint: d.hairColor ?? '#e2e8f0', icon: ICONS[d.kind === 'part' ? d.slot! : d.kind] ?? 'pricetag-outline' };
  if (d.kind === 'character' && d.character) {
    const { character } = d;
    return { ...base, whole: true, wear: (r) => ({ ...r, character }), isWorn: (r) => r.character === character, takeOff: (r) => ({ ...r, character: null }) };
  }
  // (putting on anything of your own takes a character off, so you see it)
  if (d.kind === 'hair' && d.hair && d.hairColor) {
    const { hair, hairColor } = d;
    return { ...base, wear: (r) => ({ ...r, character: null, hair, hairColor }), isWorn: (r) => r.hair === hair && r.hairColor === hairColor, takeOff: (r) => ({ ...r, hair: null }) };
  }
  if (d.kind === 'beard') return { ...base, wear: (r) => ({ ...r, character: null, beard: true }), isWorn: (r) => r.beard, takeOff: (r) => ({ ...r, beard: false }) };
  if (d.kind === 'part' && d.slot && SLOT_NAMES.includes(d.slot) && d.set) {
    const { slot, set } = d, clear = Object.fromEntries((d.clears ?? []).map((k) => [k, null]));
    return { ...base,
      wear: (r) => ({ ...r, character: null, parts: { ...r.parts, [slot]: set, ...clear }, colors: d.plain ? { ...r.colors, [slot]: '#ffffff' } : r.colors }),
      isWorn: (r) => r.parts[slot] === set, takeOff: (r) => withPart(r, slot, null) };
  }
  if (d.kind === 'outfit' && d.parts) {
    const parts = d.parts;
    return { ...base, whole: true, pieces: Object.entries(parts).map(([slot, set]) => `${set}-${slot}`),
      wear: (r) => ({ ...r, character: null, parts: { ...r.parts, top: null, arms: null, legs: null, feet: null, ...parts }, colors: { ...r.colors, ...WHITE } }),
      isWorn: (r) => Object.entries(parts).every(([slot, set]) => r.parts[slot as Slot] === set) };
  }
  return null;
}

// what everyone has, edited on the Me screen (not sold): builds, skin tones, faces
const BODY_ITEMS: AvatarItem[] = [
  ...(['Male', 'Female'] as const).map((b): AvatarItem => ({
    id: `body-${b}`, name: b === 'Male' ? 'Broad' : 'Curvy', category: 'body', price: 0,
    icon: 'body-outline', tint: '#cbd5e1', focus: 'body', tab: 'body', sub: 'Build',
    wear: (r) => ({ ...r, body: b }), isWorn: (r) => r.body === b,
  })),
  ...SKIN_SWATCHES.map((c, i): AvatarItem => ({
    id: `skin-${i}`, name: SKIN_NAMES[i], category: 'body', price: 0,
    icon: 'ellipse', tint: c, focus: 'head', tab: 'body', sub: 'Skin',
    wear: (r) => ({ ...r, skin: i }), isWorn: (r) => r.skin === i,
  })),
  ...FACE_NAMES.map((name, i): AvatarItem => ({
    id: `face-${i}`, name, category: 'body', price: 0,
    icon: 'happy-outline', tint: '#e2e8f0', focus: 'head', tab: 'body', sub: 'Face',
    wear: (r) => ({ ...r, face: i }), isWorn: (r) => (r.face ?? 0) === i,
  })),
];

// every item: one array, changed in place when the Shop's list arrives (setShop), so its importers see the new one
export const AVATAR_ITEMS: AvatarItem[] = [];
export function setShop(list: ShopItem[]) {
  const shop = (Array.isArray(list) ? list : []).map(toItem).filter((i): i is AvatarItem => !!i);
  if (!shop.length) return false;
  AVATAR_ITEMS.splice(0, AVATAR_ITEMS.length, ...BODY_ITEMS, ...shop);
  return true;
}
setShop(require('./shop-fallback.json').items);
