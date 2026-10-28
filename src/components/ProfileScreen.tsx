// Me: the player's avatar and the avatar shop in one screen (like Roblox's Me tab).
// Tap an item: it goes on the avatar straight away. Owned items are worn and saved; items not owned yet are tried on
// and collect in the checkout, bought together with TokBux. "My items" shows only what they own.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Alert, Dimensions, StyleSheet, Pressable, Image, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../context/AuthContext';
import { AvatarStage } from './AvatarStage';
import { EditProfileModal } from './EditProfileModal';
import { openAccountMenu } from './AccountMenu';
import { Avatar, hasHeadshot } from './Avatar';
import { TokBuxIcon } from './TokBuxIcon';
import { TokBuxSheet } from './TokBuxSheet';
import { BuyItemSheet, BuyRequest } from './BuyItemSheet';
import { AVATAR_ITEMS, AvatarItem, AvatarRecord, TABS, Tab, thumbOf } from '../avatar/catalog';
import { buyItem, needsHeadshot, saveAvatar, syncAvatar, uploadHeadshot, useAvatarAccount } from '../avatar/store';

const { width: W, height: H } = Dimensions.get('window');
const CELL = (W - 16 * 2 - 10 * 2) / 3;
const BG = '#0d0a16', PANEL = '#17121f', CARD = '#201a2b', DIM = 'rgba(255,255,255,0.55)', ACCENT = '#a855f7', GREEN = '#22c55e';

type Draft = { look: AvatarRecord; cart: string[] };   // on the stage, and the items in it not owned yet

