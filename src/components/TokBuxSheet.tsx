// Buying TokBux, like Roblox: the store is a web page (web/store/tokbux.html on R2, STORE_URL) shown full screen,
// so it can change without an app release. The page only shows; the app tells it the balance and the packs at the
// store's prices, and does the purchase (Apple / Google in-app purchase, checked by the backend: src/tokbux/purchases.ts) when a price is tapped.
// Buying an item you can't afford goes through BuyItemSheet instead (TokBux and the item in one tap).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Alert, ActivityIndicator, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAvatarAccount } from '../avatar/store';
import { STORE_URL } from '../avatar/host';
import { TOKBUX_PACKS, TokbuxPack, buyPack, devPrice, loadPacks } from '../tokbux/purchases';

const BG = '#0d0a16';
const FOR_YOU = 'tokbux_500';

export const TokBuxSheet: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const balance = useAvatarAccount()?.tokbux ?? 0;
  const web = useRef<WebView>(null);
  const [packs, setPacks] = useState<TokbuxPack[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { if (visible) { setReady(false); setPacks(null); loadPacks().then(setPacks); } }, [visible]);

  // what the page shows: price null = not on sale on this build ("Soon")
  const view = {
    balance, forYou: FOR_YOU, busy,
    packs: Object.keys(TOKBUX_PACKS).map((id) => ({ id, tokbux: TOKBUX_PACKS[id], price: packs?.find((p) => p.id === id)?.price ?? devPrice(id) ?? null })),
  };
  const state = JSON.stringify({ type: 'STORE_STATE', ...view });
  useEffect(() => {
    if (ready) web.current?.injectJavaScript(`window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(state)} })); true;`);
  }, [ready, state]);

  const buy = useCallback(async (id: string) => {
    const pack = packs?.find((p) => p.id === id);
    if (!pack) { Alert.alert('Coming soon', 'TokBux will be on sale here very soon.'); return; }
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(id);
    const err = await buyPack(pack);
    setBusy(null);
    if (err === 'cancelled') return;
    if (err) { Alert.alert('TokBux', err); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [packs, busy]);

  const onMessage = (e: { nativeEvent: { data: string } }) => {
    let d: any; try { d = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (d.type === 'READY') setReady(true);
    else if (d.type === 'BUY' && TOKBUX_PACKS[d.id]) buy(d.id);
    else if (d.type === 'CLOSE') onClose();
    else if (d.type === 'OPEN' && /^https:\/\/gametok\.co\//.test(String(d.url))) Linking.openURL(d.url);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        <WebView
          ref={web}
          source={{ uri: STORE_URL }}
          style={styles.web}
          originWhitelist={['*']}
          injectedJavaScriptBeforeContentLoaded={`window.GAMETOK_STORE = ${JSON.stringify(view)}; true;`}
          onMessage={onMessage}
          onLoadEnd={() => setReady(true)}
          bounces={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
        />
        {/* until the page is up (like Roblox's loading screen): a way out, and a spinner */}
        {!ready ? (
          <View style={[styles.loading, { paddingTop: insets.top }]}>
            <Pressable style={styles.x} onPress={onClose} hitSlop={12}><Ionicons name="close" size={28} color="#fff" /></Pressable>
            <ActivityIndicator color="#fff" style={{ marginTop: 'auto', marginBottom: 'auto' }} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  web: { flex: 1, backgroundColor: BG },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: BG },
  x: { marginLeft: 16, marginTop: 12, width: 32, height: 32, justifyContent: 'center' },
});
