// Me: the player's avatar and the avatar shop in one screen (like Roblox's Me tab).
// Tap an item: it goes on the avatar straight away. Owned items are worn and saved; items not owned yet are tried on
// and collect in the cart (in Shop and Customize alike), bought together with TokBux. The avatar button on
// the left (like Roblox's) opens a menu of the parts of the avatar to change, and the profile.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Alert, Dimensions, StyleSheet, Pressable, Image, DeviceEventEmitter, PanResponder, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { StageSlot } from './SharedStage';
import { bodyPicture, bodyPictureOf, stagePicture } from './AvatarStage';
import { EditProfileModal } from './EditProfileModal';
import { openAccountMenu } from './AccountMenu';
import { Avatar, hasHeadshot } from './Avatar';
import { TokBuxIcon } from './TokBuxIcon';
import { TokBuxSheet } from './TokBuxSheet';
import { BuyItemSheet, BuyRequest } from './BuyItemSheet';
import { Ask, ConfirmCard, ItemDetails, ItemOptions, askOrDo, shareItem } from './ItemDetails';
import { AVATAR_ITEMS, AvatarItem, AvatarRecord, Focus, STARTER_AVATARS, TABS, Tab, fitsBody, isStarterLook, thumbOf } from '../avatar/catalog';
import { sameLook, useSavedLooks } from '../avatar/looks';
import { AVATAR_V2 } from '../avatar/v2';
import { buyItem, needsHeadshot, saveAvatar, syncAvatar, syncShop, uploadHeadshot, useAvatarAccount } from '../avatar/store';

const { width: W, height: H } = Dimensions.get('window');
const CELL = Math.floor((W - 16 * 2 - 10 * 2) / 3) - 1;   // three across (floored: a fraction over and the third wraps)
const CARD2 = Math.floor((W - 16 * 2 - 12) / 2) - 1;       // the Shop's front: two big cards a row
// the shop (where you buy) is black and gold like the TokBux coin: warm black sheet, gold selection, metallic gold buy
const GOLD = '#dcb664', GOLD_LINE = 'rgba(220,182,100,0.25)', GOLD_METAL = ['#f5dc9a', '#dcb35f', '#b88a3c'] as const;
const BG = '#0b0c0d', PANEL = '#0c0b09', CARD = '#161519', DIM = 'rgba(255,255,255,0.55)', ACCENT = '#47ab9a', GREEN = '#22c55e';

// what each hero can do (the same in every game, adapted to it: knockout/js/sim.js, street-5s/js/sim.js)
const HERO_POWERS: Record<string, string[]> = {
  webster: ['Web swing', 'Web Pull', 'Web Zip'], bako: ['Demon Rush', 'Demon Rage'], yujin: ['Ogre Stomp', 'Ogre Throw'],
  bulk: ['Giant', 'Thunderclap', 'Hulk Smash'], koku: ['Flight', 'Kamehameha', 'Instant Step'], vegar: ['Flight', 'Final Flash', 'Big Bang'],
  supremo: ['Flight', 'Heat Vision', 'Super Punch'], ironclad: ['Flight', 'Unibeam', 'Micro Missiles'], thorn: ['Flight', 'Thunder Strike', 'Hammer Throw'],
  flare: ['Super speed', 'Speed Surge', 'Phase'], nightbat: ['Glide', 'Batarang', 'Grapple'], ramrod: ['Frag Out', 'M60'], lanthorn: ['Flight', 'Construct Wall', 'Shield'],
};
// the Shop's categories, front and up close
type ShopCat = 'all' | 'avatars' | 'outfits' | 'body' | 'clothing' | 'accessories';
const SHOP_CATS: [ShopCat, string][] = [['all', 'All'], ['avatars', 'Heroes'], ['outfits', 'Outfits'], ['body', 'Hair'], ['clothing', 'Clothes'], ['accessories', 'Accessories']];
const powersOf = (i: AvatarItem) => HERO_POWERS[i.id.replace(/^char-/, '')] ?? [];

// the avatar button's editors (like Roblox's Body Shape / Head / Skin Color screens): each is a screen of its own
const CUSTOMIZE: { label: string; sub: string; icon: React.ComponentProps<typeof Ionicons>['name']; focus: 'body' | 'head' }[] = [
  { label: 'Body Shape', sub: 'Build', icon: 'body-outline', focus: 'body' },
  { label: 'Face', sub: 'Face', icon: 'happy-outline', focus: 'head' },
  { label: 'Skin Color', sub: 'Skin', icon: 'color-palette-outline', focus: 'body' },
];
type Editor = (typeof CUSTOMIZE)[number];

// Customize (like Roblox's): its own tabs, each a row of slots showing what's on; a slot lists what you own for it, then
// shop picks ("You May Also Like"). Build and Skin open their controls right in the sheet.
type CSlot = { id: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; focus: Focus; subs?: string[]; panel?: 'build' | 'skin'; only?: AvatarRecord['body'] };
// v2 (development): the face is parts, each with its own slot (avatar/v2.ts FACE_SUB)
const V2_FACE_SLOTS: CSlot[] = [
  { id: 'nose', label: 'Nose', icon: 'happy-outline', focus: 'head', subs: ['Nose'] },
  { id: 'ears', label: 'Ears', icon: 'ear-outline', focus: 'head', subs: ['Ears'] },
  { id: 'brows', label: 'Brows', icon: 'eye-outline', focus: 'head', subs: ['Brows'] },
];
const CTABS: { id: 'avatars' | 'body' | 'clothing' | 'accessories'; label: string; slots: CSlot[] }[] = [
  { id: 'avatars', label: 'Avatars', slots: [] },
  { id: 'body', label: 'Body', slots: [   // (male or female: switched in Build)
    { id: 'hair', label: 'Hair', icon: 'cut-outline', focus: 'head', subs: ['Hair'] },
    { id: 'beard', label: 'Beard', icon: 'man-outline', focus: 'head', subs: ['Beards'], only: 'Male' },
    { id: 'face', label: AVATAR_V2 ? 'Head' : 'Face', icon: 'happy-outline', focus: 'head', subs: ['Face'] },
    ...(AVATAR_V2 ? V2_FACE_SLOTS : []),
    { id: 'build', label: 'Build', icon: 'resize-outline', focus: 'body', panel: 'build' },
    { id: 'skin', label: 'Skin', icon: 'color-palette-outline', focus: 'body', panel: 'skin' },
  ] },
  { id: 'clothing', label: 'Clothing', slots: [
    { id: 'top', label: 'Top', icon: 'shirt-outline', focus: 'torso', subs: ['T-Shirts', 'Tops', 'Shirts', 'Sweaters', 'Jackets'] },
    { id: 'bottom', label: 'Bottom', icon: 'walk-outline', focus: 'legs', subs: ['Pants', 'Shorts', 'Skirts'] },
    { id: 'shoes', label: 'Shoes', icon: 'footsteps-outline', focus: 'feet', subs: ['Shoes'] },
  ] },
  { id: 'accessories', label: 'Accessories', slots: [
    { id: 'hats', label: 'Head', icon: 'person-circle-outline', focus: 'head', subs: ['Hats'] },
    { id: 'shoulders', label: 'Shoulder', icon: 'shield-outline', focus: 'torso', subs: ['Shoulders'] },
  ] },
];
const EDITOR_SUBS: (string | undefined)[] = ['Build', 'Face', 'Skin', 'Nose', 'Ears', 'Brows'];

type Draft = { look: AvatarRecord; cart: string[] };   // on the stage, and the items in it not owned yet

// Body Type, like Roblox's triangle: it reshapes the body you have (never swaps it): slender top-left, stocky
// top-right, a smaller build at the bottom. The knob's place is the record's shapeX (-1..1 across) and compact (0..1 down).
const TRI_W = W - 120, TRI_H = TRI_W * 0.7;
const corners = { L: { x: 0, y: 0 }, R: { x: TRI_W, y: 0 }, B: { x: TRI_W / 2, y: TRI_H } };
const shapeOf = (r: AvatarRecord) => ({ x: r.shapeX ?? 0, c: r.compact ?? 0 });
function triPoint(x: number, c: number) {
  const wB = c, wR = Math.max(0, (1 - c + x) / 2), wL = Math.max(0, (1 - c - x) / 2);
  return { x: wR * corners.R.x + wL * corners.L.x + wB * corners.B.x, y: wB * corners.B.y };
}
function triShape(px: number, py: number) {   // a point (clamped into the triangle) -> { x, c }
  const c = Math.max(0, Math.min(1, py / TRI_H));
  const half = (TRI_W / 2) * (1 - c), mid = TRI_W / 2;
  const x = half > 0 ? Math.max(-1, Math.min(1, (px - mid) / half)) * (1 - c) : 0;
  return { x: Math.round(x * 100) / 100, c: Math.round(c * 100) / 100 };
}
// One drag on a control: the point under the finger (in the control's own space), at most once a frame while moving,
// and once more when it ends (a drag the system takes over ends there too). Everything drawn inside the control
// takes no touches, so the finger is always measured against the control itself. Only a touch that starts on the
// control's shape (hit) drags; anywhere else the panel scrolls as usual.
function useDrag(point: (x: number, y: number, done: boolean) => void, onGrab?: (on: boolean) => void, hit: (x: number, y: number) => boolean = () => true) {
  const cb = useRef({ point, onGrab, hit }); cb.current = { point, onGrab, hit };
  const st = useRef({ x0: 0, y0: 0, x: 0, y: 0, raf: 0 });
  const end = () => { const t = st.current; cancelAnimationFrame(t.raf); t.raf = 0; cb.current.onGrab?.(false); cb.current.point(t.x, t.y, true); };
  return useRef(PanResponder.create({
    onStartShouldSetPanResponder: (e) => cb.current.hit(e.nativeEvent.locationX, e.nativeEvent.locationY),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const t = st.current; t.x0 = t.x = e.nativeEvent.locationX; t.y0 = t.y = e.nativeEvent.locationY;
      cb.current.onGrab?.(true); cb.current.point(t.x, t.y, false);
    },
    onPanResponderMove: (_, g) => {
      const t = st.current; t.x = t.x0 + g.dx; t.y = t.y0 + g.dy;
      if (!t.raf) t.raf = requestAnimationFrame(() => { t.raf = 0; cb.current.point(t.x, t.y, false); });
    },
    onPanResponderRelease: end,
    onPanResponderTerminate: end,
  })).current;
}

const BodyTriangle: React.FC<{ x: number; c: number; onMove: (x: number, c: number) => void; onDone: (x: number, c: number) => void; onGrab?: (on: boolean) => void }> = ({ x, c, onMove, onDone, onGrab }) => {
  // inside the triangle (a finger's width of slack around it)
  const inTri = (px: number, py: number) => {
    const x = px - 30, y = py - 30, m = 14;
    if (y < -m || y > TRI_H + m) return false;
    const half = (TRI_W / 2) * (1 - Math.max(0, y) / TRI_H);
    return Math.abs(x - TRI_W / 2) <= half + m;
  };
  const pan = useDrag((px, py, done) => { const t = triShape(px - 30, py - 30); (done ? onDone : onMove)(t.x, t.c); }, onGrab, inTri);
  const k = triPoint(x, c);
  return (
    <View style={styles.triBox} {...pan.panHandlers}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={TRI_W + 60} height={TRI_H + 60}>
          <Polygon points={`30,30 ${TRI_W + 30},30 ${TRI_W / 2 + 30},${TRI_H + 30}`} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeLinejoin="round" />
        </Svg>
        <Ionicons name="man" size={24} color="#fff" style={[styles.triIcon, { left: 0, top: 18, transform: [{ scaleX: 0.75 }] }]} />
        <Ionicons name="man" size={26} color="#fff" style={[styles.triIcon, { left: TRI_W + 36, top: 16, transform: [{ scaleX: 1.3 }] }]} />
        <Ionicons name="man" size={18} color="#fff" style={[styles.triIcon, { left: TRI_W / 2 + 21, top: TRI_H + 40 }]} />
        <View style={[styles.triKnob, { left: k.x + 30 - 16, top: k.y + 30 - 16 }]} />
      </View>
    </View>
  );
};

