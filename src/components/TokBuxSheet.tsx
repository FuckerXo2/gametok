// Buying TokBux, laid out like Roblox's Robux packages: the balance, every pack with its price (one highlighted
// "For you"), then the FAQ. Opened from the balance anywhere; buying an item you can't afford goes through
// BuyItemSheet instead (TokBux and the item in one tap).
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TokBuxIcon } from './TokBuxIcon';
import { useAvatarAccount } from '../avatar/store';
import { TOKBUX_PACKS, TokbuxPack, buyPack, devPrice, loadPacks } from '../tokbux/purchases';

const BG = '#0d0a16', CARD = '#17121f', BTN = 'rgba(255,255,255,0.1)', DIM = 'rgba(255,255,255,0.55)', ACCENT = '#a855f7';
const FOR_YOU = 'tokbux_500';
const FAQ = [
  ['What are TokBux?', 'GameTok’s one currency. Spend them on avatar items in Me, and on heroes and more inside GameTok games.'],
  ['Where are my TokBux?', 'They’re added to your account a few seconds after you buy, and show next to your picture everywhere.'],
  ['Do TokBux expire?', 'No. They stay on your account until you spend them.'],
];

export const TokBuxSheet: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const balance = useAvatarAccount()?.tokbux ?? 0;
  const [packs, setPacks] = useState<TokbuxPack[] | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => { if (visible) { setPacks(null); loadPacks().then(setPacks); } }, [visible]);

  const buy = async (id: string) => {
    const pack = packs?.find((p) => p.id === id);
    if (!pack) { Alert.alert('Coming soon', 'TokBux will be on sale here very soon.'); return; }
    if (buying) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBuying(id);
    const err = await buyPack(pack);
    setBuying(null);
    if (err === 'cancelled') return;
    if (err) { Alert.alert('TokBux', err); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const ids = Object.keys(TOKBUX_PACKS).sort((a, b) => TOKBUX_PACKS[b] - TOKBUX_PACKS[a]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.head}>
          <Pressable onPress={onClose} hitSlop={12}><Ionicons name="close" size={28} color="#fff" /></Pressable>
          <TokBuxIcon size={22} style={{ marginLeft: 14 }} />
          <Text style={styles.balText}>{balance.toLocaleString()}</Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>TokBux packages</Text>
          <Text style={styles.fine}>
            By buying TokBux, you agree to our <Text style={styles.link} onPress={() => Linking.openURL('https://gametok.co/terms.html')}>Terms of Use</Text>.
          </Text>
          <View style={styles.card}>
            {ids.map((id) => {
              const onSale = packs?.find((p) => p.id === id), forYou = id === FOR_YOU;
              const price = onSale?.price ?? devPrice(id) ?? 'Soon';
              return (
                <View key={id} style={styles.row}>
                  <TokBuxIcon size={22} />
                  <Text style={styles.amount}>{TOKBUX_PACKS[id].toLocaleString()}</Text>
                  {forYou ? <View style={styles.chip}><Ionicons name="radio-button-on" size={11} color={DIM} /><Text style={styles.chipText}>For you</Text></View> : null}
                  <Pressable style={[styles.price, forYou && styles.priceOn]} onPress={() => buy(id)} disabled={!!buying}>
                    {buying === id || packs === null
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.priceText}>{price}</Text>}
                  </Pressable>
                </View>
              );
            })}
          </View>
          <Text style={styles.h2}>FAQ</Text>
          {FAQ.map(([q, a], i) => (
            <Pressable key={q} style={styles.faq} onPress={() => setOpen(open === i ? null : i)}>
              <View style={styles.faqHead}>
                <Text style={styles.faqQ}>{q}</Text>
                <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={DIM} />
              </View>
              {open === i ? <Text style={styles.faqA}>{a}</Text> : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  balText: { fontWeight: '800', fontSize: 18, color: '#fff', marginLeft: 6 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 10 },
  fine: { color: DIM, fontSize: 12, marginTop: 6, marginBottom: 16, lineHeight: 17 },
  link: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: CARD, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 8 },
  amount: { fontSize: 22, fontWeight: '800', color: '#fff' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BTN, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 },
  chipText: { color: DIM, fontSize: 11, fontWeight: '700' },
  price: { marginLeft: 'auto', backgroundColor: BTN, borderRadius: 10, height: 40, minWidth: 112, alignItems: 'center', justifyContent: 'center' },
  priceOn: { backgroundColor: ACCENT },
  priceText: { fontWeight: '700', fontSize: 14, color: '#fff' },
  h2: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 28, marginBottom: 10 },
  faq: { backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 10 },
  faqHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQ: { fontWeight: '700', fontSize: 14, color: '#fff' },
  faqA: { color: DIM, fontSize: 14, marginTop: 8, lineHeight: 20 },
});