export const ProfileScreen: React.FC<{ isActive?: boolean }> = () => {
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

  // an outfit is its pieces: owned when they all are, and it costs what's still unowned
  const piecesOf = (i: AvatarItem) => (i.pieces ?? []).map((id) => AVATAR_ITEMS.find((x) => x.id === id)!).filter(Boolean);
  const ownsOne = (i: AvatarItem) => (account?.prices[i.id] ?? i.price) === 0 || !!account?.owned.includes(i.id);
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
  // the saved look changed elsewhere (another phone, a purchase): show it, unless they're mid try-on
  useEffect(() => { if (saved && !draft?.cart.length) setDraft(null); }, [saved]);

  // every change goes on the stage; with nothing unbought in it, it's also saved
  const apply = (next: Draft) => {
    next = { ...next, cart: next.cart.filter((id) => AVATAR_ITEMS.find((i) => i.id === id)?.isWorn?.(next.look)) };
    setDraft(next);
    if (!next.cart.length) saveAvatar(next.look);
  };
  const change = (next: Draft) => {
    if (look) setHistory((h) => ({ undo: [...h.undo.slice(-30), { look, cart }], redo: [] }));
    apply(next);
  };
  const undo = () => {
    const prev = history.undo[history.undo.length - 1]; if (!prev || !look) return;
    setHistory((h) => ({ undo: h.undo.slice(0, -1), redo: [...h.redo, { look, cart }] })); apply(prev);
  };
  const redo = () => {
    const next = history.redo[history.redo.length - 1]; if (!next || !look) return;
    setHistory((h) => ({ undo: [...h.undo, { look, cart }], redo: h.redo.slice(0, -1) })); apply(next);
  };

  const tap = (item: AvatarItem) => {
    if (!look) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(item);
    if (item.isWorn?.(look)) {
      if (item.takeOff) change({ look: item.takeOff(look), cart: cart.filter((id) => id !== item.id) });
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
  const onBought = (bought: boolean) => { setBuyReq(null); if (bought && look) apply({ look, cart: [] }); };   // all owned now: saved
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
  const inMode = useMemo(() => AVATAR_ITEMS.filter((i) => (mode === 'shop' ? !owns(i) : owns(i))), [mode, account]);
  // All: outfits get their own row at the top (like Roblox's Explore Styles), the grid is single items
  const items = inMode.filter((i) => (tab === 'all' ? !i.pieces : i.tab === tab) && (!sub || i.sub === sub));
  const outfitRow = tab === 'all' ? inMode.filter((i) => i.pieces) : [];
  const subs = (TABS.find((t) => t.id === tab)?.subs ?? []).filter((s) => inMode.some((i) => i.tab === tab && i.sub === s));
  const bottomH = cart.length ? 76 : 0;

  // one item in the grid (or the outfits row)
  const ItemTile = ({ i, width }: { i: AvatarItem; width?: number }) => {
    const on = !!look && !!i.isWorn?.(look), owned = owns(i), thumb = thumbOf(i, look?.body);
    return (
      <Pressable onPress={() => tap(i)} style={[styles.item, width ? { width } : null]}>
        <View style={[styles.thumb, selected?.id === i.id && styles.thumbSel]}>
          {on ? <Text style={styles.onTag}>ON</Text> : null}
          {thumb ? <Image source={{ uri: thumb }} style={styles.thumbImg} resizeMode="contain" />
            : <View style={[styles.skinDot, { backgroundColor: i.tint }]} />}
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
      <View style={styles.stage}>
        <AvatarStage style={StyleSheet.absoluteFill} avatar={look} focus={selected?.focus || 'body'} look="dark" headshotOf={shotOf} onHeadshot={onHeadshot} />
        <View style={[styles.topRow, { top: insets.top + 6 }]}>
          <Pressable style={styles.round} onPress={openAccountMenu} hitSlop={6}><Ionicons name="menu" size={22} color="#fff" /></Pressable>
          <View style={styles.seg}>
            {(['shop', 'mine'] as const).map((m) => (
              <Pressable key={m} onPress={() => { setMode(m); setSub(null); }} style={[styles.segBtn, mode === m && styles.segOn]}>
                <Text style={[styles.segText, mode === m && styles.segTextOn]}>{m === 'shop' ? 'Shop' : 'My items'}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.tb} onPress={() => setTokbux(true)} hitSlop={6}>
            <TokBuxIcon size={22} />
            <Text style={styles.tbText}>{(account?.tokbux ?? 0).toLocaleString()}</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.mePill, { top: insets.top + 62 }]} onPress={() => setEditProfile(true)} hitSlop={6}>
          <Avatar uri={user?.avatar} userId={user?.id} size={44} />
          <Ionicons name="pencil" size={15} color="#fff" style={{ marginTop: 8 }} />
        </Pressable>
        <View style={styles.undo}>
          <Pressable style={styles.undoBtn} onPress={undo} hitSlop={6}><Ionicons name="arrow-undo" size={19} color={history.undo.length ? '#fff' : 'rgba(255,255,255,0.3)'} /></Pressable>
          <Pressable style={styles.undoBtn} onPress={redo} hitSlop={6}><Ionicons name="arrow-redo" size={19} color={history.redo.length ? '#fff' : 'rgba(255,255,255,0.3)'} /></Pressable>
        </View>
      </View>

      {/* items */}
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.tabs}>
          {tabs.map((t) => (
            <Pressable key={t.id} onPress={() => { setTab(t.id); setSub(null); setSelected(null); setSeeAll(false); }} style={[styles.tab, tab === t.id && styles.tabOn]}>
              <Text style={[styles.tabText, tab === t.id && styles.tabTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: bottomH + 20 }} showsVerticalScrollIndicator={false}>
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
              <Text style={[styles.heading, { marginBottom: 0 }]}>Outfits</Text>
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
            <Text style={[styles.heading, { paddingHorizontal: 10, paddingTop: 0 }]}>Outfits</Text>
          </Pressable>
        ) : <Text style={styles.heading}>{sub || (tab === 'all' ? (mode === 'mine' ? 'My items' : 'Recommended For You') : TABS.find((t) => t.id === tab)?.label)}</Text>}
        <View style={styles.grid}>
          {items.length ? items.map((i) => <ItemTile key={i.id} i={i} />) : <Text style={styles.empty}>{mode === 'mine' ? 'Nothing here yet. Find things in Shop.' : 'You own everything here. More coming soon.'}</Text>}
        </View>
        </ScrollView>

        {/* the checkout */}
        <View style={styles.bottom} pointerEvents="box-none">
          {cart.length ? (
            <View style={styles.bar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.barTitle}>Checkout ({cart.length})</Text>
                <Text style={styles.barSub} numberOfLines={1}>{cartItems.map((i) => i.name).join(' · ')}</Text>
              </View>
              <Pressable style={styles.buy} onPress={checkout} disabled={buying}>
                <TokBuxIcon size={20} />
                <Text style={styles.buyText}>{buying ? '…' : `${total} · Buy`}</Text>
              </Pressable>
              <Pressable style={styles.bin} onPress={clearCart} hitSlop={6}><Ionicons name="trash-outline" size={19} color="#fff" /></Pressable>
            </View>
          ) : null}
        </View>
      </View>

      <TokBuxSheet visible={tokbux} onClose={() => setTokbux(false)} />
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
  tb: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingVertical: 6, paddingLeft: 6, paddingRight: 12 },
  tbText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  mePill: { position: 'absolute', left: 16, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 30, paddingTop: 6, paddingBottom: 10, paddingHorizontal: 6 },
  undo: { position: 'absolute', left: 16, bottom: 30, flexDirection: 'row', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 4 },
  undoBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  sheet: { flex: 1, backgroundColor: PANEL, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -22 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 8 },
  tabs: { flexDirection: 'row', gap: 22, paddingHorizontal: 18, paddingTop: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
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
  thumbImg: { width: '84%', height: '84%' },
  skinDot: { width: CELL * 0.45, height: CELL * 0.45, borderRadius: CELL },
  itemName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  maker: { color: DIM, fontSize: 13, fontWeight: '500', marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  price: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 4 },
  empty: { color: DIM, fontWeight: '600', padding: 20 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: 10 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0e0b16', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 10, paddingLeft: 16 },
  barTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  barSub: { color: DIM, fontSize: 12, fontWeight: '600', marginTop: 2 },
  buy: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 15 },
  buyText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  bin: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
});