// Body Size, like Roblox's square: across is width (slim left, wide right), up is height (tall top, short bottom)
const PAD = TRI_W * 0.62;
const BodyPad: React.FC<{ width: number; height: number; onMove: (w: number, h: number) => void; onDone: (w: number, h: number) => void; onGrab?: (on: boolean) => void }> = ({ width, height, onMove, onDone, onGrab }) => {
  const f = (v: number) => Math.round((0.9 + 0.2 * Math.max(0, Math.min(1, v / PAD))) * 100) / 100;
  const inPad = (px: number, py: number) => px >= 40 - 14 && px <= 40 + PAD + 14 && py >= 30 - 14 && py <= 30 + PAD + 14;
  const pan = useDrag((px, py, done) => (done ? onDone : onMove)(f(px - 40), f(PAD - (py - 30))), onGrab, inPad);
  const kx = ((width - 0.9) / 0.2) * PAD, ky = PAD - ((height - 0.9) / 0.2) * PAD;
  return (
    <View style={[styles.padBox, { width: PAD + 80, height: PAD + 60 }]} {...pan.panHandlers}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.pad, { left: 40, top: 30, width: PAD, height: PAD }]} />
        <Ionicons name="man" size={18} color="#fff" style={[styles.triIcon, { left: 8, top: 30 + PAD / 2 - 10 }]} />
        <Ionicons name="man" size={28} color="#fff" style={[styles.triIcon, { left: PAD + 46, top: 30 + PAD / 2 - 14, transform: [{ scaleX: 1.35 }] }]} />
        <Ionicons name="man" size={28} color="#fff" style={[styles.triIcon, { left: 40 + PAD / 2 - 14, top: 0 }]} />
        <Ionicons name="man" size={16} color="#fff" style={[styles.triIcon, { left: 40 + PAD / 2 - 8, top: PAD + 38 }]} />
        <View style={[styles.triKnob, { left: 40 + kx - 16, top: 30 + ky - 16 }]} />
      </View>
    </View>
  );
};

// a slider: drag the knob (or tap the track); onMove while dragging, onDone on release
const Slider: React.FC<{ value: number; min: number; max: number; onMove: (v: number) => void; onDone: (v: number) => void; onGrab?: (on: boolean) => void }> = ({ value, min, max, onMove, onDone, onGrab }) => {
  const width = useRef(0);
  const at = (x: number) => Math.round((min + Math.max(0, Math.min(1, x / (width.current || 1))) * (max - min)) * 100) / 100;
  const pan = useDrag((px, _py, done) => (done ? onDone : onMove)(at(px)), onGrab);
  const f = (value - min) / (max - min);
  return (
    <View style={styles.slider} onLayout={(e) => { width.current = e.nativeEvent.layout.width; }} {...pan.panHandlers}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.trackWrap}><View style={styles.track}><View style={[styles.trackOn, { width: `${f * 100}%` }]} /></View></View>
        <View style={[styles.knob, { left: `${f * 100}%` }]} />
      </View>
    </View>
  );
};

// the Shop's front page until the server's order has come (offline): each kind of item in turn, one colour per
// hairstyle, so it's not a long row of one thing
function mixed(list: AvatarItem[]) {
  const groups = new Map<string, AvatarItem[]>(), styles = new Set<string>();
  for (const i of list) {
    if (i.ownedAs) { if (styles.has(i.ownedAs)) continue; styles.add(i.ownedAs); }
    const k = i.pieces ? 'outfits' : i.tab; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(i);
  }
  const out: AvatarItem[] = [], rows = [...groups.values()];
  while (rows.some((r) => r.length)) for (const r of rows) { const i = r.shift(); if (i) out.push(i); }
  return out;
}

