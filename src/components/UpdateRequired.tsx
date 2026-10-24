// A version too old to keep working: GameTok asks for the update before anything else.
// The oldest allowed version is on the backend (GET /api/app/config, table app_config).
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { API_URL } from '../services/api';

export const APP_VERSION: string = Constants.expoConfig?.version || '0.0.0';

// '2.10.0' > '2.9.1'
export const olderThan = (a: string, b: string) => {
  const x = a.split('.').map((n) => parseInt(n, 10) || 0), y = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0);
  return false;
};

const APP_STORE_SEARCH = 'itms-apps://search.itunes.apple.com/WebObjects/MZSearch.woa/wa/search?media=software&term=GameTok';

// null while checking (and when offline: never lock someone out for having no signal), else the store page to send them to
export function useUpdateRequired(): string | null {
  const [storeUrl, setStoreUrl] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${API_URL}/app/config`)
      .then((r) => r.json())
      .then((c) => {
        const os = Platform.OS === 'ios' ? 'ios' : 'android';
        if (olderThan(APP_VERSION, c?.minVersion?.[os] || '0.0.0')) setStoreUrl(c?.storeUrl?.[os] || (os === 'ios' ? APP_STORE_SEARCH : 'market://details?id=com.olasubomi.gametok'));
      })
      .catch(() => {});
  }, []);
  return storeUrl;
}

export const UpdateRequired: React.FC<{ storeUrl: string }> = ({ storeUrl }) => (
  <View style={styles.root}>
    <Text style={styles.logo}>GameTOK</Text>
    <Text style={styles.title}>Update GameTok</Text>
    <Text style={styles.body}>This version is too old. Get the new one to keep playing: your avatar, TokBux and friends are all waiting.</Text>
    <Pressable style={styles.btn} onPress={() => Linking.openURL(storeUrl).catch(() => {})}>
      <Text style={styles.btnText}>{Platform.OS === 'ios' ? 'Open the App Store' : 'Open Google Play'}</Text>
    </Pressable>
    <Text style={styles.version}>Version {APP_VERSION}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#140e1d', alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { color: '#a855f7', fontSize: 30, fontWeight: '900', marginBottom: 36 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  body: { color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 23, textAlign: 'center', marginBottom: 32 },
  btn: { backgroundColor: '#a855f7', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  version: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 28 },
});
