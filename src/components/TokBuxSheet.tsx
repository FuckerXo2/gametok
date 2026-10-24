// Buying TokBux (like Roblox's Robux packages): the packs at the store's prices, from tapping the balance anywhere.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TokBuxIcon } from './TokBuxIcon';
import { useAvatarAccount } from '../avatar/store';
import { TOKBUX_PACKS, TokbuxPack, buyPack, loadPacks } from '../tokbux/purchases';

const POPULAR = 'tokbux_1200';
const FAQ = [
  ['What are TokBux?', 'GameTok’s one currency. Spend them on avatar items here, and on heroes and more inside GameTok games.'],
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
    setBuying(id);
    const err = await buyPack(pack);
    setBuying(null);
    if (err === 'cancelled') return;
    if (err) { Alert.alert('TokBux', err); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const ids = Object.keys(TOKBUX_PACKS).sort((a, b) => TOKBUX_PACKS[b] - TOKBUX_PACKS[a]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.head}>
          <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={26} color="#111" /></Pressable>
          <View style={styles.bal}><TokBuxIcon size={22} /><Text style={styles.balText}>{balance.toLocaleString()}</Text></View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }}>
          <Text style={styles.title}>TokBux</Text>
          <Text style={styles.fine}>One currency for every GameTok game: avatar items, heroes and more.</Text>
          <View style={styles.list}>
            {ids.map((id, i) => {
              const onSale = packs?.find((p) => p.id === id), popular = id === POPULAR;
              return (
                <View key={id} style={[styles.row, i === ids.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.amount}>
                    <TokBuxIcon size={26} />
                    <Text style={styles.amountText}>{TOKBUX_PACKS[id].toLocaleString()}</Text>
                    {popular ? <Text style={styles.tag}>Popular</Text> : null}
                  </View>
                  <Pressable style={[styles.price, popular && styles.pricePop]} onPress={() => buy(id)} disabled={!!buying}>
                    {buying === id || packs === null
                      ? <ActivityIndicator size="small" color={popular ? '#fff' : '#111'} />
                      : <Text style={[styles.priceText, popular && { color: '#fff' }]}>{onSale ? onSale.price : 'Soon'}</Text>}
                  </Pressable>
                </View>
              );
            })}
          </View>
          {FAQ.map(([q, a], i) => (
            <Pressable key={q} style={styles.faq} onPress={() => setOpen(open === i ? null : i)}>
              <View style={styles.faqHead}>
                <Text style={styles.faqQ}>{q}</Text>
                <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color="#999" />
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
  root: { flex: 1, backgroundColor: '#f4f3f7' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16 },
  bal: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 5, paddingLeft: 5, paddingRight: 12 },
  balText: { fontWeight: '800', fontSize: 15, color: '#111' },
  title: { fontSize: 30, fontWeight: '900', color: '#111', letterSpacing: -0.5 },
  fine: { color: '#6b6b78', fontSize: 13, marginTop: 6, marginBottom: 18, fontWeight: '500' },
  list: { backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  amount: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountText: { fontSize: 22, fontWeight: '900', color: '#111' },
  tag: { fontSize: 11, fontWeight: '800', color: '#7c3aed', backgroundColor: '#f1e9ff', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  price: { backgroundColor: '#ececf2', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, minWidth: 84, alignItems: 'center' },
  pricePop: { backgroundColor: '#7c3aed' },
  priceText: { fontWeight: '800', fontSize: 14, color: '#111' },
  faq: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 10 },
  faqHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQ: { fontWeight: '700', fontSize: 14, color: '#111' },
  faqA: { color: '#55556a', fontSize: 14, marginTop: 8, lineHeight: 20 },
});
