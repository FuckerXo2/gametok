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
  beard: boolean;
  hairColor: string;
  fit: boolean;
  parts: Record<Slot, string | null>;
  colors: Record<Slot, string>;
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

export function normalizeAvatar(r: any): AvatarRecord {
  const d = DEFAULT_AVATAR;
  if (!r || typeof r !== 'object') return { ...d, parts: { ...d.parts }, colors: { ...d.colors } };
  return { ...d, ...r, hairColor: nearestHair(r.hairColor), parts: { ...d.parts, ...(r.parts || {}) }, colors: { ...d.colors, ...(r.colors || {}) } };
}

// a hair colour from before they were fixed (any colour went): the nearest one sold now
export function nearestHair(hex: unknown): string {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return DEFAULT_AVATAR.hairColor;
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  return HAIR_COLORS.map(([, h]) => h).reduce((best, h) => {
    const d = (x: string) => { const [R, G, B] = rgb(x); return (R - r) ** 2 + (G - g) ** 2 + (B - b) ** 2; };
    return d(h) < d(best) ? h : best;
  });
}

export type Category = 'all' | 'body' | 'hair' | 'clothing' | 'shoes' | 'accessories';
export type Focus = 'body' | 'head' | 'torso' | 'legs' | 'feet' | 'lobby';

// Me screen tabs, laid out like Roblox's Marketplace: a tab, then sub-tabs inside it (a sub-tab shows only where it
// has items: the Shop never shows your build, skin or face, they're free). Outfits are whole looks (Roblox's
// Avatars); their pieces are also sold one by one in the other tabs.
export type Tab = 'all' | 'outfits' | 'body' | 'clothing' | 'accessories';
export const TABS: { id: Tab; label: string; subs: string[] }[] = [
  { id: 'all', label: 'All', subs: [] },
  { id: 'outfits', label: 'Outfits', subs: [] },
  { id: 'body', label: 'Hair', subs: ['Hair', 'Beards'] },   // (body shape, face, skin: the Me screen's editors)
  { id: 'clothing', label: 'Clothing', subs: ['T-Shirts', 'Sweaters', 'Shirts', 'Pants', 'Shorts', 'Shoes'] },
  { id: 'accessories', label: 'Accessories', subs: ['Hats', 'Shoulders'] },
];

// item pictures, rendered from the 3D files (games/avatar-editor/tools/thumbs.html; faces: tools/faces.html, one
// per build, shown on the wearer's)
export const thumbOf = (item: AvatarItem, body: AvatarRecord['body'] = 'Male') =>
  item.id.startsWith('skin-') ? null : `${AVATAR_HOST}/assets/thumbs/${item.id}${item.id.startsWith('face-') ? `-${body}` : ''}.webp`;

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
  ownedAs?: string;                    // also owned by whoever bought this older id (a hair from before colours: every colour of it)
}

const SKIN_SWATCHES = ['#f2cfb3', '#dcae8a', '#b98258', '#8a5536', '#6a3e26', '#46281a'];
const SKIN_NAMES = ['Fair', 'Light', 'Tan', 'Brown', 'Dark', 'Deep'];
const FACE_NAMES = ['Classic', 'Strong', 'Slim', 'Round', 'Sharp', 'Soft'];   // js/face.js FACES, in order
export const COLOR_SWATCHES = ['#ffffff', '#2b2b33', '#e9e4da', '#d8344a', '#ff8a2b', '#ffd23f', '#2fd38a', '#3fd0ff', '#3f5bff', '#b04cff', '#ff5fb7'];
// Hair is sold by colour, like Roblox: each style in each colour is its own item, and there's no recolouring it.
// Beards and brows take the hair's colour. (Same list in gametok-backend/src/avatar-router.js HAIR_COLORS.)
export const HAIR_COLORS: [string, string][] = [['Black', '#141110'], ['Brown', '#5a3420'], ['Light Brown', '#9a6634'],
  ['Blonde', '#e0b45e'], ['Ginger', '#b4521f'], ['Red', '#d8344a'], ['Blue', '#3f7bff']];

const withPart = (r: AvatarRecord, slot: Slot, set: string | null): AvatarRecord => ({ ...r, parts: { ...r.parts, [slot]: set } });

