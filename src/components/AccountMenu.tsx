// The account menu, like Roblox's: slides in from the left over any screen (the ☰ on Games and on Me). You at the
// top, your TokBux, then Friends, My items, Settings, Help & Safety. Mounted once (App's MainApp); opened with
// DeviceEventEmitter.emit('gametok:open-menu').
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, DeviceEventEmitter, ScrollView, TextInput, Switch, Alert, Linking, ActivityIndicator } from 'react-native';
import Animated, { SlideInLeft, SlideOutLeft, FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAvatarAccount } from '../avatar/store';
import { auth as authApi } from '../services/api';
import { Avatar } from './Avatar';
import { TokBuxIcon } from './TokBuxIcon';
import { TokBuxSheet } from './TokBuxSheet';
import { EditProfileModal } from './EditProfileModal';
import { AddFriendsScreen } from './AddFriendsScreen';

const BG = '#0d0a16', PANEL = '#17121f', CARD = '#201a2b', LINE = 'rgba(255,255,255,0.1)', DIM = 'rgba(255,255,255,0.55)', ACCENT = '#a855f7';
export const openAccountMenu = () => DeviceEventEmitter.emit('gametok:open-menu');

export const AccountMenu: React.FC<{ onMyItems: () => void }> = ({ onMyItems }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const tokbux = useAvatarAccount()?.tokbux ?? 0;
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<'tokbux' | 'profile' | 'friends' | 'settings' | 'help' | null>(null);
  useEffect(() => { const sub = DeviceEventEmitter.addListener('gametok:open-menu', () => setOpen(true)); return () => sub.remove(); }, []);
  const to = (p: typeof page) => { setOpen(false); setPage(p); };

  const Row = ({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) => (
    <Pressable style={styles.row} onPress={onPress}>
      <Ionicons name={icon} size={24} color="#fff" style={{ width: 34 }} />
      <Text style={styles.rowText}>{label}</Text>
    </Pressable>
  );

  return (
    <>
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        {open ? (
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <Animated.View entering={SlideInLeft.duration(220)} exiting={SlideOutLeft.duration(180)} style={[styles.drawer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Pressable style={styles.me} onPress={() => to('profile')}>
                  <Avatar uri={user?.avatar} size={64} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.name} numberOfLines={1}>{user?.displayName || user?.username}</Text>
                    <Text style={styles.handle} numberOfLines={1}>@{user?.username}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={DIM} />
                </Pressable>
                <View style={styles.card}>
                  <View style={styles.cardRow}>
                    <TokBuxIcon size={26} />
                    <Text style={styles.balance}>{tokbux.toLocaleString()}</Text>
                    <Pressable style={styles.buy} onPress={() => to('tokbux')}><Text style={styles.buyText}>Buy TokBux</Text></Pressable>
                  </View>
                </View>
                <Row icon="people-outline" label="Friends" onPress={() => to('friends')} />
                <Row icon="shirt-outline" label="My items" onPress={() => { setOpen(false); onMyItems(); }} />
                <Row icon="settings-outline" label="Settings" onPress={() => to('settings')} />
                <Row icon="shield-checkmark-outline" label="Help & Safety" onPress={() => to('help')} />
              </ScrollView>
            </Animated.View>
            <Animated.View entering={FadeIn} exiting={FadeOut} style={{ flex: 1 }}>
              <Pressable style={styles.dim} onPress={() => setOpen(false)} />
            </Animated.View>
          </View>
        ) : null}
      </Modal>
      <TokBuxSheet visible={page === 'tokbux'} onClose={() => setPage(null)} />
      <EditProfileModal visible={page === 'profile'} onClose={() => setPage(null)} />
      <AddFriendsScreen visible={page === 'friends'} onClose={() => setPage(null)} />
      <SettingsScreen visible={page === 'settings'} onClose={() => setPage(null)} />
      <HelpScreen visible={page === 'help'} onClose={() => setPage(null)} />
    </>
  );
};

// a full-screen page with a back arrow and a title
const Page: React.FC<{ visible: boolean; title: string; onClose: () => void; children: React.ReactNode }> = ({ visible, title, onClose, children }) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={styles.pageHead}>
          <Pressable onPress={onClose} hitSlop={12} style={{ width: 32 }}><Ionicons name="chevron-back" size={26} color="#fff" /></Pressable>
          <Text style={styles.pageTitle}>{title}</Text>
          <View style={{ width: 32 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </Modal>
  );
};
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={{ marginBottom: 22 }}>
    <Text style={styles.section}>{title}</Text>
    <View style={styles.group}>{children}</View>
  </View>
);
const Item = ({ label, value, onPress, danger, right }: { label: string; value?: string; onPress?: () => void; danger?: boolean; right?: React.ReactNode }) => (
  <Pressable style={styles.item} onPress={onPress} disabled={!onPress}>
    <Text style={[styles.itemText, danger && { color: '#f87171' }]}>{label}</Text>
    {right ?? (value ? <Text style={styles.itemValue} numberOfLines={1}>{value}</Text> : null)}
    {onPress && !right ? <Ionicons name="chevron-forward" size={18} color={DIM} /> : null}
  </Pressable>
);

// Settings: password, dark mode, log out (no email: accounts are username + password only, like Roblox)
const SettingsScreen: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [form, setForm] = useState<'password' | null>(null);
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [c, setC] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (visible) setForm(null); }, [visible]);
  const start = (f: typeof form) => { setForm(f); setA(''); setB(''); setC(''); setError(''); };
  const run = async (fn: () => Promise<any>, after: () => void) => {
    setBusy(true); setError('');
    try { await fn(); after(); } catch (e: any) { setError(e?.message || 'Something went wrong'); } finally { setBusy(false); }
  };

  return (
    <Page visible={visible} title="Settings" onClose={onClose}>
      <Section title="ACCOUNT">
        <Item label="Change password" onPress={() => start('password')} />
      </Section>
      {form === 'password' ? (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Change password</Text>
          <TextInput style={styles.input} value={a} onChangeText={setA} placeholder="Current password" placeholderTextColor={DIM} secureTextEntry autoFocus />
          <TextInput style={[styles.input, { marginTop: 10 }]} value={b} onChangeText={setB} placeholder="New password (8+ characters)" placeholderTextColor={DIM} secureTextEntry />
          <TextInput style={[styles.input, { marginTop: 10 }]} value={c} onChangeText={setC} placeholder="Confirm new password" placeholderTextColor={DIM} secureTextEntry />
          <Pressable style={styles.button} disabled={busy} onPress={() => (b !== c ? setError('The new passwords don’t match')
            : run(() => authApi.changePassword(a, b), () => { setForm(null); Alert.alert('Password changed'); }))}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : null}
      <Section title="APP">
        <Item label="Dark mode" right={<View style={{ justifyContent: 'center', height: 52 }}><Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#555', true: ACCENT }} thumbColor="#fff" /></View>} />
      </Section>
      <Section title="">
        <Item label="Log out" danger onPress={() => Alert.alert('Log out?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: () => { onClose(); logout(); } }])} />
      </Section>
    </Page>
  );
};

const HelpScreen: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => (
  <Page visible={visible} title="Help & Safety" onClose={onClose}>
    <Section title="HELP">
      <Item label="Contact us" value="info@gametok.co" onPress={() => Linking.openURL('mailto:info@gametok.co')} />
    </Section>
    <Section title="LEGAL">
      <Item label="Terms of Use" onPress={() => Linking.openURL('https://gametok.co/terms.html')} />
      <Item label="Privacy Policy" onPress={() => Linking.openURL('https://gametok.co/privacy.html')} />
    </Section>
  </Page>
);

const styles = StyleSheet.create({
  drawer: { width: '82%', backgroundColor: PANEL, paddingHorizontal: 18 },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  me: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  name: { color: '#fff', fontSize: 18, fontWeight: '800' },
  handle: { color: DIM, fontSize: 15, marginTop: 2 },
  card: { borderWidth: 1, borderColor: LINE, borderRadius: 16, padding: 14, marginBottom: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  balance: { color: '#fff', fontSize: 20, fontWeight: '800', flex: 1 },
  buy: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  buyText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  rowText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  page: { flex: 1, backgroundColor: BG },
  pageHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  pageTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  section: { color: DIM, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  group: { backgroundColor: CARD, borderRadius: 14, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  itemText: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  itemValue: { color: DIM, fontSize: 14, maxWidth: '55%' },
  form: { backgroundColor: CARD, borderRadius: 14, padding: 16, marginTop: -10, marginBottom: 22 },
  formTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  formSub: { color: DIM, fontSize: 13, marginTop: 4, marginBottom: 12, lineHeight: 18 },
  input: { backgroundColor: BG, borderRadius: 10, height: 48, paddingHorizontal: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: LINE },
  button: { backgroundColor: ACCENT, borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  error: { color: '#f87171', fontSize: 14, marginTop: 10 },
});
