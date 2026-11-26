// The account menu, like Roblox's: slides in from the left over any screen (the ☰ on Games and on Me). You at the
// top, your TokBux, then Friends, Customize, Settings, Help & Safety. Mounted once (App's MainApp); opened with
// DeviceEventEmitter.emit('gametok:open-menu').
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, DeviceEventEmitter, ScrollView, TextInput, Alert, Linking, ActivityIndicator, Switch } from 'react-native';
import Animated, { SlideInLeft, SlideOutLeft, FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme, type ThemeMode } from '../context/ThemeContext';
import { useAvatarAccount } from '../avatar/store';
import { auth as authApi } from '../services/api';
import { Avatar } from './Avatar';
import { TokBuxIcon } from './TokBuxIcon';
import { TokBuxSheet } from './TokBuxSheet';
import { EditProfileModal } from './EditProfileModal';
import { AddFriendsScreen } from './AddFriendsScreen';

const BG = '#0b0c0d', PANEL = '#141617', CARD = '#1c1f21', LINE = 'rgba(255,255,255,0.1)', DIM = 'rgba(255,255,255,0.55)', ACCENT = '#47ab9a';
export const openAccountMenu = () => DeviceEventEmitter.emit('gametok:open-menu');

export const AccountMenu: React.FC<{ onMyItems: () => void }> = ({ onMyItems }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const tokbux = useAvatarAccount()?.tokbux ?? 0;
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<'tokbux' | 'profile' | 'friends' | 'settings' | 'help' | null>(null);
  useEffect(() => { const sub = DeviceEventEmitter.addListener('gametok:open-menu', () => setOpen(true)); return () => sub.remove(); }, []);
  const to = (p: typeof page) => { setOpen(false); setPage(p); };

  const drawerBg = isDark ? PANEL : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#111827';
  const dimColor = isDark ? DIM : '#6b7280';
  const cardBg = isDark ? 'transparent' : '#f8f9fa';
  const cardBorder = isDark ? LINE : 'rgba(0,0,0,0.08)';

  const Row = ({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) => (
    <Pressable style={styles.row} onPress={onPress}>
      <Ionicons name={icon} size={24} color={textColor} style={{ width: 34 }} />
      <Text style={[styles.rowText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );

  return (
    <>
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        {open ? (
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <Animated.View entering={SlideInLeft.duration(220)} exiting={SlideOutLeft.duration(180)} style={[styles.drawer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, backgroundColor: drawerBg }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Pressable style={styles.me} onPress={() => to('profile')}>
                  <Avatar uri={user?.avatar} size={64} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>{user?.displayName || user?.username}</Text>
                    <Text style={[styles.handle, { color: dimColor }]} numberOfLines={1}>@{user?.username}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={dimColor} />
                </Pressable>
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <View style={styles.cardRow}>
                    <TokBuxIcon size={26} />
                    <Text style={[styles.balance, { color: textColor }]}>{tokbux.toLocaleString()}</Text>
                    <Pressable style={[styles.buy, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]} onPress={() => to('tokbux')}>
                      <Text style={[styles.buyText, { color: textColor }]}>Buy Pixils</Text>
                    </Pressable>
                  </View>
                </View>
                <Row icon="people-outline" label="Friends" onPress={() => to('friends')} />
                <Row icon="shirt-outline" label="Customize" onPress={() => { setOpen(false); onMyItems(); }} />
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
  const { isDark } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.page, { paddingTop: insets.top, backgroundColor: isDark ? BG : '#f8f9fa' }]}>
        <View style={styles.pageHead}>
          <Pressable onPress={onClose} hitSlop={12} style={{ width: 32 }}>
            <Ionicons name="chevron-back" size={26} color={isDark ? '#fff' : '#111827'} />
          </Pressable>
          <Text style={[styles.pageTitle, { color: isDark ? '#fff' : '#111827' }]}>{title}</Text>
          <View style={{ width: 32 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const { isDark } = useTheme();
  return (
    <View style={{ marginBottom: 22 }}>
      {title ? <Text style={[styles.section, { color: isDark ? DIM : '#6b7280' }]}>{title}</Text> : null}
      <View style={[styles.group, { backgroundColor: isDark ? CARD : '#ffffff', borderColor: isDark ? LINE : 'rgba(0,0,0,0.06)', borderWidth: isDark ? 0 : 1 }]}>
        {children}
      </View>
    </View>
  );
};

const Item = ({ label, value, onPress, danger, right }: { label: string; value?: string; onPress?: () => void; danger?: boolean; right?: React.ReactNode }) => {
  const { isDark } = useTheme();
  return (
    <Pressable style={[styles.item, { borderBottomColor: isDark ? LINE : 'rgba(0,0,0,0.06)' }]} onPress={onPress} disabled={!onPress}>
      <Text style={[styles.itemText, { color: isDark ? '#fff' : '#111827' }, danger && { color: '#f87171' }]}>{label}</Text>
      {right ?? (value ? <Text style={[styles.itemValue, { color: isDark ? DIM : '#6b7280' }]} numberOfLines={1}>{value}</Text> : null)}
      {onPress && !right ? <Ionicons name="chevron-forward" size={18} color={isDark ? DIM : '#9ca3af'} /> : null}
    </Pressable>
  );
};

// Settings: password, theme mode (System default / WhatsApp style), log out
const SettingsScreen: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const { logout } = useAuth();
  const { isDark, themeMode, setThemeMode } = useTheme();
  const [form, setForm] = useState<'password' | null>(null);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [c, setC] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (visible) { setForm(null); setShowThemePicker(false); } }, [visible]);
  const start = (f: typeof form) => { setForm(f); setA(''); setB(''); setC(''); setError(''); };
  const run = async (fn: () => Promise<any>, after: () => void) => {
    setBusy(true); setError('');
    try { await fn(); after(); } catch (e: any) { setError(e?.message || 'Something went wrong'); } finally { setBusy(false); }
  };

  const themeDisplayLabel = themeMode === 'system' ? 'System default' : themeMode === 'dark' ? 'Dark' : 'Light';

  return (
    <>
      <Page visible={visible} title={form === 'password' ? 'Change password' : 'Settings'} onClose={form ? () => setForm(null) : onClose}>
        {form === 'password' ? (
          <>
            <Text style={[styles.label, { color: isDark ? DIM : '#6b7280' }]}>Current password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? BG : '#f1f3f5', color: isDark ? '#fff' : '#111827', borderColor: isDark ? LINE : 'rgba(0,0,0,0.1)' }]}
              value={a}
              onChangeText={setA}
              secureTextEntry
              autoFocus
              textContentType="password"
              placeholderTextColor={isDark ? DIM : '#9ca3af'}
            />
            <Text style={[styles.label, { color: isDark ? DIM : '#6b7280' }]}>New password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? BG : '#f1f3f5', color: isDark ? '#fff' : '#111827', borderColor: isDark ? LINE : 'rgba(0,0,0,0.1)' }]}
              value={b}
              onChangeText={setB}
              secureTextEntry
              textContentType="newPassword"
              placeholderTextColor={isDark ? DIM : '#9ca3af'}
            />
            <Text style={[styles.hint, { color: isDark ? DIM : '#6b7280' }]}>At least 8 characters, and not your username.</Text>
            <Text style={[styles.label, { color: isDark ? DIM : '#6b7280' }]}>Confirm new password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? BG : '#f1f3f5', color: isDark ? '#fff' : '#111827', borderColor: isDark ? LINE : 'rgba(0,0,0,0.1)' }]}
              value={c}
              onChangeText={setC}
              secureTextEntry
              textContentType="newPassword"
              placeholderTextColor={isDark ? DIM : '#9ca3af'}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={[styles.button, { marginTop: 28 }, !(a && b && c) && { opacity: 0.4 }]} disabled={busy || !(a && b && c)}
              onPress={() => (b !== c ? setError('The new passwords don’t match')
                : run(() => authApi.changePassword(a, b), () => { setForm(null); Alert.alert('Password changed'); }))}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
            </Pressable>
          </>
        ) : (
          <>
          <Section title="ACCOUNT">
            <Item label="Change password" onPress={() => start('password')} />
          </Section>
          <Section title="APP">
            <Item
              label="Dark mode"
              onPress={() => setThemeMode(isDark ? 'light' : 'dark')}
              right={<Switch value={isDark} onValueChange={(on) => setThemeMode(on ? 'dark' : 'light')} trackColor={{ true: '#47ab9a', false: undefined }} />}
            />
          </Section>
          <Section title="">
            <Item label="Log out" danger onPress={() => Alert.alert('Log out?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: () => { onClose(); logout(); } }])} />
          </Section>
          </>
        )}
      </Page>

      {/* WhatsApp-style theme modal */}
      <Modal
        visible={showThemePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThemePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowThemePicker(false)}>
          <Pressable style={[styles.themeDialog, { backgroundColor: isDark ? '#1c1f21' : '#ffffff' }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.themeDialogTitle, { color: isDark ? '#ffffff' : '#111827' }]}>Choose theme</Text>

            {([
              { mode: 'light' as ThemeMode, title: 'Light', desc: 'Always use light theme' },
              { mode: 'dark' as ThemeMode, title: 'Dark', desc: 'Always use dark theme' },
            ] as const).map((opt) => {
              const isSelected = themeMode === opt.mode;
              return (
                <Pressable
                  key={opt.mode}
                  style={[styles.themeOption, isSelected && { backgroundColor: isDark ? 'rgba(71,171,154,0.12)' : 'rgba(71,171,154,0.08)' }]}
                  onPress={() => {
                    setThemeMode(opt.mode);
                    setShowThemePicker(false);
                  }}
                >
                  <View style={styles.themeRadio}>
                    <View style={[styles.radioOuter, { borderColor: isSelected ? ACCENT : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)') }]}>
                      {isSelected && <View style={[styles.radioInner, { backgroundColor: ACCENT }]} />}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.themeOptionTitle, { color: isDark ? '#ffffff' : '#111827', fontWeight: isSelected ? '700' : '500' }]}>{opt.title}</Text>
                    <Text style={[styles.themeOptionDesc, { color: isDark ? DIM : '#6b7280' }]}>{opt.desc}</Text>
                  </View>
                </Pressable>
              );
            })}

            <View style={styles.dialogActions}>
              <Pressable onPress={() => setShowThemePicker(false)} style={styles.dialogBtn}>
                <Text style={[styles.dialogBtnText, { color: ACCENT }]}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
  label: { color: DIM, fontSize: 13, fontWeight: '600', marginTop: 18, marginBottom: 6 },
  hint: { color: DIM, fontSize: 12, marginTop: 6 },
  form: { backgroundColor: CARD, borderRadius: 14, padding: 16, marginTop: -10, marginBottom: 22 },
  formTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  formSub: { color: DIM, fontSize: 13, marginTop: 4, marginBottom: 12, lineHeight: 18 },
  input: { backgroundColor: BG, borderRadius: 10, height: 48, paddingHorizontal: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: LINE },
  button: { backgroundColor: ACCENT, borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  error: { color: '#f87171', fontSize: 14, marginTop: 10 },

  // WhatsApp-style theme dialog
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  themeDialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  themeDialogTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  themeRadio: {
    marginRight: 14,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  themeOptionTitle: {
    fontSize: 16,
    marginBottom: 2,
  },
  themeOptionDesc: {
    fontSize: 12,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  dialogBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dialogBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
