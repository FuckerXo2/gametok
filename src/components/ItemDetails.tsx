// An avatar item's details (like Roblox's): the item on its own, turning (drag to spin it: games/avatar-editor/
// item-view.html in a WebView), its name, maker, kind and price, and Buy / Try On (or Wear when it's owned).
// Also the "…" options for an item (View Details, Share, Remove) and sharing it outside the app.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Share, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TokBuxIcon } from './TokBuxIcon';
import { AvatarItem, AvatarRecord } from '../avatar/catalog';
import { AVATAR_HOST } from '../avatar/host';

const BG = '#0d0a16', CARD = '#201a2b', DIM = 'rgba(255,255,255,0.55)', BUY = '#000000', GREEN = '#22c55e';
// bump with every change to item-view.html (phones cache it)
const VIEW_V = 5;
const NAKED = { head: null, top: null, arms: null, legs: null, feet: null, acc: null };

// what the viewer shows: the item alone on this body; hair and beards on a grey head; an outfit on the whole avatar
function viewUrl(item: AvatarItem, look: AvatarRecord) {
  const whole = !!item.whole;
  const base: AvatarRecord = whole ? look : { ...look, hair: null, beard: false, parts: { ...look.parts, ...NAKED } };
  const record = item.wear ? item.wear(base) : base;
  const show = whole ? 'all' : item.category === 'hair' ? 'head' : 'item';
  return `${AVATAR_HOST}/item-view.html?v=${VIEW_V}&r=${encodeURIComponent(JSON.stringify({ record, show }))}`;
}

// (to gametok.co for now: the website has no item pages yet)
export function shareItem(item: AvatarItem) {
  Share.share({ message: `Check out ${item.name} on GameTok! https://gametok.co` }).catch(() => {});
}

export const ItemDetails: React.FC<{
  item: AvatarItem | null; look: AvatarRecord | null; price: number; owned: boolean; worn: boolean;
  onClose: () => void; onBuy: () => void; onWear: () => void;
}> = ({ item, look, price, owned, worn, onClose, onBuy, onWear }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [loaded, setLoaded] = useState(false);
  const size = width - 32;
  useEffect(() => setLoaded(false), [item?.id]);
  return (
    <Modal visible={!!item} animationType="slide" onRequestClose={onClose}>
      {item && look ? (
        <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.head}>
            <Pressable onPress={onClose} hitSlop={10} style={styles.headBtn}><Ionicons name="chevron-back" size={26} color="#fff" /></Pressable>
            <Pressable onPress={() => shareItem(item)} hitSlop={10} style={styles.headBtn}><Ionicons name="share-outline" size={23} color="#fff" /></Pressable>
          </View>
          <View style={[styles.view, { width: size, height: size }]}>
            <WebView
              source={{ uri: viewUrl(item, look) }}
              style={styles.web} containerStyle={styles.web}
              originWhitelist={['*']} scrollEnabled={false} bounces={false} javaScriptEnabled
              onMessage={(e) => { try { if (JSON.parse(e.nativeEvent.data).type === 'LOADED') setLoaded(true); } catch {} }}
            />
            {!loaded ? <ActivityIndicator style={StyleSheet.absoluteFill} color="#fff" /> : null}
            <View style={styles.hint} pointerEvents="none"><Ionicons name="sync-outline" size={13} color={DIM} /><Text style={styles.hintText}>Drag to turn</Text></View>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.maker}>By GameTok</Text>
            <View style={styles.tags}><Text style={styles.tag}>{item.tab === 'avatars' ? 'Avatar' : item.pieces ? 'Outfit' : item.sub}</Text></View>
            {owned ? <Text style={[styles.price, { color: GREEN }]}>✓ Owned</Text>
              : price === 0 ? <Text style={[styles.price, { color: DIM }]}>Free</Text>
              : <View style={styles.priceRow}><TokBuxIcon size={20} /><Text style={styles.price}>{price.toLocaleString()}</Text></View>}
          </View>
          <View style={styles.actions}>
            {owned || price === 0 ? (
              <Pressable style={[styles.btn, styles.main]} onPress={onWear}><Text style={styles.btnText}>{worn ? 'Take Off' : 'Wear'}</Text></Pressable>
            ) : (
              <>
                <Pressable style={[styles.btn, styles.side]} onPress={onWear}><Text style={styles.btnText}>{worn ? 'Take Off' : 'Try On'}</Text></Pressable>
                <Pressable style={[styles.btn, styles.main]} onPress={onBuy}>
                  <TokBuxIcon size={18} /><Text style={styles.btnText}>{price.toLocaleString()}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      ) : null}
    </Modal>
  );
};

// the "…" options (like Roblox's): a card of actions for one item, floating just above the checkout bar
export const ItemOptions: React.FC<{
  visible: boolean; above: number; onClose: () => void;
  options: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; danger?: boolean; onPress: () => void }[];
}> = ({ visible, above, onClose, options }) => {
  const { height } = useWindowDimensions();
  // the picked action runs once this card is gone: iOS won't open the share sheet (or another page) over one
  // that's still closing
  const picked = useRef<(() => void) | null>(null);
  const run = () => { const f = picked.current; picked.current = null; f?.(); };
  const pick = (f: () => void) => { picked.current = f; onClose(); if (Platform.OS !== 'ios') setTimeout(run, 250); };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={run}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.card, { bottom: height - above + 10 }]}>
        {options.map((o, n) => (
          <Pressable key={o.label} style={({ pressed }) => [styles.opt, n > 0 && styles.optLine, pressed && styles.optDown]} onPress={() => pick(o.onPress)}>
            <Ionicons name={o.icon} size={24} color={o.danger ? '#f87171' : '#fff'} />
            <Text style={[styles.optText, o.danger && { color: '#f87171' }]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, height: 52 },
  headBtn: { width: 40, alignItems: 'center' },
  view: { alignSelf: 'center', borderRadius: 20, backgroundColor: CARD, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
  hint: { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4 },
  hintText: { color: DIM, fontSize: 12 },
  info: { paddingHorizontal: 18, paddingTop: 18, gap: 4 },
  name: { color: '#fff', fontSize: 24, fontWeight: '800' },
  maker: { color: DIM, fontSize: 15 },
  tags: { flexDirection: 'row', marginTop: 6 },
  tag: { color: '#fff', fontSize: 13, fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  price: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 'auto' },
  btn: { flex: 1, height: 50, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  main: { backgroundColor: BUY },
  side: { backgroundColor: 'rgba(255,255,255,0.1)' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  card: { position: 'absolute', left: 16, right: 16, backgroundColor: '#242328', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 20, height: 60 },
  optLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },
  optDown: { backgroundColor: 'rgba(255,255,255,0.06)' },
  optText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