// Clothing sets: one item per (set, slot). Cage fitting makes every set fit every body.
const SETS: { set: string; name: string; price: number }[] = [
  { set: 'Male_Peasant', name: 'Peasant', price: 50 },
  { set: 'Male_Ranger', name: 'Ranger', price: 75 },
  { set: 'Female_Peasant', name: 'Peasant II', price: 50 },
  { set: 'Female_Ranger', name: 'Ranger II', price: 75 },
];
const PIECES: { slot: Slot; suffix: string; category: AvatarItem['category']; icon: AvatarItem['icon']; focus: Focus; only?: string[]; tab: AvatarItem['tab']; sub: string }[] = [
  { slot: 'top', suffix: 'Top', category: 'clothing', icon: 'shirt-outline', focus: 'torso', tab: 'clothing', sub: 'Shirts' },
  { slot: 'arms', suffix: 'Sleeves', category: 'clothing', icon: 'hand-left-outline', focus: 'torso', tab: 'clothing', sub: 'Shirts' },
  { slot: 'legs', suffix: 'Pants', category: 'clothing', icon: 'walk-outline', focus: 'legs', tab: 'clothing', sub: 'Pants' },
  { slot: 'feet', suffix: 'Boots', category: 'shoes', icon: 'footsteps-outline', focus: 'feet', tab: 'clothing', sub: 'Shoes' },
  { slot: 'head', suffix: 'Hood', category: 'accessories', icon: 'person-circle-outline', focus: 'head', only: ['Male_Ranger', 'Female_Ranger'], tab: 'accessories', sub: 'Hats' },
  { slot: 'acc', suffix: 'Pauldron', category: 'accessories', icon: 'shield-outline', focus: 'torso', only: ['Male_Ranger', 'Female_Ranger'], tab: 'accessories', sub: 'Shoulders' },
];

const HAIRS: { id: string; name: string; price: number }[] = [
  { id: 'Hair_Buzzed', name: 'Buzz Cut', price: 0 },
  { id: 'Hair_BuzzedFemale', name: 'Buzz Fade', price: 0 },
  { id: 'Hair_SimpleParted', name: 'Side Part', price: 0 },
  { id: 'Hair_Long', name: 'Long Hair', price: 75 },
  { id: 'Hair_Buns', name: 'Space Buns', price: 75 },
];

// Clothing grown from the body (games/avatar-editor/tools/make_clothing.py): one item per garment and colour, like Roblox.
// A top replaces any sleeves (it has its own); colours are baked in, so the slot's tint is reset to white.
// FREE: everyone's starter clothes (the backend's PRICES say the same).
const FREE = ['Street_TeeWhite', 'Street_TeeBlack', 'Street_JeansBlue', 'Street_JeansBlack', 'Street_ShortsKhaki', 'Street_SneakersWhite', 'Street_SneakersBlack'];
const STREET: { set: string; name: string; slot: Slot; price: number; sub: string }[] = [
  ...['White', 'Black', 'Red', 'Green'].map((c) => ({ set: `Street_Tee${c}`, name: `${c} Tee`, slot: 'top' as Slot, price: 50, sub: 'T-Shirts' })),
  ...['Grey', 'Navy', 'Cream'].map((c) => ({ set: `Street_Sweater${c}`, name: `${c} Sweater`, slot: 'top' as Slot, price: 75, sub: 'Sweaters' })),
  ...['Blue', 'Black'].map((c) => ({ set: `Street_Jeans${c}`, name: `${c} Jeans`, slot: 'legs' as Slot, price: 75, sub: 'Pants' })),
  ...['Khaki', 'Black'].map((c) => ({ set: `Street_Shorts${c}`, name: `${c} Shorts`, slot: 'legs' as Slot, price: 40, sub: 'Shorts' })),
  ...['White', 'Black', 'Red'].map((c) => ({ set: `Street_Sneakers${c}`, name: `${c} Sneakers`, slot: 'feet' as Slot, price: 60, sub: 'Shoes' })),
].map((c) => (FREE.includes(c.set) ? { ...c, price: 0 } : c));

