// The player's avatar: a small JSON record (what they wear), and the items that change it.
// The 3D side lives in games/avatar-editor (js/avatar-core.js) and is shown through AvatarStage.
// Item ids match the files there: hair/<Hair_*>.glb, parts/<Set>_<suffix>.glb.
import type { Ionicons } from '@expo/vector-icons';
import { AVATAR_HOST } from './host';

export type Slot = 'head' | 'top' | 'arms' | 'legs' | 'feet' | 'acc';

export interface AvatarRecord {
  body: 'Male' | 'Female';
  skin: number;
  hair: string | null;
  beard: boolean;
  hairColor: string;
  fit: boolean;
  parts: Record<Slot, string | null>;
  colors: Record<Slot, string>;
}

export const DEFAULT_AVATAR: AvatarRecord = {
  body: 'Male', skin: 3, hair: 'Hair_Buzzed', beard: false, hairColor: '#2a1a12', fit: true,
  parts: { head: null, top: 'Male_Ranger', arms: 'Male_Ranger', legs: 'Male_Ranger', feet: 'Male_Ranger', acc: null },
  colors: { head: '#ffffff', top: '#ffffff', arms: '#ffffff', legs: '#ffffff', feet: '#ffffff', acc: '#ffffff' },
};

export function normalizeAvatar(r: any): AvatarRecord {
  const d = DEFAULT_AVATAR;
  if (!r || typeof r !== 'object') return { ...d, parts: { ...d.parts }, colors: { ...d.colors } };
  return { ...d, ...r, parts: { ...d.parts, ...(r.parts || {}) }, colors: { ...d.colors, ...(r.colors || {}) } };
}

export type Category = 'all' | 'body' | 'hair' | 'clothing' | 'shoes' | 'accessories';
export type Focus = 'body' | 'head' | 'torso' | 'legs';

// Me screen tabs, like Roblox's: a tab, then sub-tabs inside it
export type Tab = 'all' | 'body' | 'clothing' | 'shoes' | 'extras';
export const TABS: { id: Tab; label: string; subs: string[] }[] = [
  { id: 'all', label: 'All', subs: [] },
  { id: 'body', label: 'Body', subs: ['Body type', 'Skin', 'Hair', 'Beards'] },
  { id: 'clothing', label: 'Clothing', subs: ['Tops', 'Sleeves', 'Pants'] },
  { id: 'shoes', label: 'Shoes', subs: [] },
  { id: 'extras', label: 'Extras', subs: ['Hoods', 'Pauldrons'] },
];

// item pictures, rendered from the 3D files (games/avatar-editor/tools/thumbs.html), with the avatar stage
export const thumbOf = (item: AvatarItem) => (item.id.startsWith('skin-') ? null : `${AVATAR_HOST}/assets/thumbs/${item.id}.webp`);

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
  colorKey?: Slot | 'hair';            // what the colour swatches recolour
  tab: Exclude<Tab, 'all'>;
  sub: string;
}

const SKIN_SWATCHES = ['#f2cfb3', '#dcae8a', '#b98258', '#8a5536', '#6a3e26', '#46281a'];
export const COLOR_SWATCHES = ['#ffffff', '#2b2b33', '#e9e4da', '#d8344a', '#ff8a2b', '#ffd23f', '#2fd38a', '#3fd0ff', '#3f5bff', '#b04cff', '#ff5fb7'];
export const HAIR_SWATCHES = ['#2a1a12', '#6b3e1f', '#c98b3c', '#f1d27a', '#e8e8e8', '#d8344a', '#3f7bff', '#9b5cff', '#2fd38a'];

const withPart = (r: AvatarRecord, slot: Slot, set: string | null): AvatarRecord => ({ ...r, parts: { ...r.parts, [slot]: set } });

