// Me: the player's avatar and the avatar shop in one screen (like Roblox's Me tab).
// Tap an item: it goes on the avatar straight away. Owned items are worn and saved; items not owned yet are tried on
// and collect in the cart (in Shop and Customize alike), bought together with TokBux. The avatar button on
// the left (like Roblox's) opens a menu of the parts of the avatar to change, and the profile.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Alert, Dimensions, StyleSheet, Pressable, Image, DeviceEventEmitter, PanResponder, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../context/AuthContext';
import { AvatarStage, stagePicture } from './AvatarStage';
import { EditProfileModal } from './EditProfileModal';
import { openAccountMenu } from './AccountMenu';
import { Avatar, hasHeadshot } from './Avatar';
import { TokBuxIcon } from './TokBuxIcon';
import { TokBuxSheet } from './TokBuxSheet';
import { BuyItemSheet, BuyRequest } from './BuyItemSheet';
import { ItemDetails, ItemOptions, shareItem } from './ItemDetails';
import { AVATAR_ITEMS, AvatarItem, AvatarRecord, Focus, TABS, Tab, thumbOf } from '../avatar/catalog';
import { useSavedLooks } from '../avatar/looks';
import { buyItem, needsHeadshot, saveAvatar, syncAvatar, syncShop, uploadHeadshot, useAvatarAccount } from '../avatar/store';

const { width: W, height: H } = Dimensions.get('window');
const CELL = Math.floor((W - 16 * 2 - 10 * 2) / 3) - 1;   // three across (floored: a fraction over and the third wraps)
const BG = '#0d0a16', PANEL = '#17121f', CARD = '#201a2b', DIM = 'rgba(255,255,255,0.55)', ACCENT = '#a855f7', BUY = '#000000', GREEN = '#22c55e';

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
const CTABS: { id: 'avatars' | 'body' | 'clothing' | 'accessories'; label: string; slots: CSlot[] }[] = [
  { id: 'avatars', label: 'Avatars', slots: [] },
  { id: 'body', label: 'Body', slots: [   // (boy or girl is picked at sign-up: no body swapping here)
    { id: 'hair', label: 'Hair', icon: 'cut-outline', focus: 'head', subs: ['Hair'] },
    { id: 'beard', label: 'Beard', icon: 'man-outline', focus: 'head', subs: ['Beards'], only: 'Male' },
    { id: 'face', label: 'Face', icon: 'happy-outline', focus: 'head', subs: ['Face'] },
    { id: 'build', label: 'Build', icon: 'resize-outline', focus: 'body', panel: 'build' },
    { id: 'skin', label: 'Skin', icon: 'color-palette-outline', focus: 'body', panel: 'skin' },
  ] },
  { id: 'clothing', label: 'Clothing', slots: [
    { id: 'top', label: 'Top', icon: 'shirt-outline', focus: 'torso', subs: ['T-Shirts', 'Sweaters', 'Shirts'] },
    { id: 'bottom', label: 'Bottom', icon: 'walk-outline', focus: 'legs', subs: ['Pants', 'Shorts'] },
    { id: 'shoes', label: 'Shoes', icon: 'footsteps-outline', focus: 'feet', subs: ['Shoes'] },
  ] },
  { id: 'accessories', label: 'Accessories', slots: [
    { id: 'hats', label: 'Head', icon: 'person-circle-outline', focus: 'head', subs: ['Hats'] },
    { id: 'shoulders', label: 'Shoulder', icon: 'shield-outline', focus: 'torso', subs: ['Shoulders'] },
  ] },
];
const EDITOR_SUBS: (string | undefined)[] = ['Build', 'Face', 'Skin'];

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