// Outfits (Roblox's "Avatars"): whole looks. Wearing one replaces the clothes; unowned pieces go in the checkout.
// Pictures: games/avatar-editor/tools/thumbs.html (its OUTFITS: keep the two lists the same).
const OUTFITS: { id: string; name: string; parts: Partial<Record<Slot, string>> }[] = [
  { id: 'StreetClassic', name: 'Street Classic', parts: { top: 'Street_TeeWhite', legs: 'Street_JeansBlue', feet: 'Street_SneakersWhite' } },
  { id: 'AllBlack', name: 'All Black', parts: { top: 'Street_TeeBlack', legs: 'Street_JeansBlack', feet: 'Street_SneakersBlack' } },
  { id: 'Summer', name: 'Summer', parts: { top: 'Street_TeeRed', legs: 'Street_ShortsKhaki', feet: 'Street_SneakersRed' } },
  { id: 'Cozy', name: 'Cozy', parts: { top: 'Street_SweaterCream', legs: 'Street_JeansBlue', feet: 'Street_SneakersWhite' } },
  { id: 'NightOut', name: 'Night Out', parts: { top: 'Street_SweaterNavy', legs: 'Street_JeansBlack', feet: 'Street_SneakersBlack' } },
  ...SETS.map(({ set, name }) => ({ id: set.replace('_', ''), name, parts: { top: set, arms: set, legs: set, feet: set } })),
];

export const AVATAR_ITEMS: AvatarItem[] = [
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
  ...HAIRS.flatMap((h) => HAIR_COLORS.map(([colour, hex]): AvatarItem => ({
    id: `hair-${h.id}-${colour.replace(' ', '')}`, name: `${colour} ${h.name}`, category: 'hair', price: h.price, ownedAs: `hair-${h.id}`,
    icon: 'cut-outline', tint: hex, focus: 'head', tab: 'body', sub: 'Hair',
    wear: (r) => ({ ...r, hair: h.id, hairColor: hex }), isWorn: (r) => r.hair === h.id && r.hairColor === hex, takeOff: (r) => ({ ...r, hair: null }),
  }))),
  {
    id: 'beard', name: 'Full Beard', category: 'hair', price: 40,
    icon: 'man-outline', tint: '#e2e8f0', focus: 'head', tab: 'body', sub: 'Beards',
    wear: (r) => ({ ...r, beard: true }), isWorn: (r) => r.beard, takeOff: (r) => ({ ...r, beard: false }),
  },
  // street clothes first: they're what most people wear; the fantasy sets after
  ...STREET.map((c): AvatarItem => ({
    id: `${c.set}-${c.slot}`, name: c.name, category: c.slot === 'feet' ? 'shoes' : 'clothing', price: c.price,
    icon: c.slot === 'top' ? 'shirt-outline' : c.slot === 'feet' ? 'footsteps-outline' : 'walk-outline', tint: '#e2e8f0', focus: c.slot === 'top' ? 'torso' : c.slot === 'feet' ? 'feet' : 'legs',
    tab: 'clothing', sub: c.sub,
    wear: (r) => ({ ...r, parts: { ...r.parts, [c.slot]: c.set, ...(c.slot === 'top' ? { arms: null } : {}) }, colors: { ...r.colors, [c.slot]: '#ffffff' } }),
    isWorn: (r) => r.parts[c.slot] === c.set, takeOff: (r) => withPart(r, c.slot, null),
  })),
  ...SETS.flatMap(({ set, name, price }) => PIECES.filter((p) => !p.only || p.only.includes(set)).map((p): AvatarItem => ({
    id: `${set}-${p.slot}`, name: `${name} ${p.suffix}`, category: p.category, price,
    icon: p.icon, tint: '#e2e8f0', focus: p.focus, tab: p.tab, sub: p.sub,
    wear: (r) => withPart(r, p.slot, set), isWorn: (r) => r.parts[p.slot] === set, takeOff: (r) => withPart(r, p.slot, null),
  }))),
  // outfits last: they're made of the items above
  ...OUTFITS.map((o): AvatarItem => ({
    id: `outfit-${o.id}`, name: o.name, category: 'clothing', price: 0,   // (its price: its pieces', see outfitPrice)
    icon: 'body-outline', tint: '#e2e8f0', focus: 'body', tab: 'outfits', sub: '',
    pieces: Object.entries(o.parts).map(([slot, set]) => `${set}-${slot}`),
    wear: (r) => ({ ...r, parts: { ...r.parts, top: null, arms: null, legs: null, feet: null, ...o.parts },
                    colors: { ...r.colors, top: '#ffffff', arms: '#ffffff', legs: '#ffffff', feet: '#ffffff' } }),
    isWorn: (r) => Object.entries(o.parts).every(([slot, set]) => r.parts[slot as Slot] === set),
  })),
];
