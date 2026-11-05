// Buying something for TokBux, like Roblox's buy popup: the item and its price, one Buy. Short of TokBux, it's
// "Buy TokBux and item": the two smallest packs that cover it (the bigger one "Better value"), and the one Buy pays
// for the pack, then the item. Used by Me's checkout and by games (GameSurface's purchase requests).
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Image, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { ALL_ORIENTATIONS } from '../utils/orientationHelper';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { TokBuxIcon } from './TokBuxIcon';
import { getAvatarAccount, syncAvatar } from '../avatar/store';
import { TOKBUX_PACKS, TokbuxPack, buyPack, devPrice, loadPacks, packsCovering } from '../tokbux/purchases';

// black and gold, like the TokBux coin
const CARD = '#0c0b09', GOLD = '#dcb664', GOLD_LINE = 'rgba(220,182,100,0.22)', LINE = 'rgba(255,255,255,0.12)', DIM = 'rgba(255,255,255,0.55)';

export interface BuyRequest {
  name: string;
  price: number;
  was?: number;                         // on sale: the normal price, shown crossed out
  thumb?: string | null;
  buy: () => Promise<string | null>;   // spends the TokBux: null when bought, or an error message
}

// Shown over a game, which may have the phone locked to landscape: the modal allows every orientation so iOS doesn't
// spin the screen back to portrait to show it.
export const BuyItemSheet: React.FC<{ request: BuyRequest | null; onDone: (bought: boolean) => void }> = ({ request, onDone }) => {
  const win = useWindowDimensions();
  const [balance, setBalance] = useState(0);
  const [packs, setPacks] = useState<TokbuxPack[] | null>(null);
  const [pick, setPick] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!request) return;
    setPick(0); setBusy(false); setPacks(null);
    setBalance(getAvatarAccount()?.tokbux ?? 0);
    syncAvatar().then(() => setBalance(getAvatarAccount()?.tokbux ?? 0));   // TokBux may have been bought elsewhere
    loadPacks().then(setPacks);
  }, [request]);
  if (!request) return null;

  const short = request.price - balance;
  const options = short > 0 ? packsCovering(short) : [];
  const close = () => { if (!busy) onDone(false); };

  const go = async () => {
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    if (short > 0) {
      const pack = packs?.find((p) => p.id === options[pick]);
      if (!pack) { setBusy(false); Alert.alert('Coming soon', 'TokBux will be on sale very soon.'); return; }
      const err = await buyPack(pack);
      if (err) { setBusy(false); if (err !== 'cancelled') Alert.alert('TokBux', err); return; }
    }
    const err = await request.buy();
    setBusy(false);
    if (err) { Alert.alert('Not bought', err); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone(true);
  };

  return (
    <Modal visible transparent animationType="fade" supportedOrientations={ALL_ORIENTATIONS} onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={[styles.card, win.width > win.height && { width: 420, alignSelf: 'center' }]} onPress={() => {}}>
          <View style={styles.head}>
            <Text style={styles.title}>{short > 0 ? 'Buy TokBux and item' : 'Buy item'}</Text>
            <Pressable onPress={close} hitSlop={12}><Ionicons name="close" size={24} color="#fff" /></Pressable>
          </View>
          <View style={styles.item}>
            {request.thumb
              ? <Image source={{ uri: request.thumb }} style={styles.thumb} resizeMode="contain" />
              : <View style={[styles.thumb, styles.noThumb]}><Ionicons name="bag-handle-outline" size={26} color={DIM} /></View>}
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={2}>{request.name}</Text>
              <View style={styles.cost}><TokBuxIcon size={15} />
                {request.was ? <Text style={styles.was}>{request.was.toLocaleString()}</Text> : null}
                <Text style={styles.costText}>{request.price.toLocaleString()}</Text>
                {request.was ? <View style={styles.off}><Text style={styles.offText}>-{Math.round((1 - request.price / request.was) * 100)}%</Text></View> : null}
              </View>
            </View>
          </View>
          {options.map((id, i) => {
            const price = packs?.find((p) => p.id === id)?.price ?? devPrice(id);
            return (
              <Pressable key={id} style={[styles.pack, pick === i && styles.packOn]} onPress={() => setPick(i)}>
                <TokBuxIcon size={18} />
                <Text style={styles.packAmount}>{TOKBUX_PACKS[id].toLocaleString()}</Text>
                {i === 1 ? <View style={styles.chip}><Ionicons name="pricetag-outline" size={10} color={GOLD} /><Text style={styles.chipText}>Better value</Text></View> : null}
                <Text style={styles.packPrice}>{packs === null ? '' : price ?? 'Soon'}</Text>
              </Pressable>
            );
          })}
          <Pressable style={[styles.buy, busy && { opacity: 0.6 }]} onPress={go}>
            {/* metallic gold: light at the top, deeper at the bottom, with a thin highlight */}
            <LinearGradient colors={['#f5dc9a', '#dcb35f', '#b88a3c']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
            {busy ? <ActivityIndicator color="#000" /> : short > 0
              ? <Text style={styles.buyText}>Buy</Text>
              : <View style={styles.cost}><TokBuxIcon size={18} /><Text style={styles.buyText}>{request.price.toLocaleString()}</Text></View>}
          </Pressable>
          <Text style={styles.fine}>
            {short > 0 ? 'Your payment method will be charged. GameTok Terms of Use apply.'
              : `You have ${balance.toLocaleString()} TokBux. After: ${(balance - request.price).toLocaleString()}.`}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 22 },
  card: { backgroundColor: CARD, borderRadius: 22, padding: 20, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: GOLD_LINE,
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 30, shadowOffset: { width: 0, height: 16 } },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#fff', fontSize: 19, fontWeight: '800' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: '#17161a' },
  noThumb: { alignItems: 'center', justifyContent: 'center' },
  name: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cost: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  costText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  was: { color: DIM, fontSize: 13, fontWeight: '600', textDecorationLine: 'line-through' },
  off: { backgroundColor: '#ff3a6a', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 2 },
  offText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  pack: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#131215', borderRadius: 14, height: 54, paddingHorizontal: 14, marginBottom: 10 },
  packOn: { borderColor: GOLD, shadowColor: GOLD, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  packAmount: { color: '#fff', fontSize: 16, fontWeight: '700' },
  packPrice: { marginLeft: 'auto', color: '#fff', fontSize: 16, fontWeight: '800' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(220,182,100,0.45)', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  chipText: { color: '#ead08f', fontSize: 11, fontWeight: '700' },
  buy: { borderRadius: 14, overflow: 'hidden', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.45)',
    height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buyText: { color: '#1a1408', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  fine: { color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 15 },
});