// Clothing sets: one item per (set, slot). Cage fitting makes every set fit every body.
const SETS: { set: string; name: string; price: number }[] = [
  { set: 'Male_Peasant', name: 'Peasant', price: 0 },
  { set: 'Male_Ranger', name: 'Ranger', price: 0 },
  { set: 'Female_Peasant', name: 'Peasant II', price: 25 },
  { set: 'Female_Ranger', name: 'Ranger II', price: 40 },
];
const PIECES: { slot: Slot; suffix: string; category: AvatarItem['category']; icon: AvatarItem['icon']; focus: Focus; only?: string[]; tab: AvatarItem['tab']; sub: string }[] = [
  { slot: 'top', suffix: 'Top', category: 'clothing', icon: 'shirt-outline', focus: 'torso', tab: 'clothing', sub: 'Tops' },
  { slot: 'arms', suffix: 'Sleeves', category: 'clothing', icon: 'hand-left-outline', focus: 'torso', tab: 'clothing', sub: 'Sleeves' },
  { slot: 'legs', suffix: 'Pants', category: 'clothing', icon: 'walk-outline', focus: 'legs', tab: 'clothing', sub: 'Pants' },
  { slot: 'feet', suffix: 'Boots', category: 'shoes', icon: 'footsteps-outline', focus: 'legs', tab: 'shoes', sub: 'Shoes' },
  { slot: 'head', suffix: 'Hood', category: 'accessories', icon: 'person-circle-outline', focus: 'head', only: ['Male_Ranger', 'Female_Ranger'], tab: 'extras', sub: 'Hoods' },
  { slot: 'acc', suffix: 'Pauldron', category: 'accessories', icon: 'shield-outline', focus: 'torso', only: ['Male_Ranger', 'Female_Ranger'], tab: 'extras', sub: 'Pauldrons' },
];

const HAIRS: { id: string; name: string; price: number }[] = [
  { id: 'Hair_Buzzed', name: 'Buzz Cut', price: 0 },
  { id: 'Hair_BuzzedFemale', name: 'Buzz Fade', price: 15 },
  { id: 'Hair_SimpleParted', name: 'Side Part', price: 20 },
  { id: 'Hair_Long', name: 'Long Hair', price: 35 },
  { id: 'Hair_Buns', name: 'Space Buns', price: 35 },
];

export const AVATAR_ITEMS: AvatarItem[] = [
  ...(['Male', 'Female'] as const).map((b): AvatarItem => ({
    id: `body-${b}`, name: b === 'Male' ? 'Body A' : 'Body B', category: 'body', price: 0,
    icon: 'body-outline', tint: '#cbd5e1', focus: 'body', tab: 'body', sub: 'Body type',
    wear: (r) => ({ ...r, body: b }), isWorn: (r) => r.body === b,
  })),
  ...SKIN_SWATCHES.map((c, i): AvatarItem => ({
    id: `skin-${i}`, name: `Skin ${i + 1}`, category: 'body', price: 0,
    icon: 'ellipse', tint: c, focus: 'head', tab: 'body', sub: 'Skin',
    wear: (r) => ({ ...r, skin: i }), isWorn: (r) => r.skin === i,
  })),
  ...HAIRS.map((h): AvatarItem => ({
    id: `hair-${h.id}`, name: h.name, category: 'hair', price: h.price,
    icon: 'cut-outline', tint: '#e2e8f0', focus: 'head', colorKey: 'hair', tab: 'body', sub: 'Hair',
    wear: (r) => ({ ...r, hair: h.id }), isWorn: (r) => r.hair === h.id, takeOff: (r) => ({ ...r, hair: null }),
  })),
  {
    id: 'beard', name: 'Full Beard', category: 'hair', price: 20,
    icon: 'man-outline', tint: '#e2e8f0', focus: 'head', colorKey: 'hair', tab: 'body', sub: 'Beards',
    wear: (r) => ({ ...r, beard: true }), isWorn: (r) => r.beard, takeOff: (r) => ({ ...r, beard: false }),
  },
  ...SETS.flatMap(({ set, name, price }) => PIECES.filter((p) => !p.only || p.only.includes(set)).map((p): AvatarItem => ({
    id: `${set}-${p.slot}`, name: `${name} ${p.suffix}`, category: p.category, price,
    icon: p.icon, tint: '#e2e8f0', focus: p.focus, colorKey: p.slot, tab: p.tab, sub: p.sub,
    wear: (r) => withPart(r, p.slot, set), isWorn: (r) => r.parts[p.slot] === set, takeOff: (r) => withPart(r, p.slot, null),
  }))),
];
