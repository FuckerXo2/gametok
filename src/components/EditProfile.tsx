// Edit profile, the way Roblox does it (the user's screen recording, 2026-11-27): your headshot, then rows — Display
// Name, Username, About — each opening its own page with a ✓ to save. The display name is free to change once a week;
// the @username costs 1,000 Pixils (too few: "Not enough Pixils… Buy" straight away, like Roblox's Insufficient
// Funds). The server decides both (gametok-backend PUT /api/users/:id).
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SlideRightModal } from './SlideRightModal';
import { Avatar } from './Avatar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { users } from '../services/api';
import { syncAvatar, useAvatarAccount } from '../avatar/store';

type Page = 'list' | 'name' | 'username' | 'about';
const NAME_MAX = 20, USERNAME_MAX = 20, ABOUT_MAX = 150;

export const EditProfile = ({ visible, onClose, onGetPixils }: { visible: boolean; onClose: () => void; onGetPixils?: () => void }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, refreshUser } = useAuth();
  const pixils = useAvatarAccount()?.tokbux ?? 0;
  const [page, setPage] = useState<Page>('list');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible) setPage('list'); }, [visible]);

  const price = user?.usernamePrice ?? 1000;
  const nextAt = user?.nameChange?.nextAt ? new Date(user.nameChange.nextAt) : null;
  const nameLocked = !!nextAt && nextAt.getTime() > Date.now();
  const when = nextAt?.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  const buyPixils = () => { onClose(); onGetPixils?.(); };
  const open = (p: Page) => {
    if (p === 'username' && pixils < price) {
      Alert.alert('Not enough Pixils', `You need ${(price - pixils).toLocaleString()} more Pixils to change your username. Would you like to buy more Pixils?`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Buy', onPress: buyPixils }]);
      return;
    }
    setValue(p === 'name' ? user?.displayName || '' : p === 'username' ? user?.username || '' : user?.bio || '');
    setPage(p);
  };

  const clean = value.trim();
  const original = page === 'name' ? user?.displayName || '' : page === 'username' ? user?.username || '' : user?.bio || '';
  const valid = page === 'name' ? !!clean && !nameLocked : page === 'username' ? /^[A-Za-z0-9_]{3,20}$/.test(clean) : true;
  const canSave = valid && clean !== original;

  const send = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await users.update(user.id, page === 'name' ? { displayName: clean } : page === 'username' ? { username: clean, price } : { bio: clean });
      await refreshUser();
      if (page === 'username') syncAvatar();   // the Pixils it cost
      setPage('list');
    } catch (e: any) {
      if (e?.code === 'NOT_ENOUGH_TOKBUX') {
        Alert.alert('Not enough Pixils', `${e.message} to change your username. Would you like to buy more Pixils?`,
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Buy', onPress: buyPixils }]);
      } else if (e?.code) {
        if (e.code === 'NAME_COOLDOWN' || e.code === 'PRICE_CHANGED') refreshUser();
        Alert.alert("Couldn't change it", e.message);
      } else Alert.alert("Couldn't save", 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };
  const save = () => {
    if (!canSave || saving) return;
    if (page === 'username') {
      Alert.alert('Change username?', `@${user?.username} becomes @${clean} for ${price.toLocaleString()} Pixils.`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Change', onPress: send }]);
    } else send();
  };

  const header = (title: string, back: () => void, tick: boolean) => (
    <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
      <Pressable onPress={back} style={styles.headerBtn} hitSlop={8}><Ionicons name="chevron-back" size={26} color={colors.text} /></Pressable>
      <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      <View style={styles.headerBtn}>
        {tick ? (saving ? <ActivityIndicator color={colors.text} />
          : <Pressable onPress={save} disabled={!canSave} hitSlop={8}><Ionicons name="checkmark" size={26} color={colors.text} style={{ opacity: canSave ? 1 : 0.3 }} /></Pressable>) : null}
      </View>
    </View>
  );
  const row = (label: string, val: string, p: Page, last = false) => (
    <Pressable onPress={() => open(p)} style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, pressed && { opacity: 0.6 }]}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>{val}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );

  const max = page === 'name' ? NAME_MAX : page === 'username' ? USERNAME_MAX : ABOUT_MAX;
  const note = page === 'name'
    ? (nameLocked ? `This is the name other players see on Pixil. You can change it again on ${when}.` : 'This is the name other players see on Pixil. You can change it once a week.')
    : page === 'username' ? `Your @ that friends find you by. Changing it costs ${price.toLocaleString()} Pixils. Letters, numbers and _ only.`
    : 'Let others know more about you. Keep yourself safe, don\'t share personal details.';

  return (
    <SlideRightModal visible={visible} onClose={onClose}>
      <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {page === 'list' ? (
          <>
            {header('Edit profile', onClose, false)}
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.hero}>
                <View style={[styles.ring, { borderColor: colors.border, backgroundColor: colors.surface }]}><Avatar uri={user?.avatar} userId={user?.id} size={104} /></View>
              </View>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                {row('Display Name', user?.displayName || '', 'name')}
                {row('Username', user?.username || '', 'username')}
                {row('About', user?.bio || 'Say something...', 'about', true)}
              </View>
            </ScrollView>
          </>
        ) : (
          <>
            {header(page === 'name' ? 'Edit Display Name' : page === 'username' ? 'Edit Username' : 'About', () => setPage('list'), !(page === 'name' && nameLocked))}
            <View style={styles.content}>
              <Text style={[styles.note, { color: colors.textSecondary }]}>{note}</Text>
              <View style={[styles.field, page === 'about' && styles.fieldTall, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {page === 'username' ? <Text style={[styles.at, { color: colors.textSecondary }]}>@</Text> : null}
                <TextInput
                  value={value}
                  onChangeText={(t) => setValue(page === 'username' ? t.replace(/\s/g, '') : t)}
                  autoFocus={!(page === 'name' && nameLocked)}
                  editable={!(page === 'name' && nameLocked)}
                  maxLength={max}
                  multiline={page === 'about'}
                  autoCapitalize={page === 'username' ? 'none' : 'sentences'}
                  autoCorrect={page === 'about'}
                  returnKeyType={page === 'about' ? 'default' : 'done'}
                  onSubmitEditing={page === 'about' ? undefined : save}
                  placeholder={page === 'about' ? 'Say something...' : ''}
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, page === 'about' && styles.inputTall, { color: page === 'name' && nameLocked ? colors.textSecondary : colors.text }]}
                />
                {value && page !== 'about' && !(page === 'name' && nameLocked)
                  ? <Pressable onPress={() => setValue('')} hitSlop={8}><Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} /></Pressable> : null}
              </View>
              <Text style={[styles.count, { color: page === 'username' && clean && !valid ? '#ff6b6b' : colors.textSecondary }]}>{value.length}/{max}</Text>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SlideRightModal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', marginLeft: 2 },
  content: { padding: 16 },
  hero: { alignItems: 'center', marginTop: 12, marginBottom: 24 },
  ring: { width: 116, height: 116, borderRadius: 58, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  card: { borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 54, gap: 8 },
  rowLabel: { fontSize: 15, fontWeight: '700' },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '500' },
  note: { fontSize: 14, fontWeight: '500', lineHeight: 20, marginTop: 4 },
  field: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, marginTop: 14, minHeight: 50 },
  fieldTall: { alignItems: 'flex-start', minHeight: 110, paddingVertical: 10 },
  at: { fontSize: 16, fontWeight: '600', marginRight: 1 },
  input: { flex: 1, fontSize: 16, fontWeight: '600', paddingVertical: 12 },
  inputTall: { paddingVertical: 2, textAlignVertical: 'top', minHeight: 90 },
  count: { fontSize: 12, fontWeight: '600', marginTop: 6 },
});
