// Avatar Creator - Data & Assets
// Each avatar is a complete pre-rendered 3D image organized by skin tone and hair style.
// To add more avatars: drop the image in assets/ui/avatars/creator/ and add an entry here.

import { AvatarOption, AvatarCategory, SkinTone } from './types';

// ─── Avatar Images ─────────────────────────────────────────────────────────────
// Default OG avatar
const default_3d = require('../../../assets/ui/avatars/creator/default_3d.webp');

// Light skin tone
const light_curly = require('../../../assets/ui/avatars/creator/light_curly.png');
const light_straight = require('../../../assets/ui/avatars/creator/light_straight.png');
const light_buzz = require('../../../assets/ui/avatars/creator/light_buzz.png');
const light_wavy = require('../../../assets/ui/avatars/creator/light_wavy.png');
const light_ponytail = require('../../../assets/ui/avatars/creator/light_ponytail.png');
const light_spiky = require('../../../assets/ui/avatars/creator/light_spiky.png');

// Medium skin tone
const medium_curly = require('../../../assets/ui/avatars/creator/medium_curly.png');
const medium_braids = require('../../../assets/ui/avatars/creator/medium_braids.png');
const medium_fade = require('../../../assets/ui/avatars/creator/medium_fade.png');
const medium_wavy = require('../../../assets/ui/avatars/creator/medium_wavy.png');
const medium_bun = require('../../../assets/ui/avatars/creator/medium_bun.png');
const medium_short = require('../../../assets/ui/avatars/creator/medium_short.png');

// Medium-dark skin tone
const medDark_afro = require('../../../assets/ui/avatars/creator/medDark_afro.png');
// const medDark_braids = require('../../../assets/ui/avatars/creator/medDark_braids.png');
// const medDark_fade = require('../../../assets/ui/avatars/creator/medDark_fade.png');
// const medDark_locs = require('../../../assets/ui/avatars/creator/medDark_locs.png');
// const medDark_curly = require('../../../assets/ui/avatars/creator/medDark_curly.png');
// const medDark_bob = require('../../../assets/ui/avatars/creator/medDark_bob.png');

// Dark skin tone
// const dark_afro = require('../../../assets/ui/avatars/creator/dark_afro.png');
// const dark_braids = require('../../../assets/ui/avatars/creator/dark_braids.png');
// const dark_buzz = require('../../../assets/ui/avatars/creator/dark_buzz.png');
// const dark_locs = require('../../../assets/ui/avatars/creator/dark_locs.png');
// const dark_fade = require('../../../assets/ui/avatars/creator/dark_fade.png');
// const dark_curly = require('../../../assets/ui/avatars/creator/dark_curly.png');

// Deep skin tone
// const deep_afro = require('../../../assets/ui/avatars/creator/deep_afro.png');
// const deep_braids = require('../../../assets/ui/avatars/creator/deep_braids.png');
// const deep_fade = require('../../../assets/ui/avatars/creator/deep_fade.png');
// const deep_locs = require('../../../assets/ui/avatars/creator/deep_locs.png');
// const deep_buzz = require('../../../assets/ui/avatars/creator/deep_buzz.png');
// const deep_bun = require('../../../assets/ui/avatars/creator/deep_bun.png');