export const ProfileScreen: React.FC<{ isActive?: boolean }> = ({ isActive }) => {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const account = useAvatarAccount();
  const saved = account?.avatar ?? null;

  const [mode, setMode] = useState<'shop' | 'mine'>('shop');
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
  const bar = useRef<View>(null), [barTop, setBarTop] = useState(0);   // the options card floats just above the bar
  const openOptions = (i: AvatarItem) => bar.current?.measureInWindow((_x, y) => { setBarTop(y); setOptions(i); });
  const [editor, setEditor] = useState<Editor | null>(null);   // one of its editors, open
  const [grab, setGrab] = useState(false);   // a finger on an editor control: the panel doesn't scroll
  const [ctab, setCtab] = useState<(typeof CTABS)[number]['id']>('body');   // Customize's tab
  const [cslot, setCslot] = useState<CSlot>(CTABS[1].slots[0]);   // ... and its slot
  const saved_ = useSavedLooks(user?.id);

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
    const sub = DeviceEventEmitter.addListener('gametok:my-items', () => { setMode('mine'); setTab('all'); setSub(null); });
    return () => sub.remove();
  }, []);
  // signing in or out switches whose avatar this is
  useEffect(() => { syncAvatar(); }, [user?.id]);
  // the Shop's items, fresh each time the Me screen opens (new ones show up without restarting the app)
  useEffect(() => { if (isActive) syncShop(); }, [isActive]);
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
      Alert.alert('Wear outfit?', 'This replaces the clothes you’re wearing.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Wear', onPress: () => change({ look: item.wear!(look), cart: [...cart.filter((id) => !unowned.includes(id)), ...unowned] }) },
      ]);
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

  const tabs = TABS;
  // body shape, face and skin colour aren't items: they're set in the avatar button's editors, not listed here
  const inMode = useMemo(() => AVATAR_ITEMS.filter((i) => !EDITOR_SUBS.includes(i.sub) && (mode === 'shop' ? !owns(i) : owns(i))), [mode, account]);
  // All: outfits get their own row at the top (like Roblox's Explore Styles), the grid is single items
  const items = inMode.filter((i) => (tab === 'all' ? !i.pieces : i.tab === tab) && (!sub || i.sub === sub));
  const outfitRow = tab === 'all' ? inMode.filter((i) => i.pieces) : [];
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
  const buildPanel = () => (
    <>
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

  // Customize > Avatars: save what's on now (bought things only), wear a saved one, hold to delete
  const saveLook = () => {
    if (!look) return;
    if (cart.length) { Alert.alert('Buy first', 'Saved looks are made of things you own. Buy what’s in the checkout, then save.'); return; }
    saved_.save(look, stagePicture(look));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  const wearLook = (r: AvatarRecord) => { if (look) change({ look: r, cart: [] }); };

  // what's on in a slot: its picture in the slot row
  const slotThumb = (sl: CSlot) => {
    if (!look) return null;
    if (sl.panel === 'skin') return <View style={[styles.slotDot, { backgroundColor: skinItems.find((i) => i.isWorn?.(look))?.tint }]} />;
    // what's worn; nothing on: the slot's first item (a picture of the kind of thing, not an icon)
    const all = sl.subs ? AVATAR_ITEMS.filter((i) => !i.pieces && sl.subs!.includes(i.sub)) : [];
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
        {i.category === 'body' ? null : <Text style={styles.maker} numberOfLines={1}>GameTok</Text>}
        {i.category === 'body' ? null   /* your body: not an item, no price */
          : owned && (i.pieces ? piecesOf(i).some((p) => (account?.prices[p.id] ?? p.price) > 0) : priceOf(i) > 0) ? <Text style={[styles.price, { color: GREEN }]}>✓ Owned</Text>
          : priceOf(i) === 0 ? <Text style={[styles.price, { color: DIM }]}>Free</Text>
          : <View style={styles.priceRow}><TokBuxIcon size={16} /><Text style={styles.price}>{priceOf(i)}</Text></View>}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      {/* the avatar, with the controls floating over it (like Roblox's Me) */}
      <View style={[styles.stage, editor && { height: H * 0.56 }]}>
        <AvatarStage style={StyleSheet.absoluteFill} avatar={look} focus={editor?.focus || selected?.focus || (mode === 'mine' && ctab !== 'avatars' ? cslot.focus : 'body')} look="dark" headshotOf={shotOf} onHeadshot={onHeadshot} />
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
        ) : <>
        <View style={[styles.topRow, { top: insets.top + 6 }]}>
          <Pressable style={styles.round} onPress={openAccountMenu} hitSlop={6}><Ionicons name="menu" size={22} color="#fff" /></Pressable>
          <View style={styles.seg}>
            {(['shop', 'mine'] as const).map((m) => (
              <Pressable key={m} onPress={() => { setMode(m); setSub(null); }} style={[styles.segBtn, mode === m && styles.segOn]}>
                <Text style={[styles.segText, mode === m && styles.segTextOn]}>{m === 'shop' ? 'Shop' : 'Customize'}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.tb} onPress={() => setTokbux(true)} hitSlop={6}>
            <TokBuxIcon size={22} />
            <Text style={styles.tbText}>{(account?.tokbux ?? 0).toLocaleString()}</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.mePill, { top: insets.top + 62, zIndex: 21 }]} onPress={() => setCustomize(!customize)} hitSlop={6}>
          <Avatar uri={user?.avatar} userId={user?.id} size={44} />
          {customize ? <View style={styles.pillX}><Ionicons name="close" size={20} color="#fff" /></View>
            : <Ionicons name="pencil" size={15} color="#fff" style={{ marginTop: 8 }} />}
        </Pressable>
        <View style={styles.undo}>
          <Pressable style={styles.undoBtn} onPress={undo} hitSlop={6}><Ionicons name="arrow-undo" size={19} color={history.undo.length ? '#fff' : 'rgba(255,255,255,0.3)'} /></Pressable>
          <Pressable style={styles.undoBtn} onPress={redo} hitSlop={6}><Ionicons name="arrow-redo" size={19} color={history.redo.length ? '#fff' : 'rgba(255,255,255,0.3)'} /></Pressable>
        </View>
        </>}
      </View>

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
      <View style={styles.sheet}>
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
                <View style={styles.grid}>
                  <Pressable onPress={saveLook} style={styles.item}>
                    <View style={[styles.thumb, styles.addTile]}><Ionicons name="add" size={34} color="#fff" /></View>
                    <Text style={styles.itemName}>Save look</Text>
                  </Pressable>
                  {saved_.looks.map((l, n) => (
                    <Pressable key={l.id} onPress={() => wearLook(l.look)} onLongPress={() => Alert.alert('Delete this look?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => saved_.remove(l.id) }])} style={styles.item}>
                      <View style={[styles.thumb, !!look && JSON.stringify(look) === JSON.stringify(l.look) && styles.thumbSel]}>
                        {l.picture ? <Image source={{ uri: l.picture }} style={styles.thumbImg} resizeMode="cover" /> : <Ionicons name="person" size={34} color={DIM} />}
                      </View>
                      <Text style={styles.itemName} numberOfLines={1}>Look {saved_.looks.length - n}</Text>
                    </Pressable>
                  ))}
                </View>
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
                    const all = AVATAR_ITEMS.filter((i) => !i.pieces && cslot.subs!.includes(i.sub));
                    const mine = all.filter(owns), more = all.filter((i) => !owns(i));
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
              <Pressable key={t.id} onPress={() => { setTab(t.id); setSub(null); setSelected(null); setSeeAll(false); }} style={[styles.tab, tab === t.id && styles.tabOn]}>
                <Text style={[styles.tabText, tab === t.id && styles.tabTextOn]}>{t.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {subs.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subs}>
            {subs.map((s) => (
              <Pressable key={s} onPress={() => setSub(sub === s ? null : s)} style={[styles.sub, sub === s && styles.subOn]}>
                <Text style={[styles.subText, sub === s && styles.subTextOn]}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {outfitRow.length ? (
          <>
            <View style={styles.rowHead}>
              <Text style={[styles.heading, { marginBottom: 0 }]}>Avatars</Text>
              <Pressable onPress={() => { setTab('outfits'); setSub(null); setSeeAll(true); }} style={styles.seeAll} hitSlop={6}><Text style={styles.seeAllText}>See All</Text></Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {outfitRow.map((i) => <ItemTile key={i.id} i={i} width={CELL} />)}
            </ScrollView>
          </>
        ) : null}
        {seeAll && tab === 'outfits' ? (
          <Pressable style={styles.backRow} onPress={() => { setTab('all'); setSeeAll(false); }} hitSlop={6}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
            <Text style={[styles.heading, { paddingHorizontal: 10, paddingTop: 0 }]}>Avatars</Text>
          </Pressable>
        ) : <Text style={styles.heading}>{sub || (tab === 'all' ? 'Recommended For You' : TABS.find((t) => t.id === tab)?.label)}</Text>}
        <View style={styles.grid}>
          {items.length ? items.map((i) => <ItemTile key={i.id} i={i} />) : <Text style={styles.empty}>You own everything here. More coming soon.</Text>}
        </View>
        </ScrollView>

        </>}
        {/* checkout bar (like Roblox's): one thing on trial is bought straight from it; more open the checkout */}
        {cart.length && !editor ? (
          <View ref={bar} style={[styles.buyBar, { paddingBottom: 10 }]}>
            <Pressable style={styles.buyMain} onPress={() => (cart.length === 1 ? checkout() : setCartOpen(true))} disabled={buying}>
              {cart.length === 1
                ? <><TokBuxIcon size={18} /><Text style={styles.buyMainText}>{total.toLocaleString()}</Text></>
                : <Text style={styles.buyMainText}>View Checkout ({cart.length})</Text>}
            </Pressable>
            <Pressable style={styles.buySide} onPress={() => (cart.length === 1 ? openOptions(cartItems[0]) : clearCart())} hitSlop={4} accessibilityLabel={cart.length === 1 ? 'More' : 'Clear'}>
              <Ionicons name={cart.length === 1 ? 'ellipsis-horizontal' : 'trash-outline'} size={20} color="#fff" />
            </Pressable>
          </View>
        ) : null}
      </View>

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
              <Text style={styles.cartBuyText}>Buy</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <TokBuxSheet visible={tokbux} onClose={() => setTokbux(false)} />
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

    </View>
  );
};


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  stage: { height: H * 0.47, backgroundColor: BG },
  topRow: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, padding: 4 },
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
  rail: { position: 'absolute', left: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 26, padding: 4, gap: 2 },
  railBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  railOn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  edLabel: { color: DIM, fontSize: 15, fontWeight: '700', paddingHorizontal: 18, paddingTop: 20 },
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
  tb: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingVertical: 6, paddingLeft: 6, paddingRight: 12 },
  tbText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  mePill: { position: 'absolute', left: 16, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 30, paddingTop: 6, paddingBottom: 10, paddingHorizontal: 6 },
  undo: { position: 'absolute', left: 16, bottom: 30, flexDirection: 'row', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 4 },
  undoBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  sheet: { flex: 1, backgroundColor: PANEL, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -22 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 8 },
  tabs: { flexDirection: 'row', gap: 22, paddingHorizontal: 18, paddingTop: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  tabsBar: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },   // (the Shop's: more tabs than fit, so it scrolls)
  tabsRow: { gap: 22, paddingHorizontal: 18, paddingTop: 16 },
  tab: { paddingBottom: 10, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: '#fff' },
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
  onTag: { position: 'absolute', top: 7, left: 7, zIndex: 2, backgroundColor: GREEN, color: '#052e12', fontSize: 10, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  thumb: { width: CELL, height: CELL, backgroundColor: CARD, borderRadius: 14, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8 },
  thumbSel: { borderColor: ACCENT },
  detailsBtn: { position: 'absolute', left: 4, right: 4, bottom: 4, height: 28, borderRadius: 8, backgroundColor: 'rgba(13,10,22,0.85)', alignItems: 'center', justifyContent: 'center' },
  detailsText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  thumbImg: { width: '84%', height: '84%' },
  skinDot: { width: CELL * 0.45, height: CELL * 0.45, borderRadius: CELL },
  itemName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  maker: { color: DIM, fontSize: 13, fontWeight: '500', marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  price: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 4 },
  empty: { color: DIM, fontWeight: '600', padding: 20 },
  buyBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 8, backgroundColor: PANEL },
  buyMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 46, borderRadius: 12, backgroundColor: BUY },
  buyMainText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buySide: { width: 50, height: 46, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
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
  cartBuy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: BUY, borderRadius: 12, paddingVertical: 14 },
  cartBuyText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