export const ProfileScreen: React.FC<{ isActive?: boolean }> = ({ isActive }) => {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { isDark } = useTheme();
  const lt = !isDark;   // light mode: Me and the Shop in light (design/me-mocks/light.html)
  const ink = lt ? '#111827' : '#fff';
  const account = useAvatarAccount();
  const saved = account?.avatar ?? null;

  const [mode, setMode] = useState<'shop' | 'mine'>('shop');
  // the locker (Me's front page): the avatar on the left, what's on as a column of slots on the right, looks and the
  // Shop below. A slot opens Customize on it, the Shop banner the Shop; back comes home here.
  const [locker, setLocker] = useState(true);
  // the Shop opens on its front ('front': the new drop, then heroes, outfits, clothes); a hero opens up close ('hero');
  // anything else is tried on (null: the avatar and the Shop's grid)
  const [store, setStore] = useState<'front' | 'show'>('front');
  const [showCat, setShowCat] = useState<ShopCat>('avatars');   // the category being swiped through up close
  const [showAt, setShowAt] = useState(0);
  const [tab, setTab] = useState<Tab>('all');
  const [sub, setSub] = useState<string | null>(null);
  const [seeAll, setSeeAll] = useState(false);   // came from All's "See All": the heading is a way back
  const [selected, setSelected] = useState<AvatarItem | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [history, setHistory] = useState<{ undo: Draft[]; redo: Draft[] }>({ undo: [], redo: [] });
  const [buying, setBuying] = useState(false);
  const [tokbux, setTokbux] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [customize, setCustomize] = useState(false);   // the avatar button's menu
  const [cartOpen, setCartOpen] = useState(false);   // the checkout, opened from its button
  const [details, setDetails] = useState<AvatarItem | null>(null);   // an item's details page
  const [options, setOptions] = useState<AvatarItem | null>(null);   // an item's "…" options
  const [ask, setAsk] = useState<Ask | null>(null);   // a question (Wear outfit?)
  const bar = useRef<View>(null), [barTop, setBarTop] = useState(0);   // the options card floats just above the bar
  const openOptions = (i: AvatarItem) => bar.current?.measureInWindow((_x, y) => { setBarTop(y); setOptions(i); });
  const [editor, setEditor] = useState<Editor | null>(null);   // one of its editors, open
  const [grab, setGrab] = useState(false);   // a finger on an editor control: the panel doesn't scroll
  const [ctab, setCtab] = useState<(typeof CTABS)[number]['id']>('body');   // Customize's tab
  const [cslot, setCslot] = useState<CSlot>(CTABS[1].slots[0]);   // ... and its slot
  const saved_ = useSavedLooks(user?.id);
  const [naming, setNaming] = useState<{ id: string; name: string } | null>(null);   // renaming a saved look
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const say = (t: string) => { setToast(t); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 2600); };

  // an outfit is its pieces: owned when they all are, and it costs what's still unowned
  const piecesOf = (i: AvatarItem) => (i.pieces ?? []).map((id) => AVATAR_ITEMS.find((x) => x.id === id)!).filter(Boolean);
  const ownsOne = (i: AvatarItem) => (account?.prices[i.id] ?? i.price) === 0 || !!account?.owned.some((id) => id === i.id || id === i.ownedAs);
  const owns = (i: AvatarItem): boolean => (i.pieces ? piecesOf(i).every(ownsOne) : ownsOne(i));
  const priceOf = (i: AvatarItem): number => (i.pieces
    ? piecesOf(i).filter((p) => !ownsOne(p)).reduce((t, p) => t + priceOf(p), 0)
    : account?.prices[i.id] ?? i.price);
  const look = draft?.look ?? saved;
  const cart = draft?.cart ?? [];

  // the account menu's "My items"
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('gametok:my-items', () => { setLocker(false); setMode('mine'); setTab('all'); setSub(null); });
    return () => sub.remove();
  }, []);
  // signing in or out switches whose avatar this is
  useEffect(() => { syncAvatar(); }, [user?.id]);
  // the Shop's items, fresh each time the Me screen opens (new ones show up without restarting the app)
  useEffect(() => { if (isActive) syncShop(); }, [isActive]);
  // a hair made for the other body's head (a man's buzz cut on her: it doesn't sit on her head) gives way to this
  // body's starter hair
  useEffect(() => {
    if (!saved || saved.character) return;
    const hair = AVATAR_ITEMS.find((i) => i.sub === 'Hair' && i.isWorn?.(saved));
    if (hair && !fitsBody(hair, saved.body)) { why.current = 'hair for the other body'; apply({ look: { ...saved, hair: STARTER_AVATARS[saved.body].hair }, cart: [] }); }
  }, [saved, account?.feed]);
  // the saved look changed elsewhere (another phone, a purchase): show it, unless they're mid try-on
  useEffect(() => { if (saved && !draft?.cart.length) setDraft(null); }, [saved]);

  // every change goes on the stage; with nothing unbought in it, it's also saved
  const why = useRef('?');   // what the next save is for (the development log in saveAvatar)
  const apply = (next: Draft) => {
    next = { ...next, cart: next.cart.filter((id) => AVATAR_ITEMS.find((i) => i.id === id)?.isWorn?.(next.look)) };
    setDraft(next);
    if (!next.cart.length) saveAvatar(next.look, why.current);
    why.current = '?';
  };
  const change = (next: Draft) => {
    if (look) setHistory((h) => ({ undo: [...h.undo.slice(-30), { look, cart }], redo: [] }));
    apply(next);
  };
  const undo = () => {
    const prev = history.undo[history.undo.length - 1]; if (!prev || !look) return;
    setHistory((h) => ({ undo: h.undo.slice(0, -1), redo: [...h.redo, { look, cart }] })); why.current = 'undo'; apply(prev);
  };
  const redo = () => {
    const next = history.redo[history.redo.length - 1]; if (!next || !look) return;
    setHistory((h) => ({ undo: [...h.undo, { look, cart }], redo: h.redo.slice(0, -1) })); why.current = 'redo'; apply(next);
  };

  // a size slider: the avatar follows while dragging; on release it's one change (one undo step), saved
  const sizeFrom = useRef<Draft | null>(null);
  const moveSize = (key: 'height' | 'width' | 'head', v: number) => {
    if (!look) return;
    if (!sizeFrom.current) sizeFrom.current = { look, cart };
    setDraft({ look: { ...look, [key]: v }, cart });
  };
  const doneSize = (key: 'height' | 'width' | 'head', v: number) => {
    const from = sizeFrom.current ?? (look ? { look, cart } : null); sizeFrom.current = null;
    if (!from) return;
    setHistory((h) => ({ undo: [...h.undo.slice(-30), from], redo: [] }));
    why.current = `slider ${key}`; apply({ look: { ...from.look, [key]: v }, cart: from.cart });
  };

  // the Body Size square: width and height together
  const movePad = (w: number, h: number) => {
    if (!look) return;
    if (!sizeFrom.current) sizeFrom.current = { look, cart };
    setDraft({ look: { ...look, width: w, height: h }, cart });
  };
  const donePad = (w: number, h: number) => {
    const from = sizeFrom.current ?? (look ? { look, cart } : null); sizeFrom.current = null;
    if (!from) return;
    setHistory((hs) => ({ undo: [...hs.undo.slice(-30), from], redo: [] }));
    why.current = 'body size'; apply({ look: { ...from.look, width: w, height: h }, cart: from.cart });
  };

  // the Body Type triangle: the avatar reshapes while dragging; one change (one undo step) on release
  const moveShape = (x: number, c: number) => {
    if (!look) return;
    if (!sizeFrom.current) sizeFrom.current = { look, cart };
    setDraft({ look: { ...look, shapeX: x, compact: c }, cart });
  };
  const doneShape = (x: number, c: number) => {
    const from = sizeFrom.current ?? (look ? { look, cart } : null); sizeFrom.current = null;
    if (!from) return;
    setHistory((h) => ({ undo: [...h.undo.slice(-30), from], redo: [] }));
    why.current = 'body type'; apply({ look: { ...from.look, shapeX: x, compact: c }, cart: from.cart });
  };

  // taking off something only being tried on puts back what you had there (your own hair, not none)
  const takeOff = (i: AvatarItem, r: AvatarRecord): AvatarRecord => {
    const off = i.takeOff!(r);
    if (!saved || i.isWorn?.(saved)) return off;
    // what it touches: what taking it off changes, and what putting it on changes (a hair's colour too)
    const on = i.wear ? i.wear(saved) : saved;
    const touched = (a: AvatarRecord, b: AvatarRecord) => (k: keyof AvatarRecord) => a[k] !== b[k];
    const back: AvatarRecord = { ...off, parts: { ...off.parts }, colors: { ...off.colors } };
    for (const k of Object.keys(off) as (keyof AvatarRecord)[])
      if (k !== 'parts' && k !== 'colors' && (touched(off, r)(k) || touched(on, saved)(k))) (back as any)[k] = saved[k];
    for (const s of Object.keys(off.parts) as (keyof AvatarRecord['parts'])[])
      if (off.parts[s] !== r.parts[s] || on.parts[s] !== saved.parts[s]) { back.parts[s] = saved.parts[s]; back.colors[s] = saved.colors[s]; }
    return back;
  };

  const tap = (item: AvatarItem) => {
    if (!look) return;
    why.current = `tap ${item.id}`;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(item);
    if (item.isWorn?.(look)) {
      if (item.takeOff) change({ look: takeOff(item, look), cart: cart.filter((id) => id !== item.id) });
      return;
    }
    if (!item.wear) return;
    if (item.pieces) {   // a whole look (Roblox asks first: it replaces what you're wearing)
      const unowned = piecesOf(item).filter((p) => !ownsOne(p)).map((p) => p.id);
      askOrDo({ title: `Wear ${item.name}?`, body: 'It swaps out the clothes you’re wearing. Undo brings them back.',
        image: thumbOf(item, look.body), yes: 'Wear', remember: 'outfit',
        onYes: () => change({ look: item.wear!(look), cart: [...cart.filter((id) => !unowned.includes(id)), ...unowned] }) }, setAsk);
      return;
    }
    change({ look: item.wear(look), cart: owns(item) ? cart : [...cart, item.id] });
  };

  const cartItems = cart.map((id) => AVATAR_ITEMS.find((i) => i.id === id)!).filter(Boolean);
  const total = cartItems.reduce((t, i) => t + priceOf(i), 0);
  // Buy: the popup confirms (and tops up TokBux first when short), then every item in the cart is bought
  const [buyReq, setBuyReq] = useState<BuyRequest | null>(null);
  const checkout = () => {
    if (!look || buying) return;
    if (!account?.signedIn) { Alert.alert('Sign in to buy'); return; }
    const one = cartItems.length === 1 ? cartItems[0] : null;
    buyIds.current = cart;
    setBuyReq({
      name: one ? one.name : `${cartItems.length} items`, price: total, thumb: thumbOf(cartItems[0], look.body),
      buy: async () => {
        setBuying(true);
        for (const item of cartItems) {
          const err = await buyItem(item.id, account?.prices[item.id]);
          if (err) { setBuying(false); return `${item.name}: ${err}`; }
        }
        setBuying(false);
        return null;
      },
    });
  };
  // one item from its details page
  const buyNow = (item: AvatarItem) => {
    if (!look || buying) return;
    if (!account?.signedIn) { Alert.alert('Sign in to buy'); return; }
    buyIds.current = [item.id];
    setBuyReq({ name: item.name, price: priceOf(item), thumb: thumbOf(item, look.body), buy: async () => buyItem(item.id, account?.prices[item.id]) });
  };
  const buyIds = useRef<string[]>([]);   // what the Buy popup is buying
  const onBought = (bought: boolean) => {
    setBuyReq(null);
    if (bought && look) { why.current = 'bought'; } if (bought && look) apply({ look, cart: cart.filter((id) => !buyIds.current.includes(id)) });   // owned now: saved
  };
  // take it off and out of the cart
  const remove = (i: AvatarItem) => { why.current = `remove ${i.id}`; if (look) change({ look: i.takeOff && i.isWorn?.(look) ? takeOff(i, look) : look, cart: cart.filter((id) => id !== i.id) }); };
  const clearCart = () => { if (saved && look) { setHistory((h) => ({ undo: [...h.undo, { look, cart }], redo: [] })); setDraft(null); } };

  // the profile picture is a headshot of the saved look: retake it when the look changes
  const [shotOf, setShotOf] = useState<AvatarRecord | null>(null);
  useEffect(() => {
    if (!saved) return;
    let live = true;
    needsHeadshot(saved, hasHeadshot(user?.avatar)).then((n) => { if (live) setShotOf(n ? saved : null); });
    return () => { live = false; };
  }, [saved, user?.avatar, account?.signedIn]);
  const onHeadshot = (png: string, of: AvatarRecord) => { uploadHeadshot(png, of).then((url) => { if (url) refreshUser(); }); };

  // body shape, face and skin colour aren't items: they're set in the avatar button's editors, not listed here
  // (only what's made for this avatar's body: switching to female switches the Shop to women's things)
  const inMode = useMemo(() => AVATAR_ITEMS.filter((i) => !EDITOR_SUBS.includes(i.sub) && fitsBody(i, look?.body) && (mode === 'shop' ? !owns(i) && !i.retired : owns(i))), [mode, account, look?.body]);
  const tabs = TABS.filter((t) => t.id !== 'beards' || look?.body !== 'Female');
  const tabName = (t: Tab) => (t === 'avatars' ? 'Heroes' : t === 'clothing' ? 'Clothes' : TABS.find((x) => x.id === t)?.label ?? '');
  // All: outfits get their own row at the top (like Roblox's Explore Styles), the grid is single items
  // All: one mixed feed, in the order the server picked for you (it changes; backend src/avatar-feed.js). Until it
  // has answered: everything, as listed
  const feedIndex = useMemo(() => new Map((account?.feed ?? []).map((id, n) => [id, n])), [account?.feed]);
  const items = tab === 'all'
    ? (feedIndex.size ? inMode.filter((i) => feedIndex.has(i.id)).sort((a, b) => feedIndex.get(a.id)! - feedIndex.get(b.id)!) : mixed(inMode))
    : inMode.filter((i) => (i.tab === tab && (!sub || i.sub === sub)) || (i.alsoTab === tab && !sub));
  const subs = (TABS.find((t) => t.id === tab)?.subs ?? []).filter((s) => inMode.some((i) => i.tab === tab && i.sub === s));
  // an editor shows every choice for its part (ones not owned yet go in the checkout, like the shop)
  const edItems = editor ? AVATAR_ITEMS.filter((i) => i.tab === 'body' && i.sub === editor.sub) : [];

  // the Build and Skin controls (Customize > Body, and the avatar button's editors)
  const skinItems = AVATAR_ITEMS.filter((i) => i.sub === 'Skin');
  const skinPanel = () => (
    <View style={styles.swatches}>
      {skinItems.map((i) => (
        <Pressable key={i.id} onPress={() => tap(i)} style={[styles.swatchRing, !!look && i.isWorn?.(look) && styles.swatchOn]}>
          <View style={[styles.swatch, { backgroundColor: i.tint }]} />
        </Pressable>
      ))}
    </View>
  );
  // male <-> female: two characters, each with its own look. The one you leave is kept (as you own it, not what's only
  // being tried on) and the other comes back as you left it. The first time, it starts from this one with that body's
  // starter hair: what's on made only for the other body comes off, and that body's starter piece goes on in its place.
  const switchBody = (body: AvatarRecord['body']) => {
    if (!look) return;
    if (look.body === body) { if (look.character) { why.current = 'my avatar'; change({ look: { ...look, character: null }, cart }); } return; }
    const mine = saved ?? look, me: AvatarRecord = { ...mine, other: undefined };
    why.current = 'body';
    if (mine.other?.body === body) { change({ look: { ...mine.other, character: null, other: me }, cart: [] }); return; }
    let next: AvatarRecord = { ...me, body, character: null, beard: body === 'Male' && me.beard, other: me };
    const off = AVATAR_ITEMS.filter((i) => !fitsBody(i, body) && i.isWorn?.(me) && i.takeOff);
    for (const i of off) next = i.takeOff!(next);
    const start = STARTER_AVATARS[body];
    next = { ...next, hair: start.hair };   // (a man's cut doesn't sit right on her head, nor hers on his)
    if (off.length) for (const k of ['top', 'legs', 'feet'] as const) if (!next.parts[k]) next = { ...next, parts: { ...next.parts, [k]: start.parts[k] }, colors: { ...next.colors, [k]: '#ffffff' } };
    change({ look: next, cart: [] });
  };
  const buildPanel = () => (
    <>
      <Text style={styles.edLabel}>Body</Text>
      <View style={styles.bodyRow}>
        {(['Male', 'Female'] as const).map((b) => (
          <Pressable key={b} onPress={() => switchBody(b)} style={[styles.bodyPill, look?.body === b && styles.bodyPillOn]}>
            <Ionicons name={b === 'Male' ? 'male' : 'female'} size={18} color={look?.body === b ? '#000' : '#fff'} />
            <Text style={[styles.bodyPillText, look?.body === b && { color: '#000' }]}>{b}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.edLabel}>Body Type</Text>
      {look ? <BodyTriangle {...shapeOf(look)} onMove={moveShape} onDone={doneShape} onGrab={setGrab} /> : null}
      <Text style={styles.edLabel}>Body Size</Text>
      {look ? <BodyPad width={look.width ?? 1} height={look.height ?? 1} onMove={movePad} onDone={donePad} onGrab={setGrab} /> : null}
      <Text style={styles.edLabel}>Head Size</Text>
      <View style={{ paddingHorizontal: 18, paddingTop: 4 }}>
        <Slider value={look?.head ?? 1} min={0.9} max={1.15} onMove={(v) => moveSize('head', v)} onDone={(v) => doneSize('head', v)} onGrab={setGrab} />
      </View>
    </>
  );

  // Saved looks keep themselves: what you leave Customize wearing (switching to the Shop, or leaving Me) is saved,
  // if it's a look worth keeping: your own avatar (not a character), all of it owned, not the starter look, not one
  // already saved. The latest 24 are kept; hold one to rename or remove it.
  // (the full-body picture: the one on stage now, if it's this look)
  const lookPicture = (r: AvatarRecord) => bodyPictureOf(r) || stagePicture(r);
  const savedAs = look ? saved_.looks.find((l) => sameLook(l.look, look)) : undefined;
  useEffect(() => {
    const pic = savedAs && look && !look.character ? bodyPictureOf(look) : null;
    if (savedAs && pic && pic !== savedAs.picture) saved_.picture(savedAs.id, pic);
  });
  const whyNotSave = (): string | null => {
    if (!look) return '…';
    if (look.character) return 'Switch back to your avatar to save a look';
    if (cart.length) return 'Buy what you’re trying on first';
    if (savedAs) return `Already saved as “${savedAs.name}”`;
    if (isStarterLook(look)) return 'That’s the starter look: put something on first';
    return null;
  };
  const autoSave = useRef<(say?: boolean) => void>(() => {});
  autoSave.current = (tell = false) => {
    if (!look || whyNotSave()) return;
    const n = Math.max(0, ...saved_.looks.map((l) => +(/^Look (\d+)$/.exec(l.name)?.[1] ?? 0))) + 1;
    saved_.save(look, `Look ${n}`, lookPicture(look));
    if (tell) say('Look saved');
  };
  // leaving Customize: for the Shop, or leaving Me altogether
  const wasMine = useRef(false);
  useEffect(() => {
    const mine = mode === 'mine' && !locker && !!isActive;
    if (wasMine.current && !mine) autoSave.current(!!isActive);
    wasMine.current = mine;
  }, [mode, locker, isActive]);
  const doneNaming = () => {
    if (!naming || !look) return;
    const name = naming.name.trim().slice(0, 24) || `Look ${saved_.looks.length + 1}`;
    if (naming.id) saved_.rename(naming.id, name);
    setNaming(null);
  };
  const lookOptions = (id: string, name: string) => Alert.alert(name, '', [
    { text: 'Rename', onPress: () => setNaming({ id, name }) },
    { text: 'Remove', style: 'destructive', onPress: () => saved_.remove(id) },
    { text: 'Cancel', style: 'cancel' },
  ]);
  // (the other body's look stays kept: a saved look of the other body swaps them)
  const wearLook = (r: AvatarRecord) => {
    if (!look) return;
    const mine = saved ?? look;
    change({ look: { ...r, other: r.body === mine.body ? mine.other : { ...mine, other: undefined } }, cart: [] });
  };

  // what's on in a slot: its picture in the slot row
  const slotThumb = (sl: CSlot) => {
    if (!look) return null;
    if (sl.panel === 'skin') return <View style={[styles.slotDot, { backgroundColor: skinItems.find((i) => i.isWorn?.(look))?.tint }]} />;
    // what's worn; nothing on: the slot's first item (a picture of the kind of thing, not an icon)
    const all = sl.subs ? AVATAR_ITEMS.filter((i) => !i.pieces && sl.subs!.includes(i.sub) && fitsBody(i, look.body)) : [];
    const worn = all.find((i) => i.isWorn?.(look)), pic = worn ?? all[0];
    const t = pic && thumbOf(pic, look.body);
    return t ? <Image source={{ uri: t }} style={styles.slotImg} resizeMode="contain" /> : <Ionicons name={sl.icon} size={24} color="#fff" />;
  };

  // one item in the grid (or the outfits row)
  const ItemTile = ({ i, width }: { i: AvatarItem; width?: number }) => {
    const on = !!look && !!i.isWorn?.(look), owned = owns(i), thumb = thumbOf(i, look?.body);
    return (
      <Pressable onPress={() => tap(i)} style={[styles.item, width ? { width } : null]}>
        <View style={[styles.thumb, selected?.id === i.id && styles.thumbSel]}>
          {on ? <Text style={styles.onTag}>ON</Text> : null}
          {thumb ? <Image source={{ uri: thumb }} style={styles.thumbImg} resizeMode="contain" />
            : <View style={[styles.skinDot, { backgroundColor: i.tint }]} />}
          {/* the picked item: its details (like Roblox's) */}
          {selected?.id === i.id && i.category !== 'body' ? (
            <Pressable style={styles.detailsBtn} onPress={() => setDetails(i)} hitSlop={4}><Text style={styles.detailsText}>Details</Text></Pressable>
          ) : null}
        </View>
        <Text style={styles.itemName} numberOfLines={1}>{i.name}</Text>
        {i.category === 'body' || mode === 'shop' ? null : <Text style={styles.maker} numberOfLines={1}>Pixil</Text>}
        {i.category === 'body' ? null   /* your body: not an item, no price */
          : owned && (i.pieces ? piecesOf(i).some((p) => (account?.prices[p.id] ?? p.price) > 0) : priceOf(i) > 0) ? <Text style={[styles.price, { color: GREEN }]}>✓ Owned</Text>
          : priceOf(i) === 0 ? <Text style={[styles.price, { color: DIM }]}>Free</Text>
          : <View style={styles.priceRow}><TokBuxIcon size={16} /><Text style={[styles.price, { color: GOLD, fontWeight: '800' }]}>{priceOf(i)}</Text></View>}
      </Pressable>
    );
  };

  // the locker's slots: what's on in each, a tap opens Customize there
  const wornIn = (subs: string[]) => (look ? AVATAR_ITEMS.find((i) => !i.pieces && subs.includes(i.sub) && i.isWorn?.(look)) : undefined);
  const hero = look?.character ? AVATAR_ITEMS.find((i) => i.tab === 'avatars' && i.isWorn?.(look)) : undefined;
  const openSlot = (tabId: (typeof CTABS)[number]['id'], slotId?: string) => {
    const t = CTABS.find((x) => x.id === tabId)!;
    setCtab(tabId); setCslot(t.slots.find((s) => s.id === slotId) ?? t.slots[0] ?? CTABS[1].slots[0]);
    setMode('mine'); setSelected(null); setLocker(false);
  };
  const openShop = () => { setStore('front'); setMode('shop'); setTab('all'); setSub(null); setSelected(null); setSeeAll(false); setLocker(false); };
  const slotOf = (tabId: string, id: string) => CTABS.find((t) => t.id === tabId)!.slots.find((s) => s.id === id)!;
  // (a function, not a component: a component made here is a new one each render, and a re-render mid-tap lost the tap)
  const lockerSlot = ({ key, label, name, thumb, onPress, dimmed }: { key: string; label: string; name: string; thumb: React.ReactNode; onPress: () => void; dimmed?: boolean }) => (
    <Pressable key={key} onPress={onPress} style={({ pressed }) => [[styles.lSlot, lt && L.lSlot], pressed && { opacity: 0.7 }]}>
      <View style={[[styles.lSlotThumb, lt && L.lSlotThumb], dimmed && { opacity: 0.45 }]}>{thumb}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.lSlotLabel, lt && L.lSlotLabel]}>{label}</Text>
        <Text style={[styles.lSlotName, lt && L.lSlotName]} numberOfLines={2}>{name}</Text>
      </View>
    </Pressable>
  );
  const heroPic = hero ? thumbOf(hero, look?.body) : null;
  const ownedHeroes = AVATAR_ITEMS.filter((i) => i.tab === 'avatars' && owns(i));
  const myLooks = look ? saved_.looks.filter((l) => l.look.body === look.body) : [];
  const shopNew = AVATAR_ITEMS.filter((i) => !owns(i) && !i.retired && fitsBody(i, look?.body));
  const shopFace = shopNew.find((i) => i.tab === 'avatars') ?? shopNew[0];
  const saveNow = () => { const no = whyNotSave(); if (no) say(no); else autoSave.current(true); };
  const buyBarView = () => (
    <View ref={bar} style={[styles.buyBar, { paddingBottom: 10 }, locker && { backgroundColor: 'transparent' }]}>
      <Pressable style={styles.buyMain} onPress={() => (cart.length === 1 ? checkout() : setCartOpen(true))} disabled={buying}>
        {/* champagne gold with a soft sheen: light top, gentle fall-off, no mustard */}
        <LinearGradient colors={['#f3e2b3', '#dcbc78', '#c39d58']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        {cart.length === 1
          ? <><TokBuxIcon size={18} /><Text style={styles.buyMainText}>{total.toLocaleString()}</Text></>
          : <Text style={styles.buyMainText}>View Checkout ({cart.length})</Text>}
      </Pressable>
      <Pressable style={styles.buySide} onPress={() => (cart.length === 1 ? openOptions(cartItems[0]) : clearCart())} hitSlop={4} accessibilityLabel={cart.length === 1 ? 'More' : 'Clear'}>
        <Ionicons name={cart.length === 1 ? 'ellipsis-horizontal' : 'trash-outline'} size={20} color={ink} />
      </Pressable>
    </View>
  );
  // the Shop: its front, and every item up close (on the stage, swiped through by category; Try on keeps it on)
  const allHeroes = AVATAR_ITEMS.filter((i) => i.tab === 'avatars' && !i.retired);
  const heroes = [...allHeroes.filter((i) => !owns(i)), ...allHeroes.filter(owns)];   // ones to get first
  const featured = heroes.find((i) => !owns(i));
  const frontItems = useMemo(() => {
    const cats = SHOP_CATS.map(([c]) => c).filter((c) => c !== 'all') as string[];
    const all = AVATAR_ITEMS.filter((i) => cats.includes(i.tab) && !EDITOR_SUBS.includes(i.sub) && fitsBody(i, look?.body) && !owns(i) && !i.retired);
    return feedIndex.size ? [...all.filter((i) => feedIndex.has(i.id)).sort((x, y) => feedIndex.get(x.id)! - feedIndex.get(y.id)!), ...all.filter((i) => !feedIndex.has(i.id))] : mixed(all);
  }, [account, look?.body, feedIndex]);
  const catItems = (c: ShopCat) => {
    if (c === 'all') return frontItems;
    if (c === 'avatars') return heroes;
    const all = AVATAR_ITEMS.filter((i) => (i.tab === c || i.alsoTab === c) && !EDITOR_SUBS.includes(i.sub) && fitsBody(i, look?.body) && (!i.retired || owns(i)));
    return [...all.filter((i) => !owns(i)), ...all.filter(owns)];
  };
  const showList = catItems(showCat);
  const openShow = (c: ShopCat, i?: AvatarItem) => {
    const n = i ? Math.max(0, catItems(c).findIndex((x) => x.id === i.id)) : 0;
    setShowCat(c); setShowAt(n); setStore('show');
  };
  const toShow = (n: number) => { const k = Math.max(0, Math.min(showList.length - 1, n)); setShowAt(k); };
  // keep it on (it goes in the bag with whatever else is on), or take it back off
  const keepOn = (i: AvatarItem) => {
    if (!look || !i.wear) return;
    why.current = `try ${i.id}`; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (i.isWorn?.(look)) { remove(i); return; }
    const unowned = i.pieces ? piecesOf(i).filter((p) => !ownsOne(p)).map((p) => p.id) : owns(i) ? [] : [i.id];
    change({ look: i.wear(look), cart: [...cart.filter((id) => !unowned.includes(id)), ...unowned] });
  };
  const priceTag = (i: AvatarItem) => (owns(i) ? <Text style={[[styles.sPrice, lt && L.sPrice], { color: ACCENT }]}>Owned</Text>
    : <View style={styles.priceRow}><TokBuxIcon size={14} /><Text style={[styles.sPrice, lt && L.sPrice]}>{priceOf(i).toLocaleString()}</Text></View>);
  // one box on the front (the same size as the try-on grid's)
  const storeTile = (i: AvatarItem, onPress: () => void) => {
    const t = thumbOf(i, look?.body);
    return (
      <Pressable key={i.id} onPress={onPress} style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}>
        <View style={[[styles.thumb, lt && L.thumb], i.tab === 'avatars' && { backgroundColor: lt ? '#e8f3f0' : '#14231f' }]}>
          {t ? <Image source={{ uri: t }} style={styles.thumbImg} resizeMode="contain" /> : null}
          {owns(i) ? <View style={styles.sTick}><Ionicons name="checkmark" size={13} color="#fff" /></View> : null}
        </View>
        <Text style={[styles.itemName, lt && L.itemName]} numberOfLines={1}>{i.name}</Text>
        {priceTag(i)}
      </Pressable>
    );
  };
  const bigTile = (i: AvatarItem, onPress: () => void) => {
    const t = thumbOf(i, look?.body);
    const kind = i.tab === 'avatars' ? 'Hero' : i.pieces ? 'Full outfit' : /glove/i.test(i.name) ? 'Gloves' : i.sub;
    return (
      <Pressable key={i.id} onPress={onPress} style={({ pressed }) => [styles.bCard, lt && L.bCard, pressed && { opacity: 0.8 }]}>
        <LinearGradient colors={lt ? ['#eef1f0', '#e3e7e6'] : ['#1f2a28', '#151819']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.bPic}>
          {t ? <Image source={{ uri: t }} style={styles.bImg} resizeMode="contain" /> : null}
          {owns(i) ? <View style={styles.sTick}><Ionicons name="checkmark" size={13} color="#fff" /></View> : null}
        </LinearGradient>
        <Text style={[styles.bName, lt && L.itemName]} numberOfLines={2}>{i.name}</Text>
        <View style={styles.bFoot}>{priceTag(i)}{kind ? <Text style={styles.bKind} numberOfLines={1}>{kind}</Text> : null}</View>
      </Pressable>
    );
  };
  const shopHead = (onBack: () => void) => (
    <View style={[styles.sHead, { top: insets.top + 6 }]}>
      <Pressable style={[styles.round, lt && L.round]} onPress={onBack} hitSlop={6} accessibilityLabel="Back"><Ionicons name="arrow-back" size={22} color={ink} /></Pressable>
      <Text style={[styles.sTitle, lt && L.sTitle]}>Shop</Text>
      {/* what's kept on and not bought yet */}
      {cart.length ? (
        <Pressable style={styles.sBag} onPress={() => (cart.length === 1 ? checkout() : setCartOpen(true))} hitSlop={6}>
          <Ionicons name="bag-handle" size={18} color="#1a1408" /><Text style={styles.sBagText}>{cart.length}</Text>
        </Pressable>
      ) : null}
      <Pressable style={[styles.tb, lt && L.tb]} onPress={() => setTokbux(true)} hitSlop={6}>
        <TokBuxIcon size={22} />
        <Text style={[styles.tbText, lt && L.tbText]}>{(account?.tokbux ?? 0).toLocaleString()}</Text>
      </Pressable>
    </View>
  );
  const LOCKER_TOP = insets.top + 58, LOCKER_BOTTOM = 196 + (cart.length ? 54 : 0);
  const atLocker = locker && !editor;
  const atShow = !locker && mode === 'shop' && store === 'show' && !!showList.length;
  const shown = atShow ? showList[Math.min(showAt, showList.length - 1)] : null;
  // up close it's on you (a piece of clothing on yourself, not on a hero you're trying)
  const stageLook = shown?.wear && look ? shown.wear(shown.tab !== 'avatars' && look.character ? { ...look, character: null } : look) : look;
  const [rootH, setRootH] = useState(H - 84);   // the screen above the tab bar (measured)
  const SHOW_TOP = insets.top + 104, SHOW_H = rootH * 0.56;
  const STAGE_H = editor ? H * 0.56 : H * 0.47;

  return (
    <View style={[styles.root, lt && L.root]} onLayout={(e) => setRootH(e.nativeEvent.layout.height)}>
      {/* the avatar, with the controls floating over it (like Roblox's Me); in the locker it stands on the left */}
      {/* (always placed absolutely: one view switching between absolute and in-flow layout didn't come back) */}
      <View style={[styles.stage, lt && L.stage, atShow ? { top: SHOW_TOP, left: 0, width: W, height: SHOW_H, zIndex: 31 }
        : atLocker ? { top: LOCKER_TOP, left: 0, width: W * 0.6, height: Math.max(0, rootH - LOCKER_TOP - LOCKER_BOTTOM) }
        : { top: 0, left: 0, width: W, height: STAGE_H }]}>
        <StageSlot name="me" avatar={stageLook} focus={atLocker || shown ? 'body' : editor?.focus || selected?.focus || (mode === 'mine' && ctab !== 'avatars' ? cslot.focus : 'body')} look={lt ? 'light' : 'dark'} tint={atShow ? 'gold' : null} headshotOf={shotOf} onHeadshot={onHeadshot} />
        {editor ? (
          <>
            {/* an editor: back, its name, the other editors down the left, undo / redo under them */}
            <View style={[styles.edHead, { top: insets.top + 6 }]}>
              <Pressable style={styles.round} onPress={() => setEditor(null)} hitSlop={6}><Ionicons name="arrow-back" size={22} color="#fff" /></Pressable>
              <Text style={styles.edTitle}>{editor.label}</Text>
              <View style={{ width: 40 }} />
            </View>
            <View style={[styles.rail, { top: insets.top + 62 }]}>
              {CUSTOMIZE.map((c) => (
                <Pressable key={c.sub} onPress={() => { setEditor(c); setSelected(null); }} style={[styles.railBtn, editor.sub === c.sub && styles.railOn]} hitSlop={4}>
                  <Ionicons name={c.icon} size={22} color="#fff" />
                </Pressable>
              ))}
            </View>
            <View style={[styles.rail, { top: insets.top + 62 + CUSTOMIZE.length * 50 + 24 }]}>
              <Pressable style={styles.railBtn} onPress={undo} hitSlop={4}><Ionicons name="arrow-undo" size={19} color={history.undo.length ? '#fff' : 'rgba(255,255,255,0.3)'} /></Pressable>
              <Pressable style={styles.railBtn} onPress={redo} hitSlop={4}><Ionicons name="arrow-redo" size={19} color={history.redo.length ? '#fff' : 'rgba(255,255,255,0.3)'} /></Pressable>
            </View>
          </>
        ) : atLocker || atShow ? (toast ? <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null) : <>
        <View style={[styles.topRow, { top: insets.top + 6 }]}>
          <Pressable style={styles.round} onPress={() => { if (mode === 'shop') setStore('front'); else setLocker(true); setSelected(null); }} hitSlop={6} accessibilityLabel="Back"><Ionicons name="arrow-back" size={22} color="#fff" /></Pressable>
          {mode === 'shop' ? <Text style={[styles.sTitle, { marginLeft: 10 }]}>Shop</Text> : <View style={styles.seg}>
            {(['shop', 'mine'] as const).map((m) => (
              <Pressable key={m} onPress={() => { setMode(m); setSub(null); if (m === 'shop') setStore('front'); }} style={[styles.segBtn, mode === m && styles.segOn]}>
                <Text style={[styles.segText, mode === m && styles.segTextOn]}>{m === 'shop' ? 'Shop' : 'Customize'}</Text>
              </Pressable>
            ))}
          </View>}
          <Pressable style={styles.tb} onPress={() => setTokbux(true)} hitSlop={6}>
            <TokBuxIcon size={22} />
            <Text style={styles.tbText}>{(account?.tokbux ?? 0).toLocaleString()}</Text>
          </Pressable>
        </View>
        {mode === 'shop' ? null : <Pressable style={[styles.mePill, { top: insets.top + 62, zIndex: 21 }]} onPress={() => setCustomize(!customize)} hitSlop={6}>
          <Avatar uri={user?.avatar} userId={user?.id} size={44} />
          {customize ? <View style={styles.pillX}><Ionicons name="close" size={20} color="#fff" /></View>
            : <Ionicons name="pencil" size={15} color="#fff" style={{ marginTop: 8 }} />}
        </Pressable>}
        <View style={mode === 'shop' ? [styles.sUndo, { top: insets.top + 62 }] : styles.undo}>
          <Pressable style={mode === 'shop' ? styles.round : styles.undoBtn} onPress={undo} hitSlop={6}><Ionicons name="arrow-undo" size={19} color={history.undo.length ? '#fff' : 'rgba(255,255,255,0.3)'} /></Pressable>
          <Pressable style={mode === 'shop' ? styles.round : styles.undoBtn} onPress={redo} hitSlop={6}><Ionicons name="arrow-redo" size={19} color={history.redo.length ? '#fff' : 'rgba(255,255,255,0.3)'} /></Pressable>
        </View>
        {toast ? <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}
        </>}
      </View>

      {atLocker ? (
        <>
          {/* you, your TokBux, the account menu */}
          <View style={[styles.lHead, { top: insets.top + 6 }]}>
            <Pressable onPress={() => setEditProfile(true)} style={{ flex: 1 }} hitSlop={6}>
              <Text style={[styles.lName, lt && L.lName]} numberOfLines={1}>{user?.displayName || user?.username || 'Me'}</Text>
              {user?.username ? <Text style={[styles.lHandle, lt && L.lHandle]} numberOfLines={1}>@{user.username}</Text> : null}
            </Pressable>
            <Pressable style={[styles.tb, lt && L.tb]} onPress={() => setTokbux(true)} hitSlop={6}>
              <TokBuxIcon size={22} />
              <Text style={[styles.tbText, lt && L.tbText]}>{(account?.tokbux ?? 0).toLocaleString()}</Text>
            </Pressable>
            <Pressable style={[styles.round, lt && L.round]} onPress={openAccountMenu} hitSlop={6}><Ionicons name="settings-outline" size={21} color={ink} /></Pressable>
          </View>
          {/* what's on, slot by slot */}
          <ScrollView style={[styles.lSlots, { top: LOCKER_TOP + 8, bottom: LOCKER_BOTTOM }]} contentContainerStyle={{ gap: 8, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            {lockerSlot({ key: 'hero', label: 'Hero', name: hero?.name ?? 'None', dimmed: !hero, onPress: () => openSlot('avatars'),
              thumb: heroPic || ownedHeroes[0] ? <Image source={{ uri: (heroPic || thumbOf(ownedHeroes[0], look?.body))! }} style={styles.lSlotImg} resizeMode="contain" /> : <Ionicons name="flash-outline" size={22} color={ink} /> })}
            {([['body', 'hair', 'Hair'], ['clothing', 'top', 'Top'], ['clothing', 'bottom', 'Bottom'], ['clothing', 'shoes', 'Shoes']] as const).map(([t, id, label]) => {
              const sl = slotOf(t, id), on = wornIn(sl.subs!);
              return lockerSlot({ key: id, label, name: on?.name ?? 'None', dimmed: !on, onPress: () => openSlot(t, id), thumb: slotThumb(sl) });
            })}
            {lockerSlot({ key: 'body', label: 'Body', name: 'Build · Face · Skin', onPress: () => openSlot('body', 'build'), thumb: slotThumb(slotOf('body', 'skin')) })}
          </ScrollView>
          {/* looks you saved and heroes you own, then the Shop */}
          <View style={[styles.lBottom, { height: LOCKER_BOTTOM }]}>
            <View style={styles.lRowHead}>
              <Text style={[styles.lTitle, lt && L.lTitle]}>Looks</Text>
              <Pressable onPress={saveNow} hitSlop={8}><Text style={styles.lAction}>Save current</Text></Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
              {myLooks.map((l) => {
                const pic = bodyPictureOf(l.look) || l.picture || stagePicture(l.look);
                const on = !!look && !look.character && sameLook(look, l.look);
                return (
                  <Pressable key={l.id} onPress={() => wearLook(l.look)} onLongPress={() => lookOptions(l.id, l.name)} style={[[styles.lLook, lt && L.lLook], on && styles.lLookOn]}>
                    {pic ? <Image source={{ uri: pic }} style={[styles.thumbImg, { width: '100%', height: '100%', transform: [{ scale: 1.55 }, { translateY: 3 }] }]} resizeMode="cover" /> : <Ionicons name="shirt-outline" size={26} color={DIM} />}
                  </Pressable>
                );
              })}
              {ownedHeroes.map((i) => (
                <Pressable key={i.id} onPress={() => tap(i)} style={[[styles.lLook, lt && L.lLook], { backgroundColor: '#14231f' }, !!look && !!i.isWorn?.(look) && styles.lLookOn]}>
                  {thumbOf(i, look?.body) ? <Image source={{ uri: thumbOf(i, look?.body)! }} style={styles.lSlotImg} resizeMode="contain" /> : null}
                </Pressable>
              ))}
              {!myLooks.length && !ownedHeroes.length ? <Text style={[[styles.hint, lt && L.hint], { paddingHorizontal: 0 }]}>Put a look together and save it here.</Text> : null}
            </ScrollView>
            <Pressable onPress={openShop} style={({ pressed }) => [styles.lShop, pressed && { opacity: 0.8 }]}>
              <LinearGradient colors={['#2a2114', '#14120d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              {shopFace && thumbOf(shopFace, look?.body) ? <Image source={{ uri: thumbOf(shopFace, look?.body)! }} style={{ width: 46, height: 46 }} resizeMode="contain" /> : <Ionicons name="bag-handle-outline" size={28} color={GOLD} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.lShopTitle}>Shop</Text>
                <Text style={styles.lShopSub} numberOfLines={1}>{shopFace ? `New: ${shopFace.name} · ${shopNew.length} items to try on` : 'Clothes, hair and heroes'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={GOLD} />
            </Pressable>
            {cart.length ? buyBarView() : null}
          </View>
        </>
      ) : null}

      {/* the avatar button's menu: the editors, and the profile */}
      {customize ? (
        <Pressable style={[StyleSheet.absoluteFill, { zIndex: 20 }]} onPress={() => setCustomize(false)}>
          <View style={[styles.menu, { top: insets.top + 62 }]}>
            {CUSTOMIZE.map((c) => (
              <Pressable key={c.sub} style={styles.menuRow} onPress={() => { setCustomize(false); setEditor(c); setSelected(null); }}>
                <Ionicons name={c.icon} size={22} color="#fff" />
                <Text style={styles.menuText}>{c.label}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.menuRow} onPress={() => { setCustomize(false); setEditProfile(true); }}>
              <Ionicons name="create-outline" size={22} color="#fff" />
              <Text style={styles.menuText}>Edit Profile</Text>
            </Pressable>
          </View>
        </Pressable>
      ) : null}

      {/* items */}
      {atLocker || mode === 'shop' ? null : <View style={[styles.sheet, { marginTop: STAGE_H - 22 }]}>
        <View style={styles.handle} />
        {editor ? (
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false} scrollEnabled={!grab} bounces={false}>
            {editor.sub === 'Skin' ? skinPanel() : editor.sub === 'Build' ? buildPanel()
            : <View style={styles.grid}>{edItems.map((i) => <ItemTile key={i.id} i={i} />)}</View>}
          </ScrollView>
        ) : mode === 'mine' ? (
          <>
            <View style={styles.tabs}>
              {CTABS.map((t) => (
                <Pressable key={t.id} onPress={() => { setCtab(t.id); if (t.slots[0]) setCslot(t.slots[0]); setSelected(null); }} style={[styles.tab, ctab === t.id && styles.tabOn]}>
                  <Text style={[styles.tabText, ctab === t.id && styles.tabTextOn]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false} scrollEnabled={!grab} bounces={false}>
              {ctab === 'avatars' ? (
                <>
                <View style={styles.grid}>
                  {/* yourself, male and female: each keeps its own look; one tap back from a character too (it waited underneath) */}
                  {(['Male', 'Female'] as const).map((b) => (
                    <Pressable key={b} onPress={() => switchBody(b)} style={styles.item}>
                      <View style={[styles.thumb, { overflow: 'hidden' }, !bodyPicture(b) && styles.addTile, !!look && !look.character && look.body === b && styles.thumbSel]}>
                        {/* (the stage's picture, zoomed onto the avatar standing in its middle) */}
                        {bodyPicture(b) ? <Image source={{ uri: bodyPicture(b)! }} style={[styles.thumbImg, { transform: [{ scale: 1.55 }, { translateY: 4 }] }]} resizeMode="cover" /> : <Ionicons name={b === 'Male' ? 'man' : 'woman'} size={40} color="#fff" />}
                      </View>
                      <Text style={styles.itemName} numberOfLines={1}>{b}</Text>
                    </Pressable>
                  ))}
                  {/* characters you own (bought here or in a game): worn instead of your avatar */}
                  {AVATAR_ITEMS.filter((i) => i.tab === 'avatars' && owns(i)).map((i) => <ItemTile key={i.id} i={i} />)}
                </View>
                {/* this character's saved looks (hold one: rename, delete) */}
                <Text style={styles.section}>Saved looks</Text>
                {look && saved_.looks.some((l) => l.look.body === look.body) ? (
                  <View style={styles.grid}>
                    {saved_.looks.filter((l) => !!look && l.look.body === look.body).map((l) => {
                      const pic = bodyPictureOf(l.look) || l.picture || stagePicture(l.look);
                      return (
                        <Pressable key={l.id} onPress={() => wearLook(l.look)} onLongPress={() => lookOptions(l.id, l.name)} style={styles.item}>
                          <View style={[styles.thumb, { overflow: 'hidden' }, !!look && !look.character && sameLook(look, l.look) && styles.thumbSel]}>
                            {pic ? <Image source={{ uri: pic }} style={[styles.thumbImg, { transform: [{ scale: 1.55 }, { translateY: 4 }] }]} resizeMode="cover" /> : <Ionicons name="shirt-outline" size={34} color={DIM} />}
                          </View>
                          <Text style={styles.itemName} numberOfLines={1}>{l.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : <Text style={styles.hint}>Looks you put together here save themselves when you leave Customize.</Text>}
                </>
              ) : (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slots}>
                    {CTABS.find((t) => t.id === ctab)!.slots.filter((sl) => !sl.only || sl.only === look?.body).map((sl) => (
                      <Pressable key={sl.id} onPress={() => { setCslot(sl); setSelected(null); }} style={styles.slot}>
                        <View style={[styles.slotBox, cslot.id === sl.id && styles.slotOn]}>{slotThumb(sl)}</View>
                        <Text style={[styles.slotText, cslot.id === sl.id && { color: '#fff' }]}>{sl.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  {cslot.panel === 'build' ? buildPanel() : cslot.panel === 'skin' ? skinPanel() : (() => {
                    const all = AVATAR_ITEMS.filter((i) => !i.pieces && cslot.subs!.includes(i.sub) && fitsBody(i, look?.body));
                    const mine = all.filter(owns), more = all.filter((i) => !owns(i) && !i.retired);
                    return (
                      <>
                        {mine.length ? <View style={styles.grid}>{mine.map((i) => <ItemTile key={i.id} i={i} />)}</View>
                          : <Text style={styles.noneText}>No {cslot.label}</Text>}
                        {more.length ? (
                          <>
                            <Text style={styles.heading}>You May Also Like</Text>
                            <View style={styles.grid}>{more.map((i) => <ItemTile key={i.id} i={i} />)}</View>
                          </>
                        ) : null}
                      </>
                    );
                  })()}
                </>
              )}
            </ScrollView>
          </>
        ) : <>
        <View style={styles.tabsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            {tabs.map((t) => (
              <Pressable key={t.id} onPress={() => { setTab(t.id); setSub(null); setSelected(null); setSeeAll(false); }} style={[styles.sChip, tab === t.id && styles.sChipOn]}>
                <Text style={[styles.sChipText, tab === t.id && styles.sChipTextOn]}>{tabName(t.id)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <ScrollView key={tab} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {subs.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subs}>
            {subs.map((s) => (
              <Pressable key={s} onPress={() => setSub(sub === s ? null : s)} style={[styles.sub, sub === s && styles.subOn]}>
                <Text style={[styles.subText, sub === s && styles.subTextOn]}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {seeAll && tab === 'outfits' ? (
          <Pressable style={styles.backRow} onPress={() => { setTab('all'); setSeeAll(false); }} hitSlop={6}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
            <Text style={[styles.heading, { paddingHorizontal: 10, paddingTop: 0 }]}>Outfits</Text>
          </Pressable>
        ) : tab === 'all' || sub ? <Text style={styles.heading}>{sub || 'Recommended For You'}</Text> : <View style={{ height: 14 }} />}
        <View style={styles.grid}>
          {items.length ? items.map((i) => <ItemTile key={i.id} i={i} />) : <Text style={styles.empty}>{AVATAR_ITEMS.some((i) => i.tab === tab)
            ? 'You own everything here. More coming soon.' : `No ${TABS.find((t) => t.id === tab)?.label.toLowerCase()} yet. New ones show up here.`}</Text>}
        </View>
        </ScrollView>

        </>}
        {/* checkout bar (like Roblox's): one thing on trial is bought straight from it; more open the checkout */}
        {cart.length && !editor ? buyBarView() : null}
      </View>}

      {/* the Shop's front: the new hero, then heroes, outfits, hair, clothes (tap: try it on, a hero: up close) */}
      {!locker && mode === 'shop' && store === 'front' ? (
        <View style={[styles.sPage, lt && L.sPage]}>
          <ScrollView contentContainerStyle={{ paddingTop: insets.top + 110, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {featured ? (
              <Pressable onPress={() => openShow('avatars', featured)} style={({ pressed }) => [styles.sFeat, pressed && { opacity: 0.85 }]}>
                <LinearGradient colors={['#5a3d12', '#1b140a']} start={{ x: 0.9, y: 0.2 }} end={{ x: 0.1, y: 1 }} style={StyleSheet.absoluteFill} />
                {thumbOf(featured, look?.body) ? <Image source={{ uri: thumbOf(featured, look?.body)! }} style={styles.sFeatImg} resizeMode="contain" /> : null}
                <View style={styles.sFeatTag}><Text style={styles.sFeatTagText}>NEW HERO</Text></View>
                <View style={styles.sFeatBody}>
                  <Text style={styles.sFeatName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{featured.name}</Text>
                  <Text style={styles.sFeatSub} numberOfLines={2}>{powersOf(featured).slice(0, 2).join(' + ') || 'A hero for every game'}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={styles.sFeatBtn}>
                      <LinearGradient colors={['#f3e2b3', '#dcbc78', '#c39d58']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
                      <TokBuxIcon size={16} /><Text style={styles.buyMainText}>{priceOf(featured).toLocaleString()}</Text>
                    </View>
                    <View style={styles.sFeatTry}><Text style={styles.sFeatTryText}>Try on</Text></View>
                  </View>
                </View>
              </Pressable>
            ) : null}
            {/* everything, mixed (the server's order for you once it has answered), no headings */}
            <View style={[styles.sSeeRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
              <Text style={[styles.bHead, lt && L.itemName]}>New this week</Text>
              {frontItems.length > 12 ? <Pressable onPress={() => openShow('all')} hitSlop={8}><Text style={[styles.sSeeAll, lt && L.sSeeAll]}>See all</Text></Pressable> : null}
            </View>
            <View style={[styles.grid, { columnGap: 12, rowGap: 12, paddingTop: 4 }]}>{frontItems.slice(0, 12).map((i) => bigTile(i, () => openShow('all', i)))}</View>
          </ScrollView>
          <View style={[[styles.sHeroBg, lt && L.sHeroBg], { top: 0, bottom: undefined, height: insets.top + 104 }]} />
          {/* every category one tap away (Heroes: up close; the rest: tried on, on its tab) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.sCats, { top: insets.top + 58 }]} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {SHOP_CATS.filter(([c]) => c !== 'all' && catItems(c).length).map(([c, label]) => (
              <Pressable key={c} onPress={() => openShow(c)} style={[styles.sChip, lt && L.sChip]}><Text style={[styles.sChipText, lt && L.sChipText]}>{label}</Text></Pressable>
            ))}
          </ScrollView>
          {shopHead(() => setLocker(true))}
        </View>
      ) : null}

      {/* up close (like the mock's screen 3): the category's chips on top, the item on you on the stage (drag to turn it),
          the arrows go through the category; Try on keeps it on (in the bag), Buy gets it */}
      {atShow && shown ? (
        <View pointerEvents="box-none" style={[[styles.sPage, lt && L.sPage], { backgroundColor: 'transparent', zIndex: 32 }]}>
          <View style={[[styles.sHeroBg, lt && L.sHeroBg], { top: SHOW_TOP + SHOW_H }]} />
          <View style={[[styles.sHeroBg, lt && L.sHeroBg], { top: 0, bottom: undefined, height: SHOW_TOP }]} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.sCats, { top: insets.top + 58 }]} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {SHOP_CATS.filter(([c]) => catItems(c).length).map(([c, label]) => (
              <Pressable key={c} onPress={() => openShow(c)} style={[[styles.sChip, lt && L.sChip], showCat === c && [styles.sChipOn, lt && L.sChipOn]]}>
                <Text style={[[styles.sChipText, lt && L.sChipText], showCat === c && [styles.sChipTextOn, lt && L.sChipTextOn]]}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {showAt > 0 ? <Pressable style={[[styles.round, lt && L.round], styles.sArrow, { left: 10, top: SHOW_TOP + SHOW_H / 2 - 22 }]} onPress={() => toShow(showAt - 1)} hitSlop={8}><Ionicons name="chevron-back" size={22} color={ink} /></Pressable> : null}
          {showAt < showList.length - 1 ? <Pressable style={[[styles.round, lt && L.round], styles.sArrow, { right: 10, top: SHOW_TOP + SHOW_H / 2 - 22 }]} onPress={() => toShow(showAt + 1)} hitSlop={8}><Ionicons name="chevron-forward" size={22} color={ink} /></Pressable> : null}
          {(() => {
            const mine = owns(shown), on = !!look && !!shown.isWorn?.(look);
            const tags = shown.tab === 'avatars' ? powersOf(shown) : shown.pieces ? [`Whole look · ${shown.pieces.length} pieces`] : [shown.sub];
            return (
              <View style={styles.sHeroInfo}>
                <Text style={[styles.sHeroName, lt && L.sHeroName]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{shown.name}</Text>
                <View style={styles.sPowers}>
                  {tags.map((p) => <View key={p} style={[styles.sPower, lt && L.sPower]}>{shown.tab === 'avatars' ? <Ionicons name="flash" size={12} color={GOLD} /> : null}<Text style={[styles.sPowerText, lt && L.sPowerText]}>{p}</Text></View>)}
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {mine ? (
                    <Pressable style={[styles.sBtn, { backgroundColor: on ? (lt ? '#eceae5' : CARD) : ACCENT }]} onPress={() => { if (!on) keepOn(shown); }}>
                      <Text style={[styles.sBtnText, lt && on && L.sBtnText]}>{on ? 'Wearing' : 'Wear'}</Text>
                    </Pressable>
                  ) : (
                    <>
                      <Pressable style={[styles.sBtn, { backgroundColor: lt ? '#eceae5' : CARD }, on && { borderWidth: 1.5, borderColor: GOLD }]} onPress={() => keepOn(shown)}>
                        <Text style={[styles.sBtnText, lt && L.sBtnText]}>{on ? 'Take off' : 'Try on'}</Text>
                      </Pressable>
                      <Pressable style={[styles.sBtn, { flex: 1.4, overflow: 'hidden' }]} onPress={() => buyNow(shown)} disabled={buying}>
                        <LinearGradient colors={['#f3e2b3', '#dcbc78', '#c39d58']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
                        <Text style={styles.buyMainText}>Buy ·</Text><TokBuxIcon size={18} /><Text style={styles.buyMainText}>{priceOf(shown).toLocaleString()}</Text>
                      </Pressable>
                    </>
                  )}
                </View>
                {showList.length <= 14 ? (
                  <View style={styles.sDots}>
                    {showList.map((x, n) => <View key={x.id} style={[[styles.sDot, lt && L.sDot], n === showAt && styles.sDotOn]} />)}
                  </View>
                ) : <Text style={[styles.sCount, lt && L.sCount]}>{showAt + 1} / {showList.length}</Text>}
              </View>
            );
          })()}
          {shopHead(() => setStore('front'))}
        </View>
      ) : null}

      {/* checkout (like Roblox's): a page of what's being tried on and not owned yet, each removable, the total, Buy */}
      <Modal visible={cartOpen && !!cart.length && !buyReq} animationType="slide" onRequestClose={() => setCartOpen(false)}>
        <View style={[styles.co, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.coHead}>
            <Pressable onPress={() => setCartOpen(false)} hitSlop={10} style={styles.coBack}><Ionicons name="chevron-back" size={26} color="#fff" /></Pressable>
            <Text style={styles.coTitle}>Checkout</Text>
            <View style={styles.coBack} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8 }}>
            {cartItems.map((i) => (
              <View key={i.id} style={styles.cartRow}>
                <View style={styles.cartThumb}>{thumbOf(i, look?.body) ? <Image source={{ uri: thumbOf(i, look?.body)! }} style={styles.cartImg} resizeMode="contain" /> : null}</View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.cartName} numberOfLines={2}>{i.name}</Text>
                  <Text style={styles.cartSub}>{i.sub}</Text>
                  <View style={styles.priceRow}><TokBuxIcon size={15} /><Text style={styles.cartPrice}>{priceOf(i).toLocaleString()}</Text></View>
                </View>
                <Pressable onPress={() => { if (look && i.takeOff) change({ look: takeOff(i, look), cart: cart.filter((id) => id !== i.id) }); else change({ look: look!, cart: cart.filter((id) => id !== i.id) }); }} hitSlop={8} style={styles.cartX}>
                  <Ionicons name="close" size={22} color="#fff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
          <View style={{ paddingHorizontal: 18 }}>
            <View style={styles.coTotal}>
              <Text style={styles.coTotalText}>Total ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'})</Text>
              <View style={styles.priceRow}><TokBuxIcon size={18} /><Text style={styles.coTotalText}>{total.toLocaleString()}</Text></View>
            </View>
            <Pressable style={styles.cartBuy} onPress={() => { setCartOpen(false); checkout(); }} disabled={buying}>
              <LinearGradient colors={GOLD_METAL} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
              <Text style={styles.cartBuyText}>Buy</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <TokBuxSheet visible={tokbux} onClose={() => setTokbux(false)} />
      <ConfirmCard ask={ask} onClose={() => setAsk(null)} />
      <ItemOptions visible={!!options} above={barTop} onClose={() => setOptions(null)} options={options ? [
        { label: 'View Details Page', icon: 'information-circle-outline', onPress: () => setDetails(options) },
        { label: 'Share', icon: 'share-outline', onPress: () => shareItem(options) },
        { label: 'Remove', icon: 'trash-outline', danger: true, onPress: () => remove(options) },
      ] : []} />
      <ItemDetails item={buyReq ? null : details} look={look} price={details ? priceOf(details) : 0} owned={!!details && owns(details)}
        worn={!!details && !!look && !!details.isWorn?.(look)} onClose={() => setDetails(null)}
        onBuy={() => details && buyNow(details)} onWear={() => { if (details) { tap(details); setDetails(null); } }} />
      <BuyItemSheet request={buyReq} onDone={onBought} />
      <EditProfileModal visible={editProfile} onClose={() => setEditProfile(false)} />
      {/* name a look being saved (or renamed) */}
      <Modal visible={!!naming} transparent animationType="fade" onRequestClose={() => setNaming(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setNaming(null)} />
          <View style={[styles.nameSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.sheetTitle}>Rename look</Text>
            <TextInput value={naming?.name ?? ''} onChangeText={(name) => setNaming((n) => (n ? { ...n, name } : n))} maxLength={24} autoFocus selectTextOnFocus
              placeholder="Name" placeholderTextColor={DIM} style={styles.sheetInput} returnKeyType="done" onSubmitEditing={doneNaming} />
            <View style={styles.sheetRow}>
              <Pressable style={[styles.sheetBtn, { backgroundColor: CARD }]} onPress={() => setNaming(null)}><Text style={styles.sheetBtnText}>Cancel</Text></Pressable>
              <Pressable style={[styles.sheetBtn, { backgroundColor: '#fff' }]} onPress={doneNaming}><Text style={[styles.sheetBtnText, { color: '#000' }]}>Save</Text></Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
};


// light mode (design/me-mocks/light.html): Me on the Games screen's light, the Shop on warm ivory; the deeper gold reads on white
const CARD_SHADOW = { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } };
const L = StyleSheet.create({
  bCard: { backgroundColor: '#ffffff' },
  root: { backgroundColor: '#f8f9fa' },
  stage: { backgroundColor: '#f8f9fa' },
  lName: { color: '#111827' },
  lHandle: { color: '#6b7280' },
  lSlot: { backgroundColor: '#fff', ...CARD_SHADOW },
  lSlotThumb: { backgroundColor: '#f3f4f6' },
  lSlotLabel: { color: '#6b7280' },
  lSlotName: { color: '#111827' },
  lTitle: { color: '#111827' },
  lLook: { backgroundColor: '#fff', ...CARD_SHADOW },
  hint: { color: '#6b7280' },
  round: { backgroundColor: 'rgba(0,0,0,0.06)' },
  tb: { backgroundColor: 'rgba(0,0,0,0.06)' },
  tbText: { color: '#111827' },
  sPage: { backgroundColor: '#faf7f1' },
  sHeroBg: { backgroundColor: '#faf7f1' },
  sTitle: { color: '#a8792c' },
  sChip: { backgroundColor: '#fff', ...CARD_SHADOW },
  sChipOn: { backgroundColor: '#1a1408' },
  sChipText: { color: '#4b5563' },
  sChipTextOn: { color: '#f3e2b3' },
  sSeeAll: { color: '#6b7280' },
  sPrice: { color: '#a8792c' },
  thumb: { backgroundColor: '#fff', ...CARD_SHADOW },
  itemName: { color: '#111827' },
  sHeroName: { color: '#111827' },
  sPower: { backgroundColor: '#fff', ...CARD_SHADOW },
  sPowerText: { color: '#374151' },
  sBtnText: { color: '#111827' },
  sCount: { color: '#6b7280' },
  sDot: { backgroundColor: 'rgba(0,0,0,0.18)' },
});

const styles = StyleSheet.create({
  // the Shop's front and heroes
  sPage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: BG, zIndex: 30 },
  sHead: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 5 },
  sTitle: { flex: 1, color: '#f3e2b3', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  sFeat: { marginHorizontal: 16, height: 220, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(220,182,100,0.35)' },
  sFeatImg: { position: 'absolute', right: -6, bottom: -8, width: 190, height: 236 },
  sFeatTag: { position: 'absolute', left: 16, top: 16, backgroundColor: '#f3e2b3', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  sFeatTagText: { color: '#1a1408', fontSize: 11, fontWeight: '900' },
  sFeatBody: { position: 'absolute', left: 16, bottom: 16, width: 200 },
  sFeatName: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  sFeatSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginBottom: 10 },
  sFeatTry: { height: 38, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(220,182,100,0.8)', alignItems: 'center', justifyContent: 'center' },
  sFeatTryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  bHead: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  bCard: { width: CARD2, backgroundColor: '#16191a', borderRadius: 18, padding: 8, paddingBottom: 10 },
  bPic: { height: CARD2 * 0.92, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bImg: { width: '92%', height: '92%' },
  bName: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 8, minHeight: 18 },
  bFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  bKind: { color: DIM, fontSize: 12, fontWeight: '700', flexShrink: 1, marginLeft: 6 },
  sFeatBtn: { height: 38, width: 130, borderRadius: 12, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sSeeAll: { color: DIM, fontSize: 13, fontWeight: '700' },
  sPrice: { color: GOLD, fontSize: 13, fontWeight: '800' },
  sTick: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  sBar: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sHeroBg: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: BG },
  sCats: { position: 'absolute', left: 0, right: 0, height: 34, zIndex: 5 },
  sUndo: { position: 'absolute', right: 16, gap: 10 },
  sBag: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 11, borderRadius: 17, backgroundColor: '#f3e2b3' },
  sBagText: { color: '#1a1408', fontSize: 14, fontWeight: '900' },
  sCount: { color: DIM, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  sSeeRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, marginTop: 20, marginBottom: 10, minHeight: 18 },
  sChip: { height: 34, paddingHorizontal: 15, borderRadius: 17, backgroundColor: '#17191b', justifyContent: 'center' },
  sChipOn: { backgroundColor: '#f3e2b3' },
  sChipText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '700' },
  sChipTextOn: { color: '#1a1408' },
  sArrow: { position: 'absolute', zIndex: 4 },
  sHeroInfo: { position: 'absolute', left: 16, right: 16, bottom: 22 },
  sHeroName: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  sPowers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 16 },
  sPower: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#17191b', borderRadius: 14, paddingHorizontal: 11, height: 28 },
  sPowerText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  sBtn: { flex: 1, height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  sDots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 14 },
  sDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  sDotOn: { width: 16, backgroundColor: GOLD },
  root: { flex: 1, backgroundColor: BG },
  stage: { position: 'absolute', backgroundColor: BG },
  lHead: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 3 },
  lName: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  lHandle: { color: DIM, fontSize: 13, fontWeight: '600', marginTop: 1 },
  lSlots: { position: 'absolute', right: 14, width: W * 0.4 - 10, zIndex: 3 },
  lSlot: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#141618', borderRadius: 14, padding: 6 },
  lSlotThumb: { width: 48, height: 48, borderRadius: 11, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  lSlotImg: { width: 42, height: 42 },
  lSlotLabel: { color: DIM, fontSize: 11, fontWeight: '600' },
  lSlotName: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 1 },
  lBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 3 },
  lRowHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 9 },
  lTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  lAction: { color: ACCENT, fontSize: 13, fontWeight: '700' },
  lLook: { width: 64, height: 64, borderRadius: 14, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  lLookOn: { borderColor: ACCENT },
  lShop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 14, marginBottom: 10, height: 62, borderRadius: 16, paddingHorizontal: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(220,182,100,0.3)' },
  lShopTitle: { color: '#f3e2b3', fontSize: 15, fontWeight: '800' },
  lShopSub: { color: DIM, fontSize: 12, fontWeight: '600', marginTop: 1 },
  topRow: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(18,13,30,0.9)', alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(18,13,30,0.9)', borderRadius: 999, padding: 4 },
  segBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999 },
  segOn: { backgroundColor: '#fff' },
  segText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '700' },
  segTextOn: { color: '#111' },
  menu: { position: 'absolute', left: 80, minWidth: 230, backgroundColor: '#1c1626', borderRadius: 18, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 20 },
  menuText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  edHead: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  edTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  rail: { position: 'absolute', left: 16, backgroundColor: 'rgba(18,13,30,0.9)', borderRadius: 26, padding: 4, gap: 2 },
  railBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  railOn: { backgroundColor: 'rgba(255,255,255,0.22)' },
  edLabel: { color: DIM, fontSize: 15, fontWeight: '700', paddingHorizontal: 18, paddingTop: 20 },
  bodyRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 10 },
  bodyPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 23, backgroundColor: CARD },
  bodyPillOn: { backgroundColor: '#fff' },
  bodyPillText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, padding: 20, justifyContent: 'center' },
  swatchRing: { width: (W - 40 - 14 * 4) / 5, aspectRatio: 1, borderRadius: 999, padding: 4, borderWidth: 3, borderColor: 'transparent' },
  swatchOn: { borderColor: ACCENT },
  swatch: { flex: 1, borderRadius: 999 },
  triBox: { width: TRI_W + 60, height: TRI_H + 60, alignSelf: 'center', marginTop: 8 },
  triIcon: { position: 'absolute' },
  slots: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  slot: { alignItems: 'center', width: 66 },
  slotBox: { width: 62, height: 62, borderRadius: 14, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  slotOn: { borderColor: '#fff' },
  slotImg: { width: 54, height: 54 },
  slotDot: { width: 36, height: 36, borderRadius: 18 },
  slotText: { color: DIM, fontSize: 12, fontWeight: '700', marginTop: 6 },
  noneText: { color: DIM, fontSize: 15, fontWeight: '700', textAlign: 'center', paddingVertical: 26 },
  addTile: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.25)' },
  padBox: { alignSelf: 'center', marginTop: 4 },
  pad: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)' },
  triKnob: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', borderWidth: 3, borderColor: ACCENT },
  slider: { height: 40, marginHorizontal: 12 },
  trackWrap: { flex: 1, justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  trackOn: { height: 5, backgroundColor: '#fff' },
  knob: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', marginLeft: -11, top: 9 },
  pillX: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  tb: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(18,13,30,0.9)', borderRadius: 999, paddingVertical: 6, paddingLeft: 6, paddingRight: 12 },
  tbText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  mePill: { position: 'absolute', left: 16, alignItems: 'center', backgroundColor: 'rgba(18,13,30,0.9)', borderRadius: 30, paddingTop: 6, paddingBottom: 10, paddingHorizontal: 6 },
  undo: { position: 'absolute', left: 16, bottom: 30, flexDirection: 'row', gap: 6, backgroundColor: 'rgba(18,13,30,0.9)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 4 },
  undoBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute', alignSelf: 'center', bottom: 84, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, maxWidth: W - 40 },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  section: { color: '#fff', fontSize: 18, fontWeight: '800', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 2 },
  hint: { color: DIM, fontSize: 14, fontWeight: '600', paddingHorizontal: 18, paddingVertical: 10 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  nameSheet: { backgroundColor: PANEL, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, gap: 14 },
  sheetTitle: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sheetInput: { backgroundColor: CARD, color: '#fff', fontSize: 17, fontWeight: '700', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  sheetRow: { flexDirection: 'row', gap: 10 },
  sheetBtn: { flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sheetBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  sheet: { flex: 1, backgroundColor: PANEL, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -22, borderTopWidth: 1, borderColor: GOLD_LINE },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 8 },
  tabs: { flexDirection: 'row', gap: 22, paddingHorizontal: 18, paddingTop: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  tabsBar: {},   // (the Shop's: more tabs than fit, so it scrolls)
  tabsRow: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  tab: { paddingBottom: 10, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: GOLD },
  tabText: { color: DIM, fontSize: 16, fontWeight: '700' },
  tabTextOn: { color: '#fff' },
  subs: { gap: 20, paddingHorizontal: 18, paddingTop: 12 },
  sub: { paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  subOn: { borderBottomColor: '#fff' },
  subText: { color: DIM, fontSize: 14, fontWeight: '700' },
  subTextOn: { color: '#fff' },
  heading: { color: '#fff', fontSize: 24, fontWeight: '800', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 18, padding: 16 },
  item: { width: CELL },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 },
  seeAll: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginTop: 18 },
  seeAllText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  row: { columnGap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  onTag: { position: 'absolute', top: 7, left: 7, zIndex: 2, backgroundColor: 'rgba(12,11,9,0.8)', color: '#ead08f', borderWidth: 1, borderColor: 'rgba(220,182,100,0.6)', fontSize: 10, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: 'hidden' },
  thumb: { width: CELL, height: CELL, backgroundColor: CARD, borderRadius: 14, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8 },
  thumbSel: { borderColor: GOLD },
  detailsBtn: { position: 'absolute', left: 4, right: 4, bottom: 4, height: 28, borderRadius: 8, backgroundColor: 'rgba(12,11,9,0.85)', alignItems: 'center', justifyContent: 'center' },
  detailsText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  thumbImg: { width: '84%', height: '84%' },
  skinDot: { width: CELL * 0.45, height: CELL * 0.45, borderRadius: CELL },
  itemName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  maker: { color: DIM, fontSize: 13, fontWeight: '500', marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  price: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 4 },
  empty: { color: DIM, fontWeight: '600', padding: 20 },
  buyBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 8, backgroundColor: PANEL },
  buyMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, borderRadius: 12, overflow: 'hidden',
    borderTopWidth: 1, borderTopColor: 'rgba(255,248,225,0.7)', borderBottomWidth: 1, borderBottomColor: '#8f6f33' },
  buyMainText: { color: '#2a1f0a', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  buySide: { width: 50, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  co: { flex: 1, backgroundColor: BG },
  coHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, height: 52 },
  coBack: { width: 40, alignItems: 'center' },
  coTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  coTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  coTotalText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cartSub: { color: DIM, fontSize: 14 },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  cartThumb: { width: 76, height: 76, borderRadius: 12, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cartImg: { width: 68, height: 68 },
  cartName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cartPrice: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cartX: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  cartBuy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden',
    borderRadius: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.45)' },
  cartBuyText: { color: '#1a1408', fontSize: 16, fontWeight: '800' },
});