// ─── Avatar Options Registry ───────────────────────────────────────────────────
export const AVATAR_OPTIONS: AvatarOption[] = [
    // Default OG avatar
    { id: 'default_3d', skinTone: 'light', hairStyle: 'buzz', label: 'OG', image: default_3d },

    // Light skin tone
    { id: 'light_curly', skinTone: 'light', hairStyle: 'curly', label: 'Curly', image: light_curly },
    { id: 'light_straight', skinTone: 'light', hairStyle: 'straight', label: 'Straight', image: light_straight },
    { id: 'light_buzz', skinTone: 'light', hairStyle: 'buzz', label: 'Buzz Cut', image: light_buzz },
    { id: 'light_wavy', skinTone: 'light', hairStyle: 'wavy', label: 'Wavy', image: light_wavy },
    { id: 'light_ponytail', skinTone: 'light', hairStyle: 'ponytail', label: 'Ponytail', image: light_ponytail },
    { id: 'light_spiky', skinTone: 'light', hairStyle: 'spiky', label: 'Spiky', image: light_spiky },

    // Medium skin tone
    { id: 'medium_curly', skinTone: 'medium', hairStyle: 'curly', label: 'Curly', image: medium_curly },
    { id: 'medium_braids', skinTone: 'medium', hairStyle: 'braids', label: 'Braids', image: medium_braids },
    { id: 'medium_fade', skinTone: 'medium', hairStyle: 'fade', label: 'Fade', image: medium_fade },
    { id: 'medium_wavy', skinTone: 'medium', hairStyle: 'wavy', label: 'Wavy', image: medium_wavy },
    { id: 'medium_bun', skinTone: 'medium', hairStyle: 'bun', label: 'Bun', image: medium_bun },
    { id: 'medium_short', skinTone: 'medium', hairStyle: 'straight', label: 'Short', image: medium_short },

    // Medium-dark skin tone
    { id: 'medDark_afro', skinTone: 'medium-dark', hairStyle: 'afro', label: 'Afro', image: medDark_afro },
    // { id: 'medDark_braids', skinTone: 'medium-dark', hairStyle: 'braids', label: 'Braids', image: medDark_braids },
    // { id: 'medDark_fade',   skinTone: 'medium-dark', hairStyle: 'fade',   label: 'Fade',   image: medDark_fade },
    // { id: 'medDark_locs',   skinTone: 'medium-dark', hairStyle: 'locs',   label: 'Locs',   image: medDark_locs },
    // { id: 'medDark_curly',  skinTone: 'medium-dark', hairStyle: 'curly',  label: 'Curly',  image: medDark_curly },
    // { id: 'medDark_bob',    skinTone: 'medium-dark', hairStyle: 'bob',    label: 'Bob',    image: medDark_bob },

    // Dark skin tone
    // { id: 'dark_afro',   skinTone: 'dark', hairStyle: 'afro',   label: 'Afro',     image: dark_afro },
    // { id: 'dark_braids', skinTone: 'dark', hairStyle: 'braids', label: 'Braids',   image: dark_braids },
    // { id: 'dark_buzz',   skinTone: 'dark', hairStyle: 'buzz',   label: 'Buzz Cut', image: dark_buzz },
    // { id: 'dark_locs',   skinTone: 'dark', hairStyle: 'locs',   label: 'Locs',     image: dark_locs },
    // { id: 'dark_fade',   skinTone: 'dark', hairStyle: 'fade',   label: 'Fade',     image: dark_fade },
    // { id: 'dark_curly',  skinTone: 'dark', hairStyle: 'curly',  label: 'Curly',    image: dark_curly },

    // Deep skin tone
    // { id: 'deep_afro',   skinTone: 'deep', hairStyle: 'afro',   label: 'Afro',     image: deep_afro },
    // { id: 'deep_braids', skinTone: 'deep', hairStyle: 'braids', label: 'Braids',   image: deep_braids },
    // { id: 'deep_fade',   skinTone: 'deep', hairStyle: 'fade',   label: 'Fade',     image: deep_fade },
    // { id: 'deep_locs',   skinTone: 'deep', hairStyle: 'locs',   label: 'Locs',     image: deep_locs },
    // { id: 'deep_buzz',   skinTone: 'deep', hairStyle: 'buzz',   label: 'Buzz Cut', image: deep_buzz },
    // { id: 'deep_bun',    skinTone: 'deep', hairStyle: 'bun',    label: 'Bun',      image: deep_bun },
];

// ─── Skin Tone Palette ──────────────────────────────────────────────────────────
export const SKIN_TONES: { id: SkinTone; color: string; label: string }[] = [
    { id: 'light', color: '#FDDCB5', label: 'Light' },
    { id: 'medium', color: '#D4A373', label: 'Medium' },
    { id: 'medium-dark', color: '#A0704E', label: 'Medium Dark' },
    { id: 'dark', color: '#6B4226', label: 'Dark' },
    { id: 'deep', color: '#3B2213', label: 'Deep' },
];

// ─── Categories for the Picker ──────────────────────────────────────────────────
export const CATEGORIES: AvatarCategory[] = [
    { id: 'skin', label: 'Skin Tone', icon: 'hand-left-outline' },
    { id: 'style', label: 'Style', icon: 'cut-outline' },
];

// ─── Helper Functions ───────────────────────────────────────────────────────────
export function getAvatarsByTone(skinTone: SkinTone): AvatarOption[] {
    return AVATAR_OPTIONS.filter(a => a.skinTone === skinTone);
}

export function getAvatarById(id: string): AvatarOption | undefined {
    return AVATAR_OPTIONS.find(a => a.id === id);
}

export function getAvailableSkinTones(): SkinTone[] {
    const tones = new Set(AVATAR_OPTIONS.map(a => a.skinTone));
    return SKIN_TONES.filter(t => tones.has(t.id)).map(t => t.id);
}
